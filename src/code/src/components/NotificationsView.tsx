import {t, useLanguage} from "../i18n";
import React from "react";
import { Bell, MessageSquare, MapPin, CheckCircle2 } from "lucide-react";
import type { NotificationItem } from "../types";
import { formatTimeAgo } from "../utils/geo";
export function NotificationsView({
  notifications,
  onMarkAllRead,
  onSelectNotification,
  onMarkRead,
}: {
  notifications: NotificationItem[];
  onMarkAllRead: () => void;
  onSelectNotification: (notification: NotificationItem) => void;
  onMarkRead?: (notification: NotificationItem) => void;
}) {
  useLanguage();
  return (
    <section className="notifications-view max-w-2xl mx-auto px-4 py-6 pb-24 space-y-4">
      <header className="flex justify-between gap-3">
        <div>
          <h1 className="font-bold text-xl">{t("Notificaciones y alertas")}</h1>
          <p className="text-xs text-slate-600">{t("Mensajes, coincidencias y novedades de tus publicaciones")}</p>
        </div>
        {notifications.some((n) => !n.read) && (
          <button className="text-sm underline" onClick={onMarkAllRead}>{t("Marcar leídas")}</button>
        )}
      </header>
      {!notifications.length ? (
        <div className="community-tools text-center">
          <Bell className="w-8 h-8 mx-auto" />
          <p>{t("No tienes notificaciones pendientes")}</p>
          <p className="text-xs">{t("Te avisaremos cuando haya novedades.")}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border divide-y overflow-hidden">
          {notifications.map((notice) => (
            <article
              key={notice.id}
              className={!notice.read ? "bg-blue-50/40" : ""}
            >
              <button
                className="w-full p-4 text-left flex gap-3 items-start hover:bg-slate-50"
                onClick={() => onSelectNotification(notice)}
              >
                <span className="p-2 rounded-xl bg-slate-100 text-blue-700">
                  {notice.type === "message" ? (
                    <MessageSquare size={20} />
                  ) : notice.type === "match" ? (
                    <MapPin size={20} />
                  ) : (
                    <CheckCircle2 size={20} />
                  )}
                </span>
                <span className="flex-1 min-w-0">
                  <strong className="block text-sm">{t(notice.title)}</strong>
                  <span className="block text-xs mt-1">{t(notice.message)}</span>
                  <span className="block text-xs text-slate-500 mt-1">
                    {formatTimeAgo(notice.date)}
                    {!notice.read ? t(" · Sin leer") : ""}
                  </span>
                </span>
              </button>
              {!notice.read && onMarkRead && (
                <button
                  className="ml-14 mb-3 text-xs underline"
                  onClick={() => onMarkRead(notice)}
                  aria-label={t('Marcar como leída: {{title}}',{title:notice.title})}
                >{t("Marcar como leída")}</button>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
