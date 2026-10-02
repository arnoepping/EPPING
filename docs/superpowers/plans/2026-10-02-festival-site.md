# Festival Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first three.js site. Visitors scroll through a neon tunnel into a festival hall with three floors (Rave Wedding, Private Events, Epping Presents); each floor opens a content sheet. Every route also works as a static page.

**Architecture:** Astro pre-renders `/` and `/<slug>/` with all content as plain HTML, which is also the no-JS and reduced-motion fallback. After `load`, `boot.ts` (no three.js) checks for WebGL and lazily imports `app.ts`. `app.ts` wires the three.js scene modules, the input rig, the router and the panels. Pure logic (beat, camera targets, routing, links) sits in DOM-free modules covered by `node --test`.

**Tech Stack:** Astro 7, three.js r186 (`three@0.186`), TypeScript (Node native type stripping for tests), Playwright for screenshots and smoke checks.

**Spec:** `docs/superpowers/specs/2026-10-02-festival-site-design.md`
**Prerequisite:** `docs/superpowers/plans/2026-10-02-brand-identity.md` is complete. This plan uses `Base.astro`, `Wordmark.astro`, `tokens.css`, `ui.css` and the classes `.label`, `.btn`, `.btn.primary`, `.card`, `.wrap`, `.scanlines`.

## Global Constraints
- Copy is English. All copy lives in `src/content/floors.ts`.
- Floors, in order: `rave-wedding` (Rave Wedding, BPM 126, pink), `private-events` (Private Events, BPM 124, cyan), `presents` (Epping Presents, BPM 138, pink + cyan).
- Silent until the user presses play in SoundCloud. Beat sync is faked from BPM, with no audio analysis.
- The SoundCloud iframe is created only when its panel opens (3D) or scrolls into view (fallback).
- Booking: mailto + WhatsApp only. Presents: next event (hidden if `null`), vibe line, Instagram.
- First paint is HTML/CSS only. `three` loads via dynamic import after `load`. Scene JS stays under 250KB gzipped.
- DPR cap is 2, with no shadow maps and no postprocessing. Rendering pauses when the tab is hidden. If frames stay over 20ms for 2s, switch to low quality (DPR 1, half particles).
- Scene modules don't touch the DOM. `app.ts` alone bridges the scene and the DOM.
- Imports between `.ts` files use explicit `.ts` extensions, so `node --test` can run them. Don't use `enum`, `namespace` or parameter properties, because type stripping can't handle them.
- `npm test` = build check + unit tests. Always run `npm run build` first.
- Don't push. Commit only.

## Review Focus
1. **Browser Back after a deep link:** landing on `/rave-wedding/`, tapping the panel back arrow and then pressing browser Back must land on the floor again, never on a broken state. Tested in `scripts/screenshot.mjs` (Task 7).
2. **Scrolling inside an open panel on a phone** must scroll the panel, not move the camera or change floors. Tested in `screenshot.mjs` (Task 7) by asserting the mode stays `floor`.
3. **Reduced motion / no WebGL:** all three headlines are readable, with no `xp-3d` class and no canvas drawing. Tested in `screenshot.mjs` (Task 7).
4. **Rotate/resize:** the canvas follows the viewport size. Tested in `screenshot.mjs` (Task 7).
5. **Odd paths:** `/rave-wedding` (no slash), `/EPPING/rave-wedding/` (temporary Pages base) and `/nope/` map to the right slug or `null`. Unit-tested in `route.test.ts` (Task 4).

---

## File map
```
src/content/floors.ts        Floor data + CONTACT (all copy)
src/lib/links.ts             mailto/whatsapp/instagram/soundcloud hrefs, eventLabel()
src/components/Panel.astro   one floor's content sheet
src/components/Experience.astro  canvas, hero, hall UI, fallback cards, panels, boot script
src/pages/index.astro        <Experience initial={null}>
src/pages/[floor].astro      <Experience initial={slug}>
src/scene/layout.ts          world constants (tunnel length, floor positions)
src/scene/beat.ts            pulse(t,bpm)
src/scene/rig.ts             pure camera state machine + targets
src/scene/route.ts           slugFromPath / pathForSlug
src/scene/boot.ts            WebGL/motion check, lazy import app, fallback players
src/scene/panels.ts          open/close panels, mount SoundCloud iframe
src/scene/app.ts             wires stage + parts + rig + input + router + panels
src/scene/stage.ts           renderer, camera, loop, quality, pause, sample()
src/scene/label.ts           neon text sprite
src/scene/tunnel.ts          tunnel part
src/scene/hall.ts            hall part
src/scene/floors/rave-wedding.ts, private-events.ts, presents.ts, base.ts
scripts/screenshot.mjs       Playwright shots + smoke assertions
```

Part interface used by all scene modules (defined in `src/scene/stage.ts`, Task 5):
```ts
export interface FrameCtx { t: number; dt: number; progress: number; focus: number; active: Slug | null; low: boolean }
export interface Part { object: THREE.Object3D; update(ctx: FrameCtx): void; hit?: THREE.Object3D; slug?: Slug }
```

---

### Task 1: Content data, links, unit-test setup

**Files:**
- Create: `src/content/floors.ts`, `src/lib/links.ts`, `src/content/floors.test.ts`, `src/lib/links.test.ts`
- Modify: `package.json`, `.github/workflows/deploy.yml`

**Interfaces:**
- Produces:
  - `type Slug = 'rave-wedding' | 'private-events' | 'presents'`
  - `interface PresentsEvent { date: string /* YYYY-MM-DD */; venue: string; ticketUrl: string }`
  - `interface Floor { slug: Slug; name: string; tagline: string; headline: string; lines: string[]; color: string; accent: string; bpm: number; soundcloudUrl: string; booking?: { subject: string; whatsappText: string }; presents?: { event: PresentsEvent | null; vibe: string } }`
  - `FLOORS: Floor[]`, `SLUGS: Slug[]`, `floorBySlug(s: string): Floor | undefined`
  - `CONTACT: { email: string; whatsapp: string; instagram: string }`
  - `mailtoHref(email, subject)`, `whatsappHref(number, text)`, `instagramHref(handle)`, `soundcloudEmbed(url)`, `eventLabel(e: PresentsEvent | null)` (all return `string`)

- [ ] **Step 1: Wire unit tests and pin CI Node**

`package.json` scripts: `"test": "node scripts/check-build.mjs && node --test \"src/**/*.test.ts\""`, `"shots": "node scripts/screenshot.mjs"`.

`.github/workflows/deploy.yml`: add the `node-version` input to the `withastro/action@v6` step:
```yaml
      - uses: withastro/action@v6
        with:
          node-version: 24
          build-cmd: npm run build && npm test
```

- [ ] **Step 2: Write failing tests**

`src/lib/links.test.ts`:
```ts
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
```

`src/content/floors.test.ts`:
```ts
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
```

- [ ] **Step 3: Run, expect FAIL**

Run: `node --test "src/**/*.test.ts"`
Expected: FAIL, cannot find module `./links.ts` / `./floors.ts`.

- [ ] **Step 4: Implement**

`src/content/floors.ts` (placeholder contact and track data; the user replaces it later):
```ts
export type Slug = 'rave-wedding' | 'private-events' | 'presents';
export interface PresentsEvent { date: string; venue: string; ticketUrl: string }
export interface Floor {
  slug: Slug; name: string; tagline: string; headline: string; lines: string[];
  color: string; accent: string; bpm: number; soundcloudUrl: string;
  booking?: { subject: string; whatsappText: string };
  presents?: { event: PresentsEvent | null; vibe: string };
}

// PLACEHOLDER contact data: replace with real values from the user.
export const CONTACT = { email: 'hello@eppingmusic.com', whatsapp: '31600000000', instagram: 'eppingmusic' };

export const FLOORS: Floor[] = [
  {
    slug: 'rave-wedding', name: 'Rave Wedding', tagline: 'ABBA to acid',
    headline: 'Your wedding. Our rave.',
    lines: [
      'We start with the songs your aunt knows. We end with the ones she never forgets.',
      'One dancefloor, no exit, mirrorball overhead.',
      'Only for couples who want the night to end in a proper rave.',
    ],
    color: '#FF2BD6', accent: '#EDEDF3', bpm: 126,
    soundcloudUrl: 'https://soundcloud.com/eppingmusic/rave-wedding',
    booking: { subject: 'Rave Wedding booking', whatsappText: 'Hi EPPING! We want a rave wedding.' },
  },
  {
    slug: 'private-events', name: 'Private Events', tagline: 'Club night, private list',
    headline: 'Your party. Club-grade.',
    lines: [
      'Birthdays, company nights, rooftops, living rooms.',
      'Club sound, club lights, no awkward first hour.',
      'You bring the people. We bring the peak.',
    ],
    color: '#00E5FF', accent: '#EDEDF3', bpm: 124,
    soundcloudUrl: 'https://soundcloud.com/eppingmusic/private-events',
    booking: { subject: 'Private event booking', whatsappText: 'Hi EPPING! I have a private event.' },
  },
  {
    slug: 'presents', name: 'Epping Presents', tagline: 'Our own nights',
    headline: 'Not a party. A ritual.',
    lines: [
      'Our own nights. Public, loud, a little unhinged.',
      'One room, one sound system, everybody welcome.',
    ],
    color: '#FF2BD6', accent: '#00E5FF', bpm: 138,
    soundcloudUrl: 'https://soundcloud.com/eppingmusic/presents',
    presents: {
      event: { date: '2026-12-12', venue: 'TBA, Amsterdam', ticketUrl: 'https://instagram.com/eppingmusic' },
      vibe: 'Strobes, sweat, and the best Saturday of your month.',
    },
  },
];

export const SLUGS: Slug[] = FLOORS.map((f) => f.slug);
export const floorBySlug = (s: string): Floor | undefined => FLOORS.find((f) => f.slug === s);
```

