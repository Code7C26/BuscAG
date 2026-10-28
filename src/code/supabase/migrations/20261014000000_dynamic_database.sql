create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  avatar_url text not null default '',
  phone text not null default '',
  location text not null default '',
  rating numeric(2, 1) not null default 5.0,
  created_at timestamptz not null default now()
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles (id) on delete cascade,
  title text not null,
  description text not null,
  category text not null,
  status text not null default 'encontrado',
  location_name text not null,
  lat double precision not null,
  lng double precision not null,
  date timestamptz not null default now(),
  image_url text not null default '',
  reward text,
  contact_count integer not null default 0,
  created_at timestamptz not null default now(),
  constraint items_status_check check (status in ('perdido', 'encontrado', 'recuperado')),
  constraint items_category_check check (
    category in (
      'Electrónicos',
      'Documentos y Billeteras',
      'Mascotas',
      'Llaves',
      'Mochilas y Bolsos',
      'Indumentaria',
      'Otros'
    )
  )
);

alter table public.items add column if not exists owner_id uuid references public.profiles (id) on delete cascade;
alter table public.items add column if not exists contact_count integer not null default 0;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  sender_name text not null,
  sender_avatar text not null default '',
  item_title text not null,
  item_image text not null default '',
  text text not null check (char_length(text) between 1 and 4000),
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  constraint messages_distinct_participants check (sender_id <> recipient_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  message text not null,
  type text not null check (type in ('message', 'match', 'system', 'recovered')),
  related_item_id uuid references public.items (id) on delete set null,
  related_user_id uuid references public.profiles (id) on delete set null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists items_created_at_idx on public.items (created_at desc);
create index if not exists items_owner_id_idx on public.items (owner_id);
create index if not exists messages_item_id_created_at_idx on public.messages (item_id, created_at);
create index if not exists messages_participants_created_at_idx on public.messages (sender_id, recipient_id, created_at desc);
create index if not exists notifications_user_id_created_at_idx on public.notifications (user_id, created_at desc);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, phone, location)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    coalesce(new.raw_user_meta_data ->> 'location', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

create or replace function public.notify_message_recipient()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, title, message, type, related_item_id, related_user_id)
  values (
    new.recipient_id,
    'Nuevo mensaje de ' || new.sender_name,
    'Te escribió sobre "' || new.item_title || '".',
    'message',
    new.item_id,
    new.sender_id
  );
  update public.items set contact_count = contact_count + 1 where id = new.item_id;
  return new;
end;
$$;

drop trigger if exists on_message_created on public.messages;
create trigger on_message_created
  after insert on public.messages
  for each row execute procedure public.notify_message_recipient();

create or replace function public.notify_item_recovered()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'recuperado' and old.status is distinct from new.status then
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

drop trigger if exists on_item_recovered on public.items;
create trigger on_item_recovered
  after update of status on public.items
  for each row execute procedure public.notify_item_recovered();

alter table public.profiles enable row level security;
alter table public.items enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "Authenticated users can read profiles" on public.profiles;
create policy "Authenticated users can read profiles"
  on public.profiles for select to authenticated using (true);
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update to authenticated using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert to authenticated with check (id = (select auth.uid()));

drop policy if exists "Authenticated users can read items" on public.items;
create policy "Authenticated users can read items"
  on public.items for select to authenticated using (true);
drop policy if exists "Users can create their own items" on public.items;
create policy "Users can create their own items"
  on public.items for insert to authenticated with check (owner_id = (select auth.uid()));
drop policy if exists "Users can update their own items" on public.items;
create policy "Users can update their own items"
  on public.items for update to authenticated using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
drop policy if exists "Users can delete their own items" on public.items;
create policy "Users can delete their own items"
  on public.items for delete to authenticated using (owner_id = (select auth.uid()));

drop policy if exists "Participants can read their messages" on public.messages;
create policy "Participants can read their messages"
  on public.messages for select to authenticated
  using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()));
drop policy if exists "Users can send messages to item owners" on public.messages;
create policy "Users can send messages to item owners"
  on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and recipient_id <> (select auth.uid())
    and (
      exists (
        select 1 from public.items
        where items.id = item_id and items.owner_id = recipient_id
      )
      or exists (
        select 1 from public.messages existing
        where existing.item_id = item_id
          and (
            (existing.sender_id = (select auth.uid()) and existing.recipient_id = recipient_id)
            or (existing.sender_id = recipient_id and existing.recipient_id = (select auth.uid()))
          )
      )
    )
  );
drop policy if exists "Recipients can mark messages as read" on public.messages;
create policy "Recipients can mark messages as read"
  on public.messages for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

revoke update on table public.messages from anon, authenticated;
grant update (is_read) on table public.messages to authenticated;

drop policy if exists "Users can read their own notifications" on public.notifications;
create policy "Users can read their own notifications"
  on public.notifications for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Users can create their own notifications" on public.notifications;
create policy "Users can create their own notifications"
  on public.notifications for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "Users can update their own notifications" on public.notifications;
create policy "Users can update their own notifications"
  on public.notifications for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('item-images', 'item-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authenticated users can view item images" on storage.objects;
create policy "Authenticated users can view item images"
  on storage.objects for select to authenticated using (bucket_id = 'item-images');
drop policy if exists "Users can upload their own item images" on storage.objects;
create policy "Users can upload their own item images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'item-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Users can update their own item images" on storage.objects;
create policy "Users can update their own item images"
  on storage.objects for update to authenticated
  using (bucket_id = 'item-images' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'item-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Users can delete their own item images" on storage.objects;
create policy "Users can delete their own item images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'item-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'items'
  ) then
    alter publication supabase_realtime add table public.items;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end
$$;
