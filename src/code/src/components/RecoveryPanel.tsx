import {t, useLanguage, locale} from "../i18n";
import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { Recovery } from "../../lib/schoolFeatures";
import type { Item } from "../types";
import { communityCall, ServiceUnavailableError } from "../../lib/community";

type Context = {
  version: number;
  status: string;
  partners: { id: string; name: string }[];
  requests: Recovery[];
};

// The existing recovery RPCs/table are shared by individual and bilateral flows.
export function RecoveryPanel({
  item,
  userId,
  onChanged,
}: {
  item: Item;
  userId: string;
  onChanged: () => void;
}) {
  useLanguage();
  const [context, setContext] = useState<Context | null>(null);
  const [partner, setPartner] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [loading,setLoading]=useState(true);
  const [revision,setRevision]=useState(0);
  const [stars, setStars] = useState("");
  const [independentReason, setIndependentReason] = useState("");
  const epoch = useRef(0),
    sequence = useRef(0),
    pending = useRef(false);
  const latest = useRef({ item, onChanged });
  const unavailable=useRef(false);
  latest.current = { item, onChanged };
  const owner = item.user.id === userId;

  async function refresh(lifecycle = epoch.current) {
    const request = ++sequence.current;
    const result = await supabase!.rpc("recovery_context", { p_item: item.id });
    if (lifecycle !== epoch.current || request !== sequence.current) return;
    if(result.error?.code==='PGRST202'||result.data?.version===1)throw new ServiceUnavailableError();
    if (
      result.error ||
      result.data?.version !== 2 ||
      !Array.isArray(result.data.requests) ||
      !Array.isArray(result.data.partners)
    )
      throw Error("unavailable");
    setContext(result.data);
    setLoading(false);
    unavailable.current=false;
    setNotice("");
    if (result.data.status !== latest.current.item.status)
      latest.current.onChanged();
  }
  useEffect(() => {
    const lifecycle = ++epoch.current;
    unavailable.current=false;setContext(null);setNotice('');setBusy(false);setLoading(true);
    const update = () => {
      if (!supabase || pending.current||unavailable.current) return;
      void refresh(lifecycle).catch(error => {
        if (lifecycle === epoch.current) {
          unavailable.current=error instanceof ServiceUnavailableError;
          setContext(null);
          setLoading(false);
          setNotice(
            unavailable.current?t("Recuperación segura no disponible todavía. La confirmación requiere la actualización pendiente del servicio. No se cambió el estado."):t("Recuperación segura no disponible. Revisá la conexión o intentá más tarde. No se cambió el estado."),
          );
        }
      });
    };
    update();
    const timer = window.setInterval(update, 5000);
    window.addEventListener("focus", update);
    return () => {
      ++epoch.current;
      ++sequence.current;
      clearInterval(timer);
      window.removeEventListener("focus", update);
    };
  }, [item.id, userId,revision]);

  async function run(action: () => Promise<unknown>) {
    if (!supabase || pending.current) return;
    const lifecycle = epoch.current;
    pending.current = true;
    ++sequence.current;
    setBusy(true);
    setNotice("");
    try {
      await action();
      if (lifecycle !== epoch.current) return;
      await refresh(lifecycle);
      latest.current.onChanged();
    } catch {
      if (lifecycle === epoch.current)
        setNotice(
          t("No se pudo confirmar el resultado. Actualizá para consultar el estado; reintentar no duplica una confirmación completada."),
        );
    } finally {
      pending.current = false;
      if (lifecycle === epoch.current) setBusy(false);
    }
  }
  const request = context?.requests[0];
  const active =
    context?.status === "perdido" || context?.status === "encontrado";
  const waiting = context?.requests.some((r) => r.state === "pending");
  return (
    <section
      aria-label={t("Recuperación segura")}
      aria-busy={busy||loading}
      className="recovery-tools rounded-2xl border p-4"
    >
      <h3 className="font-bold">{t("Recuperación segura")}</h3>
      <p className="text-sm" role="status">
        {loading ? t("Consultando recuperación…") : context?.requests.some((r) => r.disputed)
          ? t("Devolución disputada")
          : context?.status === "recuperado"
            ? t("Recuperado")
            : waiting
              ? t("Pendiente de confirmación")
              : request?.state === "cancelled"
                ? t("Confirmación rechazada")
              : context ? t("La publicación sigue activa hasta confirmar la recuperación.") : item.status==='recuperado' ? t("Recuperado · estado registrado en la publicación") : t("La publicación conserva su estado. No hay una nueva confirmación registrada.")}
      </p>
      {notice && (
        <p role="alert" className="text-sm">
          {t(notice)}
        </p>
      )}
      {request && (
        <p className="text-xs">
          {request.mode === "individual"
            ? t("Recuperación declarada por el propietario, sin confirmación bilateral.")
            : t('{{owner}} solicita la confirmación a {{partner}}.',{owner:request.owner_name||t('El propietario'),partner:request.partner_name||t('Contraparte')})}
        </p>
      )}
      {context?.requests.some((r) => r.disputed) && (
        <p className="text-xs">{t("Hay un problema informado para revisión. Se conserva el historial y el estado previamente confirmado.")}</p>
      )}
      {owner && active && !waiting && context && (
        <>
          {context.partners.length > 0 ? (
            <>
              <label className="block text-sm"> {t("Contraparte vinculada")} <select
                  className="block border rounded p-2"
                  value={partner}
                  disabled={busy}
                  onChange={(e) => setPartner(e.target.value)}
                >
                  <option value="">{t("Elegí una persona")}</option>
                  {context.partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-xs">{t("Tu solicitud confirma tu parte. La otra persona debe aceptar después de la entrega. Esto afecta sólo a esta publicación.")}</p>
              <button
                disabled={busy || !partner}
                className="underline"
                onClick={() => {
                  if (
                    !window.confirm(
                      t("¿Confirmás que la devolución ocurrió y querés solicitar la confirmación de esta persona?"),
                    )
                  )
                    return;
                  void run(async () => {
                    const r = await supabase!.rpc("request_item_recovery", {
                      p_item: item.id,
                      p_partner: partner,
                    });
                    if (r.error) throw r.error;
                  });
                }}
              >{t("Solicitar confirmación de devolución")}</button>
            </>
          ) : context.requests.some((r) => r.mode !== "individual") ? (
            <p className="text-sm">{t("Hay historial bilateral sin contraparte disponible. Podés registrar una recuperación por cuenta propia, diferenciada de la devolución bilateral.")}</p>
          ) : (
            <>
              <p className="text-xs">{t("Sin contraparte vinculada. La recuperación será declarada por vos, sin confirmación bilateral.")}</p>
              <button
                disabled={busy}
                className="underline"
                onClick={() => {
                  if (
                    !window.confirm(
                      t("¿Confirmás explícitamente que recuperaste el objeto sin contraparte? Esta declaración no es una confirmación bilateral."),
                    )
                  )
                    return;
                  void run(async () => {
                    const r = await supabase!.rpc("request_item_recovery", {
                      p_item: item.id,
                      p_partner: null,
                    });
                    if (r.error) throw r.error;
                  });
                }}
              >{t("Confirmar recuperación sin contraparte")}</button>
            </>
          )}
        </>
      )}
      {owner &&
        active &&
        !waiting &&
        context &&
        (context.partners.length > 0 ||
          context.requests.some((r) => r.mode === "bilateral")) && (
          <details>
            <summary>{t("Lo recuperé por mi cuenta")}</summary>
            <p className="text-xs">{t("Esta declaración no confirma una devolución entre personas ni permite valorar a la contraparte. El historial anterior se conserva.")}</p>
            <label className="block text-sm"> {t("Cómo lo recuperaste sin una devolución bilateral")} <textarea
                minLength={20}
                maxLength={500}
                className="w-full border rounded p-2"
                value={independentReason}
                onChange={(e) => setIndependentReason(e.target.value)}
              />
            </label>
            <button
              disabled={busy || independentReason.trim().length < 20}
              onClick={() => {
                if (
                  !window.confirm(
                    t("¿Confirmás que recuperaste el objeto por tu cuenta, sin una devolución bilateral? Se registrará tu declaración explícita."),
                  )
                )
                  return;
                void run(async () => {
                  await communityCall("declare_independent_recovery", {
                    p_item: item.id,
                    p_reason: independentReason.trim(),
                  });
                });
              }}
            >{t("Confirmar recuperación por cuenta propia")}</button>
          </details>
        )}
      {context?.requests
        .filter((r) => r.state === "pending")
        .map((r) => (
          <div key={r.id} className="flex flex-wrap gap-3">
            {r.partner_id === userId && (
              <button
                disabled={busy}
                className="underline"
                onClick={() => {
                  if (!window.confirm(t("¿Confirmás que la entrega ya ocurrió?")))
                    return;
                  void run(async () => {
                    const result = await supabase!.rpc(
                      "resolve_item_recovery",
                      { p_request: r.id, p_accept: true },
                    );
                    if (result.error) throw result.error;
                  });
                }}
              >{t("Confirmar entrega realizada")}</button>
            )}
            <button
              disabled={busy}
              className="underline"
              onClick={() => {
                if (
                  !window.confirm(
                    t("¿Rechazar o cancelar esta solicitud? La publicación seguirá activa."),
                  )
                )
                  return;
                void run(async () => {
                  const result = await supabase!.rpc("resolve_item_recovery", {
                    p_request: r.id,
                    p_accept: false,
                  });
                  if (result.error) throw result.error;
                });
              }}
            >
              {r.partner_id === userId
                ? t("Rechazar confirmación")
                : t("Cancelar solicitud")}
            </button>
          </div>
        ))}
      {request && (
        <details>
          <summary>{t("Historial, valoración y problemas")}</summary>
          {context?.requests.map((r) => (
            <article key={r.id} className="recovery-history-entry border rounded text-sm">
              <p>
                {r.owner_name || t("Propietario")} →{" "}
                {r.partner_name ||
                  (r.mode === "individual"
                    ? t("Recuperación individual")
                    : t("Contraparte"))}{" "}
                ·{" "}
                {r.state === "confirmed"
                  ? t("Confirmada")
                  : r.state === "cancelled"
                    ? t("Rechazada o cancelada")
                    : t("Pendiente")}
              </p>
              {r.resolved_name && (
                <p>{t("Resolución registrada por")} {r.resolved_name}</p>
              )}
              {r.owner_statement && (
                <p>{t("Declaración del propietario:")} {r.owner_statement}</p>
              )}
              <p> {t("Solicitud:")}{" "}
                {r.created_at
                  ? new Date(r.created_at).toLocaleString(locale())
                  : t("Fecha no disponible")}
                {r.resolved_at &&
                  t(' · Resolución: {{date}}',{date:new Date(r.resolved_at).toLocaleString(locale())})}
              </p>
              {r.state === "confirmed" &&
                r.mode === "bilateral" &&
                (r.my_rating ? (
                  <p>{t("Tu valoración:")} {r.my_rating}/5</p>
                ) : (
                  <>
                    <label className="recovery-rating-field">
                      <span>{t("Calificación")}</span>
                      <select
                        aria-label={t("Calificación de la devolución")}
                        value={stars}
                        onChange={(e) => setStars(e.target.value)}
                      >
                        <option value="">{t("Elegí de 1 a 5 estrellas")}</option>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>
                            {n} {t("estrellas")} </option>
                        ))}
                      </select>
                    </label>
                    <button
                      disabled={busy || !stars}
                      onClick={() =>
                        void run(async () => {
                          await communityCall("rate_recovery", {
                            p_request: r.id,
                            p_stars: Number(stars),
                          });
                        })
                      }
                    >{t("Confirmar valoración")}</button>
                  </>
                ))}
              {r.mode === "bilateral" && (
                <button
                  disabled={busy || r.disputed}
                  onClick={() => {
                    const description = window.prompt(
                      t("Describí el problema de la devolución (hasta 2000 caracteres)."),
                    );
                    if (!description?.trim()) return;
                    void run(async () => {
                      await communityCall("submit_report", {
                        p_kind: "recovery",
                        p_target: r.id,
                        p_reason: "otro",
                        p_description: description.slice(0, 2000),
                      });
                    });
                  }}
                >{t("Informar un problema")}</button>
              )}
            </article>
          ))}
        </details>
      )}
      <button
        disabled={busy||loading}
        className="underline text-sm"
        onClick={() => context ? void run(() => refresh()) : setRevision(v=>v+1)}
      >
        {context ? t("Actualizar confirmaciones") : t("Volver a consultar recuperación")}
      </button>
    </section>
  );
}
