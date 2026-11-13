-- READ ONLY. Capture results privately before reviewing/applying the migrations.
-- Does not read application rows, auth metadata or secret settings.
select n.nspname as schema_name, c.relname, c.relkind,
  pg_catalog.pg_get_userbyid(c.relowner) as owner,
  c.relrowsecurity, c.relforcerowsecurity, c.relacl
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where c.relname in ('items','profiles','messages','notifications',
  'push_subscriptions','public_profiles')
order by n.nspname, c.relname;

select * from pg_catalog.pg_policies
where schemaname='public' and tablename in
  ('items','profiles','messages','notifications','push_subscriptions')
order by tablename, policyname;

select c.relname, a.attname,
  pg_catalog.format_type(a.atttypid,a.atttypmod) as column_type,
  a.attnotnull, pg_catalog.pg_get_expr(d.adbin,d.adrelid) as column_default,
  a.attacl
from pg_catalog.pg_attribute a
join pg_catalog.pg_class c on c.oid=a.attrelid
join pg_catalog.pg_namespace n on n.oid=c.relnamespace
left join pg_catalog.pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
where n.nspname='public' and c.relname in
  ('items','profiles','messages','notifications','push_subscriptions')
  and a.attnum>0 and not a.attisdropped
order by c.relname,a.attnum;

select r.rolname,r.rolsuper,r.rolbypassrls,
  parent.rolname as inherited_role
from pg_catalog.pg_roles r
left join pg_catalog.pg_auth_members m on m.member=r.oid
left join pg_catalog.pg_roles parent on parent.oid=m.roleid
where r.rolname in ('anon','authenticated')
order by r.rolname,parent.rolname;

-- Do not print trigger arguments: webhook headers may contain secrets.
select n.nspname as schema_name,c.relname,t.tgname,t.tgenabled,
  fn.nspname as function_schema, f.proname as function_name
from pg_catalog.pg_trigger t
join pg_catalog.pg_class c on c.oid=t.tgrelid
join pg_catalog.pg_namespace n on n.oid=c.relnamespace
join pg_catalog.pg_proc f on f.oid=t.tgfoid
join pg_catalog.pg_namespace fn on fn.oid=f.pronamespace
where not t.tgisinternal
  and ((n.nspname='public' and c.relname in ('items','messages'))
    or (n.nspname='auth' and c.relname='users'))
order by n.nspname,c.relname,t.tgname;

select n.nspname as schema_name,p.proname,
  pg_catalog.pg_get_userbyid(p.proowner) as owner,
  p.prosecdef,p.proconfig,p.proacl
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
  ('handle_new_auth_user','notify_message_recipient','notify_item_recovered',
   'can_send_item_message','canonicalize_message_display')
order by p.proname;

select n.nspname as schema_name,c.relname,con.conname,
  pg_catalog.pg_get_constraintdef(con.oid) as definition
from pg_catalog.pg_constraint con
join pg_catalog.pg_class c on c.oid=con.conrelid
join pg_catalog.pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in
  ('items','profiles','messages','notifications','push_subscriptions')
order by c.relname,con.conname;
