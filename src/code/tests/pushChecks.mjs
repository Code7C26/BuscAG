import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
/** New proposal applied only to disposable synthetic databases; never a remote URL. */
export async function pushChecks(db){
 const sql=await readFile(new URL('../supabase/proposals/20261108000000_web_push_delivery.sql',import.meta.url),'utf8');
 const before=(await db.query('select id,is_read from public.notifications order by id')).rows;
 await db.exec(sql);await db.exec(sql);
 assert.deepEqual((await db.query('select id,is_read from public.notifications order by id')).rows,before);
 const users=[1,2,3].map(i=>'a8000000-0000-4000-8000-00000000000'+i),[a,b,c]=users;
 for(const id of users)await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[id,JSON.stringify({full_name:'Push synthetic'})]);
 const call=async(uid,name,args=[],role='authenticated',conn=db)=>{
  await conn.query('begin');try{await conn.query('set local role '+role);await conn.query("select set_config('request.jwt.claim.sub',$1,true)",[uid??'']);
   const result=await conn.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) value`,args);await conn.query('commit');return result.rows[0].value;
  }catch(error){await conn.query('rollback');throw error;}
 };
 const admin=async(name,args=[])=>call(null,name,args,'service_role');
 const denied=p=>assert.rejects(p,e=>e.code==='42501');
 const subA=(await db.query("insert into public.push_subscriptions(user_id,endpoint,p256dh,auth) values($1,'https://fcm.googleapis.com/a','synthetic','synthetic') returning id",[a])).rows[0].id;
 const endpoint='https://fcm.googleapis.com/a';
 await db.query("insert into public.push_subscriptions(user_id,endpoint,p256dh,auth) values($1,'https://web.push.apple.com/b','synthetic','synthetic')",[b]);
 for(let i=1;i<20;i++)await db.query("insert into public.push_subscriptions(user_id,endpoint,p256dh,auth) values($1,$2,'synthetic','synthetic')",[a,'https://fcm.googleapis.com/quota'+i]);
 await assert.rejects(db.query("insert into public.push_subscriptions(user_id,endpoint,p256dh,auth) values($1,'https://fcm.googleapis.com/quota-overflow','synthetic','synthetic')",[a]),e=>e.code==='54000');
 await db.query("delete from public.push_subscriptions where user_id=$1 and endpoint<>$2",[a,endpoint]);
 await denied(call(a,'pending_push_notices'));
 await denied(call(a,'claim_push_delivery',[a,endpoint]));
 await denied(call(null,'my_user_follow',[b],'anon'));
 await call(a,'set_user_follow',[b,true]);await call(a,'set_user_follow',[b,true]);
 assert.equal(await call(a,'my_user_follow',[b]),true);
 assert.equal((await db.query('select count(*)::int n from buscag_private.user_followers where user_id=$1',[a])).rows[0].n,1);
 await denied(call(a,'set_user_follow',[a,true]));
 const item=(await db.query("insert into public.items(owner_id,title,description,category,status,location_name,lat,lng,date,image_url) values($1,'Synthetic push item','Synthetic','Otros','encontrado','Synthetic',0,0,'2026-11-08','https://images.invalid/synthetic.png') returning id",[b])).rows[0].id;
 const notice=(await db.query("select id from public.notifications where user_id=$1 and related_item_id=$2 and title='Nueva publicación de una persona seguida'",[a,item])).rows[0].id;
 assert.ok((await admin('pending_push_notices')).includes(notice));
 assert.equal((await admin('pending_push_subscriptions',[notice])).length,1);
 await denied(call(a,'pending_push_subscriptions',[notice]));
 let token=await admin('claim_push_delivery',[notice,endpoint]);assert.ok(token);
 assert.equal(await admin('claim_push_delivery',[notice,endpoint]),null);
 assert.equal(await admin('finish_push_delivery',[notice,endpoint,a,'sent']),false);
 assert.equal(await admin('finish_push_delivery',[notice,endpoint,token,'sent']),true);
 assert.equal(await admin('claim_push_delivery',[notice,endpoint]),null);
 assert.equal(await admin('finish_push_delivery',[notice,endpoint,token,'sent']),false);
 const createNotice=async(type='system',actor=b)=>(await db.query("insert into public.notifications(user_id,title,message,type,related_item_id,related_user_id) values($1,'Synthetic','Private synthetic',$2,$3,$4) returning id",[a,type,item,actor])).rows[0].id;
 let n=await createNotice('match');token=await admin('claim_push_delivery',[n,endpoint]);
 await admin('finish_push_delivery',[n,endpoint,token,'retry']);
 assert.equal(await admin('claim_push_delivery',[n,endpoint]),null);
 await db.query("update buscag_private.push_deliveries set available_at=now()-interval '1 second' where notification_id=$1",[n]);
 const second=await admin('claim_push_delivery',[n,endpoint]);assert.ok(second);assert.notEqual(second,token);
 assert.equal(await admin('finish_push_delivery',[n,endpoint,token,'sent']),false);
 await admin('finish_push_delivery',[n,endpoint,second,'sent']);
 n=await createNotice();
 for(let attempt=1;attempt<=5;attempt++){
  token=await admin('claim_push_delivery',[n,endpoint]);assert.ok(token);
  await admin('finish_push_delivery',[n,endpoint,token,'retry']);
  await db.query("update buscag_private.push_deliveries set available_at=now()-interval '1 second' where notification_id=$1",[n]);
 }
 assert.equal(await admin('claim_push_delivery',[n,endpoint]),null);
 assert.equal((await db.query('select state from buscag_private.push_deliveries where notification_id=$1',[n])).rows[0].state,'failed');
 n=await createNotice();await call(a,'set_user_block',[b,true]);
 assert.equal(await admin('push_notice_context',[n]),null);await admin('pending_push_notices');
 assert.equal(await admin('claim_push_delivery',[n,endpoint]),null);
 await denied(call(a,'set_user_follow',[b,true]));await call(a,'set_user_block',[b,false]);
 n=await createNotice();await db.query('update public.notifications set is_read=true where id=$1',[n]);
 assert.equal(await admin('claim_push_delivery',[n,endpoint]),null);
 n=await createNotice();await db.query("update public.notifications set created_at=now()-interval '25 hours' where id=$1",[n]);
 assert.equal(await admin('claim_push_delivery',[n,endpoint]),null);
 const own=await createNotice('message',a);assert.equal((await db.query('select count(*)::int n from buscag_private.push_deliveries where notification_id=$1',[own])).rows[0].n,0);
 // Unfollowing after enqueue suppresses delivery; a revoked notify flag does too.
 await call(a,'set_user_follow',[b,false]);
 const fresh=(await db.query("insert into public.notifications(user_id,title,message,type,related_user_id,related_item_id) values($1,'Nueva publicación de una persona seguida','Synthetic','system',$2,$3) returning id",[a,b,item])).rows[0].id;
 assert.equal(await admin('claim_push_delivery',[fresh,endpoint]),null);
 await call(a,'set_item_follow',[item,true,true]);
 await db.query("update public.items set status='perdido' where id=$1",[item]);
 const stateNotice=(await db.query("select id from public.notifications where user_id=$1 and title='Novedad de una publicación' and related_item_id=$2 order by created_at desc limit 1",[a,item])).rows[0].id;
 await call(a,'set_item_follow',[item,true,false]);assert.equal(await admin('claim_push_delivery',[stateNotice,endpoint]),null);
 // Real trusted message + recovery RPCs enqueue without frontend insertion.
 await call(a,'send_message_once',[a,item,b,'Synthetic message']);await call(b,'send_message_once',[b,item,a,'Synthetic reply']);
 let request=await call(b,'request_item_recovery',[item,a]);
 assert.equal(await call(a,'resolve_item_recovery',[request,false]),'cancelled');
 request=await call(b,'request_item_recovery',[item,a]);assert.equal(await call(a,'resolve_item_recovery',[request,true]),'confirmed');
 assert.ok((await db.query("select count(*)::int n from buscag_private.push_deliveries d join public.notifications n on n.id=d.notification_id where n.related_item_id=$1 and n.type='message'",[item])).rows[0].n>=2);
 assert.ok((await db.query("select count(*)::int n from buscag_private.push_deliveries d join public.notifications n on n.id=d.notification_id where n.related_item_id=$1 and n.title='Confirmación de devolución'",[item])).rows[0].n>=2);
 // Report updates notify the reporter, not the reported user, and no duplicate for a repeat.
 await db.query('insert into buscag_private.moderators(user_id) values($1)',[c]);
 const report=await call(a,'submit_report',['user',b,'spam','Synthetic']);
 await call(c,'moderate_report',[report,'reviewing','Synthetic note']);await call(c,'moderate_report',[report,'reviewing','Synthetic note']);
 assert.equal((await db.query("select count(*)::int n from public.notifications where user_id=$1 and title='Actualización de tu denuncia'",[a])).rows[0].n,1);
 assert.equal((await db.query("select count(*)::int n from public.notifications where user_id=$1 and title='Actualización de tu denuncia'",[b])).rows[0].n,0);
 // Native PostgreSQL runs the same claim concurrently on independent transactions.
 n=await createNotice();
 if(db.fork){const x=await db.fork(),y=await db.fork();try{
  const tokens=await Promise.all([call(null,'claim_push_delivery',[n,endpoint],'service_role',x),call(null,'claim_push_delivery',[n,endpoint],'service_role',y)]);
  assert.equal(tokens.filter(Boolean).length,1);token=tokens.find(Boolean);
 }finally{await x.end();await y.end();}}
 else token=await admin('claim_push_delivery',[n,endpoint]);
 await db.query("update buscag_private.push_deliveries set lease_until=now()-interval '1 second' where notification_id=$1",[n]);
 const renewed=await admin('claim_push_delivery',[n,endpoint]);assert.ok(renewed);assert.notEqual(renewed,token);
 assert.equal(await admin('finish_push_delivery',[n,endpoint,token,'sent']),false);
 await admin('finish_push_delivery',[n,endpoint,renewed,'sent']);
 n=await createNotice();token=await admin('claim_push_delivery',[n,endpoint]);await admin('finish_push_delivery',[n,endpoint,token,'expired']);
 assert.equal((await db.query('select count(*)::int n from public.push_subscriptions where id=$1',[subA])).rows[0].n,0);
 assert.equal((await db.query('select count(*)::int n from buscag_private.push_deliveries where subscription_id=$1',[subA])).rows[0].n,0);
 console.log('PASS: push SQL security, idempotency, retries, privacy, user follows, moderation and recovery; synthetic database only'+(db.fork?'; concurrent native claims verified':''));
}
