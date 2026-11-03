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
        in(column, values) { call.ids = [column, values]; return query; },
        eq(column, value) { call.filter = [column, value]; return query; },
        maybeSingle() { return query; },
        then(resolve, reject) { return Promise.resolve(response).then(resolve, reject); }
      };
      return query;
    }
  };
  const result = await build({
    absWorkingDir: new URL('..', import.meta.url).pathname,
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
  console.log(`PASS: ${passed} offline client security checks`);
} finally {
  delete globalThis.__securityTestClient;
  delete globalThis.window;
}
