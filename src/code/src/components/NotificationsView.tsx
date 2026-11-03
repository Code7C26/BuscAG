import React from 'react';
import { Bell, MessageSquare, MapPin, CheckCircle2, ChevronRight, Check } from 'lucide-react';
import { NotificationItem, Item } from '../types';
import { formatTimeAgo } from '../utils/geo';

interface NotificationsViewProps {
  notifications: NotificationItem[];
  onMarkAllRead: () => void;
  onSelectNotification: (notif: NotificationItem) => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  notifications,
  onMarkAllRead,
  onSelectNotification
}) => {
  return (
    <div className="notifications-view max-w-2xl mx-auto px-4 py-6 pb-24 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-900 text-xl flex items-center gap-2">
            Notificaciones y alertas
          </h2>
          <p className="text-xs text-slate-500">Avisos en tiempo real sobre tus objetos y búsquedas</p>
        </div>

        {notifications.some(n => !n.read) && (
          <button
            onClick={onMarkAllRead}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 transition cursor-pointer flex items-center gap-1"
          >
            <Check className="w-3.5 h-3.5" />
            Marcar leídas
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-2">
          <Bell className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="font-bold text-slate-700 text-sm">No tienes notificaciones pendientes</p>
          <p className="text-xs text-slate-400">Te avisaremos cuando alguien interactúe con tus publicaciones.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 divide-y divide-slate-100 overflow-hidden shadow-xs">
          {notifications.map((notif) => {
            return (
              <div
                key={notif.id}
                onClick={() => onSelectNotification(notif)}
      role="button" tabIndex={0}
      onKeyDown={event => {
        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault(); onSelectNotification(notif);
        }
      }}
                className={`p-4 flex items-start gap-3.5 hover:bg-slate-50 transition cursor-pointer ${
                  !notif.read ? 'bg-blue-50/40' : ''
                }`}
              >
                {/* Notification Icon */}
                <div className={`p-2.5 rounded-2xl shrink-0 mt-0.5 ${
                  notif.type === 'message'
                    ? 'bg-blue-100 text-blue-600'
                    : notif.type === 'match'
                    ? 'bg-amber-100 text-amber-600'
                    : 'bg-emerald-100 text-emerald-600'
                }`}>
                  {notif.type === 'message' ? (
                    <MessageSquare className="w-5 h-5" />
                  ) : notif.type === 'match' ? (
                    <MapPin className="w-5 h-5" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-bold text-slate-900 text-sm leading-snug">
                      {notif.title}
                    </h4>
                    <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                      {formatTimeAgo(notif.date)}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {notif.message}
                  </p>
                </div>

                {!notif.read && (
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0 mt-2" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
