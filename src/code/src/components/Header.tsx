import React from 'react';
import { Search, MapPin, Bell, User as UserIcon, Compass } from 'lucide-react';
import { User } from '../types';

interface HeaderProps {
  currentUser: User;
  unreadNotificationsCount: number;
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
  onSelectTab: (tab: 'home' | 'map' | 'publish' | 'notifications' | 'profile') => void;
  activeTab: string;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  unreadNotificationsCount,
  onOpenNotifications,
  onOpenProfile,
  onSelectTab,
  activeTab
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200/80 shadow-xs">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
        {/* Logo & App Title */}
        <button 
          onClick={() => onSelectTab('home')}
          className="flex items-center gap-2.5 text-left group transition cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:bg-blue-700 transition">
            <Compass className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <span className="font-extrabold text-lg tracking-tight text-slate-900 block leading-none">
              Objetos<span className="text-blue-600">Perdidos</span>
            </span>
            <span className="text-xs text-slate-500 font-medium">Red Comunitaria</span>
          </div>
        </button>

        {/* Quick Navigation / Actions */}
        <div className="flex items-center gap-2">
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
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white animate-bounce">
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
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-7 h-7 rounded-full object-cover border border-slate-300"
            />
            <span className="text-xs font-semibold hidden sm:inline truncate max-w-[100px]">
              {currentUser.name.split(' ')[0]}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
