import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {inventoryCandidate,verifyCandidate} from '../lib/candidateArtifact.mjs';
test('candidate integrity pins version, commit, staging and every byte; stale, extra or unsafe artifacts fail',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'buscag-candidate-'));
 try{
  await writeFile(join(directory,'index.html'),'<!doctype html><title>BuscAG</title>');
  const expected={version:'1.0.0-rc.1',commit:'a'.repeat(40)};
  const manifest={...expected,release_candidate:true,mode:'presentation',project_ref:'yiarlhpbgkofhhipkfha',app_origin:'https://buscag-prueba.web.app',approval:'REQUIRES_LIVE_REHEARSAL_AND_DEPLOY_AUTHORIZATION',files:await inventoryCandidate(directory)};
  const save=value=>writeFile(join(directory,'presentation-manifest.json'),JSON.stringify(value));
  await save(manifest);assert.equal((await verifyCandidate(directory,expected)).files,1);
  for(const delta of [{commit:'b'.repeat(40)},{version:'0.0.0'},{project_ref:'production'},{app_origin:'https://production.invalid'},{release_candidate:false},{approval:'APPROVED'}]){
   await save({...manifest,...delta});await assert.rejects(verifyCandidate(directory,expected));
  }
  await save(manifest);await writeFile(join(directory,'unexpected.txt'),'extra');await assert.rejects(verifyCandidate(directory,expected));
  await rm(join(directory,'unexpected.txt'));await writeFile(join(directory,'index.html'),'tampered');await assert.rejects(verifyCandidate(directory,expected));
  // A directory junction also works on Windows without file-symlink privileges.
  await symlink(directory,join(directory,'alias'),'junction');await assert.rejects(inventoryCandidate(directory),/enlaces/);
 }finally{await rm(directory,{recursive:true,force:true});}
});
