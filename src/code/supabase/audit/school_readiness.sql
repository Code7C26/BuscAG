-- READ ONLY. No user content, contact data, QR tokens or credentials.
select to_regprocedure('public.school_features()') is not null as installed,
       to_regprocedure('public.set_item_watch(uuid,boolean,double precision,double precision,double precision)') is not null as watch_rpc,
       to_regprocedure('public.resolve_item_recovery(uuid,boolean)') is not null as recovery_rpc,
       to_regprocedure('public.resolve_object_tag(uuid)') is not null as qr_rpc,
       to_regprocedure('public.community_statistics()') is not null as statistics_rpc;
select n.nspname,c.relname,c.relrowsecurity,
 has_table_privilege('anon',c.oid,'SELECT') as anon_read,
 has_table_privilege('authenticated',c.oid,'SELECT') as authenticated_read,
 has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE') as direct_write
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='buscag_private' and c.relname in ('item_watches','alert_preferences','object_tags','recovery_confirmations');
select p.proname,p.prosecdef,p.proconfig,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in
('school_features','set_item_watch','manage_object_tag','resolve_object_tag','request_item_recovery','resolve_item_recovery','community_statistics','process_match_jobs');
-- The following requires the feature migration. Run after installed=true above.
select enabled,worker_last_seen,worker_last_seen>now()-interval '5 minutes' as worker_seen_recently
from buscag_private.match_control where singleton;
select count(*) as queued_jobs,count(*) filter(where attempts>0) as retrying_jobs from buscag_private.match_jobs;
select conname,pg_get_constraintdef(oid) as definition from pg_constraint where conrelid=to_regclass('buscag_private.recovery_confirmations') and contype='f';
-- If pg_cron was authorized, additionally inspect its job status in Dashboard.

-- Account deletion uses this BEFORE trigger to avoid crossed FK cascade failures.
select t.tgname,t.tgenabled,p.prosecdef,p.proconfig,
 pg_get_userbyid(p.proowner) as owner,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
 has_function_privilege('service_role',p.oid,'EXECUTE') as service_execute
from pg_trigger t join pg_proc p on p.oid=t.tgfoid
where t.tgrelid=to_regclass('auth.users')
 and t.tgname='buscag_anonymize_recovery_participant' and not t.tgisinternal;
select attname,attnotnull from pg_attribute
where attrelid=to_regclass('buscag_private.recovery_confirmations')
 and attname in ('owner_id','partner_id') and not attisdropped;
