# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# EPPING — eppingmusic.com

Website for Epping: DJ and party organizer. (`CLAUDE.md` is a symlink to this file.)

## Preferences
- Replies: English, extremely concise; fragments are fine.
- Use the Superpowers workflow: brainstorm → spec → plan → execute.
- POC/MVP: speed over QA. No tests, test suites, TDD or review loops unless the user asks. Verify with `npm run build`.
- Visual work (mockups, 3D, layout): check it yourself with Playwright screenshots before sharing (key moments, both palettes, phone + desktop). Keep it quick: still frames only, no test suites.
- Update this file yourself at checkpoints (spec approved, task done, merge/push, key decision, wrap-up): refresh Status, drop stale items, commit. Don't ask first.
- Push to `main` only when the user says so (a push deploys the site).
- Auto-mode blocks Claude from public-facing GitHub changes (visibility, Pages settings). Give the user a `! <command>` to run instead.

## Stack / pipeline
- Astro static site. `npm run build`. No tests.
- `public/CNAME` is ignored by Actions-based Pages deploys (the domain is a repo setting).
- `.github/workflows/deploy.yml`: push to `main` triggers build, then deploy to GitHub Pages.
- `gh` CLI is installed and logged in as `arnoepping` with workflow scope. Repo `arnoepping/EPPING` is public.
- Dev server: `astro dev --background` (manage it with `astro dev stop`, `astro dev status` and `astro dev logs`). Docs: https://docs.astro.build

## Status (2026-10-03, evening)
- **Domain:** https://eppingmusic.com is live on GitHub Pages with HTTPS enforced. DNS is on GitHub (A/AAAA records, plus `www` CNAME → `arnoepping.github.io`).
  - Squarespace website subscription cancelled (domain kept).
  - Never touch MX, SPF or `google._domainkey`: email runs on Google Workspace.
  - DNS snapshot from before the switch: `.superpowers/sdd/2026-10-02-deploy-pipeline/dns-before.txt` (git-ignored, local only).
- **Logo: final.** Unbounded 800, G3 (no spur), RGB split. Use it everywhere. `npm run logo` outlines it (G3 data in `scripts/g3.json`) into `public/brand/`, the favicon and `src/components/wordmark.json` (used by `Wordmark.astro`). Replay-G idea dropped.
- **Open: colour palette.** Down to Sunset rave vs Gold rush (Current dropped, though the site still uses it). Until decided, every website mockup comes in two versions: Sunset rave and Gold rush. Compare them in the lab: `~/Documents/GitHub/epping-lab` → arnoepping.github.io/epping-lab/ (Instagram tab: 6 posts + story per palette, PNG export).
- **Media:** the user's photos/videos go in `media/inbox/` (git-ignored; the repo is public). Rooftop-set photos + street-party/rooftop clips are in; no wedding footage yet. Web-sized copies, video stills and 720p reels live in `epping-lab/media/` (git-ignored, local only). The lab's Instagram tab uses them: run it locally with `python3 -m http.server` (port 8000) in epping-lab. ffmpeg is installed (Homebrew) for frames, clips and reels.
  - Private share page with the photo mockups (rendered JPGs + 15 s reels): https://claude.ai/artifact/8ZZGb7t1tTM7x5XV8xcgZp, source in `media/ig-page/` (git-ignored). Republish from that path after re-rendering.
