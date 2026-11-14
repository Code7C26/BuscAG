// SECURITY: deploy ONLY with verified Sites owner-only access. Never share this Site.
const origin='https://buscag-el-experimento-votos.reedyrook2.chatgpt.site';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hex=bytes=>Array.from(new Uint8Array(bytes)).map(v=>v.toString(16).padStart(2,'0')).join('');
async function sign(value,key){const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(value)));}
export default{async fetch(request,env){const url=new URL(request.url),subject=request.headers.get('oai-authenticated-user-id');const headers={'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'same-origin','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"};
const page=(status,title,body)=>new Response('<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BuscAG · Autorizar computadora</title><style>body{background:#07172b;color:#f0f7ff;font:22px system-ui;max-width:700px;margin:8vh auto;padding:24px}h1{font-size:40px}.code{font-size:64px;letter-spacing:10px;color:#63d8ff}button{font:inherit;padding:20px;background:#73dbff;border:0;border-radius:12px;cursor:pointer}small{display:block;margin-top:24px;color:#bdd0e5}</style><h1>'+esc(title)+'</h1>'+body+'</html>',{status,headers});
if(!subject)return page(401,'Iniciá sesión con tu cuenta propietaria','<p>Entrá mediante el acceso de ChatGPT de esta página privada. No se autoriza una computadora sin identidad autenticada.</p>');
if(!env.ADMIN_KEY||env.ADMIN_KEY.length<32)return page(503,'Configuración pendiente','<p>No se pudo habilitar la autorización.</p>');
async function remote(path,body){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{const r=await fetch(origin+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+env.ADMIN_KEY,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,redirect:'error',signal:controller.signal});
 if(!r.ok){const e=new Error('upstream');e.code=r.status===410?'PAIR_EXPIRED':r.status===401?'UPSTREAM_AUTH':'UPSTREAM_HTTP';e.upstreamStatus=r.status;throw e;}
 try{return await r.json();}catch{const e=new Error('json');e.code='UPSTREAM_FORMAT';throw e;}
 }catch(e){if(!e.code)e.code=controller.signal.aborted?'UPSTREAM_TIMEOUT':'UPSTREAM_NETWORK';console.error(JSON.stringify({event:'authorization-upstream-failure',code:e.code,upstreamStatus:e.upstreamStatus||null,nativeTimeout:typeof AbortSignal.timeout==='function'}));throw e;}finally{clearTimeout(timer);}
}
try{
if(url.pathname!=='/')return page(404,'Página no encontrada','');
if(request.method==='POST'){
 if(request.headers.get('Origin')!==url.origin)return page(403,'Solicitud rechazada','<p>Volvé al enlace abierto desde Studio.</p>');
 const text=await request.text();if(text.length>1024)return page(413,'Solicitud rechazada','');const b=new URLSearchParams(text),id=b.get('id'),expires=Number(b.get('expires')),mac=b.get('mac');if(!/^[a-f0-9]{64}$/.test(id||'')||!Number.isFinite(expires)||expires<Date.now()||expires>Date.now()+300000||mac!==await sign(subject+'|'+id+'|'+expires,env.ADMIN_KEY))return page(403,'Autorización vencida','<p>Volvé a Studio y conectá otra vez.</p>');
 await remote('/api/pair/admin/approve',{id});return page(200,'Computadora autorizada','<p>Volvé a BuscAG Studio. La conexión se completará automáticamente.</p><p>Podés cerrar esta pestaña.</p>');
}
if(request.method!=='GET')return page(405,'Método no permitido','');
const id=url.searchParams.get('id');if(!id)return page(200,'Conectar BuscAG Studio','<p>En tu computadora, abrí BuscAG Studio y pulsá <b>Conectar encuestas</b>. Usá el enlace que se muestra allí.</p>');if(!/^[a-f0-9]{64}$/.test(id))return page(400,'Enlace inválido','');
const row=await remote('/api/pair/admin/inspect?id='+id),expires=Math.min(row.expires_at,Date.now()+300000),mac=await sign(subject+'|'+id+'|'+expires,env.ADMIN_KEY);
return page(200,'¿Estás conectando tu computadora?','<p>Compará este código con el que aparece en tu BuscAG Studio:</p><p class="code">'+esc(row.code)+'</p><p>Autorizá sólo si vos acabás de iniciar la conexión y ambos códigos coinciden. No autorices enlaces enviados por otras personas.</p><form method="post"><input type="hidden" name="id" value="'+esc(id)+'"><input type="hidden" name="expires" value="'+expires+'"><input type="hidden" name="mac" value="'+mac+'"><button>Los códigos coinciden · Autorizar esta computadora</button></form><small>Vence en cinco minutos. No se muestra ni descarga ninguna clave administrativa.</small>');
}catch(e){const code=e.code||'AUTHORIZATION_INTERNAL';console.error(JSON.stringify({event:'authorization-failure',code}));if(code==='PAIR_EXPIRED')return page(410,'El enlace venció o ya fue utilizado','<p>Volvé a Studio y empezá otra conexión.</p>');return page(code==='UPSTREAM_TIMEOUT'?504:502,'No se pudo consultar el servicio de encuestas','<p>La solicitud no se pudo verificar. No se autorizó ninguna computadora. Reintentá más tarde.</p><small>Referencia: '+esc(code)+'</small>');}
}};
