/**
 * TIPOS Y DEFINICIONES GLOBALES DE DATOS
 * Este archivo centraliza todas las interfaces y tipos de TypeScript
 * para garantizar la seguridad de tipos en toda la aplicación.
 */

// Estado del objeto: 'perdido' (rojo), 'encontrado' (verde) o 'recuperado' (caso resuelto)
export type ItemStatus = 'perdido' | 'encontrado' | 'recuperado';

// Categorías disponibles para clasificar y filtrar las publicaciones
export type Category = 
  | 'Todos'
  | 'Electrónicos'
  | 'Documentos y Billeteras'
  | 'Mascotas'
  | 'Llaves'
  | 'Mochilas y Bolsos'
  | 'Indumentaria'
  | 'Otros';

// Filtros rápidos disponibles en la barra superior de la pantalla de inicio y mapa
export type FilterType = 'todos' | 'encontrados' | 'perdidos' | 'cerca';

// Pestañas de navegación de la aplicación
export type TabType = 'home' | 'map' | 'matches' | 'notifications' | 'profile' | 'messages' | 'publish';
/**
 * Representa al usuario de la plataforma (quien publica o busca)
 */
export interface User {
  id: string;              // Identificador único del usuario
  name: string;            // Nombre completo para mostrar
  avatar: string;          // URL de la imagen de perfil
  email: string;           // Correo electrónico de contacto
  phone: string;           // Teléfono directo para llamadas o WhatsApp
  ratingCount?: number;
  rating: number;          // Puntuación de confianza comunitaria (ej. 4.9)
  location: string;        // Barrio o zona habitual del usuario
  totalPublished: number;  // Cantidad de publicaciones realizadas
  totalRecovered: number;  // Cantidad de objetos que logró devolver o recuperar
  verified?: boolean;      // Indica si la identidad del usuario fue validada
}

/**
 * Representa un objeto reportado (perdido o encontrado)
 */
export interface Item {
  id: string;              // Identificador único de la publicación
  title: string;           // Título descriptivo (ej: "Mochila Jansport Negra")
  description: string;     // Detalle completo del objeto y circunstancias
  category: string;       // Categoría a la que pertenece
  status: string | null;      // Estado actual: perdido, encontrado o recuperado
  locationName: string;    // Nombre legible del lugar (ej: "Plaza Italia, Palermo")
  lat: number;             // Coordenada de latitud para el mapa
  lng: number;             // Coordenada de longitud para el mapa
  date: string;            // Fecha y hora del extravío o hallazgo (formato ISO)
  imageUrl: string;        // Enlace o base64 de la fotografía del objeto
  user: User;              // Datos del usuario que creó la publicación
  distanceKm?: number;     // Distancia calculada en tiempo real respecto al usuario
  createdAt: string;       // Timestamp del momento en que se publicó en la app
  reward?: string;         // Recompensa opcional ofrecida si es un objeto perdido
  contactCount?: number;   // Contador de interesados que se contactaron
}

/**
 * Mensaje individual del chat interno entre usuarios
 */
export interface Message {
  id: string;              // Identificador único del mensaje
  itemId: string;          // ID del objeto sobre el que se conversa
  itemTitle: string;       // Nombre del objeto para el encabezado del chat
  itemImage: string;       // Miniatura del objeto
  senderId: string;        // ID de quien envía el mensaje
  senderName: string;      // Nombre de quien envía
  senderAvatar: string;    // Foto de quien envía
  receiverId: string;      // ID de quien recibe el mensaje
  text: string;            // Contenido textual del mensaje
  timestamp: string;       // Hora exacta de envío
  isRead: boolean;         // Si el receptor ya vio el mensaje
}

/**
 * Notificación o alerta del sistema para el usuario
 */
export interface NotificationItem {
  id: string;                                          // Identificador de la notificación
  title: string;                                       // Título breve con icono
  message: string;                                     // Explicación de la alerta
  date: string;                                        // Fecha de la notificación
  type: 'message' | 'match' | 'system' | 'recovered';  // Tipo para determinar color e icono
  read: boolean;                                       // Estado de lectura
  relatedItemId?: string;                              // ID del objeto asociado (si aplica)
  relatedUserId?: string;                              // Otro participante cuando la notificación abre un chat
}

/**
 * Resultado del algoritmo de comparación automática entre un objeto perdido y uno encontrado
 */
export interface MatchResult {
  id: string;                                          // Identificador único del match
  lostItem: Item;                                      // Objeto reportado como perdido
  foundItem: Item;                                     // Objeto reportado como encontrado
  score: number;                                       // Porcentaje de coincidencia (0 - 100)
  confidence: 'muy_alta' | 'alta' | 'media';           // Nivel cualitativo de confianza
  reasons: string[];                                   // Razones que explican la coincidencia
  distanceKm: number;                                  // Distancia en km entre ambos reportes
  matchedKeywords: string[];                           // Palabras clave coincidentes
}

