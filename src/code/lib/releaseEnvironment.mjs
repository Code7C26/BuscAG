// Public project identifier; never an application credential.
export const PRODUCTION_REF = 'hczcqtodcnurdrroczle';
export const PRODUCTION_URL = `https://${PRODUCTION_REF}.supabase.co`;
const allowed = new Set(['VITE_APP_ENV', 'VITE_APP_URL', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY', 'VITE_VAPID_PUBLIC_KEY']);
export function validateReleaseEnvironment(env) {
  if (Object.keys(env).some(name => name.startsWith('VITE_') && !allowed.has(name) && env[name]))
    return 'Release rechaza variables VITE_* no incluidas en su lista pública.';
  if (env.VITE_APP_ENV !== 'production' || env.VITE_SUPABASE_URL !== PRODUCTION_URL)
    return 'Release requiere exclusivamente el proyecto de producción hczcqtodcnurdrroczle y VITE_APP_ENV=production.';
  try {
    const app = new URL(env.VITE_APP_URL);
    if (app.protocol !== 'https:' || app.username || app.password || app.port || app.pathname !== '/' || app.search || app.hash ||
        ['localhost', '127.0.0.1', '[::1]'].includes(app.hostname) || app.hostname.endsWith('.supabase.co')) throw Error();
  } catch { return 'Release requiere VITE_APP_URL con el origen HTTPS público confirmado de Firebase, sin rutas ni parámetros.'; }
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (typeof key !== 'string' || key !== key.trim()) return 'Release requiere una clave pública válida de producción.';
  if (key.startsWith('sb_publishable_') && /^[A-Za-z0-9_-]+$/.test(key) && key.length > 20) return null;
  try {
    const parts = key.split('.');
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (parts.length === 3 && payload.role === 'anon' && payload.ref === PRODUCTION_REF) return null;
  } catch {}
  return 'Release sólo admite clave publicable o JWT anon del proyecto de producción; nunca secretos ni service_role.';
}
