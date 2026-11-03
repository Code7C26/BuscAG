import {createClient} from 'npm:@supabase/supabase-js@2.117.2';
import {createMatchWorker} from './handler.ts';
Deno.serve(createMatchWorker({
  env:name=>Deno.env.get(name),
  log:event=>console.error(event),
  async run(url,key,limit) {
    const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data,error}=await client.rpc('process_match_jobs',{p_limit:limit}).abortSignal(AbortSignal.timeout(20_000));
    if(error) throw error;
    return data;
  }
}));
