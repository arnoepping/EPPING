# Brand Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the EPPING logo SVGs, favicon, design tokens and a noindex `/brand/` page.

**Architecture:** A one-off Node script outlines the wordmark from the Unbounded 800 font into static SVGs, which are committed. `tokens.css` and `ui.css` hold all brand values, `Base.astro` loads them, and `Wordmark.astro` is the animated CSS logo. `/brand/` is built only from those pieces.

**Tech Stack:** Astro 7, opentype.js 2, @fontsource/unbounded, plain CSS.

**Spec:** `docs/superpowers/specs/2026-10-02-brand-identity-design.md`

## Global Constraints
- Colors: bg `#0A0A10`, surface `#13131C`, line `#262634`, text `#EDEDF3`, muted `#9494A8`, pink `#FF2BD6` (primary accent), cyan `#00E5FF` (secondary).
- Fonts: Unbounded 500/800 (display), Archivo 400/500/600 (body), JetBrains Mono 400/500 (labels and buttons), from Google Fonts.
- Wordmark: `EPPING`, Unbounded 800, letter-spacing −0.02em, text on top of a cyan copy offset −x and a pink copy offset +x, with `screen` blend.
- Sharp corners (radius 0) on UI elements.
- The only test is `npm run build && npm test` (`scripts/check-build.mjs`). Always build before testing.
- Don't push. Commit only.
- Links to page assets are relative where possible, because the site is temporarily served under `/EPPING/`.

## Review Focus
1. Glitch animation under `prefers-reduced-motion`: the pseudo-layers stay as a static offset and don't animate. Covered by a CSS rule in Task 2, checked by inspecting the built CSS in Task 2 Step 6.
2. `/brand/` at 360px wide must not scroll horizontally, even with the huge wordmark. Checked by the Playwright check in Task 2 Step 6.
3. SVGs open correctly as standalone files: valid `viewBox`, `xmlns`, nothing clipped. Checked by viewing a rendered screenshot in Task 1 Step 6.
4. Favicon is readable at 16px: a single "E", high contrast. Checked visually in Task 1 Step 6.
5. Re-running `npm run logo` is deterministic, so it produces no diff. Checked in Task 1 Step 7.

---

### Task 1: Logo SVGs + favicon

**Files:**
- Create: `scripts/build-logo.mjs`
- Create (generated): `public/brand/epping-logo.svg`, `public/brand/epping-white.svg`, `public/brand/epping-pink.svg`
- Replace (generated): `public/favicon.svg`
- Delete: `public/favicon.ico`
- Modify: `scripts/check-build.mjs`, `package.json`

**Interfaces:**
- Produces: `/brand/epping-logo.svg`, `/brand/epping-white.svg`, `/brand/epping-pink.svg`, `/favicon.svg`; npm script `logo`.

- [ ] **Step 1: Add failing checks** to `scripts/check-build.mjs`, before the final `console.log`:

```js
for (const f of ['epping-logo.svg', 'epping-white.svg', 'epping-pink.svg']) {
  const p = `dist/brand/${f}`;
  if (!existsSync(p) || !readFileSync(p, 'utf8').includes('<path')) fail(`${p} missing or has no <path`);
}
const fav = existsSync('dist/favicon.svg') ? readFileSync('dist/favicon.svg', 'utf8') : '';
if (!fav.includes('#FF2BD6') || !fav.includes('#00E5FF')) fail('favicon.svg lacks brand colors');
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npm run build && npm test`
Expected: `FAIL: dist/brand/epping-logo.svg missing or has no <path`

- [ ] **Step 3: Install deps and write the generator**

```bash
npm i -D opentype.js@2 @fontsource/unbounded
```

Add to `package.json` scripts: `"logo": "node scripts/build-logo.mjs"`.

`scripts/build-logo.mjs`:

```js
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
```

- [ ] **Step 4: Generate, then remove the old ico**

```bash
npm run logo && git rm -q public/favicon.ico && grep -rn "favicon.ico" src || true
```
Expected: `logo: wrote ...`, and no `src` references to `favicon.ico`.

- [ ] **Step 5: Run, expect PASS**

Run: `npm run build && npm test`
Expected: `OK: build output valid`

- [ ] **Step 6: Visual check.** Render the SVGs on the brand background and look at the PNG:

