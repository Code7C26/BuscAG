// React/DOM regression tests: all backend, GPS and Leaflet operations are simulated.
import assert from 'node:assert/strict';
import { test, after, afterEach, beforeEach } from 'node:test';
import { JSDOM } from 'jsdom';
import { build } from 'esbuild';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://buscag.invalid' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document,
  HTMLElement: dom.window.HTMLElement, FileReader: dom.window.FileReader, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { createElement: h, act, StrictMode } = await import('react');
const { createRoot } = await import('react-dom/client');
const dir = await mkdtemp(path.resolve('node_modules/.production-tests-'));
const sources = {
  auth: `export const supabase = new Proxy({}, { get: (_, key) => globalThis.__production.client[key] });`,
  data: `export const loadItems=(...a)=>globalThis.__production.data.loadItems(...a);
    export const loadMessages=(...a)=>globalThis.__production.data.loadMessages(...a);
    export const loadNotifications=(...a)=>globalThis.__production.data.loadNotifications(...a);
    export const loadProfile=(...a)=>globalThis.__production.data.loadProfile(...a);
    export const uploadItemImage=(...a)=>globalThis.__production.data.uploadItemImage(...a);
    export const mapItem=(row,user)=>({...row,user}); export const mapMessage=row=>row;
    export const mapNotification=row=>row;`,
  push: `export const getPushNotificationStatus=(...a)=>globalThis.__production.push.status(...a);
    export const enablePushNotifications=(...a)=>globalThis.__production.push.enable(...a);
    export const disablePushNotifications=(...a)=>globalThis.__production.push.disable(...a);
    export const disconnectPushDevice=(...a)=>globalThis.__production.push.disconnect(...a);`,
  leaflet: `export default globalThis.__leaflet;`
};
async function bundle(entry, app = false) {
  const outfile = path.join(dir, path.basename(entry) + '.mjs');
  await build({ entryPoints: [entry], outfile, bundle: true, platform: 'node', format: 'esm',
    external: ['react', 'react-dom', 'react-dom/*', 'lucide-react', 'qrcode'], plugins: [{ name: 'offline', setup(p) {
      p.onResolve({ filter: /(^|\/)supabase(\.ts)?$/ }, () => ({ path: 'auth', namespace: 'mock' }));
      p.onResolve({ filter: /^leaflet$/ }, () => ({ path: 'leaflet', namespace: 'mock' }));
      if (app) {
        p.onResolve({ filter: /\/lib\/database$/ }, () => ({ path: 'data', namespace: 'mock' }));
        p.onResolve({ filter: /\/lib\/push$/ }, () => ({ path: 'push', namespace: 'mock' }));
        p.onResolve({ filter: /^\.\/components\// }, args => ({ path: args.path.split('/').pop(), namespace: 'view' }));
      }
      p.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: sources[args.path], loader: 'js' }));
      p.onLoad({ filter: /.*/, namespace: 'view' }, args => ({ contents: `import React from 'react';
        export const ${args.path} = props => {
          globalThis.__production.views['${args.path}'] = props;
          return React.createElement('div', {'data-view':'${args.path}'}, props.item?.user?.phone || '');
        };`, loader: 'js' }));
    } }] });
  return import(pathToFileURL(outfile));
}
let roots = [];
const defer = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; };
const user = id => ({ id, name: `User ${id}`, avatar: 'https://images.invalid/avatar.png', email: '', phone: `private-${id}`, rating: 5, location: 'private' });
const item = (id = 'item-a', owner = 'a') => ({ id, user: user(owner), title: 'Synthetic', description: 'Synthetic',
  category: 'Otros', status: 'encontrado', locationName: 'Synthetic', lat: 0, lng: 0,
  date: new Date().toISOString(), createdAt: new Date().toISOString(), imageUrl: 'https://images.invalid/item.png', contactCount: 0 });
