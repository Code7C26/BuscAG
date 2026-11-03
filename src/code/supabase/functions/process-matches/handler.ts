type Dependencies = {
  env:(name:string)=>string|undefined;
  run:(url:string,key:string,limit:number)=>Promise<unknown>;
  log:(event:string)=>void;
};
async function sameSecret(actual:string,expected:string) {
  const encoder=new TextEncoder();
  const [a,b]=await Promise.all([actual,expected].map(value=>crypto.subtle.digest('SHA-256',encoder.encode(value))));
  const left=new Uint8Array(a);const right=new Uint8Array(b);let difference=0;
  for(let i=0;i<left.length;i++) difference|=left[i]^right[i];
  return difference===0;
}
export function createMatchWorker(deps:Dependencies) {
  return async (request:Request):Promise<Response>=>{
    const reply=(status:number,body:unknown)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
    if(request.method!=='POST') return reply(405,{error:'method_not_allowed'});
    const secret=deps.env('MATCH_WORKER_SECRET');
    const url=deps.env('SUPABASE_URL');const key=deps.env('SUPABASE_SERVICE_ROLE_KEY');
    if(!secret||secret.length<32||secret.length>512||!url||!key) return reply(503,{error:'worker_not_configured'});
    const authorization=request.headers.get('Authorization')||'';
    if(authorization.length>520||!authorization.startsWith('Bearer ')||!(await sameSecret(authorization.slice(7),secret))) return reply(401,{error:'unauthorized'});
    try {
      // Fixed bounded batches: request content cannot choose SQL, recipients or batch size.
      const result=await deps.run(url,key,5);
      return reply(200,result);
    } catch {
      deps.log('match_batch_failed');
      return reply(503,{error:'batch_failed_retry_safe'});
    }
  };
}
