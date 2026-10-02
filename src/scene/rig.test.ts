import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState, scrollBy, skip, step, enter, leave, swipeDir, cameraTarget } from './rig.ts';
import { TUNNEL_LEN, FLOOR_X } from './layout.ts';

test('starts in tunnel or deep-linked floor', () => {
  assert.deepEqual(initialState(null), { mode: 'tunnel', progress: 0, focus: 1, active: null });
  assert.deepEqual(initialState(2), { mode: 'floor', progress: 1, focus: 2, active: 2 });
});
test('scroll through tunnel: 3 viewport heights reaches the hall', () => {
  let s = initialState(null);
  s = scrollBy(s, 900, 600);
  assert.equal(s.mode, 'tunnel');
  assert.equal(s.progress, 0.5);
  s = scrollBy(s, 900, 600);
  assert.equal(s.mode, 'hall');
  assert.equal(s.progress, 1);
  assert.equal(scrollBy(initialState(null), -500, 600).progress, 0);
});
test('scroll is ignored outside tunnel', () => {
  const h = skip(initialState(null));
  assert.equal(scrollBy(h, 5000, 600), h);
});
test('step clamps focus and only works in hall', () => {
  let s = skip(initialState(null));
  s = step(step(step(s, 1), 1), 1);
  assert.equal(s.focus, 2);
  s = step(step(step(s, -1), -1), -1);
  assert.equal(s.focus, 0);
  const f = enter(s);
  assert.equal(step(f, 1), f);
});
test('enter / leave', () => {
  const f = enter(skip(initialState(null)), 2);
  assert.deepEqual(f, { mode: 'floor', progress: 1, focus: 2, active: 2 });
  assert.deepEqual(leave(f), { mode: 'hall', progress: 1, focus: 2, active: null });
});
test('swipeDir needs a horizontal-dominant swipe past threshold', () => {
  assert.equal(swipeDir(-80, 10), 1);  // swipe left → next floor
  assert.equal(swipeDir(80, 10), -1);
  assert.equal(swipeDir(30, 0), 0);
  assert.equal(swipeDir(60, 90), 0);
});
test('camera targets', () => {
  assert.deepEqual(cameraTarget({ mode: 'tunnel', progress: 0.5, focus: 1, active: null }).pos, [0, 0, -TUNNEL_LEN / 2]);
  const h = cameraTarget({ mode: 'hall', progress: 1, focus: 0, active: null });
  assert.equal(h.pos[0], FLOOR_X[0]);
  const f = cameraTarget({ mode: 'floor', progress: 1, focus: 2, active: 2 });
  assert.equal(f.look[0], FLOOR_X[2]);
  assert.ok(f.pos[2] > f.look[2]); // camera in front of the floor
});

test('initialState clamps and rounds out-of-range indices', () => {
  assert.equal(initialState(9).focus, 2);
  assert.equal(initialState(9).active, 2);
  assert.equal(initialState(-1).active, 0);
  assert.equal(initialState(1.7).active, 2);
});

test('enter clamps and rounds out-of-range indices', () => {
  assert.equal(enter(skip(initialState(null)), 5).active, 2);
  assert.equal(enter(skip(initialState(null)), -1).active, 0);
  assert.equal(enter(skip(initialState(null)), 1.3).active, 1);
});

test('scrollBy ignores zero or negative viewportH', () => {
  const s = initialState(null);
  assert.equal(scrollBy(s, 900, 0), s);
  assert.equal(scrollBy(s, 900, -100), s);
});
