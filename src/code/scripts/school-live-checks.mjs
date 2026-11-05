// Uses ONLY synthetic records created by the staging runner. No admin credentials.
export async function runSchoolChecks({
  a,
  b,
  c,
  anon,
  owner,
  partner,
  item,
  check,
  accepted,
  report,
}) {
  check(
    Boolean(c),
    "El ensayo escolar requiere tres cuentas dedicadas para probar aislamiento.",
  );
  const forbidden = await c.rpc("set_item_watch", {
    p_item: item.id,
    p_enabled: true,
    p_lat: -34.6,
    p_lng: -58.38,
    p_radius: 3,
  });
  check(
    Boolean(forbidden.error),
    "Un tercero pudo configurar vigilancia ajena.",
  );
  const tag = accepted(
    await b.rpc("manage_object_tag", {
      p_item: item.id,
      p_enabled: true,
      p_rotate: true,
    }),
    "QR propio rechazado.",
  );
  const resolved = accepted(
    await anon.rpc("resolve_object_tag", { p_token: tag.token }),
    "Resolución pública QR rechazada.",
  );
  check(
    resolved?.item_id === item.id &&
      Object.keys(resolved).sort().join(",") === "category,item_id,status",
    "El QR devolvió datos inesperados.",
  );
  check(
    Boolean(
      (
        await c.rpc("manage_object_tag", {
          p_item: item.id,
          p_enabled: false,
          p_rotate: false,
        })
      ).error,
    ),
    "Tercero pudo revocar QR ajeno.",
  );
  accepted(
    await b.rpc("manage_object_tag", {
      p_item: item.id,
      p_enabled: false,
      p_rotate: false,
    }),
    "Revocación propia rechazada.",
  );
  check(
    accepted(
      await anon.rpc("resolve_object_tag", { p_token: tag.token }),
      "QR revocado no verificable.",
    ) === null,
    "El QR revocado sigue resolviendo.",
  );
  report(
    "PASS REAL: QR sintético sin datos privados, administración ajena rechazada y revocación efectiva.",
  );
  const args = { p_item: item.id, p_partner: partner };
  const id = accepted(
    await b.rpc("request_item_recovery", args),
    "Solicitud bilateral rechazada.",
  );
  check(
    accepted(
      await b.rpc("request_item_recovery", args),
      "Reintento bilateral rechazado.",
    ) === id,
    "Reintento creó otra solicitud.",
  );
  check(
    Boolean(
      (await c.rpc("resolve_item_recovery", { p_request: id, p_accept: true }))
        .error,
    ),
    "Tercero confirmó devolución.",
  );
  check(
    Boolean(
      (await b.rpc("resolve_item_recovery", { p_request: id, p_accept: true }))
        .error,
    ),
    "Dueño confirmó por ambas personas.",
  );
  check(
    accepted(
      await a.rpc("resolve_item_recovery", { p_request: id, p_accept: true }),
      "Confirmación de contraparte rechazada.",
    ) === "confirmed",
    "Devolución no confirmada.",
  );
  check(
    accepted(
      await a.rpc("resolve_item_recovery", { p_request: id, p_accept: true }),
      "Reintento confirmación rechazado.",
    ) === "confirmed",
    "Confirmación no idempotente.",
  );
  const history = accepted(
    await b.rpc("list_recovery_confirmations", { p_item: item.id }),
    "Historial bilateral no accesible.",
  );
  check(
    history.filter(
      (r) =>
        r.id === id &&
        r.owner_id === owner &&
        r.partner_id === partner &&
        r.state === "confirmed",
    ).length === 1,
    "Historial bilateral incoherente.",
  );
  check(
    accepted(
      await c.rpc("list_recovery_confirmations", { p_item: item.id }),
      "Aislamiento de historial no verificable.",
    ).length === 0,
    "Historial visible a tercero.",
  );
  const stats = accepted(
    await a.rpc("community_statistics"),
    "Estadísticas rechazadas.",
  );
  const visible = await a
    .from("items")
    .select("id", { count: "exact", head: true });
  check(
    !visible.error &&
      Number(stats.publications) === visible.count &&
      stats.scope === "visible_by_rls",
    "Estadísticas difieren de filas visibles.",
  );
  report(
    "PASS REAL: devolución bilateral idempotente y autorizada, historial protegido y estadísticas por RLS. Sólo datos QA nuevos; no se eliminaron registros.",
  );
}