`src/lib/links.ts`:
```ts
import type { PresentsEvent } from '../content/floors.ts';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export const mailtoHref = (email: string, subject: string) => `mailto:${email}?subject=${encodeURIComponent(subject)}`;
export const whatsappHref = (num: string, text: string) => `https://wa.me/${num.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
export const instagramHref = (h: string) => `https://instagram.com/${h.replace(/^@/, '')}`;
export const soundcloudEmbed = (url: string) =>
  `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23ff2bd6&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&visual=false`;

export function eventLabel(e: PresentsEvent | null): string {
  if (!e) return 'NEXT EVENT SOON';
  const [y, m, d] = e.date.split('-').map(Number);
  return `NEXT: ${d} ${MONTHS[m - 1]} ${y}`;
}
```

- [ ] **Step 5: Run, expect PASS**

Run: `node --test "src/**/*.test.ts"`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/content src/lib package.json .github/workflows/deploy.yml
git commit -m "Site: floor content data, link helpers, unit tests"
```

---

### Task 2: Static pages (fallback-first) + build checks

**Files:**
- Create: `src/components/Panel.astro`, `src/components/Experience.astro`, `src/pages/[floor].astro`
- Modify: `src/pages/index.astro`, `src/pages/404.astro`, `scripts/check-build.mjs`

**Interfaces:**
- Consumes: Task 1 exports; `Base.astro`, `Wordmark.astro`.
- Produces DOM contract (used by Tasks 6–7):
  - `.xp[data-initial="<slug>|"]`: root
  - `canvas.xp-canvas`: render target
  - `.hero`, `a.skip[href="#hall"]`, `.hall-ui` with `button.hall-prev`, `button.hall-next`, `button.hall-enter` and `.hall-name`
  - `#hall .floor-cards a.floor-card[data-slug]` (fallback list)
  - `section.panel#panel-<slug>[data-slug][data-sc="<soundcloud url>"]` with `.player` (iframe mount) and `button.panel-back`
  - Panel visibility attribute: `data-open` on `.panel`; mode attribute `data-mode="tunnel|hall|floor"` on `.xp`; CSS var `--p` on `.xp`
  - `<html>` classes: `xp-3d` (3D active), `xp-ready` (first frame rendered)

- [ ] **Step 1: Add failing build checks** to `scripts/check-build.mjs`, before the final `console.log` (the import goes at the top of the file):

```js
import { FLOORS } from '../src/content/floors.ts';

const decode = (s) => s.replace(/&#39;|&#x27;/g, "'").replace(/&quot;|&#34;/g, '"').replace(/&amp;/g, '&');
const home = decode(readFileSync('dist/index.html', 'utf8'));
for (const f of FLOORS) {
  if (!home.includes(f.name)) fail(`index.html lacks floor name "${f.name}"`);
  const p = `dist/${f.slug}/index.html`;
  if (!existsSync(p)) fail(`${p} missing`);
  const html = decode(readFileSync(p, 'utf8'));
  if (!html.includes(f.headline)) fail(`${p} lacks headline`);
  if (!html.includes(f.soundcloudUrl)) fail(`${p} lacks SoundCloud URL`);
  if (!html.includes(`data-initial="${f.slug}"`)) fail(`${p} lacks data-initial`);
}
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npm run build && npm test`
Expected: `FAIL: index.html lacks floor name "Rave Wedding"`

- [ ] **Step 3: Write `src/components/Panel.astro`**

```astro
---
import type { Floor } from '../content/floors.ts';
import { CONTACT } from '../content/floors.ts';
import { mailtoHref, whatsappHref, instagramHref, eventLabel } from '../lib/links.ts';
interface Props { floor: Floor; index: number; open: boolean }
const { floor: f, index, open } = Astro.props;
const ev = f.presents?.event ?? null;
---
<section class="panel" id={`panel-${f.slug}`} data-slug={f.slug} data-sc={f.soundcloudUrl} data-open={open ? '' : undefined}
  style={`--floor:${f.color};--floor2:${f.accent}`} aria-labelledby={`h-${f.slug}`}>
  <div class="panel-inner">
    <div class="panel-top">
      <button class="panel-back" type="button" aria-label="Back to the hall">←</button>
      <span class="label">Floor 0{index + 1} · {f.tagline}</span>
    </div>
    <h2 id={`h-${f.slug}`}><span class="floor-name">{f.name}</span>{f.headline}</h2>
    {f.lines.map((l) => <p>{l}</p>)}
    <div class="player"><a class="sc-link" href={f.soundcloudUrl} target="_blank" rel="noopener">▶ Listen on SoundCloud</a></div>
    {f.booking && (
      <div class="ctas">
        <a class="btn primary" href={mailtoHref(CONTACT.email, f.booking.subject)}>Email to book</a>
        <a class="btn" href={whatsappHref(CONTACT.whatsapp, f.booking.whatsappText)} target="_blank" rel="noopener">WhatsApp</a>
      </div>
    )}
    {f.presents && (
      <div class="presents">
        {ev && (
          <div class="card event">
            <span class="label">{eventLabel(ev)}</span>
            <p class="venue">{ev.venue}</p>
            <a class="btn primary" href={ev.ticketUrl} target="_blank" rel="noopener">Tickets</a>
          </div>
        )}
        <p class="vibe">{f.presents.vibe}</p>
        <a class="btn" href={instagramHref(CONTACT.instagram)} target="_blank" rel="noopener">Instagram @{CONTACT.instagram}</a>
      </div>
    )}
  </div>
</section>
<style>
  .panel{border-top:1px solid var(--line);padding-block:56px}
  .panel-inner{max-width:720px;margin:0 auto;padding-inline:16px;display:grid;gap:16px}
  .panel-top{display:flex;align-items:center;gap:14px}
  .panel-back{display:none;background:none;border:1px solid var(--line);color:var(--text);font:500 18px/1 var(--mono);width:40px;height:40px;cursor:pointer}
  h2{font:800 clamp(28px,7vw,48px)/1.05 var(--display);margin:0;text-wrap:balance}
  .floor-name{display:block;font:500 13px/1 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--floor);margin-bottom:12px}
  p{margin:0;color:var(--muted)}
  .player{min-height:20px} .sc-link{font:500 13px/1 var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--cyan)}
  .player :global(iframe){width:100%;height:120px;border:0;display:block}
  .ctas,.presents{display:flex;gap:12px;flex-wrap:wrap;align-items:center}
  .event{display:grid;gap:10px;width:100%} .event .label{color:var(--floor2)} .venue{color:var(--text)}
  .vibe{width:100%}
</style>
```

- [ ] **Step 4: Write `src/components/Experience.astro`**

