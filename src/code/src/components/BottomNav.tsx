import {t, useLanguage} from "../i18n";
import React, { useId } from "react";
import {
  Home,
  Map,
  Plus,
  Bell,
  User,
  Sparkles,
  MessageSquare,
} from "lucide-react";
import { TabType } from "../types";
interface Props {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  onOpenPublish: () => void;
  unreadNotificationsCount: number;
  matchesCount?: number;
  unreadMessagesCount?: number;
}
const tabs = [
  ["home", Home, "Inicio"],
  ["map", Map, "Mapa"],
  ["publish", Plus, "Publicar objeto"],
  ["matches", Sparkles, "Coincidencias"],
  ["messages", MessageSquare, "Mensajes"],
  ["notifications", Bell, "Notificaciones"],
  ["profile", User, "Perfil"],
] as const;
export function BottomNav({
  activeTab,
  onSelectTab,
  onOpenPublish,
  unreadNotificationsCount,
  matchesCount = 0,
  unreadMessagesCount = 0,
}: Props) {
  useLanguage();
  const badgeId = useId();
  const position = tabs.findIndex(([key]) => key === activeTab);
  return (
    <nav
      aria-label={t("Navegación principal")}
      className="bottom-nav fixed bottom-0 left-0 right-0 z-40 border-t px-2 py-2"
    >
      <div className="bottom-nav__content mx-auto relative">
        <span
          aria-hidden="true"
          className="bottom-nav__indicator"
          style={{ transform: `translateX(${Math.max(0, position) * 100}%)` }}
        />
        {tabs.map(([key, Icon, label]) => {
          const count =
            key === "notifications"
              ? unreadNotificationsCount
              : key === "messages"
                ? unreadMessagesCount
                : key === "matches"
                  ? matchesCount
                  : 0;
          return (
            <button
              key={key}
              type="button"
              aria-label={t(label)}
              aria-describedby={count > 0 ? `${badgeId}-${key}` : undefined}
              aria-current={activeTab === key ? "page" : undefined}
              onClick={() =>
                key === "publish" ? onOpenPublish() : onSelectTab(key)
              }
              className={`nav-tab ${key === "publish" ? "nav-tab--publish" : ""} ${activeTab === key ? "nav-tab--active" : ""}`}
            >
              <Icon aria-hidden="true" size={21} />
              <span className="nav-tab__label">{t(key==='matches'?'Coincid.':key==='notifications'?'Avisos':key==='publish'?'Publicar':label)}</span>
              {count > 0 && <span id={`${badgeId}-${key}`} className="sr-only">{t("{{count}} pendientes", { count })}</span>}
              {count > 0 && (
                <span className="nav-tab__badge" aria-hidden="true">
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
