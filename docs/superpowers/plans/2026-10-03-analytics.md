# Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cookie-free Umami Cloud analytics with custom events for the entrance, floor pages and contact clicks.

**Architecture:**
- One script tag in `Base.astro`, production builds only.
- `src/lib/track.ts` is a safe wrapper around `window.umami.track`, used from `app.ts`.
- Static links use Umami's `data-umami-event` attributes. Umami listens for clicks at the document level, so this also works inside the floor overlay, which is injected from `<template>`.

**Tech Stack:** Astro, TypeScript, Umami Cloud.

**Spec:** `docs/superpowers/specs/2026-10-03-analytics-design.md`

## Global Constraints
- No cookies, no consent banner, `data-do-not-track="true"`.
- Script only when `import.meta.env.PROD` **and** `UMAMI_ID` is non-empty; `data-domains="eppingmusic.com"`.
- Event names exactly: `entrance-stage`, `entrance-door`, `skip`, `replay`, `sound-on`, `floor-open`, `contact`.
- Event data values: stage `street|stairs|roof`; door `street|top`; contact type `whatsapp|email|copy-email|instagram|soundcloud`; floor = slug.
- Verify with `npm run build` only. No tests (project preference).
- Work in the worktree `../EPPING-analytics` on branch `analytics`. Never push to `main` without the user's go.

## Review Focus
- **Umami blocked by an ad-blocker:** the site must work unchanged. `track()` never throws, and the entrance never waits on it.
- **The ID isn't known yet:** the build must still pass and must not render a script tag with an empty ID.
- **Local, dev or artifact preview visits:** these must not show up in the stats. `PROD` plus `data-domains` handle this.
- **Stage events must fire once per page load, not once per frame.** Replay must not re-fire them either: drop-off counts are per load.
- **The `realism` branch also edits `src/entrance/app.ts`:** keep the hooks to small, isolated lines so the later merge is easy.

---

### Task 1: Script tag + `track()` helper

**Files:**
- Create: `src/lib/track.ts`
- Modify: `src/layouts/Base.astro` (head)

- [ ] **Step 1: Create `src/lib/track.ts`**

```ts
// Umami Cloud (cookie-free). Website ID is public; empty = analytics off.
export const UMAMI_ID = '';

declare global { interface Window { umami?: { track: (name: string, data?: Record<string, string>) => void } } }

export function track(name: string, data?: Record<string, string>) {
  try { window.umami?.track(name, data); } catch { /* blocked or not loaded */ }
}
```

- [ ] **Step 2: Add the script in `Base.astro`**

Frontmatter: `import { UMAMI_ID } from '../lib/track.ts';`

In `<head>`, before `<slot name="head" />`:

```astro
{import.meta.env.PROD && UMAMI_ID && <script is:inline defer src="https://cloud.umami.is/script.js" data-website-id={UMAMI_ID} data-domains="eppingmusic.com" data-do-not-track="true"></script>}
```

- [ ] **Step 3: Verify.** Run `npm run build`; expect success. While `UMAMI_ID` is empty, `grep -r umami dist/*.html` should find nothing.

- [ ] **Step 4: Commit.** Message: `Analytics: Umami script tag + track() helper`.

### Task 2: Entrance + floor events in `app.ts`

**Files:**
- Modify: `src/entrance/app.ts`

**Interfaces:**
- Consumes: `track(name, data?)` from `../lib/track.ts`

- [ ] **Step 1: Import.** Add `import { track } from '../lib/track.ts';`.

- [ ] **Step 2: Doors.** In the door click handler (`canvas.addEventListener('click', …)`):

```ts
canvas.addEventListener('click', (e) => { const to = doorUnder(e); if (to !== null) { track('entrance-door', { door: to === AUTO_FROM ? 'top' : 'street' }); goTo(to); } });
```

