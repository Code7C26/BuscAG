// Opt-in REAL staging API checks. Never imports dotenv or production settings.
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import {
  STAGING_URL,
  STAGING_REF,
  STAGING_APP_URL,
  stagingKeyError,
} from "../lib/stagingEnvironment.mjs";
import { checkStagingPublic } from "./check-staging-public.mjs";
class LiveCheckError extends Error {}
export function liveConfiguration(env, args) {
  const mode = args[0];
  if (
    args.length !== 1 ||
    !["--probe", "--email-requests", "--run"].includes(mode)
  )
    throw new LiveCheckError(
      "Usar --probe, --email-requests o --run. Destino fijo: BuscAG-Staging.",
    );
  if (stagingKeyError(env.BUSCAG_STAGING_PUBLISHABLE_KEY))
    throw new LiveCheckError(
      "Falta una clave pública válida de BuscAG-Staging. No usar claves de producción ni service_role.",
    );
  if (
    env.BUSCAG_STAGING_PROJECT_REF &&
    env.BUSCAG_STAGING_PROJECT_REF !== STAGING_REF
  )
    throw new LiveCheckError("Proyecto rechazado: sólo BuscAG-Staging.");
  if (mode === "--probe")
    return {
      mode,
      key: env.BUSCAG_STAGING_PUBLISHABLE_KEY.trim(),
      accounts: [],
    };
  if (env.BUSCAG_STAGING_TEST_ACCOUNTS_CONFIRMED !== "dedicated-test-accounts")
    throw new LiveCheckError(
      "Confirmar cuentas dedicadas con BUSCAG_STAGING_TEST_ACCOUNTS_CONFIRMED=dedicated-test-accounts.",
    );
  let accounts;
  try {
    accounts = JSON.parse(env.BUSCAG_STAGING_TEST_ACCOUNTS_JSON);
  } catch {
    throw new LiveCheckError(
      "Configurar tres cuentas ficticias en una variable privada de servidor, nunca VITE_ ni archivos Git.",
    );
  }
  if (
    !Array.isArray(accounts) ||
    accounts.length !== 3 ||
    accounts.some(
      (a) =>
        typeof a?.email !== "string" ||
        !a.email.includes("@") ||
        typeof a.password !== "string" ||
        a.password.length < 12,
    ) ||
    new Set(accounts.map((a) => a.email.toLowerCase())).size !== 3
  )
    throw new LiveCheckError(
      "Se requieren tres cuentas de prueba diferentes y contraseñas de prueba de al menos 12 caracteres.",
    );
  return { mode, key: env.BUSCAG_STAGING_PUBLISHABLE_KEY.trim(), accounts };
}
export function pinnedStagingFetch(fetchImpl = fetch) {
  return (input, options = {}) => {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    if (url.origin !== STAGING_URL || url.username || url.password)
      throw new LiveCheckError("Solicitud fuera de staging bloqueada.");
    return fetchImpl(input, {
      ...options,
      redirect: "error",
      signal: options.signal ?? AbortSignal.timeout(20000),
    });
  };
}
const check = (condition, name) => {
  if (!condition) throw new LiveCheckError(name);
};
const accepted = (result, name) => {
  check(!result.error, name);
  return result.data;
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export async function runLiveChecks(config, report = console.log) {
  const clients = [];
  const channels = [];
  const runId = randomUUID();
  const make = () => {
    const c = createClient(STAGING_URL, config.key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: { fetch: pinnedStagingFetch() },
    });
    clients.push(c);
    return c;
  };
  try {
    if (config.mode === "--probe") {
      await checkStagingPublic(config.key, pinnedStagingFetch());
      report(
        "PASS: acceso público Auth y restricciones anónimas de staging. Correo, sesión y servicios autenticados: pendientes.",
      );
      return;
    }
    if (config.mode === "--email-requests") {
      for (const account of config.accounts) {
        accepted(
          await make().auth.signUp({
            email: account.email,
            password: account.password,
            options: {
              emailRedirectTo: STAGING_APP_URL + "/",
              data: { full_name: "BuscAG QA dedicada" },
            },
          }),
          "Registro rechazado: revisar Auth/SMTP/cuotas de staging.",
        );
      }
      accepted(
        await make().auth.resetPasswordForEmail(config.accounts[0].email, {
          redirectTo: STAGING_APP_URL + "/?auth=recovery",
        }),
        "Solicitud de recuperación rechazada.",
      );
      report(
        "SOLICITUDES ACEPTADAS: registro y recuperación. Entrega, confirmación, enlace y cambio de contraseña NO verificados. No repetir para forzar reenvíos.",
      );
      return;
    }
    const users = [];
    for (const account of config.accounts) {
      const c = make();
      const data = accepted(
        await c.auth.signInWithPassword(account),
        "Login de cuenta ficticia rechazado; revisar confirmación.",
      );
      check(
        data.user?.email_confirmed_at,
        "La cuenta de prueba no tiene correo confirmado.",
      );
      users.push(data.user);
    }
    check(
      new Set(users.map((user) => user.id)).size === 3,
      "Las tres cuentas ficticias deben tener identidades diferentes.",
    );
    const [a, b, c] = clients;
    const [ua, ub, uc] = users;
    report(
      "PASS: login de tres cuentas confirmadas (no demuestra recepción del correo).",
    );
    const capabilities = accepted(
      await a.rpc("buscag_capabilities"),
      "RPC de capacidades no disponible.",
    );
    check(
      Array.isArray(capabilities) &&
        typeof capabilities[0]?.queued_match_notifications === "boolean",
      "Contrato de capacidades incompatible.",
    );
    accepted(
      await a.from("profiles").select("id").eq("id", ua.id).single(),
      "Perfil propio no accesible.",
    );
    check(
      accepted(
        await a.from("profiles").select("id").eq("id", ub.id),
        "No se pudo verificar privacidad de perfiles.",
      ).length === 0,
      "Perfil privado ajeno expuesto.",
    );
    const directory = accepted(
      await a.from("public_profiles").select("id").eq("id", ub.id),
      "Directorio público no disponible.",
    );
    check(
      directory.length === 1,
      "Falta perfil público del usuario de prueba.",
    );
    report(
      "PASS: perfil propio y aislamiento de profiles; directorio público disponible.",
    );
    // A tiny valid PNG, generated fixture only; no production images downloaded.
    const bytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
      "base64",
    );
    const imagePath = `${ua.id}/qa-${runId}.png`;
    accepted(
      await a.storage
        .from("item-images")
        .upload(imagePath, bytes, { contentType: "image/png", upsert: false }),
      "Storage upload rechazado.",
    );
    const downloaded = accepted(
      await a.storage.from("item-images").download(imagePath),
      "Storage download rechazado.",
    );
    check(
      Buffer.compare(Buffer.from(await downloaded.arrayBuffer()), bytes) === 0,
      "Bytes Storage no coinciden.",
    );
    check(
      Boolean(
        (
          await b.storage
            .from("item-images")
            .upload(`${ua.id}/qa-forbidden-${runId}.png`, bytes, {
              contentType: "image/png",
              upsert: false,
            })
        ).error,
      ),
      "Storage permite escritura en carpeta ajena.",
    );
    report("PASS: Storage upload/download íntegro y rechazo de carpeta ajena.");
    const image = a.storage.from("item-images").getPublicUrl(imagePath)
      .data.publicUrl;
    const payload = {
      title: `QA BuscAG ${runId}`,
      description: "Publicación ficticia del ensayo automatizado de staging.",
      category: "Mochilas y Bolsos",
      status: "perdido",
      location_name: "Ubicación ficticia QA",
      lat: -34.6,
      lng: -58.38,
      date: new Date().toISOString().slice(0, 10),
      image_url: image,
      reward: null,
    };
    const publish = async (client, p, key = randomUUID()) => {
      const result = accepted(
        await client.rpc("publish_item_once", {
          p_request_key: key,
          p_payload: p,
        }),
        "RPC publicación rechazada.",
      );
      check(result?.length === 1, "RPC publicación sin fila.");
      return result[0];
    };
    const requestKey = randomUUID();
    const item = await publish(a, payload, requestKey);
    const repeated = await publish(a, payload, requestKey);
    check(item.id === repeated.id, "Publicación duplicada por reintento.");
    const found = await publish(b, { ...payload, status: "encontrado" });
    check(
      accepted(
        await c
          .from("items")
          .update({ title: "No autorizado" })
          .eq("id", item.id)
          .select("id"),
        "UPDATE ajeno no pudo comprobarse.",
      ).length === 0,
      "Un tercero modificó publicación ajena.",
    );
    accepted(
      await a
        .from("items")
        .update({ description: "Descripción ficticia editada QA." })
        .eq("id", item.id)
        .select("id")
        .single(),
      "Edición propia rechazada.",
    );
    report(
      "PASS: publicaciones idempotentes, edición propia y rechazo de edición ajena.",
    );
    let received = false;
    const channel = b.channel(`qa-${runId}`).on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `recipient_id=eq.${ub.id}`,
      },
      (event) => {
        if (event.new.item_id === found.id) received = true;
      },
    );
    channels.push([b, channel]);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () =>
          reject(new LiveCheckError("Realtime no suscribió en 15 segundos.")),
        15000,
      );
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timer);
          resolve();
        } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
          clearTimeout(timer);
          reject(new LiveCheckError("Realtime rechazó la suscripción."));
        }
      });
    });
    const messageKey = randomUUID();
    const args = {
      p_request_key: messageKey,
      p_item_id: found.id,
      p_recipient_id: ub.id,
      p_text: `Mensaje ficticio QA ${runId}`,
    };
    const first = accepted(
      await a.rpc("send_message_once", args),
      "Envío RPC rechazado.",
    )[0];
    const retry = accepted(
      await a.rpc("send_message_once", args),
      "Reintento RPC rechazado.",
    )[0];
    check(
      first?.id && first.id === retry?.id,
      "Mensaje duplicado o sin confirmar.",
    );
    const deadline = Date.now() + 15000;
    while (!received && Date.now() < deadline) await wait(250);
    check(received, "Mensaje no recibido por Realtime.");
    check(
      accepted(
        await c.from("messages").select("id").eq("id", first.id),
        "Privacidad de mensajes no comprobada.",
      ).length === 0,
      "Tercero puede leer mensaje.",
    );
    accepted(
      await b
        .from("messages")
        .update({ is_read: true })
        .eq("id", first.id)
        .select("id")
        .single(),
      "Recibo rechazado.",
    );
    check(
      accepted(
        await a.from("messages").select("is_read").eq("id", first.id).single(),
        "Recibo no legible por remitente.",
      ).is_read === true,
      "Recibo no persistió.",
    );
    accepted(
      await b.rpc("send_message_once", {
        p_request_key: randomUUID(),
        p_item_id: found.id,
        p_recipient_id: ua.id,
        p_text: "Respuesta ficticia QA.",
      }),
      "Respuesta del propietario rechazada.",
    );
    const notices = accepted(
      await b
        .from("notifications")
        .select("id,is_read")
        .eq("related_item_id", found.id)
        .eq("type", "message"),
      "Avisos de chat no accesibles.",
    );
    check(notices.length > 0, "Trigger no generó notificación de mensaje.");
    check(
      accepted(
        await c
          .from("notifications")
          .select("id")
          .in(
            "id",
            notices.map((n) => n.id),
          ),
        "Privacidad de avisos no comprobada.",
      ).length === 0,
      "Avisos ajenos expuestos.",
    );
    accepted(
      await b
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notices[0].id)
        .select("id")
        .single(),
      "Lectura de aviso no persistió.",
    );
    await b.removeChannel(channel);
    channels.length = 0;
    check(
      accepted(
        await b.from("messages").select("id").eq("id", first.id),
        "Resync REST falló.",
      ).length === 1,
      "Mensaje ausente tras desconexión.",
    );
    report(
      "PASS: chat idempotente, evento Realtime, recibos, respuesta, aviso y privacidad de tercero; resync REST tras desconexión. Reconexión WebSocket prolongada: pendiente.",
    );
    if (capabilities[0].queued_match_notifications) {
      const end = Date.now() + 90000;
      let both = false;
      while (Date.now() < end) {
        const x = accepted(
          await a
            .from("notifications")
            .select("id")
            .eq("type", "match")
            .in("related_item_id", [item.id, found.id]),
          "Avisos match A fallaron.",
        );
        const y = accepted(
          await b
            .from("notifications")
            .select("id")
            .eq("type", "match")
            .in("related_item_id", [item.id, found.id]),
          "Avisos match B fallaron.",
        );
        if (x.length >= 1 && y.length >= 1) {
          both = true;
          break;
        }
        await wait(1000);
      }
      check(
        both,
        "Matching activo sin avisos de ambos propietarios dentro de 90 s; comprobar scheduler/cola.",
      );
      report(
        "PASS: avisos match para ambos propietarios observados; vínculo de par y deduplicación remota no certificados por esta consulta.",
      );
    } else
      report(
        "PENDIENTE: matching backend deshabilitado; no se activó ni se probó worker.",
      );
    accepted(
      await b
        .from("items")
        .update({ status: "recuperado" })
        .eq("id", found.id)
        .select("id")
        .single(),
      "Recuperación rechazada.",
    );
    check(
      accepted(
        await a.from("messages").select("id").eq("id", first.id),
        "Chat tras recuperación no accesible.",
      ).length === 1,
      "Recuperar perdió la conversación.",
    );
    report(
      "PASS: recuperación del objeto ficticio propio conserva conversación.",
    );
    report(
      `ENSAYO COMPLETO API. Run ${runId}. Filas/imágenes ficticias conservadas; no se borró ningún objeto. Push, entrega email y E2E frontend real: pendientes.`,
    );
  } finally {
    await Promise.allSettled(
      channels.map(([client, channel]) => client.removeChannel(channel)),
    );
    await Promise.allSettled(
      clients.map(async (client) => {
        await client.removeAllChannels();
        if ((await client.auth.getSession()).data.session)
          await client.auth.signOut({ scope: "local" });
      }),
    );
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    await runLiveChecks(liveConfiguration(process.env, process.argv.slice(2)));
  } catch (error) {
    if (error instanceof LiveCheckError) console.error(error.message);
    console.error(
      "ENSAYO NO APROBADO. Revisar acceso a staging, cuentas dedicadas confirmadas, RLS/RPC y servicios. No se imprimen respuestas, credenciales ni datos privados. Los objetos ficticios ya creados se conservan.",
    );
    process.exitCode = 1;
  }
}
