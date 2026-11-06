-- REVIEW ONLY. Requires school_features and 20261106000000_secure_recovery.
-- No remote execution. No consent inferred, no application rows deleted.
begin;
set local lock_timeout='5s'; set local statement_timeout='60s';
do $$ begin
 if to_regprocedure('public.recovery_context(uuid)') is null then raise exception 'Install secure recovery first';end if;
 if exists(select from pg_class where oid in('public.profiles'::regclass,'public.items'::regclass,'public.messages'::regclass,'public.notifications'::regclass) and not relrowsecurity)
 or has_any_column_privilege('anon','public.profiles','SELECT,INSERT,UPDATE')
 or has_table_privilege('authenticated','public.profiles','INSERT,UPDATE')
 or has_any_column_privilege('authenticated','public.messages','INSERT') then
 raise exception 'Security baseline drift: review ACL/RLS before installing community safety';end if;
end $$;
alter table public.profiles add column if not exists phone_shared boolean not null default false;
alter table public.profiles add column if not exists rating_count integer not null default 0;
revoke insert(rating,rating_count,phone_shared),update(rating,rating_count,phone_shared) on public.profiles from public,anon,authenticated;
-- Restrictive policies intersect permissive legacy policies; never weaken them.
drop policy if exists community_profiles_read_self on public.profiles;
create policy community_profiles_read_self on public.profiles as restrictive for select to authenticated using(id=(select auth.uid()));
drop policy if exists community_profiles_update_self on public.profiles;
create policy community_profiles_update_self on public.profiles as restrictive for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
drop policy if exists community_profiles_insert_self on public.profiles;
create policy community_profiles_insert_self on public.profiles as restrictive for insert to authenticated with check(id=(select auth.uid()));
alter table buscag_private.recovery_confirmations add column if not exists owner_statement text check(char_length(owner_statement)<=500);
alter table buscag_private.recovery_confirmations add column if not exists resolved_by uuid;
create or replace function buscag_private.record_recovery_decision() returns trigger
language plpgsql set search_path='' as $$ begin
 if new.state in('confirmed','cancelled') and (tg_op='INSERT' or new.state is distinct from old.state) then new.resolved_by:=auth.uid();end if;
 return new;
end $$;
revoke all on function buscag_private.record_recovery_decision() from public,anon,authenticated,service_role;
drop trigger if exists record_recovery_decision on buscag_private.recovery_confirmations;
create trigger record_recovery_decision before insert or update of state on buscag_private.recovery_confirmations for each row execute function buscag_private.record_recovery_decision();
create or replace function buscag_private.anonymize_recovery_participant() returns trigger
language plpgsql security definer set search_path='' as $$ begin
 update buscag_private.recovery_confirmations
 set owner_id=case when owner_id=old.id then null else owner_id end,
 partner_id=case when partner_id=old.id then null else partner_id end,
 resolved_by=case when resolved_by=old.id then null else resolved_by end
 where owner_id=old.id or partner_id=old.id or resolved_by=old.id;
 return old;
end $$;
create or replace function buscag_private.validate_phone_update() returns trigger
language plpgsql set search_path='' as $$ begin
 if new.phone is distinct from old.phone and (new.phone is null or (new.phone<>'' and new.phone !~ '^\+[1-9][0-9]{7,14}$')) then
 raise exception 'Use international phone format' using errcode='22023';end if;return new;
end $$;
revoke all on function buscag_private.validate_phone_update() from public,anon,authenticated,service_role;
drop trigger if exists validate_phone_update on public.profiles;
create trigger validate_phone_update before update of phone on public.profiles for each row execute function buscag_private.validate_phone_update();

create table if not exists buscag_private.user_blocks (
 actor_id uuid not null references auth.users(id) on delete cascade,
 target_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),primary key(actor_id,target_id),check(actor_id<>target_id));
create index if not exists blocks_target on buscag_private.user_blocks(target_id,actor_id);
create table if not exists buscag_private.moderators (
 user_id uuid primary key references auth.users(id) on delete cascade);
