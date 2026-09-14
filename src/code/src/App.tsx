/**
 * COMPONENTE PRINCIPAL (App.tsx)
 * Es el núcleo de la aplicación. Administra el estado global (publicaciones, usuario activo,
 * filtros, geolocalización y mensajes), maneja la navegación por pestañas y renderiza las
 * vistas principales y modales.
 */
import React, { useState, useMemo } from 'react';
// Iconos de Lucide para la interfaz visual
import { Search, MapPin, SlidersHorizontal, Plus, AlertCircle, CheckCircle2, Sparkles, Navigation, X, ShieldAlert } from 'lucide-react';
// Tipos TypeScript para tipado estricto
import { Item, FilterType, Category, User, NotificationItem, Message } from './types';
// Datos iniciales de demostración
import { INITIAL_ITEMS, CURRENT_USER, DEMO_USERS, INITIAL_NOTIFICATIONS, INITIAL_MESSAGES } from './data/initialData';
// Utilidades de cálculo geográfico (Haversine)
import { getDistanceKm, DEFAULT_CENTER } from './utils/geo';
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

export default function App() {
  // ==========================================
  // ESTADOS PRINCIPALES DE LA APLICACIÓN
  // ==========================================

  // items: Lista de todas las publicaciones (perdidos, encontrados, recuperados)
  const [items, setItems] = useState<Item[]>(INITIAL_ITEMS);

  // currentUser: Usuario que actualmente tiene la sesión iniciada
  const [currentUser, setCurrentUser] = useState<User>(CURRENT_USER);

  // notifications: Historial de avisos y alertas del sistema
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);

  // messages: Historial de mensajes del chat de contacto interno
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);

  // ==========================================
  // NAVEGACIÓN Y VISTAS
  // ==========================================
  // activeTab: Pestaña actualmente visible ('home', 'map', 'notifications', 'profile')
  const [activeTab, setActiveTab] = useState<'home' | 'map' | 'notifications' | 'profile'>('home');

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
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>({
    lat: DEFAULT_CENTER.lat,
    lng: DEFAULT_CENTER.lng
  });

  // ==========================================
  // ESTADO DE MODALES Y MENSAJES FLOTANTES
  // ==========================================
  // isPublishOpen: Controla si el modal de publicar está abierto
  const [isPublishOpen, setIsPublishOpen] = useState(false);

  // selectedDetailItem: Objeto seleccionado para ver ficha detallada (null si está cerrado)
  const [selectedDetailItem, setSelectedDetailItem] = useState<Item | null>(null);

  // contactingItem: Objeto con el que se abrió la ventana de chat directo
  const [contactingItem, setContactingItem] = useState<Item | null>(null);

  // toastMessage: Texto breve de alerta temporal tipo 'toast'
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
   * Recibe los datos del nuevo objeto desde el formulario y lo agrega al inicio de la lista
   */
  const handlePublishSubmit = (newItemData: Omit<Item, 'id' | 'createdAt' | 'contactCount'>) => {
    const newItem: Item = {
      ...newItemData,
      id: `item_${Date.now()}`,          // Genera un ID único con timestamp
      createdAt: new Date().toISOString(), // Fecha de creación actual
      contactCount: 0
    };

    // Actualiza el array agregando el nuevo ítem arriba
    setItems(prev => [newItem, ...prev]);
    triggerToast('¡Objeto publicado con éxito! 🎉');
    setActiveTab('home'); // Regresa a la vista principal
  };

  /**
   * Cambia el estado de un objeto a 'recuperado' y genera una notificación
   */
  const handleMarkAsRecovered = (itemId: string) => {
    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        return { ...item, status: 'recuperado' };
      }
      return item;
    }));

    // Registra una notificación en la lista
    const newNotif: NotificationItem = {
      id: `notif_${Date.now()}`,
      title: '¡Objeto Recuperado! 🎉',
      message: 'Un objeto ha sido marcado como recuperado con éxito.',
      date: new Date().toISOString(),
      type: 'recovered',
      read: false,
      relatedItemId: itemId
    };
    setNotifications(prev => [newNotif, ...prev]);
    triggerToast('🎉 ¡Excelente! Objeto marcado como RECUPERADO.');
  };

  /**
   * Elimina una publicación de la lista por su ID
   */
  const handleDeleteItem = (itemId: string) => {
    setItems(prev => prev.filter(i => i.id !== itemId));
    triggerToast('Publicación eliminada');
  };

  /**
   * Envía un mensaje en el chat y simula una respuesta automática del publicador
   */
  const handleSendMessage = (itemId: string, text: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    // Crea el mensaje del usuario emisor
    const newMsg: Message = {
      id: `msg_${Date.now()}`,
      itemId,
      itemTitle: item.title,
      itemImage: item.imageUrl,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      receiverId: item.user.id,
      text,
      timestamp: new Date().toISOString(),
      isRead: true
    };

    setMessages(prev => [...prev, newMsg]);

    // Simula una respuesta después de 1.5 segundos para mostrar el funcionamiento del chat
    setTimeout(() => {
      const autoReply: Message = {
        id: `msg_reply_${Date.now()}`,
        itemId,
        itemTitle: item.title,
        itemImage: item.imageUrl,
        senderId: item.user.id,
        senderName: item.user.name,
        senderAvatar: item.user.avatar,
        receiverId: currentUser.id,
        text: `¡Hola ${currentUser.name.split(' ')[0]}! Gracias por escribir. Sí, coordinemos para verificar la entrega de "${item.title}".`,
        timestamp: new Date().toISOString(),
        isRead: false
      };
      setMessages(prev => [...prev, autoReply]);

      // Alerta de nueva respuesta en notificaciones
      const replyNotif: NotificationItem = {
        id: `notif_${Date.now()}`,
        title: `Respuesta de ${item.user.name} 💬`,
        message: `Te ha respondido sobre "${item.title}"`,
        date: new Date().toISOString(),
        type: 'message',
        read: false,
        relatedItemId: itemId
      };
      setNotifications(prev => [replyNotif, ...prev]);
    }, 1500);
  };

  /**
   * Solicita la posición real del dispositivo usando la API de Geolocalización del navegador
   */
  const handleNearMeFilter = () => {
    setActiveFilter('cerca');
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          // Guarda latitud y longitud obtenidas del GPS
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          triggerToast('📍 Ubicación actualizada para búsqueda cercana.');
        },
        () => {
          // Si el usuario deniega permisos o hay error, usa la ubicación por defecto
          triggerToast('Mostrando objetos cercanos a la zona central.');
        }
      );
    }
  };

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
        onOpenNotifications={() => setActiveTab('notifications')}
        onOpenProfile={() => setActiveTab('profile')}
        onSelectTab={(tab) => setActiveTab(tab as any)}
        activeTab={activeTab}
      />

      {/* Área de contenido principal */}
      <main className="flex-1 max-w-5xl w-full mx-auto pb-20">
        
        {/* ==========================================
            1. VISTA DE INICIO (HOME)
           ========================================== */}
        {activeTab === 'home' && (
          <div className="px-4 py-5 space-y-5">
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
          />
        )}

        {/* ==========================================
            3. VISTA DE NOTIFICACIONES Y ALERTAS
           ========================================== */}
        {activeTab === 'notifications' && (
          <NotificationsView
            notifications={notifications}
            onMarkAllRead={() => {
              setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            }}
            onSelectNotification={(notif) => {
              if (notif.relatedItemId) {
                const found = items.find(i => i.id === notif.relatedItemId);
                if (found) {
                  setSelectedDetailItem(found);
                }
              }
            }}
          />
        )}

        {/* ==========================================
            4. VISTA DE PERFIL Y GESTIÓN DE REPORTES
           ========================================== */}
        {activeTab === 'profile' && (
          <ProfileView
            currentUser={currentUser}
            allUsers={DEMO_USERS}
            userItems={items.filter(i => i.user.id === currentUser.id)}
            onSwitchUser={(user) => setCurrentUser(user)}
            onViewItem={(selected) => setSelectedDetailItem(selected)}
            onOpenPublish={() => setIsPublishOpen(true)}
            onMarkAsRecovered={handleMarkAsRecovered}
            onDeleteItem={handleDeleteItem}
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
        onContact={(itemToContact) => setContactingItem(itemToContact)}
        currentUser={currentUser}
        onMarkAsRecovered={handleMarkAsRecovered}
        onDeleteItem={handleDeleteItem}
      />

      {/* Modal 3: Chat directo y opciones de contacto (llamada/WhatsApp) */}
      <ContactModal
        item={contactingItem}
        isOpen={Boolean(contactingItem)}
        onClose={() => setContactingItem(null)}
        currentUser={currentUser}
        messages={messages}
        onSendMessage={handleSendMessage}
      />
    </div>
  );
}

