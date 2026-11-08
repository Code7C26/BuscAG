export function PresentationNotice({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;
  return (
    <aside aria-label="Entorno de presentación" className="presentation-notice">
      BuscAG · Entorno de pruebas{typeof __BUSCAG_BUILD_COMMIT__!=='undefined'&&__BUSCAG_BUILD_COMMIT__&&<span> · versión {__BUSCAG_BUILD_COMMIT__.slice(0,7)}</span>}
    </aside>
  );
}