create table if not exists buscag_private.reports (
 id uuid primary key default gen_random_uuid(), reporter_id uuid references auth.users(id) on delete set null,
 target_kind text not null check(target_kind in ('item','user','rating','recovery')),target_id uuid not null,
 reason text not null check(reason in ('estafa','spam','falsa','inapropiado','acoso','otro')),
 description text not null default '' check(char_length(description)<=2000),
 state text not null default 'open' check(state in ('open','reviewing','resolved','dismissed')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(reporter_id,target_kind,target_id));
create index if not exists reports_queue on buscag_private.reports(state,created_at);
create index if not exists reports_actor_rate on buscag_private.reports(reporter_id,created_at);
create table if not exists buscag_private.moderation_actions (
 id uuid primary key default gen_random_uuid(),report_id uuid not null references buscag_private.reports(id),
 actor_id uuid references auth.users(id) on delete set null,from_state text not null,to_state text not null,
 note text not null check(char_length(note) between 1 and 2000),created_at timestamptz not null default now());
create index if not exists moderation_report_actions on buscag_private.moderation_actions(report_id,created_at);
create table if not exists buscag_private.item_followers (
 item_id uuid not null references public.items(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,notify boolean not null default true,
 created_at timestamptz not null default now(),primary key(item_id,user_id));
create index if not exists followers_user on buscag_private.item_followers(user_id,item_id);
create table if not exists buscag_private.recovery_ratings (
 id uuid primary key default gen_random_uuid(),
 request_id uuid references buscag_private.recovery_confirmations(id) on delete set null,
 source_request uuid not null,author_id uuid references auth.users(id) on delete set null,
 target_id uuid references auth.users(id) on delete set null,stars integer not null check(stars between 1 and 5),
 created_at timestamptz not null default now(),unique(source_request,author_id),check(author_id<>target_id));
create index if not exists ratings_target on buscag_private.recovery_ratings(target_id);
do $$ declare t text;begin
 foreach t in array array['user_blocks','moderators','reports','moderation_actions','item_followers','recovery_ratings'] loop
 execute format('alter table buscag_private.%I enable row level security',t);
 execute format('revoke all on buscag_private.%I from public,anon,authenticated,service_role',t);
 end loop;
end $$;

create or replace function buscag_private.blocked(a uuid,b uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select from buscag_private.user_blocks where (actor_id=a and target_id=b) or (actor_id=b and target_id=a))
$$;
create or replace function public.can_send_item_message(p_item_id uuid,p_recipient_id uuid) returns boolean
language sql volatile security definer set search_path='' as $$
 select auth.uid() is not null and p_recipient_id<>auth.uid()
 and not buscag_private.blocked(auth.uid(),p_recipient_id)
 and exists(select from public.items i where i.id=p_item_id and (
   (i.owner_id=p_recipient_id and i.status in ('perdido','encontrado')) or exists(
    select from public.messages m where m.item_id=i.id and
    ((m.sender_id=auth.uid() and m.recipient_id=p_recipient_id) or (m.recipient_id=auth.uid() and m.sender_id=p_recipient_id)))))
$$;
create or replace function buscag_private.enforce_message_access() returns trigger
language plpgsql security definer set search_path='' as $$ begin
 perform pg_advisory_xact_lock(hashtextextended('buscag:contact:'||least(new.sender_id,new.recipient_id)::text||greatest(new.sender_id,new.recipient_id)::text,0));
 -- Serialize with recovery and the existing contact counter update. SHARE
 -- would require a lock upgrade when concurrent messages update the counter.
 perform 1 from public.items where id=new.item_id for no key update;
 if auth.uid() is null or new.sender_id is distinct from auth.uid() or not public.can_send_item_message(new.item_id,new.recipient_id) then
 raise exception 'Conversation unavailable' using errcode='42501';end if;
 return new;
end $$;
drop trigger if exists enforce_message_access on public.messages;
create trigger enforce_message_access before insert on public.messages for each row execute function buscag_private.enforce_message_access();

create or replace function public.set_user_block(p_target uuid,p_block boolean) returns boolean
language plpgsql security definer set search_path='' as $$ begin
 if auth.uid() is null or p_target is null or p_target=auth.uid() or p_block is null then raise exception 'Invalid block' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('buscag:contact:'||least(auth.uid(),p_target)::text||greatest(auth.uid(),p_target)::text,0));
 if p_block then
 if not exists(select from public.profiles where id=p_target) then raise exception 'User unavailable' using errcode='42501';end if;
 insert into buscag_private.user_blocks(actor_id,target_id) values(auth.uid(),p_target) on conflict do nothing;
 else delete from buscag_private.user_blocks where actor_id=auth.uid() and target_id=p_target;end if;
 return p_block;
end $$;
create or replace function public.list_my_blocks() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',b.target_id,'name',p.full_name,'created_at',b.created_at) order by b.created_at desc),'[]')
 from buscag_private.user_blocks b join public.profiles p on p.id=b.target_id where b.actor_id=auth.uid()
$$;
create or replace function public.can_share_contact(p_target uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (auth.uid()=p_target or (
 not buscag_private.blocked(auth.uid(),p_target)
 and exists(select from public.profiles p where p.id=p_target and p.phone_shared)
 and exists(select from public.messages m where m.sender_id=p_target and m.recipient_id=auth.uid()
 and exists(select from public.messages reply where reply.item_id=m.item_id and reply.sender_id=auth.uid() and reply.recipient_id=p_target))))
$$;
create or replace view public.public_profiles with(security_barrier=true) as
select p.id,p.full_name,p.avatar_url,
 case when p.rating_count>0 then p.rating else 0::numeric end::numeric(2,1) as rating,p.created_at,
 case when public.can_share_contact(p.id) then p.phone else ''::text end as phone,
 case when p.id=auth.uid() then p.location else ''::text end as location,p.rating_count
from public.profiles p where auth.uid() is not null;
revoke all on public.public_profiles from public,anon,authenticated;
grant select on public.public_profiles to authenticated;
-- Old direct name/phone updates remain owner-scoped by baseline RLS. Consent
-- itself is only changed through this allowlisted RPC; rating fields stay protected.
create or replace function public.save_my_profile(p_name text,p_avatar text,p_phone text,p_share boolean,p_location text) returns jsonb
language plpgsql security definer set search_path='' as $$ begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501';end if;
 if p_name is null or char_length(btrim(p_name)) not between 2 and 100 or p_avatar is null or char_length(p_avatar)>2048
 or (p_avatar<>'' and p_avatar !~ '^https://[^[:space:]]+$') or p_phone is null
 or (p_phone<>'' and p_phone !~ '^\+[1-9][0-9]{7,14}$') or p_share is null or (p_share and p_phone='')
 or p_location is null or char_length(p_location)>200 then raise exception 'Invalid profile fields' using errcode='22023';end if;
 update public.profiles set full_name=btrim(p_name),avatar_url=p_avatar,phone=p_phone,phone_shared=p_share,location=btrim(p_location) where id=auth.uid();
 if not found then raise exception 'Profile unavailable' using errcode='42501';end if;
 return public.my_community_settings();
end $$;
create or replace function public.my_community_settings() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('version',1,'name',p.full_name,'avatar',p.avatar_url,'phone',p.phone,'share_phone',p.phone_shared,'location',p.location,
 'rating',case when p.rating_count>0 then p.rating else null end,'rating_count',p.rating_count,
 'moderator',exists(select from buscag_private.moderators where user_id=auth.uid())) from public.profiles p where p.id=auth.uid()
$$;

create or replace function public.submit_report(p_kind text,p_target uuid,p_reason text,p_description text) returns uuid
language plpgsql security definer set search_path='' as $$ declare saved uuid;begin
 if auth.uid() is null or p_description is null or char_length(p_description)>2000 or p_kind not in ('item','user','rating','recovery')
 or p_reason is null or p_reason not in ('estafa','spam','falsa','inapropiado','acoso','otro') then raise exception 'Invalid report' using errcode='22023';end if;
 if p_kind is null or p_target is null or not(case p_kind
 when 'item' then exists(select from public.items where id=p_target and owner_id is distinct from auth.uid())
 when 'user' then exists(select from public.profiles where id=p_target and id<>auth.uid())
 when 'rating' then exists(select from buscag_private.recovery_ratings where id=p_target and target_id=auth.uid())
 when 'recovery' then exists(select from buscag_private.recovery_confirmations where id=p_target and auth.uid() in (owner_id,partner_id)) else false end)
 then raise exception 'Report target unavailable' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('buscag:report:'||auth.uid()::text,0));
 select id into saved from buscag_private.reports where reporter_id=auth.uid() and target_kind=p_kind and target_id=p_target;
 if found then return saved;end if;
 if(select count(*) from buscag_private.reports where reporter_id=auth.uid() and created_at>now()-interval '1 hour')>=10 then raise exception 'Report rate limited' using errcode='P0001';end if;
 insert into buscag_private.reports(reporter_id,target_kind,target_id,reason,description) values(auth.uid(),p_kind,p_target,p_reason,p_description) returning id into saved;
 return saved;
end $$;
create or replace function public.list_reports() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc),'[]') from (
 select * from buscag_private.reports where reporter_id=auth.uid() or exists(select from buscag_private.moderators where user_id=auth.uid())
 order by created_at desc limit 100) r
