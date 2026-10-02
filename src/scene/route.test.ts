import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugFromPath, pathForSlug } from './route.ts';

const S = ['rave-wedding', 'private-events', 'presents'];
test('slugFromPath handles slashes, base prefixes and unknowns', () => {
  assert.equal(slugFromPath('/rave-wedding/', S), 'rave-wedding');
  assert.equal(slugFromPath('/rave-wedding', S), 'rave-wedding');
  assert.equal(slugFromPath('/EPPING/presents/', S), 'presents');
  assert.equal(slugFromPath('/', S), null);
  assert.equal(slugFromPath('/EPPING/', S), null);
  assert.equal(slugFromPath('/nope/', S), null);
  assert.equal(slugFromPath('/presents/index.html', S), 'presents');
});
test('pathForSlug', () => {
  assert.equal(pathForSlug('presents'), '/presents/');
  assert.equal(pathForSlug(null), '/');
  assert.equal(pathForSlug('presents', '/EPPING/'), '/EPPING/presents/');
});
