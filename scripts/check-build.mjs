import { readFileSync, existsSync } from 'node:fs';

const fail = (msg) => { console.error(`FAIL: ${msg}`); process.exit(1); };

if (!existsSync('dist/index.html')) fail('dist/index.html missing');
if (!readFileSync('dist/index.html', 'utf8').includes('EPPING')) fail('index.html lacks "EPPING"');
if (!existsSync('dist/404.html')) fail('dist/404.html missing');
if (!existsSync('dist/CNAME')) fail('dist/CNAME missing');
if (readFileSync('dist/CNAME', 'utf8').trim() !== 'eppingmusic.com') fail('CNAME content wrong');

for (const f of ['epping-logo.svg', 'epping-white.svg', 'epping-pink.svg']) {
  const p = `dist/brand/${f}`;
  if (!existsSync(p) || !readFileSync(p, 'utf8').includes('<path')) fail(`${p} missing or has no <path`);
}
const fav = existsSync('dist/favicon.svg') ? readFileSync('dist/favicon.svg', 'utf8') : '';
if (!fav.includes('#FF2BD6') || !fav.includes('#00E5FF')) fail('favicon.svg lacks brand colors');

const brand = existsSync('dist/brand/index.html') ? readFileSync('dist/brand/index.html', 'utf8') : '';
if (!brand.includes('EPPING') || !brand.includes('noindex')) fail('dist/brand/index.html missing, or lacks EPPING/noindex');

console.log('OK: build output valid');
