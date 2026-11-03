-- READ ONLY, for SQL Editor with a trusted operator AFTER installing the candidates.
-- Intentionally no IDs, message contents, endpoints, credentials or application rows.
select jsonb_pretty(jsonb_build_object(
  'enabled',(select enabled from buscag_private.match_control where singleton),
  'worker_last_seen',(select worker_last_seen from buscag_private.match_control where singleton),
  'worker_recent',(select coalesce(worker_last_seen>clock_timestamp()-interval '5 minutes',false) from buscag_private.match_control where singleton),
  'queue',(select jsonb_build_object('pending',count(*),'deferred',count(*) filter(where next_attempt_at>clock_timestamp()),
    'max_attempts',coalesce(max(attempts),0),'oldest_queued_at',min(queued_at)) from buscag_private.match_jobs),
  'failure_codes',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (
    select last_error_code,count(*) from buscag_private.match_jobs where last_error_code is not null group by last_error_code
  ) x)
)) as readiness;
