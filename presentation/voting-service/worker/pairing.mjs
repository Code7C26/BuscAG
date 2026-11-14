export const PUBLIC_ORIGIN='https://buscag-el-experimento-votos.reedyrook2.chatgpt.site';
export const OWNER_ORIGIN='https://buscag-autorizar-pc.reedyrook2.chatgpt.site';
export const digest=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(v=>v.toString(16).padStart(2,'0')).join('');
const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32))).map(v=>v.toString(16).padStart(2,'0')).join('');
const valid=s=>/^[a-f0-9]{64}$/.test(s||'');
export async function deviceAllowed(request,env){const token=request.headers.get('Authorization')?.replace(/^Bearer /,'')||'';if(!valid(token))return false;const row=await env.DB.prepare('SELECT token_hash FROM devices WHERE token_hash=? AND revoked=0 AND expires_at>?').bind(await digest(token),Date.now()).first();return !!row;}
export async function pairing(request,env,json,rootAllowed){
 const url=new URL(request.url),path=url.pathname,now=Date.now();
 if(!path.startsWith('/api/pair/'))return null;
 if(path.startsWith('/api/pair/admin/')&&!await rootAllowed(request,env.ADMIN_KEY))return json(401,{error:'Acceso privado requerido.'});
 if(request.method==='GET'&&path==='/api/pair/admin/inspect'){
  const id=url.searchParams.get('id');if(!valid(id))return json(400,{error:'Solicitud inválida.'});const row=await env.DB.prepare('SELECT id,code,expires_at,status FROM pairings WHERE id=?').bind(id).first();if(!row||row.expires_at<=now||row.status!=='pending')return json(410,{error:'Solicitud vencida o utilizada. Volvé a Studio y empezá otra conexión.'});return json(200,row);
 }
 if(request.method!=='POST')return json(405,{error:'Método no permitido.'});
 const text=await request.text();if(text.length>4096)return json(413,{error:'Solicitud demasiado grande.'});let b;try{b=JSON.parse(text);}catch{return json(400,{error:'Solicitud inválida.'});}
 if(path==='/api/pair/start'){
  const k=b.publicKey;if(!k||k.kty!=='RSA'||k.e!=='AQAB'||typeof k.n!=='string'||k.n.length<342||k.n.length>700||k.d)return json(400,{error:'Clave pública inválida.'});
  try{await crypto.subtle.importKey('jwk',k,{name:'RSA-OAEP',hash:'SHA-256'},false,['encrypt']);}catch{return json(400,{error:'Clave pública inválida.'});}
  const id=random(),token=random(),code=String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,'0'),expires=now+300000;
  // Bound public pending requests, without deleting completed audit records or touching votes.
  const pending=await env.DB.prepare("SELECT count(*) AS n FROM pairings WHERE status='pending' AND expires_at>?").bind(now).first();if(pending.n>=100)return json(429,{error:'Demasiadas solicitudes. Esperá cinco minutos.'});
  await env.DB.prepare('INSERT INTO pairings(id,poll_hash,public_key,code,expires_at,status) VALUES(?,?,?,?,?,?)').bind(id,await digest(token),JSON.stringify(k),code,expires,'pending').run();
  return json(200,{id,pollToken:token,code,expiresAt:expires,authorizationUrl:OWNER_ORIGIN+'/?id='+id});
 }
 if(!valid(b.id))return json(400,{error:'Solicitud inválida.'});
 if(path==='/api/pair/admin/approve'){
  const row=await env.DB.prepare("SELECT * FROM pairings WHERE id=? AND status='pending' AND expires_at>?").bind(b.id,now).first();if(!row)return json(410,{error:'Solicitud vencida o utilizada.'});
  const token=random(),tokenHash=await digest(token),deviceExpires=now+90*86400000;const key=await crypto.subtle.importKey('jwk',JSON.parse(row.public_key),{name:'RSA-OAEP',hash:'SHA-256'},false,['encrypt']);
  const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'RSA-OAEP'},key,new TextEncoder().encode(token)));const ciphertext=btoa(String.fromCharCode(...encrypted));
  await env.DB.prepare('INSERT INTO devices(token_hash,created_at,expires_at,revoked) VALUES(?,?,?,0)').bind(tokenHash,now,deviceExpires).run();
  const updated=await env.DB.prepare("UPDATE pairings SET status='approved',ciphertext=? WHERE id=? AND status='pending' AND expires_at>?").bind(ciphertext,b.id,now).run();if(!updated.meta.changes){await env.DB.prepare('UPDATE devices SET revoked=1 WHERE token_hash=?').bind(tokenHash).run();return json(409,{error:'Solicitud ya procesada.'});}
  return json(200,{ok:true});
 }
 if(!valid(b.pollToken))return json(401,{error:'Acceso inválido.'});
 const hash=await digest(b.pollToken);
 if(path==='/api/pair/cancel'){await env.DB.prepare("UPDATE pairings SET status='cancelled',ciphertext=NULL WHERE id=? AND poll_hash=? AND status IN ('pending','approved')").bind(b.id,hash).run();return json(200,{ok:true});}
 if(path==='/api/pair/poll'){
  // Atomic take: one and only one successful reader gets encrypted bytes.
  const row=await env.DB.prepare("UPDATE pairings SET status='consumed' WHERE id=? AND poll_hash=? AND status='approved' AND expires_at>? RETURNING ciphertext").bind(b.id,hash,now).first();if(row)return json(200,{status:'approved',ciphertext:row.ciphertext});
  const state=await env.DB.prepare('SELECT status,expires_at FROM pairings WHERE id=? AND poll_hash=?').bind(b.id,hash).first();if(!state)return json(401,{error:'Acceso inválido.'});if(state.expires_at<=now||state.status!=='pending')return json(410,{error:'Solicitud vencida o utilizada.'});return json(200,{status:'pending'});
 }
 return json(404,{error:'Ruta no disponible.'});
}
