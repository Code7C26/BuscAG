import type {Category,ItemStatus} from '../types';
export const ITEM_CATEGORIES=['Electrónicos','Documentos y Billeteras','Mascotas','Llaves','Mochilas y Bolsos','Indumentaria','Otros'] as const;
export function isItemCategory(value:unknown):value is Exclude<Category,'Todos'> {
  return typeof value==='string'&&(ITEM_CATEGORIES as readonly string[]).includes(value);
}
export function isItemStatus(value:unknown):value is ItemStatus {
  return value==='perdido'||value==='encontrado'||value==='recuperado';
}

/** PostgreSQL char_length counts Unicode code points, not UTF-16 code units.
 * Validate before uploading; SQL remains authoritative for every write.
 * Unchanged legacy over-limit text follows the SQL trigger's changed-field rule. */
type PublicationText={title:string;description:string;locationName:string;reward?:string|null};
export function publicationTextError(input:PublicationText,previous?:PublicationText):string {
  const fields = [
    ['title',200,'El título'],
    ['description',10000,'La descripción'],
    ['locationName',300,'La ubicación'],
  ] as const;
  for (const [field,limit,label] of fields) {
    const value=input[field];
    if (!value.trim()) return `${label} es obligatorio.`;
    if (value!==previous?.[field] && Array.from(value).length>limit) return `${label} admite hasta ${limit} caracteres.`;
    if (value.includes('\u0000')) return `${label} contiene un carácter no válido.`;
  }
  if (input.reward!==previous?.reward && Array.from(input.reward??'').length>200) return 'La recompensa admite hasta 200 caracteres.';
  if (input.reward?.includes('\u0000')) return 'La recompensa contiene un carácter no válido.';
  return '';
}
