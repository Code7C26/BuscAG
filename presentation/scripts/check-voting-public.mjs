import assert from 'node:assert/strict';
const origin='https://buscag-el-experimento-votos.reedyrook2.chatgpt.site';
for(const [path,type] of [['/vote?poll=search','text/html'],['/vote?poll=object','text/html'],['/client.js','javascript'],['/style.css','text/css'],['/api/health','application/json'],['/api/polls','application/json']]){
 const r=await fetch(origin+path,{signal:AbortSignal.timeout(20000)});assert.equal(r.status,200,path);assert.ok(r.headers.get('content-type')?.includes(type),path);const body=await r.text();if(path==='/api/polls'){const data=JSON.parse(body);assert.equal(data.polls.length,2);assert.ok(data.polls.every(p=>typeof p.open==='boolean'));console.log('Live poll states',JSON.stringify(data.polls.map(p=>({id:p.id,open:p.open}))));} console.log('HTTPS 200 MIME OK',path);
}
const denied=await fetch(origin+'/api/admin/state');assert.equal(denied.status,401);console.log('Private admin rejects anonymous access');
// Never submit test votes to a live audience event; closed-vote rejection is covered in isolated tests.
// Read the private gateway without credentials, and try spoofed identity headers.
const gateway='https://buscag-autorizar-pc.reedyrook2.chatgpt.site';
for(const headers of [{},{'oai-authenticated-user-id':'forged-owner','oai-authenticated-user-email':'forged@example.org'}]){
 const r=await fetch(gateway+'/?id='+'0'.repeat(64),{headers,redirect:'manual',signal:AbortSignal.timeout(20000)});const body=await r.text();assert.ok([301,302,303,307,308,401,403].includes(r.status)||(r.status===200&&/sign.?in|iniciar sesi|log.?in/i.test(body)),'Private gateway must be protected by Sites');assert.ok(!body.includes('class="code"'),'Anonymous request must not reach authorization form');console.log('Private Sites gateway blocks anonymous/spoofed identity',r.status);
}
// Content-only revisions run read-only against published services. Explicit opt-in is required to create a pairing request.
if(process.env.BUSCAG_VERIFY_PAIRING_MUTATIONS==='1'){
const {publicKey}=await import('node:crypto').then(c=>c.generateKeyPairSync('rsa',{modulusLength:2048}));
const begun=await fetch(origin+'/api/pair/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({publicKey:publicKey.export({format:'jwk'})})});assert.equal(begun.status,200);const pending=await begun.json();assert.match(pending.code,/^\d{6}$/);assert.ok(pending.authorizationUrl.startsWith(gateway+'/?id='));
const forbidden=await fetch(origin+'/api/pair/admin/approve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:pending.id})});assert.equal(forbidden.status,401);
const cancelled=await fetch(origin+'/api/pair/cancel',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:pending.id,pollToken:pending.pollToken})});assert.equal(cancelled.status,200);console.log('Live HTTPS pairing starts, rejects unauthorized approval and cancels without touching votes');

}else console.log('Read-only preflight: no pairing requests or votes created');

const runtime=await(await fetch(origin+"/api/health")).json();console.log("Published runtime capabilities",JSON.stringify(runtime.runtime));const transport=await(await fetch(origin+"/api/health/transport")).json();console.log("Published Worker transport probe",JSON.stringify(transport));assert.equal(transport.upstreamStatus,200,"Published Worker must reach HTTPS service with manual redirects");