$$;
create or replace function public.moderate_report(p_report uuid,p_state text,p_note text) returns text
language plpgsql security definer set search_path='' as $$ declare r buscag_private.reports%rowtype;begin
 if auth.uid() is null or not exists(select from buscag_private.moderators where user_id=auth.uid()) then raise exception 'Moderator required' using errcode='42501';end if;
 if p_state is null or p_state not in ('reviewing','resolved','dismissed') or p_note is null or char_length(btrim(p_note)) not between 1 and 2000 then raise exception 'Invalid action' using errcode='22023';end if;
 select * into r from buscag_private.reports where id=p_report for update;
 if not found then raise exception 'Report unavailable' using errcode='42501';end if;
 if r.state=p_state then return r.state;end if;
 insert into buscag_private.moderation_actions(report_id,actor_id,from_state,to_state,note) values(r.id,auth.uid(),r.state,p_state,btrim(p_note));
 update buscag_private.reports set state=p_state,updated_at=now() where id=r.id;
 return p_state;
end $$;
create or replace function public.report_audit(p_report uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at),'[]') from buscag_private.moderation_actions a
 where a.report_id=p_report and exists(select from buscag_private.moderators where user_id=auth.uid())
$$;

create or replace function public.set_item_follow(p_item uuid,p_follow boolean,p_notify boolean) returns boolean
language plpgsql security definer set search_path='' as $$ begin
 if auth.uid() is null or p_item is null or p_follow is null or p_notify is null then raise exception 'Item unavailable' using errcode='42501';end if;
 if not p_follow then delete from buscag_private.item_followers where item_id=p_item and user_id=auth.uid();return false;end if;
 if not exists(select from public.items where id=p_item and owner_id<>auth.uid() and not buscag_private.blocked(owner_id,auth.uid())) then raise exception 'Item unavailable' using errcode='42501';end if;
 if p_follow then insert into buscag_private.item_followers(item_id,user_id,notify) values(p_item,auth.uid(),p_notify)
 on conflict(item_id,user_id) do update set notify=excluded.notify;
 else delete from buscag_private.item_followers where item_id=p_item and user_id=auth.uid();end if;
 return p_follow;