- [ ] **Step 3: HUD.**
  - In the sound toggle, after `const on = await sound.toggle();` add `if (on) track('sound-on');`.
  - In the skip handler, prepend `track('skip');`.
  - In the `[data-again]` handler, prepend `track('replay');`.

- [ ] **Step 4: Floor overlay.** In `openFloor`, after the `if (!tpl) return;` line, add `track('floor-open', { floor: slug });`.

- [ ] **Step 5: Copy email.** In the root click handler, change the copy line to:

```ts
if (cp) { track('contact', { type: 'copy-email', floor: cp.dataset.floorSlug ?? '' }); navigator.clipboard.writeText(cp.dataset.copy!).then(() => (cp.textContent = 'Copied'), () => {}); }
```

`data-floor-slug` is added in Task 3.

- [ ] **Step 6: Stages (once per load).** Before the loop, add:

```ts
const STAGE_NAMES = ['street', 'stairs', 'roof'], seen = new Set<number>();
```

In the loop, right after `const stage = …` is computed:

```ts
if (!seen.has(stage)) { seen.add(stage); track('entrance-stage', { stage: STAGE_NAMES[stage] }); }
```

Stage 0 fires on the first frame and is the "entrance loaded" baseline. If Umami isn't loaded yet, that first call is a no-op; that's accepted. Umami counts the page view itself.

- [ ] **Step 7: Verify.** Run `npm run build`; expect success.

- [ ] **Step 8: Commit.** Message: `Analytics: entrance, HUD and floor-open events`.

### Task 3: Contact link attributes in `FloorPage.astro`

**Files:**
- Modify: `src/components/FloorPage.astro`
- Modify: `src/pages/[floor].astro`

- [ ] **Step 1: Add attributes.** `data-umami-event="contact"` goes on the WhatsApp, Email, Instagram and SoundCloud links. Each also gets `data-umami-event-type`, and all of them get `data-umami-event-floor={f.slug}`:
  - WhatsApp: `data-umami-event="contact" data-umami-event-type="whatsapp" data-umami-event-floor={f.slug}`
  - Email: `data-umami-event="contact" data-umami-event-type="email" data-umami-event-floor={f.slug}`
  - Instagram: `data-umami-event="contact" data-umami-event-type="instagram" data-umami-event-floor={f.slug}`
  - SoundCloud: `data-umami-event="contact" data-umami-event-type="soundcloud" data-umami-event-floor={f.slug}`
  - Copy button: add `data-floor-slug={f.slug}`. Its event comes from `app.ts`.

- [ ] **Step 2: Copy on standalone `/slug/` pages.** `src/pages/[floor].astro` has no script, so the Copy button currently does nothing there (an existing bug). Add this at the end of the page body, inside `<Base>`:

```astro
<script>
  import { track } from '../lib/track.ts';
  document.addEventListener('click', (e) => {
    const cp = (e.target as Element).closest<HTMLElement>('[data-copy]');
    if (!cp) return;
    track('contact', { type: 'copy-email', floor: cp.dataset.floorSlug ?? '' });
    navigator.clipboard.writeText(cp.dataset.copy!).then(() => (cp.textContent = 'Copied'), () => {});
  });
</script>
```

- [ ] **Step 3: Verify.** Run `npm run build`; expect success. Then run `grep -c 'data-umami-event="contact"' dist/rave-wedding/index.html`; expect 4.

- [ ] **Step 4: Commit.** Message: `Analytics: contact click events on floor pages`.

### Task 4: Go-live (needs the user)

- [ ] The user creates an Umami Cloud website for `eppingmusic.com` and sends the website ID.
- [ ] Set `UMAMI_ID` in `src/lib/track.ts`, run `npm run build`, and confirm the script is now in `dist/index.html`. Commit.
- [ ] Update AGENTS.md status (UTM link table → spec), then commit.
- [ ] After the user says go: merge `analytics` into `main` and push. Check Umami realtime for the page view, `entrance-stage` events and a test `contact` click.
