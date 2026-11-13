-- REVIEW ONLY. Requires community stage. No platform wrappers/extensions/network calls.
-- New application objects; NOT included in the already completed school->community installer.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $$begin
 if to_regprocedure('buscag_private.blocked(uuid,uuid)') is null
 or to_regprocedure('public.my_item_follow(uuid)') is null then
 raise exception 'Community stage required';end if;
end$$;

create table if not exists buscag_private.user_followers(
 user_id uuid not null references public.profiles(id) on delete cascade,
 target_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(), primary key(user_id,target_id), check(user_id<>target_id));
create index if not exists user_followers_target on buscag_private.user_followers(target_id,user_id);
alter table buscag_private.user_followers enable row level security;
revoke all on buscag_private.user_followers from public,anon,authenticated,service_role;

create or replace function public.my_user_follow(p_target uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select from buscag_private.user_followers where user_id=auth.uid() and target_id=p_target)
$$;
create or replace function public.set_user_follow(p_target uuid,p_follow boolean) returns boolean
language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is null or p_target is null or p_target=auth.uid() or p_follow is null then
 raise exception 'Invalid follow' using errcode='42501';end if;
 if not p_follow then delete from buscag_private.user_followers where user_id=auth.uid() and target_id=p_target;return false;end if;
 if not exists(select from public.profiles where id=p_target) or buscag_private.blocked(auth.uid(),p_target) then
 raise exception 'User unavailable' using errcode='42501';end if;
 -- Serialize concurrent follows for this account before applying the bound.
 perform 1 from public.profiles where id=auth.uid() for no key update;
 if (select count(*) from buscag_private.user_followers where user_id=auth.uid())>=1000
 and not exists(select from buscag_private.user_followers where user_id=auth.uid() and target_id=p_target) then
 raise exception 'Follow limit reached' using errcode='54000';end if;
 insert into buscag_private.user_followers(user_id,target_id) values(auth.uid(),p_target) on conflict do nothing;
 return true;
