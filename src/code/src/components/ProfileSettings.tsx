import { preparePhoto } from "../utils/preparePhoto";
import React, { useEffect, useState, useRef } from "react";
import { communityCall, normalizePhone, validPhone, ServiceUnavailableError } from "../../lib/community";
import { supabase } from "../../lib/supabase";
import { uploadItemImage } from "../../lib/database";
export function ProfileSettings({
  userId,
  onSaved,
}: {
  userId: string;
  onSaved?: () => void;
}) {
  const lifecycle = useRef(0);
  const [form, setForm] = useState({
      name: "",
      avatar: "",
      phone: "",
      share_phone: false,
      location: "",
    }),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const [blocks, setBlocks] = useState<any[]>([]),
    [reports, setReports] = useState<any[]>([]),
    [ratings, setRatings] = useState<any[]>([]),
    [moderator, setModerator] = useState(false),
    [audit, setAudit] = useState<any[]>([]);
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<'loading'|'basic'|'community'>('loading');
  const [extrasReady, setExtrasReady] = useState(false);
  useEffect(() => {
    ++lifecycle.current;
    let alive = true;
    setReady(false);setMode('loading');setExtrasReady(false);setNotice('');
    setBlocks([]);setReports([]);setRatings([]);setModerator(false);setAudit([]);
    const load = async () => {
      let profile;
      try { profile = await communityCall('my_community_settings'); }
      catch(error) {
        // Only an unavailable RPC permits the existing, owner-bound baseline.
        // Permission/network/validation failures must never bypass the new API.
        if(!(error instanceof ServiceUnavailableError)||!supabase)throw error;
        const result=await supabase.from('profiles').select('full_name,avatar_url,location').eq('id',userId).maybeSingle();
        if(result.error||!result.data)throw Error();
        if(alive){setForm({name:result.data.full_name??'',avatar:result.data.avatar_url??'',location:result.data.location??'',phone:'',share_phone:false});setMode('basic');setReady(true);}
        return;
      }
      if(!alive)return;
      setForm(profile);setMode('community');setModerator(profile.moderator===true);setReady(true);
      try {
        const [blocks,reports,ratings]=await Promise.all([communityCall('list_my_blocks'),communityCall('list_reports'),communityCall('received_ratings')]);
        if (!alive) return;
        setBlocks(blocks);
        setReports(reports);
        setRatings(ratings);
        setExtrasReady(true);
      }catch{if(alive)setNotice('El perfil está disponible. No se pudieron cargar bloqueos, denuncias o valoraciones; no se muestran listados incompletos.');}
    };
    void load().catch(() => {
        if (alive)
          setNotice(
            "No se pudo cargar el perfil. Revisá la conexión e intentá abrir la configuración nuevamente.",
          );
      });
    return () => {
      alive = false;
      ++lifecycle.current;
    };
  }, [userId]);
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    const version=lifecycle.current;
    setBusy(true);
    setNotice("");
    try {
      await action();
    } catch {
      if(version===lifecycle.current)setNotice(
        "No se pudo confirmar el cambio. Revisá los datos y la conexión.",
      );
    } finally {
      if(version===lifecycle.current)setBusy(false);
    }
  };
  const field = (key: string, value: any) =>
    setForm((previous) => ({ ...previous, [key]: value }));
  return (
    <section
      className="community-tools space-y-4"
      aria-label="Privacidad y perfil"
    >
      <h3>Tu perfil y privacidad</h3>
      {mode==='basic'&&<p role="status">Perfil básico disponible. Compartir teléfono, bloqueos, denuncias y valoraciones todavía no están habilitados. Podés seguir usando el chat.</p>}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const phone = normalizePhone(form.phone);
          if (!validPhone(phone) || (form.share_phone && !phone)) {
            setNotice(
              "Usá un teléfono internacional, por ejemplo +5491123456789, o dejalo vacío y privado.",
            );
            return;
          }
          void run(async () => {
            const version=lifecycle.current;
            if(mode==='basic'){
              const name=form.name.trim(),avatar=form.avatar.trim();
              if(name.length<2||name.length>100||form.location.length>200||avatar.length>2048)throw Error();
              if(avatar){const url=new URL(avatar);if(url.protocol!=='https:'||url.username||url.password)throw Error();}
              const identity=await supabase!.auth.getUser();
              if(identity.error||identity.data.user?.id!==userId||version!==lifecycle.current)throw Error();
              const result=await supabase!.from('profiles').update({full_name:name,avatar_url:avatar,location:form.location.trim()}).eq('id',userId).select('id').maybeSingle();
              if(result.error||result.data?.id!==userId)throw Error();
            }else if(mode==='community')await communityCall("save_my_profile", {
              p_name: form.name,
              p_avatar: form.avatar,
              p_phone: phone,
              p_share: form.share_phone,
              p_location: form.location,
            });else throw Error();
            if(version!==lifecycle.current)return;
            setNotice("Perfil guardado.");
            onSaved?.();
          });
        }}
      >
        <fieldset disabled={!ready || busy} className="space-y-3">
          <label className="block">
            Nombre visible
            <input
              value={form.name}
              minLength={2}
              maxLength={100}
              required
              onChange={(e) => field("name", e.target.value)}
            />
          </label>
          <label className="block">
            Foto de perfil (URL HTTPS)
            <input
              type="url"
              value={form.avatar}
              maxLength={2048}
              onChange={(e) => field("avatar", e.target.value)}
            />
          </label>
          <label className="block">
            Subir foto de perfil (JPG, PNG o WebP, hasta 5 MB)
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                if (
                  !["image/jpeg", "image/png", "image/webp"].includes(
                    file.type,
                  ) ||
                  file.size > 5 * 1024 * 1024
                ) {
                  setNotice("Elegí JPG, PNG o WebP de hasta 5 MB.");
                  return;
                }
                const version = lifecycle.current;
                void run(async () => {
                  const image = await preparePhoto(file);
                  const { data } = await supabase!.auth.getUser();
                  if (data.user?.id !== userId || lifecycle.current !== version)
                    throw Error();
                  const url = await uploadItemImage(
                    image,
                    userId,
                    () => lifecycle.current === version,
                  );
                  if (lifecycle.current !== version) return;
                  field("avatar", url);
                  setNotice("Foto subida. Guardá el perfil para usarla.");
                });
              }}
            />
          </label>
          {mode==='community'&&<><label className="block">
            Teléfono privado
            <input
              type="tel"
              value={form.phone}
              maxLength={30}
              placeholder="+5491123456789"
              onChange={(e) => field("phone", e.target.value)}
            />
          </label>
          <label className="flex gap-2">
            <input
              type="checkbox"
              checked={form.share_phone}
              onChange={(e) => field("share_phone", e.target.checked)}
            />
            Compartir mi teléfono con personas con las que intercambié mensajes
          </label>
          <p className="text-xs">
            Privado por defecto. El chat es el contacto principal; un bloqueo
            también oculta el teléfono.
          </p></>}
          <label className="block">
            Zona del perfil (privada)
            <input
              value={form.location}
              maxLength={200}
              onChange={(e) => field("location", e.target.value)}
            />
          </label>
          <button type="submit">
            {busy ? "Guardando…" : mode==='basic' ? 'Guardar perfil' : "Guardar perfil y privacidad"}
          </button>
        </fieldset>
      </form>
      {extrasReady&&<><details>
        <summary>Usuarios bloqueados ({blocks.length})</summary>
        {blocks.length === 0 ? (
          <p>No tenés usuarios bloqueados.</p>
        ) : (
          blocks.map((b) => (
            <p key={b.id}>
              {b.name}{" "}
              <button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await communityCall("set_user_block", {
                      p_target: b.id,
                      p_block: false,
                    });
                    setBlocks((previous) =>
                      previous.filter((row) => row.id !== b.id),
                    );
                    setNotice("Usuario desbloqueado.");
                  })
                }
              >
                Desbloquear
              </button>
            </p>
          ))
        )}
      </details>
      <details>
        <summary>{moderator ? "Moderación" : "Mis denuncias"}</summary>
        <button
          disabled={busy}
          onClick={() =>
            void run(async () =>
              setReports(await communityCall("list_reports")),
            )
          }
        >
          Actualizar denuncias
        </button>
        {!reports.length && <p>No hay denuncias para mostrar.</p>}
        {moderator && (
          <label className="block">
            Nota administrativa
            <textarea
              value={note}
              maxLength={2000}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
        )}
        {reports.map((r) => (
          <article key={r.id} className="border rounded p-2">
            <p>
              {r.target_kind} · {r.reason} ·{" "}
              {
                (
                  {
                    open: "Pendiente",
                    reviewing: "En revisión",
                    resolved: "Resuelta",
                    dismissed: "Desestimada",
                  } as any
                )[r.state]
              }
            </p>
            {moderator && (
              <>
                <p>{r.description}</p>
                {[
                  ["reviewing", "Revisar"],
                  ["resolved", "Resolver"],
                  ["dismissed", "Desestimar"],
                ].map(([state, label]) => (
                  <button
                    key={state}
                    disabled={busy || !note.trim()}
                    onClick={() =>
                      void run(async () => {
                        await communityCall("moderate_report", {
                          p_report: r.id,
                          p_state: state,
                          p_note: note,
                        });
                        setReports(await communityCall("list_reports"));
                      })
                    }
                  >
                    {label}
                  </button>
                ))}
                <button
                  onClick={() =>
                    void run(async () =>
                      setAudit(
                        await communityCall("report_audit", { p_report: r.id }),
                      ),
                    )
                  }
                >
                  Ver auditoría
                </button>
              </>
            )}
          </article>
        ))}
        {audit.map((a) => (
          <p key={a.id}>
            {a.created_at} · {a.from_state} → {a.to_state} · {a.note}
          </p>
        ))}
      </details>
      <details>
        <summary>Valoraciones recibidas ({ratings.length})</summary>
        {!ratings.length && <p>Sin valoraciones todavía.</p>}
        {ratings.map((r) => (
          <p key={r.id}>
            {r.stars}/5 · {new Date(r.created_at).toLocaleDateString()}{" "}
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await communityCall("submit_report", {
                    p_kind: "rating",
                    p_target: r.id,
                    p_reason: "otro",
                    p_description: "Solicito revisión de esta valoración.",
                  });
                  setNotice("Valoración denunciada para revisión.");
                })
              }
            >
              Denunciar valoración
            </button>
          </p>
        ))}
      </details>
      </>}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