```astro
---
import Wordmark from './Wordmark.astro';
import Panel from './Panel.astro';
import { FLOORS } from '../content/floors.ts';
import type { Slug } from '../content/floors.ts';
interface Props { initial: Slug | null }
const { initial } = Astro.props;
// Fallback order: the active floor's panel comes first on its own route.
const ordered = initial ? [...FLOORS.filter((f) => f.slug === initial), ...FLOORS.filter((f) => f.slug !== initial)] : FLOORS;
---
<div class="xp" data-initial={initial ?? ''} data-mode={initial ? 'floor' : 'tunnel'}>
  <canvas class="xp-canvas" aria-hidden="true"></canvas>
  <div class="xp-scan" aria-hidden="true"></div>

  <header class="hero">
    <span class="label">DJ · Amsterdam</span>
    <Wordmark tag="h1" />
    <p class="tagline">Rave weddings. Private parties. Our own nights.</p>
    <p class="hint label">Scroll ↓ to enter</p>
    <a class="skip label" href="#hall">Skip →</a>
  </header>

  <nav class="hall-ui" aria-label="Floors">
    <button class="hall-prev" type="button" aria-label="Previous floor">‹</button>
    <button class="hall-enter" type="button"><span class="hall-name">{FLOORS[1].name}</span><span class="label">Tap to enter</span></button>
    <button class="hall-next" type="button" aria-label="Next floor">›</button>
  </nav>

  <section id="hall" class="hall wrap">
    <h2 class="label">Pick your floor</h2>
    <div class="floor-cards">
      {FLOORS.map((f, i) => (
        <a class="floor-card card" href={`/${f.slug}/`} data-slug={f.slug} style={`--floor:${f.color}`}>
          <span class="label">Floor 0{i + 1}</span><b>{f.name}</b><span>{f.tagline}</span>
        </a>
      ))}
    </div>
  </section>

  {ordered.map((f) => <Panel floor={f} index={FLOORS.indexOf(f)} open={f.slug === initial} />)}
</div>

<script>
  import { boot } from '../scene/boot.ts';
  if (document.readyState === 'complete') boot();
  else addEventListener('load', () => boot(), { once: true });
</script>

<style>
  /* ---------- fallback (default): a normal scrolling page ---------- */
  .xp-canvas,.xp-scan,.hall-ui,.hint,.skip{display:none}
  .hero{display:grid;gap:20px;padding:clamp(72px,14vw,140px) 16px 56px;max-width:1080px;margin:0 auto;overflow:hidden}
  .tagline{font:500 clamp(18px,3vw,26px)/1.3 var(--display);margin:0;max-width:22ch}
  .hall{padding-block:40px 56px;display:grid;gap:20px}
  .floor-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:12px}
  .floor-card{display:grid;gap:8px;text-decoration:none;border-left:3px solid var(--floor)}
  .floor-card b{font:800 22px/1.2 var(--display)} .floor-card span:last-child{color:var(--muted)}

  /* ---------- 3D mode ---------- */
  :global(html.xp-3d),:global(html.xp-3d body){overflow:hidden;height:100%;overscroll-behavior:none}
  :global(.xp-3d) .xp{position:fixed;inset:0;--p:0}
  :global(.xp-3d) .xp-canvas{display:block;position:fixed;inset:0;width:100%;height:100%;touch-action:none}
  :global(.xp-3d) .xp-scan{display:block;position:fixed;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,transparent 0 3px,rgba(255,255,255,.03) 3px 4px)}
  :global(.xp-3d) .hall{display:none}
  :global(.xp-3d) .hero{position:fixed;inset:0;align-content:center;justify-items:start;pointer-events:none;
    opacity:calc(1 - var(--p) * 3);transform:scale(calc(1 + var(--p) * 2));transform-origin:30% 50%;transition:opacity .2s}
  :global(.xp-3d) .hero .hint,:global(.xp-3d) .hero .skip{display:inline-block}
  :global(.xp-3d) .skip{pointer-events:auto;position:fixed;top:max(16px,env(safe-area-inset-top));right:16px;color:var(--cyan);text-decoration:none}
  :global(.xp-3d) .xp:not([data-mode="tunnel"]) .hero{display:none}
  :global(.xp-3d) .xp[data-mode="hall"] .hall-ui{display:flex}
  .hall-ui{position:fixed;left:0;right:0;bottom:max(20px,env(safe-area-inset-bottom));justify-content:center;align-items:stretch;gap:8px;padding-inline:16px}
  .hall-ui button{background:color-mix(in srgb,var(--bg) 70%,transparent);border:1px solid var(--line);color:var(--text);cursor:pointer;backdrop-filter:blur(8px)}
  .hall-prev,.hall-next{width:52px;font:500 24px/1 var(--mono)}
  .hall-enter{flex:0 1 280px;display:grid;gap:6px;padding:14px 18px}
  .hall-name{font:800 18px/1.1 var(--display)}

  /* panels become sheets */
  :global(.xp-3d) .xp :global(.panel){position:fixed;left:0;right:0;bottom:0;max-height:62vh;overflow-y:auto;overscroll-behavior:contain;
    padding-block:24px 40px;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(12px);
    border-top:1px solid var(--floor);transform:translateY(105%);transition:transform .45s cubic-bezier(.2,.8,.2,1);visibility:hidden}
  :global(.xp-3d) .xp :global(.panel[data-open]){transform:none;visibility:visible}
  :global(.xp-3d) .xp :global(.panel-back){display:grid;place-items:center}
  @media (min-width:900px){
    :global(.xp-3d) .xp :global(.panel){left:auto;top:0;width:min(480px,40vw);max-height:none;border-top:0;border-left:1px solid var(--floor);transform:translateX(105%)}
  }
</style>
```

- [ ] **Step 5: Write the pages**

`src/pages/index.astro`:
```astro
---
import Base from '../layouts/Base.astro';
import Experience from '../components/Experience.astro';
---
<Base title="EPPING | Rave weddings, private events, our own nights" description="EPPING: the rave wedding DJ. Private events. Epping Presents.">
  <Experience initial={null} />
</Base>
```

`src/pages/[floor].astro`:
```astro
---
import Base from '../layouts/Base.astro';
import Experience from '../components/Experience.astro';
import { FLOORS } from '../content/floors.ts';
import type { Floor } from '../content/floors.ts';
export function getStaticPaths() {
  return FLOORS.map((floor) => ({ params: { floor: floor.slug }, props: { floor } }));
}
const { floor } = Astro.props as { floor: Floor };
---
<Base title={`${floor.name} | EPPING`} description={`${floor.headline} ${floor.lines[0]}`}>
  <Experience initial={floor.slug} />
</Base>
```

`src/pages/404.astro`: wrap in `Base` with `<Wordmark tag="h1" size="clamp(48px,12vw,120px)" />`, then `<p>This floor doesn't exist.</p><a class="btn" href="/">Back to the hall</a>` inside `<main class="wrap" style="padding-block:96px;display:grid;gap:20px">`, and keep `title="Not found | EPPING"`.

- [ ] **Step 6: Stub boot so the build resolves.** Create `src/scene/boot.ts`:
```ts
export function boot(): void {}
```

- [ ] **Step 7: Run, expect PASS**

Run: `npm run build && npm test`
Expected: `OK: build output valid`, and unit tests pass.

- [ ] **Step 8: Commit**

```bash
git add src scripts/check-build.mjs
git commit -m "Site: static pages, panels, fallback layout"
```

---

### Task 3: Pure scene logic (layout, beat, rig)

**Files:**
- Create: `src/scene/layout.ts`, `src/scene/beat.ts`, `src/scene/rig.ts`, `src/scene/beat.test.ts`, `src/scene/rig.test.ts`

**Interfaces:**
- Produces:
  - `layout.ts`: `TUNNEL_LEN = 120`, `HALL_Z = -150`, `FLOOR_X = [-18, 0, 18]`
  - `beat.ts`: `pulse(t: number, bpm: number): number` (1 on each beat, decaying to ~0 by the next)
  - `rig.ts`:
    - `type Mode = 'tunnel' | 'hall' | 'floor'`
    - `interface RigState { mode: Mode; progress: number; focus: number; active: number | null }`
    - `initialState(activeIndex: number | null): RigState`
    - `scrollBy(s, deltaPx, viewportH): RigState`
    - `skip(s): RigState`, `step(s, dir: -1 | 1): RigState`, `enter(s, i?: number): RigState`, `leave(s): RigState`
    - `swipeDir(dx, dy, threshold = 40): -1 | 0 | 1`
    - `type Vec3 = [number, number, number]`, `cameraTarget(s): { pos: Vec3; look: Vec3 }`

- [ ] **Step 1: Write failing tests**

`src/scene/beat.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pulse } from './beat.ts';

test('pulse peaks on the beat and decays', () => {
  assert.equal(pulse(0, 120), 1);
  assert.ok(Math.abs(pulse(0.25, 120) - Math.exp(-3)) < 1e-9);
  assert.ok(pulse(0.5, 120) > 0.999); // next beat at 120 BPM
  assert.ok(pulse(0.49, 120) < 0.01);
});
```

`src/scene/rig.test.ts`:
```ts
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
```

- [ ] **Step 2: Run, expect FAIL**

Run: `node --test "src/scene/*.test.ts"`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`src/scene/layout.ts`:
```ts
export const TUNNEL_LEN = 120;
export const HALL_Z = -150;          // z of the three floors
export const FLOOR_X = [-18, 0, 18]; // x of floor 0..2 (FLOORS order)
```

`src/scene/beat.ts`:
```ts
/** 1 on each beat, exponential decay until the next. t in seconds. */
export function pulse(t: number, bpm: number): number {
  const phase = ((t * bpm) / 60) % 1;
  return Math.exp(-phase * 6);
}
```

