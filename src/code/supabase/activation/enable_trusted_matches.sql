-- MANUAL ACTIVATION CANDIDATE. Not a migration and never automatic.
-- First: verified backup/restore, compatible clients, scheduler HTTP smoke test,
-- and a controlled window with publication requests drained. See BACKEND_ACTIVATION.md.
begin;
do $$ declare seen timestamptz;begin
  select worker_last_seen into seen from buscag_private.match_control where singleton for update;
  if seen is null or seen<clock_timestamp()-interval '5 minutes' then
    raise exception 'Worker heartbeat missing or stale; test the authenticated scheduled HTTP call first';
  end if;
  update buscag_private.match_control set enabled=true,changed_at=clock_timestamp() where singleton;
end;$$;
commit;
