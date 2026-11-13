-- CANDIDATE ONLY: requires reviewed baseline + message receipts. Never auto-apply.
-- Install compatible clients before revoking direct INSERT. No existing row changes.
begin;
do $$ declare r record;actual_type text;begin
  if to_regclass('buscag_private.message_receipts') is null then raise exception 'Reviewed private workflow baseline required';end if;
  for r in select * from (values
    ('id','uuid'),('owner_id','uuid'),('title','text'),('description','text'),('category','text'),
    ('status','text'),('location_name','text'),('lat','double precision'),('lng','double precision'),
    ('date','timestamp with time zone'),('image_url','text'),('reward','text'),('contact_count','integer')
  ) expected(c,ty) loop
    select pg_catalog.format_type(atttypid,atttypmod) into actual_type from pg_catalog.pg_attribute
      where attrelid='public.items'::regclass and attname=r.c and attnum>0 and not attisdropped;
    if actual_type is distinct from r.ty and not(r.c='date' and coalesce(actual_type='date',false)) then
      raise exception 'Preflight: items.% needs %, found %',r.c,r.ty,actual_type;
    end if;
  end loop;
  if not(select relrowsecurity from pg_catalog.pg_class where oid='public.items'::regclass)
    or has_column_privilege('authenticated','public.items','owner_id','UPDATE') then
    raise exception 'Reviewed item security baseline is required';
  end if;
  if exists(select from pg_catalog.pg_attribute where attrelid='public.items'::regclass
    and attnum>0 and not attisdropped and attnotnull and not atthasdef and attidentity='' and attgenerated=''
    and attname<>all(array['owner_id','title','description','category','status','location_name','lat','lng','date','image_url','reward','contact_count'])) then
    raise exception 'Unexpected required item columns; review actual diagnostic';
  end if;
end;$$;
create table buscag_private.publication_receipts (
  actor_id uuid not null references auth.users(id) on delete cascade,
  request_key uuid not null,
  request_hash text not null,
  item_id uuid references public.items(id) on delete set null,
  accepted_at timestamptz not null default now(),
  primary key(actor_id,request_key)
);
create index publication_receipts_rate_idx on buscag_private.publication_receipts(actor_id,accepted_at);
alter table buscag_private.publication_receipts enable row level security;
revoke all on buscag_private.publication_receipts from public,anon,authenticated,service_role;

create function public.publish_item_once(p_request_key uuid,p_payload jsonb)
returns setof public.items language plpgsql security definer set search_path='' set timezone='UTC'
as $$
declare actor uuid:=auth.uid();fingerprint text;receipt buscag_private.publication_receipts%rowtype;
  draft public.items%rowtype;saved public.items%rowtype;field text;
begin
  if actor is null then raise exception 'Authentication required' using errcode='42501';end if;
  if p_request_key is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>60000 then
    raise exception 'Invalid publication request' using errcode='22023';
  end if;
  if exists(select from jsonb_object_keys(p_payload) k where k<>all(array['title','description','category','status','location_name','lat','lng','date','image_url','reward'])) then
    raise exception 'Unexpected publication fields' using errcode='22023';
  end if;
  foreach field in array array['title','description','category','status','location_name','date','image_url'] loop
    if jsonb_typeof(p_payload->field) is distinct from 'string' then raise exception 'Invalid publication field' using errcode='22023';end if;
  end loop;
  if jsonb_typeof(p_payload->'lat') is distinct from 'number' or jsonb_typeof(p_payload->'lng') is distinct from 'number'
    or (p_payload?'reward' and jsonb_typeof(p_payload->'reward') not in ('string','null')) then
    raise exception 'Invalid coordinates/reward' using errcode='22023';
  end if;
  draft:=jsonb_populate_record(null::public.items,p_payload);
  if draft.title !~ '[^[:space:]]' or char_length(draft.title)>200
    or draft.description !~ '[^[:space:]]' or char_length(draft.description)>10000
    or draft.location_name !~ '[^[:space:]]' or char_length(draft.location_name)>300
    or char_length(coalesce(draft.reward,''))>200 or char_length(draft.image_url)>4096
    or draft.category not in ('Electrónicos','Documentos y Billeteras','Mascotas','Llaves','Mochilas y Bolsos','Indumentaria','Otros')
    or draft.image_url !~ '^https://' or draft.status not in ('perdido','encontrado')
    or not(draft.lat between -90 and 90 and draft.lng between -180 and 180)
    or not isfinite(draft.date) then
    raise exception 'Invalid publication content' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('buscag:publication:'||actor::text,0));
  fingerprint:=encode(sha256(convert_to(p_payload::text,'UTF8')),'hex');
  select * into receipt from buscag_private.publication_receipts where actor_id=actor and request_key=p_request_key;
  if found then
    if receipt.request_hash<>fingerprint then raise exception 'Request key reused for another payload' using errcode='22023';end if;
    select * into saved from public.items where id=receipt.item_id and owner_id=actor;
    if not found then raise exception 'Original publication is unavailable' using errcode='22023';end if;
    return next saved;return;
  end if;
  if (select count(*) from buscag_private.publication_receipts where actor_id=actor and accepted_at>now()-interval '1 hour')>=30 then
    raise exception 'publication_rate_limited' using errcode='P0001';
  end if;
  insert into public.items(owner_id,title,description,category,status,location_name,lat,lng,date,image_url,reward,contact_count)
    values(actor,draft.title,draft.description,draft.category,draft.status,draft.location_name,draft.lat,draft.lng,draft.date,draft.image_url,draft.reward,0)
    returning * into saved;
  insert into buscag_private.publication_receipts(actor_id,request_key,request_hash,item_id) values(actor,p_request_key,fingerprint,saved.id);
  return next saved;
end;$$;
revoke all on function public.publish_item_once(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.publish_item_once(uuid,jsonb) to authenticated;
revoke insert on public.items from public,anon,authenticated;
do $$ declare cols text;begin
  select string_agg(format('%I',attname),',') into cols from pg_catalog.pg_attribute
    where attrelid='public.items'::regclass and attnum>0 and not attisdropped;
  execute format('revoke insert (%s) on public.items from public,anon,authenticated',cols);
end;$$;
commit;
