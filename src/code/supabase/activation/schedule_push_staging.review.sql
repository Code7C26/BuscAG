-- REVIEW ONLY. Separate authorization required. Uses existing official extensions only.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $$begin
 if current_user<>'postgres' or to_regprocedure('public.pending_push_notices()') is null then raise exception 'Install reviewed application SQL first';end if;
 if not exists(select from pg_extension where extname='pg_cron') or not exists(select from pg_extension where extname='pg_net')
 or to_regclass('vault.decrypted_secrets') is null or to_regclass('net.http_request_queue') is null then
 raise exception 'Existing pg_cron, pg_net and Vault required; use external scheduler if unavailable';end if;
 if has_table_privilege('anon','vault.decrypted_secrets','select') or has_table_privilege('authenticated','vault.decrypted_secrets','select')
 or has_table_privilege('anon','net.http_request_queue','select') or has_table_privilege('authenticated','net.http_request_queue','select') then
 raise exception 'Secret storage or HTTP queue exposed; do not configure scheduler';end if;
 if (select count(*) from vault.decrypted_secrets where name='buscag_staging_push_webhook_secret')<>1 then
 raise exception 'Create exactly one named staging webhook secret in Vault UI first';end if;
 if exists(select from cron.job where jobname='buscag-staging-push-minute' and (username<>'postgres' or database<>current_database())) then
 raise exception 'Scheduler job ownership conflict';end if;
end$$;
create or replace function buscag_private.dispatch_staging_push() returns bigint
language plpgsql security definer set search_path='' as $$declare secret text;request_id bigint;begin
 select decrypted_secret into strict secret from vault.decrypted_secrets where name='buscag_staging_push_webhook_secret';
 if char_length(secret) not between 32 and 512 or secret~E'[\\r\\n]' then raise exception 'Invalid staging webhook secret';end if;
 select net.http_post(url:='https://yiarlhpbgkofhhipkfha.supabase.co/functions/v1/send-push',
 headers:=jsonb_build_object('Content-Type','application/json','x-push-webhook-secret',secret),
 body:='{"type":"DRAIN"}'::jsonb,timeout_milliseconds:=55000) into request_id;
 return request_id;
end$$;
revoke all on function buscag_private.dispatch_staging_push() from public,anon,authenticated,service_role;
select cron.schedule('buscag-staging-push-minute','* * * * *','select buscag_private.dispatch_staging_push()');
commit;