`src/scene/rig.ts`:
```ts
import { TUNNEL_LEN, HALL_Z, FLOOR_X } from './layout.ts';

export type Mode = 'tunnel' | 'hall' | 'floor';
export interface RigState { mode: Mode; progress: number; focus: number; active: number | null }
export type Vec3 = [number, number, number];

const LAST = FLOOR_X.length - 1;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function initialState(activeIndex: number | null): RigState {
  return activeIndex === null
    ? { mode: 'tunnel', progress: 0, focus: 1, active: null }
    : { mode: 'floor', progress: 1, focus: activeIndex, active: activeIndex };
}

/** Tunnel length = 3 viewport heights of scrolling. */
export function scrollBy(s: RigState, deltaPx: number, viewportH: number): RigState {
  if (s.mode !== 'tunnel') return s;
  const progress = clamp(s.progress + deltaPx / (3 * viewportH), 0, 1);
  return { ...s, progress, mode: progress >= 1 ? 'hall' : 'tunnel' };
}
export const skip = (s: RigState): RigState => (s.mode === 'tunnel' ? { ...s, mode: 'hall', progress: 1 } : s);
export const step = (s: RigState, dir: -1 | 1): RigState => (s.mode === 'hall' ? { ...s, focus: clamp(s.focus + dir, 0, LAST) } : s);
export const enter = (s: RigState, i: number = s.focus): RigState => ({ mode: 'floor', progress: 1, focus: i, active: i });
export const leave = (s: RigState): RigState => (s.mode === 'floor' ? { ...s, mode: 'hall', active: null } : s);

/** Swipe left (negative dx) = next floor. */
export function swipeDir(dx: number, dy: number, threshold = 40): -1 | 0 | 1 {
  if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy)) return 0;
  return dx < 0 ? 1 : -1;
}

export function cameraTarget(s: RigState): { pos: Vec3; look: Vec3 } {
  if (s.mode === 'tunnel') {
    const z = -s.progress * TUNNEL_LEN;
    return { pos: [0, 0, z], look: [0, 0, z - 10] };
  }
  const x = FLOOR_X[s.mode === 'floor' && s.active !== null ? s.active : s.focus];
  return s.mode === 'hall'
    ? { pos: [x, 7, HALL_Z + 26], look: [x, 1, HALL_Z] }
    : { pos: [x, 3.5, HALL_Z + 11], look: [x, 0.5, HALL_Z] };
}
```

- [ ] **Step 4: Run, expect PASS**

Run: `node --test "src/**/*.test.ts"`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/scene/layout.ts src/scene/beat.ts src/scene/rig.ts src/scene/*.test.ts
git commit -m "Scene: layout constants, beat pulse, camera rig state machine"
```

---

### Task 4: Routing helpers

**Files:**
- Create: `src/scene/route.ts`, `src/scene/route.test.ts`

**Interfaces:**
- Produces: `slugFromPath(path: string, slugs: readonly string[]): string | null` and `pathForSlug(slug: string | null, base?: string): string` (base defaults to `'/'`).

- [ ] **Step 1: Write failing test** `src/scene/route.test.ts`:
```ts
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
```

- [ ] **Step 2: Run, expect FAIL**

Run: `node --test src/scene/route.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement** `src/scene/route.ts`:
```ts
export function slugFromPath(path: string, slugs: readonly string[]): string | null {
  const parts = path.split('/').filter((p) => p && p !== 'index.html');
  const last = parts.at(-1);
  return last && slugs.includes(last) ? last : null;
}
export const pathForSlug = (slug: string | null, base = '/'): string => (slug ? `${base}${slug}/` : base);
```

- [ ] **Step 4: Run, expect PASS**

Run: `node --test "src/**/*.test.ts"`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/scene/route.ts src/scene/route.test.ts
git commit -m "Scene: path ↔ slug routing helpers"
```

---

### Task 5: Stage, boot, tunnel + screenshot harness

**Files:**
- Create: `src/scene/stage.ts`, `src/scene/tunnel.ts`, `src/scene/app.ts`, `src/scene/panels.ts`, `scripts/screenshot.mjs`
- Modify: `src/scene/boot.ts`, `package.json` (add `three`)

**Interfaces:**
- Consumes: `rig.ts`, `layout.ts`, `beat.ts`, the Task 2 DOM contract.
- Produces:
  - `stage.ts`: `FrameCtx`, `Part` (see File map), `createStage(canvas: HTMLCanvasElement): Stage` where `Stage = { scene: THREE.Scene; camera: THREE.PerspectiveCamera; renderer: THREE.WebGLRenderer; low: boolean; start(frame: (t: number, dt: number) => void): void; sample(): boolean }`
  - `tunnel.ts`: `buildTunnel(): Part`
  - `panels.ts`: `mountPlayer(panel: HTMLElement): void`, `setOpen(root: HTMLElement, slug: string | null): void`
  - `app.ts`: `start(root: HTMLElement): void`. It sets `window.__xp = { setProgress(p: number): void; state(): RigState; sample(): boolean }`.
  - `boot.ts`: `boot(): void`

- [ ] **Step 1: Install three**

```bash
npm i three@0.186 && npm i -D @types/three
```

- [ ] **Step 2: Write the screenshot/smoke harness first (failing).** Create `scripts/screenshot.mjs`:

```js
// Builds nothing: run `npm run build` first. Serves dist via astro preview, shoots + asserts.
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const PORT = 4329, BASE = `http://localhost:${PORT}`, OUT = '.superpowers/shots';
const SLUGS = ['rave-wedding', 'private-events', 'presents'];
const ONLY = process.argv[2]; // optional: "phone" | "desktop" | "fallback" | "smoke"
mkdirSync(OUT, { recursive: true });

const server = spawn('npx', ['astro', 'preview', '--port', String(PORT)], { stdio: 'ignore' });
const errors = [];
const fail = (m) => { errors.push(m); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function up() {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(BASE)).ok) return; } catch {} await wait(500); }
  throw new Error('preview did not start');
}
async function newPage(browser, name, opts) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && fail(`${name}: console: ${m.text()}`));
  page.on('pageerror', (e) => fail(`${name}: pageerror: ${e.message}`));
  return { ctx, page };
}
async function shot(page, name, label) {
  await page.screenshot({ path: `${OUT}/${name}-${label}.png` });
  if (await page.evaluate(() => document.documentElement.classList.contains('xp-3d'))) {
    if (!(await page.evaluate(() => window.__xp.sample()))) fail(`${name}-${label}: canvas looks blank`);
  }
}
async function ready(page) { await page.waitForSelector('html.xp-ready', { timeout: 15000 }); await wait(600); }

const VIEWS = { phone: devices['iPhone 14'], desktop: { viewport: { width: 1440, height: 900 } } };

try {
  await up();
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

  for (const [name, opts] of Object.entries(VIEWS)) {
    if (ONLY && ONLY !== name) continue;
    const { ctx, page } = await newPage(browser, name, opts);
    await page.goto(`${BASE}/`); await ready(page);
    await shot(page, name, '1-arrival');
    await page.evaluate(() => window.__xp.setProgress(0.5)); await wait(1200);
    await shot(page, name, '2-tunnel');
    await page.evaluate(() => window.__xp.setProgress(1)); await wait(2500);
    await shot(page, name, '3-hall');
    for (const s of SLUGS) {
      await page.goto(`${BASE}/${s}/`); await ready(page); await wait(1200);
      await shot(page, name, `4-floor-${s}`);
    }
    await ctx.close();
  }

  if (!ONLY || ONLY === 'fallback') {
    const { ctx, page } = await newPage(browser, 'fallback', { ...devices['iPhone 14'], reducedMotion: 'reduce' });
    await page.goto(`${BASE}/`); await wait(1500);
    if (await page.evaluate(() => document.documentElement.classList.contains('xp-3d'))) fail('fallback: xp-3d set under reduced motion');
    for (const h of ['Your wedding. Our rave.', 'Your party. Club-grade.', 'Not a party. A ritual.']) {
      if (!(await page.getByText(h).isVisible())) fail(`fallback: headline not visible: ${h}`);
    }
    await page.screenshot({ path: `${OUT}/fallback-full.png`, fullPage: true });
    await ctx.close();
  }

  if (!ONLY || ONLY === 'smoke') {
    const { ctx, page } = await newPage(browser, 'smoke', devices['iPhone 14']);
    // Review focus 1: deep link → back arrow → browser Back
    await page.goto(`${BASE}/rave-wedding/`); await ready(page);
    await page.locator('#panel-rave-wedding .panel-back').click(); await wait(600);
    if (new URL(page.url()).pathname !== '/') fail(`smoke: back arrow should go to /, got ${page.url()}`);
    if (await page.locator('#panel-rave-wedding').getAttribute('data-open') !== null) fail('smoke: panel still open after back');
    await page.goBack(); await wait(800);
    if ((await page.evaluate(() => window.__xp.state().mode)) !== 'floor') fail('smoke: browser Back did not reopen floor');
    if (await page.locator('#panel-rave-wedding').getAttribute('data-open') === null) fail('smoke: panel not open after browser Back');
    // Review focus 2: scrolling inside the open panel must not change the scene
    const before = await page.evaluate(() => JSON.stringify(window.__xp.state()));
    const box = await page.locator('#panel-rave-wedding').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + 40);
    await page.mouse.wheel(0, 600); await wait(400);
    await page.touchscreen.tap(box.x + box.width / 2, box.y + 60); await wait(300);
    if ((await page.evaluate(() => JSON.stringify(window.__xp.state()))) !== before) fail('smoke: interacting with panel changed scene state');
    // Review focus 4: resize follows viewport
    await page.setViewportSize({ width: 844, height: 390 }); await wait(500);
    const w = await page.evaluate(() => document.querySelector('.xp-canvas').clientWidth);
    if (w !== 844) fail(`smoke: canvas width ${w} after rotate, expected 844`);
    await ctx.close();
  }

  await browser.close();
} finally {
  server.kill();
}
if (errors.length) { console.error(errors.map((e) => `FAIL: ${e}`).join('\n')); process.exit(1); }
console.log(`OK: shots in ${OUT}`);
```

Run: `npm run build && npm run shots phone`
Expected: FAIL. `waitForSelector('html.xp-ready')` times out, because boot is still a stub.

- [ ] **Step 3: Implement `src/scene/stage.ts`**

```ts
import * as THREE from 'three';
import type { Slug } from '../content/floors.ts';

