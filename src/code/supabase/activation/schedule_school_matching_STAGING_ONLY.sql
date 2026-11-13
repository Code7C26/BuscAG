-- MANUAL AUTHORIZATION REQUIRED. Only the reviewed BuscAG-Staging project.
-- Optional pg_cron alternative to the existing Edge scheduler, NOT a second engine.
-- Run only after authorizing/enabling pg_cron in staging Dashboard and checking
-- there is no other scheduler for process_match_jobs. No secrets or paid service.
-- Does NOT enable match_control or backfill jobs; use the existing activation plan.
begin;
set local lock_timeout='5s';
do $$ begin
 if not exists(select from pg_extension where extname='pg_cron') then
 raise exception 'Enable pg_cron in STAGING Dashboard first';end if;
 if to_regprocedure('public.school_features()') is null then raise exception 'School migration missing';end if;
end $$;
do $$
declare existing record;
begin
 for existing in select * from cron.job where jobname='buscag-school-matches' loop
 if existing.schedule is distinct from '* * * * *' or existing.command is distinct from 'select public.process_match_jobs(5);'
 or existing.username is distinct from current_user or existing.database is distinct from current_database() or not existing.active then
 raise exception 'Existing school scheduler differs; review without overwriting it';end if;
 end loop;
 if not exists(select from cron.job where jobname='buscag-school-matches') then
 perform cron.schedule('buscag-school-matches','* * * * *','select public.process_match_jobs(5);');end if;
end $$;
commit;
