/** Real compiled client, synthetic backend; no credentials or real network. */
import {chromium} from '@playwright/test';
import {spawn,spawnSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {mockBackend,createStore,login,userId} from '../../src/code/tests/e2e/fixtures';
const app=resolve('../src/code'),origin='http://127.0.0.1:3001',out=resolve('public/captures');
const env=Object.fromEntries(Object.entries(process.env).filter(([name])=>['PATH','Path','SystemRoot','SYSTEMROOT','ComSpec','COMSPEC','HOME','USERPROFILE','APPDATA','LOCALAPPDATA','TEMP','TMP','TMPDIR'].includes(name)));
Object.assign(env,{VITE_APP_ENV:'staging',VITE_APP_URL:origin,VITE_SUPABASE_URL:'https://yiarlhpbgkofhhipkfha.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_trailer_synthetic'});
const vite=resolve(app,'node_modules/vite/bin/vite.js'),dist=resolve('.app-dist');
const build=spawnSync(process.execPath,[vite,'build','--mode','staging','--outDir',dist],{cwd:app,env,stdio:'inherit'});if(build.status!==0)process.exit(1);
const server=spawn(process.execPath,[vite,'preview','--mode','staging','--outDir',dist,'--host','127.0.0.1','--port','3001','--strictPort'],{cwd:app,env,stdio:['ignore','pipe','pipe']});
let previewReady=false;server.stdout?.on('data',chunk=>{if(String(chunk).includes(origin))previewReady=true;});
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
try{
 for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error('Capture port busy; refusing another server.');try{if(previewReady&&(await fetch(origin)).ok)break;}catch{}await new Promise(r=>setTimeout(r,150));if(i===99)throw Error('Preview failed');}
 browser=await chromium.launch({headless:true,...(process.env.BUSCAG_TRAILER_BROWSER?{executablePath:process.env.BUSCAG_TRAILER_BROWSER}:existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium'}:{})});await mkdir(out,{recursive:true});
 const svg=await readFile('public/demo/backpack.svg','utf8'),keys=await readFile('public/demo/keys.svg','utf8');
 const art=await browser.newPage({viewport:{width:1000,height:1000}});await art.route('**/*',route=>route.fulfill({contentType:'image/svg+xml',body:svg}));await art.goto(origin+'/art');await art.screenshot({path:'public/demo/backpack.png'});await art.close();
 const context=await browser.newContext({viewport:{width:1440,height:960},deviceScaleFactor:1,locale:'es-AR',timezoneId:'America/Argentina/Buenos_Aires',serviceWorkers:'block'});
 const page=await context.newPage();await page.clock.setFixedTime(new Date('2026-11-08T16:00:00Z'));
 const store=createStore(),partner='e0000000-0000-4000-8000-000000000002',stamp='2026-11-08T15:00:00Z';
 const base={title:'Mochila azul escolar',description:'Mochila azul con cuaderno rojo y llavero negro.',category:'Mochilas y Bolsos',location_name:'Plaza Central · demo',lat:-34.6,lng:-58.4,date:'2026-11-08',reward:null,contact_count:0,created_at:stamp};
 const photo='https://yiarlhpbgkofhhipkfha.supabase.co/storage/v1/object/public/item-images/demo/';
 store.items.push({...base,id:'f0000000-0000-4000-8000-000000000011',owner_id:partner,status:'encontrado',image_url:photo+'backpack.svg'},
 {...base,id:'f0000000-0000-4000-8000-000000000012',owner_id:userId,status:'perdido',lat:-34.6004,image_url:photo+'backpack.svg'},
 {...base,id:'f0000000-0000-4000-8000-000000000013',owner_id:partner,title:'Llavero con tres llaves',description:'Encontrado junto a la plaza. ¿Es tuyo?',category:'Llaves',status:'encontrado',lat:-34.602,lng:-58.397,image_url:photo+'keys.svg'});
 const backend=await mockBackend(page,store);
 await page.route('https://ui-avatars.com/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" rx="64" fill="#468189"/><circle cx="64" cy="46" r="20" fill="#f4e9cd"/><path d="M24 112q0-42 40-42t40 42" fill="#f4e9cd"/></svg>'}));
 await page.route('**/storage/v1/object/public/item-images/demo/**',route=>route.fulfill({contentType:'image/svg+xml',body:route.request().url().endsWith('keys.svg')?keys:svg}));
 const tile=`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e5ede6"/><path d="M0 64H256M0 192H256M64 0V256M192 0V256" stroke="#b9ceca" stroke-width="16"/><path d="M0 64H256M0 192H256M64 0V256M192 0V256" stroke="#faf7ef" stroke-width="11"/><rect x="82" y="82" width="92" height="92" rx="14" fill="#b6cdb6"/><circle cx="105" cy="105" r="12" fill="#77aca2"/><circle cx="148" cy="147" r="16" fill="#9dbebb"/><path d="M82 128H174" stroke="#f4e9cd" stroke-width="4"/></svg>`;
 await page.route('https://*.tile.openstreetmap.org/**',route=>route.fulfill({contentType:'image/svg+xml',body:tile}));
 let recovery:any=null;
 await page.route('**/rest/v1/rpc/*',async route=>{
  const name=new URL(route.request().url()).pathname.split('/').pop(),body=route.request().postDataJSON();let data:any;
  if(['list_my_blocks','list_reports','received_ratings'].includes(name??''))data=[];
  else if(name==='my_item_follow')data={following:false,notify:true};
  else if(name==='my_user_follow'||name==='can_share_contact')data=false;
  else if(name==='recovery_context')data={version:2,status:store.items.find(i=>i.id===body.p_item)?.status,partners:[],requests:recovery&&body.p_item===store.items[0].id?[recovery]:[]};
  else if(name==='resolve_item_recovery'){if(!recovery||recovery.partner_id!==userId)throw Error('Invalid demo role');recovery.state=body.p_accept?'confirmed':'cancelled';if(body.p_accept)store.items[0].status='recuperado';data=recovery.state;}
  else return route.fallback();await route.fulfill({json:data});
 });
 const onlyPublish=process.argv.includes('--publish-only'),onlyMap=process.argv.includes('--map-only');
 const captures:string[]=[];
 const snap=async(name:string,selector?:string)=>{if((onlyPublish&&name!=='publish')||(onlyMap&&name!=='map'))return;await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(350);if(selector)await page.locator(selector).screenshot({path:resolve(out,name+'.png')});else await page.screenshot({path:resolve(out,name+'.png')});captures.push(name);};
 await page.goto(origin);await snap('auth');await login(page);await page.getByRole('button',{name:/Mochila azul escolar/}).first().waitFor();
 await snap('home-desktop');await snap('item-card','.item-card:first-of-type');await page.setViewportSize({width:430,height:900});await snap('home-phone');await page.setViewportSize({width:1440,height:960});
 await page.getByRole('button',{name:'Publicar objeto',exact:true}).click();await page.locator('input[type=file]').setInputFiles(resolve('public/demo/backpack.png'));await page.getByPlaceholder('Ej: Mochila negra Jansport, iPhone 13, Llaves...').fill('Mochila azul escolar');await page.getByRole('button',{name:/Lo perdí/}).click();await page.getByPlaceholder('Describe detalles específicos (color, marcas, contenido, hora aproximada)...').fill(base.description);await page.getByRole('dialog').locator('select').first().selectOption('Mochilas y Bolsos');await snap('publish','[role=dialog]');await page.keyboard.press('Escape');
 if(!onlyPublish){
 await page.getByPlaceholder('Buscar mochila, celular, llaves, documentos...').fill('mochila');await snap('search');await page.getByText('Búsqueda avanzada',{exact:true}).click();await page.getByLabel('Localidad o zona',{exact:true}).fill('Plaza Central');await snap('filters');
 await page.getByRole('navigation').getByRole('button',{name:'Mapa',exact:true}).click();await page.locator('.custom-map-pin').first().waitFor();await page.locator('.leaflet-tile-loaded').first().waitFor();await page.waitForFunction(()=>{const imgs=Array.from(document.querySelectorAll<HTMLImageElement>('.leaflet-tile'));return imgs.length>0&&imgs.every(img=>img.complete&&img.naturalWidth>0);});await page.clock.setFixedTime(new Date('2026-11-08T16:00:03Z'));await page.waitForTimeout(400);if(!(await page.locator('.leaflet-tile-loaded').evaluateAll(nodes=>nodes.every(node=>Number(getComputedStyle(node).opacity)>.99))))throw Error('Map tiles still transparent');await snap('map');
 if(!onlyMap){
 await page.getByRole('navigation').getByRole('button',{name:/Coincidencias/}).click();await page.getByRole('button',{name:'Comparar lado a lado',exact:true}).waitFor();await snap('matches');await page.getByRole('button',{name:'Comparar lado a lado',exact:true}).click();await snap('comparison','[role=dialog]');await page.keyboard.press('Escape');
 await page.getByRole('navigation').getByRole('button',{name:'Inicio',exact:true}).click();await page.locator('.item-card').filter({hasText:'Publicación de otra persona'}).filter({hasText:'Mochila azul escolar'}).first().click();await page.getByRole('button',{name:'Contactar al Publicador',exact:true}).click();
 const chat=page.getByRole('dialog',{name:'Conversación',exact:true});await chat.getByPlaceholder('Escribe un mensaje...').fill('¡Hola! Creo que es mi mochila. Tiene un cuaderno rojo.');await chat.locator('button[type=submit]').click();await page.waitForTimeout(250);
 const sent=store.messages[0];store.messages.push({...sent,id:'b0000000-0000-4000-8000-000000000001',sender_id:partner,recipient_id:userId,sender_name:'Mateo de prueba',text:'¡Sí! Coordinemos por acá para devolvértela.'});
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForTimeout(1000);await snap('chat','[aria-label="Conversación"]');await page.keyboard.press('Escape');
 recovery={id:'c0000000-0000-4000-8000-000000000001',item_id:store.items[0].id,owner_id:partner,partner_id:userId,owner_name:'Mateo de prueba',partner_name:'Lucía de prueba',mode:'bilateral',state:'pending',created_at:stamp,my_rating:null,disputed:false};
 await page.locator('.item-card').filter({hasText:'Publicación de otra persona'}).filter({hasText:'Mochila azul escolar'}).first().click();await page.getByRole('button',{name:'Actualizar confirmaciones',exact:true}).click();await page.getByRole('button',{name:'Confirmar entrega realizada',exact:true}).waitFor();await snap('recovery-pending','.recovery-tools');page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Confirmar entrega realizada',exact:true}).click();await page.getByRole('region',{name:'Recuperación segura',exact:true}).getByRole('status').filter({hasText:'Recuperado'}).waitFor();await snap('recovery-confirmed','.recovery-tools');
 await writeFile(resolve(out,'manifest.json'),JSON.stringify({version:1,mode:'real_ui_synthetic_backend',app_tree:spawnSync('git',['rev-parse','HEAD:src/code'],{cwd:'..',encoding:'utf8'}).stdout.trim(),source_files:['Header','ItemCard','PublishModal','AdvancedSearch','MapView','MatchesView','ContactModal','RecoveryPanel'],captures,real_credentials:false,external_network:'intercepted and fulfilled or aborted',map:'original illustrative tiles; actual Leaflet controls',simulated_recovery:recovery.state,mock_calls:backend.calls.length},null,2));console.log('Captured real UI:',captures.join(', '));
 }else console.log('Updated real MapView capture only.');
 }else console.log('Updated real PublishModal capture only.');
}finally{await browser?.close();server.kill('SIGTERM');}