export interface FrameCtx { t: number; dt: number; progress: number; focus: number; active: Slug | null; low: boolean }
export interface Part { object: THREE.Object3D; update(ctx: FrameCtx): void; hit?: THREE.Object3D; slug?: Slug }
export interface Stage {
  scene: THREE.Scene; camera: THREE.PerspectiveCamera; renderer: THREE.WebGLRenderer; low: boolean;
  start(frame: (t: number, dt: number) => void): void;
  sample(): boolean;
}

export function createStage(canvas: HTMLCanvasElement): Stage {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x0a0a10);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0a10, 0.018);
  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 400);

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? 80 : 62; // wider on portrait phones
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  const stage: Stage = {
    scene, camera, renderer, low: false,
    start(frame) {
      const clock = new THREE.Clock();
      let slow = 0;
      const loop = () => {
        const dt = Math.min(clock.getDelta(), 0.1);
        // Adaptive quality: >20ms frames for 2s → low mode, permanently.
        slow = dt > 0.02 ? slow + dt : 0;
        if (!stage.low && slow > 2) { stage.low = true; renderer.setPixelRatio(1); resize(); }
        frame(clock.elapsedTime, dt);
        renderer.render(scene, camera);
      };
      const run = () => renderer.setAnimationLoop(document.hidden ? null : loop);
      document.addEventListener('visibilitychange', () => { clock.getDelta(); run(); });
      run();
    },
    /** True when the frame is not one flat color (blank-canvas check for screenshots). */
    sample() {
      renderer.render(scene, camera);
      const gl = renderer.getContext();
      const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(4);
      const seen = new Set<string>();
      for (const [fx, fy] of [[.5, .5], [.25, .3], [.75, .7], [.5, .15], [.5, .85], [.1, .5], [.9, .5]]) {
        gl.readPixels(Math.floor(w * fx), Math.floor(h * fy), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        seen.add(px.join(','));
      }
      return seen.size > 1;
    },
  };
  return stage;
}
```

- [ ] **Step 4: Implement `src/scene/tunnel.ts`**

```ts
import * as THREE from 'three';
import type { Part, FrameCtx } from './stage.ts';
import { TUNNEL_LEN } from './layout.ts';

const PINK = new THREE.Color('#FF2BD6'), CYAN = new THREE.Color('#00E5FF');

export function buildTunnel(): Part {
  const group = new THREE.Group();
  const count = Math.floor(TUNNEL_LEN / 2) + 1; // rings from z=6 to z=-114; the mouth opens into the hall
  const ringGeo = new THREE.TorusGeometry(4, 0.05, 6, 64);
  const glowGeo = new THREE.TorusGeometry(4, 0.22, 6, 64);
  const core = new THREE.InstancedMesh(ringGeo, new THREE.MeshBasicMaterial({ toneMapped: false }), count);
  const glow = new THREE.InstancedMesh(glowGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), count);
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    m.makeTranslation(0, 0, -i * 2 + 6);
    core.setMatrixAt(i, m); glow.setMatrixAt(i, m);
    const c = i % 2 ? CYAN : PINK;
    core.setColorAt(i, c); glow.setColorAt(i, c);
  }
  group.add(core, glow);

  // Speed lines: thin streaks along the walls.
  const LINES = 360, pos = new Float32Array(LINES * 6), col = new Float32Array(LINES * 6);
  for (let i = 0; i < LINES; i++) {
    const a = Math.random() * Math.PI * 2, r = 3.2 + Math.random() * 0.6, z = -Math.random() * (TUNNEL_LEN - 10), len = 1 + Math.random() * 3;
    const x = Math.cos(a) * r, y = Math.sin(a) * r, c = Math.random() > 0.5 ? PINK : CYAN;
    pos.set([x, y, z, x, y, z - len], i * 6);
    col.set([c.r, c.g, c.b, c.r, c.g, c.b], i * 6);
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  lg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending }));
  group.add(lines);

  return {
    object: group,
    update(ctx: FrameCtx) {
      group.visible = ctx.progress < 1 || ctx.active === null; // keep visible for the hall entrance view
      group.rotation.z = ctx.t * 0.15 + ctx.progress * 2;
      (glow.material as THREE.MeshBasicMaterial).opacity = 0.12 + 0.12 * Math.sin(ctx.t * 4);
      lg.setDrawRange(0, ctx.low ? LINES : LINES * 2);
    },
  };
}
```

- [ ] **Step 5: Implement `src/scene/panels.ts`**

```ts
import { soundcloudEmbed } from '../lib/links.ts';

/** Create the SoundCloud iframe once, replacing the fallback link. */
export function mountPlayer(panel: HTMLElement): void {
  const box = panel.querySelector<HTMLElement>('.player');
  if (!box || box.querySelector('iframe') || !panel.dataset.sc) return;
  const f = document.createElement('iframe');
  f.title = `SoundCloud: ${panel.dataset.slug}`;
  f.allow = 'autoplay';
  f.loading = 'lazy';
  f.src = soundcloudEmbed(panel.dataset.sc);
  box.replaceChildren(f);
}

export function setOpen(root: HTMLElement, slug: string | null): void {
  for (const p of root.querySelectorAll<HTMLElement>('.panel')) {
    const open = p.dataset.slug === slug;
    p.toggleAttribute('data-open', open);
    if (open) mountPlayer(p);
  }
}
```

- [ ] **Step 6: Implement `src/scene/boot.ts`** (no three.js import):

```ts
import { mountPlayer } from './panels.ts';

function hasWebGL(): boolean {
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
}

export function boot(): void {
  const root = document.querySelector<HTMLElement>('.xp');
  if (!root) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !hasWebGL()) {
    // Fallback: players appear as panels scroll into view.
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { mountPlayer(e.target as HTMLElement); io.unobserve(e.target); }
    }), { rootMargin: '200px' });
    root.querySelectorAll('.panel').forEach((p) => io.observe(p));
    return;
  }
  document.documentElement.classList.add('xp-3d');
  import('./app.ts').then((m) => m.start(root)).catch((err) => {
    console.error(err);
    document.documentElement.classList.remove('xp-3d');
  });
}
```

- [ ] **Step 7: Implement a first `src/scene/app.ts`** (tunnel + scroll only; Task 7 extends it):

```ts
import * as THREE from 'three';
import { createStage } from './stage.ts';
import type { Part } from './stage.ts';
import { buildTunnel } from './tunnel.ts';
import { initialState, scrollBy, cameraTarget } from './rig.ts';
import type { RigState } from './rig.ts';

declare global { interface Window { __xp: { setProgress(p: number): void; state(): RigState; sample(): boolean } } }

