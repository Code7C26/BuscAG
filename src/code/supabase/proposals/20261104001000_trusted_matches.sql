-- CANDIDATE: requires reviewed security baseline and message receipts.
-- Installs DISABLED; enable separately only after verifying the scheduled worker.
-- No existing data/backfill or conversation-retention policy is changed.
begin;
do $$
declare r record;actual_type text;
begin
  for r in select * from (values
    ('items','id','uuid'),('items','owner_id','uuid'),('items','title','text'),('items','description','text'),
    ('items','category','text'),('items','status','text'),('items','lat','double precision'),('items','lng','double precision'),
    ('items','date','timestamp with time zone'),('notifications','id','uuid'),('notifications','user_id','uuid'),
    ('notifications','title','text'),('notifications','message','text'),('notifications','type','text'),
    ('notifications','related_item_id','uuid'),('notifications','related_user_id','uuid')
  ) expected(t,c,ty) loop
    select pg_catalog.format_type(a.atttypid,a.atttypmod) into actual_type from pg_catalog.pg_attribute a
      where a.attrelid=to_regclass('public.'||r.t) and a.attname=r.c and a.attnum>0 and not a.attisdropped;
    if not(r.t='items' and r.c='date' and coalesce(actual_type in ('date','timestamp with time zone'),false))
      and actual_type is distinct from r.ty then raise exception 'Preflight: %.% needs %, found %',r.t,r.c,r.ty,actual_type;end if;
  end loop;
  if not (select relrowsecurity from pg_catalog.pg_class where oid='public.notifications'::regclass) then
    raise exception 'RLS must be enabled on notifications';
  end if;
  if has_any_column_privilege('anon','public.notifications','SELECT')
    or has_any_column_privilege('anon','public.notifications','INSERT')
    or has_any_column_privilege('anon','public.notifications','UPDATE')
    or has_table_privilege('anon','public.notifications','DELETE')
    or has_table_privilege('authenticated','public.notifications','DELETE') then
    raise exception 'Unexpected notification ACL; reconcile security baseline first';
  end if;
  if exists(select from pg_catalog.pg_attribute where attrelid='public.notifications'::regclass and attnum>0 and not attisdropped
    and ((attname<>'is_read' and has_column_privilege('authenticated',attrelid,attnum,'UPDATE'))
      or (attname<>all(array['user_id','title','message','type','related_item_id']) and has_column_privilege('authenticated',attrelid,attnum,'INSERT')))) then
    raise exception 'Unexpected notification column ACL; reconcile security baseline first';
  end if;
  if exists(select from pg_catalog.pg_attribute where attrelid='public.notifications'::regclass
    and attnum>0 and not attisdropped and attnotnull and not atthasdef and attidentity=''
    and attgenerated='' and attname<>all(array['user_id','title','message','type','related_item_id','related_user_id'])) then
    raise exception 'Unexpected required notification columns; review actual diagnostic';
  end if;
  if to_regclass('buscag_private.message_receipts') is null
    or to_regclass('public.public_profiles') is null then
    raise exception 'Reviewed security baseline and message receipts are required';
  end if;
end; $$;
create table buscag_private.match_control (
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default false,
  worker_last_seen timestamptz,
  changed_at timestamptz not null default now()
);
insert into buscag_private.match_control default values;
alter table buscag_private.match_control enable row level security;
revoke all on buscag_private.match_control from public,anon,authenticated,service_role;
create function public.match_backend_enabled() returns boolean
language sql stable security definer set search_path='' as $$
  select coalesce((select enabled from buscag_private.match_control where singleton),false)
$$;
revoke all on function public.match_backend_enabled() from public,anon,authenticated,service_role;
grant execute on function public.match_backend_enabled() to authenticated;
-- Keep the reviewed legacy own-match grant until activation. This RESTRICTIVE
-- policy adds an AND, so an older permissive policy cannot bypass backend mode.
create policy notifications_match_delivery_mode on public.notifications as restrictive
  for insert to authenticated with check(user_id=(select auth.uid()) and type='match'
    and not (select public.match_backend_enabled()));
create policy notifications_delivery_read_self on public.notifications as restrictive
  for select to authenticated using(user_id=(select auth.uid()));