```bash
node -e "
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:900,height:520}});
const fs=require('fs');const s=f=>fs.readFileSync('public/'+f,'utf8');
await p.setContent('<body style=\"margin:0;background:#0A0A10;display:grid;gap:24px;padding:24px\">'+['brand/epping-logo.svg','brand/epping-white.svg','brand/epping-pink.svg'].map(f=>'<div style=\"width:600px\">'+s(f)+'</div>').join('')+'<div style=\"display:flex;gap:16px\"><div style=\"width:64px\">'+s('favicon.svg')+'</div><div style=\"width:16px\">'+s('favicon.svg')+'</div></div></body>');
require('fs').mkdirSync('.superpowers/shots',{recursive:true});await p.screenshot({path:'.superpowers/shots/brand-svgs.png'});await b.close()})()"
```
Open `.superpowers/shots/brand-svgs.png` with the Read tool. Check that nothing is clipped, the RGB split shows cyan on the left edges and pink on the right, and the "E" is centered and readable at 16px. If not, adjust `pad`/`size`, regenerate and re-shoot.

- [ ] **Step 7: Determinism check**

```bash
npm run logo && git status --short public/
```
Expected: only the new and changed files from Step 4, with no extra churn on a second run (`git diff --stat` is unchanged between the two runs).

- [ ] **Step 8: Commit**

```bash
git add scripts/build-logo.mjs scripts/check-build.mjs package.json package-lock.json public/brand public/favicon.svg
git commit -m "Brand: outlined logo SVGs and RGB-split favicon"
```

---

