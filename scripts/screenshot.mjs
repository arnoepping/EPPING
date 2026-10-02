// Builds nothing: run `npm run build` first. Serves dist via astro preview, shoots + asserts.
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const PORT = 4329, BASE = `http://localhost:${PORT}`, OUT = '.superpowers/shots';
const SLUGS = ['rave-wedding', 'private-events', 'presents'];
const ONLY = process.argv[2]; // optional: "phone" | "desktop" | "fallback" | "smoke"
mkdirSync(OUT, { recursive: true });

// detached: own process group, so the whole npx → astro tree can be killed in `finally`.
const server = spawn('npx', ['astro', 'preview', '--port', String(PORT)], { stdio: 'ignore', detached: true });
const errors = [];
const fail = (m) => { errors.push(m); };
// Placeholder SoundCloud tracks 404 inside their iframes: not our errors.
const isSoundCloud = (s) => /soundcloud\.com|sndcdn\.com/.test(s ?? '');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function up() {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(BASE)).ok) return; } catch {} await wait(500); }
  throw new Error('preview did not start');
}
async function newPage(browser, name, opts) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() !== 'error' || isSoundCloud(m.location()?.url) || isSoundCloud(m.text())) return;
    fail(`${name}: console: ${m.text()}`);
  });
  page.on('pageerror', (e) => { if (!isSoundCloud(e.stack) && !isSoundCloud(e.message)) fail(`${name}: pageerror: ${e.message}`); });
  return { ctx, page };
}
async function shot(page, name, label) {
  await page.screenshot({ path: `${OUT}/${name}-${label}.png` });
  if (await page.evaluate(() => document.documentElement.classList.contains('xp-3d'))) {
    if (!(await page.evaluate(() => window.__xp.sample()))) fail(`${name}-${label}: canvas looks blank`);
  }
}
async function ready(page) { await page.waitForSelector('html.xp-ready', { timeout: 15000 }); await wait(600); }

const VIEWS = { phone: devices['iPhone 14'], desktop: { viewport: { width: 1440, height: 900 } } };

let browser;
try {
  await up();
  browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

  for (const [name, opts] of Object.entries(VIEWS)) {
    if (ONLY && ONLY !== name) continue;
    const { ctx, page } = await newPage(browser, name, opts);
    await page.goto(`${BASE}/`); await ready(page);
    await shot(page, name, '1-arrival');
    await page.evaluate(() => window.__xp.setProgress(0.5)); await wait(1200);
    await shot(page, name, '2-tunnel');
    await page.evaluate(() => window.__xp.setProgress(1)); await wait(2500);
    await shot(page, name, '3-hall');
    for (const s of SLUGS) {
      await page.goto(`${BASE}/${s}/`); await ready(page); await wait(1200);
      await shot(page, name, `4-floor-${s}`);
    }
    await ctx.close();
  }

  if (!ONLY || ONLY === 'fallback') {
    const { ctx, page } = await newPage(browser, 'fallback', { ...devices['iPhone 14'], reducedMotion: 'reduce' });
    await page.goto(`${BASE}/`); await wait(1500);
    if (await page.evaluate(() => document.documentElement.classList.contains('xp-3d'))) fail('fallback: xp-3d set under reduced motion');
    for (const h of ['Your wedding. Our rave.', 'Your party. Club-grade.', 'Not a party. A ritual.']) {
      if (!(await page.getByText(h).isVisible())) fail(`fallback: headline not visible: ${h}`);
    }
    await page.screenshot({ path: `${OUT}/fallback-full.png`, fullPage: true });
    await ctx.close();
  }

  if (!ONLY || ONLY === 'smoke') {
    const { ctx, page } = await newPage(browser, 'smoke', devices['iPhone 14']);
    // Review focus 1: deep link → back arrow → browser Back
    await page.goto(`${BASE}/rave-wedding/`); await ready(page);
    await page.locator('#panel-rave-wedding .panel-back').click(); await wait(600);
    if (new URL(page.url()).pathname !== '/') fail(`smoke: back arrow should go to /, got ${page.url()}`);
    if (await page.locator('#panel-rave-wedding').getAttribute('data-open') !== null) fail('smoke: panel still open after back');
    await page.goBack(); await wait(800);
    if ((await page.evaluate(() => window.__xp.state().mode)) !== 'floor') fail('smoke: browser Back did not reopen floor');
    if (await page.locator('#panel-rave-wedding').getAttribute('data-open') === null) fail('smoke: panel not open after browser Back');
    // Review focus 2: scrolling inside the open panel must not change the scene
    const before = await page.evaluate(() => JSON.stringify(window.__xp.state()));
    const box = await page.locator('#panel-rave-wedding').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + 40);
    await page.mouse.wheel(0, 600); await wait(400);
    await page.touchscreen.tap(box.x + box.width / 2, box.y + 60); await wait(300);
    if ((await page.evaluate(() => JSON.stringify(window.__xp.state()))) !== before) fail('smoke: interacting with panel changed scene state');
    // Review focus 4: resize follows viewport
    await page.setViewportSize({ width: 844, height: 390 }); await wait(500);
    const w = await page.evaluate(() => document.querySelector('.xp-canvas').clientWidth);
    if (w !== 844) fail(`smoke: canvas width ${w} after rotate, expected 844`);
    await ctx.close();
  }

} finally {
  try { await browser?.close(); } catch {}
  try { process.kill(-server.pid); } catch {}
}
if (errors.length) { console.error(errors.map((e) => `FAIL: ${e}`).join('\n')); process.exit(1); }
console.log(`OK: shots in ${OUT}`);
