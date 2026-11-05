// Public target identifiers, never credentials. Shared by Vite, browser and tools.
export const STAGING_REF='yiarlhpbgkofhhipkfha';
export const STAGING_URL=`https://${STAGING_REF}.supabase.co`;
export const STAGING_APP_URL='http://127.0.0.1:3001';
export function stagingKeyError(key){
  if(typeof key!=='string'||!key.trim())return 'Configura BUSCAG_STAGING_PUBLISHABLE_KEY con la clave publicable de BuscAG-Staging.';
  key=key.trim();
  if(key.startsWith('sb_publishable_')&&key.length>15)return null;
  try{
    const parts=key.split('.');
    const payload=JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));
    if(parts.length===3&&payload.role==='anon'&&payload.ref===STAGING_REF)return null;
  }catch{}
  return 'Usa una clave publicable de staging o un JWT anon de ese proyecto; nunca service_role ni claves privadas.';
}
export function stagingEnvironment(key){
  const error=stagingKeyError(key);if(error)throw Error(error);
  return {VITE_APP_ENV:'staging',VITE_SUPABASE_URL:STAGING_URL,VITE_SUPABASE_PUBLISHABLE_KEY:key.trim(),VITE_APP_URL:STAGING_APP_URL};
}
export function validateStagingEnvironment(env){
  if(env.VITE_SUPABASE_URL!==STAGING_URL||env.VITE_APP_URL!==STAGING_APP_URL||env.VITE_APP_ENV!=='staging')return 'Staging sólo admite el proyecto yiarlhpbgkofhhipkfha y http://127.0.0.1:3001. No se conectará a otro destino.';
  return stagingKeyError(env.VITE_SUPABASE_PUBLISHABLE_KEY);
}
export const STAGING_CSP=[
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://unpkg.com",
  `connect-src 'self' data: blob: https://images.unsplash.com ${STAGING_URL} wss://${STAGING_REF}.supabase.co ws://127.0.0.1:3001`,
  `img-src 'self' data: blob: https://unpkg.com ${STAGING_URL} https://images.unsplash.com https://ui-avatars.com https://*.tile.openstreetmap.org`,
  "font-src 'self' data:","object-src 'none'","base-uri 'self'","form-action 'self'"
].join('; ');
