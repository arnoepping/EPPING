import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mailtoHref, whatsappHref, instagramHref, soundcloudEmbed, eventLabel } from './links.ts';

test('mailto encodes subject', () => {
  assert.equal(mailtoHref('a@b.com', 'Rave Wedding & more'), 'mailto:a@b.com?subject=Rave%20Wedding%20%26%20more');
});
test('whatsapp strips non-digits', () => {
  assert.equal(whatsappHref('+31 6-1234 5678', 'Hi!'), 'https://wa.me/31612345678?text=Hi!');
});
test('instagram strips @', () => {
  assert.equal(instagramHref('@eppingmusic'), 'https://instagram.com/eppingmusic');
});
test('soundcloud embed wraps url and colors pink', () => {
  const s = soundcloudEmbed('https://soundcloud.com/x/y');
  assert.ok(s.startsWith('https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fx%2Fy'));
  assert.ok(s.includes('color=%23ff2bd6'));
  assert.ok(s.includes('auto_play=false'));
});
test('eventLabel formats date or says soon', () => {
  assert.equal(eventLabel({ date: '2026-12-12', venue: 'X', ticketUrl: 'https://t' }), 'NEXT: 12 DEC 2026');
  assert.equal(eventLabel(null), 'NEXT EVENT SOON');
});
