-- Deploy the compatible data client before this migration; see rollout guide.
begin;
-- Replace the complete client policy set: old permissive policies combine with OR.
-- Snapshot existing policies/ACLs before applying; see SECURITY_ROLLOUT.md.
do $$
declare r record; column_list text; target text;
begin
  for r in select tablename, policyname from pg_catalog.pg_policies
    where schemaname = 'public' and tablename in ('profiles')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
  foreach target in array array['profiles']
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

grant select on public.profiles to authenticated;
grant insert (id, full_name, avatar_url, phone, location) on public.profiles to authenticated;
-- id is included because the fallback client uses upsert; RLS fixes it to uid.
grant update (id, full_name, avatar_url, phone, location) on public.profiles to authenticated;
create policy profiles_read_self on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_insert_self on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Intentional owner-executed view: it projects a safe directory while profiles
-- itself remains self-only. Run as the trusted migration owner (postgres).
-- Never change this to SELECT p.* or add private fields without a review.
create view public.public_profiles with (security_barrier = true) as
select p.id, p.full_name, p.avatar_url, p.rating, p.created_at,
  case when access.can_contact then p.phone else ''::text end as phone,
  case when access.can_contact then p.location else ''::text end as location
from public.profiles p
cross join lateral (
  select p.id = (select auth.uid()) or exists (
    select 1 from public.messages m
    where m.sender_id = p.id and m.recipient_id = (select auth.uid())
      and exists (
        select 1 from public.messages reply
        where reply.item_id = m.item_id
          and reply.sender_id = (select auth.uid()) and reply.recipient_id = p.id
      )
  ) as can_contact
) access
where (select auth.uid()) is not null;
revoke all on public.public_profiles from public, anon, authenticated;
grant select on public.public_profiles to authenticated;
comment on view public.public_profiles is
  'Public identity for signed-in users; phone/location only for self or reciprocal conversation participants. Trusted owner projection.';
commit;
