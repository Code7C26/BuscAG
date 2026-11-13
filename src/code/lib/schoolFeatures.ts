export interface Watch {
  updated_at?: string;
  item_id: string;
  enabled: boolean;
  lat: number;
  lng: number;
  radius_km: number;
}
export interface Recovery {
  id: string;
  item_id: string;
  owner_id: string | null;
  partner_id: string | null;
  mode?: "bilateral" | "individual";
  owner_statement?: string | null;
  resolved_by?: string | null;
  resolved_name?: string | null;
  owner_name?: string;
  partner_name?: string;
  disputed?: boolean;
  my_rating?: number | null;
  state: "pending" | "confirmed" | "cancelled";
  created_at: string;
  resolved_at: string | null;
}
export interface PublicTag {
  item_id: string;
  category: string | null;
  status: string | null;
}
export interface CommunityStats {
  publications: number;
  lost: number;
  found: number;
  recovered: number;
  mine: number;
  scope: "visible_by_rls";
}
export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function tagFromUrl(href: string): string | null {
  const token = new URL(href).searchParams.get("tag");
  return token && UUID_PATTERN.test(token) ? token : null;
}
export function objectTagUrl(origin: string, token: string): string {
  if (!UUID_PATTERN.test(token)) throw Error("Etiqueta inválida");
  const url = new URL(origin);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw Error("Origen inválido");
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  url.searchParams.set("tag", token);
  return url.href;
}
export function watchZoneError(
  lat: number,
  lng: number,
  radius: number,
): string | null {
  return ![lat, lng, radius].every(Number.isFinite) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180 ||
    radius < 0.1 ||
    radius > 100
    ? "Elegí coordenadas válidas y un radio entre 0,1 y 100 km."
    : null;
}
export const featureFailure =
  "No se pudo completar la operación. Verificá la conexión o intentá más tarde. No se confirmó ningún cambio.";
