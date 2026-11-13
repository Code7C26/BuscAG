import {t, useLanguage} from "../i18n";
import type { QueuedMessage } from "../../lib/chatStorage";
import React from "react";
import type { Item, Message } from "../types";
import { conversationThreads } from "../utils/inbox";
import { formatTimeAgo } from "../utils/geo";
export function MessagesView({
  messages,
  items,
  userId,
  onOpen,
  outbox = [],
  onDiscard,
}: {
  outbox?: QueuedMessage[];
  onDiscard?: (message: QueuedMessage) => void;
  messages: Message[];
  items: Item[];
  userId: string;
  onOpen: (itemId: string, participantId: string) => void;
}) {
  useLanguage();
  const threads = conversationThreads(messages, userId);
  return (
    <section
      className="messages-view max-w-3xl mx-auto px-4 py-6 space-y-4"
      aria-label={t("Bandeja de mensajes")}
    >
      <h1 className="text-2xl font-bold">{t("Mensajes")}</h1>
      <p className="text-sm text-slate-600">{t("Tus conversaciones recientes. El historial se conserva cuando un objeto se recupera. Los borradores y pendientes son privados de esta pestaña y se borran al cerrar sesión.")}</p>
      {!!outbox.length && (
        <section aria-label={t("Envíos pendientes")} className="space-y-2">
          <h2 className="font-bold">{t("Envíos pendientes")}</h2>
          {outbox.map((row) => (
            <article className="community-tools chat-pending-card" key={row.key}>
              <button
                className="block text-left"
                onClick={() => onOpen(row.itemId, row.recipientId)}
              >
                {items.find((i) => i.id === row.itemId)?.title ||
                  t("Publicación no disponible")}{" "}
                · {row.text}
              </button>
              <p className="text-xs">
                {row.status === "pending" ? t("Pendiente") : t("Fallido")} ·{" "}
                {row.retryable
                  ? t("Reintento seguro al reconectar")
                  : t("Revisá la restricción antes de reintentar")}
              </p>
              {row.status === "failed" && (
                <button className="underline" onClick={() => onDiscard?.(row)}>{t("Descartar pendiente")}</button>
              )}
            </article>
          ))}
        </section>
      )}
      {!threads.length ? (
        <p className="community-tools">{t("Todavía no tenés conversaciones. Abrí una publicación activa para contactar a su autor.")}</p>
      ) : (
        threads.map((thread) => {
          const item = items.find((row) => row.id === thread.itemId);
          const name =
            thread.name ||
            (item?.user.id === thread.participantId
              ? item.user.name
              : t("Cuenta no disponible"));
          return (
            <button
              key={JSON.stringify([thread.itemId, thread.participantId])}
              onClick={() => onOpen(thread.itemId, thread.participantId)}
              className="community-tools w-full text-left flex justify-between gap-3"
            >
              <span className="min-w-0">
                <strong className="block">{name}</strong>
                <span className="block text-xs">
                  {item?.title ||
                    thread.latest.itemTitle ||
                    t("Publicación no disponible")}
                </span>
                <span className="block truncate text-sm">
                  {thread.latest.text}
                </span>
              </span>
              <span className="shrink-0 text-xs">
                {formatTimeAgo(thread.latest.timestamp)}
                {thread.unread > 0 && (
                  <span className="block font-bold text-blue-700">
                    {thread.unread} {t("sin leer")} </span>
                )}
              </span>
            </button>
          );
        })
      )}
    </section>
  );
}
