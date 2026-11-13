import {t, useLanguage, locale} from "../i18n";
import { SearchZoneMap } from "./SearchZoneMap";
import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  featureFailure,
  objectTagUrl,
  watchZoneError,
  Watch,
} from "../../lib/schoolFeatures";
import { Item } from "../types";
export function ItemSchoolTools({
  item,
  userId,
}: {
  item: Item;
  userId: string;
}) {
  useLanguage();
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
        setNotice(zone || t("Completá la zona de búsqueda."));
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
            ? t("Vigilancia guardada. La recepción de avisos depende de la disponibilidad del servicio.")
            : t("Vigilancia desactivada."),
        );
      }
    });
  const tag = (enabled: boolean, rotate = false) =>
    run(async () => {
      if (
        rotate &&
        !window.confirm(
          t("¿Reemplazar el QR? El código anterior dejará de funcionar."),
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
        setNotice(t("Etiqueta revocada."));
        return;
      }
      const link = objectTagUrl(window.location.origin, r.data.token);
      const {default:QRCode}=await import('qrcode');
      const image = await QRCode.toDataURL(link, {
        width: 280,
        margin: 4,
        errorCorrectionLevel: "M",
      });
      if (alive.current) {
        setUrl(link);
        setQr(image);
        setNotice(
          t("Etiqueta lista para compartir. El código anterior deja de funcionar si lo reemplazás."),
        );
      }
    });
  return (
    <section
      className="rounded-2xl border border-slate-200 p-4 space-y-4"
      aria-label={t("Herramientas del objeto")}
    >
      <button
        type="button"
        className="font-bold text-blue-700 text-left"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          if (!open && !ready) void load();
        }}
      >{t("Alertas y QR")}</button>
      {open && (
        <>
          <p className="text-xs text-slate-600">{t("Administrá las alertas de este objeto y su etiqueta de contacto.")}</p>
          {notice && (
            <p role="status" className="text-sm">
              {t(notice)}
            </p>
          )}
          {!ready && !busy && (
            <button onClick={load} className="underline text-sm">{t("Reintentar disponibilidad")}</button>
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
                />{t("Recibir avisos internos de coincidencias en mi cuenta")}</label>
              <p className="text-xs text-slate-600"> {t("Avisos de coincidencias:")}{" "}
                {worker
                  ? t("habilitados; la recepción puede demorar")
                  : t("todavía no habilitados")} {t(". La zona no hace seguimiento continuo de GPS.")} </p>
              {owner && item.status === "perdido" && (
                <fieldset disabled={busy} className="space-y-3">
                  <legend className="font-semibold text-sm">{t("Modo alerta y zona de búsqueda")}</legend>
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
                        ? t("Vigilancia activada")
                        : t("Vigilancia desactivada")
                      : t("Sin zona personalizada: se conserva el matching general existente.")}
                  </p>
                  {watch&&<p className="text-xs">{t("Radio:")} {watch.radius_km} {t("km · Centro:")} {watch.lat.toFixed(4)}, {watch.lng.toFixed(4)}{watch.updated_at&&t(' · Actualización: {{date}}',{date:new Date(watch.updated_at).toLocaleString(locale())})}</p>}
                  <p className="text-xs">{t("La zona filtra los avisos de coincidencias compatibles. No es una alerta GPS continua ni un aviso de proximidad independiente.")}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-sm"> {t("Latitud")} <input
                        type="number"
                        step="any"
                        min="-90"
                        max="90"
                        value={lat}
                        onChange={(e) => setLat(e.target.value)}
                        className="w-full border rounded-lg p-2"
                      />
                    </label>
                    <label className="text-sm"> {t("Longitud")} <input
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
                  <label className="block text-sm"> {t("Radio de búsqueda (km)")} <input
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
                  >{t("Usar ubicación de esta publicación")}</button>
                  <div className="flex flex-wrap gap-3">
                    <button
                      className="rounded-xl bg-blue-600 px-3 py-2 text-sm text-white"
                      onClick={() => updateWatch(true)}
                    >{t("Activar o actualizar vigilancia")}</button>
                    {watch?.enabled&&<button className="rounded-xl border px-3 py-2 text-sm" onClick={()=>updateWatch(false)}>{t("Desactivar vigilancia")}</button>}
                  </div>
                </fieldset>
              )}
              {owner && (
                <div className="space-y-3">
                  <h3 className="font-semibold">{t("Etiqueta QR privada")}</h3>
                  <p className="text-xs text-slate-600">{t("La página pública sólo muestra categoría y estado. Para contactar se necesita una cuenta. No pegues el QR en un lugar que revele información sensible.")}</p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      disabled={busy}
                      onClick={() => tag(true)}
                      className="underline text-sm"
                    >{t("Generar QR")}</button>
                    <button
                      disabled={busy}
                      onClick={() => tag(true, true)}
                      className="underline text-sm"
                    >{t("Reemplazar QR")}</button>
                    <button
                      disabled={busy}
                      onClick={() => tag(false)}
                      className="underline text-sm"
                    >{t("Revocar QR")}</button>
                  </div>
                  {qr && (
                    <>
                      <img
                        src={qr}
                        alt={t("Código QR para contactar por este objeto")}
                        className="w-56 max-w-full"
                      />
                      <a
                        href={qr}
                        download="buscag-objeto-qr.png"
                        className="block underline text-sm"
                      >{t("Descargar QR")}</a>
                      <a
                        href={url}
                        className="block underline text-sm break-all"
                      >{t("Abrir página de la etiqueta")}</a>
                    </>
                  )}
                </div>
              )}
            </>
          )}
          {busy && (
            <p role="status" className="text-sm">{t("Consultando Supabase…")}</p>
          )}
        </>
      )}
    </section>
  );
}
