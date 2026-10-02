# Deploy Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Push to `main` → placeholder site live at https://eppingmusic.com via GitHub Pages.

**Architecture:** Static Astro site in repo root. GitHub Action builds and deploys to Pages. Domain stays at Squarespace Domains; only DNS records repointed.

**Tech Stack:** Node (LTS via Homebrew), Astro (latest, minimal template), GitHub Actions (`withastro/action`, `actions/deploy-pages`).

**Spec:** `docs/superpowers/specs/2026-10-02-deploy-pipeline-design.md`

## Global Constraints
- Site URL: `https://eppingmusic.com`; `www` redirects to apex (GitHub handles via CNAME).
- `public/CNAME` content exactly: `eppingmusic.com`
- GitHub Pages IPs: A `185.199.108.153` `185.199.109.153` `185.199.110.153` `185.199.111.153`; AAAA `2606:50c0:8000::153` `2606:50c0:8001::153` `2606:50c0:8002::153` `2606:50c0:8003::153`
- `www` CNAME → `arnoepping.github.io`
- Never touch MX (`1 smtp.google.com`) or SPF TXT (`v=spf1 include:_spf.google.com ~all`).
- Workflow action versions: use latest major tags, checked at execution time against each action's GitHub releases.
- No `gh` CLI; GitHub UI steps are done by Arno.

## Review Focus
1. `CNAME` missing from build output → custom domain resets on every deploy. Pinned by Task 1 check.
2. Email breaks after DNS edit → MX/SPF must be identical before/after. Pinned by Task 4 Step 1 + Step 4.
3. `www.eppingmusic.com` not working or no HTTPS → Task 4 curl check.
4. Unknown path shows GitHub's generic 404 → custom `404.html` built. Pinned by Task 1 check.
5. Deploy from wrong branch / no manual trigger → workflow triggers `main` + `workflow_dispatch`. Checked in Task 2.

---

### Task 1: Astro scaffold + build check

**Files:**
- Create: Astro minimal template files (`package.json`, `astro.config.mjs`, `src/pages/index.astro`, `tsconfig.json`, `.gitignore`)
- Create: `src/pages/404.astro`, `public/CNAME`, `scripts/check-build.mjs`

**Interfaces:**
- Produces: `npm run build` → `dist/`; `npm test` → validates `dist/`.

- [ ] **Step 1: Install Node**
Run: `brew install node && node -v && npm -v`

- [ ] **Step 2: Scaffold Astro into repo root**
Run: `npm create astro@latest . -- --template minimal --install --no-git --skip-houston --yes`
Keep existing `README.md` and `.gitattributes`.

- [ ] **Step 3: Write build check (the test)**
`scripts/check-build.mjs`:
```js
import { readFileSync, existsSync } from 'node:fs';

const fail = (msg) => { console.error(`FAIL: ${msg}`); process.exit(1); };

if (!existsSync('dist/index.html')) fail('dist/index.html missing');
if (!readFileSync('dist/index.html', 'utf8').includes('EPPING')) fail('index.html lacks "EPPING"');
if (!existsSync('dist/404.html')) fail('dist/404.html missing');
if (!existsSync('dist/CNAME')) fail('dist/CNAME missing');
if (readFileSync('dist/CNAME', 'utf8').trim() !== 'eppingmusic.com') fail('CNAME content wrong');

console.log('OK: build output valid');
```
Add to `package.json` scripts: `"test": "node scripts/check-build.mjs"`

- [ ] **Step 4: Run test, verify it fails**
Run: `npm run build && npm test`
Expected: FAIL (`lacks "EPPING"` or `404.html missing`)

- [ ] **Step 5: Implement**
`astro.config.mjs`:
```js
// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://eppingmusic.com',
});
```
`public/CNAME`:
```
eppingmusic.com
```
`src/pages/index.astro`:
```astro
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>EPPING</title>
  </head>
  <body>
    <h1>EPPING</h1>
  </body>
</html>
```
`src/pages/404.astro`:
```astro
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>Not found | EPPING</title>
  </head>
  <body>
    <h1>404</h1>
    <p><a href="/">Back to EPPING</a></p>
  </body>
</html>
```