end$$;
revoke all on function public.my_user_follow(uuid),public.set_user_follow(uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function public.my_user_follow(uuid),public.set_user_follow(uuid,boolean) to authenticated;

create or replace function buscag_private.notify_user_followers() returns trigger
language plpgsql security definer set search_path='' as $$begin
 if new.owner_id is null or new.status not in('perdido','encontrado') then return new;end if;
 insert into public.notifications(user_id,title,message,type,related_item_id,related_user_id)
 select f.user_id,'Nueva publicación de una persona seguida','Hay una nueva publicación. Abrí BuscAG para verla.','system',new.id,new.owner_id
 from buscag_private.user_followers f where f.target_id=new.owner_id and f.user_id<>new.owner_id
 and not buscag_private.blocked(f.user_id,new.owner_id);
 return new;
end$$;
drop trigger if exists notify_user_followers on public.items;
create trigger notify_user_followers after insert on public.items for each row execute function buscag_private.notify_user_followers();

create or replace function buscag_private.notify_report_state() returns trigger
language plpgsql security definer set search_path='' as $$begin
 if new.state is distinct from old.state and new.reporter_id is not null and new.reporter_id is distinct from auth.uid() then
 insert into public.notifications(user_id,title,message,type)
 values(new.reporter_id,'Actualización de tu denuncia','Hay novedades de moderación. Consultá Mis denuncias en tu configuración.','system');
 end if;return new;
end$$;
drop trigger if exists notify_report_state on buscag_private.reports;
create trigger notify_report_state after update of state on buscag_private.reports for each row execute function buscag_private.notify_report_state();

-- Bound per-account fanout without changing existing subscription ownership RLS.
create or replace function buscag_private.limit_push_devices() returns trigger
language plpgsql security definer set search_path='' as $$begin
 perform 1 from public.profiles where id=new.user_id for no key update;
 if (select count(*) from public.push_subscriptions where user_id=new.user_id)>=20
 and not exists(select from public.push_subscriptions where user_id=new.user_id and endpoint=new.endpoint) then
 raise exception 'Device limit reached' using errcode='54000';end if;
 new.updated_at:=now();return new;
end$$;
drop trigger if exists limit_push_devices on public.push_subscriptions;
create trigger limit_push_devices before insert or update on public.push_subscriptions for each row execute function buscag_private.limit_push_devices();

-- Queue captures only devices subscribed when the internal notice is inserted.
-- Unsubscribing deletes those deliveries via FK; no historical notification replay.
create table if not exists buscag_private.push_deliveries(
 id uuid primary key default gen_random_uuid(),
 notification_id uuid not null references public.notifications(id) on delete cascade,
 subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
 state text not null default 'queued' check(state in('queued','sending','sent','skipped','failed')),
 attempts int not null default 0 check(attempts between 0 and 5),
 token uuid, available_at timestamptz not null default now(), lease_until timestamptz,
 created_at timestamptz not null default now(), finished_at timestamptz,
 unique(notification_id,subscription_id));
create index if not exists push_deliveries_pending on buscag_private.push_deliveries(available_at) where state in('queued','sending');
alter table buscag_private.push_deliveries enable row level security;
revoke all on buscag_private.push_deliveries from public,anon,authenticated,service_role;

create or replace function buscag_private.push_notice_allowed(n public.notifications) returns boolean
language sql stable security definer set search_path='' as $$
 select n.user_id is not null and n.related_user_id is distinct from n.user_id
 and not n.is_read and n.created_at>now()-interval '24 hours'
 and (n.related_user_id is null or not buscag_private.blocked(n.user_id,n.related_user_id))
 and (n.related_item_id is null or exists(select from public.items i where i.id=n.related_item_id
   and (i.owner_id is null or not buscag_private.blocked(n.user_id,i.owner_id))))
 and (n.title<>'Novedad de una publicación' or exists(select from buscag_private.item_followers f where f.item_id=n.related_item_id and f.user_id=n.user_id and f.notify))
 and (n.title<>'Nueva publicación de una persona seguida' or exists(select from buscag_private.user_followers f where f.target_id=n.related_user_id and f.user_id=n.user_id))
$$;
create or replace function buscag_private.enqueue_push_notice() returns trigger
language plpgsql security definer set search_path='' as $$begin
 if new.user_id is distinct from auth.uid() and buscag_private.push_notice_allowed(new) then
 insert into buscag_private.push_deliveries(notification_id,subscription_id)
 select new.id,s.id from public.push_subscriptions s where s.user_id=new.user_id on conflict do nothing;
 end if;return new;
end$$;
drop trigger if exists enqueue_push_notice on public.notifications;
create trigger enqueue_push_notice after insert on public.notifications for each row execute function buscag_private.enqueue_push_notice();

create or replace function public.pending_push_notices() returns jsonb
language plpgsql security definer set search_path='' as $$declare result jsonb;begin
 update buscag_private.push_deliveries d set state='skipped',finished_at=now()
 from public.notifications n where n.id=d.notification_id and not buscag_private.push_notice_allowed(n)
 and (d.state='queued' or(d.state='sending' and d.lease_until<now()));
 update buscag_private.push_deliveries set state='failed',finished_at=now()
 where state='sending' and lease_until<now() and attempts>=5;
 select coalesce(jsonb_agg(x.notification_id),'[]') into result from(
 select d.notification_id from buscag_private.push_deliveries d
 where d.attempts<5 and ((d.state='queued' and d.available_at<=now()) or(d.state='sending' and d.lease_until<now()))
 group by d.notification_id order by min(d.created_at) limit 25) x;
 return result;
end$$;
create or replace function public.push_notice_context(p_notice uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',n.id,'user_id',n.user_id,'type',n.type)
 from public.notifications n where n.id=p_notice and buscag_private.push_notice_allowed(n)
$$;
create or replace function public.pending_push_subscriptions(p_notice uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (
 select s.endpoint,s.p256dh,s.auth from buscag_private.push_deliveries d
 join public.push_subscriptions s on s.id=d.subscription_id join public.notifications n on n.id=d.notification_id
 where d.notification_id=p_notice and s.user_id=n.user_id and buscag_private.push_notice_allowed(n)
 and d.attempts<5 and ((d.state='queued' and d.available_at<=now()) or(d.state='sending' and d.lease_until<now()))
 order by d.created_at,d.id limit 20) x
$$;
create or replace function public.claim_push_delivery(p_notice uuid,p_endpoint text) returns uuid
language plpgsql security definer set search_path='' as $$declare d buscag_private.push_deliveries%rowtype; n public.notifications%rowtype; t uuid;begin
 select q.* into d from buscag_private.push_deliveries q join public.push_subscriptions s on s.id=q.subscription_id
 where q.notification_id=p_notice and s.endpoint=p_endpoint for update of q skip locked;
 if not found then return null;end if;
 if d.state not in('queued','sending') or d.attempts>=5 or(d.state='sending' and d.lease_until>=now()) or(d.state='queued' and d.available_at>now()) then return null;end if;
 select * into n from public.notifications where id=p_notice;
 if not found or not buscag_private.push_notice_allowed(n) or not exists(select from public.push_subscriptions s where s.id=d.subscription_id and s.user_id=n.user_id) then
 update buscag_private.push_deliveries set state='skipped',finished_at=now() where id=d.id;return null;end if;
 t:=gen_random_uuid();
 update buscag_private.push_deliveries set state='sending',attempts=attempts+1,token=t,lease_until=now()+interval '2 minutes' where id=d.id;
 return t;
end$$;
create or replace function public.finish_push_delivery(p_notice uuid,p_endpoint text,p_token uuid,p_result text) returns boolean
language plpgsql security definer set search_path='' as $$declare d buscag_private.push_deliveries%rowtype;begin
 if p_result is null or p_result not in('sent','retry','expired','invalid') then raise exception 'Invalid delivery result' using errcode='22023';end if;
 select q.* into d from buscag_private.push_deliveries q join public.push_subscriptions s on s.id=q.subscription_id
 where q.notification_id=p_notice and s.endpoint=p_endpoint and q.token=p_token and q.state='sending' for update of q;
 if not found then return false;end if;
 if p_result='expired' then delete from public.push_subscriptions where id=d.subscription_id;return true;end if;
 update buscag_private.push_deliveries set
 state=case when p_result='sent' then 'sent' when p_result='invalid' or attempts>=5 then 'failed' else 'queued' end,
 available_at=now()+make_interval(secs=>30*power(2,d.attempts-1)::int),
 finished_at=case when p_result in('sent','invalid') or attempts>=5 then now() else null end,
 token=null,lease_until=null where id=d.id;
 return true;
end$$;
-- Helpers remain inaccessible; server RPCs require service_role, never a browser JWT.
revoke all on function buscag_private.limit_push_devices(),buscag_private.notify_user_followers(),buscag_private.notify_report_state(),buscag_private.push_notice_allowed(public.notifications),buscag_private.enqueue_push_notice() from public,anon,authenticated,service_role;
revoke all on function public.pending_push_notices(),public.pending_push_subscriptions(uuid),public.push_notice_context(uuid),public.claim_push_delivery(uuid,text),public.finish_push_delivery(uuid,text,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.pending_push_notices(),public.pending_push_subscriptions(uuid),public.push_notice_context(uuid),public.claim_push_delivery(uuid,text),public.finish_push_delivery(uuid,text,uuid,text) to service_role;
commit;
