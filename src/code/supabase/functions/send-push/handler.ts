import {sameServerSecret,usableServerSecret} from '../_shared/serverSecret.ts';
export type Subscription = { endpoint: string; p256dh: string; auth: string };
type Notice = { id: string; user_id: string; title: string; message: string };
export type PushDependencies = {
  env: (name: string) => string | undefined;
  backend: (url: string, key: string) => {
    notice: (id: string) => Promise<Notice | null>;
    subscriptions: (userId: string) => Promise<Subscription[]>;
    removeExpired: (endpoint: string, userId: string) => Promise<void>;
  };
  configure: (subject: string, publicKey: string, privateKey: string) => void;
  send: (subscription: Subscription, payload: string) => Promise<void>;
  log: (event: string) => void;
};

/** Provider allowlist prevents client-controlled endpoints from becoming arbitrary SSRF. */
export function validPushEndpoint(endpoint: string): boolean {
  try {
    if (endpoint.length > 4096) return false;
    const url = new URL(endpoint);
    const trusted = ['fcm.googleapis.com','android.googleapis.com','web.push.apple.com','push.services.mozilla.com'].includes(url.hostname)
      || url.hostname.endsWith('.push.services.mozilla.com') || url.hostname.endsWith('.notify.windows.com');
    return trusted && url.protocol === 'https:' && (!url.port || url.port === '443')
      && !url.username && !url.password && !url.hash;
  } catch { return false; }
}
const json = (value: object, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
});
async function boundedPayload(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('invalid');
  let length = 0; const chunks: Uint8Array[] = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 16_384) { await reader.cancel(); throw new Error('too_large'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
export function createPushHandler(deps: PushDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
    const values = ['PUSH_WEBHOOK_SECRET','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY',
      'PUSH_VAPID_PUBLIC_KEY','PUSH_VAPID_PRIVATE_KEY','PUSH_VAPID_SUBJECT'].map(deps.env);
    if (values.some(value => !value)||!usableServerSecret(values[0])) return json({ error: 'Push delivery is not configured.' }, 503);
    const [secret,url,key,publicKey,privateKey,subject] = values as string[];
    if (!(await sameServerSecret(request.headers.get('x-push-webhook-secret')||'',secret))) return json({ error: 'Unauthorized.' }, 401);
    let payload: { type?: string; table?: string; schema?: string; record?: { id?: string | number } };
    try { payload = await boundedPayload(request) as typeof payload; }
    catch (error) { return json({ error: 'Invalid webhook payload.' }, (error as Error).message === 'too_large' ? 413 : 400); }
    if (!payload || payload.type !== 'INSERT' || payload.table !== 'notifications' || payload.schema !== 'public'
      || !((typeof payload.record?.id === 'string' && payload.record.id.trim().length > 0 && payload.record.id.length <= 128)
        || (typeof payload.record?.id === 'number' && Number.isSafeInteger(payload.record.id) && payload.record.id >= 0))) {
      return json({ error: 'Expected a public notification insert.' }, 400);
    }
    try {
      const backend = deps.backend(url,key);
      // The webhook chooses only an ID. Content and recipient always come from the database.
      const notice = await backend.notice(String(payload.record!.id!));
      if (!notice) return json({ error: 'Notification not found.' }, 404);
      const subscriptions = await backend.subscriptions(notice.user_id);
      deps.configure(subject,publicKey,privateKey);
      let next = 0, sent = 0, expired = 0, failed = 0;
      const body = JSON.stringify({ title: notice.title.slice(0,100), body: notice.message.slice(0,500), url: '/?notification=' + encodeURIComponent(String(notice.id)) });
      await Promise.all(Array.from({ length: Math.min(4,subscriptions.length) }, async () => {
        for (;;) {
          const subscription = subscriptions[next++]; if (!subscription) return;
          if (!validPushEndpoint(subscription.endpoint)) { failed++; deps.log('invalid_endpoint'); continue; }
          try { await deps.send(subscription,body); sent++; }
          catch (error) {
            const status = (error as { statusCode?: number })?.statusCode;
            if (status === 404 || status === 410) {
              try { await backend.removeExpired(subscription.endpoint,notice.user_id); expired++; }
              catch { failed++; deps.log('expired_cleanup_failed'); }
            } else { failed++; deps.log('delivery_failed'); }
          }
        }
      }));
      return json({ sent,expired,failed },failed ? 502 : 200);
    } catch { deps.log('push_backend_failed'); return json({ error: 'Push delivery failed.' },502); }
  };
}
