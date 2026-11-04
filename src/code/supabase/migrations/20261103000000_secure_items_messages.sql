-- Prepared for review. Apply manually only after the staging checks.
begin;
-- Replace the complete client policy set: old permissive policies combine with OR.
-- Snapshot existing policies/ACLs before applying; see SECURITY_ROLLOUT.md.
do $$
declare r record; column_list text; target text;
begin
  for r in select tablename, policyname from pg_catalog.pg_policies
    where schemaname = 'public' and tablename in ('items', 'messages')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
  foreach target in array array['items', 'messages']
  loop
    execute format('revoke all privileges on table public.%I from public, anon, authenticated', target);
    select string_agg(format('%I', a.attname), ', ' order by a.attnum)
      into column_list
      from pg_catalog.pg_attribute a
      where a.attrelid = format('public.%I', target)::regclass
        and a.attnum > 0 and not a.attisdropped;
    -- Table REVOKE does not remove old column-level grants.
    execute format('revoke all privileges (%s) on table public.%I from public, anon, authenticated', column_list, target);
    execute format('alter table public.%I enable row level security', target);
  end loop;
end;
$$;

grant select, delete on public.items to authenticated;
grant insert (owner_id, title, description, category, status, location_name,
  lat, lng, date, image_url, reward) on public.items to authenticated;
grant update (title, description, category, status, location_name,
  lat, lng, date, image_url, reward) on public.items to authenticated;

create policy items_read on public.items for select to authenticated using (true);
create policy items_insert on public.items for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy items_update on public.items for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy items_delete on public.items for delete to authenticated
  using (owner_id = (select auth.uid()));

grant select on public.messages to authenticated;
grant insert (item_id, sender_id, recipient_id, sender_name, sender_avatar,
  item_title, item_image, text) on public.messages to authenticated;
grant update (is_read) on public.messages to authenticated;

create policy messages_read on public.messages for select to authenticated
  using ((select auth.uid()) in (sender_id, recipient_id));
-- A direct self-query in an INSERT policy can recurse during RLS expansion.
-- This read-only helper checks only the current caller's permitted conversation.
create function public.can_send_item_message(p_item_id uuid, p_recipient_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null
    and p_recipient_id <> (select auth.uid())
    and (
      exists (
        select 1 from public.items i
        where i.id = p_item_id and i.owner_id = p_recipient_id
      )
      or exists (
        select 1 from public.messages existing
        where existing.item_id = p_item_id
          and (
            (existing.sender_id = (select auth.uid())
              and existing.recipient_id = p_recipient_id)
            or (existing.sender_id = p_recipient_id
              and existing.recipient_id = (select auth.uid()))
          )
      )
    );
$$;
revoke all on function public.can_send_item_message(uuid, uuid) from public, anon, authenticated;
grant execute on function public.can_send_item_message(uuid, uuid) to authenticated;
create policy messages_insert on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.can_send_item_message(messages.item_id, messages.recipient_id)
  );
create policy messages_read_receipt on public.messages for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

-- Denormalized display fields are supplied by the current client, but must not
-- be trusted as identity. Canonicalize them before the existing AFTER trigger.
create function public.canonicalize_message_display()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  select p.full_name, p.avatar_url into new.sender_name, new.sender_avatar
    from public.profiles p where p.id = new.sender_id;
  select coalesce(nullif(btrim(i.title),''),'Publicación sin título'), coalesce(i.image_url,'') into new.item_title, new.item_image
    from public.items i where i.id = new.item_id;
  return new;
end;
$$;
revoke all on function public.canonicalize_message_display() from public, anon, authenticated;
drop trigger if exists canonicalize_message_display on public.messages;
create trigger canonicalize_message_display before insert on public.messages
  for each row execute function public.canonicalize_message_display();
commit;
