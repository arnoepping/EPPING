# Analytics — design

Date: 2026-10-03 · Branch: `analytics` · Status: draft, awaiting review

## Goal
Light analytics covering four questions:
1. **Bookings:** which floors get attention, and which contact links get clicked.
2. **Entrance:** how far visitors get on the street → stairs → roof walk; skip, replay and sound usage.
3. **Marketing:** where traffic comes from (Instagram, QR, ADE) and how many visitors.
4. All of it with minimal code and upkeep.

Constraints: static Astro site on GitHub Pages, no backend, no cookies, no consent banner, and almost no maintenance.

## Choice
**Umami Cloud (free tier).** Cookie-free, with custom events and a UTM/referrer dashboard included. If the free tier gets limiting, switch to Plausible (paid); the events carry over because the call sites only use `track()`.

Rejected:
- Cloudflare Web Analytics: no custom events.
- A self-built Worker + D1: too much work for an MVP.

## Setup
- The user creates an Umami Cloud account and a website for `eppingmusic.com`, then passes on the **website ID**.
- `Base.astro` adds the script only when `import.meta.env.PROD`:
  `<script defer src="https://cloud.umami.is/script.js" data-website-id="…" data-domains="eppingmusic.com" data-do-not-track="true"></script>`
  - `data-domains` keeps local previews and artifact previews out of the stats.
- The website ID is a constant in `src/lib/track.ts`. It's public anyway, so there's no env var.

## Code
- `src/lib/track.ts`: `track(name: string, data?: Record<string, string>)` calls `window.umami?.track(name, data)` inside try/catch. It's a no-op when Umami is blocked or not loaded.
- Plain links get Umami's `data-umami-event` / `data-umami-event-<key>` attributes, so they need no JS.

## Events
| Event | Data | Hook |
|---|---|---|
| `entrance-stage` | `stage`: street \| stairs \| roof | `app.ts` stage logic; each stage fires once per page load |
| `entrance-door` | `door`: street \| top | door click in `app.ts` |
| `skip` | — | `[data-skip]` click |
| `replay` | — | `[data-again]` click |
| `sound-on` | — | sound toggle, only when it switches on |
| `floor-open` | `floor`: slug | `openFloor()` in `app.ts` (overlay). Direct `/slug/` visits count as normal page views. |
| `contact` | `type`: whatsapp \| email \| copy-email \| instagram \| soundcloud; `floor`: slug | `FloorPage.astro` links (attributes); copy-email via `track()` in the copy handler |

The `street` stage counts as "the entrance loaded". Drop-off = street → stairs → roof counts.

Out of scope (YAGNI):
- SoundCloud plays: these happen inside the iframe and would need the widget API.
- Scroll-depth percentages.
- Event-block views.

## Marketing links (UTM)
The convention is `?utm_source=<where>&utm_medium=<format>&utm_campaign=<optional>`.

| Link | URL |
|---|---|
| Instagram bio | `https://eppingmusic.com/?utm_source=instagram&utm_medium=bio` |
| Instagram story | `…/?utm_source=instagram&utm_medium=story&utm_campaign=<topic>` |
| QR (flyers, ADE) | `…/?utm_source=qr&utm_medium=flyer&utm_campaign=ade-2026` |
| WhatsApp share | `…/?utm_source=whatsapp&utm_medium=share` |

## Privacy
- No cookies and no personal data; Do Not Track is honoured.
- No banner is needed for a cookie-free, anonymous setup.
- Optionally add one line in the footer later: "Anonymous, cookie-free stats (Umami)."

## Verify
- `npm run build`.
- After the push to `main`, open the site and check that the visit and events appear in Umami's realtime view.
- No tests.
