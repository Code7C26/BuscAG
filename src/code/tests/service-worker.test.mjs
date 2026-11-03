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
