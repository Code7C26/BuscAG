import test from 'node:test';
import assert from 'node:assert/strict';
import {STAGING_REF,STAGING_URL,STAGING_APP_URL,STAGING_CSP,stagingEnvironment,validateStagingEnvironment} from '../lib/stagingEnvironment.mjs';
import {stagingProcessEnvironment} from '../scripts/run-staging.mjs';
import {checkStagingPublic} from '../scripts/check-staging-public.mjs';
const publicKey='sb_publishable_synthetic';
const token=(role:string,ref:string)=>'synthetic.'+btoa(JSON.stringify({role,ref}))+'.signature';
test('staging launcher ignores ambient production variables, never mutates them and rejects private/cross-project keys',()=>{
  const ambient={VITE_SUPABASE_URL:'https://production.invalid',VITE_APP_URL:'https://published.invalid',VITE_OTHER_SECRET:'private',BUSCAG_STAGING_DATABASE_URL:'private',BUSCAG_STAGING_PUBLISHABLE_KEY:publicKey};
  const result:Record<string,unknown>=stagingProcessEnvironment(ambient);
  assert.equal(result.VITE_SUPABASE_URL,STAGING_URL);assert.equal(result.VITE_APP_URL,STAGING_APP_URL);
  assert.equal(result.VITE_OTHER_SECRET,undefined);assert.equal(result.BUSCAG_STAGING_DATABASE_URL,undefined);
  assert.equal(ambient.VITE_SUPABASE_URL,'https://production.invalid');
  for(const key of ['', 'sb_secret_synthetic',token('service_role',STAGING_REF),token('anon','wrong-project')])assert.throws(()=>stagingEnvironment(key));
  assert.equal(stagingEnvironment(token('anon',STAGING_REF)).VITE_APP_ENV,'staging');
});
test('runtime guard rejects wrong URL, redirects, app origin and mode; CSP restricts API and websocket destinations',()=>{
  const valid=stagingEnvironment(publicKey);assert.equal(validateStagingEnvironment(valid),null);
  for(const changed of [{VITE_SUPABASE_URL:'https://production.invalid'},{VITE_SUPABASE_URL:STAGING_URL+'/rest/v1'},{VITE_APP_URL:'https://published.invalid'},{VITE_APP_ENV:'production'}])assert.ok(validateStagingEnvironment({...valid,...changed}));
  const connect=STAGING_CSP.split('; ').find(x=>x.startsWith('connect-src'))!;
  assert.ok(connect.includes(STAGING_URL));assert.ok(connect.includes(`wss://${STAGING_REF}.supabase.co`));
  assert.ok(!connect.includes('*.supabase.co'));assert.ok(!STAGING_CSP.includes('hczcqtodcnurdrroczle'));
});
test('public preflight performs GET only to fixed staging, requests no rows and never serializes the key or raw Auth payload',async()=>{
  const calls:{url:string;options:any}[]=[];
  const result=await checkStagingPublic(publicKey,async(url:string,options:any)=>{
    calls.push({url,options});
    return url.endsWith('/settings')?new Response(JSON.stringify({external:{email:true},disable_signup:false,mailer_autoconfirm:false,private:'DO_NOT_PRINT'}),{status:200}):new Response(JSON.stringify({code:'42501'}),{status:401});
  });
  assert.equal(calls.length,6);assert.ok(calls.every(c=>new URL(c.url).origin===STAGING_URL&&c.options.method==='GET'&&c.options.redirect==='error'));
  assert.ok(calls.slice(1).every(c=>c.url.endsWith('?select=id&limit=0')));
  assert.equal(result.anonymous_access_denied.length,5);assert.equal(result.realtime,'pending');
  assert.ok(!JSON.stringify(result).includes(publicKey));assert.ok(!JSON.stringify(result).includes('DO_NOT_PRINT'));
});
test('public preflight stops on bad credentials, network failure or unexpected anonymous access without trying production',async()=>{
  let requests=0;
  await assert.rejects(checkStagingPublic(publicKey,async()=>{requests++;return new Response('{}',{status:401});}),/rechazó/);assert.equal(requests,1);
  await assert.rejects(checkStagingPublic(publicKey,async()=>{throw new Error('DO_NOT_PRINT');}),/exclusivamente a staging/);
  await assert.rejects(checkStagingPublic(publicKey,async(url:string)=>new Response(url.endsWith('/settings')?'{}':'[]',{status:200})),/permisos/);
  requests=0;await assert.rejects(checkStagingPublic('sb_secret_synthetic',async()=>{requests++;return new Response();}));assert.equal(requests,0);
});

test('real Vite staging server ignores env files, serves pinned variables and restricts browser connections',async()=>{
  const {createServer}=await import('vite');
  const {fileURLToPath}=await import('node:url');
  const previous=Object.fromEntries(Object.entries(process.env).filter(([name])=>name.startsWith('VITE_')));
  for(const name of Object.keys(previous))delete process.env[name];
  Object.assign(process.env,stagingEnvironment(publicKey));
  let server:Awaited<ReturnType<typeof createServer>>|undefined;
  try{
    server=await createServer({configFile:fileURLToPath(new URL('../vite.config.ts',import.meta.url)),mode:'staging',logLevel:'silent',server:{host:'127.0.0.1',port:0},optimizeDeps:{noDiscovery:true,include:[]}});
    await server.listen();
    assert.equal(server.config.envDir,false);assert.equal(server.config.env.VITE_SUPABASE_URL,STAGING_URL);
    assert.equal(server.config.env.VITE_APP_URL,STAGING_APP_URL);assert.ok(server.config.build.outDir.endsWith('dist-staging'));
    const address=server.httpServer!.address() as import('node:net').AddressInfo;
    assert.equal(address.address,'127.0.0.1');
    const response=await fetch(`http://127.0.0.1:${address.port}/`);
    assert.equal(response.status,200);assert.equal(response.headers.get('Content-Security-Policy'),STAGING_CSP);
    assert.equal(response.headers.get('Cache-Control'),'no-store');
  }finally{
    await server?.close();
    for(const name of Object.keys(process.env))if(name.startsWith('VITE_'))delete process.env[name];
    Object.assign(process.env,previous);
  }
});