let maps = [], markers = [];
const leaflet = {
  map(_element, options) {
    assert.ok(options.center.every(Number.isFinite));
    const map = { handlers: {}, on(name, cb) { this.handlers[name]=cb; return this; },
      remove() {}, invalidateSize() {}, setView() { return this; }, panTo() {} };
    maps.push(map); return map;
  },
  marker(coords) {
    assert.ok(coords.every(Number.isFinite)); assert.ok(Math.abs(coords[0])<=90 && Math.abs(coords[1])<=180);
    const marker={coords, handlers:{}, addTo(){ return this; }, on(n,cb){ this.handlers[n]=cb;return this; },
      setLatLng(){ return this; },getLatLng(){return {lat:0,lng:0};},bindTooltip(){return this;}};
    markers.push(marker); return marker;
  },
  tileLayer() { return { addTo() {} }; }, divIcon() { return {}; },
  layerGroup() { return { addTo(){ return this; }, clearLayers(){}, addLayer(){} }; },
  control:{ zoom(){ return { addTo(){} }; } }
};
globalThis.__leaflet = leaflet;
let mock;
function resetMock() {
  const startup=defer();
  mock={startup, listeners:[], views:{}, queries:[], channels:[], removed:0,
    result: async query => ({data:query.operation==='delete'?{id:'item-a'}:{id:'message-new',text:query.payload?.text},error:null}),
    data:{ loadProfile:async u=>user(u.id),loadItems:async()=>[item()],loadMessages:async()=>[],loadNotifications:async()=>[],uploadItemImage:async()=> 'synthetic-image' },
    push:{ status:async()=>false,enable:async()=>{},disable:async()=>{},disconnect:async()=>{} }
  };
  mock.client={
    rpc(){ return {single:async()=>({data:null,error:{code:'PGRST202'}})}; },
    auth:{onAuthStateChange(cb){ mock.listeners.push(cb);return {data:{subscription:{unsubscribe(){mock.listeners=mock.listeners.filter(x=>x!==cb);}}}};},
      getSession:()=>startup.promise,signOut:async()=>{ mock.emit(null);return {error:null}; }},
    channel(){ const c={handlers:[],on(_type,filter,cb){this.handlers.push({filter,cb});return this;},subscribe(cb){this.status=cb;return this;}};mock.channels.push(c);return c;},
    removeChannel:async()=>{mock.removed++;},
    from(table){ const query={table,filters:[]}; mock.queries.push(query);
      const q={insert(payload){query.operation='insert';query.payload=payload;return q;},
        update(payload){query.operation='update';query.payload=payload;return q;},delete(){query.operation='delete';return q;},
        select(){return q;},in(...args){query.filters.push(args);return q;},eq(...args){query.filters.push(args);return q;},
        single(){return mock.result(query);},maybeSingle(){return mock.result(query);},
        then(resolve,reject){return mock.result(query).then(resolve,reject);}};return q; }
  };
  mock.emit=(id,event=id?'SIGNED_IN':'SIGNED_OUT')=>mock.listeners.forEach(cb=>cb(event,{user:id?{id}:null}));
  globalThis.__production=mock;
}
resetMock();
const {default:App}=await bundle('src/App.tsx',true);
const {PublishModal}=await bundle('src/components/PublishModal.tsx');
const {ContactModal}=await bundle('src/components/ContactModal.tsx');
const {AuthView}=await bundle('src/components/AuthView.tsx');
const {AppErrorBoundary}=await bundle('src/components/AppErrorBoundary.tsx');
const {MapView}=await bundle('src/components/MapView.tsx');
const {ItemDetailModal}=await bundle('src/components/ItemDetailModal.tsx');
const {ItemCard}=await bundle('src/components/ItemCard.tsx');
const {PublicProfileModal}=await bundle('src/components/PublicProfileModal.tsx');
async function mount(Component, props={}, strict=false, choosePhoto=true) {
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);roots.push(root);
  const render=async next=>act(async()=>root.render(strict?h(StrictMode,null,h(Component,next)):h(Component,next)));
  await render(props);
  // Most publication regressions start with an explicitly chosen sample photo.
  if (Component === PublishModal && props.isOpen && !props.initialItem && choosePhoto) {
    await click([...host.querySelectorAll('button')].find(button => button.textContent === 'Mochila'));
  }
  return {host,render};
}
async function change(input,value) {
  await act(async()=>{
    const proto=input.tagName==='TEXTAREA'?window.HTMLTextAreaElement.prototype:window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto,'value').set.call(input,value);
    input.dispatchEvent(new window.Event('input',{bubbles:true}));
  });
}
const submit=async host=>act(async()=>host.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));
const click=async element=>act(async()=>element.click());
const emit=async id=>act(async()=>mock.emit(id));
const settle=async()=>act(async()=>{await Promise.resolve();});
beforeEach(()=>{resetMock();maps=[];markers=[];window.confirm=()=>false;window.alert=()=>{};});
afterEach(async()=>{await act(async()=>{for(const root of roots)root.unmount();});roots=[];document.body.innerHTML='';});
after(async()=>{dom.window.close();await rm(dir,{recursive:true,force:true});});

test('account switch resets every private selection, GPS, filters and drafts; old startup read cannot restore A', async()=>{
  await mount(App);await emit('a');
  await act(async()=>mock.views.Header.onOpenProfile());
  await act(async()=>mock.views.ProfileView.onViewItem(item()));
  await act(async()=>mock.views.ProfileView.onOpenPublish());
  assert.ok(mock.views.ItemDetailModal.item);
  await emit('b');
  assert.equal(mock.views.Header.currentUser.id,'b');
  assert.equal(mock.views.ItemDetailModal.item,null);
  assert.equal(mock.views.ContactModal.item,null);
  assert.equal(mock.views.PublishModal.isOpen,false);
  assert.equal(mock.views.Header.activeTab,'home');
  await act(async()=>mock.startup.resolve({data:{session:{user:{id:'a'}}},error:null}));
  assert.equal(mock.views.Header.currentUser.id,'b');
  await act(async()=>mock.views.Header.onOpenProfile());
  await act(async()=>mock.views.ProfileView.onSignOut());
  assert.ok(document.querySelector('[data-view="AuthView"]'));
});

test('late data, realtime, push and GPS from A cannot update B (including StrictMode)',async()=>{
  const oldData=defer(),oldPush=defer();let gps;
  mock.data.loadMessages=()=>oldData.promise;mock.push.status=()=>oldPush.promise;
  await mount(App,{},true);await emit('a');
  const channel=mock.channels.at(-1);
  mock.data.loadMessages=async()=>[];mock.push.status=async()=>false;
  await emit('b');
  await act(async()=>mock.views.Header.onSelectTab('map'));
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(cb){gps=cb;}}});
  let location;
  await act(async()=>{ location=mock.views.MapView.onLocateMe();location.catch(()=>{}); });
  await emit('c');
  await act(async()=>{oldData.resolve([{id:'private-a'}]);oldPush.resolve(true);gps({coords:{latitude:10,longitude:20}});});
  await location.catch(()=>{});
  await act(async()=>mock.views.Header.onOpenProfile());
  assert.equal(mock.views.ProfileView.currentUser.id,'c');assert.equal(mock.views.ProfileView.pushEnabled,false);
  const before=mock.queries.length;await act(async()=>channel.handlers[0].cb());assert.equal(mock.queries.length,before);
  await act(async()=>mock.views.Header.onSelectTab('map'));
  assert.equal(mock.views.MapView.userLat,undefined);assert.ok(mock.removed>0);
});

