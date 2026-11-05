import { SearchZoneMap } from "./SearchZoneMap";
import React, { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "../../lib/supabase";
import {
  featureFailure,
  objectTagUrl,
  watchZoneError,
  Recovery,
  Watch,
} from "../../lib/schoolFeatures";
import { Item, Message } from "../types";
export function ItemSchoolTools({
  item,
  userId,
  messages,
  onRecovered,
}: {
  item: Item;
  userId: string;
  messages: Message[];
  onRecovered: () => void;
}) {
  const [open, setOpen] = useState(false),
    [ready, setReady] = useState(false),
    [worker, setWorker] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const [watch, setWatch] = useState<Watch | null>(null),
    [lat, setLat] = useState(String(item.lat)),
    [lng, setLng] = useState(String(item.lng)),
    [radius, setRadius] = useState("3");
  const [preference, setPreference] = useState(true),
    [requests, setRequests] = useState<Recovery[]>([]),
    [partner, setPartner] = useState(""),
    [qr, setQr] = useState(""),
    [url, setUrl] = useState("");
  const alive = useRef(true),
    pending = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const owner = item.user.id === userId;
  const partners = [
    ...new Map(
      messages
        .filter(
          (m) =>
            m.itemId === item.id &&
            (m.senderId === userId || m.receiverId === userId),
        )
        .map((m) => {
          const id = m.senderId === userId ? m.receiverId : m.senderId;
          return [
            id,
            {
              id,
              name:
                m.senderId === id
                  ? m.senderName
                  : "Participante de la conversación",
            },
          ];
        }),
    ).values(),
  ];
  async function run(action: () => Promise<void>) {
    if (pending.current || !supabase) return;
    pending.current = true;
    setBusy(true);
    setNotice("");
    try {
      await action();
    } catch {
      if (alive.current) setNotice(featureFailure);
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function recoveries() {
    const r = await supabase!.rpc("list_recovery_confirmations", {
      p_item: item.id,
    });
    if (r.error) throw r.error;
    if (alive.current) setRequests(r.data || []);
  }
  async function load() {
    await run(async () => {
      const capability = await supabase!.rpc("school_features");
      if (capability.error || !capability.data || capability.data.version !== 1)
        throw Error();
      const pref = await supabase!.rpc("get_match_preference");
      if (pref.error) throw pref.error;
      if (!alive.current) return;
      setWorker(capability.data.matching_enabled);
      setPreference(pref.data);
      await recoveries();
      if (owner) {
        const w = await supabase!.rpc("get_item_watch", { p_item: item.id });
        if (w.error) throw w.error;
        if (alive.current && w.data) {
          setWatch(w.data);
          setLat(String(w.data.lat));
          setLng(String(w.data.lng));
          setRadius(String(w.data.radius_km));
        }
      }
      if (alive.current) setReady(true);
    });
  }
  const updateWatch = (enabled: boolean) =>
    run(async () => {
      const zone = watchZoneError(Number(lat), Number(lng), Number(radius));
      if (!lat.trim() || !lng.trim() || !radius.trim() || zone) {
        setNotice(zone || "Completá la zona de búsqueda.");
        return;
      }
      const r = await supabase!.rpc("set_item_watch", {
        p_item: item.id,
        p_enabled: enabled,
        p_lat: Number(lat),
        p_lng: Number(lng),
        p_radius: Number(radius),
      });
      if (r.error) throw r.error;
      if (alive.current) {
        setWatch(r.data);
        setNotice(
          enabled
            ? "Vigilancia guardada. Los avisos requieren el worker activo."
            : "Vigilancia desactivada.",
        );
      }
    });
  const tag = (enabled: boolean, rotate = false) =>
    run(async () => {
      if (
        rotate &&
        !window.confirm(
          "¿Reemplazar el QR? El código anterior dejará de funcionar.",
        )
      )
        return;
      const r = await supabase!.rpc("manage_object_tag", {
        p_item: item.id,
        p_enabled: enabled,
        p_rotate: rotate,
      });
      if (r.error || !r.data) throw Error();
      if (!alive.current) return;
      if (!enabled) {
        setQr("");
        setUrl("");
        setNotice("Etiqueta revocada.");
        return;
      }
      const link = objectTagUrl(window.location.origin, r.data.token);
      const image = await QRCode.toDataURL(link, {
        width: 280,
        margin: 4,
        errorCorrectionLevel: "M",
      });
      if (alive.current) {
        setUrl(link);
        setQr(image);
        setNotice(
          "QR generado localmente. Sólo funcionará en otros dispositivos si esta dirección está publicada.",
        );
      }
    });
  const decide = (request: Recovery, accept: boolean) =>
    run(async () => {
      if (
        !window.confirm(
          accept
            ? "¿Confirmás que la devolución ya ocurrió? No aceptes sólo por recibir un mensaje."
            : "¿Cancelar esta solicitud?",
        )
      )
        return;
      const r = await supabase!.rpc("resolve_item_recovery", {
        p_request: request.id,
        p_accept: accept,
      });
      if (r.error) throw r.error;
      if (!alive.current) return;
      await recoveries();
      onRecovered();
      setNotice(
        r.data === "confirmed"
          ? "Devolución confirmada por ambas partes."
          : "Solicitud cancelada.",
      );
    });
  return (
    <section
      className="rounded-2xl border border-slate-200 p-4 space-y-4"
      aria-label="Herramientas del objeto"
    >
      <button
        type="button"
        className="font-bold text-blue-700 text-left"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          if (!open && !ready) void load();
        }}
      >
        Alertas, QR y devolución segura
      </button>
      {open && (
        <>
          <p className="text-xs text-slate-600">
            Herramientas conectadas a Supabase. Su activación requiere el
            backend escolar; no hay avisos simulados.
          </p>
          {notice && (
            <p role="status" className="text-sm">
              {notice}
            </p>
          )}
          {!ready && !busy && (
            <button onClick={load} className="underline text-sm">
              Reintentar disponibilidad
            </button>
          )}
          {ready && (
            <>
              <label className="flex gap-2 items-start text-sm">
                <input
                  type="checkbox"
                  checked={preference}
                  disabled={busy}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    void run(async () => {
                      const previous = preference;
                      setPreference(enabled);
                      try {
                        const r = await supabase!.rpc("set_match_preference", {
                          p_enabled: enabled,
                        });
                        if (r.error) throw r.error;
                      } catch (error) {
                        if (alive.current) setPreference(previous);
                        throw error;
                      }
                    });
                  }}
                />
                Recibir avisos internos de coincidencias en mi cuenta
              </label>
              <p className="text-xs text-slate-600">
                Motor en segundo plano:{" "}
                {worker
                  ? "habilitado; su ejecución depende del worker programado"
                  : "pendiente de activación"}
                . No se usa seguimiento continuo de GPS. Push y email no están
                certificados.
              </p>
              {owner && item.status === "perdido" && (
                <fieldset disabled={busy} className="space-y-3">
                  <legend className="font-semibold text-sm">
                    Modo alerta y zona de búsqueda
                  </legend>
                  <SearchZoneMap
                    lat={Number(lat)}
                    lng={Number(lng)}
                    radius={Number(radius)}
                    onSelect={(lat, lng) => {
                      if (busy) return;
                      setLat(lat.toFixed(6));
                      setLng(lng.toFixed(6));
                    }}
                  />
                  <p className="text-xs">
                    {watch
                      ? watch.enabled
                        ? "Vigilancia activada"
                        : "Vigilancia desactivada"
                      : "Sin zona personalizada: se conserva el matching general existente."}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-sm">
                      Latitud
                      <input
                        type="number"
                        step="any"
                        min="-90"
                        max="90"
                        value={lat}
                        onChange={(e) => setLat(e.target.value)}
                        className="w-full border rounded-lg p-2"
                      />
                    </label>
                    <label className="text-sm">
                      Longitud
                      <input
                        type="number"
                        step="any"
                        min="-180"
                        max="180"
                        value={lng}
                        onChange={(e) => setLng(e.target.value)}
                        className="w-full border rounded-lg p-2"
                      />
                    </label>
                  </div>
                  <label className="block text-sm">
                    Radio de búsqueda (km)
                    <input
                      type="number"
                      min="0.1"
                      max="100"
                      step="0.1"
                      value={radius}
                      onChange={(e) => setRadius(e.target.value)}
                      className="w-full border rounded-lg p-2"
                    />
                  </label>
                  <button
                    className="underline text-sm"
                    onClick={() => {
                      setLat(String(item.lat));
                      setLng(String(item.lng));
                    }}
                  >
                    Usar ubicación de esta publicación
                  </button>
                  <div className="flex flex-wrap gap-3">
                    <button
                      className="rounded-xl bg-blue-600 px-3 py-2 text-sm text-white"
                      onClick={() => updateWatch(true)}
                    >
                      Activar o actualizar vigilancia
                    </button>
                    <button
                      className="rounded-xl border px-3 py-2 text-sm"
                      onClick={() => updateWatch(false)}
                    >
                      Desactivar vigilancia
                    </button>
                  </div>
                </fieldset>
              )}
              {owner && (
                <div className="space-y-3">
                  <h3 className="font-semibold">Etiqueta QR privada</h3>
                  <p className="text-xs text-slate-600">
                    La página pública sólo muestra categoría y estado. Para
                    contactar se necesita una cuenta. No pegues el QR en un
                    lugar que revele información sensible.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      disabled={busy}
                      onClick={() => tag(true)}
                      className="underline text-sm"
                    >
                      Generar QR
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => tag(true, true)}
                      className="underline text-sm"
                    >
                      Reemplazar QR
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => tag(false)}
                      className="underline text-sm"
                    >
                      Revocar QR
                    </button>
                  </div>
                  {qr && (
                    <>
                      <img
                        src={qr}
                        alt="Código QR para contactar por este objeto"
                        className="w-56 max-w-full"
                      />
                      <a
                        href={qr}
                        download="buscag-objeto-qr.png"
                        className="block underline text-sm"
                      >
                        Descargar QR
                      </a>
                      <a
                        href={url}
                        className="block underline text-sm break-all"
                      >
                        Abrir página de la etiqueta
                      </a>
                    </>
                  )}
                </div>
              )}
              <div className="space-y-3">
                <h3 className="font-semibold">Devolución entre dos personas</h3>
                <p className="text-xs text-slate-600">
                  La otra persona debe confirmar después de la entrega. Se
                  conserva el historial y el chat. Una publicación con historial
                  bilateral no se puede eliminar.
                </p>
                {owner && item.status !== "recuperado" && (
                  <>
                    <label className="block text-sm">
                      Persona con quien conversaste
                      <select
                        value={partner}
                        onChange={(e) => setPartner(e.target.value)}
                        className="w-full border rounded-lg p-2"
                      >
                        <option value="">Elegí una conversación</option>
                        {partners.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="rounded-xl border px-3 py-2 text-sm"
                      disabled={busy || !partner}
                      onClick={() =>
                        run(async () => {
                          const r = await supabase!.rpc(
                            "request_item_recovery",
                            { p_item: item.id, p_partner: partner },
                          );
                          if (r.error) throw r.error;
                          if (alive.current) {
                            await recoveries();
                            setNotice(
                              "Solicitud enviada a la bandeja interna de la otra persona.",
                            );
                          }
                        })
                      }
                    >
                      Solicitar confirmación de devolución
                    </button>
                  </>
                )}
                {!requests.length && (
                  <p className="text-xs text-slate-500">
                    Todavía no hay solicitudes.
                  </p>
                )}
                {requests.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-xl bg-slate-50 p-3 space-y-2"
                  >
                    <p className="text-sm">
                      {r.state === "confirmed"
                        ? "Devolución confirmada"
                        : r.state === "cancelled"
                          ? "Solicitud cancelada"
                          : "Confirmación pendiente"}
                    </p>
                    {r.state === "pending" && (
                      <div className="flex gap-3">
                        {r.partner_id === userId && (
                          <button
                            disabled={busy}
                            className="font-semibold text-sm underline"
                            onClick={() => decide(r, true)}
                          >
                            Confirmar entrega realizada
                          </button>
                        )}
                        <button
                          disabled={busy}
                          className="text-sm underline"
                          onClick={() => decide(r, false)}
                        >
                          Cancelar solicitud
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                <button
                  disabled={busy}
                  className="text-sm underline"
                  onClick={() => run(recoveries)}
                >
                  Actualizar confirmaciones
                </button>
              </div>
            </>
          )}
          {busy && (
            <p role="status" className="text-sm">
              Consultando Supabase…
            </p>
          )}
        </>
      )}
    </section>
  );
}
