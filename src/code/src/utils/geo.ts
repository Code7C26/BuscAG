// Calculate distance between two lat/lng points in kilometers using Haversine formula
export function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the Earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return Math.round(d * 10) / 10;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

// Format relative time (e.g., "Hace 15 min", "Hace 2 horas", "Ayer", etc.)
export function formatTimeAgo(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    
    if (isNaN(diffInMs)) return dateString;

    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMinutes < 1) return 'Hace un momento';
    if (diffInMinutes < 60) return `Hace ${diffInMinutes} min`;
    if (diffInHours < 24) return `Hace ${diffInHours} h`;
    if (diffInDays === 1) return 'Ayer';
    if (diffInDays < 7) return `Hace ${diffInDays} días`;

    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short'
    });
  } catch {
    return dateString;
  }
}

// Default reference position (e.g. Center of City: Buenos Aires / Mexico City / Madrid default)
export const DEFAULT_CENTER = {
  lat: -34.6037,
  lng: -58.3816,
  addressName: 'Plaza de Mayo, Centro'
};
