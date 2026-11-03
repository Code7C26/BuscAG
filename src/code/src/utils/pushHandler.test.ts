import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPushHandler, validPushEndpoint, type PushDependencies } from '../../supabase/functions/send-push/handler';
const webhookSecret='synthetic-push-secret-at-least-32-characters';
const id='10000000-0000-4000-8000-000000000001';
const payload={type:'INSERT',table:'notifications',schema:'public',record:{id,user_id:'FORGED',title:'FORGED'}};
const request=(data:unknown=payload,secret=webhookSecret)=>new Request('https://push.invalid',{method:'POST',headers:{'x-push-webhook-secret':secret},body:JSON.stringify(data)});
const setup=()=>{
  const calls:{recipient?:string;body?:string;removed?:string;sent:number;logs:string[]}={sent:0,logs:[]};
  const deps:PushDependencies={env:()=> webhookSecret,log:event=>calls.logs.push(event),configure:()=>{},
    backend:()=>({notice:async()=>({id,user_id:'REAL',title:'Real',message:'Real message'}),
      subscriptions:async user=>{calls.recipient=user;return [{endpoint:'https://fcm.googleapis.com/send/test',p256dh:'synthetic',auth:'synthetic'}];},
      removeExpired:async endpoint=>{calls.removed=endpoint;}}),send:async(_sub,body)=>{calls.sent++;calls.body=body;}};
  return {deps,calls};
};
test('push rejects arbitrary/private endpoints, URL credentials and provider lookalikes',()=>{
  for(const endpoint of ['http://fcm.googleapis.com/x','https://127.0.0.1/x','https://fcm.googleapis.com.evil.invalid/x','https://user:pass@fcm.googleapis.com/x','https://fcm.googleapis.com:444/x'])assert.equal(validPushEndpoint(endpoint),false);
  for(const endpoint of ['https://fcm.googleapis.com/x','https://updates.push.services.mozilla.com/x','https://web.push.apple.com/x','https://a.notify.windows.com/x'])assert.equal(validPushEndpoint(endpoint),true);
});
test('push authenticates before parsing or contacting the backend',async()=>{
  const {deps,calls}=setup();assert.equal((await createPushHandler(deps)(request({},'wrong'))).status,401);assert.equal(calls.sent,0);
  assert.equal((await createPushHandler(deps)(request({...payload,schema:'private'}))).status,400);
  assert.equal((await createPushHandler(deps)(request('x'.repeat(20_000)))).status,413);
});
test('push uses stored notification, not forged content or recipient from webhook',async()=>{
  const {deps,calls}=setup();const result=await createPushHandler(deps)(request());assert.equal(result.status,200);
  assert.equal(calls.recipient,'REAL');assert.equal(JSON.parse(calls.body!).title,'Real');assert.equal(calls.sent,1);
});
test('push removes only expired endpoints and never logs payloads or request error objects',async()=>{
  const {deps,calls}=setup();deps.send=async()=>{throw {statusCode:410,body:'SECRET'};};
  assert.equal((await createPushHandler(deps)(request())).status,200);assert.ok(calls.removed);assert.ok(!calls.logs.join('').includes('SECRET'));
});
test('push concurrency is bounded and untrusted stored endpoints are never fetched',async()=>{
  const {deps,calls}=setup();const original=deps.backend;let inFlight=0,max=0;
  deps.backend=(url,key)=>({...original(url,key),subscriptions:async()=>Array.from({length:20},(_,i)=>({endpoint:i===0?'https://internal.invalid/x':'https://fcm.googleapis.com/'+i,p256dh:'x',auth:'x'}))});
  deps.send=async()=>{inFlight++;max=Math.max(max,inFlight);await new Promise(r=>setTimeout(r,1));inFlight--;calls.sent++;};
  const result=await createPushHandler(deps)(request());assert.equal(result.status,502);assert.equal(calls.sent,19);assert.ok(max<=4);
});

test('push rejects weak configuration and oversized credentials before contacting the backend',async()=>{
  const {deps,calls}=setup();const original=deps.env;
  deps.env=name=>name==='PUSH_WEBHOOK_SECRET'?'short':original(name);
  assert.equal((await createPushHandler(deps)(request())).status,503);
  deps.env=original;
  assert.equal((await createPushHandler(deps)(request(payload,'x'.repeat(513)))).status,401);
  assert.equal(calls.sent,0);
});
