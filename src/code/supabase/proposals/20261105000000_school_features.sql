-- OPTIONAL, REVIEW BEFORE STAGING ACTIVATION. No remote execution.
-- Requires all nine installer migrations. Existing rows are not rewritten.
-- Repeatable: private tables retain state, functions/triggers replaced atomically.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $$
declare relation_name text; signature text;
begin
 foreach relation_name in array array['buscag_private.match_jobs','buscag_private.match_control','buscag_private.match_notices','buscag_private.message_receipts','buscag_private.publication_receipts','public.public_profiles'] loop
  if to_regclass(relation_name) is null then raise exception 'Install and verify the reviewed staging baseline first';end if;
 end loop;
 foreach signature in array array['public.publish_item_once(uuid,jsonb)','public.send_message_once(uuid,uuid,uuid,text)','public.match_backend_enabled()','public.process_match_jobs(integer)','public.validate_item_content_write()','buscag_private.match_words(text)'] loop
  if to_regprocedure(signature) is null then raise exception 'Install and verify the reviewed staging baseline first';end if;
 end loop;
 if exists(select from pg_catalog.pg_roles where rolname in ('anon','authenticated') and (rolsuper or rolbypassrls))
 or has_schema_privilege('anon','buscag_private','USAGE') or has_schema_privilege('authenticated','buscag_private','USAGE') then
  raise exception 'Security baseline role/private-schema drift';end if;
 foreach relation_name in array array['public.items','public.messages','public.profiles','public.notifications'] loop
  if not exists(select from pg_catalog.pg_class where oid=to_regclass(relation_name) and relrowsecurity and pg_get_userbyid(relowner)=current_user)
  or has_any_column_privilege('anon',relation_name,'SELECT,INSERT,UPDATE') or has_table_privilege('anon',relation_name,'DELETE,TRUNCATE') then
   raise exception 'Security baseline RLS/ACL drift';end if;
 end loop;
 if has_any_column_privilege('authenticated','public.items','INSERT') or has_any_column_privilege('authenticated','public.messages','INSERT') then
  raise exception 'Security baseline requires RPC-only writes';end if;
 if not exists(select from pg_catalog.pg_attribute where attrelid='public.items'::regclass and attname='date' and not attisdropped and atttypid in ('date'::regtype,'timestamptz'::regtype)) then
  raise exception 'Unsupported items.date type';end if;
end $$;
create table if not exists buscag_private.item_watches (
 item_id uuid primary key references public.items(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 enabled boolean not null, lat double precision not null check(lat between -90 and 90),
 lng double precision not null check(lng between -180 and 180),
 radius_km double precision not null check(radius_km between 0.1 and 100),
 updated_at timestamptz not null default now()
);
create table if not exists buscag_private.alert_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 matches boolean not null default true
);
create table if not exists buscag_private.object_tags (
 item_id uuid primary key references public.items(id) on delete cascade,
 token uuid not null unique default gen_random_uuid(), enabled boolean not null default true
);
-- RESTRICT deliberately preserves bilateral evidence; no cascading conversation deletion.
create table if not exists buscag_private.recovery_confirmations (
 id uuid primary key default gen_random_uuid(),
 item_id uuid not null references public.items(id) on delete restrict,
 owner_id uuid not null references auth.users(id) on delete restrict,
 partner_id uuid not null references auth.users(id) on delete restrict,
 state text not null default 'pending' check(state in ('pending','confirmed','cancelled')),
 created_at timestamptz not null default now(), resolved_at timestamptz,
 check(owner_id<>partner_id)
);
create unique index if not exists recovery_pending_item on buscag_private.recovery_confirmations(item_id) where state='pending';
alter table buscag_private.item_watches enable row level security;
alter table buscag_private.alert_preferences enable row level security;
alter table buscag_private.object_tags enable row level security;
alter table buscag_private.recovery_confirmations enable row level security;
revoke all on buscag_private.item_watches,buscag_private.alert_preferences,buscag_private.object_tags,buscag_private.recovery_confirmations from public,anon,authenticated,service_role;