export function start(root: HTMLElement): void {
  const canvas = root.querySelector<HTMLCanvasElement>('.xp-canvas')!;
  const stage = createStage(canvas);
  const parts: Part[] = [buildTunnel()];
  parts.forEach((p) => stage.scene.add(p.object));

  let s: RigState = initialState(null);
  const pos = new THREE.Vector3(), look = new THREE.Vector3(), lookNow = new THREE.Vector3(0, 0, -10);
  const sync = () => { root.dataset.mode = s.mode; root.style.setProperty('--p', String(s.progress)); };

  addEventListener('wheel', (e) => { s = scrollBy(s, e.deltaY, innerHeight); sync(); }, { passive: true });

  window.__xp = {
    setProgress: (p) => { s = scrollBy({ ...s, mode: 'tunnel', progress: 0 }, p * 3 * innerHeight, innerHeight); sync(); },
    state: () => s,
    sample: () => stage.sample(),
  };

  let first = true;
  stage.start((t, dt) => {
    const tgt = cameraTarget(s);
    pos.set(...tgt.pos); look.set(...tgt.look);
    const k = 1 - Math.exp(-dt * 4);
    stage.camera.position.lerp(pos, k); lookNow.lerp(look, k); stage.camera.lookAt(lookNow);
    const ctx = { t, dt, progress: s.progress, focus: s.focus, active: null, low: stage.low };
    parts.forEach((p) => p.update(ctx));
    if (first) { first = false; requestAnimationFrame(() => document.documentElement.classList.add('xp-ready')); }
  });
  sync();
}
```

- [ ] **Step 8: Run unit + build checks, then the shots**

Run: `npm run build && npm test && npm run shots phone`
Expected: unit and build checks pass, and `shots phone` prints `OK`. The `3-hall` and `4-floor-*` shots still show the tunnel end, because the hall and routing come in Tasks 6–7. Open `.superpowers/shots/phone-1-arrival.png` and `phone-2-tunnel.png` with Read and check: neon rings visible, wordmark overlay on arrival, hero gone mid-tunnel. Tune ring radius/fog if the tunnel reads as flat.

- [ ] **Step 9: Commit**

```bash
git add src/scene scripts/screenshot.mjs package.json package-lock.json
git commit -m "Scene: stage, lazy boot, neon tunnel, screenshot harness"
```

---

### Task 6: Hall + three floors

**Files:**
- Create: `src/scene/label.ts`, `src/scene/hall.ts`, `src/scene/floors/base.ts`, `src/scene/floors/rave-wedding.ts`, `src/scene/floors/private-events.ts`, `src/scene/floors/presents.ts`
- Modify: `src/scene/app.ts` (add the parts only)

**Interfaces:**
- Consumes: `Part`, `FrameCtx` (stage.ts), `pulse` (beat.ts), `HALL_Z`, `FLOOR_X` (layout.ts), `Floor` (floors.ts).
- Produces:
  - `makeLabel(text: string, color: string, sub?: string): THREE.Sprite`. It awaits nothing; call it after `document.fonts.load` resolves in app.
  - `buildHall(): Part`
  - `buildFloorBase(floor: Floor, index: number): { group: THREE.Group; hit: THREE.Mesh; pulseOf(t: number): number }`
  - `buildRaveWedding(floor, index): Part`, `buildPrivateEvents(floor, index): Part`, `buildPresents(floor, index): Part`. Each returns a `Part` with `hit` and `slug` set.

- [ ] **Step 1: `src/scene/label.ts`**

```ts
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
```

- [ ] **Step 2: `src/scene/hall.ts`**

```ts
import * as THREE from 'three';
import type { Part, FrameCtx } from './stage.ts';
import { HALL_Z } from './layout.ts';

export function buildHall(): Part {
  const g = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 80), new THREE.MeshBasicMaterial({ color: 0x13131c }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, -1, HALL_Z + 10);
  const grid = new THREE.GridHelper(90, 45, 0x262634, 0x1a1a26);
  grid.position.set(0, -0.99, HALL_Z + 10);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(90, 30), new THREE.MeshBasicMaterial({ color: 0x0d0d15 }));
  wall.position.set(0, 14, HALL_Z - 12);
  // Truss: three horizontal bars above the floors.
  const barMat = new THREE.MeshBasicMaterial({ color: 0x262634 });
  for (const z of [HALL_Z - 6, HALL_Z, HALL_Z + 6]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(70, 0.3, 0.3), barMat);
    bar.position.set(0, 12, z); g.add(bar);
  }
  // Fog haze: big soft additive planes.
  const hazeMat = new THREE.MeshBasicMaterial({ color: 0x1a1030, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
  const haze = new THREE.Mesh(new THREE.PlaneGeometry(120, 20), hazeMat);
  haze.position.set(0, 3, HALL_Z - 4);
  g.add(floor, grid, wall, haze);
  return {
    object: g,
    update(ctx: FrameCtx) {
      g.visible = ctx.progress > 0.6;
      hazeMat.opacity = 0.25 + 0.1 * Math.sin(ctx.t * 0.7);
    },
  };
}
```

- [ ] **Step 3: `src/scene/floors/base.ts`** (shared platform, ring, beam, label, hitbox)

```ts
import * as THREE from 'three';
import type { Floor } from '../../content/floors.ts';
import { FLOOR_X, HALL_Z } from '../layout.ts';
import { pulse } from '../beat.ts';
import { makeLabel } from '../label.ts';

export function buildFloorBase(floor: Floor, index: number) {
  const group = new THREE.Group();
  group.position.set(FLOOR_X[index], 0, HALL_Z);
  const color = new THREE.Color(floor.color);

  const platform = new THREE.Mesh(new THREE.CylinderGeometry(6, 6.4, 0.6, 48), new THREE.MeshBasicMaterial({ color: 0x13131c }));
  platform.position.y = -0.7;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(6.2, 0.06, 6, 96), new THREE.MeshBasicMaterial({ color, toneMapped: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = -0.38;
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(6, 13, 32, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  );
  beam.position.y = 5.8;
  const label = makeLabel(floor.name.toUpperCase(), floor.color, floor.tagline);
  label.position.set(0, 9, 0);
  label.scale.multiplyScalar(0.55);
  const hit = new THREE.Mesh(new THREE.BoxGeometry(12, 12, 12), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = 5;
  group.add(platform, ring, beam, label, hit);

  const ringMat = ring.material as THREE.MeshBasicMaterial, beamMat = beam.material as THREE.MeshBasicMaterial;
  const pulseOf = (t: number) => {
    const p = pulse(t, floor.bpm);
    ringMat.color.copy(color).multiplyScalar(0.6 + 0.8 * p);
    beamMat.opacity = 0.04 + 0.06 * p;
    return p;
  };
  return { group, hit, pulseOf };
}
```

- [ ] **Step 4: `src/scene/floors/rave-wedding.ts`** (mirrorball, pink lasers, confetti)

```ts
import * as THREE from 'three';
import type { Floor } from '../../content/floors.ts';
import type { Part, FrameCtx } from '../stage.ts';
import { buildFloorBase } from './base.ts';

export function buildRaveWedding(floor: Floor, index: number): Part {
  const { group, hit, pulseOf } = buildFloorBase(floor, index);

  // Mirrorball: flat-shaded facets lit by two orbiting colored lights.
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4, 2), new THREE.MeshPhongMaterial({ color: 0x9a9aa8, specular: 0xffffff, shininess: 120, flatShading: true }));
  ball.position.y = 7.5;
  const l1 = new THREE.PointLight(0xff2bd6, 60, 20), l2 = new THREE.PointLight(0x00e5ff, 40, 20);
  group.add(ball, l1, l2, new THREE.AmbientLight(0xffffff, 0.15));

  // Lasers: thin additive beams fanning down from the ball.
  const lasers = new THREE.Group();
  const laserMat = new THREE.MeshBasicMaterial({ color: 0xff2bd6, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let i = 0; i < 8; i++) {
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 14, 4), laserMat);
    beam.geometry.translate(0, -7, 0);
    beam.rotation.set(0.5, (i / 8) * Math.PI * 2, 0, 'YXZ');
    lasers.add(beam);
  }
  lasers.position.y = 7.5;
  group.add(lasers);

  // Confetti.
  const N = 500, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), palette = ['#FF2BD6', '#00E5FF', '#EDEDF3'].map((c) => new THREE.Color(c));
  for (let i = 0; i < N; i++) {
    pos.set([(Math.random() - 0.5) * 12, Math.random() * 10, (Math.random() - 0.5) * 12], i * 3);
    const c = palette[i % 3]; col.set([c.r, c.g, c.b], i * 3);
  }
  const cg = new THREE.BufferGeometry();
  cg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  cg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const confetti = new THREE.Points(cg, new THREE.PointsMaterial({ size: 0.12, vertexColors: true }));
  group.add(confetti);

  return {
    object: group, hit, slug: floor.slug,
    update(ctx: FrameCtx) {
      const p = pulseOf(ctx.t);
      ball.rotation.y = ctx.t * 0.6;
      l1.position.set(Math.cos(ctx.t) * 4, 9, Math.sin(ctx.t) * 4);
      l2.position.set(Math.cos(ctx.t + Math.PI) * 4, 6, Math.sin(ctx.t + Math.PI) * 4);
      lasers.rotation.y = ctx.t * 0.8;
      lasers.children.forEach((b, i) => { b.rotation.x = 0.35 + 0.25 * Math.sin(ctx.t * 1.3 + i); });
      laserMat.opacity = 0.25 + 0.6 * p;
      for (let i = 0; i < N; i++) {
        let y = pos[i * 3 + 1] - ctx.dt * (0.6 + (i % 7) * 0.08);
        if (y < -0.4) y = 10;
        pos[i * 3 + 1] = y;
      }
      cg.attributes.position.needsUpdate = true;
      cg.setDrawRange(0, ctx.low ? N / 2 : N);
    },
  };
}
```

- [ ] **Step 5: `src/scene/floors/private-events.ts`** (cyan strobes, smoke, LED wall)

```ts
import * as THREE from 'three';
import type { Floor } from '../../content/floors.ts';
import type { Part, FrameCtx } from '../stage.ts';
import { buildFloorBase } from './base.ts';

