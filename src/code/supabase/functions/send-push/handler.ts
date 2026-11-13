import {sameServerSecret,usableServerSecret} from '../_shared/serverSecret.ts';
export type Subscription = { endpoint: string; p256dh: string; auth: string };
type Notice = { id: string; user_id: string; type: string };
type DeliveryResult = 'sent' | 'retry' | 'expired' | 'invalid';
export type PushDependencies = {
  env: (name: string) => string | undefined;
  backend: (url: string, key: string) => {
    pending: () => Promise<string[]>;
    claim: (id: string, endpoint: string) => Promise<string | null>;
    finish: (id: string, endpoint: string, token: string, result: DeliveryResult) => Promise<void>;
    notice: (id: string) => Promise<Notice | null>;
    subscriptions: (userId: string, noticeId: string) => Promise<Subscription[]>;
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
    if(url !== 'https://yiarlhpbgkofhhipkfha.supabase.co') return json({error:'Staging target required.'},503);
    if (!(await sameServerSecret(request.headers.get('x-push-webhook-secret')||'',secret))) return json({ error: 'Unauthorized.' }, 401);
    let payload: { type?: string; table?: string; schema?: string; record?: { id?: string | number } };
    try { payload = await boundedPayload(request) as typeof payload; }
    catch (error) { return json({ error: 'Invalid webhook payload.' }, (error as Error).message === 'too_large' ? 413 : 400); }
    const draining = payload?.type === 'DRAIN';
    if (!draining && (!payload || payload.type !== 'INSERT' || payload.table !== 'notifications' || payload.schema !== 'public'
      || !((typeof payload.record?.id === 'string' && payload.record.id.trim().length > 0 && payload.record.id.length <= 128)
        || (typeof payload.record?.id === 'number' && Number.isSafeInteger(payload.record.id) && payload.record.id >= 0)))) {
      return json({ error: 'Expected a public notification insert.' }, 400);
    }
    try {
      const backend = deps.backend(url,key);
      // Scheduler drains durable jobs; webhook is optional low-latency acceleration.
      // Both use the same atomic database claim, never webhook-provided content.
      const ids = draining ? (await backend.pending()).slice(0,25) : [String(payload.record!.id!)];
      let sent=0,expired=0,failed=0,skipped=0,budget=20;
      deps.configure(subject,publicKey,privateKey);
      for(const id of ids) {
        if(budget<=0)break;
        const notice=await backend.notice(id);
        if(!notice){skipped++;continue;}
        const subscriptions=(await backend.subscriptions(notice.user_id,id)).slice(0,budget);
        budget-=subscriptions.length;
        let next=0;
        // Lock-screen content deliberately omits names, messages, item and report details.
        const body=JSON.stringify({title:'BuscAG',body:notice.type==='message'?'Tenés un mensaje nuevo. Abrí BuscAG para verlo.':notice.type==='match'?'Tenés una nueva coincidencia. Abrí BuscAG para verla.':'Tenés una nueva notificación. Abrí BuscAG para verla.',url:'/?notification='+encodeURIComponent(notice.id)});
        await Promise.all(Array.from({length:Math.min(4,subscriptions.length)},async()=>{
          for(;;){
            const subscription=subscriptions[next++];if(!subscription)return;
            const token=await backend.claim(id,subscription.endpoint);
            if(!token){skipped++;continue;}
            let result:DeliveryResult='sent';
            if(!validPushEndpoint(subscription.endpoint)){result='invalid';failed++;deps.log('invalid_endpoint');}
            else try{await deps.send(subscription,body);sent++;}
            catch(error){
              const status=(error as {statusCode?:number})?.statusCode;
              if(status===404||status===410){result='expired';expired++;}
              else {result='retry';failed++;deps.log('delivery_failed');}
            }
            await backend.finish(id,subscription.endpoint,token,result);
          }
        }));
      }
      return json({ sent,expired,failed,skipped },failed ? 502 : 200);
    } catch { deps.log('push_backend_failed'); return json({ error: 'Push delivery failed.' },502); }
  };
}