-- A bilateral confirmation is evidence, distinct from self-declared recovery.
create or replace function buscag_private.protect_confirmed_recovery() returns trigger
language plpgsql security definer set search_path='' as $$ begin
 if new.status is distinct from 'recuperado' and exists(select from buscag_private.recovery_confirmations where item_id=old.id and state='confirmed') then
 raise exception 'Bilateral recovery is already confirmed' using errcode='42501';end if;
 return new;
end $$;
drop trigger if exists buscag_protect_confirmed_recovery on public.items;
create trigger buscag_protect_confirmed_recovery before update of status on public.items
 for each row execute function buscag_private.protect_confirmed_recovery();
revoke all on function buscag_private.protect_confirmed_recovery() from public,anon,authenticated,service_role;

create or replace function public.school_features() returns jsonb
language sql stable security invoker set search_path='' as $$ select jsonb_build_object('version',1,'matching_enabled',public.match_backend_enabled()) $$;
create or replace function public.get_item_watch(p_item uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not exists(select from public.items where id=p_item and owner_id=auth.uid()) then raise exception 'Not permitted' using errcode='42501'; end if;
 select to_jsonb(w)-'user_id' into result from buscag_private.item_watches w where item_id=p_item;
 return result;
end $$;
-- Serialize content/ownership changes without blocking the worker's FK KEY SHARE
-- locks. No RPC changes the item primary key. FOR UPDATE can otherwise stall or
-- deadlock with a worker that already holds the corresponding queue row.
create or replace function public.set_item_watch(p_item uuid,p_enabled boolean,p_lat double precision,p_lng double precision,p_radius double precision) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i public.items%rowtype;
begin
 select * into i from public.items where id=p_item for no key update;
 if auth.uid() is null or i.owner_id is distinct from auth.uid() or i.status is distinct from 'perdido' then raise exception 'Lost item owner required' using errcode='42501'; end if;
 if p_enabled is null or p_lat is null or p_lng is null or p_radius is null
 or not(p_lat between -90 and 90 and p_lng between -180 and 180 and p_radius between 0.1 and 100) then raise exception 'Invalid search zone' using errcode='22023'; end if;
 insert into buscag_private.item_watches(item_id,user_id,enabled,lat,lng,radius_km) values(p_item,auth.uid(),p_enabled,p_lat,p_lng,p_radius)
 on conflict(item_id) do update set enabled=excluded.enabled,lat=excluded.lat,lng=excluded.lng,radius_km=excluded.radius_km,updated_at=now();
 if p_enabled and public.match_backend_enabled() then
 insert into buscag_private.match_jobs(item_id) values(p_item) on conflict(item_id) do update set after_id=null,next_attempt_at=now(),attempts=0;
 end if;
 return public.get_item_watch(p_item);
end $$;
create or replace function public.set_match_preference(p_enabled boolean) returns boolean
language plpgsql security definer set search_path='' as $$ begin
 if auth.uid() is null then raise exception 'Login required' using errcode='42501'; end if;
 if p_enabled is null then raise exception 'Invalid preference' using errcode='22023';end if;
 insert into buscag_private.alert_preferences values(auth.uid(),p_enabled) on conflict(user_id) do update set matches=excluded.matches;
 return p_enabled;
end $$;
create or replace function public.get_match_preference() returns boolean
language sql stable security definer set search_path='' as $$ select coalesce((select matches from buscag_private.alert_preferences where user_id=auth.uid()),true) $$;
create or replace function buscag_private.match_recipient_allowed(l public.items,f public.items,p_recipient uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare w buscag_private.item_watches%rowtype; h double precision;
begin
 if not coalesce((select matches from buscag_private.alert_preferences where user_id=p_recipient),true) then return false; end if;
 -- The lost owner's chosen zone controls both ends of this matching pair.
 select * into w from buscag_private.item_watches where item_id=l.id;
 if not found then return true; end if; -- preserve reviewed baseline for legacy items
 if not w.enabled then return false; end if;
 h:=power(sin(radians(f.lat-w.lat)/2),2)+cos(radians(w.lat))*cos(radians(f.lat))*power(sin(radians(f.lng-w.lng)/2),2);
 return (6371*2*asin(sqrt(least(1,greatest(0,h)))) <= w.radius_km);
end $$;
create or replace function buscag_private.match_score(l public.items,f public.items) returns integer
language plpgsql stable set search_path='' set timezone='UTC' as $$
declare shared integer; distance_km numeric; geo integer; timing integer; hours double precision;
  hav double precision; lc text[]; fc text[];
begin
  if l.category is null or btrim(l.category)='' or l.status is distinct from 'perdido' or f.status is distinct from 'encontrado' or l.category is distinct from f.category
    or l.owner_id is null or f.owner_id is null or l.owner_id=f.owner_id
    or l.lat is null or l.lng is null or f.lat is null or f.lng is null
    or not(l.lat between -90 and 90 and f.lat between -90 and 90 and l.lng between -180 and 180 and f.lng between -180 and 180)
    or l.date is null or f.date is null or not isfinite(l.date) or not isfinite(f.date)
    or f.date<l.date-interval '24 hours' then return null; end if;
  select count(*) into shared from unnest(buscag_private.match_words(coalesce(l.title,'')||' '||coalesce(l.description,''))) w
    where w=any(buscag_private.match_words(coalesce(f.title,'')||' '||coalesce(f.description,'')));
  if shared<2 then return null; end if;
  select array_agg(distinct case when w='azules' then 'azul' when w='grises' then 'gris' else regexp_replace(regexp_replace(w,'s$',''),'a$','o') end)
    into lc from unnest(buscag_private.match_words(coalesce(l.title,'')||' '||coalesce(l.description,''))) w where w=any(array['negro','negra','negros','negras','blanco','blanca','blancos','blancas','rojo','roja','rojos','rojas','azul','azules','verde','verdes','amarillo','amarilla','amarillos','amarillas','violeta','violetas','gris','grises','rosa','rosas','naranja','naranjas']);
  select array_agg(distinct case when w='azules' then 'azul' when w='grises' then 'gris' else regexp_replace(regexp_replace(w,'s$',''),'a$','o') end)
    into fc from unnest(buscag_private.match_words(coalesce(f.title,'')||' '||coalesce(f.description,''))) w where w=any(array['negro','negra','negros','negras','blanco','blanca','blancos','blancas','rojo','roja','rojos','rojas','azul','azules','verde','verdes','amarillo','amarilla','amarillos','amarillas','violeta','violetas','gris','grises','rosa','rosas','naranja','naranjas']);
  if lc is not null and fc is not null and not(lc && fc) then return null;end if;

  hav:=power(sin(radians(f.lat-l.lat)/2),2)+cos(radians(l.lat))*cos(radians(f.lat))*power(sin(radians(f.lng-l.lng)/2),2);
  distance_km:=round((6371*2*asin(sqrt(least(1,greatest(0,hav)))))::numeric,1);
  geo:=case when distance_km<=1 then 100 when distance_km<=3 then 85 when distance_km<=6 then 60 when distance_km<=12 then 35 else 15 end;
  -- DATE subtraction returns integer days. Cast operands first; the function's
  -- UTC setting makes DATE midnight deterministic without changing instants.
  hours:=extract(epoch from (f.date::timestamptz-l.date::timestamptz))/3600;
  timing:=case when hours<0 then 75 when hours<=12 then 100 when hours<=48 then 85 when hours<=168 then 60 else 30 end;
  return round((case when shared>=3 then 100 else 75 end)*0.5+geo*0.35+timing*0.15)::integer;
end; $$;


create or replace function public.process_match_jobs(p_limit integer default 5) returns jsonb
language plpgsql security definer set search_path='' as $$
declare job record; target public.items%rowtype; other public.items%rowtype;
  lost public.items%rowtype; found_item public.items%rowtype;
  score integer; recipient uuid; counterpart uuid; counterpart_owner uuid; nid uuid;
  claimed integer:=0; inspected integer; delivered integer:=0; added integer; cursor_id uuid;
  failures integer:=0; prior_delivered integer;
begin
  if p_limit is null or p_limit<1 or p_limit>20 then raise exception 'Invalid batch limit' using errcode='22023'; end if;
  -- One bounded worker transaction at a time avoids pair-ledger lock cycles.
  if not pg_try_advisory_xact_lock(hashtextextended('buscag:match-worker',0)) then
    return jsonb_build_object('batches',0,'notifications',0,'failures',0,'busy',true,'enabled',public.match_backend_enabled());
  end if;
  update buscag_private.match_control set worker_last_seen=clock_timestamp() where singleton;
  if not found then raise exception 'Match control is missing';end if;
  if not public.match_backend_enabled() then
    return jsonb_build_object('batches',0,'notifications',0,'failures',0,'busy',false,'enabled',false);
  end if;
  for job in select * from buscag_private.match_jobs where next_attempt_at<=now()
    order by next_attempt_at,queued_at,item_id for update skip locked limit p_limit loop
    prior_delivered:=delivered;
    begin
    claimed:=claimed+1; inspected:=0; cursor_id:=job.after_id;
    select * into target from public.items where id=job.item_id;
    if not found or target.owner_id is null or target.status is null or target.status not in ('perdido','encontrado') then
      delete from buscag_private.match_jobs where item_id=job.item_id; continue;
    end if;
    for other in select * from public.items where category=target.category
      and status=case when target.status='perdido' then 'encontrado' else 'perdido' end
      and owner_id is not null and owner_id<>target.owner_id
      and (job.after_id is null or id>job.after_id) order by id limit 201 loop
      inspected:=inspected+1; exit when inspected>200; cursor_id:=other.id;
      if target.status='perdido' then lost:=target;found_item:=other; else lost:=other;found_item:=target; end if;
      score:=buscag_private.match_score(lost,found_item);
      if score is null or score<75 then continue; end if;
      foreach recipient in array array[lost.owner_id,found_item.owner_id] loop
        if not buscag_private.match_recipient_allowed(lost,found_item,recipient) then continue; end if;
        if recipient=lost.owner_id then counterpart:=found_item.id;counterpart_owner:=found_item.owner_id;
        else counterpart:=lost.id;counterpart_owner:=lost.owner_id; end if;
        insert into buscag_private.match_notices(lost_id,found_id,recipient_id)
          values(lost.id,found_item.id,recipient) on conflict do nothing;
        get diagnostics added=row_count;
        if added=0 then continue; end if;
        insert into public.notifications(user_id,title,message,type,related_item_id,related_user_id)
          values(recipient,'Posible coincidencia · índice '||score||'/100',
            'Hay una publicación con características compatibles. Revisa la coincidencia.','match',counterpart,counterpart_owner)
          returning id into nid;
        update buscag_private.match_notices set notification_id=nid
          where lost_id=lost.id and found_id=found_item.id and recipient_id=recipient;
        delivered:=delivered+1;
      end loop;
    end loop;
    if inspected>200 then
      update buscag_private.match_jobs set after_id=cursor_id,queued_at=now(),next_attempt_at=now(),attempts=0,last_error_code=null where item_id=job.item_id;
    else delete from buscag_private.match_jobs where item_id=job.item_id; end if;
    exception when others then
      -- The subtransaction rolls back this pair batch, including notices/ledger.
      -- Keep the job, redact details, and allow other jobs to progress.
      delivered:=prior_delivered;failures:=failures+1;
      update buscag_private.match_jobs set attempts=least(attempts+1,1000000),
        last_error_code=sqlstate,
        next_attempt_at=now()+make_interval(secs=>least(3600,15*power(2,least(attempts,8)))::double precision)
        where item_id=job.item_id;
    end;
  end loop;
  return jsonb_build_object('batches',claimed,'notifications',delivered,'failures',failures,'busy',false,'enabled',true);
end; $$;
revoke all on function public.process_match_jobs(integer) from public,anon,authenticated,service_role;
grant execute on function public.process_match_jobs(integer) to service_role;

create or replace function public.manage_object_tag(p_item uuid,p_enabled boolean,p_rotate boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t buscag_private.object_tags%rowtype;
begin
 perform 1 from public.items where id=p_item and owner_id=auth.uid() for no key update;
 if not found or auth.uid() is null then raise exception 'Owner required' using errcode='42501';end if;
 if p_enabled is null or p_rotate is null then raise exception 'Invalid tag option' using errcode='22023';end if;
 insert into buscag_private.object_tags(item_id,enabled) values(p_item,p_enabled)
 on conflict(item_id) do update set enabled=excluded.enabled,token=case when p_rotate then gen_random_uuid() else buscag_private.object_tags.token end returning * into t;
 return jsonb_build_object('token',t.token,'enabled',t.enabled);
end $$;
-- Possession of a random, revocable QR grants ONLY category/status, never identity,
-- description, image, location, phone, email, auth.users or private profiles.
create or replace function public.resolve_object_tag(p_token uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('item_id',i.id,'category',case when i.category in ('Electrónicos','Documentos y Billeteras','Mascotas','Llaves','Mochilas y Bolsos','Indumentaria','Otros') then i.category else null end,'status',case when i.status in ('perdido','encontrado','recuperado') then i.status else null end)
 from buscag_private.object_tags t join public.items i on i.id=t.item_id
 where t.token=p_token and t.enabled
$$;
create or replace function public.list_recovery_confirmations(p_item uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc),'[]'::jsonb)
 from buscag_private.recovery_confirmations r where item_id=p_item and auth.uid() in (r.owner_id,r.partner_id)
$$;
create or replace function public.request_item_recovery(p_item uuid,p_partner uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare i public.items%rowtype; r buscag_private.recovery_confirmations%rowtype; new_id uuid;
begin
 select * into i from public.items where id=p_item for no key update;
 if auth.uid() is null or i.owner_id is distinct from auth.uid() or coalesce(i.status not in ('perdido','encontrado'),true) then raise exception 'Active item owner required' using errcode='42501';end if;
 if p_partner is null or p_partner=auth.uid() or not exists(select from public.messages where item_id=p_item and ((sender_id=auth.uid() and recipient_id=p_partner) or (recipient_id=auth.uid() and sender_id=p_partner))) then raise exception 'Conversation participant required' using errcode='42501';end if;
 select * into r from buscag_private.recovery_confirmations where item_id=p_item and state='pending';
 if found then
 if r.partner_id<>p_partner then raise exception 'Resolve pending request first' using errcode='22023';end if;
 return r.id;
 end if;
 if (select count(*) from buscag_private.recovery_confirmations where item_id=p_item and owner_id=auth.uid() and created_at>now()-interval '1 hour')>=5 then raise exception 'recovery_rate_limited' using errcode='P0001';end if;
 insert into buscag_private.recovery_confirmations(item_id,owner_id,partner_id) values(p_item,auth.uid(),p_partner) returning id into new_id;
 insert into public.notifications(user_id,title,message,type,related_item_id,related_user_id)
 values(p_partner,'Confirmar devolución','El propietario solicita confirmar la devolución. Revisá el objeto antes de aceptar.','system',p_item,auth.uid());
 return new_id;
end $$;
create or replace function public.resolve_item_recovery(p_request uuid,p_accept boolean) returns text
language plpgsql security definer set search_path='' as $$
declare r buscag_private.recovery_confirmations%rowtype; i public.items%rowtype;
begin
 -- Consistent lock order with request_item_recovery.
 select * into r from buscag_private.recovery_confirmations where id=p_request;
 if not found or auth.uid() is null or auth.uid() not in (r.owner_id,r.partner_id) then raise exception 'Participant required' using errcode='42501';end if;
 select * into i from public.items where id=r.item_id for no key update;
 select * into r from buscag_private.recovery_confirmations where id=p_request for update;
 if p_accept is null then raise exception 'Decision required' using errcode='22023';end if;
 if p_accept and auth.uid()<>r.partner_id then raise exception 'Other participant must confirm' using errcode='42501';end if;
 if r.state<>'pending' then return r.state;end if;
 if p_accept then
 if i.owner_id is distinct from r.owner_id or coalesce(i.status not in ('perdido','encontrado'),true) then raise exception 'Item changed; cancel the request' using errcode='22023';end if;
 update public.items set status='recuperado' where id=r.item_id;
 end if;
 update buscag_private.recovery_confirmations set state=case when p_accept then 'confirmed' else 'cancelled' end,resolved_at=now() where id=p_request returning * into r;
 insert into public.notifications(user_id,title,message,type,related_item_id,related_user_id)
 values(case when auth.uid()=r.owner_id then r.partner_id else r.owner_id end,'Confirmación de devolución',case when p_accept then 'Ambas partes confirmaron la devolución.' else 'La solicitud de confirmación fue cancelada.' end,'system',r.item_id,auth.uid());
 return r.state;
end $$;
-- INVOKER: counts only rows the current authenticated user can actually SELECT.
create or replace function public.community_statistics() returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('publications',count(*),'lost',count(*) filter(where status='perdido'),
 'found',count(*) filter(where status='encontrado'),'recovered',count(*) filter(where status='recuperado'),
 'mine',count(*) filter(where owner_id=auth.uid()),'scope','visible_by_rls') from public.items
$$;
revoke all on function buscag_private.match_score(public.items,public.items) from public,anon,authenticated,service_role;
-- Postgres creates functions executable by PUBLIC by default: explicitly close all.
revoke all on function buscag_private.match_recipient_allowed(public.items,public.items,uuid) from public,anon,authenticated,service_role;
revoke all on function public.school_features() from public,anon,authenticated,service_role;
grant execute on function public.school_features() to authenticated;
revoke all on function public.get_item_watch(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_item_watch(uuid) to authenticated;
revoke all on function public.set_item_watch(uuid,boolean,double precision,double precision,double precision) from public,anon,authenticated,service_role;
grant execute on function public.set_item_watch(uuid,boolean,double precision,double precision,double precision) to authenticated;
revoke all on function public.set_match_preference(boolean) from public,anon,authenticated,service_role;
grant execute on function public.set_match_preference(boolean) to authenticated;
revoke all on function public.get_match_preference() from public,anon,authenticated,service_role;
grant execute on function public.get_match_preference() to authenticated;
revoke all on function public.manage_object_tag(uuid,boolean,boolean) from public,anon,authenticated,service_role;
grant execute on function public.manage_object_tag(uuid,boolean,boolean) to authenticated;
revoke all on function public.resolve_object_tag(uuid) from public,anon,authenticated,service_role;
grant execute on function public.resolve_object_tag(uuid) to authenticated;
revoke all on function public.list_recovery_confirmations(uuid) from public,anon,authenticated,service_role;
grant execute on function public.list_recovery_confirmations(uuid) to authenticated;
revoke all on function public.request_item_recovery(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.request_item_recovery(uuid,uuid) to authenticated;
revoke all on function public.resolve_item_recovery(uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function public.resolve_item_recovery(uuid,boolean) to authenticated;
revoke all on function public.community_statistics() from public,anon,authenticated,service_role;
grant execute on function public.community_statistics() to authenticated;
grant execute on function public.resolve_object_tag(uuid) to anon;
commit;
