// Optional school scheduler: real backend processing, fixed staging only, bounded lifetime.
import { pathToFileURL } from "node:url";
import { setTimeout as pause } from "node:timers/promises";
import { STAGING_URL } from "../lib/stagingEnvironment.mjs";
export function workerConfiguration(env, args) {
  if (args.length !== 1 || !["--once", "--watch"].includes(args[0]))
    throw Error("Usar --once o --watch; sólo BuscAG-Staging.");
  const secret = env.BUSCAG_STAGING_MATCH_WORKER_SECRET;
  if (
    typeof secret !== "string" ||
    secret.length < 32 ||
    secret.length > 512 ||
    /[\r\n]/.test(secret)
  )
    throw Error(
      "Configurar el secreto independiente de worker de STAGING en una variable privada de servidor.",
    );
  if (env.VITE_MATCH_WORKER_SECRET)
    throw Error("Retirar el secreto worker de VITE_*.");
  return { secret, watch: args[0] === "--watch" };
}
export async function processStagingOnce(secret, fetcher = fetch) {
  let response;
  try {
    response = await fetcher(STAGING_URL + "/functions/v1/process-matches", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: "{}",
      redirect: "error",
      signal: AbortSignal.timeout(25000),
    });
  } catch {
    throw Error(
      "No se pudo contactar al worker de staging; revisar red/TLS y despliegue.",
    );
  }
  if (!response.ok)
    throw Error(
      `Worker de staging rechazado (HTTP ${response.status}); revisar configuración y secreto del proyecto de prueba.`,
    );
  let data;
  try {
    data = await response.json();
  } catch {
    throw Error("Respuesta de worker no reconocida.");
  }
  if (
    !data ||
    !["enabled", "busy"].every((k) => typeof data[k] === "boolean") ||
    !["batches", "notifications", "failures"].every(
      (k) => Number.isSafeInteger(data[k]) && data[k] >= 0,
    ) ||
    data.batches > 5 ||
    data.notifications > 2000 ||
    data.failures > 5
  )
    throw Error("Contrato de worker incompatible.");
  return {
    enabled: data.enabled,
    busy: data.busy,
    batches: data.batches,
    notifications: data.notifications,
    failures: data.failures,
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const config = workerConfiguration(process.env, process.argv.slice(2));
    console.log(
      "Worker REAL de BuscAG-Staging. No activa matching ni modifica configuración. Watch finaliza en diez minutos; Ctrl+C lo detiene.",
    );
    const until = Date.now() + (config.watch ? 600000 : 0);
    do {
      const status = await processStagingOnce(config.secret);
      console.log(JSON.stringify(status));
      if (status.failures)
        throw Error(
          "Worker informó trabajos diferidos; revisar el monitor sin revelar registros.",
        );
      if (!config.watch) break;
      await pause(10000);
    } while (Date.now() < until);
  } catch {
    console.error(
      "Worker de staging NO verificado. Revisar acceso, despliegue, secreto y estado del backend. No se muestran respuestas privadas.",
    );
    process.exitCode = 1;
  }
}
