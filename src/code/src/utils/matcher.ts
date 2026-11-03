/**
 * MOTOR DE MATCH AUTOMÁTICO (matcher.ts)
 * Algoritmo inteligente para comparar publicaciones de objetos perdidos
 * con objetos encontrados y sugerir coincidencias altamente probables.
 *
 * Criterios de evaluación:
 * 1. Categoría: Deben coincidir exactamente (filtro excluyente).
 * 2. Similitud de texto y palabras clave: Marcas, colores, modelos y descripción.
 * 3. Proximidad geográfica: Distancia en kilómetros entre el lugar de pérdida y hallazgo.
 * 4. Proximidad temporal: Coherencia de fechas (el hallazgo debe ser contemporáneo o posterior a la pérdida).
 */

import { Item, MatchResult } from '../types';
import { itemDateTime } from './itemDate';
import { getDistanceKm } from './geo';

// Palabras vacías en español a ignorar en la tokenización para enfocar en palabras distintivas
const STOP_WORDS = new Set([
  'de', 'la', 'el', 'en', 'y', 'a', 'los', 'del', 'se', 'las', 'por', 'un', 'para',
  'con', 'no', 'una', 'su', 'al', 'lo', 'como', 'mas', 'pero', 'sus', 'le', 'ya',
  'o', 'fue', 'este', 'ha', 'si', 'porque', 'esta', 'son', 'entre', 'esta', 'cuando',
  'muy', 'sin', 'sobre', 'ser', 'tiene', 'tambien', 'me', 'hasta', 'hay', 'donde',
  'quien', 'desde', 'todo', 'nos', 'durante', 'todos', 'uno', 'les', 'ni', 'contra',
  'otros', 'ese', 'eso', 'ante', 'ellos', 'e', 'esto', 'mi', 'antes', 'algunos',
  'unos', 'yo', 'otro', 'otras', 'otra', 'él', 'tanto', 'esa', 'estos', 'mucho',
  'quienes', 'nada', 'muchos', 'cual', 'sea', 'poco', 'ella', 'estar', 'estas',
  'algunas', 'algo', 'nosotros', 'mi', 'mis', 'tu', 'tus', 'cerca', 'alrededor',
  'tiradas', 'olvidada', 'olvidado', 'encontre', 'perdi', 'extravio', 'recuperado',
  'av', 'avenida', 'calle', 'plaza'
]);

/**
 * Normaliza y divide una cadena en palabras clave relevantes
 */
export function extractKeywords(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quita tildes
    .replace(/[^a-z0-9\s]/g, ' ')   // Solo letras y números
    .split(/\s+/)
    .filter(word => word.length >= 3 && !STOP_WORDS.has(word));
}

/**
 * Calcula la similitud de Jaccard entre dos conjuntos de palabras clave
 */
function calculateKeywordOverlap(words1: string[], words2: string[]): {
  overlapScore: number;
  matchedWords: string[];
} {
  const set1 = new Set(words1);
  const matchedWords = [...new Set(words2)].filter(word => set1.has(word));
  const unionSize = new Set([...set1, ...words2]).size;
  if (unionSize === 0) return { overlapScore: 0, matchedWords: [] };

  const overlapScore = matchedWords.length / unionSize;
  return { overlapScore, matchedWords };
}

// Cache tokenization only while both source strings remain unchanged. Weak keys
// do not retain account data after its item objects are released.
const keywordCache = new WeakMap<Item,{title:string;description:string;words:string[]}>();
function itemKeywords(item: Item): string[] {
  const cached = keywordCache.get(item);
  if (cached?.title === item.title && cached.description === item.description) return cached.words;
  const words = [...extractKeywords(item.title),...extractKeywords(item.description)];
  keywordCache.set(item,{title:item.title,description:item.description,words});
  return words;
}

/**
 * Compara un objeto perdido con un objeto encontrado y devuelve el resultado del match
 * Si la puntuación mínima no se alcanza, devuelve null.
 */
