// Browser APIs and Supabase simulated; never requests a real permission/subscription.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const publicKey=Buffer.from([4,...Array(64).fill(1)]).toString('base64url');let revision=0;
async function setup(key=publicKey){
 const calls={permission:0,register:0,subscribe:0,unsubscribe:0,save:0,delete:0,closed:0},state={own:[],permission:'granted',current:true,error:null};
 const subscription={endpoint:'https://fcm.googleapis.com/synthetic',options:{applicationServerKey:Buffer.from(publicKey,'base64url')},toJSON:()=>({keys:{p256dh:'synthetic',auth:'synthetic'}}),unsubscribe:async()=>{calls.unsubscribe++;existing=null;return true;}};
 let existing=null;
 const registration={pushManager:{getSubscription:async()=>existing,subscribe:async()=>{calls.subscribe++;existing=subscription;return subscription;}},getNotifications:async()=>[{close:()=>calls.closed++}]};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{userAgent:'iPhone',serviceWorker:{register:async()=>{calls.register++;return registration;},getRegistration:async()=>registration,ready:Promise.resolve(registration)}}});
 globalThis.Notification={permission:'granted',requestPermission:async()=>{calls.permission++;return state.permission;}};
 globalThis.window={Notification:globalThis.Notification,PushManager:{}};
 globalThis.__pushClient={from:()=>{let operation='read',row;const q={select:()=>q,eq:()=>q,delete:()=>{operation='delete';return q;},upsert:value=>{operation='save';row=value;return q;},then:(resolve,reject)=>{
  if(operation==='save'){calls.save++;state.own=[{endpoint:row.endpoint}];}if(operation==='delete'){calls.delete++;state.own=[];}
  return Promise.resolve({data:state.own,error:state.error}).then(resolve,reject);
 }};return q;}};
 const result=await build({entryPoints:['lib/push.ts'],bundle:true,write:false,platform:'node',format:'esm',define:{'import.meta.env.VITE_VAPID_PUBLIC_KEY':JSON.stringify(key)},plugins:[{name:'client',setup(p){p.onResolve({filter:/^\.\/supabase$/},()=>({path:'client',namespace:'mock'}));p.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const supabase=globalThis.__pushClient;'}));}}]});
 const module=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text+'\n//'+(++revision)).toString('base64'));
 return {module,calls,state,subscription,existing:()=>{existing=subscription;}};
}
test('push configuration is checked before permission; denied permissions never save a device',async()=>{
 let f=await setup('');await assert.rejects(f.module.enablePushNotifications('a'),/aún no están habilitadas/);assert.equal(f.calls.permission,0);
 f=await setup();f.state.permission='denied';await assert.rejects(f.module.enablePushNotifications('a'),/bloqueó/);assert.equal(f.calls.save,0);assert.equal(f.calls.register,0);
});
test('explicit enable reuses this account subscription and disable deletes only its own endpoint',async()=>{
 const f=await setup();await f.module.enablePushNotifications('a');await f.module.enablePushNotifications('a');
 assert.equal(f.calls.subscribe,1);assert.equal(await f.module.getPushNotificationStatus('a'),true);
 await f.module.disablePushNotifications('a');assert.equal(f.calls.delete,1);assert.equal(f.calls.unsubscribe,1);assert.equal(await f.module.getPushNotificationStatus('a'),false);
});
test('a different session revokes the stale browser subscription without deleting another account rows',async()=>{
 const f=await setup();f.existing();await f.module.reconcilePushSession('b');assert.equal(f.calls.unsubscribe,1);assert.equal(f.calls.delete,0);assert.equal(f.calls.closed,1);
});
test('a session changed while permission is pending cannot subscribe or write',async()=>{
 const f=await setup();globalThis.Notification.requestPermission=async()=>{f.state.current=false;return 'granted';};
 await assert.rejects(f.module.enablePushNotifications('a',()=>f.state.current),/sesión/);assert.equal(f.calls.save,0);assert.equal(f.calls.subscribe,0);
});
test('permission revoked in system settings does not appear enabled and queued session revocation closes notices',async()=>{
 const f=await setup();f.existing();globalThis.Notification.permission='denied';assert.equal(await f.module.getPushNotificationStatus('a'),false);
 await f.module.revokePushOnSessionChange();assert.equal(f.calls.unsubscribe,1);assert.equal(f.calls.closed,1);
});

test('a failed session revocation is reported but does not poison later explicit retry',async()=>{
 const f=await setup();f.existing();const unsubscribe=f.subscription.unsubscribe;
 f.subscription.unsubscribe=async()=>false;
 await assert.rejects(f.module.revokePushOnSessionChange(),/desactivar/);
 f.subscription.unsubscribe=unsubscribe;
 await f.module.enablePushNotifications('b');assert.equal(f.calls.save,1);assert.equal(f.calls.unsubscribe,1);
});

test('unverifiable ownership revokes locally and never retains another account capability',async()=>{
 const f=await setup();f.existing();f.state.error={code:'NETWORK_ERROR'};
 await assert.rejects(f.module.reconcilePushSession('b'),/verificar la cuenta/);
 assert.equal(f.calls.unsubscribe,1);assert.equal(f.calls.delete,0);assert.equal(f.calls.closed,1);
});
