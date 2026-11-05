import {Avatar} from './Avatar';
import { formatItemDate } from '../utils/itemDate';
import { useDialogFocus } from '../utils/useDialogFocus';
/**
 * MODAL DE DETALLE DE PUBLICACIÓN (ItemDetailModal.tsx)
 * Muestra la información completa de un objeto seleccionado:
 * - Fotografía en alta resolución con insignia de estado (Perdido / Encontrado / Recuperado)
 * - Título, descripción detallada, categoría y recompensa si aplica
 * - Mini-mapa interactivo Leaflet con la ubicación exacta donde ocurrió el hallazgo o pérdida
 * - Perfil del usuario publicador con insignia de verificación y calificación
 * - Acciones contextuales: Si es el dueño, permite marcarlo como "Recuperado" o eliminarlo.
 *   Si es otro usuario, permite abrir el flujo de contacto directo.
 */
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { X, MapPin, Clock, Tag, ShieldCheck, MessageCircle, Phone, Share2, CheckCircle2, AlertCircle, Trash2, PartyPopper, Sparkles, ChevronRight } from 'lucide-react';
import L from 'leaflet';
import { Item, User, MatchResult } from '../types';
import { formatTimeAgo, isValidCoordinates } from '../utils/geo';
import { findMatchesForSingleItem } from '../utils/matcher';

