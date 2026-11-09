/** Real compiled client, synthetic backend; no credentials or real network. */
import {chromium} from '@playwright/test';
import {spawn,spawnSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {rm} from 'node:fs/promises';
import {demoSocketReply} from './realtime.mjs';
import {mockBackend,createStore,login,userId} from '../../src/code/tests/e2e/fixtures';
const app=resolve('../src/code'),origin='http://127.0.0.1:3001',out=resolve('public/v2');
const env=Object.fromEntries(Object.entries(process.env).filter(([name])=>['PATH','Path','SystemRoot','SYSTEMROOT','ComSpec','COMSPEC','HOME','USERPROFILE','APPDATA','LOCALAPPDATA','TEMP','TMP','TMPDIR'].includes(name)));
Object.assign(env,{VITE_APP_ENV:'staging',VITE_APP_URL:origin,VITE_SUPABASE_URL:'https://yiarlhpbgkofhhipkfha.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_trailer_synthetic'});
const vite=resolve(app,'node_modules/vite/bin/vite.js'),dist=resolve('.app-dist-v2');
const build=spawnSync(process.execPath,[vite,'build','--mode','staging','--outDir',dist],{cwd:app,env,stdio:'inherit'});if(build.status!==0)process.exit(1);
const server=spawn(process.execPath,[vite,'preview','--mode','staging','--outDir',dist,'--host','127.0.0.1','--port','3001','--strictPort'],{cwd:app,env,stdio:['ignore','pipe','pipe']});
let previewReady=false;server.stdout?.on('data',chunk=>{if(String(chunk).includes(origin))previewReady=true;});
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
try{
 for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error('Capture port busy; refusing another server.');try{if(previewReady&&(await fetch(origin)).ok)break;}catch{}await new Promise(r=>setTimeout(r,150));if(i===99)throw Error('Preview failed');}
 browser=await chromium.launch({headless:true,...(process.env.BUSCAG_TRAILER_BROWSER?{executablePath:process.env.BUSCAG_TRAILER_BROWSER}:existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium'}:{})});await mkdir(out,{recursive:true});
 const svg=await readFile('public/demo/backpack.svg','utf8'),keys=await readFile('public/demo/keys.svg','utf8');
 const art=await browser.newPage({viewport:{width:1000,height:1000}});await art.route('**/*',route=>route.fulfill({contentType:'image/svg+xml',body:svg}));await art.goto(origin+'/art');await art.screenshot({path:'public/v2/backpack.png'});await art.close();
 const context=await browser.newContext({viewport:{width:1600,height:900},deviceScaleFactor:2,locale:'es-AR',timezoneId:'America/Argentina/Buenos_Aires',serviceWorkers:'block'});
 const page=await context.newPage();
 const store=createStore(),partner='e0000000-0000-4000-8000-000000000002',stamp=new Date(Date.now()-3600000).toISOString();
 const base={title:'Mochila azul escolar',description:'Mochila azul con cuaderno rojo y llavero negro.',category:'Mochilas y Bolsos',location_name:'Plaza Central · demo',lat:-34.6,lng:-58.4,date:stamp.slice(0,10),reward:null,contact_count:0,created_at:stamp};
 const photo='https://yiarlhpbgkofhhipkfha.supabase.co/storage/v1/object/public/item-images/demo/';
 store.items.push({...base,id:'f0000000-0000-4000-8000-000000000011',owner_id:partner,status:'encontrado',image_url:photo+'backpack.svg'},
 {...base,id:'f0000000-0000-4000-8000-000000000012',owner_id:userId,status:'perdido',lat:-34.6004,image_url:photo+'backpack.svg'},
 {...base,id:'f0000000-0000-4000-8000-000000000013',owner_id:partner,title:'Llavero con tres llaves',description:'Encontrado junto a la plaza. ¿Es tuyo?',category:'Llaves',status:'encontrado',lat:-34.602,lng:-58.397,image_url:photo+'keys.svg'});
 const backend=await mockBackend(page,store);
 await page.routeWebSocket('wss://*.supabase.co/**',socket=>socket.onMessage(message=>{const reply=demoSocketReply(message);if(reply)socket.send(reply);}));
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

 const only=process.argv.find(a=>a.startsWith('--only='))?.slice(7);
 if(only&&!['home','publish','search','map','match','chat','recovery'].includes(only))throw Error('Invalid demo clip');
 const previous=only?JSON.parse(await readFile(resolve(out,'manifest.json'),'utf8')):null;
 const fps=15,manifest:any={version:2,method:'real_ui_action_frames_15fps_encoded_30fps',synthetic_backend:true,real_credentials:false,source_app_tree:spawnSync('git',['rev-parse','HEAD:src/code'],{cwd:'..',encoding:'utf8'}).stdout.trim(),map:'illustrative original geometry, real Leaflet controls',clips:[]};
 // Gate actions by captured time so a slower screenshot cannot compress
 // an entire interaction into the first few frames of the encoded clip.
 let capturedMs:number|null=null;
 let pendingPauses:{until:number;resolve:()=>void}[]=[];
 const pause=(ms:number)=>capturedMs===null?new Promise<void>(r=>setTimeout(r,ms)):new Promise<void>(resolve=>pendingPauses.push({until:capturedMs!+ms,resolve}));
 const advance=(ms:number)=>{capturedMs=ms;const ready=pendingPauses.filter(p=>p.until<=ms);pendingPauses=pendingPauses.filter(p=>p.until>ms);ready.forEach(p=>p.resolve());};
 async function shoot(name:string,seconds:number,action:()=>Promise<void>){
  if(only&&only!==name){await action();return;}
  if(await page.getByText('Se perdió la conexión en tiempo real. Se intentará resincronizar al reconectar.',{exact:true}).isVisible())throw Error('Demo transport must be connected before recording');
  const folder=resolve('out/v2/capture-'+name);await mkdir(folder,{recursive:true});
  let actionError:unknown;capturedMs=0;const start=performance.now();const run=action().catch(error=>{actionError=error;});
  for(let frame=0;frame<seconds*fps;frame++){
   await page.screenshot({path:resolve(folder,`f-${String(frame).padStart(4,'0')}.jpg`),type:'jpeg',quality:94});
   advance((frame+1)*1000/fps);
   await new Promise(r=>setTimeout(r,Math.max(0,start+(frame+1)*1000/fps-performance.now())));
  }
  advance(Infinity);capturedMs=null;await run;if(actionError)throw actionError;
  const dest=resolve(out,'clips',name+'.mp4');
  const encode=spawnSync(process.env.FFMPEG_PATH||'ffmpeg',['-y','-v','error','-framerate',String(fps),'-i',resolve(folder,'f-%04d.jpg'),'-vf','scale=in_color_matrix=bt601:out_color_matrix=bt709:in_range=pc:out_range=tv,fps=30,format=yuv420p','-c:v','libx264','-crf','17','-preset','fast','-color_range','tv','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709',dest],{stdio:'inherit'});
  if(encode.status!==0)throw Error('Clip encoding failed');
  manifest.clips.push({name,seconds,frames:seconds*30,path:'clips/'+name+'.mp4',simulated_backend:true});
  if(previous)manifest.clips=[...previous.clips.filter((c:any)=>c.name!==name),...manifest.clips];
  await rm(folder,{recursive:true,force:true});console.log('Recorded actual UI action:',name);
 }
 await page.goto(origin);await login(page);await page.locator('.item-card').first().waitFor();
 const lost=page.locator('.item-card').filter({hasText:'Tu publicación'}).filter({hasText:'Mochila azul escolar'}).first();
 const found=page.locator('.item-card').filter({hasText:'Publicación de otra persona'}).filter({hasText:'Mochila azul escolar'}).first();
 await lost.screenshot({path:resolve(out,'lost-card.png')});await found.screenshot({path:resolve(out,'found-card.png')});
 await shoot('home',6,async()=>{await pause(400);await page.mouse.wheel(0,380);await pause(700);await page.mouse.wheel(0,-380);await pause(700);});
 await page.getByRole('button',{name:'Publicar objeto',exact:true}).click();
 await page.locator('input[type=file]').setInputFiles(resolve('public/v2/backpack.png'));
 await shoot('publish',6,async()=>{
  await pause(300);await page.getByRole('button',{name:/Lo perdí/}).click();
  await page.locator('.publish-form').evaluate(el=>el.scrollTop=280);
  await page.getByPlaceholder('Ej: Mochila negra Jansport, iPhone 13, Llaves...').pressSequentially('Mochila azul escolar',{delay:50});
  await page.getByPlaceholder('Describe detalles específicos (color, marcas, contenido, hora aproximada)...').pressSequentially('Tiene un cuaderno rojo y un llavero negro.',{delay:25});
  await page.getByRole('dialog').locator('select').first().selectOption('Mochilas y Bolsos');await pause(600);
 });
 await page.keyboard.press('Escape');
 await shoot('search',6,async()=>{
  await page.getByPlaceholder('Buscar mochila, celular, llaves, documentos...').pressSequentially('mochila',{delay:120});await pause(400);
  await page.getByText('Búsqueda avanzada',{exact:true}).click();await page.getByLabel('Localidad o zona',{exact:true}).pressSequentially('Plaza Central',{delay:90});
  await page.getByLabel('Desde la fecha',{exact:true}).fill(stamp.slice(0,10));await pause(600);
 });
 await page.getByRole('navigation').getByRole('button',{name:'Mapa',exact:true}).click();
 await page.locator('.leaflet-tile-loaded').first().waitFor();await pause(700);
 await shoot('map',6,async()=>{
  await pause(300);await page.getByRole('button',{name:/Encontrados/}).click();await pause(400);await page.getByRole('button',{name:'Todos',exact:true}).click();
  await page.locator('.leaflet-control-zoom-in').click();await pause(600);
  const box=await page.locator('.leaflet-container').boundingBox();await page.mouse.move(box!.x+700,box!.y+400);await page.mouse.down();await page.mouse.move(box!.x+950,box!.y+490,{steps:20});await page.mouse.up();await pause(700);
 });
 await page.getByRole('navigation').getByRole('button',{name:/Coincidencias/}).click();
 await page.getByRole('button',{name:'Comparar lado a lado',exact:true}).waitFor();
 await shoot('match',5,async()=>{await pause(500);await page.getByRole('button',{name:'Comparar lado a lado',exact:true}).click();await pause(2200);});
 await page.keyboard.press('Escape');await page.getByRole('navigation').getByRole('button',{name:'Inicio',exact:true}).click();
 await found.click();await page.getByRole('button',{name:'Contactar al Publicador',exact:true}).click();
 await shoot('chat',6,async()=>{
  const chat=page.getByRole('dialog',{name:'Conversación',exact:true});
  await chat.getByPlaceholder('Escribe un mensaje...').pressSequentially('¡Es mi mochila! Tiene un cuaderno rojo.',{delay:35});
  await chat.locator('button[type=submit]').click();await pause(400);
  const sent=store.messages[0];store.messages.push({...sent,id:'b0000000-0000-4000-8000-000000000001',sender_id:partner,recipient_id:userId,sender_name:'Mateo de prueba',text:'¡Sí! Coordinemos la devolución.'});
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await pause(1600);
 });
 await page.keyboard.press('Escape');
 recovery={id:'c0000000-0000-4000-8000-000000000001',item_id:store.items[0].id,owner_id:partner,partner_id:userId,owner_name:'Mateo de prueba',partner_name:'Lucía de prueba',mode:'bilateral',state:'pending',created_at:stamp,my_rating:null,disputed:false};
 await found.click();const panel=page.getByRole('region',{name:'Recuperación segura',exact:true});await panel.scrollIntoViewIfNeeded();
 await page.getByRole('button',{name:'Confirmar entrega realizada',exact:true}).waitFor();
 await panel.screenshot({path:resolve(out,'pending.png')});
 await shoot('recovery',5,async()=>{await pause(1500);page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Confirmar entrega realizada',exact:true}).click();await panel.getByRole('status').filter({hasText:'Recuperado'}).waitFor();await pause(900);});
 await panel.screenshot({path:resolve(out,'recovered.png')});
 await writeFile(resolve(out,'manifest.json'),JSON.stringify(manifest,null,2));console.log('V2 real action clips complete; no remote API.');
}finally{await browser?.close();server.kill('SIGTERM');}
