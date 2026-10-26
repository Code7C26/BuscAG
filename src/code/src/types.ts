export type ItemStatus = 'perdido' | 'encontrado' | 'recuperado';

export type Category = 
  | 'Todos'
  | 'Electrónicos'
  | 'Documentos y Billeteras'
  | 'Mascotas'
  | 'Llaves'
  | 'Mochilas y Bolsos'
  | 'Indumentaria'
  | 'Otros';

export type FilterType = 'todos' | 'encontrados' | 'perdidos' | 'cerca';

export interface User {
  id: string;
  name: string;
  avatar: string;
  email: string;
  phone: string;
  rating: number;
  location: string;
  totalPublished: number;
  totalRecovered: number;
  verified?: boolean;
}

export interface Item {
  id: string;
  title: string;
  description: string;
  category: Category;
  status: ItemStatus;
  locationName: string;
  lat: number;
  lng: number;
  date: string; // ISO or formatted date
  imageUrl: string;
  user: User;
  distanceKm?: number;
  createdAt: string;
  reward?: string;
  contactCount?: number;
}

export interface Message {
  id: string;
  itemId: string;
  itemTitle: string;
  itemImage: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  receiverId: string;
  text: string;
  timestamp: string;
  isRead: boolean;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  date: string;
  type: 'message' | 'match' | 'system' | 'recovered';
  read: boolean;
  relatedItemId?: string;
}
