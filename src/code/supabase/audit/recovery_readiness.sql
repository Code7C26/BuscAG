-- READ ONLY. Catalog inspection only; no application rows, user identities or writes.
-- Run manually against Supabase Prueba to compare deployed state with this commit.
-- *_installed below means presence ONLY. Use upgrade_catalog.sql and the reviewed
-- --upgrade-plan/--upgrade-verify flow to compare definitions, security and structure.
select to_regprocedure('public.recovery_context(uuid)') is not null as secure_context_installed,
 to_regprocedure('public.request_item_recovery(uuid,uuid)') is not null as request_installed,
 to_regprocedure('public.resolve_item_recovery(uuid,boolean)') is not null as resolution_installed,
 exists(select from pg_attribute where attrelid=to_regclass('buscag_private.recovery_confirmations')
 and attname='mode' and not attisdropped and attnotnull) as evidence_mode_installed;
select n.nspname,p.proname,p.prosecdef,p.proconfig,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
 md5(pg_get_functiondef(p.oid)) as definition_hash,pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where (n.nspname='public' and p.proname in ('recovery_context','request_item_recovery','resolve_item_recovery','list_recovery_confirmations','publish_item_once','notify_item_recovered'))
 or (n.nspname='buscag_private' and p.proname in ('require_recovery_evidence','protect_confirmed_recovery','recovery_partners'));
select tgname,tgenabled,pg_get_triggerdef(oid) as definition from pg_trigger
where tgrelid=to_regclass('public.items') and not tgisinternal;
select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies
where (schemaname='public' and tablename in ('items','messages','notifications'))
 or (schemaname='buscag_private' and tablename='recovery_confirmations');
select n.nspname,c.relname,c.relrowsecurity,
 has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE') as authenticated_direct_write,
 has_table_privilege('anon',c.oid,'INSERT,UPDATE,DELETE') as anon_direct_write
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='buscag_private' and c.relname='recovery_confirmations';
