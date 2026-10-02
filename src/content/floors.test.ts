import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FLOORS, SLUGS, floorBySlug } from './floors.ts';

test('three floors in spec order', () => {
  assert.deepEqual(SLUGS, ['rave-wedding', 'private-events', 'presents']);
  assert.deepEqual(FLOORS.map((f) => f.bpm), [126, 124, 138]);
});
test('every floor is complete', () => {
  for (const f of FLOORS) {
    assert.ok(f.name && f.headline && f.tagline, f.slug);
    assert.ok(f.lines.length >= 2 && f.lines.length <= 3, `${f.slug} needs 2-3 lines`);
    assert.match(f.soundcloudUrl, /^https:\/\/soundcloud\.com\//);
    assert.ok(f.slug === 'presents' ? f.presents && !f.booking : f.booking && !f.presents, `${f.slug} cta shape`);
  }
});
test('floorBySlug', () => {
  assert.equal(floorBySlug('presents')?.name, 'Epping Presents');
  assert.equal(floorBySlug('nope'), undefined);
});
