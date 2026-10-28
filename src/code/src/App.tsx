/**
 * COMPONENTE PRINCIPAL (App.tsx)
 * Es el núcleo de la aplicación. Administra el estado global (publicaciones, usuario activo,
 * filtros, geolocalización y mensajes), maneja la navegación por pestañas y renderiza las
 * vistas principales y modales.
 */
import React, { useState, useMemo, useEffect, useCallback } from 'react';
// Iconos de Lucide para la interfaz visual
import { supabase } from '../lib/supabase';
import type { User as AuthUser } from '@supabase/supabase-js';
import { Search, MapPin, SlidersHorizontal, Plus, AlertCircle, CheckCircle2, Sparkles, Navigation, X, ShieldAlert } from 'lucide-react';
// Tipos TypeScript para tipado estricto
import { Item, FilterType, Category, User, NotificationItem, Message, MatchResult, TabType } from './types';
import { AuthView } from './components/AuthView';
import { loadItems, loadMessages, loadNotifications, loadProfile, mapItem, mapMessage, mapNotification, uploadItemImage } from '../lib/database';
import { disablePushNotifications, enablePushNotifications, getPushNotificationStatus } from '../lib/push';
// Utilidades de cálculo geográfico (Haversine)
import { getDistanceKm } from './utils/geo';
// Motor de coincidencia automática (Lost & Found Matcher)
import { findAllMatches, findMatchesForSingleItem } from './utils/matcher';
// Componentes modulares de la aplicación
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { ItemCard } from './components/ItemCard';
import { MapView } from './components/MapView';
import { PublishModal } from './components/PublishModal';
import { ItemDetailModal } from './components/ItemDetailModal';
import { ContactModal } from './components/ContactModal';
import { ProfileView } from './components/ProfileView';
import { NotificationsView } from './components/NotificationsView';
import { MatchesView } from './components/MatchesView';
import { MatchComparisonModal } from './components/MatchComparisonModal';

