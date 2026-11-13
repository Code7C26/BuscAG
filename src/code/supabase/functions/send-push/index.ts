import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import webpush from 'npm:web-push@3.6.7';
import { createPushHandler } from './handler.ts';

Deno.serve(createPushHandler({
  env: name => Deno.env.get(name),
  log: event => console.error(event), // No endpoints, credentials, keys, records or payloads.
  configure: (subject, publicKey, privateKey) => webpush.setVapidDetails(subject,publicKey,privateKey),
  send: (subscription,payload) => webpush.sendNotification({
    endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth }
  },payload,{timeout:10_000,TTL:300,topic:JSON.parse(payload).url.split("notification=")[1]?.replace(/-/g,"").slice(0,32)}).then(() => undefined),
  backend: (url,key) => {
    const client = createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const rpc=async(name:string,args:Record<string,unknown>={})=>{
      const {data,error}=await client.rpc(name,args);if(error)throw error;return data;
    };
    return {
      async pending(){return await rpc('pending_push_notices') as string[];},
      async notice(id){return await rpc('push_notice_context',{p_notice:id});},
      async claim(id,endpoint){return await rpc('claim_push_delivery',{p_notice:id,p_endpoint:endpoint});},
      async finish(id,endpoint,token,result){
        await rpc('finish_push_delivery',{p_notice:id,p_endpoint:endpoint,p_token:token,p_result:result});
      },
      async subscriptions(_userId,noticeId) {
        return await rpc('pending_push_subscriptions',{p_notice:noticeId});
      }
    };
  }
}));
