import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, Upload, MapPin, Tag, Calendar, AlertCircle, CheckCircle2, Sparkles, Navigation } from 'lucide-react';
import L from 'leaflet';
import { Category, ItemStatus, Item, User } from '../types';
import { DEFAULT_CENTER } from '../utils/geo';

interface PublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (newItem: Omit<Item, 'id' | 'createdAt' | 'contactCount'>) => void;
  currentUser: User;
}

// Sample quick preset photos for testing rapid publication
const PRESET_PHOTOS = [
  { label: 'Mochila', url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop&q=80' },
  { label: 'Celular', url: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&auto=format&fit=crop&q=80' },
  { label: 'Llaves', url: 'https://images.unsplash.com/photo-1582139329536-e7284fece509?w=800&auto=format&fit=crop&q=80' },
  { label: 'Billetera', url: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=800&auto=format&fit=crop&q=80' },
  { label: 'Mascota', url: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=800&auto=format&fit=crop&q=80' },
  { label: 'Lentes', url: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=800&auto=format&fit=crop&q=80' }
];

export const PublishModal: React.FC<PublishModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  currentUser
}) => {
  if (!isOpen) return null;

  const [status, setStatus] = useState<ItemStatus>('encontrado');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('Electrónicos');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 16));
  const [locationName, setLocationName] = useState('Plaza Italia, Palermo');
  const [lat, setLat] = useState(DEFAULT_CENTER.lat);
  const [lng, setLng] = useState(DEFAULT_CENTER.lng);
  const [imageUrl, setImageUrl] = useState(PRESET_PHOTOS[0].url);
  const [reward, setReward] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mapPickerRef = useRef<HTMLDivElement>(null);
  const leafletPickerRef = useRef<L.Map | null>(null);
  const pickerMarkerRef = useRef<L.Marker | null>(null);

  const categories: Category[] = [
    'Electrónicos',
    'Documentos y Billeteras',
    'Mascotas',
    'Llaves',
    'Mochilas y Bolsos',
    'Indumentaria',
    'Otros'
  ];

  // Initialize interactive location picker map inside modal
  useEffect(() => {
    if (!mapPickerRef.current || leafletPickerRef.current) return;

    const map = L.map(mapPickerRef.current, {
      center: [lat, lng],
      zoom: 14,
      zoomControl: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
    pickerMarkerRef.current = marker;

    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      setLat(pos.lat);
      setLng(pos.lng);
      setLocationName(`Ubicación seleccionada (${pos.lat.toFixed(3)}, ${pos.lng.toFixed(3)})`);
    });

    map.on('click', (e) => {
      marker.setLatLng(e.latlng);
      setLat(e.latlng.lat);
      setLng(e.latlng.lng);
      setLocationName(`Ubicación marcada en mapa`);
    });

    leafletPickerRef.current = map;

    setTimeout(() => {
      map.invalidateSize();
    }, 200);
  }, []);

  // Handle Custom File Upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Use GPS Location
  const handleUseGPS = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const newLat = pos.coords.latitude;
          const newLng = pos.coords.longitude;
          setLat(newLat);
          setLng(newLng);
          setLocationName('Mi ubicación actual (GPS)');
          leafletPickerRef.current?.setView([newLat, newLng], 15);
          pickerMarkerRef.current?.setLatLng([newLat, newLng]);
        },
        () => {
          alert('No se pudo acceder a la geolocalización. Selecciona la ubicación en el mapa.');
        }
      );
    }
  };

  // Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      alert('Por favor completa el título y la descripción.');
      return;
    }

    setIsSubmitting(true);

    setTimeout(() => {
      onSubmit({
        title,
        description,
        category,
        status,
        locationName,
        lat,
        lng,
        date,
        imageUrl,
        user: currentUser,
        reward: reward.trim() ? reward : undefined
      });
      setIsSubmitting(false);
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="font-extrabold text-slate-900 text-lg leading-tight flex items-center gap-2">
              ➕ Publicar Objeto
            </h2>
            <p className="text-xs text-slate-500">Publica en menos de 1 minuto</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-full transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Status Selection: 🔴 Perdido / 🟢 Encontrado */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Estado del Objeto *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStatus('encontrado')}
                className={`py-2.5 px-3 rounded-2xl border-2 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                  status === 'encontrado'
                    ? 'border-green-600 bg-green-50 text-green-700 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                Lo encontré (Encontrado)
              </button>

              <button
                type="button"
                onClick={() => setStatus('perdido')}
                className={`py-2.5 px-3 rounded-2xl border-2 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                  status === 'perdido'
                    ? 'border-red-600 bg-red-50 text-red-700 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <AlertCircle className="w-4 h-4 text-red-600" />
                Lo perdí (Perdido)
              </button>
            </div>
          </div>

          {/* Image Upload / Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              📷 Foto del Objeto *
            </label>
            
            <div className="relative aspect-16/9 rounded-2xl border-2 border-dashed border-slate-300 overflow-hidden group bg-slate-50 flex flex-col items-center justify-center p-2 text-center">
              {imageUrl ? (
                <>
                  <img src={imageUrl} alt="Vista previa" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 bg-white text-slate-800 rounded-lg text-xs font-bold shadow-md hover:bg-slate-100 transition cursor-pointer"
                    >
                      Cambiar foto
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-1">
                  <Camera className="w-8 h-8 text-slate-400 mx-auto" />
                  <span className="text-xs font-semibold text-slate-600 block">
                    Subir foto o arrastrar archivo
                  </span>
                </div>
              )}
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />

            {/* Quick Preset Photo Selector */}
            <div className="mt-2">
              <span className="text-[11px] text-slate-500 font-medium block mb-1">
                Fotos de muestra rápidas:
              </span>
              <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {PRESET_PHOTOS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setImageUrl(preset.url)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition cursor-pointer border ${
                      imageUrl === preset.url
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Nombre del objeto *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Mochila negra Jansport, iPhone 13, Llaves..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none font-medium"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Descripción *
            </label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe detalles específicos (color, marcas, contenido, hora aproximada)..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none font-medium resize-none"
            />
          </div>

          {/* Category & Date Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Categoría *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Fecha *
              </label>
              <input
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
              />
            </div>
          </div>

          {/* Reward (Optional if Lost) */}
          {status === 'perdido' && (
            <div>
              <label className="block text-xs font-bold text-amber-700 uppercase tracking-wider mb-1">
                🎁 Recompensa (Opcional)
              </label>
              <input
                type="text"
                value={reward}
                onChange={(e) => setReward(e.target.value)}
                placeholder="Ej: $10.000 / Se ofrece gratificación"
                className="w-full px-3.5 py-2.5 rounded-xl border border-amber-300 bg-amber-50/50 text-sm font-medium focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
          )}

          {/* Location Picker */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                📍 Ubicación *
              </label>
              <button
                type="button"
                onClick={handleUseGPS}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
              >
                <Navigation className="w-3.5 h-3.5" />
                Usar mi GPS
              </button>
            </div>

            <input
              type="text"
              required
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder="Ej: Plaza Italia, Av. Cabildo 2000..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-medium mb-2 focus:ring-2 focus:ring-blue-600 outline-none"
            />

            {/* Mini Map Picker */}
            <div className="h-36 rounded-2xl overflow-hidden border border-slate-300 relative shadow-inner">
              <div ref={mapPickerRef} className="w-full h-full" />
              <span className="absolute bottom-2 left-2 bg-slate-900/80 text-white text-[10px] px-2 py-0.5 rounded-md font-semibold z-10 pointer-events-none">
                Toca o arrastra para ajustar
              </span>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-2xl font-extrabold text-base shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Publicando...</span>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Publicar Objeto
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
