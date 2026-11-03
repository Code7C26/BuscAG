import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatchWorker} from '../../supabase/functions/process-matches/handler';
import {needsLegacyMatchNotice} from '../../lib/matchDelivery';
const secret='synthetic-worker-secret-at-least-32-characters';
function fixture(){
  const calls:unknown[]=[];const logs:string[]=[];
  const settings:Record<string,string>={MATCH_WORKER_SECRET:secret,SUPABASE_URL:'https://synthetic.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'synthetic-key'};
  const handler=createMatchWorker({env:name=>settings[name],run:async(...args)=>{calls.push(args);return {batches:1,notifications:2};},log:event=>logs.push(event)});
  return {handler,calls,logs,settings};
}
test('worker requires configured independent secret and rejects public callers before backend access',async()=>{
  const f=fixture();
  for(const authorization of ['', 'Bearer synthetic-key','Bearer '+secret+'x']){
    const r=await f.handler(new Request('https://worker.invalid',{method:'POST',headers:{Authorization:authorization}}));assert.equal(r.status,401);
  }
  assert.equal((await f.handler(new Request('https://worker.invalid'))).status,405);
  delete f.settings.MATCH_WORKER_SECRET;
  assert.equal((await f.handler(new Request('https://worker.invalid',{method:'POST'}))).status,503);
  assert.equal(f.calls.length,0);
});
test('authorized worker ignores caller payload and executes a fixed bounded batch',async()=>{
  const f=fixture();const r=await f.handler(new Request('https://worker.invalid',{method:'POST',headers:{Authorization:'Bearer '+secret},body:JSON.stringify({limit:1e9,user_id:'forged',sql:'forged'})}));
  assert.equal(r.status,200);assert.deepEqual(f.calls,[[f.settings.SUPABASE_URL,'synthetic-key',5]]);
  assert.equal(r.headers.get('Cache-Control'),'no-store');assert.deepEqual(await r.json(),{batches:1,notifications:2});
});
test('worker failures remain retryable and never return or log private errors',async()=>{
  const logs:string[]=[];
  const handler=createMatchWorker({env:name=>({MATCH_WORKER_SECRET:secret,SUPABASE_URL:'url',SUPABASE_SERVICE_ROLE_KEY:'private'}[name]),run:async()=>{throw new Error('private');},log:event=>logs.push(event)});
  const r=await handler(new Request('https://worker.invalid',{method:'POST',headers:{Authorization:'Bearer '+secret}}));
  assert.equal(r.status,503);assert.equal((await r.text()).includes('private'),false);assert.deepEqual(logs,['match_batch_failed']);
});
test('client creates legacy match notices only when backend capability is definitively missing',async()=>{
  assert.equal(await needsLegacyMatchNotice(async()=>({data:null,error:{code:'PGRST202'}})),true);
  assert.equal(await needsLegacyMatchNotice(async()=>({data:{queued_match_notifications:true},error:null})),false);
  assert.equal(await needsLegacyMatchNotice(async()=>({data:null,error:{code:'500'}})),false);
  assert.equal(await needsLegacyMatchNotice(async()=>{throw new Error('network');}),false);
});
