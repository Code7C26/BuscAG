import {isItemCategory,isItemStatus} from '../utils/itemContract';
import { itemDateInput, parseItemDate } from '../utils/itemDate';
import { reportError } from '../../lib/reportError';
import { useDialogFocus } from '../utils/useDialogFocus';
/**
 * MODAL DE PUBLICACIÓN DE OBJETOS (PublishModal.tsx)
 * Permite a cualquier usuario reportar un objeto perdido o encontrado.
 * Incluye:
 * - Selección de estado (Perdido / Encontrado)
 * - Carga o selección de fotografía (soporta fotos locales con FileReader y presets de prueba)
 * - Selector interactivo de ubicación con mini-mapa Leaflet y soporte para GPS
 * - Campos para título, descripción, categoría, fecha y recompensa opcional
 */
import React, { useState, useRef, useEffect, useId } from 'react';
import { X, Camera, Upload, MapPin, Tag, Calendar, AlertCircle, CheckCircle2, Sparkles, Navigation } from 'lucide-react';
import L from 'leaflet';
import { Category, ItemStatus, Item, User } from '../types';
import { DEFAULT_CENTER, isValidCoordinates } from '../utils/geo';

// Propiedades que recibe el modal de publicación
interface PublishModalProps {
  isOpen: boolean;        // Determina si el modal está visible en pantalla
  onClose: () => void;    // Función para cerrar la ventana modal
  onSubmit: (newItem: Omit<Item, 'id' | 'createdAt' | 'contactCount'>) => void | Promise<void>; // Emite los datos validados
  initialItem?: Item | null;
  currentUser: User;      // Usuario que está publicando
}

