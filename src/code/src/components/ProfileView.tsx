import {Avatar} from './Avatar';
import React, { useState } from 'react';
import { User, Item } from '../types';
import { ShieldCheck, CheckCircle2, Package, LogOut, Trash2, Plus, ChevronRight, Sparkles } from 'lucide-react';
import { ItemCard } from './ItemCard';

interface ProfileViewProps {
  onEditItem?: (item: Item) => void;
  currentUser: User;
  userItems: Item[];
  onSignOut: () => void;
  onChangePassword?: () => void;
  onViewItem: (item: Item) => void;
  onOpenPublish: () => void;
  onMarkAsRecovered: (itemId: string) => void;
  onDeleteItem: (itemId: string) => void;
  onGoToMatches?: () => void;
  userMatchesCount?: number;
  pushEnabled: boolean;
  onTogglePush: (enabled: boolean) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  currentUser,
  onEditItem,
  userItems,
  onSignOut,
  onChangePassword,
  onViewItem,
  onOpenPublish,
  onMarkAsRecovered,
  onDeleteItem,
  onGoToMatches,
  userMatchesCount = 0,
  pushEnabled,
  onTogglePush
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'published' | 'recovered' | 'settings'>('published');

  const publishedItems = userItems.filter(i => i.status !== 'recuperado');
  const recoveredItems = userItems.filter(i => i.status === 'recuperado');

