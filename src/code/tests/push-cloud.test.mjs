import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {cloudConfiguration,preparePushCloud} from '../scripts/prepare-push-cloud.mjs';
const ref='yiarlhpbgkofhhipkfha',project='buscag-push-staging-test';
const args=output=>['--project-ref',ref,'--cloud-project',project,'--output',output];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
test('cloud preparation rejects production, shared Firebase project, injection, alternate destinations and duplicate options',()=>{
 const good=args(resolve(tmpdir(),'unused-context'));assert.equal(cloudConfiguration(good).project,project);
 for(const change of [a=>{a[1]='hczcqtodcnurdrroczle';},a=>{a[3]='buscag-2677c';},a=>{a[3]="buscag-push-staging-';x";},a=>a.push('--url','https://other.invalid'),a=>a.push('--cloud-project',project),a=>a.push('--secret-version','latest'),a=>a.push('--deploy','true'),a=>{a[5]='relative';}]){
  const a=[...good];change(a);assert.throws(()=>cloudConfiguration(a));
 }
});
test('prepared context contains only allowlisted worker sources, no ambient secrets or frontend, and immutable source hashes',async()=>{
 const temp=await mkdtemp(resolve(tmpdir(),'buscag-cloud-test-')),output=resolve(temp,'new');
 const old=process.env.BUSCAG_STAGING_PUSH_WEBHOOK_SECRET;process.env.BUSCAG_STAGING_PUSH_WEBHOOK_SECRET='SENTINEL_PRIVATE_MUST_NOT_COPY';
 try{
  const plan=await preparePushCloud(cloudConfiguration(args(output)));
  assert.equal(plan.authorization_to_deploy,false);assert.equal(plan.runtime_target,'https://yiarlhpbgkofhhipkfha.supabase.co/functions/v1/send-push');
  assert.match(plan.scheduler_target,/PRIVATE_CLOUD_RUN_SERVICE_URL/);
  assert.match(plan.scheduler_auth,/OIDC/);assert.equal(plan.schedule,'* * * * *');assert.equal(plan.service_settings.allow_unauthenticated,false);assert.equal(plan.service_settings.invoker_iam_check,true);assert.equal(plan.service_settings.min_instances,0);
  assert.deepEqual((await readdir(resolve(output,'context'))).sort(),['.dockerignore','.gcloudignore','Dockerfile','lib','scripts']);
  assert.deepEqual(await readdir(resolve(output,'context/scripts')),['push-cloud-service.mjs','staging-push-worker.mjs']);
  for(const f of plan.files){const bytes=await readFile(resolve(output,'context',f.path));assert.equal(hash(bytes),f.sha256);assert.ok(!bytes.includes('SENTINEL_PRIVATE'));}
  const build=JSON.parse(await readFile(resolve(output,'cloudbuild.review.json'),'utf8'));
  assert.equal(build.serviceAccount,`projects/${project}/serviceAccounts/push-build@${project}.iam.gserviceaccount.com`);
  assert.equal(build.steps.length,1);assert.equal(build.steps[0].args.includes('--platform=linux/amd64'),true);
  assert.ok(!JSON.stringify({plan,build}).includes('SENTINEL_PRIVATE'));
  const dockerfile=await readFile(resolve(output,'context/Dockerfile'),'utf8');assert.match(dockerfile,/FROM node:24-bookworm-slim@sha256:[a-f0-9]{64}/);assert.match(dockerfile,/USER node/);assert.doesNotMatch(dockerfile,/COPY \.|ARG .*SECRET|npm (install|ci)|EXPOSE/);
  await assert.rejects(preparePushCloud(cloudConfiguration(args(output))),e=>e.code==='EEXIST');
  await assert.rejects(preparePushCloud({...cloudConfiguration(args(resolve(temp,'bad'))),project:'buscag-2677c'}));
 }finally{if(old===undefined)delete process.env.BUSCAG_STAGING_PUSH_WEBHOOK_SECRET;else process.env.BUSCAG_STAGING_PUSH_WEBHOOK_SECRET=old;await rm(temp,{recursive:true,force:true});}
});
test('build contexts cannot be created in the repository, including a dot-dot-prefixed directory',async()=>{
 const repo=fileURLToPath(new URL('../../..',import.meta.url));
 const hidden=await mkdtemp(resolve(repo,'..cloud-test-'));
 try{await assert.rejects(preparePushCloud(cloudConfiguration(args(resolve(hidden,'context')))),/fuera del repositorio/);}
 finally{await rm(hidden,{recursive:true,force:true});}
});

import {createPushCloudService} from '../scripts/push-cloud-service.mjs';
async function service(drainer,fn,log=()=>{}){
 const server=createPushCloudService('synthetic-test-secret-no-real-capability',drainer,log);
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 try{await fn(`http://127.0.0.1:${server.address().port}`);}finally{await new Promise(resolve=>{server.closeAllConnections();server.close(resolve);});}
}
const counters={sent:1,expired:0,failed:0,skipped:0};
test('private service accepts only its drain route, caps body and never forwards request-provided URLs or credentials',async()=>{
 let calls=0;
 await service(async(...args)=>{calls++;assert.deepEqual(args,['synthetic-test-secret-no-real-capability']);return counters;},async url=>{
  assert.equal((await fetch(url+'/health')).status,204);
  assert.equal((await fetch(url+'/drain')).status,405);
  assert.equal((await fetch(url+'/unknown',{method:'POST'})).status,404);
  assert.equal((await fetch(url+'/drain',{method:'POST',body:'x'.repeat(1025)})).status,413);
  assert.equal(calls,0);
  const r=await fetch(url+'/drain',{method:'POST',body:JSON.stringify({url:'https://production.invalid',secret:'SENTINEL_NEVER_FORWARD'})});
  assert.equal(r.status,200);assert.deepEqual(await r.json(),counters);assert.equal(calls,1);
 });
});
test('concurrent requests cannot overlap drains; failure responses and logs exclude upstream private errors',async()=>{
 let finish,start;const started=new Promise(resolve=>start=resolve),pending=new Promise(resolve=>finish=resolve);const logs=[];let fail=false;
 await service(async()=>{if(fail)throw Error('SENTINEL_PRIVATE_UPSTREAM');start();await pending;return counters;},async url=>{
  const first=fetch(url+'/drain',{method:'POST'});await started;
  assert.equal((await fetch(url+'/drain',{method:'POST'})).status,429);
  finish();assert.equal((await first).status,200);
  fail=true;const response=await fetch(url+'/drain',{method:'POST'});assert.equal(response.status,503);
  assert.ok(!(await response.text()).includes('SENTINEL'));
  assert.deepEqual(logs,['staging_push_drain_failed']);
  fail=false;assert.equal((await fetch(url+'/drain',{method:'POST'})).status,200);
 },event=>logs.push(event));
});
