import React, { useEffect, useRef, useState } from 'react';
import { X, MapPin, Clock, Tag, ShieldCheck, MessageCircle, Phone, Share2, CheckCircle2, AlertCircle, Trash2, PartyPopper } from 'lucide-react';
import L from 'leaflet';
import { Item, User } from '../types';
import { formatTimeAgo } from '../utils/geo';

interface ItemDetailModalProps {
  item: Item | null;
  onClose: () => void;
  onContact: (item: Item) => void;
  currentUser: User;
  onMarkAsRecovered?: (itemId: string) => void;
  onDeleteItem?: (itemId: string) => void;
}

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({
  item,
  onClose,
  onContact,
  currentUser,
  onMarkAsRecovered,
  onDeleteItem
}) => {
  if (!item) return null;

  const miniMapRef = useRef<HTMLDivElement>(null);
  const leafletMiniMapRef = useRef<L.Map | null>(null);
  const [showRecoveredConfetti, setShowRecoveredConfetti] = useState(false);

  const isOwner = currentUser.id === item.user.id;
  const isLost = item.status === 'perdido';
  const isRecovered = item.status === 'recuperado';

  // Initialize mini map
  useEffect(() => {
    if (!miniMapRef.current || leafletMiniMapRef.current) return;

    const map = L.map(miniMapRef.current, {
      center: [item.lat, item.lng],
      zoom: 15,
      zoomControl: false,
      scrollWheelZoom: false,
      dragging: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    const pinColor = isLost ? '#DC2626' : isRecovered ? '#059669' : '#16A34A';
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

    L.marker([item.lat, item.lng], { icon }).addTo(map);
    leafletMiniMapRef.current = map;

    setTimeout(() => {
      map.invalidateSize();
    }, 200);
  }, [item]);

  // Mark as recovered handler
  const handleMarkRecovered = () => {
    setShowRecoveredConfetti(true);
    if (onMarkAsRecovered) {
      onMarkAsRecovered(item.id);
    }
    setTimeout(() => {
      setShowRecoveredConfetti(false);
    }, 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200 relative">
        
        {/* Confetti celebration banner when recovered */}
        {showRecoveredConfetti && (
          <div className="absolute top-0 inset-x-0 bg-emerald-600 text-white p-3 text-center z-30 font-extrabold text-sm flex items-center justify-center gap-2 animate-bounce shadow-lg">
            <PartyPopper className="w-5 h-5" />
            ¡Felicidades! Objeto marcado como RECUPERADO 🎉
          </div>
        )}

        {/* Top Image Banner */}
        <div className="relative aspect-16/10 w-full bg-slate-900 overflow-hidden">
          <img
            src={item.imageUrl}
            alt={item.title}
            className="w-full h-full object-cover"
          />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-2 bg-slate-900/60 hover:bg-slate-900/80 text-white rounded-full backdrop-blur-md transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Status Badge */}
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
                Objeto Encontrado
              </span>
            )}

            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-900/80 text-white backdrop-blur-md">
              <Tag className="w-3.5 h-3.5" />
              {item.category}
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Title & Reward */}
          <div>
            <h2 className="font-extrabold text-slate-900 text-xl sm:text-2xl leading-tight">
              {item.title}
            </h2>

            {item.reward && isLost && (
              <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-bold">
                🎁 {item.reward}
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Descripción del Objeto
            </h4>
            <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line font-normal bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
              {item.description}
            </p>
          </div>

          {/* Location & Time details */}
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
                  {formatTimeAgo(item.date)} ({new Date(item.date).toLocaleDateString('es-ES')})
                </span>
              </div>
            </div>
          </div>

          {/* Mini Interactive Map */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>📍 Mapa de Ubicación</span>
              <span className="text-[11px] text-blue-600 lowercase font-medium">Ubicación aproximada</span>
            </h4>
            <div className="h-44 rounded-2xl overflow-hidden border border-slate-200 shadow-inner relative">
              <div ref={miniMapRef} className="w-full h-full z-0" />
            </div>
          </div>

          {/* Publisher Profile Info */}
          <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <img
                src={item.user.avatar}
                alt={item.user.name}
                className="w-11 h-11 rounded-full object-cover border-2 border-white shadow-xs"
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-900 text-sm">{item.user.name}</span>
                  {item.user.verified && (
                    <ShieldCheck className="w-4 h-4 text-blue-600" title="Usuario Verificado" />
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                  <span>⭐ {item.user.rating} calificación</span>
                  <span>•</span>
                  <span>{item.user.location}</span>
                </div>
              </div>
            </div>

            {/* Quick Phone Call Link */}
            {item.user.phone && !isOwner && (
              <a
                href={`tel:${item.user.phone}`}
                className="p-2.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-xl transition cursor-pointer"
                title="Llamar directamente"
              >
                <Phone className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center gap-2">
          {/* If owner: show Mark Recovered or Delete */}
          {isOwner ? (
            <div className="w-full flex gap-2">
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
                    if (confirm('¿Estás seguro de eliminar esta publicación?')) {
                      onDeleteItem(item.id);
                      onClose();
                    }
                  }}
                  className="px-4 py-3 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar
                </button>
              )}
            </div>
          ) : (
            /* Otherwise: Contact / Send Message Button */
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
