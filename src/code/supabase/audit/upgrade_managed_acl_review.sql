-- READ ONLY. Run in the verified Supabase PRUEBA SQL Editor, project
-- yiarlhpbgkofhhipkfha. No bodies, user rows, secrets or SQL execution.
begin transaction read only;
select jsonb_build_object(
 'name',e.evtname,
 'function_schema',n.nspname,
 'function_name',p.proname,
 'arguments',pg_catalog.pg_get_function_identity_arguments(p.oid),
 'event_owner',pg_catalog.pg_get_userbyid(e.evtowner),
 'function_owner',pg_catalog.pg_get_userbyid(p.proowner),
 'config',p.proconfig,
 'acl_is_null',p.proacl is null,
 'acl',(
  select jsonb_agg(jsonb_build_object(
   'grantee',case when a.grantee=0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(a.grantee) end,
   'grantor',pg_catalog.pg_get_userbyid(a.grantor),
   'grantable',a.is_grantable,'privilege',a.privilege_type)
   order by a.grantee,a.grantor,a.privilege_type,a.is_grantable)
  from pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
 )
) as managed_acl_evidence
from pg_catalog.pg_event_trigger e
join pg_catalog.pg_proc p on p.oid=e.evtfoid
join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where e.evtname in('issue_pg_cron_access','issue_pg_net_access')
order by e.evtname;
rollback;
-- Expect exactly two rows. Do not replace the functions or change their ACLs.
