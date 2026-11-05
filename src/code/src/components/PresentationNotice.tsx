export function PresentationNotice({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;
  return (
    <aside aria-label="Entorno de presentación" className="presentation-notice">
      Presentación escolar · Supabase-Staging · datos de prueba
    </aside>
  );
}
