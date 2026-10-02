# Deploy pipeline: eppingmusic.com

## Goal
Push to `main` → site live at https://eppingmusic.com via GitHub Pages. No more Squarespace site. Email (Google Workspace) keeps working.

## Scope
Foundation only. Content, logo, contact form, SoundCloud, sections (e.g. rave weddings) = later sessions.

## Decisions
- **Stack:** Astro (static output).
- **Hosting:** GitHub Pages, deployed via GitHub Actions (`withastro/action` + `actions/deploy-pages`).
- **Repo:** `arnoepping/EPPING` becomes public (required for free Pages).
- **Domain:** stays registered at Squarespace Domains; only DNS records change. Registrar transfer = later/optional.
- **Contact form (later):** external service (Web3Forms/Formspree); Pages has no backend.

## Components
1. Astro project in repo root; `astro.config.mjs` with `site: 'https://eppingmusic.com'`.
2. `public/CNAME` containing `eppingmusic.com`.
3. `.github/workflows/deploy.yml`: build + deploy on push to `main` and manual (`workflow_dispatch`).
4. Placeholder homepage: "EPPING".

## DNS (Squarespace panel, manual by Arno)
| Type | Host | Value |
|---|---|---|
| A | @ | 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153 (replace Squarespace IPs) |
| AAAA | @ | 2606:50c0:8000::153, 2606:50c0:8001::153, 2606:50c0:8002::153, 2606:50c0:8003::153 |
| CNAME | www | arnoepping.github.io (replaces ext-sq.squarespace.com) |
| TXT | _github-pages-challenge-arnoepping | value from GitHub settings (domain verification) |

Do not touch: MX (`smtp.google.com`), SPF TXT, other Google records.

## GitHub settings (manual by Arno)
- Repo → public.
- Settings → Pages → Source: GitHub Actions.
- Settings → Pages → Custom domain: `eppingmusic.com`; Enforce HTTPS once cert is issued.
- Account Settings → Pages → verify domain.

## Verification
- `npm run build` succeeds locally.
- Action green.
- `dig` shows GitHub IPs; MX unchanged.
- https://eppingmusic.com and https://www.eppingmusic.com show placeholder with valid cert.

## Risks
- DNS propagation up to a few hours; cert only after propagation.
- Cancel Squarespace site/subscription only after new site is live.
