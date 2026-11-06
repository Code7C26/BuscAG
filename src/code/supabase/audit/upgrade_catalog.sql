-- READ ONLY, single result; no application rows, connection info or credentials.
-- Definition hashes detect drift; examine definitions privately with the existing
-- readiness queries. A matching inventory alone never proves behaviour/security.
with relations as (
 select c.*, n.nspname from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where (n.nspname='public' and c.relname in
 ('items','profiles','messages','notifications','push_subscriptions','public_profiles'))
 or (n.nspname='buscag_private' and c.relkind in('r','v','m','p'))
), functions as (
 select p.*,n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in('public','buscag_private') and p.prokind='f'
 and not exists(select from pg_depend d where d.classid='pg_proc'::regclass
 and d.objid=p.oid and d.deptype='e')
), snapshot as (select jsonb_build_object(
 'version',1,
 'public_schema',(select jsonb_build_object('anon_usage',has_schema_privilege('anon',oid,'USAGE'),
 'auth_usage',has_schema_privilege('authenticated',oid,'USAGE'),'anon_create',has_schema_privilege('anon',oid,'CREATE'),
 'auth_create',has_schema_privilege('authenticated',oid,'CREATE')) from pg_namespace where nspname='public'),
 'managed_dependencies',jsonb_build_object(
 'auth_usage',has_schema_privilege('authenticated','auth','USAGE'),
 'auth_uid_execute',has_function_privilege('authenticated','auth.uid()','EXECUTE'),
 'storage_usage',has_schema_privilege('authenticated','storage','USAGE')),
 'roles',(select jsonb_agg(jsonb_build_object('name',rolname,'super',rolsuper,'bypass',rolbypassrls,'inherit',rolinherit) order by rolname)
 from pg_roles where rolname in('anon','authenticated')),
 'role_memberships',(select jsonb_agg(jsonb_build_object('member',member_role.rolname,
 'role',parent_role.rolname,'admin',m.admin_option,
 'inherit',coalesce((to_jsonb(m)->>'inherit_option')::boolean,member_role.rolinherit),
 'set',coalesce((to_jsonb(m)->>'set_option')::boolean,true))
 order by member_role.rolname,parent_role.rolname)
 from pg_auth_members m join pg_roles member_role on member_role.oid=m.member
 join pg_roles parent_role on parent_role.oid=m.roleid where member_role.rolname in('anon','authenticated')),
 'private_schema',(select jsonb_build_object('owner',pg_get_userbyid(nspowner),
 'anon_usage',has_schema_privilege('anon',oid,'USAGE'),'auth_usage',has_schema_privilege('authenticated',oid,'USAGE'),
 'anon_create',has_schema_privilege('anon',oid,'CREATE'),'auth_create',has_schema_privilege('authenticated',oid,'CREATE'))
 from pg_namespace where nspname='buscag_private'),
 'relations',(select jsonb_agg(jsonb_build_object('schema',nspname,'name',relname,'kind',relkind,
 'owner',pg_get_userbyid(relowner),'rls',relrowsecurity,'force_rls',relforcerowsecurity,
 'view_hash',case when relkind in('v','m') then md5(pg_get_viewdef(oid,true)) end,
 'view_options',reloptions,
 'privileges',(select jsonb_agg(jsonb_build_object('role',r,'operation',op,'allowed',has_table_privilege(r,relations.oid,op)) order by r,op)
 from unnest(array['anon','authenticated']) r cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) op))
 order by nspname,relname) from relations),
 'columns',(select jsonb_agg(jsonb_build_object('schema',c.nspname,'table',c.relname,'name',a.attname,
 'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,
 'default_hash',md5(pg_get_expr(d.adbin,d.adrelid)),
 'privileges',(select jsonb_agg(jsonb_build_object('role',r,'operation',op,'allowed',has_column_privilege(r,c.oid,a.attnum,op)) order by r,op)
 from unnest(array['anon','authenticated']) r cross join unnest(array['SELECT','INSERT','UPDATE','REFERENCES']) op))
 order by c.nspname,c.relname,a.attnum)
 from relations c join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
 left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum),
 'constraints',(select jsonb_agg(jsonb_build_object('schema',c.nspname,'table',c.relname,'name',k.conname,
 'validated',k.convalidated,'definition_hash',md5(pg_get_constraintdef(k.oid,true))) order by c.nspname,c.relname,k.conname)
 from relations c join pg_constraint k on k.conrelid=c.oid),
 'indexes',(select jsonb_agg(jsonb_build_object('schema',c.nspname,'table',c.relname,'name',ci.relname,
 'valid',i.indisvalid,'ready',i.indisready,'definition_hash',md5(pg_get_indexdef(i.indexrelid))) order by c.nspname,c.relname,ci.relname)
 from relations c join pg_index i on i.indrelid=c.oid join pg_class ci on ci.oid=i.indexrelid),
 'policies',(select jsonb_agg(jsonb_build_object('schema',schemaname,'table',tablename,'name',policyname,
 'permissive',permissive,'roles',roles,'command',cmd,'using_hash',md5(qual),'check_hash',md5(with_check)) order by schemaname,tablename,policyname)
 from pg_policies where (schemaname,tablename) in(select nspname,relname from relations)
 or (schemaname='storage' and tablename='objects')),
 'functions',(select jsonb_agg(jsonb_build_object('schema',nspname,'name',proname,
 'arguments',pg_get_function_identity_arguments(oid),'defaults_hash',md5(pg_get_expr(proargdefaults,0)),
 'result',pg_get_function_result(oid),'language',(select lanname from pg_language where oid=prolang),
 'body_hash',md5(btrim(replace(prosrc,E'\r\n',E'\n'))),'owner',pg_get_userbyid(proowner),
 'security_definer',prosecdef,'config',proconfig,'volatility',provolatile,'strict',proisstrict,
 'leakproof',proleakproof,'parallel',proparallel,
 'anon_execute',has_function_privilege('anon',oid,'EXECUTE'),
 'auth_execute',has_function_privilege('authenticated',oid,'EXECUTE'),
 'service_execute',has_function_privilege('service_role',oid,'EXECUTE')) order by nspname,proname,pg_get_function_identity_arguments(oid)) from functions),
 'triggers',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',t.tgname,
 'enabled',t.tgenabled,'definition_hash',md5(pg_get_triggerdef(t.oid,true)),
 'owner',pg_get_userbyid(p.proowner),'security_definer',p.prosecdef,'config',p.proconfig,
 'language',(select lanname from pg_language where oid=p.prolang),
 'function_hash',md5(btrim(replace(p.prosrc,E'\r\n',E'\n')))) order by n.nspname,c.relname,t.tgname)
 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
 join pg_proc p on p.oid=t.tgfoid where not t.tgisinternal and
 (t.tgrelid in(select oid from relations) or t.tgrelid=to_regclass('auth.users'))),
 'event_triggers',(select jsonb_agg(jsonb_build_object('name',evtname,'event',evtevent,'enabled',evtenabled,
 'function',evtfoid::regprocedure::text,'tags',evttags) order by evtname) from pg_event_trigger),
 'storage',(select jsonb_agg(jsonb_build_object('id',id,'public',public,'limit',file_size_limit,'mime',allowed_mime_types) order by id)
 from storage.buckets where id='item-images'),
 'storage_rls',(select relrowsecurity from pg_class where oid=to_regclass('storage.objects')),
 'realtime',(select jsonb_agg(tablename order by tablename) from pg_publication_tables
 where pubname='supabase_realtime' and schemaname='public' and tablename in('items','messages','notifications'))
 ) as catalog)
select catalog from snapshot;
