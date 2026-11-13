import { test, expect } from "@playwright/test";
import { mockBackend, login, userId } from "./fixtures";
test("profile starts with private phone and saves explicit normalized consent", async ({
  page,
}) => {
  await mockBackend(page);
  const calls: any[] = [];
  await page.route("**/rest/v1/rpc/*", async (route) => {
    const name = new URL(route.request().url()).pathname.split("/").pop(),
      body = route.request().postDataJSON();
    calls.push({ name, body });
    let data: any;
    if (name === "my_community_settings" || name === "save_my_profile")
      data = {
        version: 1,
        name: "Lucía de prueba",
        avatar: "",
        phone: "",
        share_phone: false,
        location: "",
        moderator: false,
      };
    else if (
      ["list_my_blocks", "list_reports", "received_ratings"].includes(name!)
    )
      data = [];
    else return route.fallback();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });
  await page.goto("/");
  await login(page);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Perfil", exact: true })
    .click();
  await page.getByRole("tab", { name: "Configuración", exact: true }).click();
  const settings = page.getByRole("region", { name: "Privacidad y perfil" });
  const share = settings.getByRole("checkbox", {
    name: /Compartir mi teléfono/,
  });
  await expect(share).not.toBeChecked();
  await settings
    .getByLabel("Teléfono privado", { exact: true })
    .fill("+54 9 11 2345-6789");
  await share.check();
  await settings
    .getByRole("button", { name: "Guardar perfil y privacidad" })
    .click();
  await expect(settings.getByRole("status")).toHaveText("Perfil guardado.");
  expect(calls.find((c) => c.name === "save_my_profile").body).toMatchObject({
    p_phone: "+5491123456789",
    p_share: true,
  });
  expect(
    calls.find((c) => c.name === "save_my_profile").body,
  ).not.toHaveProperty("user_id");
});
test("publication exposes follow preferences, reports and block without deleting data", async ({
  page,
}) => {
  const backend = await mockBackend(page);
  let following = false,
    notify = true,
    blocked = false;
  const writes: any[] = [];
  await page.route("**/rest/v1/rpc/*", async (route) => {
    const name = new URL(route.request().url()).pathname.split("/").pop(),
      body = route.request().postDataJSON();
    let data: any;
    if (name === "list_my_blocks")
      data = blocked ? [{ id: backend.store.items[0].owner_id }] : [];
    else if (name === "my_item_follow") data = { following, notify };
    else if (name === "set_item_follow") {
      following = body.p_follow;
      notify = body.p_notify;
      data = following;
      writes.push({ name, body });
    } else if (name === "set_user_block") {
      blocked = body.p_block;
      data = blocked;
      writes.push({ name, body });
    } else if (name === "submit_report") {
      data = backend.store.items[0].id;
      writes.push({ name, body });
    } else return route.fallback();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });
  await page.goto("/");
  await login(page);
  await page
    .getByRole("button", { name: /Mochila verde de prueba/ })
    .first()
    .click();
  const tools = page.getByRole("region", { name: "Seguridad y seguimiento" });
  await tools
    .getByRole("button", { name: "Seguir publicación", exact: true })
    .click();
  await expect(
    tools.getByRole("button", { name: "Dejar de seguir", exact:true }),
  ).toBeVisible();
  await tools
    .getByRole("checkbox", { name: "Avisarme cuando cambie el estado" })
    .uncheck();
  await tools.getByText("Denunciar", { exact: true }).click();
  await tools
    .getByRole("combobox", { name: "Motivo", exact: true })
    .selectOption("estafa");
  await tools.getByLabel("Descripción opcional").fill("Caso sintético");
  await tools.getByRole("button", { name: "Enviar denuncia" }).click();
  await expect(tools.getByRole("status").filter({hasText:"Denuncia registrada"})).toContainText("Denuncia registrada");
  page.once("dialog", (d) => d.accept());
  await tools
    .getByRole("button", { name: "Bloquear usuario", exact: true })
    .click();
  await expect(
    tools.getByRole("button", { name: "Desbloquear usuario", exact: true }),
  ).toBeVisible();
  expect(writes.find((w) => w.name === "submit_report").body).toMatchObject({
    p_kind: "item",
    p_reason: "estafa",
  });
  expect(writes.filter((w) => w.name === "set_item_follow")).toHaveLength(2);
  expect(backend.store.items).toHaveLength(1);
});
test("confirmed participant can rate once and report a dispute through the recovery panel", async ({
  page,
}) => {
  const backend = await mockBackend(page);
  backend.store.items[0].status = "recuperado";
  let rating: number | null = null,
    disputed = false;
  await page.route("**/rest/v1/rpc/*", async (route) => {
    const name = new URL(route.request().url()).pathname.split("/").pop(),
      body = route.request().postDataJSON();
    let data: any;
    if (name === "recovery_context")
      data = {
        version: 2,
        status: "recuperado",
        partners: [],
        requests: [
          {
            id: backend.store.items[0].id,
            item_id: backend.store.items[0].id,
            owner_id: backend.store.items[0].owner_id,
            partner_id: userId,
            owner_name: "Mateo",
            partner_name: "Lucía",
            mode: "bilateral",
            state: "confirmed",
            created_at: "2026-11-06T12:00:00Z",
            resolved_at: "2026-11-06T13:00:00Z",
            my_rating: rating,
            disputed,
          },
        ],
      };
    else if (name === "rate_recovery") {
      rating = body.p_stars;
      data = backend.store.items[0].id;
    } else if (name === "submit_report") {
      disputed = true;
      data = backend.store.items[0].id;
    } else return route.fallback();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });
  await page.goto("/");
  await login(page);
  await page
    .getByRole("button", { name: /Mochila verde de prueba/ })
    .first()
    .click();
  const panel = page.getByRole("region", {
    name: "Recuperación segura",
    exact: true,
  });
  await panel
    .getByText("Historial, valoración y problemas", { exact: true })
    .click();
  const ratingField = panel.getByLabel("Calificación de la devolución");
  const labelBox = await panel.getByText("Calificación", { exact: true }).boundingBox();
  const fieldBox = await ratingField.boundingBox();
  expect(fieldBox!.y - (labelBox!.y + labelBox!.height)).toBeGreaterThanOrEqual(7);
  const confirmBox = await panel.getByRole("button", { name: "Confirmar valoración", exact: true }).boundingBox();
  const problemBox = await panel.getByRole("button", { name: "Informar un problema", exact: true }).boundingBox();
  expect(confirmBox!.y - (fieldBox!.y + fieldBox!.height)).toBeGreaterThanOrEqual(12);
  expect(problemBox!.y - (confirmBox!.y + confirmBox!.height)).toBeGreaterThanOrEqual(12);
  expect(confirmBox!.height).toBeGreaterThanOrEqual(44);
  expect(problemBox!.height).toBeGreaterThanOrEqual(44);
  await ratingField.selectOption("4");
  await panel
    .getByRole("button", { name: "Confirmar valoración", exact: true })
    .click();
  await expect(panel.getByText("Tu valoración: 4/5")).toBeVisible();
  page.once("dialog", (d) => d.accept("Problema sintético"));
  await panel
    .getByRole("button", { name: "Informar un problema", exact: true })
    .click();
  await expect(panel.getByRole("status")).toHaveText("Devolución disputada");
  expect(backend.store.items[0].status).toBe("recuperado");
});
test("moderator tools record review notes and show a restricted audit trail", async ({
  page,
}) => {
  await mockBackend(page);
  let state = "open";
  const actions: any[] = [];
  await page.route("**/rest/v1/rpc/*", async (route) => {
    const name = new URL(route.request().url()).pathname.split("/").pop(),
      body = route.request().postDataJSON();
    let data: any;
    if (name === "my_community_settings")
      data = {
        version: 1,
        name: "Moderador sintético",
        avatar: "",
        phone: "",
        share_phone: false,
        location: "",
        moderator: true,
      };
    else if (name === "list_reports")
      data = [
        {
          id: userId,
          target_kind: "item",
          target_id: userId,
          reason: "spam",
          description: "Informe sintético",
          state,
        },
      ];
    else if (name === "list_my_blocks" || name === "received_ratings")
      data = [];
    else if (name === "moderate_report") {
      actions.push({
        id: userId,
        created_at: "2026-11-06",
        from_state: state,
        to_state: body.p_state,
        note: body.p_note,
      });
      state = body.p_state;
      data = state;
    } else if (name === "report_audit") data = actions;
    else return route.fallback();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });
  await page.goto("/");
  await login(page);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Perfil", exact: true })
    .click();
  await page.getByRole("tab", { name: "Configuración", exact: true }).click();
  const settings = page.getByRole("region", { name: "Privacidad y perfil" });
  await settings.getByText("Moderación", { exact: true }).click();
  await settings
    .getByLabel("Nota administrativa", { exact: true })
    .fill("Revisión documentada");
  await settings.getByRole("button", { name: "Revisar", exact: true }).click();
  await expect(settings.getByText(/Publicación · spam · En revisión/)).toBeVisible();
  await settings
    .getByRole("button", { name: "Ver auditoría", exact: true })
    .click();
  await expect(
    settings.locator("p").filter({ hasText: "Revisión documentada" }),
  ).toBeVisible();
  expect(actions).toHaveLength(1);
  expect(actions[0].to_state).toBe("reviewing");
  expect(actions[0].note).toBe("Revisión documentada");
});
test("a linked owner can declare independent recovery only after the pending handover is resolved", async ({
  page,
}) => {
  const backend = await mockBackend(page);
  const item = backend.store.items[0];
  item.owner_id = userId;
  item.status = "perdido";
  const requests: any[] = [
    {
      id: item.id,
      item_id: item.id,
      owner_id: userId,
      partner_id: "e0000000-0000-4000-8000-000000000002",
      owner_name: "Lucía",
      partner_name: "Mateo",
      mode: "bilateral",
      state: "pending",
    },
  ];
  await page.route("**/rest/v1/rpc/*", async (route) => {
    const name = new URL(route.request().url()).pathname.split("/").pop(),
      body = route.request().postDataJSON();
    let data: any;
    if (name === "recovery_context")
      data = {
        version: 2,
        status: item.status,
        partners: [{ id: requests[0].partner_id, name: "Mateo" }],
        requests,
      };
    else if (name === "resolve_item_recovery") {
      requests[0].state = "cancelled";
      data = "cancelled";
    } else if (name === "declare_independent_recovery") {
      requests.unshift({
        id: crypto.randomUUID(),
        item_id: item.id,
        owner_id: userId,
        partner_id: null,
        mode: "individual",
        state: "confirmed",
        owner_statement: body.p_reason,
        created_at: new Date().toISOString(),
      });
      item.status = "recuperado";
      data = requests[0].id;
    } else return route.fallback();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });
  await page.goto("/");
  await login(page);
  await page
    .getByRole("button", { name: /Mochila verde de prueba/ })
    .first()
    .click();
  const panel = page.getByRole("region", {
    name: "Recuperación segura",
    exact: true,
  });
  await expect(
    panel.getByText("Lo recuperé por mi cuenta", { exact: true }),
  ).toHaveCount(0);
  page.once("dialog", (d) => d.accept());
  await panel
    .getByRole("button", { name: "Cancelar solicitud", exact: true })
    .click();
  await panel.getByText("Lo recuperé por mi cuenta", { exact: true }).click();
  await panel
    .getByLabel("Cómo lo recuperaste sin una devolución bilateral", {
      exact: true,
    })
    .fill("Encontré mi mochila en mi casa, sin una entrega de otra persona.");
  page.once("dialog", (d) => d.accept());
  await panel
    .getByRole("button", {
      name: "Confirmar recuperación por cuenta propia",
      exact: true,
    })
    .click();
  await expect(panel.getByRole("status")).toHaveText("Recuperado");
  await panel
    .getByText("Historial, valoración y problemas", { exact: true })
    .click();
  await expect(
    panel.getByText(/Declaración del propietario: Encontré mi mochila/),
  ).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Confirmar valoración", exact: true }),
  ).toHaveCount(0);
  expect(requests.find((r) => r.mode === "bilateral").state).toBe("cancelled");
});

