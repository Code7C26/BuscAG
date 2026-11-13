-- Read only, aggregate/configuration checks. No endpoints, user IDs or payloads.
select current_database() as database_name,
 to_regclass('buscag_private.push_deliveries') is not null as durable_queue,
 to_regclass('buscag_private.user_followers') is not null as user_follows,
 to_regprocedure('public.pending_push_notices()') is not null as drain_rpc,
 (select count(*) from pg_trigger where not tgisinternal and tgname in('enqueue_push_notice','notify_user_followers','notify_report_state','limit_push_devices')) as application_triggers;
select n.nspname as schema_name,p.proname as function_name,p.prosecdef as security_definer,p.proconfig as configuration,
 has_function_privilege('anon',p.oid,'execute') as anon_execute,
 has_function_privilege('authenticated',p.oid,'execute') as authenticated_execute,
 has_function_privilege('service_role',p.oid,'execute') as service_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in('pending_push_notices','pending_push_subscriptions','push_notice_context','claim_push_delivery','finish_push_delivery','my_user_follow','set_user_follow')
order by p.proname;
select state,count(*) as delivery_count from buscag_private.push_deliveries group by state order by state;