- **Brand:** spec approved (`docs/superpowers/specs/2026-10-02-brand-identity-design.md`): logo A (Unbounded 800, RGB split), black/pink/cyan palette. Built (commits 3373c00..8d50901, not pushed): logo SVGs in `public/brand/`, favicon, `tokens.css`/`ui.css`, `Base.astro`, `Wordmark.astro`, `/brand/` page. Regenerate logos with `npm run logo`.
- **Analytics: branch `analytics` (worktree `../EPPING-analytics`), spec `docs/superpowers/specs/2026-10-03-analytics-design.md` awaiting review.** Umami Cloud free, cookie-free, custom events (entrance stages, floors, contact clicks) + UTM links. Needs the Umami website ID from the user.
- **New site: LIVE on eppingmusic.com since 2026-10-03** (merged from branch `rooftop-3d`). three.js rebuild of the rooftop mockup replaces the tunnel/hall entirely (spec `docs/superpowers/specs/2026-10-03-rooftop-entrance-3d.md`). Code: `src/entrance/` (world.ts = street/stairs/roof + camera walk, app.ts = renderer/bloom/scroll/doors/floor overlay, sound.ts), `src/components/Entrance.astro` + `FloorPage.astro`, routes `/rave-wedding/` etc. Palette Sunset rave (`src/entrance/palette.ts` + `src/styles/tokens.css`). Private preview https://claude.ai/artifact/VJo89VNU63RYo5S9WU9sD5 (rebuild with `scripts/preview-artifact.sh`, republish from `media/preview-3d/`).
  - Media is committed (user's choice, 2026-10-03): own ADE House Mix (plays from 18:30), the dusk clip, six covers. The Mau P track was dropped for rights reasons.
  - Epping Presents next night: silent disco during ADE, Thu 22 Oct 2026, 19:00–22:00, Hoofddorpplein (`event` in `src/content/floors.ts`; remove after the night).
  - Rave Wedding SoundCloud set embeds via its api URL, but SoundCloud reports 0 playable tracks: the user needs to make the set's tracks public.
  - Next ideas: share preview image (og:image), realism pass on the street (Blender MCP later).
- **Rooftop mockup (done, reference):** The user picked concept 1 (The Door) and changed the story: brick wall + rope + neon sign outside → through the door, stairs up (muffled, louder as you climb) → rooftop party at dusk, ending on the dusk-with-smoke clip (`f8d559f2…MP4`). Mockup: `mockups/rooftop/` (forked engine), private page https://claude.ai/artifact/WDr3pafFf7zjuLDPAdGkAT, palette toggle (#sunset / #gold).
  - **For the real (three.js) build, keep:** a small "Scroll to get in" hint in the bottom-right corner (street-sign version rejected), clickable doors (street door → into the stairwell, top door → climb to the roof; scroll works too), sound on/off toggle, a small skip, a replay ("back to the street"). Mockup-only: stage counter + progress bar, palette switch.
  - **Next:** one more review round on story/pacing (not visuals), then rebuild in three.js on a branch (not `main`), with Playwright + Context7 MCPs. Blender MCP later for realism.
  - **Floor pages (mockup):** roof buttons open a black page per service (copy in `mockups/rooftop/floors.js`), video paused. Contact = WhatsApp (wa.me with prefilled text) + mailto with subject, email shown with copy button; no form. One SoundCloud mix per service (shown as a link card in the mockup, since the preview can't embed; real embed on the site). Real contact details filled in.
  - **Keep frozen:** the five-concept page (https://claude.ai/artifact/TG9vDPcgR6usLHNz3H51zP, source `mockups/entrance/`, git tag `entrance-concepts-v1`). Never republish or edit it; new work goes to new folders/pages.
- **Website:** built and pushed (spec `docs/superpowers/specs/2026-10-02-festival-site-design.md`, plan `docs/superpowers/plans/2026-10-02-festival-site.md`). Three.js tunnel → hall with 3 floors (Rave Wedding, Private Events, Epping Presents); static fallback for no-JS/reduced motion.
  - Local phone test: `npm run build && npx astro preview --host`.
  - Contact (real, in `src/content/floors.ts` + `mockups/rooftop/floors.js`): bookings@eppingmusic.com, WhatsApp +31 6 4018 7865, Instagram @epping.music, SoundCloud arno-epping (Rave Wedding = sets/marta-donalds-wedding, other two = ade-house-mix). Still placeholder: next Presents event.
- **Later:**
  - possibly add DMARC, and possibly move the domain to Cloudflare
