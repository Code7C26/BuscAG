import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {exportStorage,verifyStorage,backupConfiguration} from '../scripts/backup-storage.mjs';
function fixture(){
  const bytes=new Uint8Array([1,2,3]);const requests=[];
  const client={storage:{getBucket:async()=>({data:{public:true},error:null}),from(){return {
    list:async(prefix,{offset})=>{requests.push({kind:'list',prefix,offset});return {data:offset?[]:prefix?[{id:'synthetic',name:'photo.png',metadata:{size:3,mimetype:'image/png'}}]:[{id:null,name:'folder'}],error:null};},
    download:async(name)=>{requests.push({kind:'download',name});return {data:new Blob([bytes],{type:'image/png'}),error:null};}
  };}}};return {client,requests};
}
test('storage export uses only read APIs, follows capped pages and verifies exact bytes outside Git',async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'buscag-backup-'));const target=path.join(directory,'export');
  try {
    const {client,requests}=fixture();const result=await exportStorage(client,target,['item-images']);
    assert.equal(result.objects,1);assert.equal(result.snapshot_consistent,false);
    assert.equal((await verifyStorage(target)).verified,true);
    assert.ok(requests.some(r=>r.kind==='list'&&r.offset===1));
    await assert.rejects(exportStorage(client,target,['item-images']));
    const manifest=JSON.parse(await readFile(path.join(target,'manifest.json'),'utf8'));
    await writeFile(path.join(target,manifest.objects[0].file),new Uint8Array([9,9,9]));
    await assert.rejects(verifyStorage(target),/checksum/);
  }finally {await rm(directory,{recursive:true,force:true});}
});
test('a failed download never produces a complete backup manifest',async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'buscag-backup-'));const target=path.join(directory,'export');
  try {
    const {client}=fixture();client.storage.from=()=>({list:async(_,{offset})=>({data:offset?[]:[{id:'one',name:'photo.png',metadata:{size:3}}],error:null}),download:async()=>({data:null,error:Error('private')})});
    await assert.rejects(exportStorage(client,target,['item-images']));
    await assert.rejects(readFile(path.join(target,'manifest.json')));
  }finally {await rm(directory,{recursive:true,force:true});}
});

test('backup credentials cannot be sent to a foreign origin or confused with a client key',()=>{
  const fake='sb_secret_'+('synthetic'.repeat(8));
  for(const url of ['https://foreign.invalid','https://synthetic.supabase.co.evil.invalid','https://user:pass@synthetic.supabase.co','http://synthetic.supabase.co'])assert.throws(()=>backupConfiguration(url,fake));
  assert.throws(()=>backupConfiguration('https://synthetic.supabase.co','client-key'));
  assert.equal(backupConfiguration('https://synthetic.supabase.co',fake),'https://synthetic.supabase.co');
});
