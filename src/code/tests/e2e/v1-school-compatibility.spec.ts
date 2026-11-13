import {test,expect} from '@playwright/test';
import {mockBackend,login,userId} from './fixtures';
const missing={code:'PGRST202'};
const community=['my_community_settings','list_my_blocks','list_reports','received_ratings','my_item_follow','can_share_contact'];
test('school backend keeps the basic owner profile editable without inventing community privacy or empty lists',async({page})=>{
  await mockBackend(page);
  const profile={id:userId,full_name:'Lucía de prueba',avatar_url:'',location:'',phone:'',rating:0,created_at:'2026-01-01T00:00:00Z'};
  const writes:{body:any;owner:string|null}[]=[];
  await page.route('**/rest/v1/rpc/*',route=>community.some(name=>route.request().url().endsWith('/'+name))
    ?route.fulfill({status:404,json:missing}):route.fallback());
  await page.route('**/rest/v1/profiles?*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(request.method()==='PATCH'){
      const body=request.postDataJSON();writes.push({body,owner:url.searchParams.get('id')});Object.assign(profile,body);
      return route.fulfill({json:{id:userId}});
    }
    if(url.searchParams.get('id')==='eq.'+userId)return route.fulfill({json:[profile]});
    return route.fallback();
  });
  await page.goto('/');await login(page);
  await page.getByRole('navigation').getByRole('button',{name:'Perfil',exact:true}).click();
  await page.getByRole('tab',{name:'Configuración',exact:true}).click();
  const settings=page.getByRole('region',{name:'Privacidad y perfil'});
  await expect(settings).toContainText('Perfil básico disponible');
  await expect(settings.getByLabel('Nombre visible')).toHaveValue(profile.full_name);
  await expect(settings.getByLabel('Teléfono privado',{exact:true})).toHaveCount(0);
  await expect(settings.getByText(/Usuarios bloqueados/)).toHaveCount(0);
  await settings.getByLabel('Nombre visible').fill('Perfil para versión 1.0');
  await settings.getByLabel('Zona del perfil (privada)').fill('Zona de prueba');
  await settings.getByRole('button',{name:'Guardar perfil',exact:true}).click();
  await expect(settings).toContainText('Perfil guardado.');
  expect(writes).toEqual([{owner:'eq.'+userId,body:{full_name:'Perfil para versión 1.0',avatar_url:'',location:'Zona de prueba'}}]);
  await page.reload();
  await page.getByRole('navigation').getByRole('button',{name:'Perfil',exact:true}).click();
  await page.getByRole('tab',{name:'Configuración',exact:true}).click();
  await expect(page.getByLabel('Nombre visible')).toHaveValue('Perfil para versión 1.0');
});
test('a denied community profile never falls back to a direct profile write',async({page})=>{
  const backend=await mockBackend(page);
  await page.route('**/rest/v1/rpc/my_community_settings',route=>route.fulfill({status:403,json:{code:'42501'}}));
  await page.goto('/');await login(page);
  await page.getByRole('navigation').getByRole('button',{name:'Perfil',exact:true}).click();
  await page.getByRole('tab',{name:'Configuración',exact:true}).click();
  const settings=page.getByRole('region',{name:'Privacidad y perfil'});
  await expect(settings).toContainText('No se pudo cargar el perfil');
  await expect(settings.getByRole('button',{name:'Guardar perfil y privacidad'})).toBeDisabled();
  expect(backend.calls.filter(c=>c.path==='/rest/v1/profiles'&&c.method==='PATCH')).toHaveLength(0);
});
test('missing recovery and safety services do not offer mutations or keep polling; chat remains usable',async({page})=>{
  const backend=await mockBackend(page);const reads:string[]=[];
  await page.route('**/rest/v1/rpc/*',route=>{
    const name=new URL(route.request().url()).pathname.split('/').pop()!;
    if([...community,'recovery_context'].includes(name)){reads.push(name);return route.fulfill({status:404,json:missing});}
    return route.fallback();
  });
  await page.goto('/');await login(page);await page.getByText('Mochila verde de prueba',{exact:true}).click();
  const recovery=page.getByRole('region',{name:'Recuperación segura',exact:true});
  await expect(recovery.getByRole('alert')).toContainText('actualización pendiente');
  await expect(page.getByRole('region',{name:'Seguridad y seguimiento'})).toContainText('todavía no están habilitados');
  await expect(page.getByRole('button',{name:'Bloquear usuario',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Solicitar confirmación de devolución'})).toHaveCount(0);
  await page.waitForTimeout(5500);expect(reads.filter(n=>n==='recovery_context')).toHaveLength(1);
  await page.getByRole('button',{name:/Contactar/}).first().click();
  await page.getByPlaceholder(/Escrib/).fill('Mensaje compatible con school');
  await page.getByRole('button',{name:'Enviar mensaje',exact:true}).click();
  await expect(page.getByText('Mensaje compatible con school',{exact:true})).toBeVisible();
  await page.waitForTimeout(5500);expect(reads.filter(n=>n==='can_share_contact')).toHaveLength(1);
  expect(backend.calls.some(c=>c.path==='/rest/v1/items'&&c.method==='PATCH'&&c.body?.status)).toBe(false);
  expect(backend.calls.some(c=>c.path==='/rest/v1/rpc/request_item_recovery')).toBe(false);
});

test('profile discovers installed community RPCs on explicit reload without logging out',async({page})=>{
 const backend=await mockBackend(page);let installed=false;
 await page.route('**/rest/v1/rpc/*',route=>{
  const name=new URL(route.request().url()).pathname.split('/').pop()!;
  if(!community.includes(name))return route.fallback();
  if(!installed)return route.fulfill({status:404,json:missing});
  return route.fulfill({json:name==='my_community_settings'?{version:1,name:'Lucía de prueba',avatar:'',phone:'',share_phone:false,location:'',moderator:false}:name==='my_item_follow'?{following:false,notify:true}:name==='can_share_contact'?false:[]});
 });
 await page.goto('/');await login(page);
 await page.getByRole('navigation').getByRole('button',{name:'Perfil',exact:true}).click();
 await page.getByRole('tab',{name:'Configuración',exact:true}).click();
 const settings=page.getByRole('region',{name:'Privacidad y perfil'});
 await expect(settings).toContainText('Perfil básico disponible');
 installed=true;await settings.getByRole('button',{name:'Volver a cargar perfil y funciones'}).click();
 await expect(settings.getByLabel('Teléfono privado',{exact:true})).toBeVisible();
 await expect(settings.getByText(/Usuarios bloqueados/)).toBeVisible();
 await expect(settings.getByRole('button',{name:'Guardar perfil y privacidad'})).toBeEnabled();
 expect(backend.calls.some(c=>c.path==='/rest/v1/profiles'&&c.method==='PATCH')).toBe(false);
});
test('recovery can retry availability after migration without a direct status PATCH',async({page})=>{
 const backend=await mockBackend(page);let installed=false,reads=0;
 await page.route('**/rest/v1/rpc/recovery_context',route=>{reads++;return route.fulfill(installed?{json:{version:2,status:'encontrado',partners:[],requests:[]}}:{status:404,json:missing});});
 await page.goto('/');await login(page);await page.getByText('Mochila verde de prueba',{exact:true}).click();
 const recovery=page.getByRole('region',{name:'Recuperación segura',exact:true});
 await expect(recovery.getByRole('alert')).toContainText('actualización pendiente');
 installed=true;await recovery.getByRole('button',{name:'Volver a consultar recuperación'}).click();
 await expect(recovery.getByRole('status')).toHaveText('La publicación sigue activa hasta confirmar la recuperación.');
 await expect(recovery.getByRole('alert')).toHaveCount(0);
 expect(reads).toBeGreaterThanOrEqual(2);
 expect(backend.calls.some(c=>c.path==='/rest/v1/items'&&c.method==='PATCH'&&c.body?.status)).toBe(false);
});
