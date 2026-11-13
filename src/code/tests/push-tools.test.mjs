import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createECDH} from 'node:crypto';
import {configuration,drain} from '../scripts/staging-push-worker.mjs';
import {createKeys} from '../scripts/create-staging-push-keys.mjs';
const secret='synthetic-test-push-secret-not-real-123456';
test('push runner pins staging, disallows redirects and returns counters only',async()=>{
 const config=configuration({BUSCAG_STAGING_PUSH_WEBHOOK_SECRET:secret},['--once']);assert.equal(config.watch,false);
 const result=await drain(secret,async(url,options)=>{
  assert.equal(url,'https://yiarlhpbgkofhhipkfha.supabase.co/functions/v1/send-push');assert.equal(options.redirect,'error');
  assert.equal(options.headers['x-push-webhook-secret'],secret);assert.deepEqual(JSON.parse(options.body),{type:'DRAIN'});
  return Response.json({sent:1,expired:0,failed:0,skipped:2,private:'must not escape'});
 });assert.deepEqual(result,{sent:1,expired:0,failed:0,skipped:2});
});
test('push runner rejects unsafe configuration and suppresses provider response content',async()=>{
 for(const args of [[],['--production'],['--watch','--forever']])assert.throws(()=>configuration({BUSCAG_STAGING_PUSH_WEBHOOK_SECRET:secret},args));
 assert.throws(()=>configuration({},['--once']));assert.throws(()=>configuration({BUSCAG_STAGING_PUSH_WEBHOOK_SECRET:secret,VITE_PUSH_PRIVATE_KEY:'private'},['--once']));
 await assert.rejects(drain(secret,async()=>new Response('SECRET',{status:401})),error=>!error.message.includes('SECRET'));
 await assert.rejects(drain(secret,async()=>Response.json({sent:-1})),/incompatible/);
});
test('local VAPID generation produces a matched P-256 pair and independent secret without network',()=>{
 const keys=createKeys('mailto:synthetic@example.invalid');const ecdh=createECDH('prime256v1');
 ecdh.setPrivateKey(Buffer.from(keys.PUSH_VAPID_PRIVATE_KEY,'base64url'));
 assert.equal(ecdh.getPublicKey().toString('base64url'),keys.PUSH_VAPID_PUBLIC_KEY);
 assert.equal(Buffer.from(keys.PUSH_VAPID_PUBLIC_KEY,'base64url').length,65);assert.equal(keys.PUSH_WEBHOOK_SECRET.length,64);
 assert.throws(()=>createKeys('mailto:x@example.invalid\nINJECT=x'));
});
