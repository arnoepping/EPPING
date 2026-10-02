# Deploy pipeline: eppingmusic.com

## Doel
Push naar `main` → site live op https://eppingmusic.com via GitHub Pages. Geen Squarespace-site meer. E-mail (Google Workspace) blijft werken.

## Scope
Alleen fundament. Content, logo, contactformulier, SoundCloud, secties (o.a. rave weddings) = latere sessies.

## Beslissingen
- **Stack:** Astro (static output).
- **Hosting:** GitHub Pages, deploy via GitHub Actions (`withastro/action` + `actions/deploy-pages`).
- **Repo:** `arnoepping/EPPING` wordt publiek (gratis Pages vereist dit).
- **Domein:** blijft geregistreerd bij Squarespace Domains; alleen DNS-records aangepast. Verhuizing registrar = later/optioneel.
- **Contactformulier (later):** externe dienst (Web3Forms/Formspree), Pages heeft geen backend.

## Componenten
1. Astro-project in repo-root; `astro.config.mjs` met `site: 'https://eppingmusic.com'`.
2. `public/CNAME` met `eppingmusic.com`.
3. `.github/workflows/deploy.yml`: build + deploy op push naar `main` en handmatig (`workflow_dispatch`).
4. Placeholder homepage: "EPPING".

## DNS (Squarespace-paneel, handmatig door Arno)
| Type | Host | Waarde |
|---|---|---|
| A | @ | 185.199.108.153, .109.153, .110.153, .111.153 (vervangt Squarespace-IP's) |
| AAAA | @ | 2606:50c0:8000::153, 8001::153, 8002::153, 8003::153 |
| CNAME | www | arnoepping.github.io (vervangt ext-sq.squarespace.com) |
| TXT | _github-pages-challenge-arnoepping | waarde uit GitHub-instellingen (domeinverificatie) |

Niet aanraken: MX (`smtp.google.com`), SPF TXT, overige Google-records.

## GitHub-instellingen (handmatig door Arno)
- Repo → public.
- Settings → Pages → Source: GitHub Actions.
- Settings → Pages → Custom domain: `eppingmusic.com`; Enforce HTTPS aan zodra cert klaar is.
- Account Settings → Pages → domein verifiëren.

## Verificatie
- `npm run build` lokaal slaagt.
- Action groen.
- `dig` toont GitHub-IP's; MX ongewijzigd.
- https://eppingmusic.com en https://www.eppingmusic.com tonen placeholder, geldig cert.

## Risico's
- DNS-propagatie tot ~uren; cert pas na propagatie.
- Squarespace-site/abonnement opzeggen pas nadat nieuwe site live is.
