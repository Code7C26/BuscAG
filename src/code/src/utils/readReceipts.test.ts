import test from 'node:test';
import assert from 'node:assert/strict';
import {persistReadReceipts} from '../../lib/readReceipts';
test('read receipts batch unique IDs and update only server-confirmed rows',async()=>{
  const ids=Array.from({length:205},(_,i)=>String(i));const sizes:number[]=[];const confirmed=new Set<string>();
  await persistReadReceipts([...ids,'0'],async batch=>{sizes.push(batch.length);return {data:[{id:batch[0]},{id:'unrequested'}],error:null};},()=>true,batch=>batch.forEach(id=>confirmed.add(id)));
  assert.deepEqual(sizes,[100,100,5]);assert.deepEqual([...confirmed],['0','100','200']);
});
test('read failures retain unconfirmed rows and halt later batches',async()=>{
  let calls=0;const confirmed:string[]=[];
  await assert.rejects(persistReadReceipts(Array.from({length:201},(_,i)=>String(i)),async batch=>{
    calls++;return calls===1?{data:batch.map(id=>({id})),error:null}:{data:null,error:new Error('offline')};
  },()=>true,batch=>confirmed.push(...batch)),/offline/);
  assert.equal(calls,2);assert.equal(confirmed.length,100);
});
test('account changes discard a delayed read acknowledgement and prevent later batches',async()=>{
  let current=true,calls=0,updates=0;
  await persistReadReceipts(Array.from({length:201},(_,i)=>String(i)),async batch=>{calls++;current=false;return {data:batch.map(id=>({id})),error:null};},()=>current,()=>{updates++;});
  assert.equal(calls,1);assert.equal(updates,0);
});