  return (
    <div className="profile-view max-w-2xl mx-auto px-4 py-6 pb-24 space-y-6">
      {/* Profile Header Card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs relative overflow-hidden">
        <div className="profile-view__hero-strip absolute top-0 inset-x-0 h-16" />
        
        <div className="relative pt-4 flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4">
          {/* Avatar */}
          <div className="relative">
            <Avatar src={currentUser.avatar} name={currentUser.name} className="profile-view__avatar w-20 h-20 rounded-full object-cover border-4 border-white bg-white"/>
            {currentUser.verified && (
              <div className="absolute bottom-0 right-0 bg-blue-600 text-white p-1 rounded-full border-2 border-white shadow-xs">
                <ShieldCheck className="w-4 h-4" />
              </div>
            )}
          </div>

          {/* User Details */}
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-slate-900 text-xl flex items-center justify-center sm:justify-start gap-1.5">
              {currentUser.name}
            </h2>
            <p className="text-xs text-slate-500 font-medium">{currentUser.email}</p>
            <p className="text-xs text-slate-600 mt-1">📍 {currentUser.location}</p>

            {/* Quick Stats */}
            <div className="mt-4 flex items-center justify-center sm:justify-start gap-6 border-t border-slate-100 pt-3">
              <div>
                <span className="font-extrabold text-slate-900 text-base block leading-none">
                  {userItems.length}
                </span>
                <span className="text-[11px] text-slate-500 font-medium">Publicados</span>
              </div>
              <div className="border-r border-slate-200 h-6" />
              <div>
                <span className="font-extrabold text-emerald-600 text-base block leading-none">
                  {userItems.filter(item => item.status === 'recuperado').length}
                </span>
                <span className="text-[11px] text-slate-500 font-medium">Recuperados</span>
              </div>
              <div className="border-r border-slate-200 h-6" />
              <div>
                <span className="font-extrabold text-amber-500 text-base block leading-none">
                  ⭐ {currentUser.rating}
                </span>
                <span className="text-[11px] text-slate-500 font-medium">Calificación</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-tabs Navigation */}
      <div className="profile-tabs flex border-b border-slate-200">
        <button
          onClick={() => setActiveSubTab('published')}
          className={`py-3 px-4 text-xs font-bold transition cursor-pointer border-b-2 ${
            activeSubTab === 'published'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Mis Publicaciones ({publishedItems.length})
        </button>

        <button
          onClick={() => setActiveSubTab('recovered')}
          className={`py-3 px-4 text-xs font-bold transition cursor-pointer border-b-2 ${
            activeSubTab === 'recovered'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Objetos Recuperados ({recoveredItems.length})
        </button>

        <button
          onClick={() => setActiveSubTab('settings')}
          className={`py-3 px-4 text-xs font-bold transition cursor-pointer border-b-2 ${
            activeSubTab === 'settings'
              ? 'border-slate-800 text-slate-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Configuración
        </button>
      </div>

      {/* Published Items Tab */}
      {activeSubTab === 'published' && (
        <div className="space-y-4">
          {/* Alerta de coincidencias para el usuario */}
          {userMatchesCount > 0 && onGoToMatches && (
            <div className="p-4 rounded-xl bg-[#1b3557] text-white flex items-center justify-between gap-3 border border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-amber-300 fill-current" />
                </div>
                <div>
                  <p className="text-xs font-semibold leading-tight">
                    ¡Tienes {userMatchesCount} posible{userMatchesCount > 1 ? 's' : ''} coincidencia{userMatchesCount > 1 ? 's' : ''} detectada{userMatchesCount > 1 ? 's' : ''}!
                  </p>
                  <p className="text-[11px] text-blue-100 mt-0.5">
                    El sistema detectó objetos de tu misma categoría con alta similitud.
                  </p>
                </div>
              </div>
              <button
                onClick={onGoToMatches}
                className="px-3 py-1.5 rounded-lg bg-white text-slate-800 text-xs font-semibold shrink-0 hover:bg-slate-100 transition cursor-pointer"
              >
                Ver matches
              </button>
            </div>
          )}

          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-slate-900 text-sm">Tus objetos activos</h3>
            <button
              onClick={onOpenPublish}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Publicar otro
            </button>
          </div>

          {publishedItems.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-3">
              <Package className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-700 text-sm">No tienes publicaciones activas</p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                ¿Encontraste o perdiste algo? Publica para conectar con la comunidad.
              </p>
              <button
                onClick={onOpenPublish}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Publicar ahora
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {publishedItems.map(item => (
                <div key={item.id} className="relative group">
                  <ItemCard item={item} onViewMore={onViewItem} />
                  
                  {/* Quick Owner Actions overlay */}
                  <div className="mt-2 flex gap-2">
                    {onEditItem && <button type="button" onClick={() => onEditItem(item)}
                      className="item-card__more inline-flex items-center gap-1 px-3 py-1.5 text-xs transition cursor-pointer shrink-0">Editar</button>}
                    <button
                      onClick={() => onMarkAsRecovered(item.id)}
                      className="flex-1 py-1.5 px-3 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Marcar Recuperado
                    </button>
                    <button
                      onClick={() => onDeleteItem(item.id)}
                      className="p-1.5 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 rounded-xl transition cursor-pointer"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recovered Items Tab */}
      {activeSubTab === 'recovered' && (
        <div className="space-y-4">
          <h3 className="font-extrabold text-slate-900 text-sm">Historial de Objetos Devueltos / Recuperados</h3>

          {recoveredItems.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-2">
              <CheckCircle2 className="w-12 h-12 text-emerald-300 mx-auto" />
              <p className="font-bold text-slate-700 text-sm">Aún no hay casos cerrados como recuperados</p>
              <p className="text-xs text-slate-500">
                Cuando devuelvas o recuperes un objeto, aparecerá en esta sección de honor.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {recoveredItems.map(item => (
                <ItemCard key={item.id} item={item} onViewMore={onViewItem} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {activeSubTab === 'settings' && (
        <div className="bg-white rounded-3xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
          <label className="p-4 flex items-center justify-between hover:bg-slate-50 transition cursor-pointer">
            <div>
              <span className="font-bold text-slate-800 text-sm block">Notificaciones push</span>
              <span className="text-xs text-slate-500">Mensajes, coincidencias y recuperaciones, incluso con la app cerrada</span>
            </div>
            <input
              type="checkbox"
              checked={pushEnabled}
              onChange={event => onTogglePush(event.target.checked)}
              className="w-4 h-4 text-blue-600 rounded cursor-pointer"
              aria-label="Activar notificaciones push"
            />
          </label>

          <div className="p-4 flex items-center justify-between">
            <div>
              <span className="font-bold text-slate-800 text-sm block">Ubicación del mapa</span>
              <span className="text-xs text-slate-500">El GPS se solicita al usar “Cerca de mí” y no se guarda en tu perfil</span>
            </div>
          </div>

          {onChangePassword && <button type="button" onClick={onChangePassword}
            className="p-4 flex items-center justify-between hover:bg-slate-50 transition cursor-pointer">
            <span className="font-bold text-slate-800 text-sm block">Cambiar contraseña</span>
          </button>}

          <button 
            onClick={onSignOut}
            className="w-full p-4 flex items-center justify-between text-red-600 hover:bg-red-50 transition cursor-pointer font-bold text-sm"
          >
            <span className="flex items-center gap-2">
              <LogOut className="w-4 h-4" />
              Cerrar sesión
            </span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