test('user follows are distinct from item follows and use the real RPC contract without optimistic success',async({page})=>{
 await mockBackend(page);let following=false,writes=0;
 await page.route('**/rest/v1/rpc/*',async route=>{
  const name=new URL(route.request().url()).pathname.split('/').pop();
  if(name==='list_my_blocks')return route.fulfill({json:[]});
  if(name==='my_item_follow')return route.fulfill({json:{following:false,notify:true}});
  if(name==='my_user_follow')return route.fulfill({json:following});
  if(name==='set_user_follow'){const body=route.request().postDataJSON();expect(body.p_target).not.toBe(userId);following=body.p_follow;writes++;return route.fulfill({json:following});}
  return route.fallback();
 });
 await page.goto('/');await login(page);
 await page.getByRole('button',{name:/Mochila verde de prueba/}).first().click();
 const controls=page.getByRole('region',{name:'Seguridad y seguimiento',exact:true});
 await controls.getByRole('button',{name:'Seguir a esta persona',exact:true}).click();
 await expect(controls.getByText('Seguirás sus nuevas publicaciones.',{exact:true})).toBeVisible();
 await expect(controls.getByRole('button',{name:'Seguir publicación',exact:true})).toBeVisible();
 await controls.getByRole('button',{name:'Dejar de seguir a esta persona',exact:true}).click();
 await expect(controls.getByText('Dejaste de seguir a esta persona.',{exact:true})).toBeVisible();expect(writes).toBe(2);
});