### Task 2: Tokens, base layout, wordmark, /brand/ page

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/ui.css`, `src/layouts/Base.astro`, `src/components/Wordmark.astro`, `src/pages/brand.astro`
- Modify: `scripts/check-build.mjs`

**Interfaces:**
- Consumes: SVGs from Task 1.
- Produces (used by the site plan):
  - `Base.astro`: props `{ title: string; description?: string; noindex?: boolean; ogImage?: string }`, a default slot and a `head` slot.
  - `Wordmark.astro`: props `{ tag?: 'h1' | 'div' | 'span'; size?: string }`. It renders the `.glitch` element; `size` is a CSS length (default `clamp(64px,17vw,200px)`).
  - CSS custom properties `--bg --surface --line --text --muted --pink --cyan --grad --display --body --mono`.
  - Classes `.label`, `.btn`, `.btn.primary`, `.card`, `.field`, `.wrap`.

- [ ] **Step 1: Add failing check** to `scripts/check-build.mjs`, before the final `console.log`:

```js
const brand = existsSync('dist/brand/index.html') ? readFileSync('dist/brand/index.html', 'utf8') : '';
if (!brand.includes('EPPING') || !brand.includes('noindex')) fail('dist/brand/index.html missing, or lacks EPPING/noindex');
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npm run build && npm test`
Expected: `FAIL: dist/brand/index.html missing, or lacks EPPING/noindex`

- [ ] **Step 3: Write the styles**

`src/styles/tokens.css`:

```css
:root{
  color-scheme: dark;
  --bg:#0A0A10; --surface:#13131C; --line:#262634;
  --text:#EDEDF3; --muted:#9494A8;
  --pink:#FF2BD6;   /* primary accent */
  --cyan:#00E5FF;   /* secondary accent */
  --grad:linear-gradient(90deg,var(--cyan),var(--pink));
  --display:"Unbounded","Arial Black",system-ui,sans-serif;
  --body:"Archivo","Helvetica Neue",Arial,sans-serif;
  --mono:"JetBrains Mono",ui-monospace,Menlo,monospace;
}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--text);font:400 17px/1.6 var(--body);-webkit-font-smoothing:antialiased}
a{color:inherit}
:focus-visible{outline:2px solid var(--cyan);outline-offset:3px}
img,svg{max-width:100%;display:block}
```

`src/styles/ui.css`:

```css
.wrap{max-width:1080px;margin:0 auto;padding-inline:16px}
.label{font:500 12px/1 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.btn{display:inline-flex;align-items:center;gap:10px;padding:14px 22px;font:500 13px/1 var(--mono);letter-spacing:.1em;text-transform:uppercase;text-decoration:none;color:var(--text);background:transparent;border:1px solid var(--text);border-radius:0;cursor:pointer;transition:background .15s,color .15s,box-shadow .15s}
.btn.primary{background:var(--pink);border-color:var(--pink);color:var(--bg)}
.btn:hover{box-shadow:-3px 0 0 var(--cyan),3px 0 0 var(--pink)}
.card{background:var(--surface);border:1px solid var(--line);padding:22px 24px}
.field{display:grid;gap:8px}
.field label{font:500 11px/1 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.field input{font:400 16px/1.4 var(--body);color:var(--text);background:var(--surface);border:1px solid var(--line);padding:13px 14px;border-radius:0;width:100%}
.field input:focus{outline:none;border-color:var(--cyan)}
.scanlines{position:relative}
.scanlines::after{content:"";position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,transparent 0 3px,rgba(255,255,255,.025) 3px 4px)}
```

- [ ] **Step 4: Write the layout and wordmark**

`src/layouts/Base.astro`:

```astro
---
import '../styles/tokens.css';
import '../styles/ui.css';
interface Props { title: string; description?: string; noindex?: boolean; ogImage?: string }
const { title, description = 'EPPING: rave weddings, private events and our own parties.', noindex = false, ogImage } = Astro.props;
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>{title}</title>
    <meta name="description" content={description} />
    {noindex && <meta name="robots" content="noindex" />}
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    {ogImage && <meta property="og:image" content={new URL(ogImage, Astro.site)} />}
    <meta name="theme-color" content="#0A0A10" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Unbounded:wght@500;800&family=Archivo:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" />
    <slot name="head" />
  </head>
  <body>
    <slot />
  </body>
</html>
```

`src/components/Wordmark.astro` (glitch ported from the reference site, magenta → pink):

```astro
---
interface Props { tag?: 'h1' | 'div' | 'span'; size?: string }
const { tag: Tag = 'div', size = 'clamp(64px,17vw,200px)' } = Astro.props;
---
<Tag class="glitch" data-text="EPPING" style={`--wm-size:${size}`}>EPPING</Tag>
<style>
  .glitch{position:relative;display:inline-block;font:800 var(--wm-size)/.9 var(--display);letter-spacing:-.02em;margin:0;color:var(--text)}
  .glitch::before,.glitch::after{content:attr(data-text);position:absolute;inset:0;mix-blend-mode:screen}
  .glitch::before{color:var(--cyan);transform:translate(-.02em,0);animation:gA 4.2s infinite steps(1)}
  .glitch::after{color:var(--pink);transform:translate(.02em,0);animation:gB 4.2s infinite steps(1)}
  @keyframes gA{0%,86%,100%{transform:translate(-.02em,0);clip-path:none}88%{transform:translate(-.05em,.01em);clip-path:inset(12% 0 55% 0)}91%{transform:translate(.03em,-.01em);clip-path:inset(60% 0 8% 0)}94%{transform:translate(-.02em,0);clip-path:none}}
  @keyframes gB{0%,86%,100%{transform:translate(.02em,0);clip-path:none}88%{transform:translate(.05em,-.01em);clip-path:inset(48% 0 20% 0)}91%{transform:translate(-.03em,.01em);clip-path:inset(5% 0 70% 0)}94%{transform:translate(.02em,0);clip-path:none}}
  @media (prefers-reduced-motion:reduce){.glitch::before,.glitch::after{animation:none}}
</style>
```

- [ ] **Step 5: Write the brand page** `src/pages/brand.astro`:

```astro
---
import Base from '../layouts/Base.astro';
import Wordmark from '../components/Wordmark.astro';
const colors = [
  ['Black', '--bg', '#0A0A10', 'Background, always'],
  ['Pink', '--pink', '#FF2BD6', 'Primary accent: CTAs, highlights, quotes'],
  ['Cyan', '--cyan', '#00E5FF', 'Secondary: links, focus, hover'],
  ['Text', '--text', '#EDEDF3', 'Body and headings'],
  ['Muted', '--muted', '#9494A8', 'Secondary text, labels'],
  ['Surface', '--surface', '#13131C', 'Cards, inputs'],
  ['Line', '--line', '#262634', 'Borders, dividers'],
];
const files = [['epping-logo.svg', 'RGB split'], ['epping-white.svg', 'White'], ['epping-pink.svg', 'Pink']];
---
<Base title="Brand | EPPING" noindex>
  <main class="wrap brand">
    <section class="scanlines hero"><span class="label">Brand book</span><Wordmark tag="h1" /></section>

    <section>
      <h2>Logo</h2>
      <div class="grid3">
        {files.map(([f, name]) => (
          <figure class="card"><img src={f} alt={`EPPING logo, ${name}`} /><figcaption class="label">{name} · <a href={f} download>SVG</a></figcaption></figure>
        ))}
      </div>
      <ul class="rules">
        <li><b>Do</b> keep clear space of at least the height of the "E" around the logo.</li>
        <li><b>Do</b> use the RGB-split logo on black only.</li>
        <li><b>Don't</b> recolor outside the palette, stretch, rotate or outline it.</li>
        <li><b>Don't</b> put the RGB-split version on light or busy backgrounds; use white or pink instead.</li>
      </ul>
    </section>

    <section>
      <h2>Color</h2>
      <div class="swatches">
        {colors.map(([name, v, hex, role]) => (
          <div class="swatch"><div class="chip" style={`background:var(${v})`}></div><p><b>{name}</b> <code>{hex}</code><br /><span>{role}</span></p></div>
        ))}
      </div>
      <div class="gradbar" aria-hidden="true"></div>
      <p class="label">Gradient: cyan → pink, for meters and accents only</p>
    </section>

    <section>
      <h2>Type</h2>
      <p class="t-display">Unbounded 800: Rave Wedding</p>
      <p class="t-display500">Unbounded 500: The night builds to a floor that won't stop.</p>
      <p>Archivo 400/17px: Body copy. Short, punchy, no fluff. ABBA to acid.</p>
      <p class="label">JetBrains Mono 500/12px: labels, buttons, metadata</p>
    </section>

    <section>
      <h2>UI</h2>
      <div class="ui">
        <a class="btn primary" href="#">Book now</a>
        <a class="btn" href="#">Listen</a>
        <span class="label">DJ · Amsterdam</span>
      </div>
      <div class="card ui-card"><span class="label">Floor 01</span><h3>Rave Wedding</h3><p>From the first dance to the last drop.</p></div>
      <div class="field"><label for="demo">Email</label><input id="demo" placeholder="you@example.com" /></div>
    </section>
  </main>
</Base>
<style>
  .brand{display:grid;gap:72px;padding-block:48px 96px}
  .hero{display:grid;gap:16px;padding:32px 0;overflow:hidden}
  h2{font:800 clamp(24px,5vw,36px)/1.1 var(--display);margin:0 0 20px}
  h3{font:800 20px/1.2 var(--display);margin:8px 0}
  .grid3{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:12px}
  figure{margin:0;display:grid;gap:14px}
  .rules{padding-left:18px;color:var(--muted)} .rules b{color:var(--text)}
  .swatches{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr));gap:12px}
  .swatch{border:1px solid var(--line)} .chip{height:72px} .swatch p{margin:0;padding:10px;font-size:14px;line-height:1.4}
  .swatch span{color:var(--muted)} code{font-family:var(--mono);font-size:12px}
  .gradbar{height:8px;background:var(--grad);margin:20px 0 8px}
  .t-display{font:800 clamp(24px,6vw,44px)/1.1 var(--display);margin:0 0 12px}
  .t-display500{font:500 clamp(18px,3vw,24px)/1.3 var(--display);margin:0 0 12px}
  .ui{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:20px}
  .ui-card{max-width:420px;margin-bottom:20px} .ui-card p{margin:0;color:var(--muted)}
  .field{max-width:420px}
</style>
```

- [ ] **Step 6: Run, expect PASS; visual and overflow check**

Run: `npm run build && npm test`
Expected: `OK: build output valid`

Then check reduced motion in the built CSS: `grep -l "prefers-reduced-motion" dist/_astro/*.css` must print a file.

Shoot `/brand/` at 360px and 1440px, and assert there's no horizontal scroll:

```bash
(npx astro preview --port 4329 >/dev/null 2>&1 &) ; sleep 3
node -e "
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();
for (const w of [360,1440]){const p=await b.newPage({viewport:{width:w,height:900}});await p.goto('http://localhost:4329/brand/');await p.waitForTimeout(800);
const o=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth);if(o)throw new Error('horizontal overflow at '+w);
await p.screenshot({path:'.superpowers/shots/brand-'+w+'.png',fullPage:true});}
await b.close();console.log('shots ok')})()"
pkill -f "astro preview --port 4329"
```
Expected: `shots ok`. Open both PNGs with Read and check: wordmark glitch layers visible, swatches correct, no clipping.

- [ ] **Step 7: Commit**

```bash
git add src/styles src/layouts src/components src/pages/brand.astro scripts/check-build.mjs
git commit -m "Brand: tokens, base layout, glitch wordmark, /brand/ page"
```
