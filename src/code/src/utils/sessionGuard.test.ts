import { it } from 'node:test';
import assert from 'node:assert/strict';
import { createSessionGuard } from './sessionGuard';
import { isValidCoordinates, getDistanceKm } from './geo';
it('invalidates previous operations while permitting a new component lifetime', () => {
  const guard = createSessionGuard();
  const old = guard.capture();
  guard.invalidate();
  assert.equal(old(), false);
  assert.equal(guard.capture()(), true);
  guard.close();
  assert.equal(guard.capture()(), false);
});
it('accepts zero/boundaries and rejects malformed legacy coordinates without coercion', () => {
  for (const [lat, lng] of [[0, 0], [90, 180], [-90, -180]]) assert.equal(isValidCoordinates(lat, lng), true);
  for (const [lat, lng] of [[null, 0], ['0', 0], [NaN, 0], [Infinity, 0], [91, 0], [0, -181], [undefined, 0]]) {
    assert.equal(isValidCoordinates(lat, lng), false);
  }
  assert.equal(Number.isNaN(getDistanceKm(NaN, 0, 0, 0)), true);
  assert.equal(getDistanceKm(0, 0, 0, 0), 0);
});
