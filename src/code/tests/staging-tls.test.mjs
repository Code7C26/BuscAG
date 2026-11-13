// No PostgreSQL, migrations, real credentials or external connections.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {createServer,connect,checkServerIdentity,TLSSocket,createSecureContext} from 'node:tls';
import {createServer as createTcpServer} from 'node:net';
import {EventEmitter} from 'node:events';
import {X509Certificate} from 'node:crypto';
import {loadStagingCa,validateRootCa,stagingDiagnostic,publicError,formatStagingDiagnostic,formatStagingProgress,stagingStep} from '../scripts/staging-tls.mjs';
import {withStagingSession,withStagingRollback} from '../scripts/staging-session.mjs';
import {readUpgradeCatalog,readUpgradeEvidence} from '../scripts/staging-upgrade.mjs';
import {connectionConfig} from '../scripts/prepare-staging.mjs';
const directory=await mkdtemp(path.join(tmpdir(),'buscag-synthetic-tls-'));
const file=name=>path.join(directory,name);
const openssl=args=>execFileSync('openssl',args,{stdio:'pipe'});
openssl(['req','-x509','-newkey','rsa:2048','-nodes','-subj','/CN=BuscAG synthetic root','-addext','basicConstraints=critical,CA:TRUE','-days','2','-keyout',file('root.key'),'-out',file('root.crt')]);
openssl(['req','-newkey','rsa:2048','-nodes','-subj','/CN=*.pooler.supabase.com','-keyout',file('leaf.key'),'-out',file('leaf.csr')]);
await writeFile(file('leaf.ext'),'basicConstraints=critical,CA:FALSE\nsubjectAltName=DNS:*.pooler.supabase.com\nextendedKeyUsage=serverAuth\n');
openssl(['x509','-req','-in',file('leaf.csr'),'-CA',file('root.crt'),'-CAkey',file('root.key'),'-CAcreateserial','-days','1','-extfile',file('leaf.ext'),'-out',file('leaf.crt')]);
const root=await readFile(file('root.crt')),leaf=await readFile(file('leaf.crt'));
const expected=new X509Certificate(root).fingerprint256;
test.after(async()=>rm(directory,{recursive:true,force:true}));
test('loads one operator-provided CA, verifies its fingerprint and rejects unsafe or malformed configuration',async()=>{
  const loaded=await loadStagingCa({BUSCAG_STAGING_CA_FILE:file('root.crt'),BUSCAG_STAGING_CA_SHA256:expected});
  assert.equal(loaded.fingerprint256,expected);assert.match(loaded.ca,/BEGIN CERTIFICATE/);
  assert.deepEqual(await loadStagingCa({}),{});
  await assert.rejects(loadStagingCa({NODE_TLS_REJECT_UNAUTHORIZED:'0'}),/validación TLS/);
  await assert.rejects(loadStagingCa({BUSCAG_STAGING_CA_FILE:file('missing')}),/No se pudo leer/);
  await assert.rejects(loadStagingCa({BUSCAG_STAGING_CA_FILE:directory}),/No se pudo leer/);
  await assert.rejects(loadStagingCa({BUSCAG_STAGING_CA_SHA256:expected}),/requiere/);
  assert.throws(()=>validateRootCa(root,'00'.repeat(32)),/huella/);
  assert.throws(()=>validateRootCa(Buffer.from('invalid')),/único certificado/);
  assert.throws(()=>validateRootCa(Buffer.concat([root,root])),/único certificado/);
  assert.throws(()=>validateRootCa(leaf),/CA raíz/);
  assert.throws(()=>validateRootCa(root,expected,Date.now()+365*86400000),/vencida/);
  assert.throws(()=>validateRootCa(Buffer.concat([root,Buffer.from('PRIVATE MATERIAL')])),/único certificado/);
});
test('real loopback TLS handshake accepts trusted CA and matching wildcard hostname, rejects unknown CA and wrong hostname',async()=>{
  const server=createServer({cert:leaf,key:await readFile(file('leaf.key'))},socket=>socket.end());
  server.on('tlsClientError',()=>{});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const trusted=await loadStagingCa({BUSCAG_STAGING_CA_FILE:file('root.crt')});
  const url='postgresql://postgres.abcdefghijklmnopqrst:synthetic@aws-0-region.pooler.supabase.com:5432/postgres?sslmode=require';
  const config=connectionConfig(url,'abcdefghijklmnopqrst',trusted.ca);
  assert.equal(config.ssl.rejectUnauthorized,true);assert.equal(config.ssl.servername,'aws-0-region.pooler.supabase.com');
  assert.equal(config.ssl.checkServerIdentity,checkServerIdentity);assert.equal(config.ssl.minVersion,'TLSv1.2');
  assert.equal(new URL(config.connectionString).search,'');
  const {Client}=await import('pg');const pg=new Client(config);
  assert.equal(pg.connectionParameters.ssl.ca,trusted.ca);
  assert.equal(pg.connectionParameters.ssl.rejectUnauthorized,true);
  assert.equal(pg.connectionParameters.ssl.checkServerIdentity,checkServerIdentity);
  const handshake=ssl=>new Promise((resolve,reject)=>{
    const client=connect({...ssl,host:'127.0.0.1',port:server.address().port});
    client.setTimeout(3000,()=>client.destroy(new Error('synthetic timeout')));
    client.once('secureConnect',()=>{const authorized=client.authorized;client.destroy();resolve(authorized);});
    client.once('error',reject);
  });
  try{
    assert.equal(await handshake(config.ssl),true);
    const untrusted=connectionConfig(url,'abcdefghijklmnopqrst').ssl;
    await assert.rejects(handshake(untrusted),e=>['UNABLE_TO_VERIFY_LEAF_SIGNATURE','SELF_SIGNED_CERT_IN_CHAIN','UNABLE_TO_GET_ISSUER_CERT_LOCALLY'].includes(e.code));
    await assert.rejects(handshake({...config.ssl,servername:'wrong.example.invalid'}),e=>e.code==='ERR_TLS_CERT_ALTNAME_INVALID');
  }finally{await new Promise(resolve=>server.close(resolve));}
});
test('diagnostics distinguish TLS, authentication, network and schema without echoing server details or secrets',()=>{
  const secret='postgresql://private:DO_NOT_PRINT@private-host/postgres';
  for(const [code,category] of [['SELF_SIGNED_CERT_IN_CHAIN','TLS'],['ERR_TLS_CERT_ALTNAME_INVALID','TLS'],['CERT_HAS_EXPIRED','TLS'],['28P01','autenticación'],['ENOTFOUND','conexión'],['ECONNREFUSED','conexión'],['42501','permisos'],['42P01','estructura/SQL']]){
    const result=stagingDiagnostic({code,message:secret,detail:secret,stack:secret});
    assert.equal(result.category,category);assert.equal(result.code,code);assert.ok(!JSON.stringify(result).includes('DO_NOT_PRINT'));
  }
  assert.equal(stagingDiagnostic({cause:{code:'SELF_SIGNED_CERT_IN_CHAIN',message:secret}}).category,'TLS');
  assert.equal(stagingDiagnostic(new AggregateError([{code:'ENETUNREACH'}],secret)).category,'conexión');
  assert.ok(!JSON.stringify(stagingDiagnostic(new Error(secret))).includes('DO_NOT_PRINT'));
  assert.equal(stagingDiagnostic(publicError('BUSCAG_PREFLIGHT','Tabla esperada ausente.')).message,'Tabla esperada ausente.');
});
test('valid WHATWG URI may fail pg password decoding; malformed percent escapes fail safely before client construction',async()=>{
 const {Client}=await import('pg');
 const origin='@aws-0-region.pooler.supabase.com:5432/postgres';
 const prefix='postgresql://postgres.abcdefghijklmnopqrst:';
 for(const password of ['synthetic%password','synthetic%FF']){
  const uri=prefix+password+origin;
  assert.doesNotThrow(()=>new URL(uri));
  assert.throws(()=>connectionConfig(uri,'abcdefghijklmnopqrst'),e=>e.code==='BUSCAG_URI_ENCODING');
 }
 assert.throws(()=>new Client({connectionString:prefix+'synthetic%FF'+origin}),URIError);
 const raw='synthetic%2F @:/?# ñ';
 const client=new Client(connectionConfig(prefix+encodeURIComponent(raw)+origin,'abcdefghijklmnopqrst'));
 assert.equal(client.password,raw);
 assert.equal(stagingDiagnostic(new URIError('URI malformed')).code,'BUSCAG_URI_ENCODING');
 // Shared read-only preflight, without invalidating an operator's upgrade files.
 const run=spawnSync(process.execPath,['scripts/prepare-staging.mjs','--project-ref','yiarlhpbgkofhhipkfha','--plan'],{
  cwd:new URL('..',import.meta.url),encoding:'utf8',env:{...process.env,NODE_TLS_REJECT_UNAUTHORIZED:'1',
   BUSCAG_STAGING_CA_FILE:file('root.crt'),BUSCAG_STAGING_CA_SHA256:expected,
   BUSCAG_STAGING_DATABASE_URL:'postgresql://postgres.yiarlhpbgkofhhipkfha:DO_NOT_PRINT%FF@aws-0-us-east-1.pooler.supabase.com:5432/postgres'},
 });
 assert.equal(run.status,1);assert.match(run.stdout,/diagnóstico 3/);assert.match(run.stderr,/BUSCAG_URI_ENCODING/);
 assert.ok(!run.stderr.includes('DO_NOT_PRINT'));assert.ok(!run.stdout.includes('DO_NOT_PRINT'));
 assert.ok(!run.stdout.includes('[TCP]'));
});
test('local planning failures retain the last completed SQL and exact step despite a subsequent rollback',async()=>{
 for(const [failure,code] of [[new Error('DO_NOT_PRINT local content'),'BUSCAG_LOCAL_PROCESSING_FAILURE'],
  [new TypeError('DO_NOT_PRINT function body'),'BUSCAG_JS_TYPE'],[new SyntaxError('DO_NOT_PRINT JSON'),'BUSCAG_JS_SYNTAX'],
  [new ReferenceError('DO_NOT_PRINT symbol'),'BUSCAG_JS_REFERENCE'],[new WebAssembly.CompileError('DO_NOT_PRINT wasm'),'BUSCAG_WASM_RUNTIME'],
  [new TypeError('DO_NOT_PRINT wrapper',{cause:Object.assign(new Error('DO_NOT_PRINT SQL'),{code:'42501'})}),'BUSCAG_JS_TYPE']]){
  const progress=[];
  await assert.rejects(withStagingSession(new FakeClient(),async db=>{
   await db.query('DO_NOT_PRINT settings');await db.query('DO_NOT_PRINT identity');await db.query('DO_NOT_PRINT begin');
   return withStagingRollback(db,()=>stagingStep(db,'official.sources',()=>{throw failure;}));
  },{onProgress:event=>progress.push(formatStagingProgress(event))}),error=>{
   const d=stagingDiagnostic(error);assert.equal(d.origin,'local');assert.equal(d.step,'official.sources');
   assert.equal(d.last_completed,'consultas');assert.equal(d.last_query_number,3);assert.equal(d.query_number,null);
   assert.equal(d.code,code);
   if(code==='BUSCAG_JS_TYPE')assert.equal(d.error_kind,'javascript');
   const output=formatStagingDiagnostic(error);assert.match(output,/última SQL completada #3/);assert.ok(!output.includes('DO_NOT_PRINT'));return true;
  });
  assert.ok(progress.some(s=>s.includes('SQL #4')&&s.includes('transaction.rollback')));
  assert.ok(progress.some(s=>s.includes('official.sources')));assert.ok(!progress.join('\n').includes('DO_NOT_PRINT'));
 }
});
test('server permission errors and local malformed metadata results have different origins and counters',async()=>{
 const denied=new FakeClient({queryError:Object.assign(new Error('DO_NOT_PRINT SQL body'),{code:'42501'})});
 await assert.rejects(withStagingSession(denied,db=>readUpgradeCatalog(db)),e=>{
  const d=stagingDiagnostic(e);assert.equal(d.origin,'query');assert.equal(d.error_kind,'sqlstate');
  assert.equal(d.step,'catalog.collect');assert.equal(d.query_number,1);assert.equal(d.last_query_number,0);return true;
 });
 for(const [reader,key,code] of [[readUpgradeCatalog,'catalog','BUSCAG_CATALOG_RESULT'],[readUpgradeEvidence,'evidence','BUSCAG_EVIDENCE_RESULT']]){
  const malformed=new FakeClient();malformed.query=async()=>({rows:[{[key]:'DO_NOT_PRINT private data'}]});
  await assert.rejects(withStagingSession(malformed,db=>reader(db)),e=>{
   const d=stagingDiagnostic(e);assert.equal(d.code,code);assert.equal(d.origin,'local');assert.equal(d.error_kind,'validation');
   assert.equal(d.query_number,null);assert.equal(d.last_query_number,1);assert.ok(!formatStagingDiagnostic(e).includes('DO_NOT_PRINT'));return true;
  });
 }
});
test('JavaScript/driver failures, local file permissions and unregistered step names never expose private messages',async()=>{
 const badDriver=new FakeClient({queryError:new TypeError('DO_NOT_PRINT credentials')});
 await assert.rejects(withStagingSession(badDriver,db=>stagingStep(db,'evidence.collect',()=>db.query('DO_NOT_PRINT'))),e=>{
  const d=stagingDiagnostic(e);assert.equal(d.code,'BUSCAG_JS_TYPE');assert.equal(d.origin,'query');assert.equal(d.query_number,1);return true;
 });
 await assert.rejects(withStagingSession(new FakeClient(),db=>stagingStep(db,'artifacts.save',()=>{throw Object.assign(new Error('DO_NOT_PRINT path'),{code:'EACCES'});})),e=>{
  const d=stagingDiagnostic(e);assert.equal(d.code,'BUSCAG_LOCAL_FILE');assert.equal(d.origin,'local');assert.equal(d.step,'artifacts.save');return true;
 });
 await assert.rejects(withStagingSession(new FakeClient(),db=>db.step('DO_NOT_PRINT arbitrary SQL',()=>{})),e=>{
  assert.equal(stagingDiagnostic(e).code,'BUSCAG_DIAGNOSTIC_STEP');assert.ok(!formatStagingDiagnostic(e).includes('DO_NOT_PRINT'));return true;
 });
});
test('uncoded pg errors and recursive/cyclic causes are classified without echoing messages, tokens or forged public messages',()=>{
 const signature=new Error('SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature does not match');
 const nested=new AggregateError([{cause:new AggregateError([{cause:signature}],'private')}],'private');
 assert.equal(stagingDiagnostic(nested).code,'BUSCAG_SCRAM_SIGNATURE');
 const cycle={message:'DO_NOT_PRINT'};cycle.cause=cycle;cycle.errors=[cycle];
 assert.equal(stagingDiagnostic(cycle).code,'BUSCAG_SETUP_FAILURE');
 for(const message of ['timeout expired','Connection terminated unexpectedly','Query read timeout','The server does not support SSL connections','There was an error establishing an SSL connection','Tenant or user not found','Max client connections reached','MaxClientsInSessionMode: max clients reached - in Session mode max clients are limited to pool_size','Client network socket disconnected before secure TLS connection was established']){
  assert.notEqual(stagingDiagnostic(new Error(message)).code,'UNKNOWN');
 }
 for(const error of [{code:'BUSCAG_FAKE',publicMessage:'DO_NOT_PRINT',message:'DO_NOT_PRINT'},
  {code:'ERR_TLS_DO_NOT_PRINT',message:'DO_NOT_PRINT',detail:'DO_NOT_PRINT'},new Error('postgresql://user:DO_NOT_PRINT@host/postgres')]){
  assert.ok(!formatStagingDiagnostic(error).includes('DO_NOT_PRINT'));
 }
});
class FakeClient extends EventEmitter{
 constructor({connectError,queryError,endError,idleError,endEmitsError,hangEnd=false}={}){super();Object.assign(this,{connectError,queryError,endError,idleError,endEmitsError,hangEnd});this.connection=new EventEmitter();this.connection.stream=new EventEmitter();this.connection.stream.authorized=true;this.connection.stream.destroy=()=>{this.destroyed=true;};}
 async connect(){this.connection.emit('connect');this.connection.emit('sslconnect');this.connection.stream.emit('secureConnect');if(this.connectError)throw this.connectError;}
 async query(){if(this.idleError)this.emit('error',this.idleError);if(this.queryError)throw this.queryError;return {rows:[]};}
 async end(){if(this.endEmitsError)this.emit('error',this.endEmitsError);if(this.endError)throw this.endError;if(this.hangEnd)return new Promise(()=>{});}
}
test('query and idle errors keep their phase, and closing/rollback errors never replace the primary failure',async()=>{
 const secret='postgresql://user:DO_NOT_PRINT@private/postgres';
 const auth=Object.assign(new Error('SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature does not match'),{detail:secret,stack:secret});
 await assert.rejects(withStagingSession(new FakeClient({connectError:auth,endError:new Error(secret)}),async()=>{}),error=>{
  const d=stagingDiagnostic(error);assert.equal(d.code,'BUSCAG_SCRAM_SIGNATURE');assert.equal(d.stage,'autenticación');assert.equal(d.last_completed,'TLS');
  assert.equal(d.secondary[0].stage,'cierre');assert.ok(!formatStagingDiagnostic(error).includes('DO_NOT_PRINT'));return true;
 });
 const primary=Object.assign(new Error(secret),{code:'42P01',detail:secret,stack:secret});
 const client=new FakeClient({queryError:primary,endError:new Error(secret)});
 const progress=[];
 await assert.rejects(withStagingSession(client,db=>db.query(secret),{onProgress:p=>progress.push(p)}),error=>{
  const d=stagingDiagnostic(error);assert.equal(d.code,'42P01');assert.equal(d.stage,'consultas');assert.equal(d.query_number,1);
  assert.equal(d.secondary[0].stage,'cierre');assert.equal(d.secondary[0].code,'BUSCAG_CLOSE_FAILURE');
  assert.ok(!formatStagingDiagnostic(error).includes('DO_NOT_PRINT'));return true;
 });
 assert.deepEqual(progress.slice(0,5),[{stage:'tcp',status:'start'},{stage:'tcp',status:'ok'},{stage:'tls',status:'start'},{stage:'tls',status:'ok'},{stage:'authentication',status:'start'}]);
 await assert.rejects(withStagingRollback({query:async()=>{throw new Error(secret);}},()=>{throw primary;}),error=>stagingDiagnostic(error).code==='42P01');
 const idle=new FakeClient({idleError:Object.assign(new Error(secret),{code:'ECONNRESET'})});
 await assert.rejects(withStagingSession(idle,db=>db.query(secret)),e=>stagingDiagnostic(e).stage==='consultas'&&stagingDiagnostic(e).code==='ECONNRESET');
});
test('close-only failures and bounded close timeout are explicit after successful queries',async()=>{
 await assert.rejects(withStagingSession(new FakeClient({endError:new Error('DO_NOT_PRINT')}),db=>db.query('private')),
 e=>stagingDiagnostic(e).code==='BUSCAG_CLOSE_FAILURE'&&stagingDiagnostic(e).last_completed==='consultas');
 const hung=new FakeClient({hangEnd:true});
 await assert.rejects(withStagingSession(hung,async()=>{}, {closeTimeoutMs:15}),e=>stagingDiagnostic(e).code==='BUSCAG_CLOSE_TIMEOUT');
 assert.equal(hung.destroyed,true);
 const progress=[];
 await assert.rejects(withStagingSession(new FakeClient({endEmitsError:new Error('DO_NOT_PRINT')}),async()=>{}, {onProgress:p=>progress.push(p)}),e=>stagingDiagnostic(e).stage==='cierre');
 assert.ok(!progress.some(p=>p.stage==='closing'&&p.status==='ok'));
});
test('sslconnect alone never reports successful TLS or authentication',async()=>{
 const client=new FakeClient();const progress=[];
 client.connect=async()=>{client.connection.emit('connect');client.connection.emit('sslconnect');throw new Error('timeout expired');};
 await assert.rejects(withStagingSession(client,async()=>{}, {onProgress:p=>progress.push(p)}),e=>{
  const d=stagingDiagnostic(e);assert.equal(d.stage,'TLS');assert.equal(d.last_completed,'TCP');assert.equal(d.code,'BUSCAG_CONNECT_TIMEOUT');return true;
 });
 assert.ok(!progress.some(p=>p.stage==='tls'&&p.status==='ok'));
});
test('real pg SSLRequest and verified TLS distinguish authentication, query, SSL refusal and handshake timeout on loopback',async()=>{
 const {Client}=await import('pg');
 const context=createSecureContext({cert:leaf,key:await readFile(file('leaf.key'))});
 const packet=(type,payload)=>{const size=Buffer.alloc(4);size.writeInt32BE(payload.length+4);return Buffer.concat([Buffer.from(type),size,payload]);};
 const ready=packet('Z',Buffer.from('I'));
 const authOk=packet('R',Buffer.alloc(4));
 const pgError=code=>packet('E',Buffer.from(`SERROR\0C${code}\0MDO_NOT_PRINT\0\0`));
 for(const mode of ['authentication','queries','refused','timeout']){
  const sockets=new Set();const progress=[];
  const server=createTcpServer(socket=>{
   sockets.add(socket);socket.on('close',()=>sockets.delete(socket));socket.on('error',()=>{});
   socket.once('data',()=>{
    if(mode==='timeout')return;
    if(mode==='refused'){socket.end('N');return;}
    socket.write('S');
    const tls=new TLSSocket(socket,{isServer:true,secureContext:context});tls.on('error',()=>{});
    tls.once('data',()=>{
     if(mode==='authentication'){tls.end(pgError('28P01'));return;}
     tls.write(Buffer.concat([authOk,ready]));
     tls.on('data',data=>{if(data[0]===81)tls.write(Buffer.concat([pgError('42P01'),ready]));else if(data[0]===88)tls.end();});
    });
   });
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const client=new Client({host:'127.0.0.1',port:server.address().port,user:'synthetic',database:'synthetic',password:'synthetic',
   connectionTimeoutMillis:mode==='timeout'?250:3000,ssl:{ca:root,servername:'aws-0-region.pooler.supabase.com',rejectUnauthorized:true,checkServerIdentity,minVersion:'TLSv1.2'}});
  try{
   await assert.rejects(withStagingSession(client,db=>db.query('DO_NOT_PRINT'),{onProgress:p=>progress.push(p)}),e=>{
    const d=stagingDiagnostic(e);
    assert.equal(d.code,{authentication:'28P01',queries:'42P01',refused:'BUSCAG_PG_SSL_REFUSED',timeout:'BUSCAG_CONNECT_TIMEOUT'}[mode]);
    assert.equal(d.stage,{authentication:'autenticación',queries:'consultas',refused:'TLS',timeout:'TLS'}[mode]);
    assert.ok(!formatStagingDiagnostic(e).includes('DO_NOT_PRINT'));return true;
   });
   assert.equal(progress.some(p=>p.stage==='tls'&&p.status==='ok'),!['refused','timeout'].includes(mode));
  }finally{for(const socket of sockets)socket.destroy();await new Promise(resolve=>server.close(resolve));}
 }
});
