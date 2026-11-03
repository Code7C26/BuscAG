import test from 'node:test';
import assert from 'node:assert/strict';
import {createMessageIntents,deliverMessage} from '../../lib/messageDelivery';
const input={item_id:'item',sender_id:'sender',recipient_id:'recipient',sender_name:'',sender_avatar:'',item_title:'',item_image:'',text:'hello'};
test('message intents survive failed attempts and reset only after acknowledgement',()=>{
  const intents=createMessageIntents();const key=intents.key('thread');
  assert.equal(intents.key('thread'),key);assert.notEqual(intents.key('other'),key);
  intents.acknowledge('thread');assert.notEqual(intents.key('thread'),key);
  assert.notEqual(createMessageIntents().key('thread'),key);
});
test('missing RPC alone enables legacy compatibility',async()=>{
  let legacy=0;
  const row=await deliverMessage(input,'key',{rpc:async()=>({data:null,error:{code:'PGRST202'}}),legacy:async()=>{legacy++;return {data:{id:'legacy'},error:null};},isCurrent:()=>true});
  assert.deepEqual(row,{id:'legacy'});assert.equal(legacy,1);
});
test('ambiguous response never sends a second request through legacy INSERT',async()=>{
  for(const code of ['','42501','PGRST301','500']){
    let legacy=0;
    await assert.rejects(deliverMessage(input,'key',{rpc:async()=>({data:null,error:{code,message:'unknown'}}),legacy:async()=>{legacy++;return {data:null,error:null};},isCurrent:()=>true}));
    assert.equal(legacy,0);
  }
});
test('lost response can replay the same accepted message',async()=>{
  const accepted=new Map();let writes=0;let lose=true;
  const rpc=async(args:{p_request_key:string})=>{
    if(!accepted.has(args.p_request_key)){accepted.set(args.p_request_key,{id:'one'});writes++;}
    if(lose){lose=false;throw new Error('network');}return {data:accepted.get(args.p_request_key),error:null};
  };
  const transport={rpc,legacy:async()=>{throw new Error('must not fallback');},isCurrent:()=>true};
  await assert.rejects(deliverMessage(input,'same-key',transport));
  assert.deepEqual(await deliverMessage(input,'same-key',transport),{id:'one'});assert.equal(writes,1);
});
test('late RPC response cannot update a changed account or invoke legacy fallback',async()=>{
  let current=true;let legacy=false;
  await assert.rejects(deliverMessage(input,'key',{rpc:async()=>{current=false;return {data:null,error:{code:'PGRST202'}};},legacy:async()=>{legacy=true;return {data:null,error:null};},isCurrent:()=>current}),/sesión/);
  assert.equal(legacy,false);
});
