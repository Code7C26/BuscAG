// Owns one pg client. Logs only fixed phase/status tokens, never driver payloads.
import {stageFailure,addSecondaryFailure,publicError} from './staging-tls.mjs';
export async function withStagingSession(client,work,{onProgress=()=>{},closeTimeoutMs=5000}={}){
 const state={stage:'tcp',lastCompleted:'configuration',queryNumber:0};
 let firstAsyncError,closingAsyncError,result,failure;
 const progress=(stage,status)=>onProgress({stage,status});
 const complete=stage=>{state.lastCompleted=stage;progress(stage,'ok');};
 const fail=error=>stageFailure(error,{...state});
 const connection=client.connection;
 connection?.once('connect',()=>{complete('tcp');state.stage='tls';progress('tls','start');});
 // pg's sslconnect means TLSSocket allocated, NOT TLS handshake verified.
 connection?.once('sslconnect',()=>{
  connection.stream?.once('secureConnect',()=>{
   if(connection.stream.authorized===true){complete('tls');state.stage='authentication';progress('authentication','start');}
  });
 });
 // Prevent uncaught idle error events from printing pg messages/stacks.
 client.on('error',error=>{if(state.stage==='closing')closingAsyncError??=fail(error);else firstAsyncError??=fail(error);});
 const db={query:async(...args)=>{
  if(firstAsyncError)throw firstAsyncError;
  state.stage='queries';state.queryNumber++;
  try{const answer=await client.query(...args);completeQuery();if(firstAsyncError)throw firstAsyncError;return answer;}
  catch(error){throw fail(error);}
 }};
 const completeQuery=()=>{state.lastCompleted='queries';};
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
 try{result=await work();}catch(error){failure=stageFailure(error,{stage:'queries',lastCompleted:'authentication'});}
 try{await db.query('rollback');}catch(error){
  const rollback=stageFailure(error,{stage:'queries',lastCompleted:'authentication'});
  failure=failure?addSecondaryFailure(failure,rollback):rollback;
 }
 if(failure)throw failure;
 return result;
}