test('logout during upload prevents the subsequent publication INSERT',async()=>{
  const upload=defer();mock.data.uploadItemImage=()=>upload.promise;
  await mount(App);await emit('a');let pending;
  await act(async()=>{pending=mock.views.PublishModal.onSubmit(item());pending.catch(()=>{});});
  await emit('b');await act(async()=>upload.resolve('uploaded-before-logout'));
  await assert.rejects(pending,/sesión/);
  assert.equal(mock.queries.filter(q=>q.table==='items'&&q.operation==='insert').length,0);
});

test('every deletion entry point confirms and cancellation sends no delete',async()=>{
  await mount(App);await emit('a');await act(async()=>mock.views.Header.onOpenProfile());
  const fromProfile=mock.views.ProfileView.onDeleteItem;
  await act(async()=>mock.views.ProfileView.onViewItem(item()));
  const fromDetail=mock.views.ItemDetailModal.onDeleteItem;
  let prompts=0;window.confirm=message=>{assert.match(message,/conversaciones/);prompts++;return false;};
  await act(async()=>fromProfile('item-a'));await act(async()=>fromDetail('item-a'));
  assert.equal(prompts,2);assert.equal(mock.queries.filter(q=>q.operation==='delete').length,0);
  window.confirm=()=>true;await act(async()=>fromProfile('item-a'));
  assert.equal(mock.queries.filter(q=>q.operation==='delete').length,1);
});

test('failed message retains draft; duplicate submit and preset clicks share one pending send',async()=>{
  const pending=defer();let calls=0;
  const props={item:item(),isOpen:true,currentUser:user('b'),messages:[],participantId:'a',onMarkThreadRead:()=>{},
    onSendMessage:()=>{calls++;return pending.promise;}};
  const {host}=await mount(ContactModal,props);await change(host.querySelector('input'),'draft');
  await submit(host);await submit(host);
  await click([...host.querySelectorAll('button')].find(b=>b.textContent.includes('¿Aún')));
  assert.equal(calls,1);assert.equal(host.querySelector('input').value,'draft');
  await act(async()=>pending.reject(new Error('offline')));
  assert.equal(host.querySelector('input').value,'draft');assert.equal(host.querySelector('button[type="submit"]').disabled,false);
});

test('successful send clears only its own draft, and a late response cannot clear a new thread',async()=>{
  const pending=defer();const props={item:item(),isOpen:true,currentUser:user('b'),messages:[],participantId:'a',onMarkThreadRead:()=>{},onSendMessage:()=>pending.promise};
  const {host,render}=await mount(ContactModal,props);await change(host.querySelector('input'),'sent');await submit(host);
  await render({...props,participantId:'c'});await change(host.querySelector('input'),'new private draft');
  await act(async()=>pending.resolve());assert.equal(host.querySelector('input').value,'new private draft');
  await render({...props,participantId:'c',onSendMessage:async()=>{}});await submit(host);
  assert.equal(host.querySelector('input').value,'');
});

test('App deduplicates concurrent identical messages and ignores completion after account change',async()=>{
  const pending=defer();mock.result=()=>pending.promise;
  await mount(App);await emit('b');await act(async()=>mock.views.Header.onSelectTab('map'));
  await act(async()=>mock.views.MapView.onSelectPublication(item()));
  const send=mock.views.ContactModal.onSendMessage;let one,two;
  await act(async()=>{one=send('item-a','same','a');two=send('item-a','same','a');one.catch(()=>{});two.catch(()=>{});});
  assert.equal(one,two);assert.equal(mock.queries.filter(q=>q.table==='messages').length,1);
  await emit('c');await act(async()=>pending.resolve({data:{id:'old-message'},error:null}));
  await assert.rejects(one,/sesión/);assert.equal(document.body.textContent.includes('No se pudo enviar'),false);
});

test('publication requires an explicit valid map location, preserves failure draft and resets only after success',async()=>{
  let calls=0,close=0,fail=true;
  const props={isOpen:true,currentUser:user('a'),onClose:()=>{close++;},onSubmit:async()=>{calls++;if(fail)throw Error('offline');}};
  const {host,render}=await mount(PublishModal,props);
  const title=()=>host.querySelector('input[placeholder^="Ej: Mochila"]');
  await change(title(),'Private title');await change(host.querySelector('textarea'),'Description');
  await submit(host);assert.equal(calls,0);assert.match(host.textContent,/Confirma una ubicación/);
  await act(async()=>maps.at(-1).handlers.click({latlng:{lat:NaN,lng:0}}));await submit(host);assert.equal(calls,0);
  await act(async()=>maps.at(-1).handlers.click({latlng:{lat:0,lng:0}}));
  await submit(host);assert.equal(calls,1);assert.equal(title().value,'Private title');assert.equal(close,0);
  fail=false;await submit(host);assert.equal(calls,2);assert.equal(title().value,'');assert.equal(host.querySelector('textarea').value,'');assert.equal(close,1);
  await render({...props,isOpen:false});await render(props);await change(title(),'Second');await change(host.querySelector('textarea'),'Second');
  await submit(host);assert.equal(calls,2); // reset also removes the old location confirmation
});

