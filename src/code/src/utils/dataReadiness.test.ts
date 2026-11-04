import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readAll } from '../../lib/readAll';
import { createRefreshQueue } from './refreshQueue';
import { authRedirect, authCallbackError } from '../../lib/authFlow';

test('pagination follows actual page size below API max_rows without losing records', async () => {
  const source=Array.from({length:237},(_,id)=>({id})); const offsets:number[]=[];
  const rows=await readAll(async (from,to)=>{offsets.push(from);return {data:source.slice(from,Math.min(to+1,from+37)),error:null,count:source.length};});
  assert.deepEqual(rows,source);assert.deepEqual(offsets,[0,37,74,111,148,185,222]);
});
test('pagination without a count continues until empty and fails atomically on error/session change', async()=>{
  assert.deepEqual(await readAll(async from=>({data:from<3?[from]:[],error:null})),[0,1,2]);
  await assert.rejects(readAll(async()=>({data:null,error:new Error('offline')})),/offline/);
  let active=true;await assert.rejects(readAll(async()=>{active=false;return {data:[1],error:null};},()=>active),/sesión/);
});
test('refresh requests coalesce by resource and never overlap',async()=>{
  let release!:()=>void;let concurrent=0,max=0;const batches:string[][]=[];
  const gate=new Promise<void>(resolve=>{release=resolve;});
  const queue=createRefreshQueue<string>(async keys=>{concurrent++;max=Math.max(max,concurrent);batches.push([...keys]);if(batches.length===1)await gate;concurrent--;});
  const one=queue.request('items');queue.request('messages');await Promise.resolve();
  queue.request('notifications');queue.request('notifications');release();await one;
  assert.equal(max,1);assert.deepEqual(batches,[['items','messages'],['notifications']]);
});
test('refresh queue can be retried after a rejected read',async()=>{
  let calls=0;const queue=createRefreshQueue<string>(async()=>{if(++calls===1)throw Error('offline');});
  await assert.rejects(queue.request('items'),/offline/);await queue.request('items');assert.equal(calls,2);
});
test('auth redirect uses a fixed application path and only safe protocols',()=>{
  assert.equal(authRedirect('https://buscag.invalid/path',true),'https://buscag.invalid/?auth=recovery');
  assert.throws(()=>authRedirect('javascript:alert(1)'),/URL|HTTPS/);
  assert.throws(()=>authRedirect('http://public.invalid'),/HTTPS/);
  assert.equal(authRedirect('http://localhost:3000'),'http://localhost:3000/');
  assert.equal(authCallbackError('https://app.invalid/#error_code=otp_expired&error_description=SECRET').includes('SECRET'),false);
});

test('production configuration rejects secret keys, malformed URLs and non-HTTPS origins without exposing values',async()=>{
  const {validateEnvironment}=await import('../../lib/environment');
  const base={VITE_SUPABASE_URL:'https://project.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_synthetic'};
  assert.equal(validateEnvironment(base,true),null);
  assert.match(validateEnvironment({...base,VITE_SUPABASE_PUBLISHABLE_KEY:'sb_secret_DO_NOT_PRINT'},true)!,/secreta/);
  assert.ok(!validateEnvironment({...base,VITE_SUPABASE_URL:'https://user:DO_NOT_PRINT@project.supabase.co'},true)!.includes('DO_NOT_PRINT'));
  assert.ok(validateEnvironment({...base,VITE_SUPABASE_URL:'https://project.supabase.co/rest/v1'},true));
  assert.ok(validateEnvironment({...base,VITE_APP_URL:'http://public.invalid'},true));
  assert.equal(validateEnvironment({...base,VITE_SUPABASE_URL:'http://localhost:54321'},false),null);
  const token=(role:string)=>'synthetic.'+btoa(JSON.stringify({role}))+'.synthetic';
  assert.equal(validateEnvironment({...base,VITE_SUPABASE_PUBLISHABLE_KEY:token('anon')},true),null);
  assert.ok(validateEnvironment({...base,VITE_SUPABASE_PUBLISHABLE_KEY:token('service_role')},true));
});
test('auth callback cleanup removes tokens/codes only after SDK consumption without damaging unrelated routes',async()=>{
  const {cleanAuthCallback}=await import('../../lib/authFlow');
  assert.equal(cleanAuthCallback('https://app.invalid/?code=secret&auth=recovery#access_token=secret&refresh_token=secret'),'https://app.invalid/?auth=recovery');
  assert.equal(cleanAuthCallback('https://app.invalid/#ordinary-anchor'),'https://app.invalid/#ordinary-anchor');
});

test('Firebase configuration preserves SPA routing and distinguishes hashed assets from worker/HTML caching',async()=>{
  const {readFile}=await import('node:fs/promises');
  const config=JSON.parse(await readFile(new URL('../../firebase.json',import.meta.url),'utf8'));
  assert.equal(config.hosting.public,'dist');assert.ok(config.hosting.rewrites.some((r:{source:string;destination:string})=>r.source==='**'&&r.destination==='/index.html'));
  const value=(source:string,key:string)=>config.hosting.headers.find((r:{source:string})=>r.source===source)?.headers.find((h:{key:string})=>h.key===key)?.value;
  assert.equal(value('/sw.js','Cache-Control'),'no-cache');assert.match(value('/assets/**','Cache-Control'),/immutable/);
  assert.equal(value('**','Referrer-Policy'),'strict-origin-when-cross-origin');
});

test('Vite configuration rejects server-only variable names without revealing their values',async()=>{
  const {validateEnvironment}=await import('../../lib/environment');
  const base={VITE_SUPABASE_URL:'https://project.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_synthetic'};
  for(const name of ['VITE_SUPABASE_SERVICE_ROLE_KEY','VITE_PUSH_VAPID_PRIVATE_KEY','VITE_MATCH_WORKER_SECRET','VITE_DATABASE_PASSWORD']){
    const error=validateEnvironment({...base,[name]:'DO_NOT_PRINT'},true);
    assert.match(error!,/privada/);assert.equal(error!.includes('DO_NOT_PRINT'),false);
  }
  assert.equal(validateEnvironment({...base,VITE_VAPID_PUBLIC_KEY:'synthetic-public',SUPABASE_SERVICE_ROLE_KEY:'server-only'},true),null);
});
