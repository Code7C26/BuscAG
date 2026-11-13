// Only public-key GET requests, fixed staging destination, no rows requested.
import { pathToFileURL } from "node:url";
import { STAGING_URL, stagingKeyError } from "../lib/stagingEnvironment.mjs";
export async function checkStagingPublic(key, fetcher = fetch) {
  const invalid = stagingKeyError(key);
  if (invalid) throw Error(invalid);
  const headers = {
    apikey: key.trim(),
    ...(key.trim().startsWith("sb_publishable_")
      ? {}
      : { Authorization: `Bearer ${key.trim()}` }),
  };
  const get = async (path) => {
    let response;
    try {
      response = await fetcher(STAGING_URL + path, {
        method: "GET",
        headers,
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw Error(
        "No se pudo contactar exclusivamente a staging. Revisar red, TLS y estado del proyecto.",
      );
    }
    return response;
  };
  const settings = await get("/auth/v1/settings");
  if (!settings.ok)
    throw Error(
      "Staging rechazó la clave publicable o Auth no está disponible. No se intentará otro proyecto.",
    );
  let config;
  try {
    config = await settings.json();
  } catch {
    throw Error("Auth de staging devolvió una respuesta no reconocida.");
  }
  const privacy = [];
  for (const table of [
    "profiles",
    "items",
    "messages",
    "notifications",
    "push_subscriptions",
  ]) {
    const response = await get(`/rest/v1/${table}?select=id&limit=0`);
    let error;
    try {
      error = await response.json();
    } catch {}
    if (![401, 403].includes(response.status) || error?.code !== "42501")
      throw Error(
        `Revisar permisos anónimos o exposición REST de ${table}; no coincide con el backend esperado.`,
      );
    privacy.push(table);
  }
  return {
    project: STAGING_URL,
    auth_settings: "reachable",
    auth_settings_complete:
      typeof config.external?.email === "boolean" &&
      typeof config.disable_signup === "boolean" &&
      typeof config.mailer_autoconfirm === "boolean",
    email_enabled: config.external?.email === true,
    signup_disabled: config.disable_signup === true,
    email_autoconfirm: config.mailer_autoconfirm === true,
    anonymous_access_denied: privacy,
    rpc_authenticated: "pending",
    signup_login_email: "pending",
    storage_upload: "pending",
    realtime: "pending",
    push: "pending",
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  checkStagingPublic(process.env.BUSCAG_STAGING_PUBLISHABLE_KEY)
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
