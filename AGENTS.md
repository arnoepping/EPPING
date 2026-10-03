# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# EPPING — eppingmusic.com

Website for Epping: DJ and party organizer. (`CLAUDE.md` is a symlink to this file.)

## Preferences
- Replies: English, extremely concise; fragments are fine.
- Use the Superpowers workflow: brainstorm → spec → plan → execute.
- POC/MVP: speed over QA. No tests, test suites, Playwright/screenshot tooling, TDD or review loops unless the user asks. Verify with `npm run build` only. This overrides skills that call for tests or reviews.
- Update this file yourself at checkpoints (spec approved, task done, merge/push, key decision, wrap-up): refresh Status, drop stale items, commit. Don't ask first.
- Push to `main` only when the user says so (a push deploys the site).
- Auto-mode blocks Claude from public-facing GitHub changes (visibility, Pages settings). Give the user a `! <command>` to run instead.

## Stack / pipeline
- Astro static site. `npm run build`. No tests.
- `public/CNAME` is ignored by Actions-based Pages deploys (the domain is a repo setting).
- `.github/workflows/deploy.yml`: push to `main` triggers build, then deploy to GitHub Pages.
- `gh` CLI is installed and logged in as `arnoepping` with workflow scope. Repo `arnoepping/EPPING` is public.
- Dev server: `astro dev --background` (manage it with `astro dev stop`, `astro dev status` and `astro dev logs`). Docs: https://docs.astro.build

## Status (2026-10-03)
- **Domain:** http://eppingmusic.com is live on GitHub Pages. DNS has been moved to GitHub (A/AAAA records, plus `www` CNAME → `arnoepping.github.io`), and domain verification passed.
  - **Next:** wait for the HTTPS certificate, then tick Enforce HTTPS (repo Settings → Pages). After that, cancel the Squarespace *website* subscription (keep the domain).
  - Never touch MX, SPF or `google._domainkey`: email runs on Google Workspace.
  - DNS snapshot from before the switch: `.superpowers/sdd/2026-10-02-deploy-pipeline/dns-before.txt` (git-ignored, local only).
- **Brand:** spec approved (`docs/superpowers/specs/2026-10-02-brand-identity-design.md`): logo A (Unbounded 800, RGB split), black/pink/cyan palette. Built (commits 3373c00..8d50901, not pushed): logo SVGs in `public/brand/`, favicon, `tokens.css`/`ui.css`, `Base.astro`, `Wordmark.astro`, `/brand/` page. Regenerate logos with `npm run logo`.
- **Website:** built and pushed (spec `docs/superpowers/specs/2026-10-02-festival-site-design.md`, plan `docs/superpowers/plans/2026-10-02-festival-site.md`). Three.js tunnel → hall with 3 floors (Rave Wedding, Private Events, Epping Presents); static fallback for no-JS/reduced motion.
  - Local phone test: `npm run build && npx astro preview --host`.
  - Placeholders in `src/content/floors.ts`: 3 SoundCloud URLs, WhatsApp number, booking email, next Presents event, Instagram handle.
- **Later:**
  - possibly add DMARC, and possibly move the domain to Cloudflare
