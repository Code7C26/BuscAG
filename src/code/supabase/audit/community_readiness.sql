-- READ ONLY: catalog/configuration only, no personal rows, endpoint keys or tokens.
select to_regprocedure('public.my_community_settings()') is not null as community_installed,
 to_regprocedure('public.declare_independent_recovery(uuid,text)') is not null as independent_recovery_installed,
 to_regprocedure('public.set_user_block(uuid,boolean)') is not null as blocks_installed,
 to_regprocedure('public.submit_report(text,uuid,text,text)') is not null as reports_installed,
 to_regprocedure('public.rate_recovery(uuid,integer)') is not null as ratings_installed;
select n.nspname,c.relname,c.relrowsecurity,pg_get_userbyid(c.relowner) as owner,
 has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') as anon_table_access,
 has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') as authenticated_table_access
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where (n.nspname='public' and c.relname in('items','profiles','messages','notifications','push_subscriptions'))
 or (n.nspname='buscag_private' and c.relkind='r');
select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies
where schemaname in('public','buscag_private') or (schemaname='storage' and tablename='objects');
select pg_get_viewdef(to_regclass('public.public_profiles'),true) as public_directory_projection;
select n.nspname,p.proname,p.prosecdef,p.proconfig,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
 md5(pg_get_functiondef(p.oid)) as definition_hash,pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where (n.nspname='public' and p.proname in('my_community_settings','save_my_profile','can_share_contact','can_send_item_message','send_message_once','set_user_block','list_my_blocks','submit_report','list_reports','moderate_report','report_audit','set_item_follow','my_item_follow','rate_recovery','received_ratings','recovery_context','declare_independent_recovery'))
 or (n.nspname='buscag_private' and p.proname in('blocked','enforce_message_access','validate_phone_update','record_recovery_decision','anonymize_recovery_participant','notify_item_followers'));
select table_name,column_name,grantee,privilege_type from information_schema.column_privileges
where table_schema='public' and table_name in('profiles','messages','items','notifications') and grantee in('anon','authenticated','PUBLIC');
select id,public,file_size_limit,allowed_mime_types from storage.buckets where id='item-images';