- [ ] **Step 6: Run test, verify pass**
Run: `npm run build && npm test`
Expected: `OK: build output valid`

- [ ] **Step 7: Commit**
```bash
git add -A && git commit -m "Scaffold Astro site with placeholder and build check"
```

### Task 2: GitHub Actions deploy workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: `npm run build`, `npm test` from Task 1.

- [ ] **Step 1: Check latest major versions** of `actions/checkout`, `withastro/action`, `actions/deploy-pages` on GitHub releases; substitute below if newer.

- [ ] **Step 2: Write workflow**
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: withastro/action@v5
      - run: npm test

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```
Note: `withastro/action` builds and uploads the Pages artifact; the `npm test` step runs after build in same job, so `dist/` exists.

- [ ] **Step 3: Validate YAML locally**
Run: `ruby -ryaml -e 'YAML.load_file(".github/workflows/deploy.yml"); puts "OK"'`
Expected: `OK`

- [ ] **Step 4: Commit + push**
```bash
git add .github && git commit -m "Add GitHub Pages deploy workflow" && git push origin main
```
Workflow may fail until Task 3 done (Pages not enabled). Expected.

### Task 3: GitHub settings (Arno, manual)

- [ ] **Step 1:** Repo → Settings → General → Danger Zone → Change visibility → Public.
- [ ] **Step 2:** Repo → Settings → Pages → Build and deployment → Source: **GitHub Actions**.
- [ ] **Step 3:** Account (profile) Settings → Pages → Add verified domain `eppingmusic.com` → copy TXT record name + value (needed in Task 4).
- [ ] **Step 4:** Repo → Actions → "Deploy to GitHub Pages" → Run workflow. Expected: green; site at `https://arnoepping.github.io/EPPING/` (paths may look off until custom domain active — fine).
- [ ] **Step 5:** Repo → Settings → Pages → Custom domain: `eppingmusic.com` → Save.

### Task 4: DNS cutover + verification

- [ ] **Step 1: Snapshot current DNS**
```bash
for t in A AAAA MX TXT; do echo "== $t"; dig +short $t eppingmusic.com; done; dig +short CNAME www.eppingmusic.com
dig +short TXT google._domainkey.eppingmusic.com; dig +short TXT _dmarc.eppingmusic.com
```
Save output to scratchpad. Expected MX: `1 smtp.google.com.`

- [ ] **Step 2 (Arno, Squarespace Domains → eppingmusic.com → DNS):**
  - Delete Squarespace Defaults preset (A records 198.x + www → ext-sq.squarespace.com). Keep Google Workspace preset/records.
  - Add 4 A `@` records + 4 AAAA `@` records (Global Constraints).
  - Add CNAME `www` → `arnoepping.github.io`.
  - Add TXT from Task 3 Step 3.

- [ ] **Step 3: Wait for propagation**, poll:
```bash
dig +short A eppingmusic.com @8.8.8.8
```
Expected: four `185.199.10x.153` IPs only.

- [ ] **Step 4: Verify email untouched**
`dig +short MX eppingmusic.com; dig +short TXT eppingmusic.com; dig +short TXT google._domainkey.eppingmusic.com; dig +short TXT _dmarc.eppingmusic.com` — identical to snapshot (+ nothing removed).

- [ ] **Step 5 (Arno):** Account Settings → Pages → Verify domain. Repo Settings → Pages → DNS check green → tick **Enforce HTTPS** once available.

- [ ] **Step 6: Verify site**
```bash
curl -sI https://eppingmusic.com | head -1
curl -s https://eppingmusic.com | grep -o '<h1>EPPING</h1>'
curl -sIL https://www.eppingmusic.com | grep -iE '^(HTTP|location)'
curl -sI http://eppingmusic.com | grep -iE '^(HTTP|location)'
curl -s -o /dev/null -w '%{http_code}\n' https://eppingmusic.com/nope
```
Expected: `200`; `<h1>EPPING</h1>`; www → 301 to apex then 200; http → 301 to https; `/nope` → 404.

- [ ] **Step 7:** Arno cancels Squarespace website subscription (not the domain).
