// Server-only scheduler entry point. No alternate URL/ref/redirect is accepted.
import {pathToFileURL} from 'node:url';
import {setTimeout as pause} from 'node:timers/promises';
import {STAGING_URL} from '../lib/stagingEnvironment.mjs';
export function configuration(env,args){
 if(args.length!==1||!['--once','--watch'].includes(args[0]))throw Error('Usar --once o --watch; sólo Prueba.');
 const secret=env.BUSCAG_STAGING_PUSH_WEBHOOK_SECRET;
 if(typeof secret!=='string'||secret.length<32||secret.length>512||/[\r\n]/.test(secret))throw Error('Falta el secreto privado del envío de Prueba.');
 if(Object.keys(env).some(name=>/^VITE_.*(PRIVATE|WEBHOOK|SERVICE_ROLE)/.test(name)&&env[name]))throw Error('Retirar secretos de VITE_*.');
 return {secret,watch:args[0]==='--watch'};
}
export async function drain(secret,fetcher=fetch){
 let response;try{response=await fetcher(STAGING_URL+'/functions/v1/send-push',{
  method:'POST',headers:{'Content-Type':'application/json','x-push-webhook-secret':secret},body:JSON.stringify({type:'DRAIN'}),redirect:'error',signal:AbortSignal.timeout(55000)
 });}catch{throw Error('No se pudo contactar al envío de Prueba. Revisar red/TLS.');}
 if(!response.ok)throw Error(`Envío rechazado (HTTP ${response.status}). Revisar secretos, SQL y función; no se muestran respuestas privadas.`);
 let data;try{data=await response.json();}catch{throw Error('Respuesta push no reconocida.');}
 if(!data||!['sent','expired','failed','skipped'].every(name=>Number.isSafeInteger(data[name])&&data[name]>=0))throw Error('Contrato push incompatible.');
 return Object.fromEntries(['sent','expired','failed','skipped'].map(name=>[name,data[name]]));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const config=configuration(process.env,process.argv.slice(2)),until=Date.now()+(config.watch?600000:0);
  console.log('Push REAL de Prueba. Sólo después de autorización. Watch termina en diez minutos.');
  do{try{console.log(JSON.stringify(await drain(config.secret)));}catch(error){console.error(error.message);if(!config.watch)throw Error('No verificado');}
   if(!config.watch)break;await pause(10000);
  }while(Date.now()<until);
 }catch{console.error('Push de Prueba NO verificado. No se imprimen secretos, endpoints ni avisos.');process.exitCode=1;}
}
