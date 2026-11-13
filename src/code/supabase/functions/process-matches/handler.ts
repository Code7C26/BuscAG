import {sameServerSecret,usableServerSecret} from '../_shared/serverSecret.ts';
type Dependencies = {
  env:(name:string)=>string|undefined;
  run:(url:string,key:string,limit:number)=>Promise<unknown>;
  log:(event:string)=>void;
};
function validResult(value:unknown):value is {batches:number;notifications:number;failures:number;busy:boolean;enabled:boolean} {
  if(!value||typeof value!=='object') return false;
  const row=value as Record<string,unknown>;
  return ['batches','notifications','failures'].every(key=>Number.isSafeInteger(row[key])&&(row[key] as number)>=0)
    && (row.batches as number)<=5 && (row.notifications as number)<=2000 && (row.failures as number)<=5
    && typeof row.busy==='boolean' && typeof row.enabled==='boolean';
}
export function createMatchWorker(deps:Dependencies) {
  return async (request:Request):Promise<Response>=>{
    const reply=(status:number,body:unknown)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
    if(request.method!=='POST') return reply(405,{error:'method_not_allowed'});
    const secret=deps.env('MATCH_WORKER_SECRET');
    const url=deps.env('SUPABASE_URL');const key=deps.env('SUPABASE_SERVICE_ROLE_KEY');
    if(!usableServerSecret(secret)||!url||!key) return reply(503,{error:'worker_not_configured'});
    const authorization=request.headers.get('Authorization')||'';
    if(authorization.length>520||!authorization.startsWith('Bearer ')||!(await sameServerSecret(authorization.slice(7),secret))) return reply(401,{error:'unauthorized'});
    try {
      // Fixed bounded batches: request content cannot choose SQL, recipients or batch size.
      const result=await deps.run(url,key,5);
      if(!validResult(result)) throw new Error('Invalid worker response');
      if(result.failures>0) deps.log('match_jobs_deferred');
      // Return only the contract, never arbitrary data from an unexpected RPC.
      return reply(200,{batches:result.batches,notifications:result.notifications,
        failures:result.failures,busy:result.busy,enabled:result.enabled});
    } catch {
      deps.log('match_batch_failed');
      return reply(503,{error:'batch_failed_retry_safe'});
    }
  };
}
