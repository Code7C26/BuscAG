import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { Recovery } from "../../lib/schoolFeatures";
import type { Item } from "../types";
import { communityCall } from "../../lib/community";

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
  const [context, setContext] = useState<Context | null>(null);
  const [partner, setPartner] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [stars, setStars] = useState("");
  const [independentReason, setIndependentReason] = useState("");
  const epoch = useRef(0),
    sequence = useRef(0),
    pending = useRef(false);
  const latest = useRef({ item, onChanged });
  latest.current = { item, onChanged };
  const owner = item.user.id === userId;

  async function refresh(lifecycle = epoch.current) {
    const request = ++sequence.current;
    const result = await supabase!.rpc("recovery_context", { p_item: item.id });
    if (lifecycle !== epoch.current || request !== sequence.current) return;
    if (
      result.error ||
      result.data?.version !== 2 ||
      !Array.isArray(result.data.requests) ||
      !Array.isArray(result.data.partners)
    )
      throw Error("unavailable");
    setContext(result.data);
    setNotice("");
    if (result.data.status !== latest.current.item.status)
      latest.current.onChanged();
  }
  useEffect(() => {
    const lifecycle = ++epoch.current;
    const update = () => {
      if (!supabase || pending.current) return;
      void refresh(lifecycle).catch(() => {
        if (lifecycle === epoch.current) {
          setContext(null);
          setNotice(
            "Recuperación segura no disponible. Revisá la conexión o intentá más tarde. No se cambió el estado.",
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
  }, [item.id, userId]);

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
          "No se pudo confirmar el resultado. Actualizá para consultar el estado; reintentar no duplica una confirmación completada.",
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
      aria-label="Recuperación segura"
      className="rounded-2xl border p-4 space-y-3"
    >
      <h3 className="font-bold">Recuperación segura</h3>
      <p className="text-sm" role="status">
        {context?.requests.some((r) => r.disputed)
          ? "Devolución disputada"
          : context?.status === "recuperado"
            ? "Recuperado"
            : waiting
              ? "Pendiente de confirmación"
              : request?.state === "cancelled"
                ? "Confirmación rechazada"
                : "La publicación sigue activa hasta confirmar la recuperación."}
      </p>
      {notice && (
        <p role="alert" className="text-sm">
          {notice}
        </p>
      )}
      {request && (
        <p className="text-xs">
          {request.mode === "individual"
            ? "Recuperación declarada por el propietario, sin confirmación bilateral."
            : `${request.owner_name || "El propietario"} solicita la confirmación a ${request.partner_name || "la contraparte vinculada"}.`}
        </p>
      )}
      {context?.requests.some((r) => r.disputed) && (
        <p className="text-xs">
          Hay un problema informado para revisión. Se conserva el historial y el
          estado previamente confirmado.
        </p>
      )}
      {owner && active && !waiting && context && (
        <>
          {context.partners.length > 0 ? (
            <>
              <label className="block text-sm">
                Contraparte vinculada
                <select
                  className="block border rounded p-2"
                  value={partner}
                  disabled={busy}
                  onChange={(e) => setPartner(e.target.value)}
                >
                  <option value="">Elegí una persona</option>
                  {context.partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-xs">
                Tu solicitud confirma tu parte. La otra persona debe aceptar
                después de la entrega. Esto afecta sólo a esta publicación.
              </p>
              <button
                disabled={busy || !partner}
                className="underline"
                onClick={() => {
                  if (
                    !window.confirm(
                      "¿Confirmás que la devolución ocurrió y querés solicitar la confirmación de esta persona?",
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
              >
                Solicitar confirmación de devolución
              </button>
            </>
          ) : context.requests.some((r) => r.mode !== "individual") ? (
            <p className="text-sm">
              Hay historial bilateral sin contraparte disponible. Podés
              registrar una recuperación por cuenta propia, diferenciada de la
              devolución bilateral.
            </p>
          ) : (
            <>
              <p className="text-xs">
                Sin contraparte vinculada. La recuperación será declarada por
                vos, sin confirmación bilateral.
              </p>
              <button
                disabled={busy}
                className="underline"
                onClick={() => {
                  if (
                    !window.confirm(
                      "¿Confirmás explícitamente que recuperaste el objeto sin contraparte? Esta declaración no es una confirmación bilateral.",
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
              >
                Confirmar recuperación sin contraparte
              </button>
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
            <summary>Lo recuperé por mi cuenta</summary>
            <p className="text-xs">
              Esta declaración no confirma una devolución entre personas ni
              permite valorar a la contraparte. El historial anterior se
              conserva.
            </p>
            <label className="block text-sm">
              Cómo lo recuperaste sin una devolución bilateral
              <textarea
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
                    "¿Confirmás que recuperaste el objeto por tu cuenta, sin una devolución bilateral? Se registrará tu declaración explícita.",
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
            >
              Confirmar recuperación por cuenta propia
            </button>
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
                  if (!window.confirm("¿Confirmás que la entrega ya ocurrió?"))
                    return;
                  void run(async () => {
                    const result = await supabase!.rpc(
                      "resolve_item_recovery",
                      { p_request: r.id, p_accept: true },
                    );
                    if (result.error) throw result.error;
                  });
                }}
              >
                Confirmar entrega realizada
              </button>
            )}
            <button
              disabled={busy}
              className="underline"
              onClick={() => {
                if (
                  !window.confirm(
                    "¿Rechazar o cancelar esta solicitud? La publicación seguirá activa.",
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
                ? "Rechazar confirmación"
                : "Cancelar solicitud"}
            </button>
          </div>
        ))}
      {request && (
        <details>
          <summary>Historial, valoración y problemas</summary>
          {context?.requests.map((r) => (
            <article key={r.id} className="border rounded p-2 my-2 text-sm">
              <p>
                {r.owner_name || "Propietario"} →{" "}
                {r.partner_name ||
                  (r.mode === "individual"
                    ? "Recuperación individual"
                    : "Contraparte")}{" "}
                ·{" "}
                {r.state === "confirmed"
                  ? "Confirmada"
                  : r.state === "cancelled"
                    ? "Rechazada o cancelada"
                    : "Pendiente"}
              </p>
              {r.resolved_name && (
                <p>Resolución registrada por {r.resolved_name}</p>
              )}
              {r.owner_statement && (
                <p>Declaración del propietario: {r.owner_statement}</p>
              )}
              <p>
                Solicitud:{" "}
                {r.created_at
                  ? new Date(r.created_at).toLocaleString()
                  : "Fecha no disponible"}
                {r.resolved_at &&
                  ` · Resolución: ${new Date(r.resolved_at).toLocaleString()}`}
              </p>
              {r.state === "confirmed" &&
                r.mode === "bilateral" &&
                (r.my_rating ? (
                  <p>Tu valoración: {r.my_rating}/5</p>
                ) : (
                  <>
                    <label>
                      Calificación
                      <select
                        aria-label="Calificación de la devolución"
                        value={stars}
                        onChange={(e) => setStars(e.target.value)}
                      >
                        <option value="">Elegí de 1 a 5 estrellas</option>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>
                            {n} estrellas
                          </option>
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
                    >
                      Valorar devolución
                    </button>
                  </>
                ))}
              {r.mode === "bilateral" && (
                <button
                  disabled={busy || r.disputed}
                  onClick={() => {
                    const description = window.prompt(
                      "Describí el problema de la devolución (hasta 2000 caracteres).",
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
                >
                  Informar un problema
                </button>
              )}
            </article>
          ))}
        </details>
      )}
      <button
        disabled={busy}
        className="underline text-sm"
        onClick={() => void run(() => refresh())}
      >
        Actualizar confirmaciones
      </button>
    </section>
  );
}
