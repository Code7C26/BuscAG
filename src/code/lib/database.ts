import type { User as AuthUser } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { Item, Message, NotificationItem, User } from '../src/types';
import type { Database } from './supabase';
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
  rating: profile.rating,
  location: profile.location,
  totalPublished: 0,
  totalRecovered: 0,
  verified: false
});

export const mapItem = (row: ItemRow, owner: User): Item => ({
  id: row.id,
  title: row.title,
  description: row.description,
  category: row.category as Item['category'],
  status: row.status as Item['status'],
  locationName: row.location_name,
  lat: row.lat,
  lng: row.lng,
  date: row.date,
  imageUrl: row.image_url,
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
  title: row.title,
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

async function loadPublicProfiles(ownerIds: string[]): Promise<ProfileRow[]> {
  const supabaseClient = client();
  const { data, error } = await supabaseClient
    .from('public_profiles')
    .select('*')
    .in('id', ownerIds);
  if (!error) return data;
  if (error.code !== 'PGRST205' && error.code !== '42P01') throw error;

  // Permit deploying this client before the directory migration. Never fall
  // back to downloading private fields, even on the older permissive schema.
  const { data: profiles, error: fallbackError } = await supabaseClient
    .from('profiles')
    .select('id, full_name, avatar_url, rating, created_at')
    .in('id', ownerIds);
  if (fallbackError) throw fallbackError;
  return profiles.map(profile => ({ ...profile, phone: '', location: '' }));
}

export async function loadItems(): Promise<Item[]> {
  const supabaseClient = client();
  const { data: rows, error: itemsError } = await supabaseClient
    .from('items')
    .select('*')
    .order('created_at', { ascending: false });
  if (itemsError) throw itemsError;

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

  const profiles = await loadPublicProfiles(ownerIds);

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

export async function loadMessages(userId: string): Promise<Message[]> {
  const { data, error } = await client()
    .from('messages')
    .select('*')
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order('created_at');
  if (error) throw error;
  return data.map(mapMessage);
}

export async function loadNotifications(userId: string): Promise<NotificationItem[]> {
  const { data, error } = await client()
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(mapNotification);
}

export async function uploadItemImage(imageUrl: string, userId: string, isCurrent: () => boolean = () => true): Promise<string> {
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
  const path = `${userId}/${createStorageObjectId()}.${extension}`;
  const { error } = await supabaseClient.storage.from('item-images').upload(path, image, {
    contentType: image.type,
    upsert: false
  });
  if (error) throw error;
  if (!isCurrent()) throw new Error('La sesión cambió.');
  return supabaseClient.storage.from('item-images').getPublicUrl(path).data.publicUrl;
}
