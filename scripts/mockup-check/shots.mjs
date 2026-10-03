// Screenshot key moments of the rooftop mockup: outside, stairs (start/mid/top), roof, finale.
// Usage: serve mockups/rooftop (python3 -m http.server 8124), then: node scripts/mockup-check/shots.mjs http://localhost:8124/index.html <out-dir> [sunset|gold]
// Needs playwright (npx playwright install chromium). Visual self-check only, not a test suite.
import { chromium } from 'playwright';
const base = process.argv[2], out = process.argv[3], pal = process.argv[4] || 'sunset';
const sizes = { desktop: { width: 1280, height: 800 }, phone: { width: 390, height: 844 } };
const browser = await chromium.launch();
for (const [name, viewport] of Object.entries(sizes)) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await page.goto(`${base}#${pal}`); await page.waitForTimeout(1500);
  // scroll covers p 0..0.72 (autoFrom); fractions of the scroll range
  for (const [label, f] of [['1-outside', 0], ['2-door', 0.32], ['3-stairs-in', 0.5], ['4-stairs-mid', 0.72], ['5-stairs-top', 0.93]]) {
    await page.evaluate((f) => scrollTo(0, f * (document.documentElement.scrollHeight - innerHeight)), f);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${out}/${pal}-${name}-${label}.png` });
  }
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); // triggers the roof autoplay
  await page.waitForTimeout(2500); await page.screenshot({ path: `${out}/${pal}-${name}-6-roof.png` });
  await page.waitForTimeout(6000); await page.screenshot({ path: `${out}/${pal}-${name}-7-finale.png` });
  if (errs.length) console.log(name, 'errors:', errs);
  await page.close();
}
await browser.close();
