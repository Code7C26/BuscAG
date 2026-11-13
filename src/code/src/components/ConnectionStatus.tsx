import {t, useLanguage} from "../i18n";
import React, { useEffect, useState } from "react";
export function ConnectionStatus() {
  useLanguage();
  const [online, setOnline] = useState(() => navigator.onLine),
    [reconnected, setReconnected] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const offline = () => {
      setOnline(false);
      setReconnected(false);
      clearTimeout(timer);
    };
    const connected = () => {
      setOnline(true);
      setReconnected(true);
      clearTimeout(timer);
      timer = setTimeout(() => setReconnected(false), 7000);
    };
    window.addEventListener("offline", offline);
    window.addEventListener("online", connected);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", connected);
    };
  }, []);
  return !online ? (
    <aside role="status" className="connection-status">{t("Sin conexión. Lo que ves puede estar desactualizado. Los mensajes pendientes se reintentarán al volver.")}</aside>
  ) : reconnected ? (
    <aside role="status" className="connection-status">{t("Conexión recuperada. Sincronizando datos y mensajes pendientes…")}</aside>
  ) : null;
}
