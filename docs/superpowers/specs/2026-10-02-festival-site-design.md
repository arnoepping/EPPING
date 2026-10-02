# Festival site: three.js tunnel → indoor festival

Date: 2026-10-02
Status: approved 2026-10-02
Depends on: `2026-10-02-brand-identity-design.md` (tokens, logo). Build that first.

## Goal

A memorable, mobile-first site. Visitors scroll through a neon tunnel into an indoor festival hall with three dance floors, one per product. Tapping a floor flies the camera there and opens its content. All copy is English.

## Products (floors)
| Slug | Name | Type | Look | BPM | Primary color |
|---|---|---|---|---|---|
| `rave-wedding` | Rave Wedding | bookable | Mirrorball, pink lasers, confetti. "ABBA to acid" | 126 | pink |
| `private-events` | Private Events | bookable | Cyan strobes, smoke, LED wall | 124 | cyan |
| `presents` | Epping Presents | public parties | Strobing grid, crowd silhouettes, "next event" sign | 138 | pink + cyan |

## Experience
1. **Arrival**: black screen with the HTML/CSS glitch wordmark (from the brand spec), a "scroll ↓" hint and a "skip" link.
2. **Tunnel**: scroll or swipe moves the camera through pink/cyan neon rings with scanlines and speed lines, about 3 viewport heights of scroll. The wordmark RGB-splits away on entry. "Skip" jumps straight to the hall.
3. **Hall**: a dark hall with fog and three floors side by side. Horizontal swipe (or wheel/arrow keys on desktop) orbits the camera between floors. Each floor has a floating neon name label, and the floors pulse to their BPM before you pick one.
4. **Floor**: tapping a floor (or its label) flies the camera in, runs `pushState` to `/<slug>/` and slides up a bottom sheet (a side sheet at ≥900px wide) while the 3D scene keeps animating behind it. A back arrow or browser Back returns to the hall.
5. **Panel content**:
   - All floors: punchy headline, 2–3 short lines, a SoundCloud embed (iframe created only when the panel opens).
   - Rave Wedding / Private Events: "Email" (`mailto:` with a prefilled subject) and "WhatsApp" (`https://wa.me/<number>?text=...`) buttons.
   - Presents: next event (date, venue, ticket link; the block is hidden if there's no event), a vibe line and an Instagram link.
6. **Audio**: silent until the user presses play in SoundCloud. The beat sync is faked from each floor's BPM, with no audio analysis.
7. **Deep links**: `/rave-wedding/`, `/private-events/` and `/presents/` load straight into that floor with its panel open and no tunnel.
8. **Fallback**: with no WebGL, `prefers-reduced-motion`, or before JS loads, visitors get a static styled page (hero wordmark, three product cards, panels as normal sections). Every route's copy is readable without JS.

## Architecture
```
src/content/floors.ts          typed data per floor: slug, name, colors, bpm, headline,
                               lines[], soundcloudUrl, cta {email, whatsapp} | presents {event?, instagram}
src/layouts/Base.astro         tokens.css, fonts, meta/OG
src/pages/index.astro          <Experience initial="hall-entry">
src/pages/[floor].astro        getStaticPaths from floors.ts; <Experience initial={slug}>
src/components/Experience.astro  canvas + fallback markup + all panels; loads scene lazily
src/components/Panel.astro     sheet markup per floor; CSS transitions only
src/scene/stage.ts             renderer, camera, resize, rAF loop, DPR cap 2, WebGL detect
src/scene/beat.ts              BPM clock → pulse 0..1 per floor
src/scene/camera-rig.ts        scroll/swipe/wheel/keys input, tunnel path, hall orbit, flyTo(slug)
src/scene/router.ts            pushState/popstate ↔ scene state ↔ panel open/close
src/scene/tunnel.ts            build(), update(t, progress)
src/scene/hall.ts              build(), update(t)
src/scene/floors/{rave-wedding,private-events,presents}.ts  build(), update(t, pulse)
```
- Each scene module exports `build(scene)` and `update(t, ...)` and owns its own disposal.
- Scene code doesn't touch the DOM. `router.ts` alone bridges the scene and the panels.
- Dependency: `three` only, with no postprocessing on mobile. Glow uses additive sprites and gradient planes.

## Performance budget
- First paint is HTML/CSS only. `three` and the scene are dynamically imported after `load`.
- Scene JS under 250KB gzipped. No shadow maps; instanced or procedural geometry; total textures under 200KB.
- Target 60fps on a mid-range phone. If frames stay over 20ms for 2s, drop DPR to 1 and halve particle counts.
- Rendering pauses when the tab is hidden.

## Content (placeholders until supplied)
3 SoundCloud URLs, the WhatsApp number, the booking email, the next Presents event and the Instagram handle. All of it lives in `floors.ts`.

## Testing
- `scripts/check-build.mjs` also asserts that each `dist/<slug>/index.html` exists and contains its headline and SoundCloud URL, that `dist/index.html` contains all three floor names, and that the CNAME guard still passes.
- `scripts/screenshot.mjs` (Playwright, devDependency) runs against the built site served by `astro preview`:
  - Viewports: iPhone 14 (390×844) and desktop (1440×900).
  - Shots: arrival, mid-tunnel, hall, each floor with its panel open, and fallback (reduced motion).
  - Output: `.superpowers/shots/*.png`, git-ignored and used for visual review.
  - Fails on any console error or a blank canvas (center pixel sample not uniform).
- Manual pass on a real phone before pushing.

## Out of scope
Mailing list, contact form, NL translation, CMS, true audio-reactive visuals, analytics.
