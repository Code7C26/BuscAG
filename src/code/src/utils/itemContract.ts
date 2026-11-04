import type {Category,ItemStatus} from '../types';
export const ITEM_CATEGORIES=['Electrónicos','Documentos y Billeteras','Mascotas','Llaves','Mochilas y Bolsos','Indumentaria','Otros'] as const;
export function isItemCategory(value:unknown):value is Exclude<Category,'Todos'> {
  return typeof value==='string'&&(ITEM_CATEGORIES as readonly string[]).includes(value);
}
export function isItemStatus(value:unknown):value is ItemStatus {
  return value==='perdido'||value==='encontrado'||value==='recuperado';
}