const WALL_FRAG = `
  uniform float uTime; uniform float uPulse; varying vec2 vUv;
  void main(){
    vec2 g = vUv * vec2(64.0, 24.0);
    vec2 cell = fract(g) - 0.5;
    float dotMask = smoothstep(0.42, 0.3, length(cell));
    float wave = 0.5 + 0.5 * sin(floor(g.x) * 0.35 - uTime * 3.0 + sin(floor(g.y) * 0.5 + uTime));
    vec3 cyan = vec3(0.0, 0.898, 1.0);
    vec3 col = cyan * (0.15 + 0.85 * wave) * (0.5 + 0.7 * uPulse);
    gl_FragColor = vec4(col * dotMask, 1.0);
  }`;
const WALL_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

function smokeTexture(): THREE.Texture {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d')!, r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,0.5)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function buildPrivateEvents(floor: Floor, index: number): Part {
  const { group, hit, pulseOf } = buildFloorBase(floor, index);

  const uniforms = { uTime: { value: 0 }, uPulse: { value: 0 } };
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(11, 4.2), new THREE.ShaderMaterial({ uniforms, vertexShader: WALL_VERT, fragmentShader: WALL_FRAG }));
  wall.position.set(0, 3, -4.5);
  group.add(wall);

  const strobeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const x of [-4.5, -1.5, 1.5, 4.5]) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.35), strobeMat);
    s.position.set(x, 8.6, -3); group.add(s);
  }

  const tex = smokeTexture();
  const smoke = Array.from({ length: 18 }, (_, i) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0x00e5ff, transparent: true, opacity: 0.16, depthWrite: false }));
    sp.position.set((Math.random() - 0.5) * 11, Math.random() * 2, (Math.random() - 0.5) * 8);
    sp.scale.setScalar(4 + Math.random() * 3); sp.userData.v = 0.2 + (i % 5) * 0.05;
    group.add(sp); return sp;
  });

  return {
    object: group, hit, slug: floor.slug,
    update(ctx: FrameCtx) {
      const p = pulseOf(ctx.t);
      uniforms.uTime.value = ctx.t; uniforms.uPulse.value = p;
      strobeMat.opacity = p > 0.9 && Math.floor(ctx.t * 4) % 2 === 0 ? 1 : 0; // flash on alternating beats
      smoke.forEach((sp, i) => {
        if (ctx.low && i % 2) { sp.visible = false; return; }
        sp.visible = true;
        sp.position.x += Math.sin(ctx.t * 0.3 + i) * ctx.dt * sp.userData.v;
        sp.position.y = 0.5 + Math.sin(ctx.t * 0.2 + i) * 0.8;
      });
    },
  };
}
```

- [ ] **Step 6: `src/scene/floors/presents.ts`** (strobing grid, crowd silhouettes, next-event sign)

```ts
import * as THREE from 'three';
import type { Floor } from '../../content/floors.ts';
import type { Part, FrameCtx } from '../stage.ts';
import { buildFloorBase } from './base.ts';
import { makeLabel } from '../label.ts';
import { eventLabel } from '../../lib/links.ts';

const PINK = new THREE.Color('#FF2BD6'), CYAN = new THREE.Color('#00E5FF'), OFF = new THREE.Color('#13131C');

export function buildPresents(floor: Floor, index: number): Part {
  const { group, hit, pulseOf } = buildFloorBase(floor, index);

  // Light-up grid on the back wall: 12×6 tiles.
  const COLS = 12, ROWS = 6, tiles = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.85, 0.85), new THREE.MeshBasicMaterial({ toneMapped: false }), COLS * ROWS);
  const m = new THREE.Matrix4();
  for (let i = 0; i < COLS * ROWS; i++) {
    m.makeTranslation((i % COLS) - COLS / 2 + 0.5, Math.floor(i / COLS) + 0.8, -5);
    tiles.setMatrixAt(i, m); tiles.setColorAt(i, OFF);
  }
  group.add(tiles);

  // Crowd: dark capsules in front, bobbing on the beat.
  const CROWD = 40, crowd = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.28, 0.9, 4, 8), new THREE.MeshBasicMaterial({ color: 0x050508 }), CROWD);
  const spots = Array.from({ length: CROWD }, () => [(Math.random() - 0.5) * 10, (Math.random() - 0.5) * 7 + 1, Math.random() * Math.PI * 2]);
  group.add(crowd);

  const sign = makeLabel(eventLabel(floor.presents?.event ?? null), '#00E5FF');
  sign.position.set(0, 7.2, -5); sign.scale.multiplyScalar(0.4);
  group.add(sign);

  let lastBeat = -1;
  return {
    object: group, hit, slug: floor.slug,
    update(ctx: FrameCtx) {
      const p = pulseOf(ctx.t);
      const beat = Math.floor((ctx.t * floor.bpm) / 60);
      if (beat !== lastBeat) {
        lastBeat = beat;
        for (let i = 0; i < COLS * ROWS; i++) {
          const on = (i * 7 + beat * 3) % 5 === 0;
          tiles.setColorAt(i, on ? ((i + beat) % 2 ? PINK : CYAN) : OFF);
        }
        tiles.instanceColor!.needsUpdate = true;
      }
      const n = ctx.low ? CROWD / 2 : CROWD;
      for (let i = 0; i < n; i++) {
        const [x, z, ph] = spots[i];
        m.makeTranslation(x, 0.3 + p * 0.35 * (0.6 + 0.4 * Math.sin(ph)), z);
        crowd.setMatrixAt(i, m);
      }
      crowd.count = n;
      crowd.instanceMatrix.needsUpdate = true;
    },
  };
}
```

- [ ] **Step 7: Add the parts in `src/scene/app.ts`.** Replace the `parts` line and make `start` wait for fonts (for the labels):

```ts
import { buildHall } from './hall.ts';
import { buildRaveWedding } from './floors/rave-wedding.ts';
import { buildPrivateEvents } from './floors/private-events.ts';
import { buildPresents } from './floors/presents.ts';
import { FLOORS } from '../content/floors.ts';
```
Change the signature to `export async function start(root: HTMLElement): Promise<void>`, and make the first statement:
```ts
  await Promise.race([document.fonts.load('800 72px Unbounded'), new Promise((r) => setTimeout(r, 1500))]);
```
Replace `const parts: Part[] = [buildTunnel()];` with:
```ts
  const builders = [buildRaveWedding, buildPrivateEvents, buildPresents];
  const floorParts = FLOORS.map((f, i) => builders[i](f, i));
  const parts: Part[] = [buildTunnel(), buildHall(), ...floorParts];
```
Leave the rest of `start()` unchanged.
In `boot.ts`, `m.start(root)` now returns a promise; the existing `.catch` covers it (change to `.then((m) => m.start(root)).catch(...)`, which already chains).

- [ ] **Step 8: Build, test, shoot, look**

Run: `npm run build && npm test && npm run shots phone`
Expected: unit and build checks pass. The `3-hall` shot shows three lit floors with labels. Floor deep links still render the hall view, because Task 7 adds routing. Open `phone-3-hall.png` with Read and check: all three floors distinguishable, labels legible, no floor clipped off-screen at focus 1. Adjust `FLOOR_X` spacing or the camera hall target (`rig.ts`, keeping its tests green) if needed.

- [ ] **Step 9: Commit**

```bash
git add src/scene
git commit -m "Scene: festival hall and three floors (mirrorball, LED wall, strobe grid)"
```

---

### Task 7: Interaction: input, router, panels, deep links

**Files:**
- Modify: `src/scene/app.ts` (full version below)

**Interfaces:**
- Consumes: everything above.
- Produces: the final `start(root)` and `window.__xp`.

- [ ] **Step 1: Run the smoke suite, expect FAIL**

Run: `npm run build && npm run shots smoke`
Expected: `FAIL: smoke: back arrow should go to /...` (or a selector timeout), because there's no router yet.

- [ ] **Step 2: Replace `src/scene/app.ts` with the full wiring**

```ts
import * as THREE from 'three';
import { createStage } from './stage.ts';
import type { Part, FrameCtx } from './stage.ts';
import { buildTunnel } from './tunnel.ts';
import { buildHall } from './hall.ts';
import { buildRaveWedding } from './floors/rave-wedding.ts';
import { buildPrivateEvents } from './floors/private-events.ts';
import { buildPresents } from './floors/presents.ts';
import { FLOORS, SLUGS } from '../content/floors.ts';
import type { Slug } from '../content/floors.ts';
import { initialState, scrollBy, skip, step, enter, leave, swipeDir, cameraTarget } from './rig.ts';
import type { RigState } from './rig.ts';
import { slugFromPath, pathForSlug } from './route.ts';
import { setOpen } from './panels.ts';

