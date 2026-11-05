import { PRESENTATION_APP_URL } from "./presentationEnvironment.mjs";
import { STAGING_APP_URL } from "./stagingEnvironment.mjs";
export const PUBLIC_AUTH_REDIRECTS = Object.freeze([
  PRESENTATION_APP_URL + "/",
  PRESENTATION_APP_URL + "/?auth=recovery",
]);
export function visitorSettingsError(settings) {
  if (settings.auth_settings_complete !== true)
    return "Auth no informó todos los indicadores públicos; no se puede aprobar el registro de visitantes.";
  if (settings.email_enabled !== true)
    return "El proveedor de email debe estar habilitado en staging.";
  if (settings.signup_disabled !== false)
    return "Staging no permite nuevos registros.";
  if (settings.email_autoconfirm !== false)
    return "Mantener Confirm email activado: no se autoriza confirmar cuentas automáticamente.";
  return null;
}
export function stagingMailOrigin(source) {
  const origin = source.BUSCAG_STAGING_TEST_APP_ORIGIN || PRESENTATION_APP_URL;
  if (![PRESENTATION_APP_URL, STAGING_APP_URL].includes(origin))
    throw Error(
      "Callbacks de prueba sólo admiten el Hosting público confirmado o el frontend local de staging.",
    );
  return origin;
}

/** Read public metadata only; never send staging credentials to Hosting. */
export async function verifyPublicStagingArtifact(fetcher = fetch) {
  let response, data;
  try {
    response = await fetcher(
      PRESENTATION_APP_URL + "/presentation-manifest.json",
      {
        method: "GET",
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok) throw Error();
    data = await response.json();
  } catch {
    throw Error(
      "No se pudo verificar el artefacto público de staging. No enviar enlaces allí hasta publicar la versión autorizada o elegir el callback local de staging.",
    );
  }
  if (
    data?.mode !== "presentation" ||
    data.project_ref !== "yiarlhpbgkofhhipkfha" ||
    data.app_origin !== PRESENTATION_APP_URL ||
    typeof data.commit !== "string" ||
    !/^[0-9a-f]{40}$/.test(data.commit)
  )
    throw Error(
      "El sitio público no acredita un artefacto de BuscAG-Staging compatible. Ensayo de correo detenido.",
    );
  return { project_ref: data.project_ref, commit: data.commit };
}
