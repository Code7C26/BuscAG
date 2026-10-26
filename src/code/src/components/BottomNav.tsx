import React from 'react';
import { Home, Map, Plus, Bell, User } from 'lucide-react';

interface BottomNavProps {
  activeTab: 'home' | 'map' | 'publish' | 'notifications' | 'profile';
  onSelectTab: (tab: 'home' | 'map' | 'publish' | 'notifications' | 'profile') => void;
  onOpenPublish: () => void;
  unreadNotificationsCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onSelectTab,
  onOpenPublish,
  unreadNotificationsCount
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-lg px-2 py-1.5 sm:py-2">
      <div className="max-w-md mx-auto flex items-center justify-around relative">
        {/* 🏠 Inicio */}
        <button
          onClick={() => onSelectTab('home')}
          className={`flex flex-col items-center justify-center w-14 py-1 rounded-xl transition cursor-pointer ${
            activeTab === 'home' ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Home className={`w-5 h-5 ${activeTab === 'home' ? 'stroke-[2.5px]' : 'stroke-2'}`} />
          <span className="text-[11px] mt-0.5">Inicio</span>
        </button>

        {/* 🗺️ Mapa */}
        <button
          onClick={() => onSelectTab('map')}
          className={`flex flex-col items-center justify-center w-14 py-1 rounded-xl transition cursor-pointer ${
            activeTab === 'map' ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Map className={`w-5 h-5 ${activeTab === 'map' ? 'stroke-[2.5px]' : 'stroke-2'}`} />
          <span className="text-[11px] mt-0.5">Mapa</span>
        </button>

        {/* ➕ Publicar (Floating Elevated Button) */}
        <div className="relative -top-4 flex items-center justify-center">
          <button
            onClick={onOpenPublish}
            className="w-13 h-13 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-blue-600/35 border-4 border-white transition cursor-pointer group"
            title="Publicar objeto"
            aria-label="Publicar objeto"
          >
            <Plus className="w-7 h-7 group-hover:rotate-90 transition-transform duration-300 stroke-[3px]" />
          </button>
        </div>

        {/* 🔔 Notificaciones */}
        <button
          onClick={() => onSelectTab('notifications')}
          className={`relative flex flex-col items-center justify-center w-14 py-1 rounded-xl transition cursor-pointer ${
            activeTab === 'notifications' ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="relative">
            <Bell className={`w-5 h-5 ${activeTab === 'notifications' ? 'stroke-[2.5px]' : 'stroke-2'}`} />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1.5 w-3.5 h-3.5 bg-red-500 text-white text-[9px] font-extrabold rounded-full flex items-center justify-center">
                {unreadNotificationsCount}
              </span>
            )}
          </div>
          <span className="text-[11px] mt-0.5">Alertas</span>
        </button>

        {/* 👤 Perfil */}
        <button
          onClick={() => onSelectTab('profile')}
          className={`flex flex-col items-center justify-center w-14 py-1 rounded-xl transition cursor-pointer ${
            activeTab === 'profile' ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <User className={`w-5 h-5 ${activeTab === 'profile' ? 'stroke-[2.5px]' : 'stroke-2'}`} />
          <span className="text-[11px] mt-0.5">Perfil</span>
        </button>
      </div>
    </nav>
  );
};
