import {t, useLanguage} from "../i18n";
import {SafetyActions} from './SafetyActions';
import React, { useRef } from "react";
import { X, Users, Package, ArrowLeft, LockKeyhole } from "lucide-react";
import type { User, Item } from "../types";
import { Avatar } from "./Avatar";
import { ItemCard } from "./ItemCard";
import { useDialogFocus } from "../utils/useDialogFocus";
/** Deliberately read-only public projection: no email, phone, locality or account controls. */
export function PublicProfileModal({
  user,
  currentUserId,
  items,
  onClose,
  onViewItem,
}: {
  user: User | null;
  currentUserId?: string;
  items: Item[];
  onClose: () => void;
  onViewItem: (item: Item) => void;
}) {
  useLanguage();
  const dialog = useRef<HTMLDivElement>(null);
  useDialogFocus(Boolean(user), dialog, onClose);
  if (!user) return null;
  const publications = items.filter((item) => item.user.id === user.id);
  return (
    <div
      className="public-profile-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="public-profile-title"
        tabIndex={-1}
        className="public-profile-dialog"
      >
        <header>
          <button onClick={onClose} aria-label={t("Volver al objeto")}>
            <ArrowLeft size={19} />
          </button>
          <span>
            <Users size={17} />{t("Perfil público")}</span>
          <button onClick={onClose} aria-label={t("Cerrar perfil público")}>
            <X size={20} />
          </button>
        </header>
        <div className="public-profile-identity">
          <Avatar
            src={user.avatar}
            name={user.name}
            className="account-avatar"
          />
          <span className="eyebrow">{t("UNA PERSONA DE TU COMUNIDAD")}</span>
          <h2 id="public-profile-title">
            {user.name || t("Integrante de BuscAG")}
          </h2>
          <p>
            {publications.length} {t("publicaciones visibles ·")}{" "}
            {publications.filter((item) => item.status === "recuperado").length}{" "} {t("objetos recuperados")} </p>
        </div>
        <p className="px-4 text-sm">{user.ratingCount ? t('Valoración: {{rating}}/5 · {{count}} devoluciones valoradas',{rating:user.rating,count:user.ratingCount}) : t("Sin valoraciones verificadas todavía")}</p>
        <p className="public-profile-privacy">
          <LockKeyhole size={17} />{t("Este perfil muestra sólo información pública. Para contactar, abrí una publicación y usá el chat. Si la persona autorizó compartir su teléfono y ambos intercambiaron mensajes en la misma publicación, la opción de llamada aparece en el chat, no en este perfil.")}</p>
        <section
          className="public-profile-items"
          aria-label={t("Publicaciones de este usuario")}
        >
          {publications.length ? (
            <div className="account-items">
              {publications.map((item) => (
                <ItemCard key={item.id} item={item} onViewMore={onViewItem} />
              ))}
            </div>
          ) : (
            <div className="account-empty">
              <Package size={32} />
              <p>{t("No hay publicaciones visibles en este momento.")}</p>
            </div>
          )}
        {currentUserId&&<SafetyActions key={user.id+currentUserId} userId={currentUserId} targetUserId={user.id}/>}
        </section>
      </div>
    </div>
  );
}
