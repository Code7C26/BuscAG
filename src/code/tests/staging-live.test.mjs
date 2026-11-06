import test from "node:test";
import assert from "node:assert/strict";
import {
  liveConfiguration,
  pinnedStagingFetch,
} from "../scripts/staging-live.mjs";
const env = {
  BUSCAG_STAGING_PUBLISHABLE_KEY: "sb_publishable_synthetic_staging",
};
const accounts = Array.from({ length: 3 }, (_, i) => ({
  email: `synthetic-${i}@example.invalid`,
  password: "synthetic-only-password",
}));
test("live tools never inherit a production destination or accept private keys", () => {
  const probe = liveConfiguration(
    { ...env, VITE_SUPABASE_URL: "https://production.invalid" },
    ["--probe"],
  );
  assert.equal(probe.mode, "--probe");
  assert.deepEqual(probe.accounts, []);
  for (const changed of [
    { BUSCAG_STAGING_PUBLISHABLE_KEY: "sb_secret_private" },
    { BUSCAG_STAGING_PROJECT_REF: "hczcqtodcnurdrroczle" },
  ])
    assert.throws(() => liveConfiguration({ ...env, ...changed }, ["--probe"]));
  for (const args of [[], ["--run", "--force"], ["--production"]])
    assert.throws(() => liveConfiguration(env, args));
});
test("writing modes require two or three explicitly dedicated accounts and never echo bad input", () => {
  assert.throws(() => liveConfiguration(env, ["--run"]));
  const input = {
    ...env,
    BUSCAG_STAGING_TEST_ACCOUNTS_CONFIRMED: "dedicated-test-accounts",
    BUSCAG_STAGING_TEST_ACCOUNTS_JSON: JSON.stringify(accounts),
  };
  assert.equal(liveConfiguration(input, ["--run"]).accounts.length, 3);
  assert.equal(
    liveConfiguration(input, ["--email-requests"]).accounts.length,
    3,
  );
  for (const bad of [
    "PRIVATE_BAD_JSON",
    JSON.stringify([accounts[0]]),
    JSON.stringify([accounts[0], accounts[0], accounts[0]]),
  ]) {
    assert.throws(
      () =>
        liveConfiguration(
          { ...input, BUSCAG_STAGING_TEST_ACCOUNTS_JSON: bad },
          ["--run"],
        ),
      (e) =>
        !e.message.includes("PRIVATE_BAD_JSON") &&
        !e.message.includes(accounts[0].password),
    );
  }
});
test("pinned real-service transport rejects foreign destinations before fetch and refuses redirects", async () => {
  const calls = [];
  const fetcher = pinnedStagingFetch(async (input, options) => {
    calls.push({ input, options });
    return new Response("{}");
  });
  for (const url of [
    "https://hczcqtodcnurdrroczle.supabase.co/auth/v1/signup",
    "https://yiarlhpbgkofhhipkfha.supabase.co.evil.invalid/",
    "http://yiarlhpbgkofhhipkfha.supabase.co/",
    "https://user:password@yiarlhpbgkofhhipkfha.supabase.co/",
  ])
    assert.throws(() => fetcher(url));
  assert.equal(calls.length, 0);
  await fetcher("https://yiarlhpbgkofhhipkfha.supabase.co/auth/v1/settings", {
    redirect: "follow",
    method: "GET",
  });
  assert.equal(calls[0].options.redirect, "error");
  assert.ok(calls[0].options.signal instanceof AbortSignal);
});

test("school rehearsal accepts two accounts without requiring a third privacy observer", () => {
  const selected = liveConfiguration(
    {
      ...env,
      BUSCAG_STAGING_TEST_ACCOUNTS_CONFIRMED: "dedicated-test-accounts",
      BUSCAG_STAGING_TEST_ACCOUNTS_JSON: JSON.stringify(accounts.slice(0, 2)),
    },
    ["--run"],
  );
  assert.equal(selected.accounts.length, 2);
});

