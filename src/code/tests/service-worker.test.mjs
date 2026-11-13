import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const code=await readFile(new URL('../public/sw.js',import.meta.url),'utf8');
function worker(){
  const handlers={}, shown=[],opened=[];
  vm.runInNewContext(code,{URL,self:{location:{origin:'https://buscag.invalid'},addEventListener:(name,cb)=>handlers[name]=cb,
    registration:{showNotification:async(title,options)=>{shown.push({title,options});}},clients:{matchAll:async()=>[],openWindow:async url=>opened.push(url)}}});
  return {handlers,shown,opened};
}
test('service worker tolerates malformed and absent JSON payloads',async()=>{
  const w=worker();let pending;w.handlers.push({data:{json(){throw Error('bad');}},waitUntil:p=>pending=p});await pending;
  assert.equal(w.shown[0].title,'BuscAG');
});
test('redelivery of the same persisted notice uses one stable browser notification tag',async()=>{
 const w=worker();for(let attempt=0;attempt<2;attempt++){
  let pending;w.handlers.push({data:{json:()=>({title:'Aviso',url:'/?notification=10000000-0000-4000-8000-000000000001'})},waitUntil:p=>pending=p});await pending;
 }
 assert.equal(w.shown[0].options.tag,w.shown[1].options.tag);assert.equal(w.shown[0].options.renotify,false);
 const other=worker();let pending;other.handlers.push({data:{json:()=>({url:'https://other.invalid/?notification=private-id'})},waitUntil:p=>pending=p});await pending;
 assert.equal(other.shown[0].options.tag,undefined);
});
test('notification click preserves only same-origin links, rejecting invalid and external destinations',async()=>{
  for(const [target,expected] of [['/?notification=example','https://buscag.invalid/?notification=example'],['https://evil.invalid','https://buscag.invalid'],['http://[','https://buscag.invalid']]){
    const w=worker();let pending;w.handlers.notificationclick({notification:{data:{url:target},close(){}},waitUntil:p=>pending=p});await pending;assert.equal(w.opened[0],expected);
  }
});

test('offline worker caches only its public fallback and language script and never handles API or other asset requests',async()=>{
 const handlers={},added=[],matched=[];
 const cache={addAll:async paths=>added.push(...paths),match:async path=>{matched.push(path);return {offline:true};}};
 vm.runInNewContext(code,{URL,fetch:async()=>{throw Error('offline');},caches:{open:async()=>cache,keys:async()=>[]},self:{location:{origin:'https://buscag.invalid'},addEventListener:(name,fn)=>handlers[name]=fn}});
 let pending;handlers.install({waitUntil:p=>pending=p});await pending;assert.deepEqual(added,['/offline.html','/offline.js']);
 for(const request of [{method:'POST',mode:'navigate',url:'https://buscag.invalid/'},{method:'GET',mode:'cors',url:'https://project.supabase.co/rest/v1/messages'},{method:'GET',mode:'cors',url:'https://buscag.invalid/offline.js?token=private'},{method:'GET',mode:'cors',url:'https://foreign.invalid/offline.js'}])handlers.fetch({request,respondWith(){assert.fail('must not intercept private/API data');}});
 handlers.fetch({request:{method:'GET',mode:'navigate',url:'https://buscag.invalid/?code=private'},respondWith:p=>pending=p});
 assert.deepEqual(await pending,{offline:true});assert.deepEqual(matched,['/offline.html']);
 handlers.fetch({request:{method:'GET',mode:'cors',url:'https://buscag.invalid/offline.js'},respondWith:p=>pending=p});
 assert.deepEqual(await pending,{offline:true});assert.deepEqual(matched,['/offline.html','/offline.js']);
});
