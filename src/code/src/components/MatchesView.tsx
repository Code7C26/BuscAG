/**
 * PANTALLA PRINCIPAL DE MATCHES Y COINCIDENCIAS AUTOMÁTICAS (MatchesView.tsx)
 * Permite explorar todas las sugerencias de coincidencias generadas por el algoritmo.
 * Compara publicaciones de objetos perdidos con encontrados de la misma categoría,
 * analizando similitud de títulos, descripciones, cercanía geográfica y fechas.
 */

import React, { useState, useMemo } from 'react';
import { Sparkles, ArrowRight, MapPin, Tag, Clock, MessageSquare, ExternalLink, Filter, CheckCircle2, AlertCircle, ShieldAlert, ChevronRight } from 'lucide-react';
import { MatchResult, Category, User, Item } from '../types';
import { formatTimeAgo } from '../utils/geo';

interface MatchesViewProps {
  matches: MatchResult[];
  onSelectMatch: (match: MatchResult) => void;
  onContactItem: (item: Item) => void;
  onViewItemDetail: (item: Item) => void;
  currentUser: User;
}

export const MatchesView: React.FC<MatchesViewProps> = ({
  matches,
  onSelectMatch,
  onContactItem,
  onViewItemDetail,
  currentUser
}) => {
  // Filtro por categoría
  const [selectedCategory, setSelectedCategory] = useState<Category | 'Todos'>('Todos');
  // Filtro por pertenencia (todas vs solo las que involucran a currentUser)
  const [filterScope, setFilterScope] = useState<'all' | 'mine'>('all');
  // Filtro por nivel de confianza
  const [confidenceFilter, setConfidenceFilter] = useState<'all' | 'high'>('all');

  // Categorías presentes en los matches para los chips
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

  // Filtramos la lista de matches según los controles
  const filteredMatches = useMemo(() => {
    return matches.filter(m => {
      // Filtro por categoría
      if (selectedCategory !== 'Todos' && m.lostItem.category !== selectedCategory) {
        return false;
      }
      // Filtro por confianza alta
      if (confidenceFilter === 'high' && m.score < 75) {
        return false;
      }
      // Filtro por mis publicaciones
      if (filterScope === 'mine') {
        const isMyLost = m.lostItem.user.id === currentUser.id;
        const isMyFound = m.foundItem.user.id === currentUser.id;
        if (!isMyLost && !isMyFound) return false;
      }
      return true;
    });
  }, [matches, selectedCategory, confidenceFilter, filterScope, currentUser.id]);

  // Métricas rápidas
  const highConfidenceCount = matches.filter(m => m.score >= 75).length;
  const myMatchesCount = matches.filter(
    m => m.lostItem.user.id === currentUser.id || m.foundItem.user.id === currentUser.id
  ).length;

  return (
    <div className="px-4 py-5 space-y-5">
      
      {/* Banner Informativo del Sistema de Match Automático */}
      <div className="bg-linear-to-r from-blue-700 via-indigo-700 to-blue-800 rounded-3xl p-5 sm:p-6 text-white shadow-xl relative overflow-hidden">
        {/* Decoración de fondo */}
        <div className="absolute top-0 right-0 -mt-6 -mr-6 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-8 w-32 h-32 bg-amber-400/15 rounded-full blur-xl pointer-events-none" />

        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-extrabold border border-white/20 text-amber-300">
            <Sparkles className="w-3.5 h-3.5 fill-current" />
            Sistema Inteligente de Coincidencias
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Sugerencias Automáticas de Match
            </h1>
            <p className="text-xs sm:text-sm text-blue-100 max-w-2xl mt-1 leading-relaxed">
              El motor compara automáticamente publicaciones de <strong>objetos perdidos</strong> con <strong>objetos encontrados</strong> que comparten la misma categoría, calculando la cercanía geográfica, compatibilidad de fechas y coincidencia de términos.
            </p>
          </div>

          {/* Estadísticas clave */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 pt-2">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-2.5 sm:p-3 border border-white/10 text-center">
              <span className="block text-lg sm:text-2xl font-black text-white">{matches.length}</span>
              <span className="text-[10px] sm:text-xs text-blue-200 font-medium">Matches Totales</span>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-2.5 sm:p-3 border border-white/10 text-center">
              <span className="block text-lg sm:text-2xl font-black text-emerald-300">{highConfidenceCount}</span>
              <span className="text-[10px] sm:text-xs text-blue-200 font-medium">Probabilidad Alta</span>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-2.5 sm:p-3 border border-white/10 text-center">
              <span className="block text-lg sm:text-2xl font-black text-amber-300">{myMatchesCount}</span>
              <span className="text-[10px] sm:text-xs text-blue-200 font-medium">En tus Reportes</span>
            </div>
          </div>
        </div>
      </div>

      {/* Controles y Filtros */}
      <div className="space-y-3">
        {/* Toggle de ámbito: Todos vs Mis reportes */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterScope('all')}
            className={`flex-1 py-2 rounded-2xl text-xs font-bold transition cursor-pointer border ${
              filterScope === 'all'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Todas las coincidencias ({matches.length})
          </button>
          <button
            onClick={() => setFilterScope('mine')}
            className={`flex-1 py-2 rounded-2xl text-xs font-bold transition cursor-pointer border flex items-center justify-center gap-1.5 ${
              filterScope === 'mine'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400 fill-current" />
            Mis publicaciones ({myMatchesCount})
          </button>
          <button
            onClick={() => setConfidenceFilter(prev => prev === 'all' ? 'high' : 'all')}
            className={`px-3 py-2 rounded-2xl text-xs font-bold transition cursor-pointer border flex items-center gap-1 shrink-0 ${
              confidenceFilter === 'high'
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
            title="Filtrar solo coincidencias muy altas (>75%)"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Alta {'>'} 75%
          </button>
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
      </div>

      {/* Lista de Tarjetas de Coincidencia */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-extrabold text-slate-900 text-base flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-blue-600" />
            Coincidencias Sugeridas
          </h2>
          <span className="text-xs text-slate-500 font-medium">
            {filteredMatches.length} pares sugeridos
          </span>
        </div>

        {filteredMatches.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-3">
            <ShieldAlert className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-700 text-base">No hay coincidencias con este filtro</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Prueba seleccionando otra categoría o cambiando a "Todas las coincidencias". A medida que la comunidad publica más objetos, el sistema generará nuevos matches.
            </p>
          </div>
        ) : (
          filteredMatches.map((match) => {
            const { lostItem, foundItem, score, confidence, reasons, distanceKm } = match;
            const isUserInvolved = lostItem.user.id === currentUser.id || foundItem.user.id === currentUser.id;

            return (
              <div
                key={match.id}
                className="bg-white rounded-3xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden"
              >
                {/* Barra superior de compatibilidad */}
                <div className="px-4 py-3 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold ${
                        score >= 75
                          ? 'bg-emerald-500 text-white shadow-xs'
                          : score >= 55
                          ? 'bg-blue-600 text-white'
                          : 'bg-amber-500 text-white'
                      }`}
                    >
                      <Sparkles className="w-3 h-3 fill-current" />
                      {score}% Coincidencia
                    </span>

                    <span className="text-xs font-semibold text-slate-700 hidden sm:inline">
                      Categoría: {lostItem.category}
                    </span>

                    {isUserInvolved && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        Involucra tu reporte
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>A <strong>{distanceKm < 1 ? `${(distanceKm * 1000).toFixed(0)}m` : `${distanceKm.toFixed(1)} km`}</strong> de distancia</span>
                  </div>
                </div>

                {/* Cuerpo con los 2 objetos enfrentados */}
                <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Tarjeta Objeto Perdido */}
                  <div className="bg-red-50/30 rounded-2xl border border-red-100 p-3.5 flex gap-3.5">
                    <img
                      src={lostItem.imageUrl}
                      alt={lostItem.title}
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover shrink-0 border border-red-200"
                    />
                    <div className="min-w-0 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-red-600 text-white">
                            🔴 Perdido
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {formatTimeAgo(lostItem.date)}
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-900 text-sm leading-snug line-clamp-1">
                          {lostItem.title}
                        </h4>
                        <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                          {lostItem.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2">
                        <span className="truncate flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-red-500 shrink-0" />
                          {lostItem.locationName}
                        </span>
                        <span className="font-semibold text-slate-700 shrink-0">
                          {lostItem.user.name.split(' ')[0]}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Tarjeta Objeto Encontrado */}
                  <div className="bg-emerald-50/30 rounded-2xl border border-emerald-100 p-3.5 flex gap-3.5">
                    <img
                      src={foundItem.imageUrl}
                      alt={foundItem.title}
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover shrink-0 border border-emerald-200"
                    />
                    <div className="min-w-0 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-600 text-white">
                            🟢 Encontrado
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {formatTimeAgo(foundItem.date)}
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-900 text-sm leading-snug line-clamp-1">
                          {foundItem.title}
                        </h4>
                        <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                          {foundItem.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2">
                        <span className="truncate flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-emerald-500 shrink-0" />
                          {foundItem.locationName}
                        </span>
                        <span className="font-semibold text-slate-700 shrink-0">
                          {foundItem.user.name.split(' ')[0]}
                        </span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Razones de coincidencia */}
                <div className="px-4 sm:px-5 pb-3 flex flex-wrap gap-1.5">
                  {reasons.map((r, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-700"
                    >
                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                      {r}
                    </span>
                  ))}
                </div>

                {/* Pie con botones de acción */}
                <div className="px-4 sm:px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-xs text-slate-500 font-medium">
                    ¿Crees que es el mismo objeto?
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onSelectMatch(match)}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 transition cursor-pointer flex items-center gap-1"
                    >
                      Comparar lado a lado
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => {
                        // Contacta al autor del objeto contrario
                        if (currentUser.id === lostItem.user.id) {
                          onContactItem(foundItem);
                        } else {
                          onContactItem(lostItem);
                        }
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition cursor-pointer shadow-xs flex items-center gap-1"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Contactar
                    </button>
                  </div>
                </div>

              </div>
            );
          })
        )}

      </div>

    </div>
  );
};
