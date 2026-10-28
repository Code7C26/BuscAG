import { Item, User, NotificationItem, Message } from '../types';

export const CURRENT_USER: User = {
  id: 'u_me',
  name: 'Valentín Mamonde',
  avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
  email: 'valentin@ejemplo.com',
  phone: '+54 9 11 4589-2210',
  rating: 4.9,
  location: 'Palermo, CABA',
  totalPublished: 3,
  totalRecovered: 2,
  verified: true
};

export const DEMO_USERS: User[] = [
  CURRENT_USER,
  {
    id: 'u1',
    name: 'Ana García',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    email: 'ana.garcia@ejemplo.com',
    phone: '+54 9 11 2345-6789',
    rating: 4.8,
    location: 'Recoleta',
    totalPublished: 5,
    totalRecovered: 4,
    verified: true
  },
  {
    id: 'u2',
    name: 'Carlos Rodríguez',
    avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
    email: 'carlos.r@ejemplo.com',
    phone: '+54 9 11 8765-4321',
    rating: 4.7,
    location: 'Belgrano',
    totalPublished: 2,
    totalRecovered: 1,
    verified: true
  },
  {
    id: 'u3',
    name: 'Sofía Martínez',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    email: 'sofia.m@ejemplo.com',
    phone: '+54 9 11 3456-7890',
    rating: 5.0,
    location: 'San Telmo',
    totalPublished: 4,
    totalRecovered: 3,
    verified: true
  }
];