export function compareTwoItems(lostItem: Item, foundItem: Item): MatchResult | null {
  // 1. REGLA FUNDAMENTAL: Ambos deben pertenecer a la misma categoría
  if (lostItem.category !== foundItem.category) {
    return null;
  }

  // Si alguno está recuperado o ambos tienen el mismo estado, no hacemos match
  if (lostItem.status !== 'perdido' || foundItem.status !== 'encontrado') {
    return null;
  }

  const coordinates = [lostItem.lat, lostItem.lng, foundItem.lat, foundItem.lng];
  if (
    coordinates.some(value => !Number.isFinite(value)) ||
    Math.abs(lostItem.lat) > 90 || Math.abs(foundItem.lat) > 90 ||
    Math.abs(lostItem.lng) > 180 || Math.abs(foundItem.lng) > 180
  ) {
    return null;
  }

  const lostTime = itemDateTime(lostItem.date);
  const foundTime = itemDateTime(foundItem.date);
  if (!Number.isFinite(lostTime) || !Number.isFinite(foundTime)) return null;

  const timeDiffHours = Math.abs(foundTime - lostTime) / (1000 * 60 * 60);
  if (foundTime < lostTime && timeDiffHours > 24) return null;

  const reasons: string[] = [];

  // Categoría idéntica confirmada
  reasons.push(`Misma categoría: ${lostItem.category}`);

  // 2. SIMILITUD DE TEXTO (TÍTULO Y DESCRIPCIÓN)
  const lostKeywords = itemKeywords(lostItem);
  const foundKeywords = itemKeywords(foundItem);

  const { matchedWords } = calculateKeywordOverlap(lostKeywords, foundKeywords);

  let textScore = 0;
  if (matchedWords.length >= 3) {
    textScore = 100;
    reasons.push(`Alta coincidencia de términos (${matchedWords.slice(0, 4).join(', ')})`);
  } else if (matchedWords.length === 2) {
    textScore = 75;
    reasons.push(`Coincidencia en palabras clave: "${matchedWords.join('", "')}"`);
  } else if (matchedWords.length === 1) {
    textScore = 45;
    reasons.push(`Término coincidente: "${matchedWords[0]}"`);
  } else {
    // Si no hay palabras exactas, verificamos si una palabra contiene a otra (ej: jansport)
    const partialMatches = lostKeywords.filter(lostWord =>
      lostWord.length >= 5 && foundKeywords.some(foundWord => {
        const shorterLength = Math.min(lostWord.length, foundWord.length);
        const longerLength = Math.max(lostWord.length, foundWord.length);
        return shorterLength >= 5 && shorterLength / longerLength >= 0.75 &&
          (foundWord.includes(lostWord) || lostWord.includes(foundWord));
      })
    );
    if (partialMatches.length > 0) {
      textScore = 30;
      reasons.push(`Términos similares detectados`);
    } else {
      textScore = 10;
    }
  }

  // 3. PROXIMIDAD GEOGRÁFICA (Distancia GPS con Haversine)
  const distanceKm = getDistanceKm(lostItem.lat, lostItem.lng, foundItem.lat, foundItem.lng);
  let geoScore = 0;

  if (distanceKm <= 1.0) {
    geoScore = 100;
    reasons.push(`Extremadamente cercanos: a solo ${(distanceKm * 1000).toFixed(0)} metros`);
  } else if (distanceKm <= 3.0) {
    geoScore = 85;
    reasons.push(`Misma zona geográfica: a ${distanceKm.toFixed(1)} km`);
  } else if (distanceKm <= 6.0) {
    geoScore = 60;
    reasons.push(`Distancia moderada (${distanceKm.toFixed(1)} km)`);
  } else if (distanceKm <= 12.0) {
    geoScore = 35;
    reasons.push(`Misma ciudad (${distanceKm.toFixed(1)} km)`);
  } else {
    geoScore = 15;
  }

  // 4. PROXIMIDAD TEMPORAL
  let timeScore = 50;
  if (foundTime >= lostTime) {
    // Encontrado después de perdido (lo ideal)
    if (timeDiffHours <= 12) {
      timeScore = 100;
      reasons.push(`Fechas muy próximas (menos de 12 horas de diferencia)`);
    } else if (timeDiffHours <= 48) {
      timeScore = 85;
      reasons.push(`Encontrado dentro de las 48 horas de la pérdida`);
    } else if (timeDiffHours <= 168) {
      timeScore = 60;
      reasons.push(`Encontrado la misma semana`);
    } else {
      timeScore = 30;
    }
  } else {
    // Encontrado antes de reportar la pérdida (a menudo la gente reporta horas después)
    if (timeDiffHours <= 24) {
      timeScore = 75;
      reasons.push(`Fechas cercanas compatibles`);
    } else {
      timeScore = 20;
    }
  }

  // PONDERACIÓN DEL PUNTAJE TOTAL:
  // - Texto y palabras clave: 50%
  // - Proximidad geográfica: 35%
  // - Proximidad temporal: 15%
  const totalScore = Math.round((textScore * 0.50) + (geoScore * 0.35) + (timeScore * 0.15));

  // Umbral mínimo de coincidencia para sugerir (mínimo 45%)
  if (totalScore < 40) {
    return null;
  }

  let confidence: 'muy_alta' | 'alta' | 'media' = 'media';
  if (totalScore >= 75) {
    confidence = 'muy_alta';
  } else if (totalScore >= 55) {
    confidence = 'alta';
  }

  if (textScore === 10) confidence = 'media';

  return {
    id: `match_${lostItem.id}_${foundItem.id}`,
    lostItem,
    foundItem,
    score: totalScore,
    confidence,
    reasons,
    distanceKm,
    matchedKeywords: matchedWords
  };
}

