import React from 'react';
import { Home, Map, Plus, Bell, User, Sparkles } from 'lucide-react';
import { TabType } from '../types';

interface BottomNavProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  onOpenPublish: () => void;
  unreadNotificationsCount: number;
  matchesCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onSelectTab,
  onOpenPublish,
  unreadNotificationsCount,
  matchesCount = 0
}) => {
  return (
    <nav className="bottom-nav fixed bottom-0 left-0 right-0 z-40 border-t px-2 py-1.5 sm:py-2">
      <div className="bottom-nav__content mx-auto flex items-center justify-around relative">
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
            className="bottom-nav__create w-13 h-13 rounded-full active:scale-95 text-white flex items-center justify-center transition cursor-pointer group"
            title="Publicar objeto"
            aria-label="Publicar objeto"
          >
            <Plus className="w-7 h-7 group-hover:rotate-90 transition-transform duration-300 stroke-[3px]" />
          </button>
        </div>

        {/* ✨ Coincidencias / Matches */}
        <button
          onClick={() => onSelectTab('matches')}
          className={`relative flex flex-col items-center justify-center w-14 py-1 rounded-xl transition cursor-pointer ${
            activeTab === 'matches' ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="relative">
            <Sparkles className={`w-5 h-5 ${activeTab === 'matches' ? 'stroke-[2.5px] text-blue-600 fill-blue-100' : 'stroke-2'}`} />
            {matchesCount > 0 && (
              <span className="absolute -top-1 -right-2 px-1 min-w-3.5 h-3.5 bg-amber-500 text-white text-[9px] font-black rounded-full flex items-center justify-center shadow-xs">
                {matchesCount}
              </span>
            )}
          </div>
          <span className="text-[11px] mt-0.5">Matches</span>
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
