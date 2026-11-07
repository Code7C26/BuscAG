// DOM integration with a mocked data client; no remote services or credentials.
import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import React,{act} from 'react';
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://app.invalid'});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
const {createRoot}=await import('react-dom/client');
const compiled=await build({stdin:{contents:`export {ProfileSettings} from './src/components/ProfileSettings';export {RecoveryPanel} from './src/components/RecoveryPanel';export {SafetyActions} from './src/components/SafetyActions';`,resolveDir:fileURLToPath(new URL('..',import.meta.url)),loader:'tsx'},bundle:true,write:false,format:'cjs',platform:'node',external:['react'],define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify('https://synthetic.invalid')},plugins:[{name:'test-client',setup(plugin){plugin.onResolve({filter:/(?:^|\/)supabase$/},()=>({path:'client',namespace:'mock'}));plugin.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const supabase=globalThis.__v1Client;',loader:'js'}));}}]});
const uid='e0000000-0000-4000-8000-000000000001';
async function mount(name:string,props:any,client:any){
 (globalThis as any).__v1Client=client;
 const module={exports:{} as any};new Function('require','module','exports',compiled.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 await act(async()=>{root.render(React.createElement(module.exports[name],props));});
 return {host,close:async()=>{await act(async()=>root.unmount());host.remove();}};
}
test('missing community RPC permits only baseline owner profile fields; success is reported after confirmed row',async()=>{
 const writes:any[]=[];let saved=0;
 const client={auth:{getUser:async()=>({data:{user:{id:uid}}})},rpc:async()=>({error:{code:'PGRST202'}}),from:(table:string)=>{
  assert.equal(table,'profiles');let update:any;let owner:any;
  const query={select:()=>query,eq:(key:string,value:string)=>{owner={key,value};return query;},update:(value:any)=>{update=value;return query;},maybeSingle:async()=>{
   if(update){writes.push({update,owner});return {data:{id:uid}};}
   return {data:{full_name:'Perfil de prueba',avatar_url:'',location:'Zona'}};
  }};return query;
 }};
 const screen=await mount('ProfileSettings',{userId:uid,onSaved:()=>saved++},client);
 try{
  assert.match(screen.host.textContent!,/Perfil básico disponible/);
  assert.doesNotMatch(screen.host.textContent!,/No tenés usuarios bloqueados|Sin valoraciones todavía/);
  assert.equal(screen.host.querySelector('input[type=tel]'),null);
  await act(async()=>{screen.host.querySelector('form')!.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));});
  assert.equal(saved,1);assert.deepEqual(writes,[{update:{full_name:'Perfil de prueba',avatar_url:'',location:'Zona'},owner:{key:'id',value:uid}}]);
  assert.match(screen.host.textContent!,/Perfil guardado/);
 }finally{await screen.close();}
});
for(const failure of [{code:'42501'},{code:'08006'}])test(`community ${failure.code} never enables direct profile fallback`,async()=>{
 let fallback=0;const screen=await mount('ProfileSettings',{userId:uid},{rpc:async()=>({error:failure}),from:()=>{fallback++;throw Error();}});
 try{assert.equal(fallback,0);assert.match(screen.host.textContent!,/No se pudo cargar el perfil/);assert.equal((screen.host.querySelector('fieldset') as HTMLFieldSetElement).disabled,true);}finally{await screen.close();}
});
for(const extrasFail of [false,true])test(`installed community profile stays editable independently of optional lists (${extrasFail?'lists unavailable':'complete'})`,async()=>{
 const writes:any[]=[];let saved=0;
 const profile={version:1,name:'Perfil completo',avatar:'',phone:'',share_phone:false,location:'',moderator:false};
 const screen=await mount('ProfileSettings',{userId:uid,onSaved:()=>saved++},{from:()=>{throw Error('Unexpected baseline fallback');},rpc:async(name:string,args:any)=>{
  if(name==='my_community_settings')return {data:profile};
  if(name==='save_my_profile'){writes.push(args);return {data:profile};}
  return extrasFail?{error:{code:'08006'}}:{data:[]};
 }});
 try{
  assert.ok(screen.host.querySelector('input[type=tel]'));assert.equal((screen.host.querySelector('fieldset') as HTMLFieldSetElement).disabled,false);
  if(extrasFail)assert.doesNotMatch(screen.host.textContent!,/No tenés usuarios bloqueados|Sin valoraciones todavía/);
  await act(async()=>{screen.host.querySelector('form')!.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));});
  assert.equal(saved,1);assert.equal(writes.length,1);assert.equal(writes[0].p_share,false);
 }finally{await screen.close();}
});
test('an expired account cannot save the baseline profile',async()=>{
 let writes=0,saved=0;
 const query:any={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:{full_name:'Perfil anterior',avatar_url:'',location:''}}),update:()=>{writes++;return query;}};
 const screen=await mount('ProfileSettings',{userId:uid,onSaved:()=>saved++},{rpc:async()=>({error:{code:'PGRST202'}}),from:()=>query,auth:{getUser:async()=>({data:{user:{id:'another-user'}}})}});
 try{await act(async()=>{screen.host.querySelector('form')!.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));});assert.equal(writes,0);assert.equal(saved,0);}finally{await screen.close();}
});
test('missing safety service shows availability, never empty block lists or report mutations',async()=>{
 const screen=await mount('SafetyActions',{userId:uid,targetUserId:'other',itemId:'item'},{rpc:async()=>({error:{code:'PGRST202'}})});
 try{assert.match(screen.host.textContent!,/todavía no están habilitados/);assert.equal(screen.host.querySelector('textarea'),null);assert.equal(screen.host.querySelector('select'),null);assert.doesNotMatch(screen.host.textContent!,/Bloquear usuario/);}finally{await screen.close();}
});
test('missing recovery leaves status intact and stops background polling until explicit retry',async()=>{
 let calls=0;const intervals:(()=>void)[]=[];const original=window.setInterval;
 window.setInterval=((fn:()=>void)=>{intervals.push(fn);return 1;}) as any;
 const screen=await mount('RecoveryPanel',{item:{id:'item',status:'perdido',user:{id:uid}},userId:uid,onChanged:()=>{throw Error('Unexpected status change');}},{rpc:async()=>{calls++;return {error:{code:'PGRST202'}};}});
 try{
  assert.match(screen.host.textContent!,/actualización pendiente/);assert.doesNotMatch(screen.host.textContent!,/Confirmar recuperación sin contraparte/);
  await act(async()=>{intervals.forEach(fn=>fn());window.dispatchEvent(new dom.window.Event('focus'));});assert.equal(calls,1);
 }finally{window.setInterval=original;await screen.close();}
});
