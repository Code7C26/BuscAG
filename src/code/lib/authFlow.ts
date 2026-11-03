export function authRedirect(origin: string, recovery = false): string {
  const url = new URL('/', origin);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) {
    throw new Error('La URL de la aplicación debe usar HTTPS.');
  }
  if (url.username || url.password) throw new Error('La URL de la aplicación no es válida.');
  if (recovery) url.searchParams.set('auth', 'recovery');
  return url.toString();
}

/** Never display arbitrary callback text or tokens provided in a URL. */
export function authCallbackError(location: string): string {
  const url = new URL(location);
  const hash = new URLSearchParams(url.hash.slice(1));
  const code = url.searchParams.get('error_code') || hash.get('error_code');
  if (code === 'otp_expired') return 'El enlace venció o ya fue utilizado. Solicita un nuevo correo.';
  if (code || url.searchParams.has('error') || hash.has('error')) {
    return 'No se pudo validar el enlace. Solicita un nuevo correo e inténtalo otra vez.';
  }
  return '';
}

export function authErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code;
  if (code === 'invalid_credentials') return 'El correo o la contraseña no son correctos.';
  if (code === 'email_not_confirmed') return 'Confirma tu correo antes de iniciar sesión. Puedes solicitar otro mensaje.';
  if (code === 'weak_password') return 'Elige una contraseña más segura.';
  if (code === 'same_password') return 'La nueva contraseña debe ser diferente de la anterior.';
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') return 'Espera unos minutos antes de volver a intentarlo.';
  return 'No se pudo completar la operación. Verifica la conexión o solicita un nuevo enlace.';
}

export function cleanAuthCallback(location: string): string {
  const url = new URL(location);
  const keys = ['access_token','refresh_token','provider_token','provider_refresh_token','expires_at',
    'expires_in','token_type','type','code','error','error_code','error_description'];
  const hash = new URLSearchParams(url.hash.slice(1));
  const hasAuthHash = keys.some(key => hash.has(key));
  keys.forEach(key => { url.searchParams.delete(key); hash.delete(key); });
  if (hasAuthHash) url.hash = hash.toString();
  return url.toString();
}
