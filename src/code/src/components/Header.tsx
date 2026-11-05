import {Avatar} from './Avatar';
import React from 'react';
import { Bell, Compass, Sparkles } from 'lucide-react';
import { User, TabType } from '../types';

interface HeaderProps {
  currentUser: User;
  unreadNotificationsCount: number;
  matchesCount?: number;
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
  onSelectTab: (tab: TabType) => void;
  activeTab: TabType;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  unreadNotificationsCount,
  matchesCount = 0,
  onOpenNotifications,
  onOpenProfile,
  onSelectTab,
  activeTab
}) => {
  return (
    <header className="app-header sticky top-0 z-30 border-b">
      <div className="app-header__inner mx-auto px-4 flex items-center justify-between gap-3">
        {/* Logo & App Title */}
        <button 
          onClick={() => onSelectTab('home')}
          className="flex items-center gap-2.5 text-left group transition cursor-pointer"
        >
          <div className="app-brand-mark w-10 h-10 rounded-xl flex items-center justify-center text-white transition group-hover:bg-slate-800">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <span className="font-semibold text-lg tracking-tight text-slate-900 block leading-none">
              Busc<span className="text-blue-800">AG</span>
            </span>
            <span className="text-[11px] text-slate-500 font-medium tracking-wide">Encontrarnos hace la diferencia</span>
          </div>
        </button>

        {/* Quick Navigation / Actions */}
        <div className="flex items-center gap-2">
          {/* Matches quick link on header */}
          <button
            onClick={() => onSelectTab('matches')}
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
              activeTab === 'matches'
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100/80 hover:bg-slate-200 text-slate-700'
            }`}
            title="Ver coincidencias automáticas"
          >
            <Sparkles className={`w-3.5 h-3.5 ${activeTab === 'matches' ? 'text-amber-300 fill-amber-300' : 'text-blue-600'}`} />
            <span>Coincidencias</span>
            {matchesCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                activeTab === 'matches' ? 'bg-white/20 text-white' : 'bg-amber-500 text-white'
              }`}>
                {matchesCount}
              </span>
            )}
          </button>

          {/* Notifications button */}
          <button
            onClick={onOpenNotifications}
            className={`relative p-2.5 rounded-full transition cursor-pointer ${
              activeTab === 'notifications'
                ? 'bg-blue-50 text-blue-600 font-semibold'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
            title="Notificaciones"
            aria-label="Notificaciones"
          >
            <Bell className="w-5 h-5" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-semibold rounded-full flex items-center justify-center border-2 border-white">
                {unreadNotificationsCount}
              </span>
            )}
          </button>

          {/* Current User Profile Pill */}
          <button
            onClick={onOpenProfile}
            className={`flex items-center gap-2 p-1.5 pr-3 rounded-full border transition cursor-pointer ${
              activeTab === 'profile'
                ? 'border-blue-600 bg-blue-50/80 text-blue-700'
                : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
            }`}
          >
            <Avatar src={currentUser.avatar} name={currentUser.name} className="w-7 h-7 rounded-full object-cover border border-slate-300"/>
            <span className="text-xs font-semibold hidden sm:inline truncate max-w-[100px]">
              {currentUser.name.split(' ')[0]}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
