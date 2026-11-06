// Data-layer regression tests. Supabase is mocked before bundling; no network calls.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
let passed = 0;
const profile = { id: 'synthetic-user', full_name: 'Synthetic', avatar_url: '',
  rating: 5, created_at: '2026-01-01T00:00:00Z', phone: '', location: '' };
const item = { id: 'synthetic-item', owner_id: profile.id, title: 'Synthetic',
  description: 'Synthetic', category: 'Otros', status: 'encontrado', location_name: 'Synthetic',
  lat: 0, lng: 0, date: '2026-01-01T00:00:00Z', image_url: '', reward: null,
  contact_count: 0, created_at: '2026-01-01T00:00:00Z' };
async function loadModule(file, responses) {
  const calls = [];
  globalThis.__securityTestClient = {
    from(table) {
      const call = { table };
      calls.push(call);
      const response = responses[table];
      assert.ok(response, `Unexpected table access: ${table}`);
      const query = {
        select(columns) { call.columns = columns; return query; },
        order() { return query; },
        range(from, to) { call.range = [from, to]; return query; },
        in(column, values) { call.ids = [column, values]; return query; },
        eq(column, value) { call.filter = [column, value]; return query; },
        or(condition) { call.or = condition; return query; },
        maybeSingle() { return query; },
        then(resolve, reject) {
          if (typeof response === 'function') return Promise.resolve(response(call.range)).then(resolve,reject);
          const output = call.range && Array.isArray(response.data)
            ? { ...response, data: response.data.slice(call.range[0], call.range[1] + 1), count: response.data.length } : response;
          return Promise.resolve(output).then(resolve, reject);
        }
      };
      return query;
    }
  };
  const result = await build({
    absWorkingDir: new URL('..', import.meta.url).pathname,
    define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify('https://synthetic.supabase.co')},
    entryPoints: [file], bundle: true, write: false, platform: 'node', format: 'esm',
    plugins: [{ name: 'mock-supabase', setup(plugin) {
      plugin.onResolve({ filter: /^\.\/supabase$/ }, () => ({ path: 'client', namespace: 'mock' }));
      plugin.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({
        contents: 'export const supabase = globalThis.__securityTestClient;', loader: 'js'
      }));
    } }]
  });
  // Unique module identity makes each mock independent.
  const code = result.outputFiles[0].text + `\n// test instance ${passed}`;
  const module = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
  return { module, calls };
}
async function check(name, run) { await run(); passed++; console.log(`ok ${passed} - ${name}`); }
try {
  await check('repeated IDs in chat/notice snapshots do not duplicate unread counts while distinct equal-text messages remain distinct', async()=>{
    const message={id:'one',item_id:item.id,sender_id:profile.id,recipient_id:'peer',sender_name:'Synthetic',sender_avatar:'',item_title:item.title,item_image:'',text:'Same text',created_at:'2026-11-06T12:00:00Z',is_read:false};
    const notice={id:'notice-one',user_id:profile.id,title:'Notice',message:'Body',created_at:'2026-11-06T12:00:00Z',type:'system',is_read:false};
    const {module,calls}=await loadModule('lib/database.ts',{
      messages:{data:[message,{...message,is_read:true},{...message,id:'two'}],error:null},
      notifications:{data:[notice,{...notice,is_read:true}],error:null}
    });
    const messages=await module.loadMessages(profile.id),notifications=await module.loadNotifications(profile.id);
    assert.equal(messages.length,2);assert.equal(messages.find(row=>row.id==='one').isRead,true);
    assert.equal(notifications.length,1);assert.equal(notifications[0].read,true);
    assert.ok(calls.find(call=>call.table==='messages').or.includes(profile.id));
  });
  await check('overlapping feed pages render each ID once and retain the actual owner even without a directory profile', async () => {
    const first = Array.from({length:100},(_,index)=>({...item,id:`item-${index}`}));
    const foreign = {...item,id:'foreign-item',owner_id:'another-account'};
    const {module} = await loadModule('lib/database.ts', {
      items: range => ({data:range[0]===0?first:[first[99],foreign],count:102,error:null}),
      public_profiles:{data:[profile],error:null}
    });
    const rows = await module.loadItems();
    assert.equal(rows.length,101);assert.equal(new Set(rows.map(row=>row.id)).size,101);
    assert.equal(rows.find(row=>row.id==='foreign-item').user.id,'another-account');
  });
  await check('item authors are loaded through the controlled directory', async () => {
    const { module, calls } = await loadModule('lib/database.ts', {
      items: { data: [item], error: null }, public_profiles: { data: [profile], error: null }
    });
    const items = await module.loadItems();
    assert.equal(items[0].user.name, 'Synthetic');
    assert.equal(items[0].user.phone, '');
    assert.deepEqual(calls.map(c => c.table), ['items', 'public_profiles']);
    assert.deepEqual(calls[1].ids, ['id', [profile.id]]);
  });
  await check('missing directory falls back to an explicit projection without private fields', async () => {
    const { phone, location, ...publicFields } = profile;
    const { module, calls } = await loadModule('lib/database.ts', {
      items: { data: [item], error: null },
      public_profiles: { data: null, error: { code: 'PGRST205' } },
      profiles: { data: [publicFields], error: null }
    });
    const items = await module.loadItems();
    assert.equal(items[0].user.phone, '');
    assert.equal(items[0].user.location, '');
    assert.equal(calls.find(c => c.table === 'profiles').columns, 'id, full_name, avatar_url, rating, created_at');
    assert.deepEqual(calls.find(c => c.table === 'profiles').ids, ['id', [profile.id]]);
  });
  await check('directory permission errors do not trigger a broader fallback', async () => {
    const error = { code: '42501', message: 'Denied' };
    const { module, calls } = await loadModule('lib/database.ts', {
      items: { data: [item], error: null }, public_profiles: { data: null, error }
    });
    await assert.rejects(module.loadItems(), e => e === error);
    assert.ok(!calls.some(c => c.table === 'profiles'));
  });
  await check('empty listings do not request any profile', async () => {
    const { module, calls } = await loadModule('lib/database.ts', {
      items: { data: [], error: null }
    });
    assert.deepEqual(await module.loadItems(), []);
    assert.deepEqual(calls.map(c => c.table), ['items']);
  });
  await check('legacy items without owners retain their fallback without profile queries', async () => {
    const { module, calls } = await loadModule('lib/database.ts', {
      items: { data: [{ ...item, owner_id: null }], error: null }
    });
    const rows = await module.loadItems();
    assert.equal(rows[0].user.name, 'Cuenta anterior');
    assert.deepEqual(calls.map(c => c.table), ['items']);
  });
  await check('own-profile loading still requests the complete self-filtered row', async () => {
    const { module, calls } = await loadModule('lib/database.ts', {
      profiles: { data: { ...profile, phone: 'private-synthetic' }, error: null }
    });
    const user = await module.loadProfile({ id: profile.id, email: '', user_metadata: {} });
    assert.equal(user.phone, 'private-synthetic');
    assert.deepEqual(calls[0].filter, ['id', profile.id]);
  });
  await check('profile fallback cannot write after its session expires during the read', async () => {
    const { module, calls } = await loadModule('lib/database.ts', { profiles: { data: null, error: null } });
    let checks = 0;
    await assert.rejects(module.loadProfile({ id: profile.id, user_metadata: {} }, () => ++checks === 1), /sesión/);
    assert.equal(calls.length, 1);
  });
  await check('an expired session cannot begin an image upload', async () => {
    const { module, calls } = await loadModule('lib/database.ts', {});
    await assert.rejects(module.uploadItemImage('https://images.invalid/example.png', profile.id, () => false), /sesión/);
    assert.equal(calls.length, 0);
  });
  globalThis.window = { Notification: {}, PushManager: {} };
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true, value: { serviceWorker: { getRegistration: async () => undefined } }
  });
  for (const code of ['PGRST205', '42P01']) {
    await check(`optional push status tolerates missing table (${code})`, async () => {
      const { module } = await loadModule('lib/push.ts', {
        push_subscriptions: { data: null, error: { code } }
      });
      assert.equal(await module.getPushNotificationStatus(profile.id), false);
    });
  }
  await check('push permission failures remain visible to the caller', async () => {
    const error = { code: '42501', message: 'Denied' };
    const { module } = await loadModule('lib/push.ts', {
      push_subscriptions: { data: null, error }
    });
    await assert.rejects(module.getPushNotificationStatus(profile.id), e => e === error);
  });
  await check('expired sessions cannot enable or disable browser push', async () => {
    const { module, calls } = await loadModule('lib/push.ts', {});
    await assert.rejects(module.enablePushNotifications(profile.id, () => false), /sesión/);
    await assert.rejects(module.disablePushNotifications(profile.id, () => false), /sesión/);
    assert.equal(calls.length, 0);
  });
  await check('logout disconnect revokes browser push and closes notices without deleting database rows', async () => {
    let unsubscribed = 0, closed = 0;
    navigator.serviceWorker.getRegistration = async () => ({
      pushManager: { getSubscription: async () => ({ unsubscribe: async () => { unsubscribed++; return true; } }) },
      getNotifications: async () => [{ close: () => { closed++; } }]
    });
    const { module, calls } = await loadModule('lib/push.ts', {});
    await module.disconnectPushDevice();
    assert.equal(unsubscribed, 1); assert.equal(closed, 1); assert.equal(calls.length, 0);
  });
  await check('lost upload responses reuse a stable path and accept only identical stored bytes without overwriting',async()=>{
    const {module}=await loadModule('lib/database.ts',{});
    const originalFetch=globalThis.fetch;const bytes=new Uint8Array([1,2,3,4]);const paths=[];let attempt=0,downloads=0;
    globalThis.fetch=async()=>new Response(bytes,{headers:{'content-type':'image/png'}});
    globalThis.__securityTestClient.storage={from(bucket){assert.equal(bucket,'item-images');return {
      async upload(path,_image,options){paths.push(path);assert.equal(options.upsert,false);return {error:++attempt===1?{statusCode:'0'}:{statusCode:'409'}};},
      async download(){downloads++;return {data:new Blob([bytes]),error:null};},
      getPublicUrl(path){return {data:{publicUrl:'https://synthetic.supabase.co/storage/v1/object/public/item-images/'+path}};}
    };}};
    const key='90000000-0000-4000-8000-000000000001';
    try {
      await assert.rejects(module.uploadItemImage('data:image/png;base64,AQIDBA==',profile.id,()=>true,key));
      const url=await module.uploadItemImage('data:image/png;base64,AQIDBA==',profile.id,()=>true,key);
      assert.equal(paths[0],paths[1]);assert.equal(downloads,1);assert.ok(url.endsWith(key+'.png'));
    }finally {globalThis.fetch=originalFetch;}
  });
  await check('upload collision with different bytes is rejected without replacing the object',async()=>{
    const {module}=await loadModule('lib/database.ts',{});const originalFetch=globalThis.fetch;
    globalThis.fetch=async()=>new Response(new Uint8Array([1]),{headers:{'content-type':'image/png'}});
    globalThis.__securityTestClient.storage={from(){return {
      async upload(_path,_image,options){assert.equal(options.upsert,false);return {error:{statusCode:'409'}};},
      async download(){return {data:new Blob([new Uint8Array([2])]),error:null};},
      getPublicUrl(){throw Error('must not accept a different image');}
    };}};
    try {await assert.rejects(module.uploadItemImage('data:image/png;base64,AQ==',profile.id,()=>true,'90000000-0000-4000-8000-000000000002'),/no coincide/);}
    finally {globalThis.fetch=originalFetch;}
  });
  await check('nullable production content stays readable without invented category, status, coordinates or dates',async()=>{
    const {module}=await loadModule('lib/database.ts',{});
    const mapped=module.mapItem({...item,title:null,description:null,category:null,status:null,location_name:null,lat:null,lng:null,date:null,image_url:null},{id:'synthetic'});
    assert.equal(mapped.title,'');assert.equal(mapped.description,'');assert.equal(mapped.category,'');assert.equal(mapped.status,null);
    assert.equal(mapped.date,'');assert.equal(mapped.imageUrl,'');assert.equal(mapped.locationName,'');assert.ok(Number.isNaN(mapped.lat));assert.ok(Number.isNaN(mapped.lng));
    assert.doesNotThrow(()=>mapped.title.toLowerCase()+mapped.category.toLowerCase());
    const custom=module.mapItem({...item,category:'Clasificación anterior',status:'pendiente'},{id:'synthetic'});
    assert.equal(custom.category,'Clasificación anterior');assert.equal(custom.status,'pendiente');
  });
  console.log(`PASS: ${passed} offline client security checks`);
} finally {
  delete globalThis.__securityTestClient;
  delete globalThis.window;
}
