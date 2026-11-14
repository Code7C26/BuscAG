import test from 'node:test';import assert from 'node:assert/strict';import {generateKeyPairSync,privateDecrypt,constants} from 'node:crypto';import {mkdtemp,readFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {service} from './helpers/voting-fixture.mjs';import gateway from '../voting-service/owner-gateway/index.mjs';import {createVotingBridge} from '../server/voting-bridge.mjs';
const root='synthetic-worker-admin-key-32-characters-minimum',auth={Authorization:'Bearer '+root},owner='https://buscag-autorizar-pc.reedyrook2.chatgpt.site';
const post=(svc,path,body,headers={})=>svc.fetch(path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
async function start(svc){const keys=generateKeyPairSync('rsa',{modulusLength:2048}),r=await post(svc,'/api/pair/start',{publicKey:keys.publicKey.export({format:'jwk'})});assert.equal(r.status,200);return {...await r.json(),keys};}
test('pairing: requires root approval, encrypted delivery, one-use, wrong token, expiry and revocation',async()=>{const svc=await service();try{
 const p=await start(svc);assert.match(p.code,/^\d{6}$/);assert.ok(p.expiresAt-Date.now()<=300000);assert.ok(p.authorizationUrl.startsWith(owner));
 assert.equal((await post(svc,'/api/pair/admin/approve',{id:p.id})).status,401);
 assert.equal((await post(svc,'/api/pair/poll',{id:p.id,pollToken:'a'.repeat(64)})).status,401);
 assert.equal((await post(svc,'/api/pair/admin/approve',{id:p.id},auth)).status,200);
 assert.equal((await post(svc,'/api/pair/admin/approve',{id:p.id},auth)).status,410);
 const replies=await Promise.all([1,2].map(()=>post(svc,'/api/pair/poll',{id:p.id,pollToken:p.pollToken})));assert.deepEqual(replies.map(r=>r.status).sort(),[200,410]);
 const body=await replies.find(r=>r.status===200).json();assert.ok(!JSON.stringify(body).includes(root));
 const token=privateDecrypt({key:p.keys.privateKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},Buffer.from(body.ciphertext,'base64')).toString();assert.notEqual(token,root);
 assert.equal((await svc.fetch('/api/admin/state',{headers:{Authorization:'Bearer '+token}})).status,200);
 assert.equal((await post(svc,'/api/pair/admin/approve',{id:p.id},{Authorization:'Bearer '+token})).status,401);
 assert.equal((await post(svc,'/api/device/revoke',{}, {Authorization:'Bearer '+token})).status,200);
 assert.equal((await svc.fetch('/api/admin/state',{headers:{Authorization:'Bearer '+token}})).status,401);
 const expired=await start(svc);svc.db.prepare('UPDATE pairings SET expires_at=0 WHERE id=?').run(expired.id);assert.equal((await post(svc,'/api/pair/admin/approve',{id:expired.id},auth)).status,410);
 const cancelled=await start(svc);await post(svc,'/api/pair/cancel',{id:cancelled.id,pollToken:cancelled.pollToken});assert.equal((await post(svc,'/api/pair/admin/approve',{id:cancelled.id},auth)).status,410);
 const raw=JSON.stringify(svc.db.prepare('SELECT * FROM devices').all());assert.ok(!raw.includes(token));
}finally{svc.close();}});
test('owner gateway fails closed without identity; signed form is bound to subject and rejects CSRF',async()=>{const svc=await service(),original=globalThis.fetch;globalThis.fetch=(url,opts)=>svc.transport(url,opts);try{
 const p=await start(svc),url=owner+'/?id='+p.id,env={ADMIN_KEY:root};
 assert.equal((await gateway.fetch(new Request(url),env)).status,401);
 const r=await gateway.fetch(new Request(url,{headers:{'oai-authenticated-user-id':'owner-fixture'}}),env);assert.equal(r.status,200);const html=await r.text();assert.ok(html.includes(p.code));assert.ok(!html.includes(root));
 const fields=Object.fromEntries([...html.matchAll(/name="(id|expires|mac)" value="([^"]+)"/g)].map(m=>[m[1],m[2]]));const body=new URLSearchParams(fields).toString();
 const send=(subject,origin)=>gateway.fetch(new Request(owner+'/',{method:'POST',headers:{'oai-authenticated-user-id':subject,Origin:origin},body}),env);
 assert.equal((await send('owner-fixture','https://evil.example')).status,403);assert.equal((await send('different-subject',owner)).status,403);assert.equal((await send('owner-fixture',owner)).status,200);assert.equal((await send('owner-fixture',owner)).status,410);
}finally{globalThis.fetch=original;svc.close();}});
test('Windows bridge connects automatically, hides credentials and pairing from public status, persists and revokes',async()=>{const svc=await service(),dir=await mkdtemp(join(tmpdir(),'buscag-pair-'));let bridge;try{
 bridge=await createVotingBridge(dir,{transport:svc.transport});const settings=await bridge.beginPair([{id:'search',question:'¿Dónde buscarías primero un objeto perdido?',options:['Redes sociales','Grupos de WhatsApp','Volver al lugar']},{id:'object',question:'¿Qué objeto quieren que busquemos en BuscAG?',options:['Auriculares','Llaves','Billetera']}]);
 assert.equal(settings.pairing.phase,'pending');assert.equal(bridge.status().pairing,undefined);assert.ok(!JSON.stringify(settings).includes('pollToken'));const id=new URL(settings.pairing.url).searchParams.get('id');await post(svc,'/api/pair/admin/approve',{id},auth);
 const timeout=Date.now()+10000;while(!bridge.status().connected&&Date.now()<timeout)await new Promise(r=>setTimeout(r,200));assert.equal(bridge.status().connected,true);const saved=JSON.parse(await readFile(join(dir,'voting-private.json'),'utf8'));assert.ok(!JSON.stringify(bridge.status(true)).includes(saved.adminKey));
 await bridge.control('search',{open:true});const vote=await post(svc,'/api/vote',{poll:'search',choice:1});assert.equal(vote.status,200);await bridge.refresh();assert.equal(bridge.getPolls(true)[0].total,1);assert.equal(bridge.getPolls()[0].counts,null);await bridge.control('search',{open:false,reveal:true});assert.deepEqual(bridge.getPolls()[0].counts,[0,1,0]);
 bridge.close();bridge=await createVotingBridge(dir,{transport:svc.transport});assert.equal(bridge.status().connected,true);await bridge.disconnect();assert.equal(bridge.status().configured,false);assert.equal((await svc.fetch('/api/admin/state',{headers:{Authorization:'Bearer '+saved.adminKey}})).status,401);
}finally{bridge?.close();svc.close();await rm(dir,{recursive:true,force:true});}});
