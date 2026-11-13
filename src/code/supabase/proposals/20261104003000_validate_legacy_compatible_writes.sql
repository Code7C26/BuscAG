-- CANDIDATE: after the reviewed baseline and three workflow proposals.
-- No backfill, NOT NULL conversion, CHECK validation scan, FK change or row rewrite.
-- Old incomplete fields may remain unchanged; new/changed content must be valid.
begin;
do $$begin
  if to_regprocedure('public.publish_item_once(uuid,jsonb)') is null
    or to_regprocedure('public.send_message_once(uuid,uuid,uuid,text)') is null then
    raise exception 'Reviewed workflow RPC baseline required';
  end if;
end;$$;
create function public.validate_item_content_write() returns trigger
language plpgsql security invoker set search_path='' as $$
declare fresh boolean:=tg_op='INSERT';
begin
  if fresh or new.title is distinct from old.title then
    if new.title is null or new.title !~ '[^[:space:]]' or char_length(new.title)>200 then raise exception 'Invalid publication title' using errcode='22023';end if;
  end if;
  if fresh or new.description is distinct from old.description then
    if new.description is null or new.description !~ '[^[:space:]]' or char_length(new.description)>10000 then raise exception 'Invalid publication description' using errcode='22023';end if;
  end if;
  if fresh or new.category is distinct from old.category then
    if new.category is null or new.category not in ('Electrónicos','Documentos y Billeteras','Mascotas','Llaves','Mochilas y Bolsos','Indumentaria','Otros') then raise exception 'Invalid publication category' using errcode='22023';end if;
  end if;
  if fresh or new.status is distinct from old.status then
    if new.status is null or new.status not in ('perdido','encontrado','recuperado') then raise exception 'Invalid publication status' using errcode='22023';end if;
  end if;
  if fresh or new.location_name is distinct from old.location_name then
    if new.location_name is null or new.location_name !~ '[^[:space:]]' or char_length(new.location_name)>300 then raise exception 'Invalid publication location' using errcode='22023';end if;
  end if;
  if fresh or new.lat is distinct from old.lat then
    if new.lat is null or not(new.lat between -90 and 90) then raise exception 'Invalid latitude' using errcode='22023';end if;
  end if;
  if fresh or new.lng is distinct from old.lng then
    if new.lng is null or not(new.lng between -180 and 180) then raise exception 'Invalid longitude' using errcode='22023';end if;
  end if;
  if fresh or new.date is distinct from old.date then
    if new.date is null or not isfinite(new.date) then raise exception 'Invalid publication date' using errcode='22023';end if;
  end if;
  if fresh or new.image_url is distinct from old.image_url then
    if new.image_url is null or new.image_url !~ '^https://' or char_length(new.image_url)>4096 then raise exception 'Invalid publication image' using errcode='22023';end if;
  end if;
  if fresh or new.reward is distinct from old.reward then
    if char_length(coalesce(new.reward,''))>200 then raise exception 'Invalid publication reward' using errcode='22023';end if;
  end if;
  return new;
end;$$;
revoke all on function public.validate_item_content_write() from public,anon,authenticated,service_role;
create trigger validate_item_content_write before insert or update of title,description,category,status,location_name,lat,lng,date,image_url,reward on public.items
  for each row execute function public.validate_item_content_write();

-- Preserve the existing recovered-notice trigger/body, including custom logic.
-- Its known repository stand-in concatenates a nullable item title. Repair only
-- the NEW notice's missing display text, never the historic item's fields.
create function public.ensure_recovered_notice_text() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.type='recovered' then
    new.title:=coalesce(new.title,'Objeto recuperado');
    new.message:=coalesce(new.message,'La publicación fue marcada como recuperada.');
  end if;
  return new;
end;$$;
revoke all on function public.ensure_recovered_notice_text() from public,anon,authenticated,service_role;
create trigger ensure_recovered_notice_text before insert on public.notifications
  for each row execute function public.ensure_recovered_notice_text();
commit;
