import {pairing,deviceAllowed,digest} from './pairing.mjs';
import {page,css,js} from './page.mjs';
export const defaults=[{id:'search',question:'¿Dónde buscarías primero un objeto perdido?',options:['Redes sociales','Grupos de WhatsApp','Volver al lugar']},{id:'object',question:'¿Qué objeto quieren que busquemos en BuscAG?',options:['Auriculares','Llaves','Billetera']}];
const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(v=>v.toString(16).padStart(2,'0')).join('');
async function allowed(request,key){if(typeof key!=='string'||key.length<32)return false;const value=request.headers.get('Authorization')?.replace(/^Bearer /,'')||'';const a=await hash(value),b=await hash(key);let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0;}
export async function snapshot(env,admin=false){const rows=(await env.DB.prepare('SELECT * FROM polls').all()).results;const all=await Promise.all(defaults.map(async base=>{const row=rows.find(r=>r.id===base.id);const options=row?JSON.parse(row.options_json):base.options;const counted=(await env.DB.prepare('SELECT choice,count(*) AS n FROM votes WHERE event_id=? AND poll_id=? GROUP BY choice').bind(env.EVENT_ID||'buscag-aula',base.id).all()).results;const counts=options.map((_,i)=>Number(counted.find(r=>r.choice===i)?.n||0));const total=counts.reduce((a,b)=>a+b,0),maximum=Math.max(...counts);return{...base,question:row?.question||base.question,options,open:!!row?.opened,reveal:!!row?.revealed,total,counts:admin||row?.revealed?counts:null,winners:row?.revealed&&total?counts.flatMap((n,i)=>n===maximum?[i]:[]):[]};}));return{service:'BUSCAG — EL EXPERIMENTO',version:2,eventId:env.EVENT_ID||'buscag-aula',polls:all};}
export default {async fetch(request,env){const url=new URL(request.url);const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"};const json=(status,value,more={})=>new Response(JSON.stringify(value),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8',...more}});try{
 if(url.pathname==='/api/health')return json(200,{service:'buscag-aula-votes',version:2,storage:'independent',https:url.protocol==='https:',runtime:{nativeTimeout:typeof AbortSignal.timeout==='function'}});
 if(url.pathname==='/api/health/transport'&&request.method==='GET'){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
  try{const r=await fetch('https://buscag-el-experimento-votos.reedyrook2.chatgpt.site/api/health',{signal:controller.signal,redirect:'error'});return json(200,{nativeTimeout:typeof AbortSignal.timeout==='function',upstreamStatus:r.status});}
  catch(e){return json(200,{nativeTimeout:typeof AbortSignal.timeout==='function',failure:controller.signal.aborted?'TIMEOUT':'NETWORK',errorName:e.name,errorMessage:String(e.message).slice(0,200)});}finally{clearTimeout(timer);}
 }
 if(request.method!=='GET'&&request.method!=='HEAD'){const origin=request.headers.get('Origin');if(origin&&origin!==url.origin)return json(403,{error:'Origen rechazado.'});}
 const paired=await pairing(request,env,json,allowed);if(paired)return paired;
 if(url.pathname==='/api/device/revoke'&&request.method==='POST'){if(!await deviceAllowed(request,env))return json(401,{error:'Acceso privado requerido.'});await env.DB.prepare('UPDATE devices SET revoked=1 WHERE token_hash=?').bind(await digest(request.headers.get('Authorization').slice(7))).run();return json(200,{ok:true});}
 if(['/','/vote'].includes(url.pathname)&&request.method==='GET')return new Response(page,{headers:{...headers,'Content-Type':'text/html; charset=utf-8'}});
 if(url.pathname==='/style.css')return new Response(css,{headers:{...headers,'Content-Type':'text/css; charset=utf-8'}});
 if(url.pathname==='/client.js')return new Response(js,{headers:{...headers,'Content-Type':'text/javascript; charset=utf-8'}});
 if(url.pathname==='/api/polls'&&request.method==='GET')return json(200,await snapshot(env));
 if(url.pathname.startsWith('/api/admin/')){
  if(!await allowed(request,env.ADMIN_KEY)&&!await deviceAllowed(request,env))return json(401,{error:'Acceso privado requerido.'});
  if(url.pathname==='/api/admin/state'&&request.method==='GET')return json(200,await snapshot(env,true));
  if(request.method!=='POST')return json(405,{error:'Método no permitido.'});
  const text=await request.text();if(text.length>4096)return json(413,{error:'Petición demasiado grande.'});const body=JSON.parse(text);const base=defaults.find(p=>p.id===body.id);if(!base)return json(400,{error:'Encuesta inválida.'});
  if(url.pathname==='/api/admin/control'){
   await env.DB.prepare('INSERT INTO polls(id,question,options_json) VALUES(?,?,?) ON CONFLICT(id) DO NOTHING').bind(base.id,base.question,JSON.stringify(base.options)).run();
   await env.DB.prepare('UPDATE polls SET opened=COALESCE(?,opened),revealed=COALESCE(?,revealed) WHERE id=?').bind(typeof body.open==='boolean'?Number(body.open):null,typeof body.reveal==='boolean'?Number(body.reveal):null,base.id).run();
  }else if(url.pathname==='/api/admin/config'){
   if(typeof body.question!=='string'||body.question.length<3||body.question.length>250||!Array.isArray(body.options)||body.options.length<2||body.options.length>6||body.options.some(v=>typeof v!=='string'||!v.trim()||v.length>100)||new Set(body.options).size!==body.options.length)return json(400,{error:'Configuración inválida.'});
   const count=await env.DB.prepare('SELECT count(*) AS n FROM votes WHERE event_id=? AND poll_id=?').bind(env.EVENT_ID||'buscag-aula',base.id).first();if(count.n>0){const previous=await env.DB.prepare('SELECT * FROM polls WHERE id=?').bind(base.id).first();if(previous.question===body.question.trim()&&previous.options_json===JSON.stringify(body.options))return json(200,await snapshot(env,true));return json(409,{error:'No se redefine una encuesta que ya recibió votos.'});}
   await env.DB.prepare('INSERT INTO polls(id,question,options_json) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET question=excluded.question,options_json=excluded.options_json WHERE NOT EXISTS(SELECT 1 FROM votes WHERE event_id=? AND poll_id=?)').bind(base.id,body.question.trim(),JSON.stringify(body.options),env.EVENT_ID||'buscag-aula',base.id).run();
  }else return json(404,{error:'Acción no disponible.'});
  return json(200,await snapshot(env,true));
 }
 if(url.pathname==='/api/vote'&&request.method==='POST'){
  const text=await request.text();if(text.length>1024)return json(413,{error:'Petición demasiado grande.'});const body=JSON.parse(text);const p=await env.DB.prepare('SELECT * FROM polls WHERE id=?').bind(body.poll).first();if(!p||!p.opened)return json(409,{error:'Votación cerrada.'});const opts=JSON.parse(p.options_json);if(!Number.isInteger(body.choice)||body.choice<0||body.choice>=opts.length)return json(400,{error:'Opción inválida.'});
  const event=env.EVENT_ID||'buscag-aula';const cookieName='buscag_voter_'+event.replace(/[^a-zA-Z0-9]/g,'').slice(0,32);const cookies=Object.fromEntries((request.headers.get('Cookie')||'').split(';').map(v=>v.trim().split('=')));let voter=cookies[cookieName];if(!/^[a-f0-9]{64}$/.test(voter||''))voter=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(v=>v.toString(16).padStart(2,'0')).join('');
  const result=await env.DB.prepare('INSERT INTO votes(event_id,poll_id,voter_hash,choice,created_at) SELECT ?,?,?,?,? WHERE (SELECT opened FROM polls WHERE id=?)=1 ON CONFLICT(event_id,poll_id,voter_hash) DO NOTHING').bind(event,body.poll,await hash(voter),body.choice,Date.now(),body.poll).run();
  if(!result.meta.changes)return json(409,{error:'Esta sesión ya votó o la encuesta se cerró.'});return json(200,{ok:true},{'Set-Cookie':cookieName+'='+voter+'; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400'});
 }
 return json(404,{error:'Ruta no disponible.'});
 }catch{return json(400,{error:'No se pudo completar la operación.'});}}};
