import {t,locale} from '../i18n';
import { parseItemDate } from './itemDate';
/**
 * UTILIDADES GEOGRÁFICAS Y DE FORMATEO DE TIEMPO
 * Contiene funciones matemáticas para calcular distancias entre coordenadas GPS
 * y formateadores amigables de tiempo transcurrido para la interfaz de usuario.
 */

/** Reject malformed legacy coordinates without deleting their publications. */
export function isValidCoordinates(lat: unknown, lng: unknown): boolean {
  return typeof lat === 'number' && typeof lng === 'number'
    && Number.isFinite(lat) && Number.isFinite(lng)
    && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

/**
 * Calcula la distancia en kilómetros entre dos pares de coordenadas (latitud/longitud)
 * utilizando la fórmula del Haversine, que considera la curvatura esférica de la Tierra.
 * 
 * @param lat1 Latitud del punto 1 (ej. ubicación del usuario)
 * @param lon1 Longitud del punto 1
 * @param lat2 Latitud del punto 2 (ej. publicación del objeto)
 * @param lon2 Longitud del punto 2
 * @returns Distancia en kilómetros redondeada a 1 decimal
 */
export function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (!isValidCoordinates(lat1, lon1) || !isValidCoordinates(lat2, lon2)) return NaN;
  const R = 6371; // Radio medio de la Tierra en kilómetros

  // Convertimos las diferencias de grados a radianes
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);

  // Aplicación de la fórmula trigonométrica de Haversine
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  // Cálculo del ángulo central en radianes
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));

  // Multiplicamos el ángulo por el radio terrestre para obtener la distancia
  const d = R * c;

  // Retornamos el valor redondeado a un decimal (ej. 1.2 km)
  return Math.round(d * 10) / 10;
}

/**
 * Función auxiliar para convertir grados sexagesimales a radianes
 */
function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Convierte una fecha ISO o string en un formato relativo amigable y legible
 * (por ejemplo: "Hace 15 min", "Hace 2 h", "Ayer", "14 sep")
 * 
 * @param dateString Cadena de fecha a evaluar
 * @returns Texto relativo en español
 */
export function formatTimeAgo(dateString: string): string {
  const date=parseItemDate(dateString); if(!date) return t('Fecha no disponible');
  const seconds=Math.round((date.getTime()-Date.now())/1000);
  const relative=new Intl.RelativeTimeFormat(locale(),{numeric:'auto'});
  if(Math.abs(seconds)<60) return t('Hace un momento');
  if(Math.abs(seconds)<3600) return relative.format(Math.round(seconds/60),'minute');
  if(Math.abs(seconds)<86400) return relative.format(Math.round(seconds/3600),'hour');
  if(Math.abs(seconds)<604800) return relative.format(Math.round(seconds/86400),'day');
  return date.toLocaleDateString(locale(),{day:'numeric',month:'short'});
}

/**
 * Coordenadas por defecto para centrar el mapa si el usuario aún no otorgó permisos de GPS
 */
export const DEFAULT_CENTER = {
  lat: -34.6037, // Latitud de referencia
  lng: -58.3816, // Longitud de referencia
  addressName: 'Plaza de Mayo, Centro'
};


export const NEARBY_RADIUS_KM = 4;
