-- READ ONLY. Never select queue rows, HTTP bodies/headers, Vault plaintext or cron commands.
-- Expected extensions are installed in the reported staging environment.
select extname,extversion from pg_extension where extname in('pg_cron','pg_net','supabase_vault') order by extname;
select n.nspname as schema_name,c.relname as relation_name,pg_get_userbyid(c.relowner) as owner,
 c.relrowsecurity as rls,c.relforcerowsecurity as force_rls,
 has_schema_privilege('anon',n.oid,'usage') as anon_schema_usage,
 has_schema_privilege('authenticated',n.oid,'usage') as authenticated_schema_usage,
 has_table_privilege('anon',c.oid,'select') as anon_effective_select,
 has_table_privilege('authenticated',c.oid,'select') as authenticated_effective_select,
 coalesce((select jsonb_agg(distinct a.privilege_type order by a.privilege_type) from aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a where a.grantee=0),'[]') as public_privileges
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where (n.nspname='net' and c.relname in('http_request_queue','_http_response'))
 or (n.nspname='vault' and c.relname='decrypted_secrets')
order by n.nspname,c.relname;
-- An unset value is UNKNOWN, not proof that the API exposes or hides net.
select nullif(current_setting('pgrst.db_schemas',true),'') as session_postgrest_schemas;
-- Only known application jobs, no command column or identity/token data.
select jobname,active,schedule from cron.job
where jobname in('buscag-staging-match-worker','buscag-staging-push-minute') order by jobname;