create policy notifications_delivery_update_self on public.notifications as restrictive
  for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create table buscag_private.match_jobs (
  item_id uuid primary key references public.items(id) on delete cascade,
  after_id uuid,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error_code text,
  queued_at timestamptz not null default now()
);
create table buscag_private.match_notices (
  lost_id uuid not null references public.items(id) on delete cascade,
  found_id uuid not null references public.items(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  notification_id uuid references public.notifications(id) on delete set null,
  primary key(lost_id,found_id,recipient_id)
);
alter table buscag_private.match_jobs enable row level security;
alter table buscag_private.match_notices enable row level security;
revoke all on buscag_private.match_jobs,buscag_private.match_notices from public,anon,authenticated,service_role;
create index match_jobs_order_idx on buscag_private.match_jobs(next_attempt_at,queued_at,item_id);
create index items_match_candidates_idx on public.items(category,status,id)
  where status in ('perdido','encontrado') and owner_id is not null;

create function buscag_private.match_words(body text) returns text[]
language sql immutable set search_path='' as $$
  select coalesce(array_agg(distinct word),array[]::text[]) from
    regexp_split_to_table(regexp_replace(regexp_replace(
      normalize(lower(left(coalesce(body,''),10000)),NFD),U&'[\0300-\036f]','','g'),
      '[^a-z0-9[:space:]]',' ','g'),'[[:space:]]+') word
  where char_length(word)>=3 and word<>all(array[
  'de', 'la', 'el', 'en', 'y', 'a', 'los', 'del', 'se', 'las', 'por', 'un', 'para',
  'con', 'no', 'una', 'su', 'al', 'lo', 'como', 'mas', 'pero', 'sus', 'le', 'ya',
  'o', 'fue', 'este', 'ha', 'si', 'porque', 'esta', 'son', 'entre', 'esta', 'cuando',
  'muy', 'sin', 'sobre', 'ser', 'tiene', 'tambien', 'me', 'hasta', 'hay', 'donde',
  'quien', 'desde', 'todo', 'nos', 'durante', 'todos', 'uno', 'les', 'ni', 'contra',
  'otros', 'ese', 'eso', 'ante', 'ellos', 'e', 'esto', 'mi', 'antes', 'algunos',
  'unos', 'yo', 'otro', 'otras', 'otra', 'él', 'tanto', 'esa', 'estos', 'mucho',
  'quienes', 'nada', 'muchos', 'cual', 'sea', 'poco', 'ella', 'estar', 'estas',
  'algunas', 'algo', 'nosotros', 'mi', 'mis', 'tu', 'tus', 'cerca', 'alrededor',
  'tiradas', 'olvidada', 'olvidado', 'encontre', 'perdi', 'extravio', 'recuperado',
  'av', 'avenida', 'calle', 'plaza'
]);
$$;
-- Conservative alert threshold: at least two exact keywords and >=75/100.
-- UI suggestions keep their broader threshold and partial-word support.
create function buscag_private.match_score(l public.items,f public.items) returns integer
language plpgsql stable set search_path='' set timezone='UTC' as $$
declare shared integer; distance_km numeric; geo integer; timing integer; hours double precision;
  hav double precision;
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
  hav:=power(sin(radians(f.lat-l.lat)/2),2)+cos(radians(l.lat))*cos(radians(f.lat))*power(sin(radians(f.lng-l.lng)/2),2);
  distance_km:=round((6371*2*asin(sqrt(least(1,greatest(0,hav)))))::numeric,1);
  geo:=case when distance_km<=1 then 100 when distance_km<=3 then 85 when distance_km<=6 then 60 when distance_km<=12 then 35 else 15 end;
  -- DATE subtraction returns integer days. Cast operands first; the function's
  -- UTC setting makes DATE midnight deterministic without changing instants.
  hours:=extract(epoch from (f.date::timestamptz-l.date::timestamptz))/3600;
  timing:=case when hours<0 then 75 when hours<=12 then 100 when hours<=48 then 85 when hours<=168 then 60 else 30 end;
  return round((case when shared>=3 then 100 else 75 end)*0.5+geo*0.35+timing*0.15)::integer;
end; $$;

create function buscag_private.enqueue_match() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if not public.match_backend_enabled() then return new;end if;
  insert into buscag_private.match_jobs(item_id) values(new.id)
    on conflict(item_id) do update set after_id=null,attempts=0,last_error_code=null,next_attempt_at=now(),queued_at=now();
  return new;
end; $$;
create trigger buscag_enqueue_match_insert after insert on public.items
  for each row execute function buscag_private.enqueue_match();
create trigger buscag_enqueue_match_edit after update of title,description,category,status,lat,lng,date,owner_id on public.items
  for each row when ((old.title,old.description,old.category,old.status,old.lat,old.lng,old.date,old.owner_id)
    is distinct from (new.title,new.description,new.category,new.status,new.lat,new.lng,new.date,new.owner_id))
  execute function buscag_private.enqueue_match();

create function public.process_match_jobs(p_limit integer default 5) returns jsonb
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
        if recipient=lost.owner_id then counterpart:=found_item.id;counterpart_owner:=found_item.owner_id;
        else counterpart:=lost.id;counterpart_owner:=lost.owner_id; end if;
        insert into buscag_private.match_notices(lost_id,found_id,recipient_id)
          values(lost.id,found_item.id,recipient) on conflict do nothing;
        get diagnostics added=row_count;
        if added=0 then continue; end if;
        insert into public.notifications(user_id,title,message,type,related_item_id,related_user_id)
          values(recipient,'Coincidencia del '||score||'% encontrada',
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
create function public.buscag_capabilities() returns table(queued_match_notifications boolean)
language sql stable security invoker set search_path='' as $$ select public.match_backend_enabled() $$;
revoke all on function public.buscag_capabilities() from public,anon,authenticated,service_role;
grant execute on function public.buscag_capabilities() to authenticated;
-- Existing safe own-match INSERT remains available only while disabled.
-- Activation changes the private flag, never broadens client grants.
revoke all on all functions in schema buscag_private from public,anon,authenticated,service_role;
commit;
