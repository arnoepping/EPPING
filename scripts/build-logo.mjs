// Outlines the EPPING wordmark into static SVGs. Run: npm run logo (outputs are committed).
import opentype from 'opentype.js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const C = { text: '#EDEDF3', pink: '#FF2BD6', cyan: '#00E5FF', bg: '#0A0A10' };
const buf = readFileSync('node_modules/@fontsource/unbounded/files/unbounded-latin-800-normal.woff');
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

const outline = (text, size, x = 0, y = 0) => {
  const p = font.getPath(text, x, y, size, { letterSpacing: -0.02 });
  return { d: p.toPathData(2), box: p.getBoundingBox() };
};
const layer = (d, fill, dx = 0, blend = false) =>
  `<path d="${d}" fill="${fill}"${dx ? ` transform="translate(${dx} 0)"` : ''}${blend ? ' style="mix-blend-mode:screen"' : ''}/>`;
const r = (n) => +n.toFixed(2);

function wordmark(body) {
  const { d, box } = outline('EPPING', 100);
  const off = r(0.03 * (box.y2 - box.y1)); // 3% of cap height
  const pad = 4;
  const vb = [box.x1 - off - pad, box.y1 - pad, box.x2 - box.x1 + 2 * (off + pad), box.y2 - box.y1 + 2 * pad].map(r);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(' ')}" role="img" aria-label="EPPING">${body(d, off)}</svg>\n`;
}

function favicon() {
  const size = 46;
  const b = outline('E', size).box;
  const { d } = outline('E', size, r(32 - (b.x1 + b.x2) / 2), r(32 - (b.y1 + b.y2) / 2));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="${C.bg}"/>${layer(d, C.cyan, -2, true)}${layer(d, C.pink, 2, true)}${layer(d, C.text)}</svg>\n`;
}

mkdirSync('public/brand', { recursive: true });
writeFileSync('public/brand/epping-logo.svg', wordmark((d, o) => layer(d, C.cyan, -o, true) + layer(d, C.pink, o, true) + layer(d, C.text)));
writeFileSync('public/brand/epping-white.svg', wordmark((d) => layer(d, C.text)));
writeFileSync('public/brand/epping-pink.svg', wordmark((d) => layer(d, C.pink)));
writeFileSync('public/favicon.svg', favicon());
console.log('logo: wrote public/brand/*.svg and public/favicon.svg');
