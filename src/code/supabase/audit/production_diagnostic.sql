-- Manual diagnostic only: a single SELECT, no dynamic SQL and no application rows.
-- Returns one JSON value so the SQL Editor does not hide earlier result sets.
-- Trigger arguments and function bodies are intentionally omitted (possible secrets).
WITH expected(name, kind) AS (
  VALUES ('items','table'), ('profiles','table'), ('messages','table'),
    ('notifications','table'), ('push_subscriptions','table'), ('public_profiles','view')
), targets AS (
  SELECT c.*, n.nspname AS schema_name
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname IN (SELECT name FROM expected)
), client_roles AS (
  SELECT * FROM pg_catalog.pg_roles WHERE rolname IN ('anon','authenticated','service_role')
), columns AS (
  SELECT t.oid, t.relname AS relation_name, a.attnum, a.attname AS column_name,
    pg_catalog.format_type(a.atttypid,a.atttypmod) AS column_type,
    a.attnotnull AS not_null, a.attidentity AS identity_kind,
    a.attgenerated AS generated_kind, d.oid IS NOT NULL AS has_default,
    CASE WHEN a.attname IN ('id','created_at','updated_at','date','rating','contact_count','is_read')
      THEN pg_catalog.pg_get_expr(d.adbin,d.adrelid)
      WHEN d.oid IS NOT NULL THEN '[default omitted]' END AS default_expression,
    a.attacl::text AS column_acl
  FROM targets t
  JOIN pg_catalog.pg_attribute a ON a.attrelid=t.oid
  LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
  WHERE a.attnum>0 AND NOT a.attisdropped
), inventory AS (
  SELECT e.name,e.kind AS expected_kind,t.relkind AS actual_kind,
    t.oid IS NOT NULL AS exists_in_public,
    pg_catalog.pg_get_userbyid(t.relowner) AS owner,
    t.relrowsecurity AS rls_enabled,t.relforcerowsecurity AS rls_forced,
    t.reloptions,t.relacl::text AS table_acl
  FROM expected e LEFT JOIN targets t ON t.relname=e.name
), policies AS (
  SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
  FROM pg_catalog.pg_policies
  WHERE (schemaname='public' AND tablename IN (SELECT name FROM expected))
    OR (schemaname='storage' AND tablename='objects')
), table_permissions AS (
  SELECT t.relname,r.rolname,
    has_schema_privilege(r.oid,t.relnamespace,'USAGE') AS schema_usage,
    has_table_privilege(r.oid,t.oid,'SELECT') AS can_select_table,
    has_table_privilege(r.oid,t.oid,'INSERT') AS can_insert_table,
    has_table_privilege(r.oid,t.oid,'UPDATE') AS can_update_table,
    has_table_privilege(r.oid,t.oid,'DELETE') AS can_delete,
    has_any_column_privilege(r.oid,t.oid,'SELECT') AS can_select_any_column,
    has_any_column_privilege(r.oid,t.oid,'INSERT') AS can_insert_any_column,
    has_any_column_privilege(r.oid,t.oid,'UPDATE') AS can_update_any_column
  FROM targets t CROSS JOIN client_roles r
), column_permissions AS (
  SELECT c.relation_name,c.column_name,r.rolname,
    has_column_privilege(r.oid,c.oid,c.attnum,'SELECT') AS can_select,
    has_column_privilege(r.oid,c.oid,c.attnum,'INSERT') AS can_insert,
    has_column_privilege(r.oid,c.oid,c.attnum,'UPDATE') AS can_update
  FROM columns c CROSS JOIN client_roles r
  WHERE r.rolname IN ('anon','authenticated')
), constraints AS (
  SELECT t.relname,c.conname,c.contype,c.convalidated,
    pg_catalog.pg_get_constraintdef(c.oid) AS definition
  FROM pg_catalog.pg_constraint c JOIN targets t ON t.oid=c.conrelid
), indexes AS (
  SELECT t.relname,i.indexrelid::regclass::text AS index_name,
    i.indisvalid,i.indisunique,pg_catalog.pg_get_indexdef(i.indexrelid) AS definition
  FROM pg_catalog.pg_index i JOIN targets t ON t.oid=i.indrelid
), triggers AS (
  SELECT n.nspname,c.relname,t.tgname,t.tgenabled,
    fn.nspname AS function_schema,p.proname AS function_name
  FROM pg_catalog.pg_trigger t
  JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
  JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid
  JOIN pg_catalog.pg_namespace fn ON fn.oid=p.pronamespace
  WHERE NOT t.tgisinternal AND
    (c.oid IN (SELECT oid FROM targets) OR (n.nspname='auth' AND c.relname='users'))
), functions AS (
  SELECT n.nspname,p.proname,pg_catalog.oidvectortypes(p.proargtypes) AS argument_types,
    pg_catalog.pg_get_function_result(p.oid) AS return_type,
    pg_catalog.pg_get_userbyid(p.proowner) AS owner,p.prosecdef,p.proconfig,p.proacl::text,
    md5(p.prosrc) AS source_fingerprint
  FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
  WHERE (n.nspname='public' AND p.proname IN
    ('can_send_item_message','canonicalize_message_display','handle_new_auth_user',
     'notify_message_recipient','notify_item_recovered','send_message_once',
     'process_match_jobs','buscag_capabilities','publish_item_once'))
    OR (n.nspname='auth' AND p.proname='uid')
), rpc_permissions AS (
  SELECT n.nspname,p.proname,pg_catalog.oidvectortypes(p.proargtypes) AS argument_types,r.rolname,
    has_schema_privilege(r.oid,n.oid,'USAGE') AS schema_usage,
    has_function_privilege(r.oid,p.oid,'EXECUTE') AS can_execute
  FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
  CROSS JOIN client_roles r
  WHERE n.nspname='public' AND p.proname IN ('can_send_item_message','send_message_once','process_match_jobs','buscag_capabilities','publish_item_once')
), foreign_key_edges AS (
  SELECT cn.nspname AS child_schema,child.relname AS child_table,
    pn.nspname AS parent_schema,parent.relname AS parent_table,c.conname,c.convalidated,
    CASE c.confdeltype WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL'
      WHEN 'd' THEN 'SET DEFAULT' WHEN 'r' THEN 'RESTRICT' ELSE 'NO ACTION' END AS on_delete,
    pg_catalog.pg_get_constraintdef(c.oid) AS definition
  FROM pg_catalog.pg_constraint c
  JOIN pg_catalog.pg_class child ON child.oid=c.conrelid
  JOIN pg_catalog.pg_namespace cn ON cn.oid=child.relnamespace
  JOIN pg_catalog.pg_class parent ON parent.oid=c.confrelid
  JOIN pg_catalog.pg_namespace pn ON pn.oid=parent.relnamespace
  WHERE c.contype='f' AND (c.conrelid IN (SELECT oid FROM targets) OR c.confrelid IN (SELECT oid FROM targets))
), private_workflows AS (
  SELECT name,to_regclass('buscag_private.'||name) IS NOT NULL AS exists
  FROM (VALUES ('message_receipts'),('match_jobs'),('match_notices'),('publication_receipts')) x(name)
), private_permissions AS (
  SELECT c.relname,r.rolname,c.relrowsecurity,
    has_schema_privilege(r.oid,n.oid,'USAGE') AS schema_usage,
    has_table_privilege(r.oid,c.oid,'SELECT') AS can_select,
    has_table_privilege(r.oid,c.oid,'INSERT') AS can_insert,
    has_table_privilege(r.oid,c.oid,'UPDATE') AS can_update,
    has_table_privilege(r.oid,c.oid,'DELETE') AS can_delete
  FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  CROSS JOIN client_roles r WHERE n.nspname='buscag_private' AND c.relkind='r'
), inherited_roles AS (
  SELECT r.rolname AS client_role,p.rolname AS member_of,p.rolsuper,p.rolbypassrls,
    pg_has_role(r.oid,p.oid,'USAGE') AS immediately_available
  FROM client_roles r CROSS JOIN pg_catalog.pg_roles p
  WHERE r.oid<>p.oid AND pg_has_role(r.oid,p.oid,'MEMBER')
), dependent_views AS (
  SELECT DISTINCT vn.nspname AS view_schema,v.relname AS view_name,
    pg_catalog.pg_get_userbyid(v.relowner) AS owner,v.reloptions,
    t.relname AS referenced_relation
  FROM pg_catalog.pg_depend d
  JOIN pg_catalog.pg_rewrite rw ON rw.oid=d.objid AND d.classid='pg_catalog.pg_rewrite'::regclass
  JOIN pg_catalog.pg_class v ON v.oid=rw.ev_class
  JOIN pg_catalog.pg_namespace vn ON vn.oid=v.relnamespace
  JOIN targets t ON t.oid=d.refobjid AND d.refclassid='pg_catalog.pg_class'::regclass
  WHERE v.relkind IN ('v','m') AND v.oid<>t.oid
)
SELECT jsonb_pretty(jsonb_build_object(
  '01_context',jsonb_build_object('database',current_database(),'role',current_user,
    'server_version',current_setting('server_version'),
    'migration_history_exists',to_regclass('supabase_migrations.schema_migrations') IS NOT NULL,
    'warning','Metadata only. Grants do not prove row access; SQL Editor privileges may bypass RLS.'),
  '02_inventory',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY name) FROM inventory x),'[]'),
  '03_same_names_other_schemas',COALESCE((SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'kind',c.relkind))
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relname IN (SELECT name FROM expected) AND n.nspname<>'public'),'[]'),
  '04_columns',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY relation_name,attnum) FROM columns x),'[]'),
  '05_policies',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY schemaname,tablename,policyname) FROM policies x),'[]'),
  '06_roles',COALESCE((SELECT jsonb_agg(jsonb_build_object('role',rolname,'superuser',rolsuper,'bypass_rls',rolbypassrls,'inherits',rolinherit)) FROM client_roles),'[]'),
  '07_inherited_roles',COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM inherited_roles x),'[]'),
  '08_table_permissions',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY relname,rolname) FROM table_permissions x),'[]'),
  '09_column_permissions',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY relation_name,column_name,rolname) FROM column_permissions x),'[]'),
  '10_constraints',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY relname,conname) FROM constraints x),'[]'),
  '11_indexes',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY relname,index_name) FROM indexes x),'[]'),
  '12_triggers_without_arguments',COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM triggers x),'[]'),
  '13_function_metadata_not_bodies',COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM functions x),'[]'),
  '14_dependent_views',COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM dependent_views x),'[]'),
  '16_foreign_key_delete_graph',COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM foreign_key_edges x),'[]'),
  '17_optional_workflow_inventory',COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM private_workflows x),'[]'),
  '18_rpc_permissions',COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM rpc_permissions x),'[]'),
  '19_private_workflow_permissions',COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM private_permissions x),'[]'),
  '15_realtime',COALESCE((SELECT jsonb_agg(jsonb_build_object('publication',pubname,'schema',schemaname,'table',tablename))
    FROM pg_catalog.pg_publication_tables WHERE schemaname='public' AND tablename IN (SELECT name FROM expected)),'[]')
)) AS diagnostic;