export default function App() {
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

  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
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

  // selectedDetailItem: Objeto seleccionado para ver ficha detallada (null si está cerrado)
  const [selectedDetailItem, setSelectedDetailItem] = useState<Item | null>(null);

  // contactingItem: Objeto con el que se abrió la ventana de chat directo
  const [contactingItem, setContactingItem] = useState<Item | null>(null);
  const [contactingParticipantId, setContactingParticipantId] = useState<string | null>(null);

  // toastMessage: Texto breve de alerta temporal tipo 'toast'
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setIsLoadingSession(false);
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
      setIsLoadingSession(false);
    });

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error('No se pudo recuperar la sesión:', error);
        setDataLoadError('No se pudo verificar la sesión. Recarga la página e inténtalo nuevamente.');
      }
      setAuthUser(data.session?.user ?? null);
      setIsLoadingSession(false);
    }).catch(error => {
      console.error('No se pudo recuperar la sesión:', error);
      setDataLoadError('No se pudo verificar la sesión. Recarga la página e inténtalo nuevamente.');
      setIsLoadingSession(false);
    });

    return () => subscription.unsubscribe();
  }, []);

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

    let active = true;
    const refreshData = async () => {
      const [loadedItems, loadedMessages, loadedNotifications] = await Promise.all([
        loadItems(),
        loadMessages(authUser.id),
        loadNotifications(authUser.id)
      ]);
      if (!active) return;
      setItems(loadedItems);
      setMessages(loadedMessages);
      setNotifications(loadedNotifications);
    };

    const channel = supabase
      .channel(`app-data-${authUser.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, () => {
        void refreshData().catch(error => {
          console.error('No se pudieron actualizar las publicaciones:', error);
          if (active) setDataLoadError('No se pudieron actualizar las publicaciones.');
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        void refreshData().catch(error => {
          console.error('No se pudieron actualizar los mensajes:', error);
          if (active) setDataLoadError('No se pudieron actualizar los mensajes.');
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        void refreshData().catch(error => {
          console.error('No se pudieron actualizar las notificaciones:', error);
          if (active) setDataLoadError('No se pudieron actualizar las notificaciones.');
        });
      })
      .subscribe(status => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('No se pudo establecer la conexión en tiempo real:', status);
          if (active) setDataLoadError('Se perdió la conexión en tiempo real. Recarga para volver a sincronizar.');
        }
      });

    setIsLoadingData(true);
    setDataLoadError(null);
    Promise.all([loadProfile(authUser), refreshData()])
      .then(([profile]) => {
        if (active) setCurrentUser(profile);
      })
      .catch(error => {
        console.error('No se pudieron cargar los datos de la cuenta:', error);
        if (active) setDataLoadError('No se pudieron cargar los datos. Verifica que hayas aplicado la migración de Supabase.');
      })
      .finally(() => {
        if (active) setIsLoadingData(false);
      });

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [authUser]);

  // Cuenta la cantidad de notificaciones que el usuario todavía no ha leído
  const unreadNotificationsCount = notifications.filter(n => !n.read).length;

  /**
   * Muestra un mensaje flotante 'toast' en pantalla durante 3.5 segundos
   */
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  useEffect(() => {
    if (!authUser) return;
    let active = true;
    void getPushNotificationStatus(authUser.id)
      .then(enabled => {
        if (active) setPushEnabled(enabled);
      })
      .catch(error => {
        console.error('No se pudo verificar la suscripción a notificaciones:', error);
      });
    return () => {
      active = false;
    };
  }, [authUser]);

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
        return { ...item, distanceKm: distance };
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
        activeFilter === 'cerca' ? (item.distanceKm !== undefined && item.distanceKm <= 4) : true;

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
    const imageUrl = await uploadItemImage(newItemData.imageUrl, currentUser.id);
    const { data, error } = await supabase
      .from('items')
      .insert({
        owner_id: currentUser.id,
        title: newItemData.title,
        description: newItemData.description,
        category: newItemData.category,
        status: newItemData.status,
        location_name: newItemData.locationName,
        lat: newItemData.lat,
        lng: newItemData.lng,
        date: new Date(newItemData.date).toISOString(),
        image_url: imageUrl,
        reward: newItemData.reward
      })
      .select('*')
      .single();

    if (error) {
      console.error('No se pudo guardar la publicación:', error);
      throw new Error('No se pudo guardar la publicación.');
    }

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
        await createNotification(
          `✨ ¡Coincidencia del ${best.score}% encontrada!`,
          `El sistema detectó que "${newItem.title}" coincide con "${otherTitle}".`,
          'match',
          newItem.status === 'perdido' ? best.foundItem.id : best.lostItem.id
        );
      } catch (error) {
        console.error('La publicación se guardó, pero no se pudo guardar la notificación del match:', error);
        triggerToast('La publicación se guardó, pero no se pudo guardar la notificación.');
      }
    } else {
      triggerToast('¡Objeto publicado con éxito! 🎉');
    }

    setActiveTab('home'); // Regresa a la vista principal
  };

  /**
   * Cambia el estado de un objeto a 'recuperado' y genera una notificación
   */
  const handleMarkAsRecovered = (itemId: string) => {
    if (!currentUser || !supabase) return;
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('items')
          .update({ status: 'recuperado' })
          .eq('id', itemId)
          .eq('owner_id', currentUser.id)
          .select('*')
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('No tienes permiso para cambiar esta publicación.');
        setItems(prev => prev.map(item => item.id === itemId ? { ...item, status: 'recuperado' } : item));
        triggerToast('🎉 ¡Excelente! Objeto marcado como RECUPERADO.');
      } catch (error) {
        console.error('No se pudo actualizar el estado de la publicación:', error);
        triggerToast('No se pudo actualizar la publicación.');
      }
    })();
  };

  /**
   * Elimina una publicación de la lista por su ID
   */
  const handleDeleteItem = (itemId: string) => {
    if (!currentUser || !supabase) return;
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('items')
          .delete()
          .eq('id', itemId)
          .eq('owner_id', currentUser.id)
          .select('id')
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('No tienes permiso para eliminar esta publicación.');
        setItems(prev => prev.filter(item => item.id !== itemId));
        triggerToast('Publicación eliminada');
      } catch (error) {
        console.error('No se pudo eliminar la publicación:', error);
        triggerToast('No se pudo eliminar la publicación.');
      }
    })();
  };

  /**
   * Guarda el mensaje y la base notifica al destinatario.
   */
  const handleSendMessage = (itemId: string, text: string, recipientId: string) => {
    if (!currentUser || !supabase) return;
    const item = items.find(i => i.id === itemId);
    if (!item || recipientId === currentUser.id) return;

    void (async () => {
      try {
        const { data, error } = await supabase
          .from('messages')
          .insert({
        item_id: item.id,
        sender_id: currentUser.id,
        recipient_id: recipientId,
        sender_name: currentUser.name,
        sender_avatar: currentUser.avatar,
        item_title: item.title,
        item_image: item.imageUrl,
        text: text.trim()
      })
      .select('*')
          .single();
        if (error) throw error;
        const newMessage = mapMessage(data);
        setMessages(prev => prev.some(message => message.id === newMessage.id) ? prev : [...prev, newMessage]);
      } catch (error) {
        console.error('No se pudo enviar el mensaje:', error);
        triggerToast('No se pudo enviar el mensaje.');
      }
    })();
  };

  const handleMarkThreadRead = useCallback((itemId: string, senderId: string) => {
    const userId = currentUser?.id;
    if (!userId || !supabase) return;
    void (async () => {
      try {
        const { error } = await supabase
          .from('messages')
          .update({ is_read: true })
          .eq('item_id', itemId)
          .eq('sender_id', senderId)
          .eq('recipient_id', userId)
          .eq('is_read', false);
        if (error) throw error;
        setMessages(prev => prev.map(message =>
          message.itemId === itemId &&
          message.senderId === senderId &&
          message.receiverId === userId
            ? { ...message, isRead: true }
            : message
        ));
      } catch (error) {
        console.error('No se pudo actualizar el estado de lectura de los mensajes:', error);
        setDataLoadError('No se pudo actualizar el estado de lectura de los mensajes.');
      }
    })();
  }, [currentUser?.id]);

  const createNotification = async (
    title: string,
    message: string,
    type: NotificationItem['type'],
    relatedItemId?: string
  ) => {
    if (!currentUser || !supabase) throw new Error('Inicia sesión para crear una notificación.');
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
    const notification = mapNotification(data);
    setNotifications(prev => prev.some(existing => existing.id === notification.id) ? prev : [notification, ...prev]);
  };

  /**
   * Solicita la posición real del dispositivo usando la API de Geolocalización del navegador
   */
  const requestUserLocation = () => new Promise<{ lat: number; lng: number }>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Este navegador no permite acceder a la ubicación.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => {
        const location = { lat: position.coords.latitude, lng: position.coords.longitude };
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

  const handleNearMeFilter = async () => {
    setActiveFilter('cerca');
    try {
      await requestUserLocation();
      triggerToast('📍 Ubicación actualizada para búsqueda cercana.');
    } catch (error) {
      console.error('No se pudo obtener la ubicación actual:', error);
      triggerToast(error instanceof Error ? error.message : 'No se pudo obtener la ubicación actual.');
    }
  };

  const handleTogglePushNotifications = async (enabled: boolean) => {
    if (!currentUser) return;
    try {
      if (enabled) {
        await enablePushNotifications(currentUser.id);
        setPushEnabled(true);
        triggerToast('Notificaciones activadas en este dispositivo.');
      } else {
        await disablePushNotifications(currentUser.id);
        setPushEnabled(false);
        triggerToast('Notificaciones desactivadas en este dispositivo.');
      }
    } catch (error) {
      console.error('No se pudo actualizar la configuración de notificaciones:', error);
      triggerToast(error instanceof Error ? error.message : 'No se pudo actualizar la configuración de notificaciones.');
    }
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('No se pudo cerrar la sesión:', error);
      triggerToast('No se pudo cerrar la sesión.');
    }
  };

  const openContact = (item: Item) => {
    if (!currentUser) return;
    setContactingItem(item);
    setContactingParticipantId(item.user.id === currentUser.id ? null : item.user.id);
  };

  const handleSelectNotification = async (notification: NotificationItem) => {
    if (!supabase || !currentUser) return;

    if (!notification.read) {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', notification.id)
          .eq('user_id', currentUser.id)
          .select('id')
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('No se pudo encontrar la notificación.');
        setNotifications(previous => previous.map(existing =>
          existing.id === notification.id ? { ...existing, read: true } : existing
        ));
      } catch (error) {
        console.error('No se pudo marcar la notificación como leída:', error);
        triggerToast('No se pudo actualizar la notificación.');
      }
    }

    if (!notification.relatedItemId) return;
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

  if (!authUser) return <AuthView />;

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
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
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
      <main className="flex-1 max-w-5xl w-full mx-auto pb-20">
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
          <div className="px-4 py-5 space-y-5">
            {/* Alerta de coincidencias para el usuario actual */}
            {userMatchesCount > 0 && (
              <div className="bg-linear-to-r from-blue-600 via-indigo-600 to-blue-700 rounded-2xl p-3.5 text-white flex items-center justify-between gap-3 shadow-md shadow-blue-600/15">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-amber-300 fill-current" />
                  </div>
                  <div>
                    <span className="text-xs font-black block leading-snug">
                      ¡Detectamos {userMatchesCount} posible{userMatchesCount > 1 ? 's' : ''} coincidencia{userMatchesCount > 1 ? 's' : ''} en tus reportes!
                    </span>
                    <span className="text-[11px] text-blue-100 block">
                      El sistema comparó tus objetos con publicaciones recientes por categoría.
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('matches')}
                  className="px-3 py-1.5 rounded-xl bg-white text-blue-700 text-xs font-black shrink-0 hover:bg-blue-50 transition cursor-pointer shadow-xs"
                >
                  Ver matches
                </button>
              </div>
            )}

            {/* Barra de búsqueda por texto */}
            <div className="relative">
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-2 flex items-center gap-3">
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
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                <button
                  onClick={() => setActiveFilter('todos')}
                  className={`px-4 py-2 rounded-2xl text-xs font-extrabold transition cursor-pointer border ${
                    activeFilter === 'todos'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Todos ({items.length})
                </button>

                <button
                  onClick={() => setActiveFilter('encontrados')}
                  className={`px-4 py-2 rounded-2xl text-xs font-extrabold transition cursor-pointer border flex items-center gap-1.5 ${
                    activeFilter === 'encontrados'
                      ? 'bg-green-600 text-white border-green-600 shadow-md shadow-green-600/20'
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
                      ? 'bg-red-600 text-white border-red-600 shadow-md shadow-red-600/20'
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
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Navigation className="w-3.5 h-3.5 fill-current" />
                  Cerca de mí
                </button>
              </div>
            </div>

            {/* Chips de filtro por categorías */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
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
                <h2 className="font-extrabold text-slate-900 text-base">
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
              void supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', currentUser.id)
                .eq('is_read', false)
                .then(({ error }) => {
                  if (error) {
                    console.error('No se pudieron marcar las notificaciones como leídas:', error);
                    triggerToast('No se pudieron actualizar las notificaciones.');
                    return;
                  }
                  setNotifications(prev => prev.map(notification => ({ ...notification, read: true })));
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

      {/* Modal 2: Vista detallada con fotos, descripción completa, mapa y acciones */}
      <ItemDetailModal
        item={selectedDetailItem}
        onClose={() => setSelectedDetailItem(null)}
        onContact={openContact}
        currentUser={currentUser}
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
        item={contactingItem}
        isOpen={Boolean(contactingItem)}
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
        match={selectedMatchComparison}
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
    </div>
  );
}
