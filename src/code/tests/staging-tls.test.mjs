// No PostgreSQL, migrations, real credentials or external connections.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createServer,connect,checkServerIdentity} from 'node:tls';
import {X509Certificate} from 'node:crypto';
import {loadStagingCa,validateRootCa,stagingDiagnostic,publicError} from '../scripts/staging-tls.mjs';
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
