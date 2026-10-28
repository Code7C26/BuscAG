/**
 * TARJETA DE PUBLICACIÓN EN LA PANTALLA PRINCIPAL (ItemCard.tsx)
 * Representa visualmente cada objeto en el feed o cuadrícula de inicio.
 * Cumple con todos los requisitos del proyecto:
 * - 📷 Foto del objeto con zoom suave en hover
 * - 🔴/🟢 Insignia de estado (Perdido, Encontrado, Recuperado) y Recompensa si existe
 * - 📍 Lugar y distancia en kilómetros respecto al usuario
 * - 🕒 Fecha relativa formateada ("Hace X tiempo")
 * - 🏷️ Categoría destacada
 * - 👤 Usuario que publicó con avatar y verificación
 * - Botón interactivo "Ver más"
 */
import React from 'react';
import { MapPin, Clock, Tag, ChevronRight, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';
import { Item } from '../types';
import { formatTimeAgo } from '../utils/geo';

// Propiedades que recibe el componente ItemCard
interface ItemCardProps {
  item: Item;                        // Objeto con toda la información a mostrar
  onViewMore: (item: Item) => void;  // Callback para abrir el modal de detalle al tocar la tarjeta
}

export const ItemCard: React.FC<ItemCardProps> = ({ item, onViewMore }) => {
  // Banderas para simplificar la lógica condicional de colores y estados
  const isLost = item.status === 'perdido';
  const isRecovered = item.status === 'recuperado';

  return (
    <div 
      onClick={() => onViewMore(item)}
      className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs hover:shadow-md transition-all duration-200 flex flex-col group cursor-pointer"
    >
      {/* Contenedor de la Imagen con relación de aspecto 4:3 */}
      <div className="relative aspect-4/3 w-full bg-slate-100 overflow-hidden">
        <img
          src={item.imageUrl}
          alt={item.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />

        {/* Insignias de Estado superiores: 🔴 Perdido / 🟢 Encontrado / 🟢 Recuperado */}
        <div className="absolute top-3 left-3 flex gap-2 flex-wrap">
          {isLost ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-600 text-white shadow-md shadow-red-600/20">
              <AlertCircle className="w-3.5 h-3.5" />
              Perdido
            </span>
          ) : isRecovered ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-600 text-white shadow-md shadow-emerald-600/20">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Recuperado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-600 text-white shadow-md shadow-green-600/20">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Encontrado
            </span>
          )}

          {/* Etiqueta de recompensa si el usuario ofreció una */}
          {item.reward && isLost && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500 text-white shadow-sm">
              🎁 {item.reward}
            </span>
          )}
        </div>

        {/* Píldora de Categoría en la esquina superior derecha */}
        <div className="absolute top-3 right-3">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-900/75 backdrop-blur-md text-white">
            <Tag className="w-3 h-3" />
            {item.category}
          </span>
        </div>
      </div>

      {/* Cuerpo de la tarjeta con título, descripción y metadatos */}
      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
        <div>
          {/* Nombre / Título del objeto */}
          <h3 className="font-bold text-slate-900 text-base leading-snug line-clamp-1 group-hover:text-blue-600 transition-colors">
            {item.title}
          </h3>

          {/* Fragmento de la descripción (truncado a 2 líneas para mantener uniformidad) */}
          <p className="text-slate-600 text-xs mt-1 line-clamp-2 leading-relaxed">
            {item.description}
          </p>

          {/* Información de Ubicación y Tiempo transcurrido */}
          <div className="mt-3 space-y-1.5 text-xs text-slate-500">
            {/* Ubicación y distancia calculada en kilómetros */}
            <div className="flex items-center gap-1.5 text-slate-700 font-medium">
              <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="truncate">{item.locationName}</span>
              {item.distanceKm !== undefined && (
                <span className="ml-auto text-[11px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                  a {item.distanceKm} km
                </span>
              )}
            </div>

            {/* Fecha relativa (ej: 'Hace 15 min') */}
            <div className="flex items-center gap-1.5 text-slate-500">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>{formatTimeAgo(item.date)}</span>
            </div>
          </div>
        </div>

        {/* Pie de la tarjeta: Información del publicador y botón 'Ver más' */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
          {/* Datos del usuario publicador */}
          <div className="flex items-center gap-2 min-w-0">
            <img
              src={item.user.avatar}
              alt={item.user.name}
              className="w-7 h-7 rounded-full object-cover shrink-0 border border-slate-200"
            />
            <div className="min-w-0">
              <span className="text-xs font-semibold text-slate-800 truncate block leading-tight flex items-center gap-1">
                {item.user.name}
                {item.user.verified && (
                  <ShieldCheck className="w-3 h-3 text-blue-500 inline shrink-0" aria-label="Usuario verificado" />
                )}
              </span>
              <span className="text-[10px] text-slate-500 block leading-tight">
                ⭐ {item.user.rating}
              </span>
            </div>
          </div>

          {/* Botón de acción 'Ver más' */}
          <button
            onClick={(e) => {
              e.stopPropagation(); // Evita doble disparo con el contenedor padre
              onViewMore(item);
            }}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-600 hover:text-white transition cursor-pointer shrink-0"
          >
            Ver más
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