test('GPS must be valid; typing a place name never confirms default coordinates',async()=>{
  let calls=0,callback;
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(cb){callback=cb;}}});
  const {host}=await mount(PublishModal,{isOpen:true,currentUser:user('a'),onClose:()=>{},onSubmit:async()=>{calls++;}});
  await change(host.querySelector('input[placeholder^="Ej: Mochila"]'),'Title');await change(host.querySelector('textarea'),'Description');
  await change(host.querySelector('input[placeholder^="Ej: Plaza"]'),'Typed address');await submit(host);assert.equal(calls,0);
  await click([...host.querySelectorAll('button')].find(b=>b.textContent.includes('Usar mi GPS')));
  await act(async()=>callback({coords:{latitude:91,longitude:0}}));await submit(host);assert.equal(calls,0);
  await act(async()=>callback({coords:{latitude:0,longitude:0}}));await submit(host);assert.equal(calls,1);
});

test('invalid legacy coordinates never reach Leaflet; existing publication remains available in detail',async()=>{
  const invalid={...item('invalid'),lat:NaN,lng:200};
  await mount(MapView,{items:[invalid,item('valid')],userLat:Infinity,userLng:0,onSelectPublication:()=>{},onLocateMe:async()=>({lat:0,lng:0})});
  assert.equal(markers.length,1);assert.deepEqual(markers[0].coords,[0,0]);
  const before=maps.length;const {host}=await mount(ItemDetailModal,{item:invalid,currentUser:user('b'),onClose:()=>{},onContact:()=>{}});
  assert.equal(maps.length,before);assert.ok(host.textContent.includes('Synthetic'));
});


test('token refresh for the same account preserves its selected publication and draft modal',async()=>{
  await mount(App);await emit('a');await act(async()=>mock.views.Header.onOpenProfile());
  await act(async()=>mock.views.ProfileView.onViewItem(item()));await act(async()=>mock.views.ProfileView.onOpenPublish());
  await emit('a');assert.equal(mock.views.ItemDetailModal.item.id,'item-a');assert.equal(mock.views.PublishModal.isOpen,true);
});

test('detail deletion closes only after confirmed successful deletion, without a second prompt',async()=>{
  let deleted=false,closed=0,prompts=0;window.confirm=()=>{prompts++;return true;};
  const props={item:item(),currentUser:user('a'),onClose:()=>{closed++;},onContact:()=>{},onDeleteItem:async()=>deleted};
  const {host}=await mount(ItemDetailModal,props);
  const button=()=>[...host.querySelectorAll('button')].find(b=>b.textContent.includes('Eliminar'));
  await click(button());assert.equal(closed,0);deleted=true;await click(button());assert.equal(closed,1);assert.equal(prompts,0);
});

test('rapid publication submits issue one request; GPS from a closed form cannot confirm a reopened form',async()=>{
  let gps,calls=0;const pending=defer();
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(cb){gps=cb;}}});
  const props={isOpen:true,currentUser:user('a'),onClose:()=>{},onSubmit:()=>{calls++;return pending.promise;}};
  const {host,render}=await mount(PublishModal,props);
  await click([...host.querySelectorAll('button')].find(b=>b.textContent.includes('Usar mi GPS')));
  await render({...props,isOpen:false});await render(props);
  await act(async()=>gps({coords:{latitude:0,longitude:0}}));
  await change(host.querySelector('input[placeholder^="Ej: Mochila"]'),'Title');await change(host.querySelector('textarea'),'Description');
  await submit(host);assert.equal(calls,0);
  await act(async()=>maps.at(-1).handlers.click({latlng:{lat:0,lng:0}}));await submit(host);await submit(host);assert.equal(calls,1);
  await act(async()=>pending.resolve());
});


test('a failed App send releases the request lock for an explicit retry',async()=>{
  let calls=0;mock.result=async()=>{calls++;return calls===1?{data:null,error:new Error('offline')}:{data:{id:'sent-on-retry',text:'draft'},error:null};};
  await mount(App);await emit('b');
  const send=mock.views.ContactModal.onSendMessage;
  await act(async()=>{await assert.rejects(send('item-a','draft','a'),/offline/);});
  await act(async()=>send('item-a','draft','a'));assert.equal(calls,2);
});

test('a confirmed map point still permits a descriptive address without changing coordinates',async()=>{
  let submitted;
  const {host}=await mount(PublishModal,{isOpen:true,currentUser:user('a'),onClose:()=>{},onSubmit:async data=>{submitted=data;}});
  await change(host.querySelector('input[placeholder^="Ej: Mochila"]'),'Title');await change(host.querySelector('textarea'),'Description');
  await act(async()=>maps.at(-1).handlers.click({latlng:{lat:10,lng:20}}));
  await change(host.querySelector('input[placeholder^="Ej: Plaza"]'),'Descriptive meeting point');await submit(host);
  assert.equal(submitted.locationName,'Descriptive meeting point');assert.equal(submitted.lat,10);assert.equal(submitted.lng,20);
});


