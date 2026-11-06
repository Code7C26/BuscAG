import type { User as AuthUser } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { Item, Message, NotificationItem, User } from '../src/types';
import type { Database } from './supabase';
import { readAll } from './readAll';
import { createStorageObjectId } from './storageObjectId';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type ItemRow = Database['public']['Tables']['items']['Row'];
type MessageRow = Database['public']['Tables']['messages']['Row'];
type NotificationRow = Database['public']['Tables']['notifications']['Row'];

const client = () => {
  if (!supabase) throw new Error('Supabase no está configurado.');
  return supabase;
};

export const mapProfile = (profile: ProfileRow): User => ({
  id: profile.id,
  name: profile.full_name,
  avatar: profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.full_name)}`,
  email: '',
  phone: profile.phone,
  rating: profile.rating_count ? profile.rating : 0,
  ratingCount: profile.rating_count ?? 0,
  location: profile.location,
  totalPublished: 0,
  totalRecovered: 0,
  verified: false
});

export const mapItem = (row: ItemRow, owner: User): Item => ({
  id: row.id,
  title: row.title ?? '',
  description: row.description ?? '',
  category: row.category??'',
  status: row.status,
  locationName: row.location_name??'',
  lat: typeof row.lat==='number'?row.lat:NaN,
  lng: typeof row.lng==='number'?row.lng:NaN,
  date: row.date ?? '',
  imageUrl: row.image_url??'',
  user: owner,
  createdAt: row.created_at,
  reward: row.reward ?? undefined,
  contactCount: row.contact_count
});

export const mapMessage = (row: MessageRow): Message => ({
  id: row.id,
  itemId: row.item_id,
  itemTitle: row.item_title,
  itemImage: row.item_image,
  senderId: row.sender_id,
  senderName: row.sender_name,
  senderAvatar: row.sender_avatar,
  receiverId: row.recipient_id,
  text: row.text,
  timestamp: row.created_at,
  isRead: row.is_read
});

export const mapNotification = (row: NotificationRow): NotificationItem => ({
  id: row.id,
  title: row.title ?? '',
  message: row.message,
  date: row.created_at,
  type: row.type as NotificationItem['type'],
  read: row.is_read,
  relatedItemId: row.related_item_id ?? undefined,
  relatedUserId: row.related_user_id ?? undefined
});

export async function loadProfile(authUser: AuthUser, isCurrent: () => boolean = () => true): Promise<User> {
  if (!isCurrent()) throw new Error('La sesión cambió.');
  const supabaseClient = client();
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle();

  if (!isCurrent()) throw new Error('La sesión cambió.');
  if (error) throw error;
  if (data) {
    return {
      ...mapProfile(data),
      email: authUser.email ?? '',
      verified: Boolean(authUser.email_confirmed_at)
    };
  }

  const { data: created, error: insertError } = await supabaseClient
    .from('profiles')
    .upsert({
      id: authUser.id,
      full_name: String(authUser.user_metadata.full_name ?? ''),
      avatar_url: String(authUser.user_metadata.avatar_url ?? ''),
      phone: String(authUser.user_metadata.phone ?? ''),
      location: String(authUser.user_metadata.location ?? '')
    })
    .select('*')
    .single();

  if (insertError) throw insertError;
  return {
    ...mapProfile(created),
    email: authUser.email ?? '',
    verified: Boolean(authUser.email_confirmed_at)
  };
}

async function loadPublicProfiles(ownerIds: string[], isCurrent: () => boolean): Promise<ProfileRow[]> {
  const supabaseClient = client();
  const profiles: ProfileRow[] = [];
  let directoryMissing = false;
  for (let start = 0; start < ownerIds.length; start += 100) {
    const ids = ownerIds.slice(start, start + 100);
    if (!directoryMissing) {
      try {
        profiles.push(...await readAll<ProfileRow>((from, to) => supabaseClient.from('public_profiles')
          .select('*', from === 0 ? { count: 'exact' } : {}).in('id', ids).order('id').range(from, to), isCurrent));
        continue;
      } catch (error) {
        if (!['PGRST205','42P01'].includes((error as { code?: string }).code ?? '')) throw error;
        directoryMissing = true;
      }
    }
    // Deploy-before-migration fallback never requests private fields.
    const safe = await readAll((from, to) => supabaseClient.from('profiles')
      .select('id, full_name, avatar_url, rating, created_at', from === 0 ? { count: 'exact' } : {})
      .in('id', ids).order('id').range(from, to), isCurrent);
    profiles.push(...safe.map(profile => ({ ...profile, phone: '', location: '' })));
  }
  return profiles;
}

export async function loadItems(isCurrent: () => boolean = () => true): Promise<Item[]> {
  const loadedRows = await readAll<ItemRow>((from, to) => client().from('items')
    .select('*', from === 0 ? { count: 'exact' } : {}).order('created_at', { ascending: false }).order('id').range(from, to), isCurrent);
  // Offset pages can overlap if a publication arrives while reading the feed.
  // Keep each database ID once, without merging distinct owners/publications.
  const seen = new Set<string>();
  const rows = loadedRows.filter(row => {
    if (seen.has(row.id)) return false;
    seen.add(row.id); return true;
  });

  if (!rows.length) return [];

  const ownerIds = [...new Set(rows.flatMap(row => row.owner_id ? [row.owner_id] : []))];
  if (!ownerIds.length) {
    return rows.map(row => mapItem(row, {
      id: '',
      name: 'Cuenta anterior',
      avatar: '',
      email: '',
      phone: '',
      rating: 5,
      location: '',
      totalPublished: 0,
      totalRecovered: 0
    }));
  }

  const profiles = await loadPublicProfiles(ownerIds, isCurrent);

  const users = new Map(profiles.map(profile => [profile.id, mapProfile(profile)]));
  return rows.map(row => {
    const owner = row.owner_id ? users.get(row.owner_id) : undefined;
    return mapItem(row, owner ?? {
      id: row.owner_id ?? '',
      name: 'Cuenta anterior',
      avatar: '',
      email: '',
      phone: '',
      rating: 5,
      location: '',
      totalPublished: 0,
      totalRecovered: 0
    });
  });
}

export async function loadMessages(userId: string, isCurrent: () => boolean = () => true): Promise<Message[]> {
  const rows = await readAll<MessageRow>((from, to) => client().from('messages')
    .select('*', from === 0 ? { count: 'exact' } : {}).or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order('created_at').order('id').range(from, to), isCurrent);
  return [...new Map(rows.map(row=>[row.id,row])).values()].map(mapMessage);
}

export async function loadNotifications(userId: string, isCurrent: () => boolean = () => true): Promise<NotificationItem[]> {
  const rows = await readAll<NotificationRow>((from, to) => client().from('notifications')
    .select('*', from === 0 ? { count: 'exact' } : {}).eq('user_id', userId)
    .order('created_at', { ascending: false }).order('id').range(from, to), isCurrent);
  return [...new Map(rows.map(row=>[row.id,row])).values()].map(mapNotification);
}

export async function uploadItemImage(imageUrl: string, userId: string, isCurrent: () => boolean = () => true, objectId?: string): Promise<string> {
  if (!isCurrent()) throw new Error('La sesión cambió.');
  const supabaseClient = client();
  const supabaseOrigin = new URL(import.meta.env.VITE_SUPABASE_URL).origin;
  let imageUrlObject: URL;
  try {
    imageUrlObject = new URL(imageUrl);
  } catch {
    throw new Error('La dirección de la foto no es válida.');
  }

  const ownedStoragePrefix = `/storage/v1/object/public/item-images/${userId}/`;
  if (
    imageUrlObject.origin === supabaseOrigin &&
    imageUrlObject.pathname.startsWith(ownedStoragePrefix)
  ) {
    return imageUrl;
  }
  if (imageUrlObject.protocol !== 'https:' && imageUrlObject.protocol !== 'http:' && imageUrlObject.protocol !== 'data:') {
    throw new Error('La dirección de la foto no es válida.');
  }

  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error('No se pudo descargar la foto para guardarla.');
  const image = await response.blob();
  if (!isCurrent()) throw new Error('La sesión cambió.');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(image.type)) {
    throw new Error('La foto debe estar en formato JPG, PNG o WebP.');
  }
  if (image.size > 5 * 1024 * 1024) {
    throw new Error('La foto no puede superar los 5 MB.');
  }
  const extension = image.type === 'image/jpeg' ? 'jpg' : image.type.split('/')[1];
  const id=objectId??createStorageObjectId();
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new Error('Identificador de foto inválido.');
  const path = `${userId}/${id}.${extension}`;
  const { error } = await supabaseClient.storage.from('item-images').upload(path, image, {
    contentType: image.type,
    upsert: false
  });
  if (error) {
    if (!isCurrent()) throw new Error('La sesión cambió.');
    const duplicate=(error as {statusCode?:string;error?:string}).statusCode==='409'||(error as {error?:string}).error==='Duplicate';
    if(!objectId||!duplicate) throw error;
    // A previous upload might have committed before its response was lost. Never
    // overwrite it; verify identical bytes before accepting the stable path.
    const {data:existing,error:downloadError}=await supabaseClient.storage.from('item-images').download(path);
    if(!isCurrent()) throw new Error('La sesión cambió.');
    if(downloadError||!existing) throw downloadError??new Error('No se pudo verificar la foto guardada.');
    const [left,right]=await Promise.all([image.arrayBuffer(),existing.arrayBuffer()]);
    const a=new Uint8Array(left);const b=new Uint8Array(right);
    if(a.length!==b.length||a.some((byte,index)=>byte!==b[index])) throw new Error('La foto guardada no coincide con este intento.');
  }
  if (!isCurrent()) throw new Error('La sesión cambió.');
  return supabaseClient.storage.from('item-images').getPublicUrl(path).data.publicUrl;
}
