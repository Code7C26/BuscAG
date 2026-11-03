import { supabase } from './supabase';

const requireClient = () => {
  if (!supabase) throw new Error('Supabase no está configurado.');
  return supabase;
};

const isPushAvailable = () =>
  'Notification' in window &&
  'serviceWorker' in navigator &&
  'PushManager' in window;

const decodeApplicationServerKey = (key: string) => {
  const normalized = key.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), character => character.charCodeAt(0));
};

export async function getPushNotificationStatus(userId: string): Promise<boolean> {
  if (!isPushAvailable()) return false;

  const { data, error } = await requireClient()
    .from('push_subscriptions')
    .select('endpoint')
    .eq('user_id', userId);

  // A missing optional push table must not interrupt the account's normal use.
  if (error?.code === 'PGRST205' || error?.code === '42P01') return false;
  if (error) throw error;
  if (!data.length) return false;

  const registration = await navigator.serviceWorker.getRegistration('/');
  if (!registration) return false;

  const subscription = await registration.pushManager.getSubscription();
  return subscription !== null && data.some(row => row.endpoint === subscription.endpoint);
}

export async function enablePushNotifications(userId: string, isCurrent: () => boolean = () => true): Promise<void> {
  if (!isCurrent()) throw new Error('La sesión cambió.');
  if (!isPushAvailable()) {
    throw new Error('Este navegador no admite notificaciones push. Prueba con un navegador compatible y una conexión segura (HTTPS).');
  }

  const applicationServerKey = import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim();
  if (!applicationServerKey) {
    throw new Error('Falta configurar VITE_VAPID_PUBLIC_KEY para habilitar las notificaciones.');
  }

  const permission = await Notification.requestPermission();
  if (!isCurrent()) throw new Error('La sesión cambió.');
  if (permission !== 'granted') {
    throw new Error(permission === 'denied'
      ? 'El navegador bloqueó las notificaciones. Habilítalas desde los permisos del sitio.'
      : 'Debes permitir las notificaciones para recibir avisos.');
  }

  const registration = await navigator.serviceWorker.register('/sw.js');
  if (!isCurrent()) throw new Error('La sesión cambió.');
  await navigator.serviceWorker.ready;
  if (!isCurrent()) throw new Error('La sesión cambió.');
  const existing = await registration.pushManager.getSubscription();
  if (!isCurrent()) throw new Error('La sesión cambió.');
  const subscription = existing ?? await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeApplicationServerKey(applicationServerKey)
    });
  const keys = subscription.toJSON().keys;

  if (!keys?.p256dh || !keys.auth) {
    throw new Error('El navegador creó una suscripción push incompleta.');
  }

  if (!isCurrent()) throw new Error('La sesión cambió.');
  const { error } = await requireClient()
    .from('push_subscriptions')
    .upsert({
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth
    }, { onConflict: 'endpoint' });

  if (error) throw error;
}

export async function disablePushNotifications(userId: string, isCurrent: () => boolean = () => true): Promise<void> {
  if (!isCurrent()) throw new Error('La sesión cambió.');
  if (!isPushAvailable()) return;

  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;

  if (!isCurrent()) throw new Error('La sesión cambió.');
  const { error } = await requireClient()
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('endpoint', subscription.endpoint);

  if (error) throw error;
  if (!isCurrent()) return;
  await subscription.unsubscribe();
}

/** Revoke this browser's delivery capability on logout without deleting stored rows. */
export async function disconnectPushDevice(isCurrent: () => boolean = () => true): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration('/');
  if (!registration || !isCurrent()) return;
  const subscription = await registration.pushManager?.getSubscription();
  if (!isCurrent()) return;
  if (subscription && !(await subscription.unsubscribe())) throw new Error('No se pudo desactivar el dispositivo.');
  if (!isCurrent()) return;
  const notices = await registration.getNotifications?.();
  if (isCurrent()) notices?.forEach(notice => notice.close());
}
