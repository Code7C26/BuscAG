import {isItemCategory,isItemStatus,publicationTextError} from './utils/itemContract';
import { createPublicationPublisher } from '../lib/publicationDelivery';
import { reportError } from '../lib/reportError';
/**
 * COMPONENTE PRINCIPAL (App.tsx)
 * Es el núcleo de la aplicación. Administra el estado global (publicaciones, usuario activo,
 * filtros, geolocalización y mensajes), maneja la navegación por pestañas y renderiza las
 * vistas principales y modales.
 */
import React, { useState, useMemo, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
// Iconos de Lucide para la interfaz visual
import { supabase, type Database } from '../lib/supabase';
import type { User as AuthUser } from '@supabase/supabase-js';
import { Search, MapPin, SlidersHorizontal, Plus, AlertCircle, CheckCircle2, Sparkles, Navigation, X, ShieldAlert } from 'lucide-react';
// Tipos TypeScript para tipado estricto
import { Item, FilterType, Category, User, NotificationItem, Message, MatchResult, TabType } from './types';
import { AuthView } from './components/AuthView';
import { loadItems, loadMessages, loadNotifications, loadProfile, mapItem, mapMessage, mapNotification, uploadItemImage } from '../lib/database';
import { disablePushNotifications, enablePushNotifications, getPushNotificationStatus, disconnectPushDevice } from '../lib/push';
// Utilidades de cálculo geográfico (Haversine)
import { getDistanceKm, isValidCoordinates, NEARBY_RADIUS_KM } from './utils/geo';
import { serializeItemDate, itemDateInput } from './utils/itemDate';
import { persistReadReceipts } from '../lib/readReceipts';
import { needsLegacyMatchNotice } from '../lib/matchDelivery';
import { createMessageIntents, deliverMessage } from '../lib/messageDelivery';
import { createReconnectSync } from './utils/reconnectSync';
import { createRefreshQueue } from './utils/refreshQueue';
import { authCallbackError, cleanAuthCallback } from '../lib/authFlow';
import { createSessionGuard, type SessionGuard } from './utils/sessionGuard';
// Motor de coincidencia automática (Lost & Found Matcher)
import { findAllMatches, findMatchesForSingleItem } from './utils/matcher';
// Componentes modulares de la aplicación
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { ItemCard } from './components/ItemCard';
const MapView = lazy(() => import('./components/MapView').then(module => ({ default: module.MapView })));
const PublishModal = lazy(() => import('./components/PublishModal').then(module => ({ default: module.PublishModal })));
const ItemDetailModal = lazy(() => import('./components/ItemDetailModal').then(module => ({ default: module.ItemDetailModal })));
import { ContactModal } from './components/ContactModal';
import { ProfileView } from './components/ProfileView';
import { NotificationsView } from './components/NotificationsView';
import { MatchesView } from './components/MatchesView';
const MatchComparisonModal = lazy(() => import('./components/MatchComparisonModal').then(module => ({ default: module.MatchComparisonModal })));
import { FaqChat } from './components/FaqChat';

export default function App() {
  const [identity, setIdentity] = useState<{ user: AuthUser; guard: SessionGuard; key: number } | null>(null);
  const identityRef = useRef<typeof identity>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const sequence = useRef(0);
  const [recovery, setRecovery] = useState(false);
  const [authNotice, setAuthNotice] = useState(() => authCallbackError(window.location.href));

  useEffect(() => {
    if (!supabase) { setIsLoadingSession(false); return; }
    let active = true;
    let receivedAuthEvent = false;
    const acceptUser = (user: AuthUser | null) => {
      if (!active) return;
      const previous = identityRef.current;
      if (previous && user && previous.user.id === user.id) {
        const refreshed = { ...previous, user };
        identityRef.current = refreshed;
        setIdentity(refreshed);
        return;
      }
      if (!previous && !user) return;
      previous?.guard.close(); // Before React renders the next account.
      const next = user ? { user, guard: createSessionGuard(), key: ++sequence.current } : null;
      identityRef.current = next;
      setIdentity(next);
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (active && session?.user && event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (active && event === 'SIGNED_OUT') setRecovery(false);
      receivedAuthEvent = true;
      if (active) {
        const cleaned = cleanAuthCallback(window.location.href);
        if (cleaned !== window.location.href) window.history.replaceState(null, '', cleaned);
      }
      acceptUser(session?.user ?? null);
      if (active) setIsLoadingSession(false);
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      // An older startup read must never replace a newer sign-in/sign-out event.
      if (!active || receivedAuthEvent) return;
      if (error) setAuthNotice('No se pudo verificar la sesión. Inténtalo nuevamente.');
      acceptUser(data.session?.user ?? null);
      setIsLoadingSession(false);
    }).catch(error => {
      if (!active || receivedAuthEvent) return;
      setAuthNotice('No se pudo verificar la sesión. Inténtalo nuevamente.');
      setIsLoadingSession(false);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  if (isLoadingSession) {
    return <div className="min-h-screen flex items-center justify-center text-sm font-semibold text-slate-500">Verificando sesión...</div>;
  }
  if (!supabase) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <section className="max-w-lg rounded-2xl bg-white p-6 shadow border border-slate-200">
          <h1 className="font-bold text-lg text-slate-900">Falta configurar Supabase</h1>
          <p className="text-sm text-slate-600 mt-2">
            Define <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> en <code>.env.local</code>, reinicia el servidor y vuelve a cargar la app.
          </p>
        </section>
      </main>
    );
  }
  if (!identity) return <AuthView notice={authNotice} />;
  if (recovery) return <AuthView recovery notice={authNotice} onRecovered={() => {
    setRecovery(false); setAuthNotice('');
    const url = new URL(window.location.href); url.searchParams.delete('auth');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  }} />;
  // Unmounting also discards child drafts, selections, filters, GPS and timers.
  return <AccountApp key={identity.key} authUser={identity.user} sessionGuard={identity.guard} onChangePassword={() => setRecovery(true)} onLogoutWarning={() => setAuthNotice('La sesión se cerró, pero no se pudo desactivar push en este navegador. Revisa sus permisos de notificaciones.')} />;
}

function AccountApp({ authUser, sessionGuard, onChangePassword, onLogoutWarning }: { authUser: AuthUser; sessionGuard: SessionGuard; onChangePassword: () => void; onLogoutWarning: () => void }) {
  const lifetime = useRef(createSessionGuard());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pushRevision = useRef(0);
  const messageIntents = useRef(createMessageIntents());
  const publications = useRef(createPublicationPublisher<Database['public']['Tables']['items']['Row']>());
  const recoveryRequests = useRef(new Map<string,Promise<boolean>>());
  const messageRequests = useRef(new Map<string, Promise<void>>());
  const captureOperation = useCallback(() => {
    const sessionCurrent = sessionGuard.capture();
    const mounted = lifetime.current.capture();
    return () => sessionCurrent() && mounted();
  }, [sessionGuard]);
  useEffect(() => () => {
    lifetime.current.invalidate();
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);
  // ESTADOS PRINCIPALES DE LA APLICACIÓN
  // ==========================================
  // ESTADOS PRINCIPALES DE LA APLICACIÓN
  // ==========================================

  // items: Lista de todas las publicaciones (perdidos, encontrados, recuperados)
  const [items, setItems] = useState<Item[]>([]);

  // currentUser: Usuario que actualmente tiene la sesión iniciada
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // notifications: Historial de avisos y alertas del sistema
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // messages: Historial de mensajes del chat de contacto interno
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataLoadError, setDataLoadError] = useState<string | null>(null);

  // ==========================================
  // NAVEGACIÓN Y VISTAS
  // ==========================================
  // activeTab: Pestaña actualmente visible ('home', 'map', 'matches', 'notifications', 'profile')
  const [activeTab, setActiveTab] = useState<TabType>('home');

  // selectedMatchComparison: Coincidencia seleccionada para examinar en el comparador lado a lado
  const [selectedMatchComparison, setSelectedMatchComparison] = useState<MatchResult | null>(null);

  // ==========================================
  // FILTROS Y BÚSQUEDA
  // ==========================================
  // searchQuery: Texto escrito por el usuario en el buscador
  const [searchQuery, setSearchQuery] = useState('');

  // activeFilter: Filtro rápido por estado ('todos', 'encontrados', 'perdidos', 'cerca')
  const [activeFilter, setActiveFilter] = useState<FilterType>('todos');

  // selectedCategory: Filtro de categoría seleccionada ('Todos', 'Electrónicos', etc.)
  const [selectedCategory, setSelectedCategory] = useState<Category | 'Todos'>('Todos');

  // userLocation: Coordenadas GPS del usuario actual para calcular distancias
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);

  // ==========================================
  // ESTADO DE MODALES Y MENSAJES FLOTANTES
  // ==========================================
  // isPublishOpen: Controla si el modal de publicar está abierto
  const [isPublishOpen, setIsPublishOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  // selectedDetailItem: Objeto seleccionado para ver ficha detallada (null si está cerrado)
  const [selectedDetailItem, setSelectedDetailItem] = useState<Item | null>(null);

  // contactingItem: Objeto con el que se abrió la ventana de chat directo
  const [contactingItem, setContactingItem] = useState<Item | null>(null);
  const [contactingParticipantId, setContactingParticipantId] = useState<string | null>(null);

  // toastMessage: Texto breve de alerta temporal tipo 'toast'
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || !authUser) {
      setCurrentUser(null);
      setItems([]);
      setMessages([]);
      setNotifications([]);
      setPushEnabled(false);
      setIsLoadingData(false);
      return;
    }

    const current = captureOperation();
    let active = true;
    const refresh = createRefreshQueue<'items' | 'messages' | 'notifications'>(async keys => {
      if (!active || !current()) return;
      const [loadedItems, loadedMessages, loadedNotifications] = await Promise.all([
        keys.has('items') ? loadItems(current) : undefined,
        keys.has('messages') ? loadMessages(authUser.id, current) : undefined,
        keys.has('notifications') ? loadNotifications(authUser.id, current) : undefined
      ]);
      if (!active || !current()) return;
      if (loadedItems) setItems(loadedItems);
      if (loadedMessages) setMessages(loadedMessages);
      if (loadedNotifications) setNotifications(loadedNotifications);
    });

    const syncError = 'No se pudieron resincronizar los datos. Se reintentará al recuperar la conexión.';
    const connectionError = 'Se perdió la conexión en tiempo real. Se intentará resincronizar al reconectar.';
    const reconcile = createReconnectSync(async () => {
      await refresh.request('items','messages','notifications');
      if (active && current()) setDataLoadError(previous =>
        previous === syncError || previous === connectionError ? null : previous);
    },()=>active && current());
    const catchUp = (force=false) => {
      if (!active || !current() || navigator.onLine === false || document.visibilityState === 'hidden') return;
      void reconcile(force).catch(error=>{
        reportError('No se pudieron resincronizar los datos:',error);
        if (active && current()) setDataLoadError(syncError);
      });
    };
    const onResume = () => catchUp();
    window.addEventListener('online',onResume);
    window.addEventListener('focus',onResume);
    document.addEventListener('visibilitychange',onResume);

    const channel = supabase
      .channel(`app-data-${authUser.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, () => {
        void refresh.request('items').catch(error => {
          reportError('No se pudieron actualizar las publicaciones:', error);
          if (active && current()) setDataLoadError('No se pudieron actualizar las publicaciones.');
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        void refresh.request('messages', 'items').catch(error => {
          reportError('No se pudieron actualizar los mensajes:', error);
          if (active && current()) setDataLoadError('No se pudieron actualizar los mensajes.');
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        void refresh.request('notifications').catch(error => {
          reportError('No se pudieron actualizar las notificaciones:', error);
          if (active && current()) setDataLoadError('No se pudieron actualizar las notificaciones.');
        });
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') catchUp(true);
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('No se pudo establecer la conexión en tiempo real:', status);
          if (active && current()) setDataLoadError(connectionError);
        }
      });

    setIsLoadingData(true);
    setDataLoadError(null);
    Promise.all([loadProfile(authUser, current), refresh.request('items', 'messages', 'notifications')])
      .then(([profile]) => {
        if (active && current()) setCurrentUser(profile);
      })
      .catch(error => {
        reportError('No se pudieron cargar los datos de la cuenta:', error);
        if (active && current()) setDataLoadError('No se pudieron cargar los datos. Verifica que hayas aplicado la migración de Supabase.');
      })
      .finally(() => {
        if (active && current()) setIsLoadingData(false);
      });

    return () => {
      active = false;
      window.removeEventListener('online',onResume);
      window.removeEventListener('focus',onResume);
      document.removeEventListener('visibilitychange',onResume);
      void supabase.removeChannel(channel);
    };
  }, [authUser.id, captureOperation]);

  useEffect(() => {
    setCurrentUser(previous => {
      if (!previous || previous.id !== authUser.id) return previous;
      const email = authUser.email ?? '', verified = Boolean(authUser.email_confirmed_at);
      return previous.email === email && previous.verified === verified ? previous : { ...previous,email,verified };
    });
  }, [authUser.id,authUser.email,authUser.email_confirmed_at,currentUser?.id]);

  // Cuenta la cantidad de notificaciones que el usuario todavía no ha leído
  const unreadNotificationsCount = notifications.filter(n => !n.read).length;

  /**
   * Muestra un mensaje flotante 'toast' en pantalla durante 3.5 segundos
   */
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => { setToastMessage(null); }, 3500);
  };

  useEffect(() => {
    if (!authUser) return;
    const current = captureOperation();
    let active = true;
    const revision = pushRevision.current;
    void getPushNotificationStatus(authUser.id)
      .then(enabled => {
        if (active && current() && revision === pushRevision.current) setPushEnabled(enabled);
      })
      .catch(error => {
        reportError('No se pudo verificar la suscripción a notificaciones:', error);
      });
    return () => {
      active = false;
    };
  }, [authUser.id, captureOperation]);

  // Lista de categorías para generar los botones de filtro rápido
  const categoriesList: (Category | 'Todos')[] = [
    'Todos',
    'Electrónicos',
    'Documentos y Billeteras',
    'Mascotas',
    'Llaves',
    'Mochilas y Bolsos',
    'Indumentaria',
    'Otros'
  ];

  /**
   * useMemo: Calcula la distancia exacta en km de cada publicación
   * respecto a la posición actual del usuario para evitar recálculos innecesarios.
   */
  const itemsWithDistance = useMemo(() => {
    return items.map(item => {
      if (userLocation) {
        // Ejecuta la fórmula de Haversine entre usuario e ítem
        const distance = getDistanceKm(userLocation.lat, userLocation.lng, item.lat, item.lng);
        if (Number.isFinite(distance)) return { ...item, distanceKm: distance };
      }
      return item;
    });
  }, [items, userLocation]);

  /**
   * useMemo: Aplica los filtros combinados de búsqueda por texto,
   * estado (encontrado/perdido/cerca) y categoría.
   */
  const filteredItems = useMemo(() => {
    return itemsWithDistance.filter(item => {
      const queryLower = searchQuery.toLowerCase().trim();
      
      // Coincidencia con el texto ingresado en el buscador
      const matchesSearch = queryLower === '' ||
        item.title.toLowerCase().includes(queryLower) ||
        item.description.toLowerCase().includes(queryLower) ||
        item.locationName.toLowerCase().includes(queryLower) ||
        item.category.toLowerCase().includes(queryLower);

      // Coincidencia con el tipo de filtro activo
      const matchesFilter =
        activeFilter === 'todos' ? true :
        activeFilter === 'encontrados' ? item.status === 'encontrado' :
        activeFilter === 'perdidos' ? item.status === 'perdido' :
        activeFilter === 'cerca' ? (item.distanceKm !== undefined && item.distanceKm <= NEARBY_RADIUS_KM) : true;

      // Coincidencia con la categoría
      const matchesCategory = selectedCategory === 'Todos' || item.category === selectedCategory;

      // Debe cumplir todas las condiciones activas
      return matchesSearch && matchesFilter && matchesCategory;
    });
  }, [itemsWithDistance, searchQuery, activeFilter, selectedCategory]);

  /**
   * useMemo: Ejecuta el motor de coincidencia automática (Lost & Found Matcher)
   * Compara sistemáticamente todos los objetos perdidos con los encontrados de la misma categoría.
   */
  const matches = useMemo(() => {
    return findAllMatches(items);
  }, [items]);

  /**
   * Cuenta cuántas coincidencias involucran al usuario actual (ya sea como dueño o quien encontró)
   */
  const userMatchesCount = useMemo(() => {
    if (!currentUser) return 0;
    return matches.filter(
      m => m.lostItem.user.id === currentUser.id || m.foundItem.user.id === currentUser.id
    ).length;
  }, [matches, currentUser?.id]);

  /**
   * Recibe los datos del nuevo objeto desde el formulario y lo agrega al inicio de la lista
   * Activa de inmediato el sistema de match para alertar al usuario si ya hay coincidencias.
   */
  const handlePublishSubmit = async (newItemData: Omit<Item, 'id' | 'createdAt' | 'contactCount'>) => {
    if (!currentUser || !supabase) throw new Error('Inicia sesión para publicar.');
    const current = captureOperation();
    if (!current()) throw new Error('La sesión cambió.');
    if (!isItemCategory(newItemData.category)||!isItemStatus(newItemData.status)) throw new Error('Selecciona categoría y estado válidos.');
    if (!isValidCoordinates(newItemData.lat, newItemData.lng)) throw new Error('Selecciona una ubicación válida.');
    if (newItemData.status==='recuperado') throw new Error('Publica el objeto como perdido o encontrado.');
    const textError = publicationTextError(newItemData);
    if (textError) throw new Error(textError);
    const date = serializeItemDate(newItemData.date);
    const data = await publications.current.publish({
      owner_id:currentUser.id,title:newItemData.title,description:newItemData.description,
      category:newItemData.category,status:newItemData.status,location_name:newItemData.locationName,
      lat:newItemData.lat,lng:newItemData.lng,date,image_url:newItemData.imageUrl,reward:newItemData.reward
    },{
      upload:key=>uploadItemImage(newItemData.imageUrl,currentUser.id,current,key),
      rpc:args=>supabase.rpc('publish_item_once',args).single(),
      legacy:input=>supabase.from('items').insert(input).select('*').single(),isCurrent:current
    }).catch(error=>{
      if (!current()) throw new Error('La sesión cambió.');
      reportError('No se pudo guardar la publicación:',error);
      throw new Error((error as {message?:string})?.message==='publication_rate_limited'
        ? 'Espera antes de publicar más objetos. Tu borrador se conserva.' : 'No se pudo guardar la publicación.');
    });
    if (!current()) throw new Error('La sesión cambió.');

    const newItem = mapItem(data, currentUser);
    setItems(prev => [newItem, ...prev.filter(item => item.id !== newItem.id)]);

    // Evaluación automática de posibles coincidencias inmediatas para el nuevo ítem
    const potentialMatches = findMatchesForSingleItem(newItem, items);

    if (potentialMatches.length > 0) {
      const best = potentialMatches[0];
      const otherTitle = newItem.status === 'perdido' ? best.foundItem.title : best.lostItem.title;
      triggerToast(`✨ ¡Coincidencia del ${best.score}% detectada con "${otherTitle}"!`);

      // Registra una notificación en el historial de alertas
      try {
        const legacy = await needsLegacyMatchNotice(()=>supabase.rpc('buscag_capabilities',{}).single());
        if (!current()) return;
        if (legacy) await createNotification(
          `✨ ¡Coincidencia del ${best.score}% encontrada!`,
          `El sistema detectó que "${newItem.title}" coincide con "${otherTitle}".`,
          'match',
          newItem.status === 'perdido' ? best.foundItem.id : best.lostItem.id
        );
      } catch (error) {
        reportError('La publicación se guardó, pero no se pudo guardar la notificación del match:', error);
        if (current()) triggerToast('La publicación se guardó, pero no se pudo guardar la notificación.');
      }
    } else {
      triggerToast('¡Objeto publicado con éxito! 🎉');
    }

    if (!current()) return;
    setActiveTab('home'); // Regresa a la vista principal
  };

  const handleEditSubmit = async (changes: Omit<Item, 'id' | 'createdAt' | 'contactCount'>) => {
    if (!supabase || !currentUser || !editingItem || editingItem.user.id !== currentUser.id) throw new Error('No tienes permiso para editar esta publicación.');
    if (!isItemCategory(changes.category)||!isItemStatus(changes.status)) throw new Error('Selecciona categoría y estado válidos.');
    if (!isValidCoordinates(changes.lat,changes.lng)) throw new Error('Selecciona una ubicación válida.');
    const textError = publicationTextError(changes,editingItem);
    if (textError) throw new Error(textError);
    const current = captureOperation();
    const date = serializeItemDate(changes.date === itemDateInput(editingItem.date) ? editingItem.date : changes.date);
    const imageUrl = changes.imageUrl === editingItem.imageUrl ? editingItem.imageUrl
      : await uploadItemImage(changes.imageUrl,currentUser.id,current);
    if (!current()) throw new Error('La sesión cambió.');
    const {data,error} = await supabase.from('items').update({
      title:changes.title,description:changes.description,category:changes.category,status:changes.status,
      location_name:changes.locationName,lat:changes.lat,lng:changes.lng,date,image_url:imageUrl,reward:changes.reward ?? null
    }).eq('id',editingItem.id).eq('owner_id',currentUser.id).select('*').maybeSingle();
    if (!current()) throw new Error('La sesión cambió.');
    if (error) throw error;
    if (!data) throw new Error('No se pudo actualizar la publicación.');
    const updated = mapItem(data,currentUser);
    setItems(previous=>previous.map(item=>item.id===editingItem.id?updated:item));
    triggerToast('Publicación actualizada.');
  };
  const openEdit = (item: Item) => {
    if (item.user.id !== currentUser?.id) return;
    setSelectedDetailItem(null); setIsPublishOpen(false); setEditingItem(item);
  };

  /**
   * Cambia el estado de un objeto a 'recuperado' y genera una notificación
   */
  const handleMarkAsRecovered = (itemId: string): Promise<boolean> => {
    const pending = recoveryRequests.current.get(itemId);
    if (pending) return pending;
    const target = items.find(item=>item.id===itemId && item.user.id===currentUser?.id);
    if (!currentUser || !supabase || !target) return Promise.resolve(false);
    if (target.status==='recuperado') return Promise.resolve(true);
    const current = captureOperation();
    if (!current() || !window.confirm('¿Confirmas que este objeto fue recuperado?')) return Promise.resolve(false);
    const request = Promise.resolve().then(async()=>{
      try {
        if (!current()) return false;
        const {data,error} = await supabase.from('items').update({status:'recuperado'})
          .eq('id',itemId).eq('owner_id',currentUser.id).select('*').maybeSingle();
        if (!current()) return false;
        if (error) throw error;
        if (!data) throw new Error('No tienes permiso para cambiar esta publicación.');
        setItems(prev=>prev.map(item=>item.id===itemId?{...item,status:'recuperado'}:item));
        triggerToast('🎉 ¡Excelente! Objeto marcado como RECUPERADO.');
        return true;
      } catch {
        if (current()) triggerToast('No se pudo actualizar la publicación.');
        return false;
      } finally { recoveryRequests.current.delete(itemId); }
    });
    recoveryRequests.current.set(itemId,request);
    return request;
  };

  /**
   * Elimina una publicación de la lista por su ID
   */
  const handleDeleteItem = async (itemId: string): Promise<boolean> => {
    if (!currentUser || !supabase || !items.some(item => item.id === itemId && item.user.id === currentUser.id)) return false;
    const current = captureOperation();
    if (!window.confirm('¿Eliminar esta publicación? Sus conversaciones asociadas también se eliminarán. Esta acción no se puede deshacer.')) return false;
    if (!current()) return false;
    try {
      const { data, error } = await supabase.from('items').delete()
        .eq('id', itemId).eq('owner_id', currentUser.id).select('id').maybeSingle();
      if (!current()) return false;
      if (error) throw error;
      if (!data) throw new Error('No tienes permiso para eliminar esta publicación.');
      setItems(prev => prev.filter(item => item.id !== itemId));
      triggerToast('Publicación eliminada');
      return true;
    } catch (error) {
      reportError('No se pudo eliminar la publicación:', error);
      if (current()) triggerToast('No se pudo eliminar la publicación.');
      return false;
    }
  };

  /**
   * Guarda el mensaje y la base notifica al destinatario.
   */
  const handleSendMessage = (itemId: string, text: string, recipientId: string): Promise<void> => {
    if (!currentUser || !supabase) return Promise.reject(new Error('Inicia sesión para enviar mensajes.'));
    const item = items.find(i => i.id === itemId);
    const body = text.trim();
    if (!item || recipientId === currentUser.id || !body || body.length > 4000) {
      return Promise.reject(new Error('El mensaje o el destinatario no son válidos.'));
    }
    const current = captureOperation();
    if (!current()) return Promise.reject(new Error('La sesión cambió.'));
    const key = JSON.stringify([itemId, recipientId, body]);
    const pending = messageRequests.current.get(key);
    if (pending) return pending;
    const request = Promise.resolve().then(async () => {
      try {
        if (!current()) throw new Error('La sesión cambió.');
        const input = {
          item_id:item.id,sender_id:currentUser.id,recipient_id:recipientId,sender_name:currentUser.name,
          sender_avatar:currentUser.avatar,item_title:item.title,item_image:item.imageUrl,text:body
        };
        const data = await deliverMessage(input,messageIntents.current.key(key),{
          rpc:args=>supabase.rpc('send_message_once',args).single(),
          legacy:payload=>supabase.from('messages').insert(payload).select('*').single(),isCurrent:current
        });
        messageIntents.current.acknowledge(key);
        const newMessage = mapMessage(data);
        setMessages(prev => prev.some(message => message.id === newMessage.id) ? prev : [...prev, newMessage]);
      } catch (error) {
        if (current()) triggerToast('No se pudo enviar el mensaje.');
        throw error;
      } finally { messageRequests.current.delete(key); }
    });
    messageRequests.current.set(key, request);
    return request;
  };

  const handleMarkThreadRead = useCallback((itemId: string, senderId: string) => {
    const userId = currentUser?.id;
    if (!userId || !supabase) return;
    const current = captureOperation();
    if (!current()) return;
    void (async () => {
      try {
        const unread = messagesRef.current.filter(message=>message.itemId===itemId && message.senderId===senderId && message.receiverId===userId && !message.isRead).map(message=>message.id);
        await persistReadReceipts(unread,ids=>supabase.from('messages').update({is_read:true})
          .eq('recipient_id',userId).eq('item_id',itemId).eq('sender_id',senderId).in('id',ids).select('id'),current,
          confirmed=>setMessages(previous=>previous.map(message=>confirmed.has(message.id)?{...message,isRead:true}:message)));

      } catch (error) {
        reportError('No se pudo actualizar el estado de lectura de los mensajes:', error);
        if (current()) setDataLoadError('No se pudo actualizar el estado de lectura de los mensajes.');
      }
    })();
  }, [currentUser?.id, captureOperation]);

  const createNotification = async (
    title: string,
    message: string,
    type: NotificationItem['type'],
    relatedItemId?: string
  ) => {
    if (!currentUser || !supabase) throw new Error('Inicia sesión para crear una notificación.');
    const current = captureOperation();
    if (!current()) throw new Error('La sesión cambió.');
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: currentUser.id,
        title,
        message,
        type,
        related_item_id: relatedItemId
      })
      .select('*')
      .single();
    if (error) throw error;
    if (!current()) return;
    const notification = mapNotification(data);
    setNotifications(prev => prev.some(existing => existing.id === notification.id) ? prev : [notification, ...prev]);
  };

  /**
   * Solicita la posición real del dispositivo usando la API de Geolocalización del navegador
   */
  const requestUserLocation = () => {
    const current = captureOperation();
    return new Promise<{ lat: number; lng: number }>((resolve, reject) => {
    if (!current()) { reject(new Error('La sesión cambió.')); return; }
    if (!navigator.geolocation) {
      reject(new Error('Este navegador no permite acceder a la ubicación.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => {
        if (!current()) { reject(new Error('La sesión cambió.')); return; }
        const location = { lat: position.coords.latitude, lng: position.coords.longitude };
        if (!isValidCoordinates(location.lat, location.lng)) { reject(new Error('La ubicación recibida no es válida.')); return; }
        setUserLocation(location);
        resolve(location);
      },
      error => {
        const message = error.code === error.PERMISSION_DENIED
          ? 'Permite el acceso a la ubicación en tu navegador para usar esta función.'
          : error.code === error.POSITION_UNAVAILABLE
          ? 'No se pudo determinar tu ubicación. Comprueba el GPS o la conexión.'
          : 'La solicitud de ubicación agotó el tiempo de espera. Inténtalo de nuevo.';
        reject(new Error(message));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
    });
  };

  const handleNearMeFilter = async () => {
    const current = captureOperation();
    setActiveFilter('cerca');
    try {
      await requestUserLocation();
      if (!current()) return;
      triggerToast('📍 Ubicación actualizada para búsqueda cercana.');
    } catch (error) {
      reportError('No se pudo obtener la ubicación actual:', error);
      if (current()) triggerToast(error instanceof Error ? error.message : 'No se pudo obtener la ubicación actual.');
    }
  };

  const handleTogglePushNotifications = async (enabled: boolean) => {
    if (!currentUser) return;
    pushRevision.current += 1;
    const current = captureOperation();
    try {
      if (enabled) {
        await enablePushNotifications(currentUser.id, current);
        if (!current()) return;
        setPushEnabled(true);
        triggerToast('Notificaciones activadas en este dispositivo.');
      } else {
        await disablePushNotifications(currentUser.id, current);
        if (!current()) return;
        setPushEnabled(false);
        triggerToast('Notificaciones desactivadas en este dispositivo.');
      }
    } catch (error) {
      reportError('No se pudo actualizar la configuración de notificaciones:', error);
      if (current()) triggerToast(error instanceof Error ? error.message : 'No se pudo actualizar la configuración de notificaciones.');
    }
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    const current = captureOperation();
    try { await disconnectPushDevice(current); }
    catch { if (current()) onLogoutWarning(); }
    if (!current()) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      reportError('No se pudo cerrar la sesión:', error);
      if (current()) triggerToast('No se pudo cerrar la sesión.');
    }
  };

  const openContact = (item: Item) => {
    if (!currentUser) return;
    setContactingItem(item);
    setContactingParticipantId(item.user.id === currentUser.id ? null : item.user.id);
  };

  const handleSelectNotification = async (notification: NotificationItem) => {
    if (!supabase || !currentUser) return;
    const current = captureOperation();

    if (!notification.read) {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', notification.id)
          .eq('user_id', currentUser.id)
          .select('id')
          .maybeSingle();
        if (!current()) return;
        if (error) throw error;
        if (!data) throw new Error('No se pudo encontrar la notificación.');
        setNotifications(previous => previous.map(existing =>
          existing.id === notification.id ? { ...existing, read: true } : existing
        ));
      } catch (error) {
        reportError('No se pudo marcar la notificación como leída:', error);
        if (current()) triggerToast('No se pudo actualizar la notificación.');
      }
    }

    if (!current() || !notification.relatedItemId) return;
    const item = items.find(candidate => candidate.id === notification.relatedItemId);
    if (!item) return;

    if (notification.type === 'message') {
      const senderId = notification.relatedUserId ?? messages.find(message =>
        message.itemId === item.id && message.receiverId === currentUser.id
      )?.senderId;
      setContactingItem(item);
      setContactingParticipantId(senderId ?? null);
    } else {
      setSelectedDetailItem(item);
    }
  };

  useEffect(() => {
    if (!currentUser || isLoadingData) return;
    const url = new URL(window.location.href); const id = url.searchParams.get('notification');
    const notice = notifications.find(notification => String(notification.id) === id);
    if (!notice) return; // Never open an ID that is not visible to this account.
    url.searchParams.delete('notification');
    window.history.replaceState(null,'',url.pathname+url.search+url.hash);
    setActiveTab('notifications');
    void handleSelectNotification(notice);
  }, [currentUser?.id,isLoadingData,notifications,items]);

  if (!currentUser) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-slate-50">
        <p role="alert" className="max-w-md text-center text-sm text-red-700">
          {dataLoadError ?? 'Cargando tu cuenta...'}
        </p>
        {dataLoadError && (
          <button onClick={() => void handleSignOut()} className="text-sm font-bold text-blue-600">
            Cerrar sesión
          </button>
        )}
      </main>
    );
  }

  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm font-semibold text-slate-500">Cargando...</div>}>
    <div className="app-shell min-h-screen flex flex-col font-sans text-slate-800">
      {/* Mensaje flotante de alerta (Toast) */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white font-bold text-xs px-4 py-2.5 rounded-full shadow-2xl border border-slate-700 flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <Sparkles className="w-4 h-4 text-blue-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Encabezado superior con logo, selector de usuario y acceso a notificaciones */}
      <Header
        currentUser={currentUser}
        unreadNotificationsCount={unreadNotificationsCount}
        matchesCount={matches.length}
        onOpenNotifications={() => setActiveTab('notifications')}
        onOpenProfile={() => setActiveTab('profile')}
        onSelectTab={(tab) => setActiveTab(tab)}
        activeTab={activeTab}
      />

      {/* Área de contenido principal */}
      <main className="app-main flex-1 w-full mx-auto pb-20">
        {dataLoadError && (
          <div role="alert" className="mx-4 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {dataLoadError}
          </div>
        )}
        {isLoadingData && (
          <div className="px-4 py-3 text-xs font-medium text-slate-500">Sincronizando publicaciones y mensajes...</div>
        )}
        
        {/* ==========================================
            1. VISTA DE INICIO (HOME)
           ========================================== */}
        {activeTab === 'home' && (
          <div className="home-view flex flex-col px-4 pb-5">
            {/* Alerta de coincidencias para el usuario actual */}
            {userMatchesCount > 0 && (
              <div className="rounded-xl bg-[#1b3557] p-3.5 text-white flex items-center justify-between gap-3 border border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-amber-300 fill-current" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold block leading-snug">
                      ¡Detectamos {userMatchesCount} posible{userMatchesCount > 1 ? 's' : ''} coincidencia{userMatchesCount > 1 ? 's' : ''} en tus reportes!
                    </span>
                    <span className="text-[11px] text-blue-100 block">
                      El sistema comparó tus objetos con publicaciones recientes por categoría.
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('matches')}
                  className="px-3 py-1.5 rounded-lg bg-white text-slate-800 text-xs font-semibold shrink-0 hover:bg-slate-100 transition cursor-pointer"
                >
                  Ver matches
                </button>
              </div>
            )}

            {/* Barra de búsqueda por texto */}
            <div className="relative">
              <div className="home-search border p-2 flex items-center gap-3">
                <Search className="w-5 h-5 text-slate-400 ml-2 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar mochila, celular, llaves, documentos..."
                  className="w-full bg-transparent text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="p-1 hover:bg-slate-100 rounded-full text-slate-400 cursor-pointer"
                    title="Limpiar búsqueda"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Botones de filtro rápido: Todos, Encontrados, Perdidos, Cerca de mí */}
            <div>
              <div className="home-status-filters flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                <button
                  onClick={() => setActiveFilter('todos')}
                  className={`px-4 py-2 rounded-2xl text-xs font-extrabold transition cursor-pointer border ${
                    activeFilter === 'todos'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Todos ({items.length})
                </button>

                <button
                  onClick={() => setActiveFilter('encontrados')}
                  className={`px-4 py-2 rounded-2xl text-xs font-extrabold transition cursor-pointer border flex items-center gap-1.5 ${
                    activeFilter === 'encontrados'
                      ? 'bg-green-600 text-white border-green-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Encontrados
                </button>

                <button
                  onClick={() => setActiveFilter('perdidos')}
                  className={`px-4 py-2 rounded-2xl text-xs font-extrabold transition cursor-pointer border flex items-center gap-1.5 ${
                    activeFilter === 'perdidos'
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  Perdidos
                </button>

                <button
                  onClick={handleNearMeFilter}
                  className={`px-4 py-2 rounded-2xl text-xs font-extrabold transition cursor-pointer border flex items-center gap-1.5 ${
                    activeFilter === 'cerca'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Navigation className="w-3.5 h-3.5 fill-current" />
                  Cerca de mí
                </button>
              </div>
            </div>

            {/* Chips de filtro por categorías */}
            <div className="category-filters flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {categoriesList.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-200/60 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Cuadrícula o lista de publicaciones filtradas */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="home-section-title text-base">
                  Publicaciones Recientes
                </h2>
                <span className="text-xs text-slate-500 font-medium">
                  {filteredItems.length} objetos
                </span>
              </div>

              {/* Mensaje de estado vacío si ningún ítem coincide */}
              {filteredItems.length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-3">
                  <ShieldAlert className="w-12 h-12 text-slate-300 mx-auto" />
                  <p className="font-bold text-slate-700 text-base">No se encontraron objetos</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Prueba cambiando los filtros de búsqueda o publica un reporte nuevo si no encuentras lo que buscas.
                  </p>
                  <button
                    onClick={() => setIsPublishOpen(true)}
                    className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    Publicar Objeto
                  </button>
                </div>
              ) : (
                /* Renderizado de tarjetas de objetos */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredItems.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      onViewMore={(selected) => setSelectedDetailItem(selected)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==========================================
            2. VISTA DE MAPA INTERACTIVO (LEAFLET)
           ========================================== */}
        {activeTab === 'map' && (
          <MapView
            items={itemsWithDistance}
            onSelectPublication={(selected) => setSelectedDetailItem(selected)}
            userLat={userLocation?.lat}
            userLng={userLocation?.lng}
            onLocateMe={requestUserLocation}
          />
        )}

        {/* ==========================================
            3. VISTA DE COINCIDENCIAS Y MATCHES AUTOMÁTICOS
           ========================================== */}
        {activeTab === 'matches' && (
          <MatchesView
            matches={matches}
            onSelectMatch={(match) => setSelectedMatchComparison(match)}
            onContactItem={openContact}
            onViewItemDetail={(item) => setSelectedDetailItem(item)}
            currentUser={currentUser}
          />
        )}

        {/* ==========================================
            4. VISTA DE NOTIFICACIONES Y ALERTAS
           ========================================== */}
        {activeTab === 'notifications' && (
          <NotificationsView
            notifications={notifications}
            onMarkAllRead={() => {
              const current = captureOperation();
              const unread = notifications.filter(notification=>!notification.read).map(notification=>notification.id);
              void persistReadReceipts(unread,ids=>supabase.from('notifications').update({is_read:true})
                .eq('user_id',currentUser.id).in('id',ids).select('id'),current,
                confirmed=>setNotifications(previous=>previous.map(notification=>confirmed.has(notification.id)?{...notification,read:true}:notification)))
                .catch(error=>{
                  reportError('No se pudieron marcar las notificaciones como leídas:',error);
                  if (current()) triggerToast('No se pudieron actualizar las notificaciones.');
                });
            }}
            onSelectNotification={notification => void handleSelectNotification(notification)}
          />
        )}

        {/* ==========================================
            5. VISTA DE PERFIL Y GESTIÓN DE REPORTES
           ========================================== */}
        {activeTab === 'profile' && (
          <ProfileView
            currentUser={currentUser}
            userItems={items.filter(i => i.user.id === currentUser.id)}
            onEditItem={openEdit}
            onChangePassword={onChangePassword}
            onSignOut={() => void handleSignOut()}
            onViewItem={(selected) => setSelectedDetailItem(selected)}
            onOpenPublish={() => setIsPublishOpen(true)}
            onMarkAsRecovered={handleMarkAsRecovered}
            onDeleteItem={handleDeleteItem}
            onGoToMatches={() => setActiveTab('matches')}
            userMatchesCount={userMatchesCount}
            pushEnabled={pushEnabled}
            onTogglePush={enabled => void handleTogglePushNotifications(enabled)}
          />
        )}
      </main>

      {/* Barra de navegación inferior móvil */}
      <BottomNav
        activeTab={activeTab}
        onSelectTab={(tab) => {
          if (tab === 'publish') {
            setIsPublishOpen(true);
          } else {
            setActiveTab(tab);
          }
        }}
        onOpenPublish={() => setIsPublishOpen(true)}
        unreadNotificationsCount={unreadNotificationsCount}
        matchesCount={matches.length}
      />

      {/* Modal 1: Formulario para publicar nuevo objeto perdido o encontrado */}
      <PublishModal
        isOpen={isPublishOpen}
        onClose={() => setIsPublishOpen(false)}
        onSubmit={handlePublishSubmit}
        currentUser={currentUser}
      />

      {editingItem && <PublishModal
        isOpen={Boolean(editingItem)} initialItem={editingItem}
        onClose={() => setEditingItem(null)} onSubmit={handleEditSubmit} currentUser={currentUser}
      />}

      {/* Modal 2: Vista detallada con fotos, descripción completa, mapa y acciones */}
      <ItemDetailModal
        item={items.find(item => item.id === selectedDetailItem?.id) ?? null}
        onClose={() => setSelectedDetailItem(null)}
        onContact={openContact}
        currentUser={currentUser}
        onEditItem={openEdit}
        onMarkAsRecovered={handleMarkAsRecovered}
        onDeleteItem={handleDeleteItem}
        allItems={items}
        onOpenMatchComparison={(match) => {
          setSelectedDetailItem(null);
          setSelectedMatchComparison(match);
        }}
      />

      {/* Modal 3: Chat directo y opciones de contacto (llamada/WhatsApp) */}
      <ContactModal
        item={items.find(item => item.id === contactingItem?.id) ?? null}
        isOpen={items.some(item => item.id === contactingItem?.id)}
        onClose={() => {
          setContactingItem(null);
          setContactingParticipantId(null);
        }}
        currentUser={currentUser}
        messages={messages}
        participantId={contactingParticipantId}
        onMarkThreadRead={handleMarkThreadRead}
        onSendMessage={handleSendMessage}
      />

      {/* Modal 4: Comparación lado a lado de coincidencias sugeridas */}
      <MatchComparisonModal
        match={matches.find(match => match.id === selectedMatchComparison?.id) ?? null}
        isOpen={Boolean(selectedMatchComparison)}
        onClose={() => setSelectedMatchComparison(null)}
        onContact={(itemToContact) => {
          setSelectedMatchComparison(null);
          openContact(itemToContact);
        }}
        onViewItemDetail={(item) => {
          setSelectedMatchComparison(null);
          setSelectedDetailItem(item);
        }}
        currentUser={currentUser}
      />
      <FaqChat />
    </div>
    </Suspense>
  );
}
