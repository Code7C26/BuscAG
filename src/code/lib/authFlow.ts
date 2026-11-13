export function authRedirect(origin: string, recovery = false): string {
  const url = new URL("/", origin);
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    )
  ) {
    throw new Error("La URL de la aplicación debe usar HTTPS.");
  }
  if (url.username || url.password)
    throw new Error("La URL de la aplicación no es válida.");
  if (recovery) url.searchParams.set("auth", "recovery");
  return url.toString();
}

/** Never display arbitrary callback text or tokens provided in a URL. */
export function authCallbackError(location: string): string {
  const url = new URL(location);
  const hash = new URLSearchParams(url.hash.slice(1));
  const code = url.searchParams.get("error_code") || hash.get("error_code");
  if (code === "otp_expired")
    return "El enlace venció o ya fue utilizado. Solicita un nuevo correo.";
  if (code || url.searchParams.has("error") || hash.has("error")) {
    return "No se pudo validar el enlace. Solicita un nuevo correo e inténtalo otra vez.";
  }
  return "";
}

export function authErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code;
  if (code === "auth_redirect_mismatch")
    return "Abre la dirección configurada de BuscAG para solicitar un correo; el origen actual no coincide.";
  if (code === "email_address_not_authorized")
    return "El servicio de correo de este entorno no permite enviar a esa dirección. Contactá al responsable de BuscAG; repetir el envío no resuelve esta configuración.";
  if (code === "email_address_invalid")
    return "Revisá que la dirección de correo sea válida.";
  if (code === "invalid_credentials")
    return "El correo o la contraseña no son correctos.";
  if (code === "email_not_confirmed")
    return "Confirma tu correo antes de iniciar sesión. Puedes solicitar otro mensaje.";
  if (code === "weak_password") return "Elige una contraseña más segura.";
  if (code === "same_password")
    return "La nueva contraseña debe ser diferente de la anterior.";
  if (
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit" ||
    code === "email_rate_limit_exceeded"
  )
    return "Espera unos minutos antes de volver a intentarlo.";
  if (code === "captcha_failed")
    return "No se pudo verificar la protección antispam. Inténtalo nuevamente o contacta al soporte.";
  return "No se pudo completar la operación. Verifica la conexión o solicita un nuevo enlace.";
}

export function cleanAuthCallback(location: string): string {
  const url = new URL(location);
  const keys = [
    "access_token",
    "refresh_token",
    "provider_token",
    "provider_refresh_token",
    "expires_at",
    "expires_in",
    "token_type",
    "type",
    "code",
    "error",
    "error_code",
    "error_description",
  ];
  const hash = new URLSearchParams(url.hash.slice(1));
  const hasAuthHash = keys.some((key) => hash.has(key));
  keys.forEach((key) => {
    url.searchParams.delete(key);
    hash.delete(key);
  });
  if (hasAuthHash) url.hash = hash.toString();
  return url.toString();
}

/** Refuse a stale deployment origin instead of emailing links to another app. */
export function authRedirectForApp(
  configured: string | undefined,
  currentOrigin: string,
  recovery = false,
): string {
  const current = new URL(currentOrigin).origin;
  if (configured?.trim() && new URL(configured.trim()).origin !== current)
    throw Object.assign(
      new Error(
        "Abre la dirección configurada de BuscAG para solicitar un correo.",
      ),
      { code: "auth_redirect_mismatch" },
    );
  const redirect=new URL(authRedirect(configured?.trim() || current,recovery));
  // Preserve only an opaque public QR context, never arbitrary return URLs,
  // callback tokens or account information from the current location.
  const tag=new URL(currentOrigin).searchParams.get('tag');
  if(!recovery&&tag&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tag))redirect.searchParams.set('tag',tag);
  return redirect.toString();
}
export const AUTH_MAIL_COOLDOWN_MS = 60000;
export function authMailMessage(mode: "signup" | "reset" | "resend"): string {
  if (mode === "signup")
    return "Solicitud de registro recibida. Revisa tu correo para confirmar la cuenta. La respuesta del servidor no garantiza la entrega del mensaje.";
  if (mode === "resend")
    return "Solicitud recibida. Si la cuenta sigue sin confirmar y admite el reenvío, recibirás otro correo. Si ya confirmaste tu cuenta, inicia sesión. Esta respuesta no confirma la entrega.";
  return "Si la cuenta admite recuperación, recibirás un enlace. Revisa también spam. La respuesta del servidor no confirma la entrega del correo.";
}
