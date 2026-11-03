type Environment = { VITE_SUPABASE_URL?: string; VITE_SUPABASE_PUBLISHABLE_KEY?: string; VITE_APP_URL?: string };
export function validateEnvironment(env: Environment, production: boolean): string | null {
  const url = env.VITE_SUPABASE_URL?.trim(); const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) return 'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY.';
  for (const [name, value] of [['VITE_SUPABASE_URL', url], ['VITE_APP_URL', env.VITE_APP_URL?.trim()]] as const) {
    if (!value) continue;
    try {
      const parsed = new URL(value);
      const local = ['localhost','127.0.0.1','[::1]'].includes(parsed.hostname);
      if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/' ||
          (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && local && !production))) throw Error();
    } catch { return `${name} debe ser una URL de origen válida${production ? ' con HTTPS' : ''}.`; }
  }
  if (key.startsWith('sb_secret_')) return 'Una clave secreta no puede utilizarse en el frontend.';
  if (!key.startsWith('sb_publishable_')) {
    try {
      const parts = key.split('.');
      if (parts.length !== 3 || JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/'))).role !== 'anon') throw Error();
    } catch { return 'Utiliza una clave publicable o anon; nunca service_role.'; }
  }
  return null;
}
