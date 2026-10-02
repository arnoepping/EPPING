# Brand identity: logo, tokens, brand page

Date: 2026-10-02
Status: approved 2026-10-02

## Goal

Set the visual baseline for eppingmusic.com: a logo, design tokens and an internal brand page. The website uses these tokens later.

Direction: "happy rave". Ravey, but not dark Berlin, because it has to fit weddings. Reference: https://bespoke-souffle-fa42bd.netlify.app/ (user-approved logo and palette).

## Decisions

### Logo
- Wordmark `EPPING`, all caps, **Unbounded 800**, letter-spacing −0.02em.
- Fill text `#EDEDF3`. A cyan copy is offset −x and a pink copy +x, blended with `screen` (RGB split).
- On the site it's a CSS wordmark with a glitch animation, ported from the reference (`.glitch` + `gA`/`gB` keyframes). The animation is off under `prefers-reduced-motion`.

### Logo files (`public/brand/`)
Text is outlined to paths, so there's no font dependency. Transparent background.
| File | Content |
|---|---|
| `epping-logo.svg` | Static RGB split: cyan −x, pink +x, text on top |
| `epping-white.svg` | Single color `#EDEDF3` |
| `epping-pink.svg` | Single color `#FF2BD6` |

`public/favicon.svg` is replaced by an RGB-split "E" on a `#0A0A10` rounded square. `public/favicon.ico` is regenerated from it, or deleted if no tool is available; the `<link>` already points at the SVG.

Generation: `scripts/build-logo.mjs` (run manually, outputs committed) uses `opentype.js` (devDependency) and the Unbounded TTF committed at `assets/fonts/Unbounded.ttf` with its OFL license (`assets/fonts/OFL.txt`). The offset is 3% of the cap height.

### Tokens (`src/styles/tokens.css`)
```css
:root{
  color-scheme: dark;
  --bg:#0A0A10; --surface:#13131C; --line:#262634;
  --text:#EDEDF3; --muted:#9494A8;
  --pink:#FF2BD6;   /* primary accent */
  --cyan:#00E5FF;   /* secondary accent */
  --display:"Unbounded","Arial Black",system-ui,sans-serif;
  --body:"Archivo","Helvetica Neue",Arial,sans-serif;
  --mono:"JetBrains Mono",ui-monospace,Menlo,monospace;
}
```
- Fonts load from Google Fonts: Unbounded 500/800, Archivo 400/500/600, JetBrains Mono 400/500.
- Usage: pink for primary emphasis (CTAs, highlights, quotes), cyan for secondary (links, focus, hover). Gradient: `linear-gradient(90deg, var(--cyan), var(--pink))`.
- Motifs: scanline overlay, RGB-split hover (`box-shadow:-3px 0 0 cyan, 3px 0 0 pink`), sharp corners (radius 0).

### Brand page (`src/pages/brand.astro` → `/brand/`)
- `<meta name="robots" content="noindex">`, not linked from the nav.
- Uses only `tokens.css` plus page-local layout CSS.
- Sections:
  1. Logo: live glitch wordmark, the three SVGs on dark (white/pink on dark, logo on dark), download links.
  2. Logo do/don't: keep clear space, no recoloring outside the palette, no stretching, no light backgrounds for the RGB version.
  3. Palette: swatches with name, hex and role.
  4. Typography: display/body/mono samples and type scale (h1 hero clamp, h2, body 17px, label 12px mono uppercase).
  5. UI samples: primary button, secondary button, label, card, input.
- Must work at 360px width without horizontal scroll.

## Testing
`scripts/check-build.mjs` also asserts:
- `dist/brand/index.html` exists, contains `EPPING` and `noindex`
- `dist/brand/epping-logo.svg`, `epping-white.svg` and `epping-pink.svg` exist and contain `<path`
- `dist/favicon.svg` contains `#FF2BD6` and `#00E5FF`

## Out of scope
- Restyling the homepage (next spec)
- PNG/social exports
- A separate icon or monogram beyond the favicon "E"
