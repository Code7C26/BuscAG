export function PresentationNotice({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;
  return (
    <aside aria-label="Entorno de presentación" className="presentation-notice">
      BuscAG · Entorno de pruebas
    </aside>
  );
}
