/**
 * COMPONENTE DE MAPA INTERACTIVO (MapView.tsx)
 * Renderiza un mapa geográfico interactivo con la librería Leaflet y mosaicos de OpenStreetMap.
 * Permite visualizar geolocalizados todos los objetos perdidos y encontrados con marcadores
 * personalizados (pines de mapa con miniatura de la foto del objeto), filtrarlos en tiempo real
 * y centrar el mapa en la ubicación GPS actual del usuario.
 */
import React, { useEffect, useRef, useState } from 'react';
// Librería Leaflet para renderizado y control de mapas web
import L from 'leaflet';
// Iconos de interfaz
import { Search, Navigation, Filter, AlertCircle, CheckCircle2, ChevronRight, X, Sparkles } from 'lucide-react';
import { Item, FilterType, Category } from '../types';
import { getDistanceKm, DEFAULT_CENTER } from '../utils/geo';

// Propiedades que recibe el componente MapView
interface MapViewProps {
  items: Item[];                               // Listado de objetos a mostrar como marcadores
  onSelectPublication: (item: Item) => void;  // Callback cuando el usuario toca 'Ver publicación'
  userLat?: number;                            // Latitud de referencia inicial
  userLng?: number;                            // Longitud de referencia inicial
}

export const MapView: React.FC<MapViewProps> = ({
  items,
  onSelectPublication,
  userLat = DEFAULT_CENTER.lat,
  userLng = DEFAULT_CENTER.lng
}) => {
  // Referencia al elemento <div> contenedor del mapa en el DOM
  const mapRef = useRef<HTMLDivElement>(null);
  // Instancia activa del mapa de Leaflet
  const leafletMapRef = useRef<L.Map | null>(null);
  // Grupo de capas (LayerGroup) para agrupar y limpiar marcadores fácilmente
  const markersGroupRef = useRef<L.LayerGroup | null>(null);

  // Estados locales para los filtros del mapa
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('todos');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'Todas'>('Todas');
  
  // Objeto seleccionado al pulsar un pin en el mapa (para mostrar la tarjeta flotante inferior)
  const [selectedMapItem, setSelectedMapItem] = useState<Item | null>(null);
  
  // Posición actual del usuario
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(
    userLat && userLng ? { lat: userLat, lng: userLng } : null
  );
  
  // Indicador de carga mientras se consulta el GPS del navegador
  const [locating, setLocating] = useState(false);

  // Lista de categorías para el filtro
  const categories: (Category | 'Todas')[] = [
    'Todas',
    'Electrónicos',
    'Documentos y Billeteras',
    'Mascotas',
    'Llaves',
    'Mochilas y Bolsos',
    'Indumentaria',
    'Otros'
  ];

  /**
   * EFECTO 1: Inicialización del Mapa Leaflet
   * Se ejecuta una sola vez al montar el componente.
   */
  useEffect(() => {
    if (!mapRef.current) return;

    // Solo creamos la instancia si aún no existe
    if (!leafletMapRef.current) {
      // 1. Instanciamos el mapa Leaflet centrado en las coordenadas iniciales con zoom 13
      const map = L.map(mapRef.current, {
        center: [userLat, userLng],
        zoom: 13,
        zoomControl: false // Desactivamos el control por defecto para ubicarlo a medida
      });

      // 2. Agregamos la capa de mosaicos (tiles) de OpenStreetMap
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map);

      // 3. Colocamos los botones de zoom (+/-) en la esquina inferior derecha
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Guardamos la referencia del mapa y creamos el grupo donde vivirán los marcadores
      leafletMapRef.current = map;
      markersGroupRef.current = L.layerGroup().addTo(map);
    }

    // Invalida el tamaño para asegurar que Leaflet calcule bien las dimensiones del contenedor
    setTimeout(() => {
      leafletMapRef.current?.invalidateSize();
    }, 200);

    return () => {
      // En React, no destruimos el mapa inmediatamente para evitar parpadeos visuales
    };
  }, []);

  /**
   * EFECTO 2: Actualización de Marcadores (Pins)
   * Se ejecuta cada vez que cambian los objetos, la búsqueda o los filtros activos.
   */
  useEffect(() => {
    if (!leafletMapRef.current || !markersGroupRef.current) return;

    // Limpiamos los marcadores anteriores antes de dibujar los nuevos
    markersGroupRef.current.clearLayers();

    // Filtramos los objetos según los criterios de búsqueda, estado y categoría
    const filteredItems = items.filter(item => {
      const matchesSearch = searchQuery === '' || 
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.locationName.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesFilter = 
        activeFilter === 'todos' ? true :
        activeFilter === 'encontrados' ? item.status === 'encontrado' :
        activeFilter === 'perdidos' ? item.status === 'perdido' :
        activeFilter === 'cerca' ? (item.distanceKm !== undefined && item.distanceKm <= 3.5) : true;

      const matchesCat = selectedCategory === 'Todas' || item.category === selectedCategory;

      return matchesSearch && matchesFilter && matchesCat;
    });

    /**
     * Crea un icono HTML personalizado (divIcon) con la foto del objeto
     * y un borde coloreado según su estado (Rojo: Perdido, Verde: Encontrado).
     */
    const createCustomIcon = (item: Item) => {
      const isLost = item.status === 'perdido';
      const isRecovered = item.status === 'recuperado';
      // Determinamos el color: Rojo para perdido, verde oscuro para recuperado, verde claro para encontrado
      const color = isLost ? '#DC2626' : isRecovered ? '#059669' : '#16A34A';

      // HTML del pin con foto circular y puntero triangular
      const svgHtml = `
        <div style="position: relative; width: 42px; height: 50px; display: flex; align-items: center; justify-content: center;">
          <div style="
            width: 38px; 
            height: 38px; 
            border-radius: 50%; 
            background: white; 
            border: 3px solid ${color}; 
            box-shadow: 0 4px 10px rgba(0,0,0,0.25);
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
          ">
            <img src="${item.imageUrl}" style="width: 100%; height: 100%; object-fit: cover;" />
          </div>
          <div style="
            position: absolute;
            bottom: 2px;
            width: 0; 
            height: 0; 
            border-left: 6px solid transparent;
            border-right: 6px solid transparent;
            border-top: 8px solid ${color};
          "></div>
        </div>
      `;

      return L.divIcon({
        html: svgHtml,
        className: 'custom-map-pin',
        iconSize: [42, 50],
        iconAnchor: [21, 50],
        popupAnchor: [0, -45]
      });
    };

    // Recorremos los objetos filtrados y creamos un marcador para cada uno
    filteredItems.forEach(item => {
      const icon = createCustomIcon(item);
      const marker = L.marker([item.lat, item.lng], { icon });

      // Evento de clic en el marcador: selecciona el objeto y desplaza suavemente el mapa
      marker.on('click', () => {
        setSelectedMapItem(item);
        leafletMapRef.current?.panTo([item.lat, item.lng], { animate: true });
      });

      // Añadimos el marcador al grupo
      markersGroupRef.current?.addLayer(marker);
    });

    // Marcador azul distintivo de la ubicación actual del usuario
    if (currentLocation) {
      const userIcon = L.divIcon({
        html: `
          <div style="
            width: 20px; 
            height: 20px; 
            border-radius: 50%; 
            background: #2563EB; 
            border: 3px solid white; 
            box-shadow: 0 0 0 6px rgba(37, 99, 235, 0.3), 0 2px 8px rgba(0,0,0,0.3);
          "></div>
        `,
        className: 'user-map-pin',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      const userMarker = L.marker([currentLocation.lat, currentLocation.lng], { icon: userIcon });
      userMarker.bindTooltip('Mi Ubicación', { permanent: false, direction: 'top' });
      markersGroupRef.current?.addLayer(userMarker);
    }
  }, [items, searchQuery, activeFilter, selectedCategory, currentLocation]);

  /**
   * Manejador del botón "Mi Ubicación":
   * Obtiene la posición GPS del navegador y vuela la cámara del mapa hacia ella.
   */
  const handleLocateMe = () => {
    setLocating(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCurrentLocation(newLoc);
          // Centra el mapa en las coordenadas del usuario con animación suave
          leafletMapRef.current?.setView([newLoc.lat, newLoc.lng], 15, { animate: true });
          setLocating(false);
        },
        () => {
          // Si el usuario no otorga permisos, se utiliza el centro predeterminado
          setCurrentLocation({ lat: DEFAULT_CENTER.lat, lng: DEFAULT_CENTER.lng });
          leafletMapRef.current?.setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 14, { animate: true });
          setLocating(false);
        },
        { timeout: 8000 }
      );
    } else {
      setLocating(false);
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-4rem-4rem)] min-h-[500px] overflow-hidden bg-slate-100 flex flex-col">
      {/* Barra superior flotante de búsqueda y filtros rápidos */}
      <div className="absolute top-3 left-3 right-3 z-20 max-w-xl mx-auto space-y-2">
        {/* Campo de búsqueda sobre el mapa */}
        <div className="relative bg-white/95 backdrop-blur-md rounded-2xl shadow-lg border border-slate-200 p-2 flex items-center gap-2">
          <Search className="w-5 h-5 text-slate-400 ml-2 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar objeto en el mapa..."
            className="w-full bg-transparent text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="p-1 hover:bg-slate-100 rounded-full text-slate-400"
              title="Borrar búsqueda"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Píldoras de filtro rápido (Todos, Encontrados, Perdidos, Cerca de mí) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setActiveFilter('todos')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shadow-sm transition cursor-pointer ${
              activeFilter === 'todos'
                ? 'bg-blue-600 text-white'
                : 'bg-white/95 text-slate-700 hover:bg-white border border-slate-200'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setActiveFilter('encontrados')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shadow-sm transition cursor-pointer ${
              activeFilter === 'encontrados'
                ? 'bg-green-600 text-white'
                : 'bg-white/95 text-slate-700 hover:bg-white border border-slate-200'
            }`}
          >
            🟢 Encontrados
          </button>
          <button
            onClick={() => setActiveFilter('perdidos')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shadow-sm transition cursor-pointer ${
              activeFilter === 'perdidos'
                ? 'bg-red-600 text-white'
                : 'bg-white/95 text-slate-700 hover:bg-white border border-slate-200'
            }`}
          >
            🔴 Perdidos
          </button>
          <button
            onClick={() => {
              setActiveFilter('cerca');
              handleLocateMe();
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shadow-sm transition cursor-pointer ${
              activeFilter === 'cerca'
                ? 'bg-blue-600 text-white'
                : 'bg-white/95 text-slate-700 hover:bg-white border border-slate-200'
            }`}
          >
            📍 Cerca de mí
          </button>
        </div>
      </div>

      {/* Contenedor del mapa Leaflet (manejado vía mapRef) */}
      <div ref={mapRef} className="w-full h-full z-0" />

      {/* Botón flotante para centrar en "Mi ubicación" */}
      <button
        onClick={handleLocateMe}
        disabled={locating}
        className="absolute bottom-6 right-4 z-20 flex items-center gap-2 px-4 py-2.5 bg-white text-blue-600 hover:bg-blue-50 font-bold text-xs rounded-full shadow-lg border border-slate-200 transition active:scale-95 cursor-pointer"
        title="Centrar en mi ubicación actual"
      >
        <Navigation className={`w-4 h-4 ${locating ? 'animate-spin text-blue-600' : 'fill-blue-600'}`} />
        <span>{locating ? 'Ubicando...' : 'Mi ubicación'}</span>
      </button>

      {/* Tarjeta flotante con vista previa del objeto seleccionado al hacer clic en un pin */}
      {selectedMapItem && (
        <div className="absolute bottom-4 left-4 right-16 z-20 max-w-sm mx-auto bg-white rounded-2xl shadow-xl border border-slate-200 p-3.5 animate-in slide-in-from-bottom-5 duration-200">
          <div className="flex gap-3 items-center">
            {/* Foto en miniatura del objeto */}
            <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-slate-100 border border-slate-200">
              <img
                src={selectedMapItem.imageUrl}
                alt={selectedMapItem.title}
                className="w-full h-full object-cover"
              />
              <span className={`absolute top-1 left-1 w-2.5 h-2.5 rounded-full ${
                selectedMapItem.status === 'perdido' ? 'bg-red-500' : 'bg-green-500'
              }`} />
            </div>

            {/* Datos resumidos del objeto */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${
                  selectedMapItem.status === 'perdido' ? 'text-red-600' : 'text-green-600'
                }`}>
                  {selectedMapItem.status === 'perdido' ? '🔴 Perdido' : '🟢 Encontrado'}
                </span>
                <button
                  onClick={() => setSelectedMapItem(null)}
                  className="p-1 hover:bg-slate-100 rounded-full text-slate-400 cursor-pointer"
                  title="Cerrar vista previa"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <h4 className="font-bold text-slate-900 text-xs truncate leading-snug">
                {selectedMapItem.title}
              </h4>
              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                📍 {selectedMapItem.locationName}
              </p>

              {/* Botón para abrir el modal completo */}
              <button
                onClick={() => onSelectPublication(selectedMapItem)}
                className="mt-2 w-full flex items-center justify-center gap-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Ver publicación
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

