import { supabase } from "./supabase";
import { UUID_PATTERN } from "./schoolFeatures";
export class ServiceUnavailableError extends Error {
  constructor() { super("Esta función todavía no está disponible en este servicio."); }
}
export type CommunityMethod =
  | "my_community_settings"
  | "save_my_profile"
  | "set_user_block"
  | "list_my_blocks"
  | "can_share_contact"
  | "submit_report"
  | "list_reports"
  | "moderate_report"
  | "report_audit"
  | "set_item_follow"
  | "my_item_follow"
  | "rate_recovery"
  | "received_ratings"
  | "declare_independent_recovery";
export async function communityCall(
  name: CommunityMethod,
  args: any = {},
): Promise<any> {
  if (!supabase) throw Error("Servicio no disponible.");
  const { data, error } = await supabase.rpc(name, args);
  if (error?.code === 'PGRST202') throw new ServiceUnavailableError();
  if (error || data == null)
    throw Error(
      "No se pudo confirmar la operación. Verificá la conexión y la disponibilidad del servicio.",
    );
  if (
    ["set_user_block", "can_share_contact", "set_item_follow"].includes(name) &&
    typeof data !== "boolean"
  )
    throw Error("Respuesta de servicio no válida.");
  if (
    ["submit_report", "rate_recovery", "declare_independent_recovery"].includes(
      name,
    ) &&
    (typeof data !== "string" || !UUID_PATTERN.test(data))
  )
    throw Error("No se pudo confirmar el identificador de la operación.");
  if (
    [
      "list_my_blocks",
      "list_reports",
      "report_audit",
      "received_ratings",
    ].includes(name) &&
    !Array.isArray(data)
  )
    throw Error("No se pudo cargar el listado.");
  if (
    name === "my_item_follow" &&
    (typeof (data as any).following !== "boolean" ||
      typeof (data as any).notify !== "boolean")
  )
    throw Error("No se pudo confirmar el seguimiento.");
  if (["my_community_settings", "save_my_profile"].includes(name)) {
    const profile = data as any;
    if (
      profile.version !== 1 ||
      !["name", "avatar", "phone", "location"].every(
        (key) => typeof profile[key] === "string",
      ) ||
      typeof profile.share_phone !== "boolean" ||
      typeof profile.moderator !== "boolean"
    )
      throw Error("Configuración de perfil no disponible.");
  }
  return data;
}
export function normalizePhone(value: string) {
  return value.replace(/[ ()-]/g, "");
}
export function validPhone(value: string) {
  return value === "" || /^\+[1-9][0-9]{7,14}$/.test(value);
}
export const REPORT_REASONS = {
  estafa: "Estafa",
  spam: "Spam",
  falsa: "Publicación falsa",
  inapropiado: "Contenido inapropiado",
  acoso: "Acoso",
  otro: "Otro",
};