// Propiedades que recibe el modal de detalle
interface ItemDetailModalProps {
  item: Item | null;                             // Objeto a detallar (null si el modal está cerrado)
  onClose: () => void;                           // Cierra este modal
  onContact: (item: Item) => void;               // Inicia el contacto con el publicador
  onEditItem?: (item: Item) => void;
  onViewProfile?: (user:User)=>void;
  currentUser: User;                             // Usuario que está utilizando la app actualmente
  onMarkAsRecovered?: (itemId: string) => Promise<boolean>;  // Cambia el estado a 'recuperado'
  onDeleteItem?: (itemId: string) => Promise<boolean>;       // Elimina la publicación de la lista
  allItems?: Item[];                             // Catálogo completo de publicaciones para calcular matches
  onOpenMatchComparison?: (match: MatchResult) => void; // Abre la vista de comparación lado a lado
}

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({
  item,
  onClose,
  onContact,
  currentUser,
  onEditItem,
  onViewProfile,
  onMarkAsRecovered,
  onDeleteItem,
  allItems = [],
  onOpenMatchComparison
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(Boolean(item), dialogRef, onClose);

  // Referencias para el mini-mapa dentro del modal
  const miniMapRef = useRef<HTMLDivElement>(null);
  const leafletMiniMapRef = useRef<L.Map | null>(null);

  // Estado para mostrar un banner de celebración festiva al recuperar el objeto
  const [showRecoveredConfetti, setShowRecoveredConfetti] = useState(false);
  const recovering = useRef(false);
  const recoveryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestItem = useRef(item?.id);
  latestItem.current = item?.id;
  useEffect(() => {
    recovering.current = false;
    latestItem.current = item?.id;
    setShowRecoveredConfetti(false);
    return () => { latestItem.current = undefined; if (recoveryTimer.current) clearTimeout(recoveryTimer.current); };
  }, [item?.id]);

  // Verificaciones de permisos y estado del objeto
  const isOwner = Boolean(item && currentUser.id === item.user.id);
  const isLost = item?.status === 'perdido';
  const isRecovered = item?.status === 'recuperado';

  // Calcula automáticamente las coincidencias para este objeto específico
  const suggestedMatches = useMemo(() => {
    if (!item || !allItems.length || item.status === 'recuperado') return [];
    return findMatchesForSingleItem(item, allItems);
  }, [item, allItems]);

  /**
   * EFECTO: Inicializa el mini-mapa Leaflet enfocado exactamente en la lat/lng del objeto
   */
  useEffect(() => {
    if (!item || !isValidCoordinates(item.lat, item.lng) || !miniMapRef.current || leafletMiniMapRef.current) return;

    // Instanciamos el mapa centrado en el objeto
    const map = L.map(miniMapRef.current, {
      center: [item.lat, item.lng],
      zoom: 15,
      zoomControl: false,
      scrollWheelZoom: false,
      dragging: true
    });

    // Mosaicos de OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 }).addTo(map);

    // Color del marcador según estado (Rojo: Perdido, Verde: Encontrado / Recuperado)
    const pinColor = isLost ? '#9c3427' : isRecovered ? '#031926' : '#315e65';
    const icon = L.divIcon({
      html: `
        <div style="
          width: 32px; 
          height: 32px; 
          border-radius: 50%; 
          background: ${pinColor}; 
          border: 3px solid white; 
          box-shadow: 0 4px 10px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
        ">📍</div>
      `,
      className: 'mini-map-pin',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    // Añade el marcador fijo en la coordenada del objeto
    L.marker([item.lat, item.lng], { icon, interactive: false, keyboard: false, title: 'Ubicación de la publicación' }).addTo(map);
    leafletMiniMapRef.current = map;

    // Recalcula dimensiones para evitar desfasajes en modales
    const invalidateTimer = window.setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      window.clearTimeout(invalidateTimer);
      map.remove();
      if (leafletMiniMapRef.current === map) leafletMiniMapRef.current = null;
    };
  }, [item]);

  // Si no hay ningún objeto seleccionado, no renderizamos el modal
  if (!item) return null;

  /**
   * Manejador para marcar el objeto como recuperado con animación de celebración
   */
  const handleMarkRecovered = async () => {
    if (!onMarkAsRecovered || recovering.current) return;
    recovering.current = true; const id = item.id;
    try {
      const saved = await onMarkAsRecovered(id);
      if (saved && latestItem.current === id) {
        setShowRecoveredConfetti(true);
        recoveryTimer.current = setTimeout(() => setShowRecoveredConfetti(false),3000);
      }
    } finally { if (latestItem.current === id) recovering.current = false; }
  };

  return (
    <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Detalle de publicación" tabIndex={-1} className="modal-dialog w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200 relative">
        
        {/* Banner animado de felicitaciones al recuperar el objeto */}
        {showRecoveredConfetti && (
          <div className="absolute top-0 inset-x-0 bg-emerald-600 text-white p-3 text-center z-30 font-extrabold text-sm flex items-center justify-center gap-2 animate-bounce shadow-lg">
            <PartyPopper className="w-5 h-5" />
            ¡Felicidades! Objeto marcado como RECUPERADO 🎉
          </div>
        )}

        {/* Imagen principal superior con botón de cierre e insignias de estado */}
        <div className="relative aspect-16/10 w-full bg-slate-900 overflow-hidden">
          <img
            src={item.imageUrl||undefined}
            alt={item.title||'Publicación sin título'}
            className="w-full h-full object-cover"
          />

          {/* Botón flotante para cerrar el modal */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-2 bg-slate-900/60 hover:bg-slate-900/80 text-white rounded-full backdrop-blur-md transition cursor-pointer"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Insignia de estado (Perdido, Recuperado o Encontrado) */}
          <div className="absolute bottom-3 left-3 flex gap-2">
            {isLost ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-red-600 text-white shadow-lg">
                <AlertCircle className="w-4 h-4" />
                Objeto Perdido
              </span>
            ) : isRecovered ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-600 text-white shadow-lg">
                <CheckCircle2 className="w-4 h-4" />
                Objeto Recuperado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-green-600 text-white shadow-lg">
                <CheckCircle2 className="w-4 h-4" />
                {item.status==='encontrado'?'Objeto Encontrado':'Estado sin informar'}
              </span>
            )}

            {/* Insignia de categoría */}
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-900/80 text-white backdrop-blur-md">
              <Tag className="w-3.5 h-3.5" />
              {item.category||'Categoría sin informar'}
            </span>
          </div>
        </div>

        {/* Cuerpo del modal con información detallada */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Título y Recompensa */}
          <div>
            <h2 className="font-extrabold text-slate-900 text-xl sm:text-2xl leading-tight">
              {item.title||'Publicación sin título'}
            </h2>

            {item.reward && isLost && (
              <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-bold">
                🎁 {item.reward}
              </div>
            )}
          </div>

          {/* Descripción */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Descripción del Objeto
            </h4>
            <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line font-normal bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
              {item.description}
            </p>
          </div>

          {/* Datos de Lugar y Fecha */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-blue-50/60 rounded-2xl border border-blue-100 flex items-start gap-2.5">
              <MapPin className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="text-[11px] font-bold text-blue-700 block uppercase">Lugar</span>
                <span className="text-xs font-semibold text-slate-800 block">{item.locationName}</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-start gap-2.5">
              <Clock className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
              <div>
                <span className="text-[11px] font-bold text-slate-500 block uppercase">Fecha de reporte</span>
                <span className="text-xs font-semibold text-slate-800 block">
                  {formatTimeAgo(item.date)} ({formatItemDate(item.date)})
                </span>
              </div>
            </div>
          </div>

          {/* Mini Mapa de Localización */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>📍 Mapa de Ubicación</span>
              <span className="text-[11px] text-blue-600 lowercase font-medium">Ubicación aproximada</span>
            </h4>
            <div className="h-44 rounded-2xl overflow-hidden border border-slate-200 shadow-inner relative">
              <div ref={miniMapRef} className="w-full h-full z-0" />
            </div>
          </div>

          {/* SECCIÓN DE COINCIDENCIAS SUGERIDAS AUTOMÁTICAMENTE */}
          {suggestedMatches.length > 0 && (
            <div className="rounded-2xl border-2 border-blue-200 bg-linear-to-b from-blue-50/70 to-white p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
                    <Sparkles className="w-4 h-4 text-amber-300 fill-amber-300" />
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      Coincidencias Automáticas Sugeridas
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-600 text-white font-bold">
                        {suggestedMatches.length}
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {isLost ? 'Objetos encontrados de la misma categoría compatibles' : 'Reportes de pérdida de la misma categoría compatibles'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {suggestedMatches.slice(0, 3).map((match) => {
                  const counterpart = isLost ? match.foundItem : match.lostItem;
                  return (
                    <div
                      key={match.id}
                      className="bg-white rounded-xl p-2.5 sm:p-3 border border-slate-200/90 shadow-2xs flex items-center justify-between gap-3 hover:border-blue-400 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={counterpart.imageUrl}
                          alt={counterpart.title}
                          className="w-11 h-11 sm:w-12 sm:h-12 rounded-lg object-cover shrink-0 border border-slate-200"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`px-2 py-0.2 rounded-full text-[10px] font-extrabold ${
                              match.score >= 75 ? 'bg-emerald-500 text-white' : 'bg-blue-600 text-white'
                            }`}>
                              {match.score}% Match
                            </span>
                            <span className="text-[10px] font-semibold text-slate-500">
                              {counterpart.status === 'encontrado' ? '🟢 Encontrado' : '🔴 Perdido'}
                            </span>
                          </div>
                          <p className="font-bold text-slate-900 text-xs truncate mt-0.5">
                            {counterpart.title}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-blue-600 shrink-0" />
                            {counterpart.locationName} ({match.distanceKm < 1 ? `${(match.distanceKm * 1000).toFixed(0)}m` : `${match.distanceKm.toFixed(1)} km`})
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {onOpenMatchComparison && (
                          <button
                            onClick={() => onOpenMatchComparison(match)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 transition cursor-pointer flex items-center gap-1"
                          >
                            Comparar
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tarjeta del usuario que publicó el objeto */}
          <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar src={item.user.avatar} name={item.user.name} className="w-11 h-11 rounded-full object-cover border-2 border-white shadow-xs"/>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-900 text-sm">{item.user.name}</span>
                  {item.user.verified && (
                    <ShieldCheck className="w-4 h-4 text-blue-600" aria-label="Usuario verificado" />
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                  <span>⭐ {item.user.rating} calificación</span>
                  <span>•</span>
                  <span>{item.user.location}</span>
                </div>
                {onViewProfile&&item.user.id&&<button type="button" className="public-profile-link" onClick={()=>onViewProfile(item.user)}>Ver perfil público <ChevronRight size={14}/></button>}
              </div>
            </div>

            {/* Enlace de llamada rápida si el publicador configuró su teléfono */}
            {item.user.phone && !isOwner && (
              <a
                href={`tel:${item.user.phone}`}
                className="p-2.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-xl transition cursor-pointer"
                title="Llamar directamente por teléfono"
              >
                <Phone className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>

        {/* Barra inferior de acciones (depende de si es el dueño o no) */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center gap-2">
          {/* Si el usuario actual es el autor de la publicación */}
          {isOwner ? (
            <div className="w-full flex gap-2">
              {onEditItem && <button type="button" onClick={() => onEditItem(item)}
                className="item-card__more inline-flex items-center gap-1 px-3 py-1.5 text-xs transition cursor-pointer shrink-0">Editar</button>}
              {!isRecovered && (
                <button
                  onClick={handleMarkRecovered}
                  className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Marcar como Recuperado
                </button>
              )}

              {onDeleteItem && (
                <button
                  onClick={() => {
                    void onDeleteItem(item.id).then(deleted => {
                      if (deleted) onClose();
                    });
                  }}
                  className="px-4 py-3 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar
                </button>
              )}
            </div>
          ) : (
            /* Si es un visitante o persona que encontró/perdió el objeto */
            <button
              onClick={() => {
                onClose();
                onContact(item);
              }}
              className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-2xl font-extrabold text-sm sm:text-base shadow-lg shadow-blue-600/25 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <MessageCircle className="w-5 h-5 fill-current" />
              Contactar al Publicador
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
