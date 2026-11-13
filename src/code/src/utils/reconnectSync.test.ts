import test from 'node:test';
import assert from 'node:assert/strict';
import {createReconnectSync} from './reconnectSync';
test('resume cooldown limits redundant reads while a real reconnect always reconciles',async()=>{
  let calls=0,time=0;const reconcile=createReconnectSync(async()=>{calls++;},()=>true,()=>time);
  await reconcile();await reconcile();assert.equal(calls,1);
  await reconcile(true);assert.equal(calls,2);
  time=15000;await reconcile();assert.equal(calls,3);
});
test('failed reconciliation can retry immediately; old sessions cannot start reads',async()=>{
  let fail=true,current=true,calls=0;
  const reconcile=createReconnectSync(async()=>{calls++;if(fail)throw new Error('offline');},()=>current,()=>0);
  await assert.rejects(reconcile());fail=false;await reconcile();assert.equal(calls,2);
  current=false;await reconcile(true);assert.equal(calls,2);
});
