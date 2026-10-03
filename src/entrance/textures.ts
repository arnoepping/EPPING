import * as THREE from 'three';

// Procedural textures drawn on a canvas: no image downloads for the walls and street.
const rand = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/** Brick wall: colour map + bump map, one tile = 2 m × 2 m (set repeat accordingly). */
export function brick(): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const S = 1024, R = rand(42);
  const c = document.createElement('canvas'), b = document.createElement('canvas');
  c.width = c.height = b.width = b.height = S;
  const x = c.getContext('2d')!, y = b.getContext('2d')!;
  x.fillStyle = '#17101a'; x.fillRect(0, 0, S, S); // mortar
  y.fillStyle = '#000'; y.fillRect(0, 0, S, S);
  const rows = 28, cols = 9, bh = S / rows, bw = S / cols, m = 5;
  for (let r = 0; r < rows; r++) {
    const off = r % 2 ? bw / 2 : 0;
    for (let k = -1; k <= cols; k++) {
      const px = k * bw + off, v = R();
      const l = 11 + v * 9, sat = 8 + R() * 12, hue = 8 + R() * 22; // dark, fairly neutral brick: the neon brings the colour
      x.fillStyle = `hsl(${hue % 360} ${sat}% ${l}%)`;
      x.fillRect(px + m / 2, r * bh + m / 2, bw - m, bh - m);
      // speckle and wear
      for (let s = 0; s < 18; s++) {
        x.fillStyle = `rgba(${R() > 0.5 ? '255,220,200' : '0,0,0'},${0.04 + R() * 0.06})`;
        x.fillRect(px + R() * bw, r * bh + R() * bh, 2 + R() * 6, 1 + R() * 3);
      }
      const g = 150 + R() * 80;
      y.fillStyle = `rgb(${g},${g},${g})`;
      y.fillRect(px + m / 2 + 1, r * bh + m / 2 + 1, bw - m - 2, bh - m - 2);
    }
  }
  const map = new THREE.CanvasTexture(c), bump = new THREE.CanvasTexture(b);
  map.colorSpace = THREE.SRGBColorSpace;
  for (const t of [map, bump]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; }
  return { map, bump };
}

/** Dark pavement tiles, one tile = 2 m × 2 m. */
export function pavement(): THREE.CanvasTexture {
  const S = 512, R = rand(7), c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d')!;
  x.fillStyle = '#0c090e'; x.fillRect(0, 0, S, S);
  const n = 7, t = S / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const l = 7 + R() * 4;
    x.fillStyle = `hsl(300 6% ${l}%)`; x.fillRect(i * t + 2, j * t + 2, t - 4, t - 4);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 8;
  return tex;
}

/** Soft round puff for smoke sprites. */
export function puff(): THREE.CanvasTexture {
  const S = 128, c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d')!, g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(c);
}
