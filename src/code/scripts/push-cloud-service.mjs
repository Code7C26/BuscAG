// Private Cloud Run adapter. IAM authenticates invocations at the managed ingress.
// Never deploy with unauthenticated access. Request input cannot select a URL or notice.
import {createServer} from 'node:http';
import {pathToFileURL} from 'node:url';
import {configuration,drain} from './staging-push-worker.mjs';
const respond=(response,status,value)=>{
 response.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});
 response.end(JSON.stringify(value));
};
export function createPushCloudService(secret,drainer=drain,log=event=>console.error(event)){
 let busy=false;
 return createServer(async(request,response)=>{
  if(request.method==='GET'&&request.url==='/health'){response.writeHead(204);response.end();return;}
  if(request.url!=='/drain'){respond(response,404,{error:'Not found.'});return;}
  if(request.method!=='POST'){respond(response,405,{error:'POST required.'});return;}
  if(busy){respond(response,429,{error:'Drain in progress.'});return;}
  // Cap even authenticated input. Body is never forwarded to Supabase.
  let bytes=0;
  try{for await(const chunk of request){bytes+=chunk.length;if(bytes>1024){respond(response,413,{error:'Body too large.'});return;}}}
  catch{respond(response,400,{error:'Invalid body.'});return;}
  if(busy){respond(response,429,{error:'Drain in progress.'});return;}
  busy=true;
  try{const result=await drainer(secret);respond(response,200,result);}
  catch{log('staging_push_drain_failed');respond(response,503,{error:'Staging drain failed; inspect configuration and counters.'});}
  finally{busy=false;}
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const {secret}=configuration(process.env,['--once']);
  const port=Number(process.env.PORT??8080);if(!Number.isInteger(port)||port<1||port>65535)throw Error();
  const server=createPushCloudService(secret);server.listen(port,'0.0.0.0');
  process.on('SIGTERM',()=>server.close());
 }catch{console.error('Private staging push service configuration invalid.');process.exitCode=1;}
}