test('password recovery and confirmation resend use safe redirects and suppress duplicate requests',async()=>{
  let reset=0,resend=0;const pending=defer();
  mock.client.auth.resetPasswordForEmail=(email,options)=>{reset++;assert.equal(email,'user@example.invalid');assert.equal(options.redirectTo,'https://buscag.invalid/?auth=recovery');return pending.promise;};
  mock.client.auth.resend=async options=>{resend++;assert.equal(options.type,'signup');return {error:null};};
  const {host}=await mount(AuthView);
  await click([...host.querySelectorAll('button')].find(b=>b.textContent==='Recuperar contraseña'));
  await change(host.querySelector('input[type="email"]'),'user@example.invalid');await submit(host);await submit(host);assert.equal(reset,1);
  await act(async()=>pending.resolve({error:null}));assert.match(host.textContent,/Si la cuenta/);
  await click([...host.querySelectorAll('button')].find(b=>b.textContent==='Inicia sesión'));
  await click([...host.querySelectorAll('button')].find(b=>b.textContent==='Reenviar confirmación'));await submit(host);assert.equal(resend,1);
});

test('password update validates length and exits only on confirmed success',async()=>{
  let calls=0,done=0,fail=true;mock.client.auth.updateUser=async()=>{calls++;return {error:fail?{code:'weak_password'}:null};};
  const {host}=await mount(AuthView,{recovery:true,onRecovered:()=>{done++;}});
  await change(host.querySelector('input[type="password"]'),'short');await submit(host);assert.equal(calls,0);
  await change(host.querySelector('input[type="password"]'),'synthetic-strong-password');await submit(host);assert.equal(done,0);assert.match(host.textContent,/más segura/);
  fail=false;await submit(host);assert.equal(done,1);assert.equal(host.querySelector('input[type="password"]').value,'');
});

test('only an authenticated recovery event or explicit account action opens password update',async()=>{
  window.history.replaceState(null,'','/?auth=recovery');await mount(App);await emit('a');
  assert.ok(document.querySelector('[data-view="Header"]'));
  await act(async()=>mock.emit('a','PASSWORD_RECOVERY'));assert.equal(mock.views.AuthView.recovery,true);
  await act(async()=>mock.views.AuthView.onRecovered());assert.ok(document.querySelector('[data-view="Header"]'));
  window.history.replaceState(null,'','/');
});

test('incoming unread messages are marked while a chat is already open without clearing its draft',async()=>{
  let marked=0;const props={item:item(),isOpen:true,currentUser:user('b'),participantId:'a',messages:[],onMarkThreadRead:()=>{marked++;},onSendMessage:async()=>{}};
  const {host,render}=await mount(ContactModal,props);await change(host.querySelector('input'),'draft');
  const message={id:'incoming',itemId:'item-a',senderId:'a',receiverId:'b',text:'hello',timestamp:new Date().toISOString(),isRead:false};
  await render({...props,messages:[message]});assert.equal(marked,1);assert.equal(host.querySelector('input').value,'draft');
  await render({...props,messages:[{...message,isRead:true}]});assert.equal(marked,1);
});

test('recovery celebration waits for server success',async()=>{
  let success=false;const props={item:item(),currentUser:user('a'),onClose:()=>{},onContact:()=>{},onMarkAsRecovered:async()=>success};
  const {host}=await mount(ItemDetailModal,props);const button=()=>[...host.querySelectorAll('button')].find(b=>b.textContent.includes('Marcar como Recuperado'));
  await click(button());assert.ok(!host.textContent.includes('¡Felicidades!'));success=true;await click(button());assert.ok(host.textContent.includes('¡Felicidades!'));
});

test('editing changes content only, preserves ID/ownership/count and does not reupload an unchanged image',async()=>{
  let uploads=0;mock.data.uploadItemImage=async()=>{uploads++;return 'changed';};
  mock.result=async query=>({data:{...item(),title:query.payload?.title??'Synthetic'},error:null});
  await mount(App);await emit('a');await act(async()=>mock.views.Header.onOpenProfile());
  await act(async()=>mock.views.ProfileView.onEditItem(item()));
  assert.equal(mock.views.PublishModal.initialItem.id,'item-a');
  await act(async()=>mock.views.PublishModal.onSubmit({...item(),title:'Edited'}));
  const query=mock.queries.find(q=>q.operation==='update');assert.equal(query.payload.title,'Edited');
  for(const forbidden of ['id','owner_id','contact_count','created_at'])assert.equal(forbidden in query.payload,false);
  assert.ok(query.filters.some(([key,value])=>key==='owner_id'&&value==='a'));assert.equal(uploads,0);
});

test('editing existing valid coordinates works without deleting or replacing the original record',async()=>{
  let saved;const {host}=await mount(PublishModal,{isOpen:true,initialItem:item(),currentUser:user('a'),onClose:()=>{},onSubmit:async data=>{saved=data;}});
  assert.equal(host.querySelector('input[placeholder^="Ej: Mochila"]').value,'Synthetic');
  await change(host.querySelector('input[placeholder^="Ej: Mochila"]'),'Updated');await submit(host);assert.equal(saved.title,'Updated');assert.equal(saved.lat,0);
});

