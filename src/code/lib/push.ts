import { supabase } from './supabase';

let sessionRevocation:Promise<void>=Promise.resolve();

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
  if (!isPushAvailable() || Notification.permission !== 'granted') return false;

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
    throw new Error(/iPad|iPhone|iPod/.test(navigator.userAgent)?'En iPhone, instalá BuscAG en la pantalla de inicio y abrila desde su icono (iOS 16.4 o posterior).':'Este navegador no admite push. Podés consultar los avisos dentro de BuscAG.');
  }

  const applicationServerKey = import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim();
  if (!applicationServerKey) {
    throw new Error('Las notificaciones push de este sitio aún no están habilitadas. Podés seguir consultando los avisos dentro de BuscAG.');
  }

  let decodedKey:Uint8Array;
  try{decodedKey=decodeApplicationServerKey(applicationServerKey);if(decodedKey.length!==65||decodedKey[0]!==4)throw Error();}catch{throw Error('La configuración push del sitio no es válida. Podés seguir consultando los avisos en la aplicación.');}
  const permission = await Notification.requestPermission();
  if (!isCurrent()) throw new Error('La sesión cambió.');
  if (permission !== 'granted') {
    throw new Error(permission === 'denied'
      ? 'El navegador bloqueó las notificaciones. Habilítalas desde los permisos del sitio.'
      : 'Debes permitir las notificaciones para recibir avisos.');
  }

  await sessionRevocation;
  if (!isCurrent()) throw new Error('La sesión cambió.');
  let registration:ServiceWorkerRegistration;
  try{registration=await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'});}catch{throw Error('No se pudo preparar este dispositivo para recibir avisos. Revisá la conexión segura e intentá nuevamente.');}
  if (!isCurrent()) throw new Error('La sesión cambió.');
  let timer:ReturnType<typeof setTimeout>;
  try{await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('El dispositivo tardó demasiado en preparar los avisos. Intentá nuevamente.')),15000);})]);}finally{clearTimeout(timer!);}
  if (!isCurrent()) throw new Error('La sesión cambió.');
  await reconcilePushSession(userId,isCurrent);
  let existing = await registration.pushManager.getSubscription();
  if (!isCurrent()) throw new Error('La sesión cambió.');
  const existingKey=existing?.options?.applicationServerKey;
  if(existing&&existingKey&&Array.from(new Uint8Array(existingKey)).join(',')!==Array.from(decodedKey).join(',')){
    const {error}=await requireClient().from('push_subscriptions').delete().eq('user_id',userId).eq('endpoint',existing.endpoint);if(error)throw error;
    if(!isCurrent())throw new Error('La sesión cambió.');
    if(!(await existing.unsubscribe()))throw new Error('No se pudo renovar la suscripción de este dispositivo.');existing=null;
  }
  if (!isCurrent()) throw new Error('La sesión cambió.');
  const subscription = existing ?? await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodedKey as Uint8Array<ArrayBuffer>
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
  if(!isCurrent()){
    await subscription.unsubscribe();
    throw new Error('La sesión cambió.');
  }
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
  if(!(await subscription.unsubscribe()))throw new Error('No se pudo desactivar la suscripción del dispositivo.');
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

/** A session transition never carries another account's endpoint into the new session. */
export function revokePushOnSessionChange(isCurrent:()=>boolean=()=>true):Promise<void>{
  const revocation=sessionRevocation.then(()=>disconnectPushDevice(isCurrent));
  sessionRevocation=revocation.catch(()=>{});
  return revocation;
}
export async function reconcilePushSession(userId:string,isCurrent:()=>boolean=()=>true):Promise<void>{
  await sessionRevocation;
  if(!isCurrent()||!isPushAvailable())return;
  const registration=await navigator.serviceWorker.getRegistration('/');
  const subscription=await registration?.pushManager.getSubscription();
  if(!subscription||!isCurrent())return;
  const {data,error}=await requireClient().from('push_subscriptions').select('endpoint').eq('user_id',userId).eq('endpoint',subscription.endpoint);
  if(!isCurrent())return;
  if(error){
    // Unknown ownership must not carry a previous account's delivery capability.
    if(!(await subscription.unsubscribe()))throw Error('No se pudo desvincular el dispositivo. Revisá sus permisos de notificaciones.');
    const notices=await registration?.getNotifications?.();
    if(isCurrent())notices?.forEach(notice=>notice.close());
    throw Error('No se pudo verificar la cuenta de este dispositivo. Reactivá los avisos cuando vuelva la conexión.');
  }
  if(!data?.some(row=>row.endpoint===subscription.endpoint)){
    if(!(await subscription.unsubscribe()))throw Error('No se pudo desvincular el dispositivo de la cuenta anterior.');
    const notices=await registration?.getNotifications?.();
    if(isCurrent())notices?.forEach(notice=>notice.close());
  }
}