export const INITIAL_ITEMS: Item[] = [
  {
    id: 'item_1',
    title: 'Mochila Urbana Negra Jansport',
    description: 'Encontrada cerca de las bancas del parque. Contiene unos cuadernos universitarios y una cartuchera azul. Sin documentos personales.',
    category: 'Mochilas y Bolsos',
    status: 'encontrado',
    locationName: 'Plaza Italia, Palermo',
    lat: -34.5812,
    lng: -58.4211,
    date: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45 mins ago
    imageUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop&q=80',
    user: DEMO_USERS[1],
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    reward: 'Sin recompensa requerida',
    contactCount: 3
  },
  {
    id: 'item_2',
    title: 'Perro Caniche Toy Blanco "Tobías"',
    description: 'Se extravió alrededor de las 18:00 hs. Lleva un pretal rojo sin chapita de identificación. Es muy dócil y asustadizo. Recompensa a quien lo devuelva sano.',
    category: 'Mascotas',
    status: 'perdido',
    locationName: 'Av. Cabildo y Juramento, Belgrano',
    lat: -34.5623,
    lng: -58.4561,
    date: new Date(Date.now() - 1000 * 60 * 180).toISOString(), // 3 hrs ago
    imageUrl: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=800&auto=format&fit=crop&q=80',
    user: DEMO_USERS[2],
    createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    reward: '$15.000 Recompensa',
    contactCount: 7
  },
  {
    id: 'item_3',
    title: 'Juego de Llaves con Llavero de River Plate',
    description: 'Encontré 3 llaves doradas con un llavero metálico del club River Plate tiradas al lado de la parada del colectivo 60.',
    category: 'Llaves',
    status: 'encontrado',
    locationName: 'Av. Las Heras y Pueyrredón, Recoleta',
    lat: -34.5885,
    lng: -58.3972,
    date: new Date(Date.now() - 1000 * 60 * 360).toISOString(), // 6 hrs ago
    imageUrl: 'https://images.unsplash.com/photo-1582139329536-e7284fece509?w=800&auto=format&fit=crop&q=80',
    user: DEMO_USERS[3],
    createdAt: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
    contactCount: 2
  },
  {
    id: 'item_4',
    title: 'Billetera Marrón de Cuero con DNI',
    description: 'Billetera olvidada en la mesa exterior de un café. Contiene documento a nombre de Martín Pérez, tarjetas de débito y SUBE. Entregada en la caja del bar.',
    category: 'Documentos y Billeteras',
    status: 'encontrado',
    locationName: 'Plaza Serrano, Palermo Soho',
    lat: -34.5889,
    lng: -58.4305,
    date: new Date(Date.now() - 1000 * 60 * 600).toISOString(), // 10 hrs ago
    imageUrl: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=800&auto=format&fit=crop&q=80',
    user: CURRENT_USER,
    createdAt: new Date(Date.now() - 1000 * 60 * 600).toISOString(),
    contactCount: 4
  },
  {
    id: 'item_5',
    title: 'iPhone 13 Azul con Funda Transparente',
    description: 'Se me cayó del bolsillo mientras andaba en bicicleta por la ciclovía. Tiene la pantalla bloqueada con foto de un gato. Agradezco enormemente cualquier dato!',
    category: 'Electrónicos',
    status: 'perdido',
    locationName: 'Puerto Madero, Puente de la Mujer',
    lat: -34.6083,
    lng: -58.3648,
    date: new Date(Date.now() - 1000 * 60 * 1200).toISOString(), // 20 hrs ago
    imageUrl: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&auto=format&fit=crop&q=80',
    user: DEMO_USERS[1],
    createdAt: new Date(Date.now() - 1000 * 60 * 1200).toISOString(),
    reward: '$20.000 Recompensa',
    contactCount: 9
  },
  {
    id: 'item_6',
    title: 'Campera de Abrigo Verde Oliva (Talle L)',
    description: 'Campera olvidada en el anfiteatro. Talle L, marca Columbia, con capucha.',
    category: 'Indumentaria',
    status: 'encontrado',
    locationName: 'Parque Centenario, Almagro',
    lat: -34.6062,
    lng: -58.4355,
    date: new Date(Date.now() - 1000 * 60 * 1800).toISOString(), // 1.2 days ago
    imageUrl: 'https://images.unsplash.com/photo-1544441893-675973e31985?w=800&auto=format&fit=crop&q=80',
    user: DEMO_USERS[2],
    createdAt: new Date(Date.now() - 1000 * 60 * 1800).toISOString(),
    contactCount: 1
  },
  {
    id: 'item_7',
    title: 'Lentes de Sol Ray-Ban con Estuche Negro',
    description: '¡Recuperados gracias a la comunidad! Entregados a su dueña en la estación.',
    category: 'Otros',
    status: 'recuperado',
    locationName: 'Estación de Subte Línea D - Palermo',
    lat: -34.5779,
    lng: -58.4265,
    date: new Date(Date.now() - 1000 * 60 * 3600).toISOString(), // 2.5 days ago
    imageUrl: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=800&auto=format&fit=crop&q=80',
    user: CURRENT_USER,
    createdAt: new Date(Date.now() - 1000 * 60 * 3600).toISOString(),
    contactCount: 5
  },
  {
    id: 'item_8',
    title: 'Mochila Jansport Negra con Cuadernos',
    description: 'Olvidé mi mochila negra Jansport con útiles universitarios en las bancas de Plaza Italia / Jardín Botánico. Tiene un cierre lateral plateado.',
    category: 'Mochilas y Bolsos',
    status: 'perdido',
    locationName: 'Plaza Italia / Botánico, Palermo',
    lat: -34.5819,
    lng: -58.4205,
    date: new Date(Date.now() - 1000 * 60 * 50).toISOString(), // 50 mins ago
    imageUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop&q=80',
    user: CURRENT_USER,
    createdAt: new Date(Date.now() - 1000 * 60 * 50).toISOString(),
    reward: '$8.000 Recompensa',
    contactCount: 2
  },
  {
    id: 'item_9',
    title: 'iPhone 13 Azul encontrado con protector',
    description: 'Encontrado en los escalones del Puente de la Mujer en Puerto Madero. Tiene pantalla con foto de mascota y funda protectora transparente.',
    category: 'Electrónicos',
    status: 'encontrado',
    locationName: 'Puente de la Mujer, Puerto Madero',
    lat: -34.6080,
    lng: -58.3650,
    date: new Date(Date.now() - 1000 * 60 * 1100).toISOString(), // ~18 hrs ago
    imageUrl: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&auto=format&fit=crop&q=80',
    user: DEMO_USERS[2],
    createdAt: new Date(Date.now() - 1000 * 60 * 1100).toISOString(),
    contactCount: 3
  },
  {
    id: 'item_10',
    title: 'Perro Caniche Blanco rescatado en la calle',
    description: 'Encontramos un perrito caniche blanco en Av. Cabildo, cerca de Juramento. Estaba perdido y asustado. Lo cuidamos mientras aparece su dueño.',
    category: 'Mascotas',
    status: 'encontrado',
    locationName: 'Av. Cabildo 2200, Belgrano',
    lat: -34.5620,
    lng: -58.4565,
    date: new Date(Date.now() - 1000 * 60 * 150).toISOString(), // 2.5 hrs ago
    imageUrl: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=800&auto=format&fit=crop&q=80',
    user: DEMO_USERS[1],
    createdAt: new Date(Date.now() - 1000 * 60 * 150).toISOString(),
    contactCount: 4
  },
  {
    id: 'item_11',
    title: 'Billetera Marrón de Cuero extraviada',
    description: 'Se me cayó mi billetera marrón de cuero en Plaza Serrano. Contiene DNI a nombre de Martín Pérez y tarjeta SUBE. Muy importante recuperar los documentos.',
    category: 'Documentos y Billeteras',
    status: 'perdido',
    locationName: 'Plaza Serrano, Palermo Soho',
    lat: -34.5891,
    lng: -58.4310,
    date: new Date(Date.now() - 1000 * 60 * 650).toISOString(), // ~11 hrs ago
    imageUrl: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=800&auto=format&fit=crop&q=80',
    user: DEMO_USERS[3],
    createdAt: new Date(Date.now() - 1000 * 60 * 650).toISOString(),
    reward: '$5.000 Recompensa',
    contactCount: 1
  }
];

