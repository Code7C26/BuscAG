-- MANUAL Prueba operation, NOT an application migration or scheduler.
-- Reuse the existing queue/ledger. Never edit items to manufacture enqueue events.
-- Authorize separately, after the worker heartbeat and activation are verified.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
set local search_path=pg_catalog,pg_temp,public;
do $$ begin
 if current_user<>'postgres' or session_user<>'postgres' then
 raise exception 'Prueba postgres operator required';end if;
 if not pg_try_advisory_xact_lock(hashtextextended('buscag:match-worker',0)) then
 raise exception 'Worker busy; retry after this transaction ends';end if;
 if not exists(select from buscag_private.match_control where singleton and enabled
 and worker_last_seen>clock_timestamp()-interval '5 minutes') then
 raise exception 'Enabled worker and recent heartbeat required';end if;
end $$;
with candidates as (
 select i.id from public.items i
 where i.owner_id is not null and i.status in('perdido','encontrado')
 and i.title ~ '[^[:space:]]' and i.description ~ '[^[:space:]]'
 and i.category in('Electrónicos','Documentos y Billeteras','Mascotas','Llaves','Mochilas y Bolsos','Indumentaria','Otros')
 and i.date is not null and isfinite(i.date)
 and i.lat between -90 and 90 and i.lng between -180 and 180
 and not exists(select from buscag_private.match_jobs j where j.item_id=i.id)
 order by i.created_at,i.id limit 500
), added as (
 insert into buscag_private.match_jobs(item_id) select id from candidates
 on conflict(item_id) do nothing returning 1
)
select count(*)::integer as queued from added;
commit;
-- At most 500 per authorized call. No cursor resets, no item/user changes and no
-- promise to send an alert: preferences, watches, matching and ledger still apply.
