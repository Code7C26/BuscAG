import {UserFollowButton} from './UserFollowButton';
import React, { useEffect, useState, useRef } from "react";
import { communityCall, REPORT_REASONS, ServiceUnavailableError } from "../../lib/community";
export function SafetyActions({
  userId,
  targetUserId,
  itemId,
}: {
  userId: string;
  targetUserId: string;
  itemId?: string;
}) {
  const pending=useRef(false);
  const [blocked, setBlocked] = useState(false),
    [following, setFollowing] = useState(false),
    [notify, setNotify] = useState(true);
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const [kind, setKind] = useState(itemId ? "item" : "user"),
    [reason, setReason] = useState("spam"),
    [description, setDescription] = useState("");
  const [revision,setRevision]=useState(0);
  useEffect(() => {
    let active = true;
    setReady(false);
    setNotice('');
    Promise.all([
      communityCall("list_my_blocks"),
      itemId ? communityCall("my_item_follow", { p_item: itemId }) : null,
    ])
      .then(([blocks, follow]) => {
        if (!active) return;
        setBlocked(blocks.some((b: any) => b.id === targetUserId));
        setFollowing(follow?.following ?? false);
        setNotify(follow?.notify ?? true);
        setReady(true);
      })
      .catch(error => {if(active)setNotice(error instanceof ServiceUnavailableError
        ? 'Seguimiento, bloqueos y denuncias todavía no están habilitados. Podés contactar por chat.'
        : 'No se pudo consultar la disponibilidad de estas opciones. Revisá la conexión.');});
    return () => {
      active = false;
    };
  }, [userId, targetUserId, itemId,revision]);
  if (!targetUserId || targetUserId === userId) return null;
  if(!ready)return <section aria-label="Seguridad y seguimiento" className="community-tools"><p role="status">{notice||'Consultando opciones de seguridad…'}</p>{notice&&<button onClick={()=>setRevision(v=>v+1)}>Comprobar disponibilidad</button>}</section>;
  const run = async (action: () => Promise<void>) => {
    if (pending.current) return;
    pending.current=true;
    setBusy(true);
    setNotice("");
    try {
      await action();
    } catch {
      setNotice(
        "No se pudo confirmar la operación. Intentá actualizar o reintentar.",
      );
    } finally {
      pending.current=false;
      setBusy(false);
    }
  };
  return (
    <section
      aria-label="Seguridad y seguimiento"
      aria-busy={busy}
      className="community-tools space-y-3"
    >
      <div className="flex gap-3 flex-wrap">
        {itemId && (
          <button
            disabled={busy || !ready}
            onClick={() =>
              void run(async () => {
                const next = await communityCall("set_item_follow", {
                  p_item: itemId,
                  p_follow: !following,
                  p_notify: notify,
                });
                setFollowing(next);
                setNotice(
                  next
                    ? "Publicación seguida."
                    : "Dejaste de seguir la publicación.",
                );
              })
            }
          >
            {following ? "Dejar de seguir" : "Seguir publicación"}
          </button>
        )}
        <button
          disabled={busy || !ready}
          onClick={() => {
            if (
              !window.confirm(
                blocked
                  ? "¿Desbloquear a esta persona?"
                  : "¿Bloquear a esta persona? Se conserva el historial y no podrán enviarse mensajes nuevos.",
              )
            )
              return;
            void run(async () => {
              const next = await communityCall("set_user_block", {
                p_target: targetUserId,
                p_block: !blocked,
              });
              setBlocked(next);
              setNotice(next ? "Usuario bloqueado." : "Usuario desbloqueado.");
            });
          }}
        >
          {blocked ? "Desbloquear usuario" : "Bloquear usuario"}
        </button>
      </div>
      {following && itemId && (
        <label className="text-sm flex gap-2">
          <input
            type="checkbox"
            checked={notify}
            disabled={busy}
            onChange={(e) => {
              const value = e.target.checked;
              setNotify(value);
              void run(async () => {
                try {
                  await communityCall("set_item_follow", {
                    p_item: itemId,
                    p_follow: true,
                    p_notify: value,
                  });
                } catch (error) {
                  setNotify(!value);
                  throw error;
                }
              });
            }}
          />
          Avisarme cuando cambie el estado
        </label>
      )}
      <UserFollowButton key={userId+targetUserId} userId={userId} targetId={targetUserId} blocked={blocked}/>
      <details>
        <summary>Denunciar</summary>
        <div className="space-y-2 mt-2">
          {itemId && (
            <label className="block">
              Qué querés denunciar
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="item">Esta publicación</option>
                <option value="user">A esta persona</option>
              </select>
            </label>
          )}
          <label className="block">
            Motivo
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              {Object.entries(REPORT_REASONS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            Descripción opcional
            <textarea
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await communityCall("submit_report", {
                  p_kind: kind,
                  p_target: kind === "item" ? itemId : targetUserId,
                  p_reason: reason,
                  p_description: description,
                });
                setNotice(
                  "Denuncia registrada para revisión. No elimina automáticamente la publicación.",
                );
              })
            }
          >
            Enviar denuncia
          </button>
        </div>
      </details>
      {!ready && (
        <p className="text-xs">
          Los controles requieren conexión y el servicio de seguridad
          disponible.
        </p>
      )}
      {busy ? <p role="status">Guardando cambio…</p> : notice && <p role="status">{notice}</p>}
    </section>
  );
}
