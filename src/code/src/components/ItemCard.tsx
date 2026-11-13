import {categoryLabel} from "../i18n";
import {t, useLanguage} from "../i18n";
import {Avatar} from './Avatar';
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
import React,{useState} from 'react';
import { MapPin, Clock, Tag, ChevronRight, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';
import { Item } from '../types';
import { formatTimeAgo } from '../utils/geo';

// Propiedades que recibe el componente ItemCard
interface ItemCardProps {
  currentUserId?: string;
  item: Item;                        // Objeto con toda la información a mostrar
  onViewMore: (item: Item) => void;  // Callback para abrir el modal de detalle al tocar la tarjeta
}

export const ItemCard: React.FC<ItemCardProps> = ({ item, onViewMore, currentUserId }) => {
  useLanguage();
  // Banderas para simplificar la lógica condicional de colores y estados
  const [failedImage,setFailedImage]=useState<string|null>(null);
  const isLost = item.status === 'perdido';
  const isRecovered = item.status === 'recuperado';

  return (
    <div 
      onClick={() => onViewMore(item)}
      role="button" tabIndex={0}
      onKeyDown={event => {
        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault(); onViewMore(item);
        }
      }}
      className="item-card overflow-hidden border flex flex-col group cursor-pointer"
    >
      {/* Contenedor de la Imagen con relación de aspecto 4:3 */}
      <div className="item-card__image relative aspect-4/3 w-full overflow-hidden">
        {item.imageUrl&&failedImage!==item.imageUrl?(<img
          src={item.imageUrl||undefined}
          alt={item.title||t("Publicación sin título")}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy" onError={()=>setFailedImage(item.imageUrl)}
        />): <div className="image-placeholder"><Tag size={36} aria-hidden="true"/><span>{t("Foto no disponible")}</span></div>}

        {/* Insignias de Estado superiores: 🔴 Perdido / 🟢 Encontrado / 🟢 Recuperado */}
        <div className="absolute top-3 left-3 flex gap-2 flex-wrap">
          {isLost ? (
            <span className="status-pill status-pill--lost inline-flex items-center text-white">
              <AlertCircle className="w-3.5 h-3.5" />{t("Perdido")}</span>
          ) : isRecovered ? (
            <span className="status-pill status-pill--recovered inline-flex items-center text-white">
              <CheckCircle2 className="w-3.5 h-3.5" />{t("Recuperado")}</span>
          ) : (
            <span className="status-pill status-pill--found inline-flex items-center text-white">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {item.status==='encontrado'?t("Encontrado"):t("Estado sin informar")}
            </span>
          )}

          {/* Etiqueta de recompensa si el usuario ofreció una */}
          {item.reward && isLost && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-600/90 text-white shadow-sm backdrop-blur-sm">
              🎁 {item.reward}
            </span>
          )}
        </div>

        {/* Píldora de Categoría en la esquina superior derecha */}
        <div className="absolute top-3 right-3">
          <span className="item-card__category inline-flex items-center gap-1 px-2.5 py-1 text-[11px] text-white">
            <Tag className="w-3 h-3" />
            {categoryLabel(item.category)||t("Categoría sin informar")}
          </span>
        </div>
      </div>

      {/* Cuerpo de la tarjeta con título, descripción y metadatos */}
      <div className="item-card__content flex-1 flex flex-col justify-between gap-3">
        <div>
          {currentUserId && <p className="text-xs font-semibold">{item.user.id === currentUserId ? t("Tu publicación") : t("Publicación de otra persona")}</p>}
          {/* Nombre / Título del objeto */}
          <h3 className="item-card__title text-base leading-snug line-clamp-1 group-hover:text-blue-700 transition-colors">
            {item.title||t("Publicación sin título")}
          </h3>

          {/* Fragmento de la descripción (truncado a 2 líneas para mantener uniformidad) */}
          <p className="item-card__description mt-1 line-clamp-2 leading-relaxed">
            {item.description}
          </p>

          {/* Información de Ubicación y Tiempo transcurrido */}
          <div className="mt-3 space-y-1.5 text-xs text-slate-500">
            {/* Ubicación y distancia calculada en kilómetros */}
            <div className="flex items-center gap-1.5 text-slate-700 font-medium">
              <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="truncate">{item.locationName}</span>
              {item.distanceKm !== undefined && (
                <span className="ml-auto text-[11px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded"> {t("a")} {item.distanceKm} km
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
        <div className="item-card__footer pt-3 border-t flex items-center justify-between gap-2">
          {/* Datos del usuario publicador */}
          <div className="flex items-center gap-2 min-w-0">
            <Avatar src={item.user.avatar} name={item.user.name} className="w-7 h-7 rounded-full object-cover shrink-0 border border-slate-200"/>
            <div className="min-w-0">
              <span className="text-xs font-semibold text-slate-800 truncate block leading-tight flex items-center gap-1">
                {item.user.name}
                {item.user.verified && (
                  <ShieldCheck className="w-3 h-3 text-blue-500 inline shrink-0" aria-label={t("Usuario verificado")} />
                )}
              </span>
              <span className="text-[10px] text-slate-500 block leading-tight">
                {item.user.ratingCount ? `⭐ ${item.user.rating}/5` : t("Sin valoraciones")}
              </span>
            </div>
          </div>

          {/* Botón de acción 'Ver más' */}
          <span aria-hidden="true" className="item-card__more inline-flex items-center gap-1 px-3 py-1.5 text-xs transition shrink-0"> {t("Ver más")} <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </div>
  );
};
