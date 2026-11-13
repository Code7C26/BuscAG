import {t, useLanguage} from "../i18n";
export function PresentationNotice({ enabled }: { enabled: boolean }) {
  useLanguage();
  if (!enabled) return null;
  return (
    <aside aria-label={t("Entorno de presentación")} className="presentation-notice"> {t("BuscAG · Entorno de pruebas")}{typeof __BUSCAG_BUILD_COMMIT__!=='undefined'&&__BUSCAG_BUILD_COMMIT__&&<span> {t("· versión")} {__BUSCAG_BUILD_COMMIT__.slice(0,7)}</span>}
    </aside>
  );
}
