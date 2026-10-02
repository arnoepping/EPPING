import * as THREE from 'three';

/** Neon text sprite. Scale: 1 world unit ≈ 64px of canvas. */
export function makeLabel(text: string, color: string, sub?: string): THREE.Sprite {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d')!;
  ctx.font = '800 72px Unbounded, "Arial Black", sans-serif';
  const w = Math.ceil(ctx.measureText(text).width) + 80;
  c.width = w; c.height = sub ? 200 : 140;
  ctx.font = '800 72px Unbounded, "Arial Black", sans-serif';
  ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  ctx.shadowColor = color; ctx.shadowBlur = 24; ctx.fillStyle = color;
  ctx.fillText(text, w / 2, 70);
  ctx.shadowBlur = 0; ctx.fillStyle = '#EDEDF3'; ctx.fillText(text, w / 2, 70);
  if (sub) { ctx.font = '500 30px "JetBrains Mono", monospace'; ctx.fillStyle = '#9494A8'; ctx.fillText(sub.toUpperCase(), w / 2, 160); }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
  s.scale.set(c.width / 64, c.height / 64, 1);
  return s;
}