test('dialogs associate labels, trap focus and close with Escape without changing classes',async()=>{
  const opener=document.createElement('button');document.body.append(opener);opener.focus();let closed=0;
  const {host}=await mount(PublishModal,{isOpen:true,currentUser:user('a'),onClose:()=>{closed++;},onSubmit:async()=>{}});
  const dialog=host.querySelector('[role="dialog"]');assert.equal(dialog.getAttribute('aria-modal'),'true');
  for(const label of host.querySelectorAll('label[for]'))assert.ok(document.getElementById(label.htmlFor));
  const first=dialog.querySelector('button');first.focus();
  await act(async()=>document.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
  assert.equal(closed,1);
});

test('logout revokes browser push before Auth signout and never signs out a newly switched account',async()=>{
  const pending=defer();let signouts=0;mock.push.disconnect=()=>pending.promise;
  mock.client.auth.signOut=async()=>{signouts++;return {error:null};};
  await mount(App);await emit('a');await act(async()=>mock.views.Header.onOpenProfile());
  await act(async()=>mock.views.ProfileView.onSignOut());await emit('b');
  await act(async()=>pending.resolve());assert.equal(signouts,0);
});


test('render errors show a recoverable fallback instead of a blank page',async()=>{
  const previous=console.error;console.error=()=>{};
  try {
    function Broken(){throw Error('synthetic-render-failure');}
    const {host}=await mount(AppErrorBoundary,{children:h(Broken)});
    assert.ok(host.querySelector('[role="alert"]'));assert.match(host.textContent,/Recarga/);assert.ok(!host.textContent.includes('synthetic-render-failure'));
  } finally {console.error=previous;}
});

test('notification deep links open only records visible to the current account',async()=>{
  window.history.replaceState(null,'','/?notification=notice-a');
  mock.data.loadNotifications=async()=>[{id:'notice-a',read:true,type:'match',relatedItemId:'item-a',title:'Owned notice'}];
  await mount(App);await emit('a');assert.equal(mock.views.Header.activeTab,'notifications');assert.equal(mock.views.ItemDetailModal.item.id,'item-a');
  assert.equal(new URL(window.location.href).searchParams.has('notification'),false);
});

test('push cleanup failures do not prevent logout and are shown without private error details',async()=>{
  mock.push.disconnect=async()=>{throw Error('PRIVATE_ENDPOINT');};await mount(App);await emit('a');await act(async()=>mock.views.Header.onOpenProfile());
  await act(async()=>mock.views.ProfileView.onSignOut());assert.ok(document.querySelector('[data-view="AuthView"]'));
  assert.match(mock.views.AuthView.notice,/push/);assert.ok(!mock.views.AuthView.notice.includes('PRIVATE_ENDPOINT'));
});


test('token renewal does not reload all data and an old push status cannot undo a new toggle',async()=>{
  let reads=0;const pending=defer();mock.data.loadItems=async()=>{reads++;return [item()];};mock.push.status=()=>pending.promise;
  await mount(App);await emit('a');await emit('a');assert.equal(reads,1);
  await act(async()=>mock.views.Header.onOpenProfile());await act(async()=>mock.views.ProfileView.onTogglePush(true));
  assert.equal(mock.views.ProfileView.pushEnabled,true);await act(async()=>pending.resolve(false));assert.equal(mock.views.ProfileView.pushEnabled,true);
});


test('new publications never silently use a demo photo and successful saves clear the selection',async()=>{
  let calls=0;const {host}=await mount(PublishModal,{isOpen:true,currentUser:user('a'),onClose:()=>{},onSubmit:async()=>{calls++;}},false,false);
  await change(host.querySelector('input[placeholder^="Ej: Mochila"]'),'Title');await change(host.querySelector('textarea'),'Description');
  await act(async()=>maps.at(-1).handlers.click({latlng:{lat:0,lng:0}}));await submit(host);assert.equal(calls,0);assert.match(host.textContent,/Selecciona una foto/);
  await click([...host.querySelectorAll('button')].find(button=>button.textContent==='Mochila'));await submit(host);assert.equal(calls,1);assert.equal(host.querySelector('img'),null);
});


test('dropping a file validates it and reads a real selected image without navigation',async()=>{
  const {host}=await mount(PublishModal,{isOpen:true,currentUser:user('a'),onClose:()=>{},onSubmit:async()=>{}},false,false);
  const target=host.querySelector('[aria-label="Subir foto"]');
  const OriginalReader=globalThis.FileReader;
  let readFinished=Promise.resolve();
  globalThis.FileReader=class extends OriginalReader {
    readAsDataURL(file) {
      readFinished=new Promise(resolve=>this.addEventListener('loadend',resolve,{once:true}));
      super.readAsDataURL(file);
    }
  };
  const drop=async file=>act(async()=>{const event=new window.Event('drop',{bubbles:true,cancelable:true});Object.defineProperty(event,'dataTransfer',{value:{files:[file]}});target.dispatchEvent(event);await readFinished;assert.equal(event.defaultPrevented,true);});
  try {
  await drop(new window.File(['not-image'],'bad.txt',{type:'text/plain'}));assert.match(host.textContent,/JPG, PNG o WebP/);assert.equal(host.querySelector('img'),null);
  await drop(new window.File(['synthetic-image'],'photo.png',{type:'image/png'}));assert.match(host.querySelector('img').src,/^data:image\/png/);
  } finally {globalThis.FileReader=OriginalReader;}
});


test('reconnect and resume reconcile missed messages and notices; old channels cannot reload another account',async()=>{
  let loads=0;mock.data.loadMessages=async()=>{loads++;return [];};
  await mount(App);await emit('a');const first=mock.channels.at(-1);const before=loads;
  await act(async()=>first.status('SUBSCRIBED'));assert.ok(loads>before);
  const reconnected=loads;
  await act(async()=>window.dispatchEvent(new window.Event('focus')));assert.equal(loads,reconnected);
  await emit('b');const afterSwitch=loads;
  await act(async()=>first.status('SUBSCRIBED'));assert.equal(loads,afterSwitch);
  const second=mock.channels.at(-1);
  await act(async()=>second.status('SUBSCRIBED'));assert.ok(loads>afterSwitch);
});

test('recovery requires ownership and confirmation and concurrent clicks share one server mutation',async()=>{
  await mount(App);await emit('a');await act(async()=>mock.views.Header.onOpenProfile());
  const recover=mock.views.ProfileView.onMarkAsRecovered;
  assert.equal(await recover('not-owned'),false);
  assert.equal(await recover('item-a'),false);assert.equal(mock.queries.length,0);
  window.confirm=()=>true;const pending=defer();mock.result=()=>pending.promise;
  let first,second;
  await act(async()=>{first=recover('item-a');second=recover('item-a');});
  assert.equal(first,second);assert.equal(mock.queries.length,1);
  await act(async()=>pending.resolve({data:{id:'item-a'},error:null}));assert.equal(await first,true);
  assert.ok(mock.queries[0].filters.some(([column,value])=>column==='owner_id'&&value==='a'));
});


test('read confirmation cannot mark a notification arriving during the pending request',async()=>{
  const notice=id=>({id,title:'Synthetic',message:'Synthetic',date:new Date().toISOString(),type:'match',read:false});
  mock.data.loadNotifications=async()=>[notice('old')];
  await mount(App);await emit('a');await act(async()=>mock.views.BottomNav.onSelectTab('notifications'));
  const pending=defer();mock.result=()=>pending.promise;
  await act(async()=>mock.views.NotificationsView.onMarkAllRead());
  assert.ok(mock.queries[0].filters.some(([column,ids])=>column==='id'&&ids.length===1&&ids[0]==='old'));
  mock.data.loadNotifications=async()=>[notice('new'),notice('old')];
  await act(async()=>mock.channels.at(-1).handlers.find(h=>h.filter.table==='notifications').cb());
  await settle();
  await act(async()=>pending.resolve({data:[{id:'old'}],error:null}));
  assert.equal(mock.views.NotificationsView.notifications.find(n=>n.id==='old').read,true);
  assert.equal(mock.views.NotificationsView.notifications.find(n=>n.id==='new').read,false);
});


test('a changed read callback never erases a conversation draft',async()=>{
  const props={item:item(),isOpen:true,currentUser:user('b'),messages:[],participantId:'a',onMarkThreadRead:()=>{},onSendMessage:async()=>{}};
  const {host,render}=await mount(ContactModal,props);await change(host.querySelector('input'),'Keep this draft');
  await render({...props,onMarkThreadRead:()=>{}});assert.equal(host.querySelector('input').value,'Keep this draft');
});


test('publication retry after an uncertain RPC response keeps its request key and uploaded image',async()=>{
  let uploads=0;const keys=[];let fail=true;
  mock.data.uploadItemImage=async()=>{uploads++;return 'https://images.invalid/saved';};
  mock.client.rpc=(name,args)=>({single:async()=>{
    if(name!=='publish_item_once')return {data:null,error:{code:'PGRST202'}};
    keys.push(args.p_request_key);
    return fail?{data:null,error:{code:'FETCH_ERROR'}}:{data:{...item('published'),date:args.p_payload.date},error:null};
  }});
  await mount(App);await emit('a');const publish=mock.views.PublishModal.onSubmit;const draft=item();
  await act(async()=>{await assert.rejects(publish(draft));});
  fail=false;await act(async()=>publish(draft));
  assert.equal(keys[0],keys[1]);assert.equal(uploads,1);assert.equal(mock.queries.filter(q=>q.operation==='insert').length,0);
});


test('legacy missing content is labelled honestly and editing requires explicit classification',async()=>{
  const legacy={...item(),title:'',description:'',category:'',status:null,date:'',lat:NaN,lng:NaN,imageUrl:''};
  const card=await mount(ItemCard,{item:legacy,onViewMore:()=>{}});
  assert.match(card.host.textContent,/Publicación sin título/);assert.match(card.host.textContent,/Estado sin informar/);assert.match(card.host.textContent,/Categoría sin informar/);
  let saves=0;const form=await mount(PublishModal,{isOpen:true,initialItem:legacy,currentUser:user('a'),onClose:()=>{},onSubmit:async()=>{saves++;}});
  assert.equal(form.host.querySelector('select').value,'');await submit(form.host);assert.equal(saves,0);assert.match(form.host.textContent,/categoría y estado válidos/);
});

test('publish and edit reject SQL-incompatible text before image upload or backend writes',async()=>{
  let uploads=0;mock.data.uploadItemImage=async()=>{uploads++;return 'https://images.invalid/new';};
  await mount(App);await emit('a');
  for(const changes of [{title:'x'.repeat(201)},{description:'x'.repeat(10001)},{locationName:'x'.repeat(301)},{reward:'x'.repeat(201)},{title:'bad\u0000title'},{status:'recuperado'}]){
    await act(async()=>assert.rejects(mock.views.PublishModal.onSubmit({...item(),...changes})));
  }
  assert.equal(uploads,0);assert.equal(mock.queries.length,0);
  await act(async()=>mock.views.Header.onOpenProfile());
  await act(async()=>mock.views.ProfileView.onEditItem(item()));
  await act(async()=>assert.rejects(mock.views.PublishModal.onSubmit({...item(),title:'x'.repeat(201),imageUrl:'data:image/png;base64,AA=='}),/200/));
  assert.equal(uploads,0);assert.equal(mock.queries.length,0);
});

test('publication dialog preserves over-limit draft and displays error without submitting',async()=>{
  let calls=0;const {host}=await mount(PublishModal,{isOpen:true,initialItem:item(),currentUser:user('a'),onClose:()=>{},onSubmit:async()=>{calls++;}});
  const title=host.querySelector('input[placeholder^="Ej: Mochila"]');
  await change(title,'x'.repeat(201));await submit(host);
  assert.equal(calls,0);assert.equal(title.value.length,201);assert.match(host.textContent,/200 caracteres/);
});

test('editing another field preserves unchanged legacy over-limit text accepted by SQL',async()=>{
  const legacy={...item(),description:'x'.repeat(10001)};
  mock.data.loadItems=async()=>[legacy];mock.result=async query=>({data:{...legacy,...query.payload},error:null});
  await mount(App);await emit('a');await act(async()=>mock.views.Header.onOpenProfile());
  await act(async()=>mock.views.ProfileView.onEditItem(legacy));
  await act(async()=>mock.views.PublishModal.onSubmit({...legacy,title:'Updated'}));
  const update=mock.queries.find(q=>q.operation==='update');assert.equal(update.payload.description,legacy.description);
});

test('a successful resend does not claim delivery and repeated attempts are locally throttled',async()=>{
 let requests=0;mock.client.auth.resend=async()=>{requests++;return {error:null};};
 const {host}=await mount(AuthView);
 await click([...host.querySelectorAll('button')].find(b=>b.textContent==='Reenviar confirmación'));
 await change(host.querySelector('input[type=email]'),'confirmed@example.invalid');await submit(host);await submit(host);
 assert.equal(requests,1);assert.match(host.textContent,/no confirma la entrega/);assert.match(host.textContent,/ya confirmaste/);
 assert.equal(host.querySelector('button[type=submit]').disabled,true);
});

test('mail rate limit failures keep the email and apply a retry cooldown',async()=>{
 let requests=0;mock.client.auth.resend=async()=>{requests++;return {error:{code:'over_email_send_rate_limit',status:429}};};
 const {host}=await mount(AuthView);await click([...host.querySelectorAll('button')].find(b=>b.textContent==='Reenviar confirmación'));
 await change(host.querySelector('input[type=email]'),'limited@example.invalid');await submit(host);await submit(host);
 assert.equal(requests,1);assert.equal(host.querySelector('input[type=email]').value,'limited@example.invalid');assert.equal(host.querySelector('button[type=submit]').disabled,true);
 assert.match(host.textContent,/Espera/);
});

test('duplicate logout requests share one Auth operation and request only the current-device scope',async()=>{
 const pending=defer();let requests=0;
 mock.client.auth.signOut=async options=>{requests++;assert.equal(options.scope,'local');await pending.promise;mock.emit(null);return {error:null};};
 await mount(App);await emit('a');await act(async()=>mock.views.Header.onOpenProfile());
 await act(async()=>{mock.views.ProfileView.onSignOut();mock.views.ProfileView.onSignOut();});
 assert.equal(requests,1);assert.equal(mock.views.ProfileView.isSigningOut,true);
 await act(async()=>pending.resolve());assert.ok(document.querySelector('[data-view="AuthView"]'));
});
test('failed Auth signout preserves the honest account state and exposes a sanitized retry message',async()=>{
 mock.client.auth.signOut=async()=>({error:{message:'PRIVATE_AUTH_RESPONSE',code:'server_error'}});
 await mount(App);await emit('a');await act(async()=>mock.views.Header.onOpenProfile());
 await act(async()=>mock.views.ProfileView.onSignOut());assert.ok(document.querySelector('[data-view="ProfileView"]'));
 assert.equal(mock.views.ProfileView.isSigningOut,false);assert.match(mock.views.ProfileView.signOutError,/Tu sesión sigue abierta/);assert.ok(!mock.views.ProfileView.signOutError.includes('PRIVATE_AUTH_RESPONSE'));
});
test('public profile deliberately omits email, phone, locality and account actions even when supplied in memory',async()=>{
 const owner={...user('other'),email:'private@example.invalid',phone:'PRIVATE_PHONE',location:'PRIVATE_LOCALITY'};
 const {host}=await mount(PublicProfileModal,{user:owner,items:[item('public-item','other')],onClose:()=>{},onViewItem:()=>{}});
 for(const privateValue of ['private@example.invalid','PRIVATE_PHONE','PRIVATE_LOCALITY','Cerrar sesión','Cambiar contraseña'])assert.ok(!host.textContent.includes(privateValue));
 assert.match(host.textContent,/Perfil público/);
});

test('detail keeps legacy items without images usable instead of rendering a broken image',async()=>{
 const target={...item(),imageUrl:''};const {host}=await mount(ItemDetailModal,{item:target,currentUser:user('a'),onClose:()=>{},onContact:()=>{},allItems:[]});
 assert.ok(host.textContent.includes('Foto no disponible'));assert.equal(host.querySelector('img[alt="Synthetic"]'),null);
});

test('top modal still handles Escape when an asynchronous disabled control drops focus to body',async()=>{
 let closed=0;await mount(ItemDetailModal,{item:item(),currentUser:user('a'),onClose:()=>{closed++;},onContact:()=>{},allItems:[]});
 document.activeElement?.blur();assert.equal(document.activeElement,document.body);
 await act(async()=>document.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));assert.equal(closed,1);
});
