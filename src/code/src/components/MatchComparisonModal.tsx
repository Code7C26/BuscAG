/**
 * MODAL DE COMPARACIÓN LADO A LADO DE COINCIDENCIAS (MatchComparisonModal.tsx)
 * Permite examinar minuciosamente un objeto perdido contra un objeto encontrado
 * para verificar si se trata del mismo artículo antes de coordinar la entrega.
 */

import React from 'react';
import { X, Sparkles, MapPin, Clock, Tag, MessageSquare, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck, ExternalLink } from 'lucide-react';
import { MatchResult, Item, User } from '../types';
import { formatTimeAgo } from '../utils/geo';

interface MatchComparisonModalProps {
  match: MatchResult | null;
  isOpen: boolean;
  onClose: () => void;
  onContact: (item: Item) => void;
  onViewItemDetail: (item: Item) => void;
  currentUser: User;
}

export const MatchComparisonModal: React.FC<MatchComparisonModalProps> = ({
  match,
  isOpen,
  onClose,
  onContact,
  onViewItemDetail,
  currentUser
}) => {
  if (!isOpen || !match) return null;

  const { lostItem, foundItem, score, confidence, reasons, distanceKm, matchedKeywords } = match;

  // Determinar color e insignias según el nivel de confianza
  const getConfidenceBadge = () => {
    if (confidence === 'muy_alta') {
      return {
        bg: 'bg-emerald-500 text-white',
        border: 'border-emerald-400',
        label: 'Coincidencia Muy Alta',
        scoreColor: 'text-emerald-600 bg-emerald-50 border-emerald-200'
      };
    }
    if (confidence === 'alta') {
      return {
        bg: 'bg-blue-600 text-white',
        border: 'border-blue-400',
        label: 'Coincidencia Alta',
        scoreColor: 'text-blue-600 bg-blue-50 border-blue-200'
      };
    }
    return {
      bg: 'bg-amber-500 text-white',
      border: 'border-amber-400',
      label: 'Coincidencia Posible',
      scoreColor: 'text-amber-600 bg-amber-50 border-amber-200'
    };
  };

  const badgeInfo = getConfidenceBadge();

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        
        {/* Cabecera del Modal */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
              <Sparkles className="w-5 h-5 text-amber-300 fill-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-extrabold text-slate-900 text-base sm:text-lg">
                  Comparación de Coincidencia
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${badgeInfo.bg}`}>
                  {score}% Match
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Sistema de comparación automática por categoría, geolocalización y similitud
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-full transition cursor-pointer"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido desplazable */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          
          {/* Barra de métricas de afinidad */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                Nivel de Probabilidad de Match
              </span>
              <span className="text-xs font-extrabold text-slate-900">
                {score}% - {badgeInfo.label}
              </span>
            </div>

            {/* Barra de progreso visual */}
            <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  score >= 75 ? 'bg-emerald-500' : score >= 55 ? 'bg-blue-600' : 'bg-amber-500'
                }`}
                style={{ width: `${score}%` }}
              />
            </div>

            {/* Razones calculadas por el algoritmo */}
            <div className="mt-3.5 flex flex-wrap gap-1.5">
              {reasons.map((reason, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white text-slate-700 border border-slate-200 shadow-2xs"
                >
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                  {reason}
                </span>
              ))}
              {matchedKeywords.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
                  <Tag className="w-3 h-3 text-blue-600 shrink-0" />
                  Términos clave: {matchedKeywords.join(', ')}
                </span>
              )}
            </div>
          </div>

          {/* Comparación Lado a Lado (Side by Side) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
            
            {/* Indicador conector central para pantallas medianas/grandes */}
            <div className="hidden md:flex absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-blue-600 text-white items-center justify-center shadow-lg border-2 border-white">
              <ArrowRight className="w-4 h-4" />
            </div>

            {/* Columna Izquierda: Objeto Perdido */}
            <div className="bg-red-50/40 rounded-2xl border-2 border-red-200 p-4 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-red-600 text-white shadow-xs">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Objeto Perdido
                  </span>
                  <button
                    onClick={() => onViewItemDetail(lostItem)}
                    className="text-xs text-red-700 hover:text-red-900 font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    Ver ficha <ExternalLink className="w-3 h-3" />
                  </button>
                </div>

                <div className="aspect-16/10 rounded-xl overflow-hidden bg-slate-100 border border-red-100 relative">
                  <img
                    src={lostItem.imageUrl}
                    alt={lostItem.title}
                    className="w-full h-full object-cover"
                  />
                  {lostItem.reward && (
                    <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500 text-white shadow-xs">
                      🎁 {lostItem.reward}
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="font-extrabold text-slate-900 text-base leading-snug">
                    {lostItem.title}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed line-clamp-3">
                    {lostItem.description}
                  </p>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-red-100 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    <span className="font-semibold text-slate-800">{lostItem.category}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    <span className="truncate">{lostItem.locationName}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    <span>Perdido: {formatTimeAgo(lostItem.date)}</span>
                  </div>
                </div>
              </div>

              {/* Publicador */}
              <div className="pt-3 border-t border-red-100 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <img
                    src={lostItem.user.avatar}
                    alt={lostItem.user.name}
                    className="w-7 h-7 rounded-full object-cover border border-red-200"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{lostItem.user.name}</p>
                    <p className="text-[10px] text-slate-500 truncate">Dueño que busca</p>
                  </div>
                </div>

                <button
                  onClick={() => onContact(lostItem)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition cursor-pointer inline-flex items-center gap-1 shadow-xs"
                >
                  <MessageSquare className="w-3 h-3" />
                  Contactar
                </button>
              </div>
            </div>

            {/* Columna Derecha: Objeto Encontrado */}
            <div className="bg-emerald-50/40 rounded-2xl border-2 border-emerald-200 p-4 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-600 text-white shadow-xs">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Objeto Encontrado
                  </span>
                  <button
                    onClick={() => onViewItemDetail(foundItem)}
                    className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    Ver ficha <ExternalLink className="w-3 h-3" />
                  </button>
                </div>

                <div className="aspect-16/10 rounded-xl overflow-hidden bg-slate-100 border border-emerald-100 relative">
                  <img
                    src={foundItem.imageUrl}
                    alt={foundItem.title}
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-700 text-white shadow-xs">
                    En custodia
                  </span>
                </div>

                <div>
                  <h3 className="font-extrabold text-slate-900 text-base leading-snug">
                    {foundItem.title}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed line-clamp-3">
                    {foundItem.description}
                  </p>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-emerald-100 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="font-semibold text-slate-800">{foundItem.category}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">{foundItem.locationName}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Hallado: {formatTimeAgo(foundItem.date)}</span>
                  </div>
                </div>
              </div>

              {/* Publicador */}
              <div className="pt-3 border-t border-emerald-100 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <img
                    src={foundItem.user.avatar}
                    alt={foundItem.user.name}
                    className="w-7 h-7 rounded-full object-cover border border-emerald-200"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{foundItem.user.name}</p>
                    <p className="text-[10px] text-slate-500 truncate">Quien lo encontró</p>
                  </div>
                </div>

                <button
                  onClick={() => onContact(foundItem)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition cursor-pointer inline-flex items-center gap-1 shadow-xs"
                >
                  <MessageSquare className="w-3 h-3" />
                  Contactar
                </button>
              </div>
            </div>

          </div>

          {/* Resumen de compatibilidad geográfica */}
          <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200/80 flex items-center justify-between text-xs text-blue-800">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                Distancia entre los dos puntos de reporte: <strong>{distanceKm < 1 ? `${(distanceKm * 1000).toFixed(0)} metros` : `${distanceKm.toFixed(1)} km`}</strong>.
              </span>
            </div>
            <span className="font-semibold text-[11px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md">
              Zona compatible
            </span>
          </div>

        </div>

        {/* Pie del modal con acciones */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2.5 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/70 transition cursor-pointer"
          >
            Cerrar
          </button>
          <button
            onClick={() => {
              // Si el usuario es dueño del objeto perdido, contacta a quien lo encontró, o viceversa
              if (currentUser.id === lostItem.user.id) {
                onContact(foundItem);
              } else {
                onContact(lostItem);
              }
              onClose();
            }}
            className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-blue-600 hover:bg-blue-700 text-white transition cursor-pointer shadow-md shadow-blue-600/20 flex items-center gap-1.5"
          >
            <MessageSquare className="w-4 h-4" />
            Iniciar Conversación de Reconciliación
          </button>
        </div>

      </div>
    </div>
  );
};
