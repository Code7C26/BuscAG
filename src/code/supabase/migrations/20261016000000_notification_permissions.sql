revoke update on table public.notifications from anon, authenticated;
grant update (is_read) on table public.notifications to authenticated;

create or replace function public.notify_item_recovered()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'recuperado'
    and old.status is distinct from new.status
    and new.owner_id is not null then
    insert into public.notifications (user_id, title, message, type, related_item_id)
    values (
      new.owner_id,
      '¡Objeto Recuperado! 🎉',
      'Tu publicación "' || new.title || '" fue marcada como recuperada.',
      'recovered',
      new.id
    );
  end if;
  return new;
end;
$$;