end $$;
create or replace function public.my_item_follow(p_item uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('following',exists(select from buscag_private.item_followers where item_id=p_item and user_id=auth.uid()),
 'notify',coalesce((select notify from buscag_private.item_followers where item_id=p_item and user_id=auth.uid()),true))
$$;
create or replace function buscag_private.notify_item_followers() returns trigger
language plpgsql security definer set search_path='' as $$ begin
 if new.status is distinct from old.status then
 insert into public.notifications(user_id,title,message,type,related_item_id,related_user_id)
 select f.user_id,'Novedad de una publicación','El estado cambió a '||coalesce(new.status,'sin informar')||'.','system',new.id,new.owner_id
 from buscag_private.item_followers f where f.item_id=new.id and f.notify and f.user_id<>new.owner_id and not buscag_private.blocked(f.user_id,new.owner_id);
 end if;return new;
end $$;
drop trigger if exists notify_item_followers on public.items;
create trigger notify_item_followers after update of status on public.items for each row execute function buscag_private.notify_item_followers();

create or replace function public.rate_recovery(p_request uuid,p_stars integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare r buscag_private.recovery_confirmations%rowtype; peer uuid; saved buscag_private.recovery_ratings%rowtype;begin
 select * into r from buscag_private.recovery_confirmations where id=p_request for update;
 if auth.uid() is null or not found or r.state<>'confirmed' or r.mode<>'bilateral' or not coalesce(auth.uid() in(r.owner_id,r.partner_id),false) then raise exception 'Confirmed bilateral participant required' using errcode='42501';end if;
 peer:=case when auth.uid()=r.owner_id then r.partner_id else r.owner_id end;
 if peer is null or p_stars is null or p_stars not between 1 and 5 then raise exception 'Invalid rating' using errcode='22023';end if;
 select * into saved from buscag_private.recovery_ratings where source_request=r.id and author_id=auth.uid();
 if found then if saved.stars<>p_stars then raise exception 'Rating already submitted' using errcode='22023';end if;return saved.id;end if;
 -- Serialize averages across different recoveries for the same recipient.
 perform pg_advisory_xact_lock(hashtextextended('buscag:rating:'||peer::text,0));
 insert into buscag_private.recovery_ratings(request_id,source_request,author_id,target_id,stars) values(r.id,r.id,auth.uid(),peer,p_stars) returning * into saved;
 update public.profiles set rating=(select round(avg(stars),1) from buscag_private.recovery_ratings where target_id=peer),
 rating_count=(select count(*) from buscag_private.recovery_ratings where target_id=peer) where id=peer;
 return saved.id;
end $$;
create or replace function public.received_ratings() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'stars',r.stars,'created_at',r.created_at) order by r.created_at desc),'[]')
 from buscag_private.recovery_ratings r where r.target_id=auth.uid()
