-- READ ONLY. Automatic supplement to catalog v1. No application rows or raw bodies.
with event_functions as (
 select e.*,p.*,n.nspname,l.lanname
 from pg_event_trigger e join pg_proc p on p.oid=e.evtfoid
 join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
), service_functions as (
 select p.* from pg_proc p where p.oid in
 (to_regprocedure('public.can_send_item_message(uuid,uuid)'),to_regprocedure('public.canonicalize_message_display()'))
)
select jsonb_build_object(
 'version',1,'server_version_num',current_setting('server_version_num')::integer,
 'event_triggers',(select jsonb_agg(jsonb_build_object(
 'name',evtname,'event',evtevent,'enabled',evtenabled,'tags',evttags,
 'event_owner',pg_get_userbyid(evtowner),'schema',nspname,'function',proname,
 'arguments',pg_get_function_identity_arguments(evtfoid),'result',pg_get_function_result(evtfoid),
 'function_owner',pg_get_userbyid(proowner),'language',lanname,'config',proconfig,
 'security_definer',prosecdef,'strict',proisstrict,'leakproof',proleakproof,'parallel',proparallel,'volatility',provolatile,
 'body_sha256',encode(sha256(convert_to(replace(prosrc,E'\r\n',E'\n'),'UTF8')),'hex'),
 'acl',(select jsonb_agg(jsonb_build_object('grantee',case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,
 'grantor',pg_get_userbyid(a.grantor),'privilege',a.privilege_type,'grantable',a.is_grantable) order by a.grantee,a.privilege_type)
 from aclexplode(coalesce(proacl,acldefault('f',proowner))) a),
 'extension_dependencies',(select jsonb_agg(jsonb_build_object('extension',x.extname,'type',d.deptype) order by x.extname)
 from pg_depend d join pg_extension x on x.oid=d.refobjid where d.classid='pg_proc'::regclass and d.objid=evtfoid and d.refclassid='pg_extension'::regclass)
 ) order by evtname) from event_functions),
 'service_role',(select jsonb_build_object('name',rolname,'super',rolsuper,'bypass',rolbypassrls,'inherit',rolinherit,'login',rolcanlogin) from pg_roles where rolname='service_role'),
 'clients_can_become_service',jsonb_build_object('anon',pg_has_role('anon','service_role','MEMBER'),
 'authenticated',pg_has_role('authenticated','service_role','MEMBER')),
 'clients_can_become_admin',jsonb_build_object(
 'anon',case when to_regrole('supabase_admin') is null then null else pg_has_role('anon','supabase_admin','MEMBER') end,
 'authenticated',case when to_regrole('supabase_admin') is null then null else pg_has_role('authenticated','supabase_admin','MEMBER') end),
 'extensions_schema',(select jsonb_build_object('owner',pg_get_userbyid(nspowner),
 'anon_create',has_schema_privilege('anon',oid,'CREATE'),'auth_create',has_schema_privilege('authenticated',oid,'CREATE'))
 from pg_namespace where nspname='extensions'),
 'service_function_acls',(select jsonb_agg(jsonb_build_object('name',proname,
 'acl',(select jsonb_agg(jsonb_build_object('grantee',case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,
 'grantor',pg_get_userbyid(a.grantor),'privilege',a.privilege_type,'grantable',a.is_grantable) order by a.grantee,a.privilege_type)
 from aclexplode(coalesce(proacl,acldefault('f',proowner))) a)) order by proname) from service_functions)
 ) as evidence;
