-- Repairs environments where the older push migration was never applied.
-- Creating this table alone does not configure delivery, VAPID or the webhook.
begin;
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);
-- Replace the complete client policy set: old permissive policies combine with OR.
-- Snapshot existing policies/ACLs before applying; see SECURITY_ROLLOUT.md.
do $$
declare r record; column_list text; target text;
begin
  for r in select tablename, policyname from pg_catalog.pg_policies
    where schemaname = 'public' and tablename in ('push_subscriptions')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
  foreach target in array array['push_subscriptions']
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

grant select, delete on public.push_subscriptions to authenticated;
grant insert (user_id, endpoint, p256dh, auth) on public.push_subscriptions to authenticated;
grant update (user_id, endpoint, p256dh, auth) on public.push_subscriptions to authenticated;
create policy push_subscriptions_owner on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- send-push reads subscriptions and removes endpoints rejected as expired.
grant select, delete on public.push_subscriptions to service_role;
commit;