/**
 * Busca todas las coincidencias para un objeto específico.
 * Si es 'perdido', lo compara con todos los 'encontrados'.
 * Si es 'encontrado', lo compara con todos los 'perdidos'.
 */
export function findMatchesForSingleItem(targetItem: Item, allItems: Item[]): MatchResult[] {
  if (targetItem.status === 'recuperado') return [];

  const results: MatchResult[] = [];

  if (targetItem.status === 'perdido') {
    const foundItems = allItems.filter(i => i.status === 'encontrado' && i.category === targetItem.category);
    for (const found of foundItems) {
      const match = compareTwoItems(targetItem, found);
      if (match) results.push(match);
    }
  } else if (targetItem.status === 'encontrado') {
    const lostItems = allItems.filter(i => i.status === 'perdido' && i.category === targetItem.category);
    for (const lost of lostItems) {
      const match = compareTwoItems(lost, targetItem);
      if (match) results.push(match);
    }
  }

  // Ordenamos de mayor a menor coincidencia
  return results.sort((a, b) => b.score - a.score);
}

/**
 * Evalúa toda la base de datos de publicaciones y devuelve todos los pares compatibles.
 */
export function findAllMatches(allItems: Item[]): MatchResult[] {
  const lostItems = allItems.filter(i => i.status === 'perdido');
  const foundByCategory = new Map<Item['category'], Item[]>();
  for (const item of allItems) {
    if (item.status !== 'encontrado') continue;
    const categoryItems = foundByCategory.get(item.category) ?? [];
    categoryItems.push(item);
    foundByCategory.set(item.category, categoryItems);
  }

  const matches: MatchResult[] = [];

  for (const lost of lostItems) {
    for (const found of foundByCategory.get(lost.category) ?? []) {
      const result = compareTwoItems(lost, found);
      if (result) matches.push(result);
    }
  }

  // Ordena por puntuación descendente
  return matches.sort((a, b) => b.score - a.score);
}
