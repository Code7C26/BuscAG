import test from 'node:test';
import assert from 'node:assert/strict';
import {createPublicationPublisher,type PublicationInput} from '../../lib/publicationDelivery';
const input:PublicationInput={owner_id:'a',title:'Synthetic',description:'Synthetic',category:'Otros',status:'perdido',location_name:'Synthetic',lat:0,lng:0,date:'2026-11-03',image_url:'data:image/png;base64,synthetic'};
test('publication retries reuse the upload and request after a lost response; acknowledgement permits a new identical post',async()=>{
  const publisher=createPublicationPublisher<{id:string}>();const keys:string[]=[];let uploads=0,fail=true;let legacy=0;
  const transport={upload:async()=>{uploads++;return 'https://images.invalid/saved';},rpc:async(args:{p_request_key:string;p_payload:unknown})=>{keys.push(args.p_request_key);assert.equal('owner_id' in (args.p_payload as object),false);if(fail){fail=false;throw Error('lost response');}return {data:{id:'one'},error:null};},legacy:async()=>{legacy++;return {data:null,error:null};},isCurrent:()=>true};
  await assert.rejects(publisher.publish(input,transport));await publisher.publish(input,transport);
  assert.equal(keys[0],keys[1]);assert.equal(uploads,1);assert.equal(legacy,0);
  await publisher.publish(input,transport);assert.notEqual(keys[2],keys[1]);assert.equal(uploads,2);
});
test('concurrent submissions share one promise and an upload failure retains its stable object key',async()=>{
  const publisher=createPublicationPublisher<{id:string}>();const uploadKeys:string[]=[];let fail=true,rpcs=0;
  const transport={upload:async(key:string)=>{uploadKeys.push(key);if(fail){fail=false;throw Error('upload response lost');}return 'https://images.invalid/saved';},rpc:async()=>{rpcs++;return {data:{id:'one'},error:null};},legacy:async()=>({data:null,error:null}),isCurrent:()=>true};
  const first=publisher.publish(input,transport);assert.equal(publisher.publish(input,transport),first);await assert.rejects(first);
  await publisher.publish(input,transport);assert.equal(uploadKeys[0],uploadKeys[1]);assert.equal(rpcs,1);
});
test('publication fallback is allowed only for an absent RPC and never after a stale account or uncertain error',async()=>{
  for(const code of ['PGRST202','42501','500']){
    let legacy=0;const publisher=createPublicationPublisher<{id:string}>();
    const operation=publisher.publish(input,{upload:async()=>input.image_url,rpc:async()=>({data:null,error:{code}}),legacy:async()=>{legacy++;return {data:{id:'legacy'},error:null};},isCurrent:()=>true});
    if(code==='PGRST202')await operation;else await assert.rejects(operation);assert.equal(legacy,code==='PGRST202'?1:0);
  }
  let current=true,rpcs=0;
  await assert.rejects(createPublicationPublisher().publish(input,{upload:async()=>{current=false;return 'saved';},rpc:async()=>{rpcs++;return {data:null,error:null};},legacy:async()=>({data:null,error:null}),isCurrent:()=>current}),/sesión/);assert.equal(rpcs,0);
});

test('an unacknowledged publication never shares intent or upload keys with another account instance',async()=>{
  const requests:string[]=[];const uploads:string[]=[];
  const transport={upload:async(key:string)=>{uploads.push(key);return 'https://images.invalid/saved';},rpc:async(args:{p_request_key:string})=>{requests.push(args.p_request_key);return {data:null,error:{code:'500'}};},legacy:async()=>({data:null,error:null}),isCurrent:()=>true};
  await assert.rejects(createPublicationPublisher().publish(input,transport));
  await assert.rejects(createPublicationPublisher().publish({...input,owner_id:'b'},transport));
  assert.notEqual(requests[0],requests[1]);assert.notEqual(uploads[0],uploads[1]);
});

test('staging publication requires its RPC and preserves intent on a missing-function error',async()=>{
  const publisher=createPublicationPublisher();let inserts=0;const keys:string[]=[];
  const transport={allowLegacy:false,isCurrent:()=>true,upload:async()=>input.image_url,
    rpc:async(args:{p_request_key:string})=>{keys.push(args.p_request_key);return {data:null,error:{code:'PGRST202'}};},
    legacy:async()=>{inserts++;return {data:{id:'unexpected'},error:null};}};
  await assert.rejects(publisher.publish(input,transport));await assert.rejects(publisher.publish(input,transport));
  assert.equal(inserts,0);assert.equal(keys[0],keys[1]);
});
