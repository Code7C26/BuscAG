import {test,expect} from '@playwright/test';
import {mockBackend,login,userId} from './fixtures';
test('profile starts with private phone and saves explicit normalized consent',async({page})=>{
 await mockBackend(page);const calls:any[]=[];
 await page.route('**/rest/v1/rpc/*',async route=>{
  const name=new URL(route.request().url()).pathname.split('/').pop(),body=route.request().postDataJSON();calls.push({name,body});
  let data:any;
  if(name==='my_community_settings'||name==='save_my_profile') data={version:1,name:'Lucía de prueba',avatar:'',phone:'',share_phone:false,location:'',moderator:false};
  else if(['list_my_blocks','list_reports','received_ratings'].includes(name!))data=[];else return route.fallback();
  await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto('/');await login(page);
 await page.getByRole('navigation').getByRole('button',{name:'Perfil',exact:true}).click();
 await page.getByRole('tab',{name:'Configuración',exact:true}).click();
 const settings=page.getByRole('region',{name:'Privacidad y perfil'});
 const share=settings.getByRole('checkbox',{name:/Compartir mi teléfono/});await expect(share).not.toBeChecked();
 await settings.getByLabel('Teléfono privado',{exact:true}).fill('+54 9 11 2345-6789');
 await share.check();await settings.getByRole('button',{name:'Guardar perfil y privacidad'}).click();
 await expect(settings.getByRole('status')).toHaveText('Perfil guardado.');
 expect(calls.find(c=>c.name==='save_my_profile').body).toMatchObject({p_phone:'+5491123456789',p_share:true});
 expect(calls.find(c=>c.name==='save_my_profile').body).not.toHaveProperty('user_id');
});
test('publication exposes follow preferences, reports and block without deleting data',async({page})=>{
 const backend=await mockBackend(page);let following=false,notify=true,blocked=false;const writes:any[]=[];
 await page.route('**/rest/v1/rpc/*',async route=>{
  const name=new URL(route.request().url()).pathname.split('/').pop(),body=route.request().postDataJSON();let data:any;
  if(name==='list_my_blocks')data=blocked?[{id:backend.store.items[0].owner_id}]:[];
  else if(name==='my_item_follow')data={following,notify};
  else if(name==='set_item_follow'){following=body.p_follow;notify=body.p_notify;data=following;writes.push({name,body});}
  else if(name==='set_user_block'){blocked=body.p_block;data=blocked;writes.push({name,body});}
  else if(name==='submit_report'){data=backend.store.items[0].id;writes.push({name,body});}else return route.fallback();
  await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto('/');await login(page);await page.getByRole('button',{name:/Mochila verde de prueba/}).first().click();
 const tools=page.getByRole('region',{name:'Seguridad y seguimiento'});
 await tools.getByRole('button',{name:'Seguir publicación',exact:true}).click();await expect(tools.getByRole('button',{name:'Dejar de seguir'})).toBeVisible();
 await tools.getByRole('checkbox',{name:'Avisarme cuando cambie el estado'}).uncheck();
 await tools.getByText('Denunciar',{exact:true}).click();await tools.getByRole('combobox',{name:'Motivo',exact:true}).selectOption('estafa');
 await tools.getByLabel('Descripción opcional').fill('Caso sintético');await tools.getByRole('button',{name:'Enviar denuncia'}).click();
 await expect(tools.getByRole('status')).toContainText('Denuncia registrada');
 page.once('dialog',d=>d.accept());await tools.getByRole('button',{name:'Bloquear usuario',exact:true}).click();
 await expect(tools.getByRole('button',{name:'Desbloquear usuario',exact:true})).toBeVisible();
 expect(writes.find(w=>w.name==='submit_report').body).toMatchObject({p_kind:'item',p_reason:'estafa'});
 expect(writes.filter(w=>w.name==='set_item_follow')).toHaveLength(2);expect(backend.store.items).toHaveLength(1);
});
test('confirmed participant can rate once and report a dispute through the recovery panel',async({page})=>{
 const backend=await mockBackend(page);backend.store.items[0].status='recuperado';let rating:number|null=null,disputed=false;
 await page.route('**/rest/v1/rpc/*',async route=>{
  const name=new URL(route.request().url()).pathname.split('/').pop(),body=route.request().postDataJSON();let data:any;
  if(name==='recovery_context')data={version:2,status:'recuperado',partners:[],requests:[{id:backend.store.items[0].id,item_id:backend.store.items[0].id,owner_id:backend.store.items[0].owner_id,partner_id:userId,owner_name:'Mateo',partner_name:'Lucía',mode:'bilateral',state:'confirmed',created_at:'2026-11-06T12:00:00Z',resolved_at:'2026-11-06T13:00:00Z',my_rating:rating,disputed}]};
  else if(name==='rate_recovery'){rating=body.p_stars;data=backend.store.items[0].id;}
  else if(name==='submit_report'){disputed=true;data=backend.store.items[0].id;}else return route.fallback();
  await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto('/');await login(page);await page.getByRole('button',{name:/Mochila verde de prueba/}).first().click();
 const panel=page.getByRole('region',{name:'Recuperación segura',exact:true});
 await panel.getByText('Historial, valoración y problemas',{exact:true}).click();await panel.getByLabel('Calificación de la devolución').selectOption('4');
 await panel.getByRole('button',{name:'Valorar devolución',exact:true}).click();await expect(panel.getByText('Tu valoración: 4/5')).toBeVisible();
 page.once('dialog',d=>d.accept('Problema sintético'));await panel.getByRole('button',{name:'Informar un problema',exact:true}).click();
 await expect(panel.getByRole('status')).toHaveText('Devolución disputada');
 expect(backend.store.items[0].status).toBe('recuperado');
});
