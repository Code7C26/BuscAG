import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Item } from '../types';
import { compareTwoItems, findAllMatches } from './matcher';

const createItem = (overrides: Partial<Item> = {}): Item => ({
  id: 'item-1',
  title: 'Canon camera negra',
  description: 'Funda roja con una marca distintiva',
  category: 'Electrónicos',
  status: 'perdido',
  locationName: 'Plaza central',
  lat: -34.6037,
  lng: -58.3816,
  date: '2026-10-01T10:00:00.000Z',
  imageUrl: '',
  user: {
    id: 'user-1',
    name: 'Usuario de prueba',
    avatar: '',
    email: '',
    phone: '',
    rating: 5,
    location: '',
    totalPublished: 0,
    totalRecovered: 0
  },
  createdAt: '2026-10-01T10:00:00.000Z',
  ...overrides
});

const createPair = (lostOverrides: Partial<Item> = {}, foundOverrides: Partial<Item> = {}) =>
  [
    createItem(lostOverrides),
    createItem({ id: 'item-2', status: 'encontrado', date: '2026-10-01T11:00:00.000Z', ...foundOverrides })
  ] as const;

describe('matcher', () => {
  it('matches same-category reports with matching details and nearby dates', () => {
    const [lost, found] = createPair();
    const result = compareTwoItems(lost, found);

    assert.ok(result);
    assert.equal(result.score, 100);
    assert.deepEqual(result.matchedKeywords, ['canon', 'camera', 'negra', 'funda', 'roja', 'marca', 'distintiva']);
  });

  it('rejects different categories', () => {
    const [lost, found] = createPair({}, { category: 'Llaves' });
    assert.equal(compareTwoItems(lost, found), null);
  });

  it('rejects invalid coordinates and dates', () => {
    const [lost, found] = createPair({ lat: Number.NaN });
    assert.equal(compareTwoItems(lost, found), null);

    const [anotherLost, anotherFound] = createPair({}, { date: 'not-a-date' });
    assert.equal(compareTwoItems(anotherLost, anotherFound), null);
  });

  it('rejects a found report dated more than 24 hours before the loss', () => {
    const [lost, found] = createPair({}, { date: '2026-09-29T00:00:00.000Z' });
    assert.equal(compareTwoItems(lost, found), null);
  });

  it('only compares found reports from matching categories', () => {
    const [lost, found] = createPair();
    const unrelated = createItem({ id: 'item-3', status: 'encontrado', category: 'Llaves' });

    assert.deepEqual(findAllMatches([lost, found, unrelated]).map(match => match.id), ['match_item-1_item-2']);
  });
  it('keeps location-only suggestions at medium confidence and invalidates cached text', () => {
    const [lost,found] = createPair({title:'roble caracol',description:'montaña naranja'}, {title:'lámpara violeta',description:'bicicleta azul'});
    assert.equal(compareTwoItems(lost,found)?.confidence,'media');
    lost.title=found.title;lost.description=found.description;
    assert.ok((compareTwoItems(lost,found)?.matchedKeywords.length ?? 0)>0);
  });
});