// Galería de fotos de ejemplo para facilitar pruebas rápidas durante la demostración del proyecto
const PRESET_PHOTOS = [
  { label: 'Mochila', url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop&q=80' },
  { label: 'Celular', url: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&auto=format&fit=crop&q=80' },
  { label: 'Llaves', url: 'https://images.unsplash.com/photo-1582139329536-e7284fece509?w=800&auto=format&fit=crop&q=80' },
  { label: 'Billetera', url: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=800&auto=format&fit=crop&q=80' },
  { label: 'Mascota', url: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=800&auto=format&fit=crop&q=80' },
  { label: 'Lentes', url: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=800&auto=format&fit=crop&q=80' }
];

const toDateTimeLocal = (date: Date) => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
};

export const PublishModal: React.FC<PublishModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  currentUser,
  initialItem = null
}) => {
  // ==========================================
  // ESTADOS DEL FORMULARIO
  // ==========================================
  const formId = useId();
  const [status, setStatus] = useState<ItemStatus|''>('encontrado');      // Estado inicial: encontrado
  const [title, setTitle] = useState('');                             // Título del objeto
  const [description, setDescription] = useState('');                 // Descripción detallada
  const [category, setCategory] = useState<Category|''>('Electrónicos'); // Categoría seleccionada
  const [date, setDate] = useState(toDateTimeLocal(new Date())); // Fecha y hora local
  const [locationName, setLocationName] = useState(''); // Nombre legible del lugar
  const [lat, setLat] = useState(DEFAULT_CENTER.lat);                 // Coordenada latitud
  const [lng, setLng] = useState(DEFAULT_CENTER.lng);                 // Coordenada longitud
  const [imageUrl, setImageUrl] = useState('');     // Foto del objeto (URL o Base64)
  const [reward, setReward] = useState('');                           // Recompensa voluntaria
  const [isSubmitting, setIsSubmitting] = useState(false);             // Estado de carga al enviar
  const [submitError, setSubmitError] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const submitting = useRef(false);
  const lifecycle = useRef(0);
  useEffect(() => () => { lifecycle.current += 1; }, [isOpen]);

  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(isOpen, dialogRef, () => { if (!submitting.current) onClose(); });

  // Referencias para el input de archivo y el mapa selector
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mapPickerRef = useRef<HTMLDivElement>(null);
  const leafletPickerRef = useRef<L.Map | null>(null);
  const pickerMarkerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!initialItem) return;
    setStatus(initialItem.status??''); setTitle(initialItem.title); setDescription(initialItem.description);
    setCategory(initialItem.category); setLocationName(initialItem.locationName);
    const valid = isValidCoordinates(initialItem.lat, initialItem.lng);
    setLat(valid ? initialItem.lat : DEFAULT_CENTER.lat); setLng(valid ? initialItem.lng : DEFAULT_CENTER.lng);
    setLocationConfirmed(valid); setImageUrl(initialItem.imageUrl); setReward(initialItem.reward ?? '');
    setDate(itemDateInput(initialItem.date));
    setSubmitError('');
  }, [initialItem?.id]);

  // Lista de categorías para el menú desplegable
  const categories: Category[] = [
    'Electrónicos',
    'Documentos y Billeteras',
    'Mascotas',
    'Llaves',
    'Mochilas y Bolsos',
    'Indumentaria',
    'Otros'
  ];

  /**
   * EFECTO: Inicializa el mini-mapa interactivo para escoger la ubicación exacta
   */
  useEffect(() => {
    if (!isOpen || !mapPickerRef.current || leafletPickerRef.current) return;

    // Crea el mapa dentro del contenedor mapPickerRef
    const map = L.map(mapPickerRef.current, {
      center: [lat, lng],
      zoom: 14,
      zoomControl: false
    });

    // Añade la capa de mosaicos de OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 }).addTo(map);

    // Crea un marcador arrastrable (draggable: true)
    const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
    pickerMarkerRef.current = marker;

    // Evento al terminar de arrastrar el pin: actualiza coordenadas
    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      if (!isValidCoordinates(pos.lat, pos.lng)) { setLocationConfirmed(false); return; }
      setLocationConfirmed(true);
      setLat(pos.lat);
      setLng(pos.lng);
      setLocationName(`Ubicación seleccionada (${pos.lat.toFixed(3)}, ${pos.lng.toFixed(3)})`);
    });

    // Evento al hacer clic en cualquier parte del mapa: mueve el pin allí
    map.on('click', (e) => {
      if (!isValidCoordinates(e.latlng.lat, e.latlng.lng)) { setLocationConfirmed(false); return; }
      setLocationConfirmed(true);
      marker.setLatLng(e.latlng);
      setLat(e.latlng.lat);
      setLng(e.latlng.lng);
      setLocationName(`Ubicación marcada en mapa`);
    });

    leafletPickerRef.current = map;

    // Invalida tamaño para asegurar renderizado correcto dentro de la ventana modal
    const invalidateTimer = window.setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      window.clearTimeout(invalidateTimer);
      map.remove();
      if (leafletPickerRef.current === map) leafletPickerRef.current = null;
      pickerMarkerRef.current = null;
    };
  }, [isOpen]);

  /**
   * Manejador para cargar una foto propia del usuario desde su dispositivo
   * Utiliza la API nativa de FileReader para convertir la imagen en DataURL (Base64)
   */
  const readImageFile = (file: File): boolean => {
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) {
      setSubmitError('La foto debe estar en formato JPG, PNG o WebP.'); return false;
    }
    if (file.size > 5 * 1024 * 1024) {
      setSubmitError('La foto no puede superar los 5 MB.'); return false;
    }
    setSubmitError(''); const version = lifecycle.current; const reader = new FileReader();
    reader.onload = () => { if (version === lifecycle.current && typeof reader.result === 'string') setImageUrl(reader.result); };
    reader.onerror = () => { if (version === lifecycle.current) setSubmitError('No se pudo leer la foto seleccionada.'); };
    reader.readAsDataURL(file); return true;
  };
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && !readImageFile(file)) event.target.value = '';
  };

  /**
   * Manejador para obtener la posición GPS actual del usuario y mover el pin en el mapa
   */
  const handleUseGPS = () => {
    const version = lifecycle.current;
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (version !== lifecycle.current) return;
          const newLat = pos.coords.latitude;
          const newLng = pos.coords.longitude;
          if (!isValidCoordinates(newLat, newLng)) {
            setSubmitError('La ubicación recibida no es válida. Selecciona un punto en el mapa.');
            return;
          }
          setLocationConfirmed(true);
          setLat(newLat);
          setLng(newLng);
          setLocationName('Mi ubicación actual (GPS)');
          leafletPickerRef.current?.setView([newLat, newLng], 15);
          pickerMarkerRef.current?.setLatLng([newLat, newLng]);
        },
        () => {
          if (version === lifecycle.current) setSubmitError('No se pudo acceder a la geolocalización. Selecciona la ubicación en el mapa.');
        }
      );
    }
  };

  /**
   * Valida los datos y ejecuta el callback onSubmit para agregar la publicación
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting.current) return;
    if (!isItemCategory(category)||!isItemStatus(status)) {setSubmitError('Selecciona categoría y estado válidos.');return;}
    if (!title.trim() || !description.trim()) {
      alert('Por favor completa el título y la descripción.');
      return;
    }

    if (!imageUrl) { setSubmitError('Selecciona una foto propia o una imagen de muestra de forma explícita.'); return; }
    if (!locationConfirmed || !isValidCoordinates(lat, lng) || !locationName.trim()) {
      setSubmitError('Confirma una ubicación válida tocando el mapa, moviendo el pin o usando tu GPS.');
      return;
    }
    if (!parseItemDate(date)) {
      setSubmitError('Selecciona una fecha válida.');
      return;
    }
    submitting.current = true;
    const version = lifecycle.current;
    setIsSubmitting(true);
    setSubmitError('');
    try {
      await onSubmit({
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
      if (version !== lifecycle.current) return;
      setStatus('encontrado');
      setTitle('');
      setDescription('');
      setCategory('Electrónicos');
      setDate(toDateTimeLocal(new Date()));
      setLocationName('');
      setLat(DEFAULT_CENTER.lat);
      setLng(DEFAULT_CENTER.lng);
      setLocationConfirmed(false);
      setImageUrl('');
      setReward('');
      setCameraActive(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      leafletPickerRef.current?.setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 14);
      pickerMarkerRef.current?.setLatLng([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]);
      onClose();
    } catch (error) {
      reportError('No se pudo publicar el objeto:', error);
      if (version === lifecycle.current) setSubmitError(error instanceof Error ? error.message : 'No se pudo publicar el objeto.');
    } finally {
      submitting.current = false;
      if (version === lifecycle.current) setIsSubmitting(false);
    }
  };

  // Si el modal está cerrado, no renderiza nada en el DOM
  if (!isOpen) return null;

  return (
    <div className="publish-overlay fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Publicar o editar objeto" tabIndex={-1} className="publish-dialog w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        {/* Cabecera de la ventana modal */}
        <div className="publish-dialog__header p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-extrabold text-slate-900 text-lg leading-tight flex items-center gap-2">
              {initialItem ? 'Editar publicación' : '➕ Publicar Objeto'}
            </h2>
            <p className="text-xs text-slate-500">{initialItem ? 'Actualiza los datos de tu objeto' : 'Publica en menos de 1 minuto'}</p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-full transition cursor-pointer"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario scrolleable */}
        <form onSubmit={handleSubmit} className="publish-form p-4 space-y-4 overflow-y-auto flex-1">
          {submitError && (
            <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-700">
              {submitError}
            </p>
          )}
          {/* Selector de estado: Encontrado (verde) / Perdido (rojo) */}
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

          {/* Subida o selección de imagen */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              📷 Foto del Objeto *
            </label>
            
            <div role={!imageUrl ? 'button' : undefined} tabIndex={!imageUrl ? 0 : undefined}
              aria-label={!imageUrl ? 'Subir foto' : undefined}
              onDragOver={event => event.preventDefault()}
              onDrop={event => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) readImageFile(file); }}
              onClick={() => { if (!imageUrl) fileInputRef.current?.click(); }}
              onKeyDown={event => { if (!imageUrl && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); fileInputRef.current?.click(); } }}
              className="relative aspect-16/9 rounded-2xl border-2 border-dashed border-slate-300 overflow-hidden group bg-slate-50 flex flex-col items-center justify-center p-2 text-center">
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

            {/* Input oculto tipo file para abrir el explorador de archivos */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />

            {/* Galería de fotos de muestra para pruebas rápidas */}
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

          {/* Campo de título */}
          <div>
            <label htmlFor={`${formId}-title`} className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Nombre del objeto *
            </label>
            <input id={`${formId}-title`}
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Mochila negra Jansport, iPhone 13, Llaves..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none font-medium"
            />
          </div>

          {/* Campo de descripción detallada */}
          <div>
            <label htmlFor={`${formId}-description`} className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Descripción *
            </label>
            <textarea id={`${formId}-description`}
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe detalles específicos (color, marcas, contenido, hora aproximada)..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none font-medium resize-none"
            />
          </div>

          {/* Categoría y Fecha */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${formId}-category`} className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Categoría *
              </label>
              <select id={`${formId}-category`}
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
              >
                {!category&&<option value="" disabled>Selecciona categoría</option>}
              {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor={`${formId}-date`} className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Fecha *
              </label>
              <input id={`${formId}-date`}
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
              />
            </div>
          </div>

          {/* Campo opcional de recompensa (solo si es un objeto perdido) */}
          {status === 'perdido' && (
            <div>
              <label htmlFor={`${formId}-reward`} className="block text-xs font-bold text-amber-700 uppercase tracking-wider mb-1">
                🎁 Recompensa (Opcional)
              </label>
              <input id={`${formId}-reward`}
                type="text"
                value={reward}
                onChange={(e) => setReward(e.target.value)}
                placeholder="Ej: $10.000 / Se ofrece gratificación"
                className="w-full px-3.5 py-2.5 rounded-xl border border-amber-300 bg-amber-50/50 text-sm font-medium focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
          )}

          {/* Selector de ubicación geográfica */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor={`${formId}-location`} className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                📍 Ubicación *
              </label>
              <button
                type="button"
                onClick={handleUseGPS}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                title="Detectar mi ubicación actual con GPS"
              >
                <Navigation className="w-3.5 h-3.5" />
                Usar mi GPS
              </button>
            </div>

            <input id={`${formId}-location`}
              type="text"
              required
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder="Ej: Plaza Italia, Av. Cabildo 2000..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-medium mb-2 focus:ring-2 focus:ring-blue-600 outline-none"
            />

            {/* Mini mapa Leaflet para arrastrar o tocar la posición exacta */}
            <div className="h-36 rounded-2xl overflow-hidden border border-slate-300 relative shadow-inner">
              <div ref={mapPickerRef} className="w-full h-full" />
              <span className="absolute bottom-2 left-2 bg-slate-900/80 text-white text-[10px] px-2 py-0.5 rounded-md font-semibold z-10 pointer-events-none">
                Toca o arrastra para ajustar
              </span>
            </div>
          </div>

          {/* Botón de publicación final */}
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
                  {initialItem ? 'Guardar cambios' : 'Publicar Objeto'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