export const INITIAL_MESSAGES: Message[] = [
  {
    id: 'msg_1',
    itemId: 'item_1',
    itemTitle: 'Mochila Urbana Negra Jansport',
    itemImage: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop&q=80',
    senderId: 'u1',
    senderName: 'Ana García',
    senderAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    receiverId: 'u_me',
    text: 'Hola! Vi tu publicación de la mochila negra. ¿Sigue disponible para retirar?',
    timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    isRead: false
  },
  {
    id: 'msg_2',
    itemId: 'item_4',
    itemTitle: 'Billetera Marrón de Cuero con DNI',
    itemImage: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=800&auto=format&fit=crop&q=80',
    senderId: 'u3',
    senderName: 'Sofía Martínez',
    senderAvatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    receiverId: 'u_me',
    text: '¡Muchas gracias por publicar la billetera! Es de un amigo, ya le avisé.',
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    isRead: true
  }
];

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif_match_1',
    title: '✨ ¡Coincidencia del 94% detectada!',
    message: 'El sistema automático detectó que "Mochila Urbana Negra Jansport" encontrada en Plaza Italia coincide con tu reporte de pérdida.',
    date: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
    type: 'match',
    read: false,
    relatedItemId: 'item_8'
  },
  {
    id: 'notif_1',
    title: 'Nuevo mensaje recibido 💬',
    message: 'Ana García te envió una consulta sobre "Mochila Urbana Negra Jansport"',
    date: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    type: 'message',
    read: false,
    relatedItemId: 'item_1'
  },
  {
    id: 'notif_2',
    title: 'Objeto cercano reportado 📍',
    message: 'Se publicó una mochila en "Plaza Italia, Palermo" a 350m de tu zona.',
    date: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    type: 'match',
    read: false,
    relatedItemId: 'item_1'
  },
  {
    id: 'notif_3',
    title: '¡Objeto Recuperado! 🎉',
    message: 'Has marcado tus "Lentes de Sol Ray-Ban" como recuperados. ¡Excelente trabajo!',
    date: new Date(Date.now() - 1000 * 60 * 3600).toISOString(),
    type: 'recovered',
    read: true,
    relatedItemId: 'item_7'
  }
];
