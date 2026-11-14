import {generateKeyPairSync,privateDecrypt,constants} from 'node:crypto';
import {unlink} from 'node:fs/promises';
import {PUBLIC_ORIGIN,OWNER_ORIGIN} from '../voting-service/worker/pairing.mjs';
import {readFile,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {httpsOrigin} from './public-links.mjs';
export async function createVotingBridge(dataDir,{transport=fetch,onUpdate=()=>{}}={}){
 let config=null,polls=null,lastAt=0,error='',timer,refreshing=false,closed=false,pending=null,pairBusy=false,pairState={phase:'idle'};
 try{const raw=JSON.parse(await readFile(join(dataDir,'voting-private.json'),'utf8'));if(httpsOrigin(raw.origin)&&typeof raw.adminKey==='string'&&raw.adminKey.length>=32)config=raw;}catch{}
 async function request(path,body,settings=config){if(!settings)throw Error('Configurar primero el servicio HTTPS de votación.');const r=await transport(settings.origin+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...((path.startsWith('/api/admin/')||path.startsWith('/api/device/'))?{'Authorization':'Bearer '+settings.adminKey}:{})},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(5000)});let data;try{data=await r.json();}catch{throw Error('El servicio no devolvió JSON de votación.');}if(!r.ok)throw Error(r.status===401?'El servicio rechazó la clave administrativa.':data.error||'El servicio HTTPS no está disponible.');return data;}
 function validSnapshot(data){if(!Array.isArray(data.polls)||data.polls.length!==2||data.polls.some((p,i)=>p.id!==['search','object'][i]||!Array.isArray(p.options)||typeof p.open!=='boolean'||typeof p.total!=='number'))throw Error('Respuesta incompatible del servicio de votación.');}
 async function refresh(){if(!config||refreshing)return;refreshing=true;try{const data=await request('/api/admin/state');validSnapshot(data);polls=data.polls;lastAt=Date.now();error='';}catch{error='Sin conexión con el servicio HTTPS. Los resultados pueden estar desactualizados.';}finally{refreshing=false;if(!closed)onUpdate();}}
 async function configure(origin,adminKey,projectPolls){const normalized=httpsOrigin(origin);if(!normalized||typeof adminKey!=='string'||adminKey.length<32)throw Error('Usar un origen HTTPS público válido y una clave de servidor de al menos 32 caracteres.');const settings={origin:normalized,adminKey};const health=await request('/api/health',undefined,settings);if(health.service!=='buscag-aula-votes'||health.version!==2||!health.https)throw Error('La URL no identifica un servicio HTTPS compatible.');for(const p of projectPolls)await request('/api/admin/config',p,settings);await writeFile(join(dataDir,'voting-private.tmp'),JSON.stringify(settings),{mode:0o600});await rename(join(dataDir,'voting-private.tmp'),join(dataDir,'voting-private.json'));config=settings;await refresh();}
 async function control(id,patch){const data=await request('/api/admin/control',{id,...patch});validSnapshot(data);polls=data.polls;lastAt=Date.now();error='';onUpdate();}
 async function syncQuestions(projectPolls){if(!config)return;for(const p of projectPolls){const previous=polls?.find(r=>r.id===p.id);if(previous&&previous.question===p.question&&JSON.stringify(previous.options)===JSON.stringify(p.options))continue;await request('/api/admin/config',p);}await refresh();}
 const status=(admin=false)=>({configured:!!config,origin:config?.origin||'',connected:!!config&&!error&&Date.now()-lastAt<10000,lastAt,error,...(admin?{pairing:pairState}:{})});
 async function beginPair(projectPolls){
  if(pending)await cancelPair();
  const keys=generateKeyPairSync('rsa',{modulusLength:2048});
  const data=await request('/api/pair/start',{publicKey:keys.publicKey.export({format:'jwk'})},{origin:PUBLIC_ORIGIN});
  if(!/^[a-f0-9]{64}$/.test(data.id)||!/^[a-f0-9]{64}$/.test(data.pollToken)||!/^\d{6}$/.test(data.code)||data.authorizationUrl!==OWNER_ORIGIN+'/?id='+data.id||data.expiresAt<=Date.now()||data.expiresAt>Date.now()+310000)throw Error('Respuesta de conexión inválida.');
  pending={...data,privateKey:keys.privateKey,projectPolls};pairState={phase:'pending',code:data.code,url:data.authorizationUrl,expiresAt:data.expiresAt};onUpdate();return status(true);
 }
 async function cancelPair(){const previous=pending;pending=null;pairState={phase:'idle'};if(previous)try{await request('/api/pair/cancel',{id:previous.id,pollToken:previous.pollToken},{origin:PUBLIC_ORIGIN});}catch{}onUpdate();}
 async function pollPair(){if(!pending||pairBusy)return;const current=pending;if(current.expiresAt<=Date.now()){pending=null;pairState={phase:'expired',error:'El código venció. Pulsá Conectar encuestas otra vez.'};onUpdate();return;}pairBusy=true;
  try{const data=await request('/api/pair/poll',{id:current.id,pollToken:current.pollToken},{origin:PUBLIC_ORIGIN});if(pending!==current)return;if(data.status==='approved'){
   const key=privateDecrypt({key:current.privateKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},Buffer.from(data.ciphertext,'base64')).toString('utf8');if(!/^[a-f0-9]{64}$/.test(key))throw Error('Credencial inválida.');
   await configure(PUBLIC_ORIGIN,key,current.projectPolls);pending=null;pairState={phase:'connected'};onUpdate();
  }}catch{if(pending===current){pairState={...pairState,error:'No se pudo completar la conexión. Revisá Internet o iniciá otra conexión.'};onUpdate();}}finally{pairBusy=false;}
 }
 async function disconnect(){await cancelPair();if(config){for(const id of ['search','object'])await control(id,{open:false});await request('/api/device/revoke',{});}await unlink(join(dataDir,'voting-private.json')).catch(e=>{if(e.code!=='ENOENT')throw e;});config=null;polls=null;lastAt=0;error='';pairState={phase:'idle'};onUpdate();}
 timer=setInterval(()=>{pollPair();refresh();},1500);timer.unref();if(config)await refresh();
 return{beginPair,cancelPair,disconnect,configure,refresh,control,syncQuestions,status,getPolls:(admin=false)=>polls?.map(p=>({...p,counts:admin||p.reveal?p.counts:null})),close:()=>{closed=true;clearInterval(timer);}};
}
