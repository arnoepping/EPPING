import { readFileSync, existsSync } from 'node:fs';

const fail = (msg) => { console.error(`FAIL: ${msg}`); process.exit(1); };

if (!existsSync('dist/index.html')) fail('dist/index.html missing');
if (!readFileSync('dist/index.html', 'utf8').includes('EPPING')) fail('index.html lacks "EPPING"');
if (!existsSync('dist/404.html')) fail('dist/404.html missing');
if (!existsSync('dist/CNAME')) fail('dist/CNAME missing');
if (readFileSync('dist/CNAME', 'utf8').trim() !== 'eppingmusic.com') fail('CNAME content wrong');

console.log('OK: build output valid');
