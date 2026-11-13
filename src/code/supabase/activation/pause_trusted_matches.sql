-- MANUAL pause candidate: preserves every job, ledger, receipt and notification.
-- Drain publication requests first; legacy own-match notices resume for updated clients.
-- The baseline's owner/type RLS still applies. No broad grants are restored.
begin;
update buscag_private.match_control set enabled=false,changed_at=clock_timestamp() where singleton;
commit;
