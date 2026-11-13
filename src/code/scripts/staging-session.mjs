// Owns one pg client. Logs only fixed phase/status tokens, never driver payloads.
import {stageFailure,addSecondaryFailure,publicError,stagingSteps,stagingStep} from './staging-tls.mjs';
export async function withStagingSession(client,work,{onProgress=()=>{},closeTimeoutMs=5000}={}){
 const state={stage:'tcp',lastCompleted:'configuration',queryNumber:0,lastQueryNumber:0,activeQuery:false,step:undefined};
 let firstAsyncError,closingAsyncError,result,failure;
 const progress=(stage,status,extra={})=>onProgress({stage,status,...extra});
 const complete=stage=>{state.lastCompleted=stage;progress(stage,'ok');};
 const fail=(error,origin=state.stage==='queries'?'local':'connection')=>stageFailure(error,{...state,origin,
  queryNumber:origin==='query'&&state.activeQuery?state.queryNumber:undefined});
 const connection=client.connection;
 connection?.once('connect',()=>{complete('tcp');state.stage='tls';progress('tls','start');});
 // pg's sslconnect means TLSSocket allocated, NOT TLS handshake verified.
 connection?.once('sslconnect',()=>{
  connection.stream?.once('secureConnect',()=>{
   if(connection.stream.authorized===true){complete('tls');state.stage='authentication';progress('authentication','start');}
  });
 });
 // Prevent uncaught idle error events from printing pg messages/stacks.
 client.on('error',error=>{if(state.stage==='closing')closingAsyncError??=fail(error);else firstAsyncError??=fail(error,state.activeQuery?'query':'connection');});
 const db={captureFailure:error=>fail(error),step:async(id,operation)=>{
  if(!Object.hasOwn(stagingSteps,id))throw publicError('BUSCAG_DIAGNOSTIC_STEP','Paso de diagnóstico local no registrado.');
  const previous=state.step;state.step=id;progress('queries','start',{origin:'local',step:id,lastQueryNumber:state.lastQueryNumber});
  try{const result=await operation();progress('queries','ok',{origin:'local',step:id,lastQueryNumber:state.lastQueryNumber});return result;}
  catch(error){throw fail(error,'local');}finally{state.step=previous;}
 },query:async(...args)=>{
  if(firstAsyncError)throw firstAsyncError;
  state.stage='queries';state.queryNumber++;state.activeQuery=true;
  progress('queries','start',{origin:'query',step:state.step,queryNumber:state.queryNumber});
  try{const answer=await client.query(...args);completeQuery();if(firstAsyncError)throw firstAsyncError;
   progress('queries','ok',{origin:'query',step:state.step,queryNumber:state.queryNumber});return answer;}
  catch(error){throw fail(error,'query');}finally{state.activeQuery=false;}
 }};
 const completeQuery=()=>{state.lastCompleted='queries';state.lastQueryNumber=state.queryNumber;};
 try{
  progress('tcp','start');await client.connect();
  if(firstAsyncError)throw firstAsyncError;
  complete('authentication');state.stage='queries';progress('queries','start');
  result=await work(db);if(firstAsyncError)throw firstAsyncError;
  complete('queries');
 }catch(error){failure=fail(error);}
 // Capture the primary failure BEFORE changing phase or awaiting cleanup.
 state.stage='closing';progress('closing','start');
 let timer;
 try{
  await Promise.race([Promise.resolve().then(()=>client.end()),new Promise((_,reject)=>{
   timer=setTimeout(()=>reject(publicError('BUSCAG_CLOSE_TIMEOUT','El cierre no terminó a tiempo. El trabajo principal puede haber terminado; verifica con un diagnóstico de lectura antes de repetir operaciones.')),closeTimeoutMs);
  })]);
  if(closingAsyncError)failure=failure?addSecondaryFailure(failure,closingAsyncError):closingAsyncError;
  else complete('closing');
 }catch(error){
  const closing=fail(error);
  failure=failure?addSecondaryFailure(failure,closing):closing;
  try{connection?.stream?.destroy();}catch{/* error remains captured, no payload logging */}
 }finally{clearTimeout(timer);}
 if(failure)throw failure;
 return result;
}
export async function withStagingRollback(db,work){
 let result,failure;
 try{result=await work();}catch(error){failure=db.captureFailure?db.captureFailure(error):stageFailure(error,{stage:'queries'});}
 try{await stagingStep(db,'transaction.rollback',()=>db.query('rollback'));}catch(error){
  const rollback=stageFailure(error,{stage:'queries',step:'transaction.rollback'});
  failure=failure?addSecondaryFailure(failure,rollback):rollback;
 }
 if(failure)throw failure;
 return result;
}
