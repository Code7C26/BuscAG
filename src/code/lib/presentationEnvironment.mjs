import {
  STAGING_REF,
  STAGING_URL,
  stagingKeyError,
  vapidPublicKeyError,
} from "./stagingEnvironment.mjs";
export const PRESENTATION_APP_URL = "https://buscag-prueba.web.app";
export const PRESENTATION_STORAGE_KEY = `buscag-presentation-${STAGING_REF}-auth`;
export function presentationEnvironment(source) {
  const error = stagingKeyError(source.BUSCAG_STAGING_PUBLISHABLE_KEY)||vapidPublicKeyError(source.BUSCAG_STAGING_VAPID_PUBLIC_KEY);
  if (error) throw Error(error);
  // Ignore ambient production client settings; this is an explicitly separate artifact.
  const base = Object.fromEntries(
    Object.entries(source).filter(
      ([name]) => !name.startsWith("VITE_") && !name.startsWith("BUSCAG_"),
    ),
  );
  return {
    ...base,
    ...(source.BUSCAG_STAGING_VAPID_PUBLIC_KEY?{VITE_VAPID_PUBLIC_KEY:source.BUSCAG_STAGING_VAPID_PUBLIC_KEY}:{}),
    VITE_APP_ENV: "presentation",
    VITE_APP_URL: PRESENTATION_APP_URL,
    VITE_SUPABASE_URL: STAGING_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: source.BUSCAG_STAGING_PUBLISHABLE_KEY.trim(),
  };
}
export function validatePresentationEnvironment(env) {
  if (
    env.VITE_APP_ENV !== "presentation" ||
    env.VITE_APP_URL !== PRESENTATION_APP_URL ||
    env.VITE_SUPABASE_URL !== STAGING_URL
  )
    return "Presentación sólo admite BuscAG-Staging y el Hosting confirmado. No se conectará a producción.";
  if (
    Object.entries(env).some(
      ([name, value]) =>
        name.startsWith("VITE_") &&
        value &&
        ![
          "VITE_VAPID_PUBLIC_KEY",
          "VITE_APP_ENV",
          "VITE_APP_URL",
          "VITE_SUPABASE_URL",
          "VITE_SUPABASE_PUBLISHABLE_KEY",
        ].includes(name),
    )
  )
    return "La presentación sólo permite sus variables públicas revisadas.";
  return stagingKeyError(env.VITE_SUPABASE_PUBLISHABLE_KEY)||vapidPublicKeyError(env.VITE_VAPID_PUBLIC_KEY);
}
export const PRESENTATION_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  `connect-src 'self' data: blob: ${STAGING_URL} wss://${STAGING_REF}.supabase.co https://images.unsplash.com`,
  `img-src 'self' data: blob: ${STAGING_URL} https://images.unsplash.com https://ui-avatars.com https://*.tile.openstreetmap.org`,
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join("; ");