test('existing confirmed school accounts are not forced through an invented password rotation',()=>{const selected=liveConfiguration({...env,BUSCAG_STAGING_TEST_ACCOUNTS_CONFIRMED:'dedicated-test-accounts',BUSCAG_STAGING_TEST_ACCOUNTS_JSON:JSON.stringify(accounts.slice(0,2).map(a=>({...a,password:'demo-8ok'})))},['--run']);assert.equal(selected.accounts.length,2);assert.equal(selected.accounts[0].password,'demo-8ok');});
test('school rehearsal requires explicit dedicated accounts and a pinned staging destination',()=>{
 assert.throws(()=>liveConfiguration(env,['--school']));
 const configuration=liveConfiguration({...env,BUSCAG_STAGING_TEST_ACCOUNTS_CONFIRMED:'dedicated-test-accounts',BUSCAG_STAGING_TEST_ACCOUNTS_JSON:JSON.stringify(accounts)},['--school']);
 assert.equal(configuration.mode,'--school');assert.equal(configuration.accounts.length,3);
 assert.throws(()=>liveConfiguration({...env,BUSCAG_STAGING_PROJECT_REF:'hczcqtodcnurdrroczle'},['--school']));
});
test('school remote checker rejects QR responses containing private fields',async()=>{
 const {runSchoolChecks}=await import('../scripts/school-live-checks.mjs');
 const rpc=async(name)=>name==='manage_object_tag'?{data:{token:'synthetic'},error:null}:{error:{code:'42501'}};
 const args={a:{},b:{rpc},c:{rpc},anon:{rpc:async()=>({data:{item_id:'item',category:'Otros',status:'perdido',phone:'PRIVATE'},error:null})},owner:'owner',partner:'partner',item:{id:'item'},check:(ok,message)=>{if(!ok)throw Error(message);},accepted:r=>r.data,report:()=>{}};
 await assert.rejects(runSchoolChecks(args),e=>e.message==='El QR devolvió datos inesperados.');
});
test('full school rehearsal stops before Storage or publications when matching is disabled (actual SDK, intercepted HTTP)',async()=>{
 const {runLiveChecks}=await import('../scripts/staging-live.mjs');const previous=globalThis.fetch;const paths=[];
 globalThis.fetch=async(input,options={})=>{
 const url=new URL(typeof input==='string'?input:input.url||String(input));paths.push(url.pathname);
 if(url.pathname==='/auth/v1/token'){
 const body=JSON.parse(options.body);const index=accounts.findIndex(a=>a.email===body.email);const id=`e0000000-0000-4000-8000-00000000000${index+1}`;
 const payload=Buffer.from(JSON.stringify({sub:id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');
 return Response.json({access_token:`eyJhbGciOiJIUzI1NiJ9.${payload}.synthetic`,refresh_token:'synthetic',expires_in:3600,token_type:'bearer',user:{id,email:body.email,email_confirmed_at:'2026-11-05T00:00:00Z',aud:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-11-05T00:00:00Z'}});
 }
 if(url.pathname==='/rest/v1/rpc/school_features')return Response.json({version:1,matching_enabled:false});
 if(url.pathname==='/auth/v1/logout')return new Response(null,{status:204});
 return Response.json({message:'unexpected fixture request'},{status:400});
 };
 try{
 const config=liveConfiguration({...env,BUSCAG_STAGING_TEST_ACCOUNTS_CONFIRMED:'dedicated-test-accounts',BUSCAG_STAGING_TEST_ACCOUNTS_JSON:JSON.stringify(accounts)},['--school']);
 await assert.rejects(runLiveChecks(config,()=>{}),e=>e.message.startsWith('Matching escolar deshabilitado'));
 assert.ok(paths.includes('/rest/v1/rpc/school_features'));assert.ok(!paths.some(p=>p.startsWith('/storage/')||p.includes('publish_item_once')||p==='/rest/v1/items'));
 }finally{globalThis.fetch=previous;}
});
