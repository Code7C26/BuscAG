-- READ ONLY, trusted SQL Editor. No object names, owners or personal data.
select jsonb_pretty(jsonb_build_object(
  'objects_rls',(select relrowsecurity from pg_catalog.pg_class where oid='storage.objects'::regclass),
  'bucket',(select jsonb_build_object('id',id,'public',public,'file_size_limit',file_size_limit,'allowed_mime_types',allowed_mime_types)
    from storage.buckets where id='item-images')
)) as storage_configuration;