$$;

-- A conversation is not proof of a handover. An owner who recovered independently
-- may explicitly declare that fact; this never confirms a bilateral request or
-- earns a bilateral rating. Pending requests must be resolved/cancelled first.
create or replace function public.declare_independent_recovery(p_item uuid,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare i public.items%rowtype;r buscag_private.recovery_confirmations%rowtype;begin
 select * into i from public.items where id=p_item for no key update;
 if auth.uid() is null or i.owner_id is distinct from auth.uid() then raise exception 'Owner required' using errcode='42501';end if;
 if p_reason is null or char_length(btrim(p_reason)) not between 20 and 500 then raise exception 'Explain independent recovery' using errcode='22023';end if;
 select * into r from buscag_private.recovery_confirmations where item_id=p_item and state='confirmed' order by created_at desc limit 1;
 if found then
 if r.mode='individual' and r.owner_id=auth.uid() and r.owner_statement=btrim(p_reason) then return r.id;end if;
 raise exception 'Recovery already completed' using errcode='22023';end if;
 if coalesce(i.status not in('perdido','encontrado'),true) or exists(select from buscag_private.recovery_confirmations where item_id=p_item and state='pending') then raise exception 'Resolve pending recovery first' using errcode='22023';end if;
 if(select count(*) from buscag_private.recovery_confirmations where item_id=p_item and owner_id=auth.uid() and created_at>now()-interval '1 hour')>=5 then raise exception 'recovery_rate_limited' using errcode='P0001';end if;
 insert into buscag_private.recovery_confirmations(item_id,owner_id,mode,state,resolved_at,owner_statement)
 values(p_item,auth.uid(),'individual','confirmed',now(),btrim(p_reason)) returning * into r;
 update public.items set status='recuperado' where id=p_item;
 return r.id;
end $$;

-- Existing recovery history is reused, with display names and dispute evidence.
create or replace function public.recovery_context(p_item uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare i public.items%rowtype; partners jsonb; history jsonb;begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501';end if;
 select * into i from public.items where id=p_item;
 if not found then raise exception 'Item unavailable' using errcode='42501';end if;
 partners:='[]'::jsonb;
 if i.owner_id=auth.uid() then select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',coalesce(nullif(btrim(pr.full_name),''),'Cuenta no disponible')) order by p.id),'[]') into partners
 from buscag_private.recovery_partners(i.id,i.owner_id) p left join public.profiles pr on pr.id=p.id;end if;
 select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('owner_name',coalesce(nullif(btrim(o.full_name),''),'Cuenta no disponible'),
 'partner_name',coalesce(nullif(btrim(p.full_name),''),'Cuenta no disponible'),'resolved_name',actor.full_name,'disputed',exists(select from buscag_private.reports d where d.target_kind='recovery' and d.target_id=r.id and d.state in('open','reviewing')),
 'my_rating',(select stars from buscag_private.recovery_ratings where source_request=r.id and author_id=auth.uid())) order by r.created_at desc),'[]') into history
 from buscag_private.recovery_confirmations r left join public.profiles o on o.id=r.owner_id left join public.profiles p on p.id=r.partner_id left join public.profiles actor on actor.id=r.resolved_by
 where r.item_id=p_item and auth.uid() in(r.owner_id,r.partner_id);
 return jsonb_build_object('version',2,'status',i.status,'partners',partners,'requests',history);
end $$;

-- Explicit allowlist. No grants on private tables, moderator enrollment or triggers.
do $$ declare f record;begin
 for f in select p.oid::regprocedure signature,n.nspname namespace from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where (n.nspname='public' and p.proname in('can_send_item_message','can_share_contact','set_user_block','list_my_blocks','save_my_profile','my_community_settings','submit_report','list_reports','moderate_report','report_audit','set_item_follow','my_item_follow','rate_recovery','received_ratings','recovery_context','declare_independent_recovery'))
 or (n.nspname='buscag_private' and p.proname in('blocked','enforce_message_access','notify_item_followers')) loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
 if f.namespace='public' then execute format('grant execute on function %s to authenticated',f.signature);end if;
 end loop;
end $$;
commit;
