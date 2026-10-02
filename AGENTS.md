# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# EPPING — eppingmusic.com

Website for Epping: DJ and party organizer. (`CLAUDE.md` is a symlink to this file.)

## Preferences
- Replies: English, extremely concise; fragments are fine.
- Use the Superpowers workflow: brainstorm → spec → plan → execute.
- Update this file yourself at checkpoints (spec approved, task done, merge/push, key decision, wrap-up): refresh Status, drop stale items, commit. Don't ask first.
- Push to `main` only when the user says so (a push deploys the site).
- Auto-mode blocks Claude from public-facing GitHub changes (visibility, Pages settings). Give the user a `! <command>` to run instead.

## Stack / pipeline
- Astro static site. `npm run build`, then `npm test` checks `dist/` (`scripts/check-build.mjs`). That's the only test: it needs a fresh build, and CI runs it before uploading, so a failing check blocks the deploy.
- `public/CNAME` is ignored by Actions-based Pages deploys (the domain is a repo setting); the file stays only as a guard checked by `npm test`.
- Until the custom domain is live, the site is served under `/EPPING/`, so absolute paths like `/favicon.svg` break there. This is expected and needs no `base` config.
- `.github/workflows/deploy.yml`: push to `main` triggers build, test, then deploy to GitHub Pages.
- `gh` CLI is installed and logged in as `arnoepping` with workflow scope. Repo `arnoepping/EPPING` is public.
- Dev server: `astro dev --background` (manage it with `astro dev stop`, `astro dev status` and `astro dev logs`). Docs: https://docs.astro.build

## Status (2026-10-02)
- Brand + festival site are pushed and deployed, but https://arnoepping.github.io/EPPING/ looks broken: CSS/JS load from absolute `/_astro/...`, which 404s under the `/EPPING/` subpath. Works locally and will work at the domain root. Fix: do the domain cutover (preferred), or as a stopgap set `base` in `astro.config.mjs` from an env var in CI.
- **Next: domain cutover.** Remaining steps are Task 3 step 3+5 and Task 4 in `docs/superpowers/plans/2026-10-02-deploy-pipeline.md`.
  - Domain is registered at Squarespace Domains; its DNS is in the Squarespace panel.
  - Never touch MX, SPF or `google._domainkey`: email runs on Google Workspace.
  - DNS snapshot from before the switch: `.superpowers/sdd/2026-10-02-deploy-pipeline/dns-before.txt` (git-ignored, local only).
  - Set the domain with `gh api -X PUT repos/arnoepping/EPPING/pages -f cname=eppingmusic.com`
  - Cancel the Squarespace website subscription only after the new site is live.
- **Brand:** spec approved (`docs/superpowers/specs/2026-10-02-brand-identity-design.md`): logo A (Unbounded 800, RGB split), black/pink/cyan palette. Built (commits 3373c00..8d50901, not pushed): logo SVGs in `public/brand/`, favicon, `tokens.css`/`ui.css`, `Base.astro`, `Wordmark.astro`, `/brand/` page. Regenerate logos with `npm run logo`.
- **Website:** built and pushed (spec `docs/superpowers/specs/2026-10-02-festival-site-design.md`, plan `docs/superpowers/plans/2026-10-02-festival-site.md`). Three.js tunnel → hall with 3 floors (Rave Wedding, Private Events, Epping Presents); static fallback for no-JS/reduced motion.
  - Local phone test: `npm run build && npx astro preview --host`.
  - User preference: POC/MVP, so skip tests and review loops.
  - `npm run shots` = Playwright screenshots + smoke checks into `.superpowers/shots/` (headless WebGL via swiftshader).
  - Placeholders in `src/content/floors.ts`: 3 SoundCloud URLs, WhatsApp number, booking email, next Presents event, Instagram handle.
  - Known: in-app URLs drop the `/EPPING/` prefix, so reloading a floor page 404s until the custom domain is live.
- **Later:**
  - possibly add DMARC, and possibly move the domain to Cloudflare
