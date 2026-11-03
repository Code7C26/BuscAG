import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import webpush from 'npm:web-push@3.6.7';
import { createPushHandler } from './handler.ts';

Deno.serve(createPushHandler({
  env: name => Deno.env.get(name),
  log: event => console.error(event), // No endpoints, credentials, keys, records or payloads.
  configure: (subject, publicKey, privateKey) => webpush.setVapidDetails(subject,publicKey,privateKey),
  send: (subscription,payload) => webpush.sendNotification({
    endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth }
  },payload,{timeout:10_000,TTL:300}).then(() => undefined),
  backend: (url,key) => {
    const client = createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    return {
      async notice(id) {
        const {data,error} = await client.from('notifications').select('id,user_id,title,message').eq('id',id).maybeSingle();
        if (error) throw error; return data;
      },
      async subscriptions(userId) {
        const rows: {endpoint:string;p256dh:string;auth:string}[] = [];
        for (;;) {
          const {data,error} = await client.from('push_subscriptions').select('endpoint,p256dh,auth')
            .eq('user_id',userId).order('id').range(rows.length,rows.length+99);
          if (error) throw error; if (!data.length) return rows; rows.push(...data);
        }
      },
      async removeExpired(endpoint,userId) {
        const {error} = await client.from('push_subscriptions').delete().eq('endpoint',endpoint).eq('user_id',userId);
        if (error) throw error;
      }
    };
  }
}));
