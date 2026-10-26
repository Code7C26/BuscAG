import React, { useState, useMemo } from 'react';
import { Search, MapPin, SlidersHorizontal, Plus, AlertCircle, CheckCircle2, Sparkles, Navigation, X, ShieldAlert } from 'lucide-react';
import { Item, FilterType, Category, User, NotificationItem, Message } from './types';
import { INITIAL_ITEMS, CURRENT_USER, DEMO_USERS, INITIAL_NOTIFICATIONS, INITIAL_MESSAGES } from './data/initialData';
import { getDistanceKm, DEFAULT_CENTER } from './utils/geo';
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
  // Application State
  const [items, setItems] = useState<Item[]>(INITIAL_ITEMS);
  const [currentUser, setCurrentUser] = useState<User>(CURRENT_USER);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);

  // Tab & Navigation State
  const [activeTab, setActiveTab] = useState<'home' | 'map' | 'notifications' | 'profile'>('home');

  // Home Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('todos');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'Todos'>('Todos');

  // User Location State
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>({
    lat: DEFAULT_CENTER.lat,
    lng: DEFAULT_CENTER.lng
  });

  // Modal States
  const [isPublishOpen, setIsPublishOpen] = useState(false);
  const [selectedDetailItem, setSelectedDetailItem] = useState<Item | null>(null);
  const [contactingItem, setContactingItem] = useState<Item | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Unread notifications count
  const unreadNotificationsCount = notifications.filter(n => !n.read).length;

  // Show quick toast alert
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Categories list
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

  // Calculate items with distance if user location exists
  const itemsWithDistance = useMemo(() => {
    return items.map(item => {
      if (userLocation) {
        const distance = getDistanceKm(userLocation.lat, userLocation.lng, item.lat, item.lng);
        return { ...item, distanceKm: distance };
      }
      return item;
    });
  }, [items, userLocation]);

  // Filtered items for Home Screen
  const filteredItems = useMemo(() => {
    return itemsWithDistance.filter(item => {
      const queryLower = searchQuery.toLowerCase().trim();
      const matchesSearch = queryLower === '' ||
        item.title.toLowerCase().includes(queryLower) ||
        item.description.toLowerCase().includes(queryLower) ||
        item.locationName.toLowerCase().includes(queryLower) ||
        item.category.toLowerCase().includes(queryLower);

      const matchesFilter =
        activeFilter === 'todos' ? true :
        activeFilter === 'encontrados' ? item.status === 'encontrado' :
        activeFilter === 'perdidos' ? item.status === 'perdido' :
        activeFilter === 'cerca' ? (item.distanceKm !== undefined && item.distanceKm <= 4) : true;

      const matchesCategory = selectedCategory === 'Todos' || item.category === selectedCategory;

      return matchesSearch && matchesFilter && matchesCategory;
    });
  }, [itemsWithDistance, searchQuery, activeFilter, selectedCategory]);

  // Handle New Item Publication
  const handlePublishSubmit = (newItemData: Omit<Item, 'id' | 'createdAt' | 'contactCount'>) => {
    const newItem: Item = {
      ...newItemData,
      id: `item_${Date.now()}`,
      createdAt: new Date().toISOString(),
      contactCount: 0
    };

    setItems(prev => [newItem, ...prev]);
    triggerToast('¡Objeto publicado con éxito! 🎉');
    setActiveTab('home');
  };

  // Handle Mark Item as Recovered
  const handleMarkAsRecovered = (itemId: string) => {
    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        return { ...item, status: 'recuperado' };
      }
      return item;
    }));

    // Add notification
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

  // Delete item handler
  const handleDeleteItem = (itemId: string) => {
    setItems(prev => prev.filter(i => i.id !== itemId));
    triggerToast('Publicación eliminada');
  };

  // Send Message Handler with simulated auto-reply
  const handleSendMessage = (itemId: string, text: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

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

    // Simulated Auto-Reply from publisher
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

      // Notification for auto-reply
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

  // Handle Geolocation trigger for "Cerca de mí"
  const handleNearMeFilter = () => {
    setActiveFilter('cerca');
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          triggerToast('📍 Ubicación actualizada para búsqueda cercana.');
        },
        () => {
          triggerToast('Mostrando objetos cercanos a la zona central.');
        }
      );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      {/* Toast Banner Alert */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white font-bold text-xs px-4 py-2.5 rounded-full shadow-2xl border border-slate-700 flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <Sparkles className="w-4 h-4 text-blue-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Header */}
      <Header
        currentUser={currentUser}
        unreadNotificationsCount={unreadNotificationsCount}
        onOpenNotifications={() => setActiveTab('notifications')}
        onOpenProfile={() => setActiveTab('profile')}
        onSelectTab={(tab) => setActiveTab(tab as any)}
        activeTab={activeTab}
      />

      {/* Main View Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto pb-20">
        
        {/* 1. HOME VIEW */}
        {activeTab === 'home' && (
          <div className="px-4 py-5 space-y-5">
            {/* Search Bar */}
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
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Filter Buttons: Todos, Encontrados, Perdidos, Cerca de mí */}
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

            {/* Category Filter Chips */}
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

            {/* Publication List Grid */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-extrabold text-slate-900 text-base">
                  Publicaciones Recientes
                </h2>
                <span className="text-xs text-slate-500 font-medium">
                  {filteredItems.length} objetos
                </span>
              </div>

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

        {/* 2. MAP VIEW */}
        {activeTab === 'map' && (
          <MapView
            items={itemsWithDistance}
            onSelectPublication={(selected) => setSelectedDetailItem(selected)}
            userLat={userLocation?.lat}
            userLng={userLocation?.lng}
          />
        )}

        {/* 3. NOTIFICATIONS VIEW */}
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

        {/* 4. PROFILE VIEW */}
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

      {/* Bottom Navigation Bar */}
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

      {/* Modal 1: Publish Object */}
      <PublishModal
        isOpen={isPublishOpen}
        onClose={() => setIsPublishOpen(false)}
        onSubmit={handlePublishSubmit}
        currentUser={currentUser}
      />

      {/* Modal 2: Object Detail */}
      <ItemDetailModal
        item={selectedDetailItem}
        onClose={() => setSelectedDetailItem(null)}
        onContact={(itemToContact) => setContactingItem(itemToContact)}
        currentUser={currentUser}
        onMarkAsRecovered={handleMarkAsRecovered}
        onDeleteItem={handleDeleteItem}
      />

      {/* Modal 3: Direct Contact / Chat */}
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
