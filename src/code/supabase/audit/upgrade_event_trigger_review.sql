-- READ ONLY. Run ONLY in the verified Prueba SQL Editor.
-- First results are metadata. Final function definitions must be reviewed privately:
-- unknown functions may embed sensitive literals. Do not commit/export raw output.
select current_setting('server_version') as postgres_version;
select e.evtname,e.evtevent,e.evtenabled,e.evttags,
 pg_get_userbyid(e.evtowner) as event_owner,
 n.nspname as function_schema,p.proname,pg_get_function_identity_arguments(p.oid) as arguments,
 pg_get_userbyid(p.proowner) as function_owner,l.lanname,p.prosecdef,p.proconfig,
 md5(pg_get_functiondef(p.oid)) as definition_hash,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
 has_function_privilege('service_role',p.oid,'EXECUTE') as service_execute,
 (select jsonb_agg(jsonb_build_object('extension',x.extname,'dependency',d.deptype) order by x.extname)
  from pg_depend d join pg_extension x on x.oid=d.refobjid
  where d.classid='pg_proc'::regclass and d.objid=p.oid and d.refclassid='pg_extension'::regclass) as extension_dependencies
from pg_event_trigger e join pg_proc p on p.oid=e.evtfoid
join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
order by e.evtname;
-- Actual ACLs, including grantor; effective EXECUTE alone cannot identify origin.
select p.oid::regprocedure::text as signature,
 case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end as grantee,
 pg_get_userbyid(a.grantor) as grantor,a.privilege_type,a.is_grantable
from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
where p.oid in(to_regprocedure('public.can_send_item_message(uuid,uuid)'),
 to_regprocedure('public.canonicalize_message_display()')) order by signature,grantee;
select pg_get_userbyid(d.defaclrole) as owner,n.nspname as schema,
 d.defaclobjtype,case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end as grantee,
 a.privilege_type,a.is_grantable
from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace
cross join lateral aclexplode(d.defaclacl) a where d.defaclobjtype='f'
order by owner,schema,grantee;
select rolname,rolsuper,rolbypassrls,rolinherit,rolcanlogin from pg_roles
where rolname in('anon','authenticated','service_role');
select pg_has_role('anon','service_role','MEMBER') as anon_service_member,
 pg_has_role('authenticated','service_role','MEMBER') as auth_service_member;
-- Distinguish PG18 catalog NOT NULL entries from required CHECK/PK/FK/UNIQUE.
select n.nspname,c.relname,k.conname,k.contype,k.convalidated,
 pg_get_constraintdef(k.oid,true) as definition
from pg_constraint k join pg_class c on c.oid=k.conrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='buscag_private' or (n.nspname='public' and c.relname in
 ('items','profiles','messages','notifications','push_subscriptions'))
order by n.nspname,c.relname,k.conname;
-- PRIVATE REVIEW: compare with the official Supabase/PostgREST source/version.
-- A familiar name/schema/owner alone is never evidence of an unchanged body.
select e.evtname,pg_get_functiondef(e.evtfoid) as definition
from pg_event_trigger e order by e.evtname;
