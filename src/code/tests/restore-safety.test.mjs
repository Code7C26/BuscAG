import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDisposableContainer} from './backupRestoreDrill.mjs';
const socket='/tmp/buscag-synthetic-socket';
const isolated=()=>({disposable:'true',network:'none',tmpfs:{'/var/lib/postgresql/data':''},mounts:[{Source:socket,Destination:'/var/run/postgresql'}]});
test('restore rehearsal accepts the explicit tmpfs test cluster and rejects persistent/networked or mismatched targets',()=>{
  assert.doesNotThrow(()=>validateDisposableContainer(isolated(),socket));
  for(const change of [info=>{info.disposable=null;},info=>{info.network='bridge';},info=>{info.tmpfs={};},info=>{info.mounts[0].Source='/tmp/another-cluster';}]){
    const info=isolated();change(info);assert.throws(()=>validateDisposableContainer(info,socket));
  }
});