declare global { interface Window { __xp: { setProgress(p: number): void; state(): RigState; sample(): boolean } } }

export async function start(root: HTMLElement): Promise<void> {
  await Promise.race([document.fonts.load('800 72px Unbounded'), new Promise((r) => setTimeout(r, 1500))]);
  const canvas = root.querySelector<HTMLCanvasElement>('.xp-canvas')!;
  const stage = createStage(canvas);
  const builders = [buildRaveWedding, buildPrivateEvents, buildPresents];
  const floorParts = FLOORS.map((f, i) => builders[i](f, i));
  const parts: Part[] = [buildTunnel(), buildHall(), ...floorParts];
  parts.forEach((p) => stage.scene.add(p.object));

  const initialSlug = root.dataset.initial || null;
  let s: RigState = initialState(initialSlug ? SLUGS.indexOf(initialSlug as Slug) : null);
  const hallName = root.querySelector<HTMLElement>('.hall-name')!;

  // ---- state → DOM ----
  const sync = () => {
    root.dataset.mode = s.mode;
    root.style.setProperty('--p', String(s.progress));
    hallName.textContent = FLOORS[s.focus].name;
    setOpen(root, s.active === null ? null : SLUGS[s.active]);
  };
  const go = (next: RigState, push: boolean) => {
    const was = s.active;
    s = next;
    if (push && was !== s.active) history.pushState(null, '', pathForSlug(s.active === null ? null : SLUGS[s.active]));
    sync();
  };

  // ---- router ----
  addEventListener('popstate', () => {
    const slug = slugFromPath(location.pathname, SLUGS);
    go(slug ? enter(s, SLUGS.indexOf(slug as Slug)) : leave(skip(s)), false);
  });

  // ---- input (ignored when it starts inside an open panel) ----
  const inPanel = (e: Event) => !!(e.target as Element | null)?.closest?.('.panel');
  addEventListener('wheel', (e) => {
    if (inPanel(e)) return;
    if (s.mode === 'tunnel') go(scrollBy(s, e.deltaY, innerHeight), false);
    else if (s.mode === 'hall' && Math.abs(e.deltaX) > 30) go(step(s, e.deltaX > 0 ? 1 : -1), false);
  }, { passive: true });

  let t0: { x: number; y: number; time: number } | null = null;
  canvas.addEventListener('pointerdown', (e) => { t0 = { x: e.clientX, y: e.clientY, time: performance.now() }; });
  canvas.addEventListener('pointermove', (e) => {
    if (!t0 || s.mode !== 'tunnel') return;
    go(scrollBy(s, (t0.y - e.clientY) * 1.5, innerHeight), false);
    t0 = { ...t0, x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!t0) return;
    const dx = e.clientX - t0.x, dy = e.clientY - t0.y, quick = performance.now() - t0.time < 400;
    t0 = null;
    if (s.mode !== 'hall') return;
    const dir = swipeDir(dx, dy);
    if (dir) return go(step(s, dir), false);
    if (quick && Math.hypot(dx, dy) < 10) tapAt(e.clientX, e.clientY);
  });

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function tapAt(x: number, y: number) {
    ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, stage.camera);
    const hit = ray.intersectObjects(floorParts.map((p) => p.hit!), false)[0];
    if (hit) go(enter(s, floorParts.findIndex((p) => p.hit === hit.object)), true);
  }

  addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') go(step(s, -1), false);
    else if (e.key === 'ArrowRight') go(step(s, 1), false);
    else if (e.key === 'Enter' && s.mode === 'hall') go(enter(s), true);
    else if (e.key === 'Escape' && s.mode === 'floor') go(leave(s), true);
    else if ((e.key === 'ArrowDown' || e.key === ' ') && s.mode === 'tunnel') go(scrollBy(s, innerHeight / 2, innerHeight), false);
  });

  root.querySelector('.skip')!.addEventListener('click', (e) => { e.preventDefault(); go(skip(s), false); });
  root.querySelector('.hall-prev')!.addEventListener('click', () => go(step(s, -1), false));
  root.querySelector('.hall-next')!.addEventListener('click', () => go(step(s, 1), false));
  root.querySelector('.hall-enter')!.addEventListener('click', () => go(enter(s), true));
  root.querySelectorAll('.panel-back').forEach((b) => b.addEventListener('click', () => go(leave(s), true)));

  window.__xp = {
    setProgress: (p) => go(scrollBy({ ...s, mode: 'tunnel', progress: 0, active: null }, p * 3 * innerHeight, innerHeight), false),
    state: () => s,
    sample: () => stage.sample(),
  };

  // ---- frame loop ----
  const pos = new THREE.Vector3(), look = new THREE.Vector3(), lookNow = new THREE.Vector3();
  const snap = cameraTarget(s); // deep links start in place, no fly-in
  stage.camera.position.set(...snap.pos); lookNow.set(...snap.look);
  let first = true;
  stage.start((t, dt) => {
    const tgt = cameraTarget(s);
    pos.set(...tgt.pos); look.set(...tgt.look);
    const k = 1 - Math.exp(-dt * (s.mode === 'tunnel' ? 6 : 2.5));
    stage.camera.position.lerp(pos, k); lookNow.lerp(look, k); stage.camera.lookAt(lookNow);
    const ctx: FrameCtx = { t, dt, progress: s.progress, focus: s.focus, active: s.active === null ? null : SLUGS[s.active], low: stage.low };
    parts.forEach((p) => p.update(ctx));
    if (first) { first = false; requestAnimationFrame(() => document.documentElement.classList.add('xp-ready')); }
  });
  sync();
}
```

- [ ] **Step 3: Run the full suite**

Run: `npm run build && npm test && npm run shots`
Expected: `OK: shots in .superpowers/shots`, with no FAIL lines.

- [ ] **Step 4: Visual review.** Open every PNG in `.superpowers/shots/` with Read: phone and desktop arrival, tunnel, hall, the three floors, and fallback-full. Checklist:
  - Arrival: wordmark readable; "Skip" top right; scroll hint visible.
  - Tunnel: rings converge to a vanishing point, both pink and cyan present.
  - Hall: three floors visible and distinct; the hall UI bar shows the floor name.
  - Each floor: the floor's visual is visible above the sheet (phone) or beside it (desktop); the sheet shows headline, lines and the SoundCloud iframe area; the CTAs fit without overflow at 390px.
  - Fallback: hero, cards and three panels, styled, with no 3D artifacts.
  For any failure, adjust camera targets in `rig.ts` (keep the tests green), sheet `max-height`, or part geometry, then re-run Step 3.

- [ ] **Step 5: Bundle budget.**

Run: `for f in dist/_astro/*.js; do printf "%s %s\n" "$(gzip -c "$f" | wc -c)" "$f"; done | sort -n`
Expected: the largest chunk (three + scene) is under 256000 bytes, and the entry chunk containing `boot` is under 10000 bytes and contains no `WebGLRenderer` (`grep -L WebGLRenderer` on it). If over budget, switch `import * as THREE from 'three'` to named imports in every scene file.

- [ ] **Step 6: Commit**

```bash
git add src/scene
git commit -m "Scene: input, routing, deep links, panels: full experience"
```

---

### Task 8: Wrap-up

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Final verification**

Run: `npm run build && npm test && npm run shots`
Expected: `OK: build output valid`, all unit tests pass, and `OK: shots in .superpowers/shots`.

- [ ] **Step 2: Update `AGENTS.md` Status**: the site is built on `main` (not pushed). The placeholder content list (SoundCloud URLs, WhatsApp, email, next event, Instagram) still lives in `src/content/floors.ts`. Run `npm run shots` for a visual check, and the user should do a manual real-phone pass before pushing.

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "AGENTS.md: festival site built, pending real content + phone pass"
```

- [ ] **Step 4: Ask the user** to test on their phone via `npx astro preview --host`, opening the LAN URL. Then wait for the go-ahead before pushing.
