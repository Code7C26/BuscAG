-- READ ONLY. Trusted SQL Editor, before backup and again on its isolated restore.
-- One statement/snapshot; counts only, no personal fields or file names.
select jsonb_pretty(jsonb_build_object(
  'captured_at',statement_timestamp(),
  'profiles',(select count(*) from public.profiles),
  'items',(select count(*) from public.items),
  'messages',(select count(*) from public.messages),
  'notifications',(select count(*) from public.notifications),
  'auth_users',(select count(*) from auth.users),
  'auth_identities',(select count(*) from auth.identities),
  'storage_buckets',(select count(*) from storage.buckets),
  'storage_objects',(select count(*) from storage.objects)
)) as backup_counts;
