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
test('notification click preserves only same-origin links, rejecting invalid and external destinations',async()=>{
  for(const [target,expected] of [['/?notification=example','https://buscag.invalid/?notification=example'],['https://evil.invalid','https://buscag.invalid'],['http://[','https://buscag.invalid']]){
    const w=worker();let pending;w.handlers.notificationclick({notification:{data:{url:target},close(){}},waitUntil:p=>pending=p});await pending;assert.equal(w.opened[0],expected);
  }
});

test('offline worker caches only its public fallback and never handles API or non-navigation requests',async()=>{
 const handlers={},added=[],matched=[];
 const cache={add:async path=>added.push(path),match:async path=>{matched.push(path);return {offline:true};}};
 vm.runInNewContext(code,{URL,fetch:async()=>{throw Error('offline');},caches:{open:async()=>cache,keys:async()=>[]},self:{location:{origin:'https://buscag.invalid'},addEventListener:(name,fn)=>handlers[name]=fn}});
 let pending;handlers.install({waitUntil:p=>pending=p});await pending;assert.deepEqual(added,['/offline.html']);
 for(const request of [{method:'POST',mode:'navigate',url:'https://buscag.invalid/'},{method:'GET',mode:'cors',url:'https://project.supabase.co/rest/v1/messages'}])handlers.fetch({request,respondWith(){assert.fail('must not intercept private/API data');}});
 handlers.fetch({request:{method:'GET',mode:'navigate',url:'https://buscag.invalid/?code=private'},respondWith:p=>pending=p});
 assert.deepEqual(await pending,{offline:true});assert.deepEqual(matched,['/offline.html']);
});
