// Rooftop entrance: shared engine (forked from mockups/entrance, which stays as the five-concept version).
// Scroll drives three stages: in line outside -> up the stairs (muffled, getting louder) -> the roof (open air, footage).
(function () {
  const PALETTES = {
    sunset: { name: 'Sunset rave', bg: '#12061A', fg: '#FFF4E8', a: '#FF4D00', b: '#FF2BD6' },
    gold: { name: 'Gold rush', bg: '#0A0A0A', fg: '#FFF8E1', a: '#FFC400', b: '#FF3D7F' },
    // the other palettes from the logo lab, for comparison
    current: { name: 'Current (pink/cyan)', bg: '#0A0A10', fg: '#EDEDF3', a: '#00E5FF', b: '#FF2BD6' },
    acid: { name: 'Acid', bg: '#0B0B0B', fg: '#F4F4F0', a: '#C6FF00', b: '#FF2BD6' },
    ultraviolet: { name: 'Ultraviolet', bg: '#0D0221', fg: '#F2EBFF', a: '#00F0B5', b: '#8C1EFF' },
    glasses: { name: '3D glasses', bg: '#050505', fg: '#FFFFFF', a: '#00E5FF', b: '#FF1A1A' },
    mono: { name: 'Mono', bg: '#0A0A10', fg: '#FFFFFF', a: '#5A5A6E', b: '#B4B4C8' },
    pastel: { name: 'Wedding pastel', bg: '#FFF6F0', fg: '#1A1020', a: '#7FD6FF', b: '#FF8FC8' },
    paper: { name: 'Paper', bg: '#F2F2EE', fg: '#0A0A10', a: '#2B3BFF', b: '#FF2BD6' },
    hotpink: { name: 'Hot pink', bg: '#FF2BD6', fg: '#0A0A10', a: '#00E5FF', b: '#FFFFFF' },
  };
  const STAGES = [
    { label: 'In line outside', from: 0, to: 0.3 },
    { label: 'Up the stairs', from: 0.3, to: 0.72 },
    { label: 'On the roof', from: 0.72, to: 1 },
  ];
  const BPM = 128, SPB = 60 / BPM, SONG = 'audio/song.mp3'; // Mau P – Just A Little Bit More (~128 BPM)

  // ---------- helpers ----------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => t * t * (3 - 2 * t);
  const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const rgba = (hex, al) => { const [r, g, b] = rgb(hex); return `rgba(${r},${g},${b},${al})`; };
  const mix = (h1, h2, t) => { const a = rgb(h1), b = rgb(h2); return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], t))).join(',')})`; };
  const rand = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  // ---------- logo ----------
  const WM = window.WORDMARK, VB = WM.viewBox.split(' ').map(Number), PATH = new Path2D(WM.d);
  // Centre of the G's counter, in wordmark units (G3 ring, last glyph).
  const G_COUNTER = { x: VB[0] + VB[2] - 6 - 44.2, y: -37.5, rx: 21.2, ry: 18.5 };
  function logoSVG(p) {
    return `<svg viewBox="${WM.viewBox}" role="img" aria-label="EPPING" style="isolation:isolate">` +
      `<path d="${WM.d}" fill="${p.a}" transform="translate(-2.2 0)" style="mix-blend-mode:screen"/>` +
      `<path d="${WM.d}" fill="${p.b}" transform="translate(2.2 0)" style="mix-blend-mode:screen"/>` +
      `<path d="${WM.d}" fill="${p.fg}"/></svg>`;
  }
  /** Draw the wordmark centred on cx,cy at width w. o: { split, alpha, glow, color } */
  function drawLogo(ctx, p, cx, cy, w, o = {}) {
    const s = w / (VB[2] - 12), split = o.split ?? 2.2;
    ctx.save();
    ctx.globalAlpha = o.alpha ?? 1;
    ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-(VB[0] + VB[2] / 2), -(VB[1] + VB[3] / 2));
    if (o.glow) { ctx.shadowColor = o.glowColor || p.b; ctx.shadowBlur = o.glow / s; }
    if (split && !o.color) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = p.a; ctx.translate(-split, 0); ctx.fill(PATH);
      ctx.fillStyle = p.b; ctx.translate(2 * split, 0); ctx.fill(PATH);
      ctx.translate(-split, 0); ctx.globalCompositeOperation = 'source-over';
    }
    ctx.fillStyle = o.color || p.fg; ctx.fill(PATH);
    ctx.restore();
  }

  // ---------- sound: one song through a low-pass ----------
  // Outside you only hear the bass through the walls; climbing the stairs opens the filter; on the roof it's the full track.
  // Analyser on the unfiltered song drives the visual kick, so the neon pulses with the real music.
  const sound = {
    ctx: null, el: null, on: false, peak: 0.2,
    async toggle() {
      if (!this.ctx) this.init();
      this.on = !this.on;
      if (this.on) { const play = this.el.play(); this.ctx.resume(); try { await play; } catch (e) { this.on = false; } } // play() first: iOS needs it inside the tap
      else { this.el.pause(); await this.ctx.suspend(); }
      return this.on;
    },
    init() {
      // iPhone: treat this as media playback so the silent switch doesn't mute it (Safari 17+)
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
      const c = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.el = new Audio(SONG); this.el.loop = true; this.el.preload = 'auto'; this.el.setAttribute('playsinline', '');
      const src = c.createMediaElementSource(this.el);
      this.an = c.createAnalyser(); this.an.fftSize = 1024; this.an.smoothingTimeConstant = 0.35; src.connect(this.an);
      this.bins = new Uint8Array(this.an.frequencyBinCount);
      this.lp = c.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 160; this.lp.Q.value = 0.9;
      this.gain = c.createGain(); this.gain.gain.value = 0.9;
      src.connect(this.lp); this.lp.connect(this.gain); this.gain.connect(c.destination);
    },
    update(st, local) {
      if (!this.ctx) return;
      const cut = st === 0 ? lerp(140, 220, local) : st === 1 ? 240 * Math.pow(18000 / 240, local ** 1.6) : 18000;
      this.lp.frequency.setTargetAtTime(cut, this.ctx.currentTime, 0.1);
    },
    // 0..1 kick level from the low bins (~40-170 Hz), normalised against a slowly falling peak
    kick() {
      this.an.getByteFrequencyData(this.bins);
      const v = (this.bins[1] + this.bins[2] + this.bins[3]) / 765;
      this.peak = Math.max(v, this.peak * 0.995, 0.2);
      return clamp((v / this.peak - 0.55) / 0.45) ** 1.5;
    },
  };

  // ---------- page ----------
  // Scrolling only covers [0, autoFrom]; once you step onto the roof the page locks and the rest plays by itself over autoDur seconds.
  function start({ draw, finale = 'fade', video = 'video/roof-dusk.mp4', autoFrom = 0.72, autoDur = 9 }) {
    let pal = PALETTES[location.hash.slice(1)] ? location.hash.slice(1) : 'sunset';
    document.body.insertAdjacentHTML('afterbegin', `
      <div class="ent">
        <canvas></canvas>
        <div class="finale"><video src="${video}" muted loop playsinline preload="none"></video>
          <div class="fin"><div class="fin-logo"></div><p>Rave weddings. Private parties. Our own nights.</p>
          <nav class="floors" aria-label="Floors">${(window.FLOORS || []).map((f) => `<a href="#" data-floor="${f.id}">${f.name}</a>`).join('')}</nav><button class="again" id="again">↺ Back to the street</button></div></div>
        <section class="floor-page" id="fp" hidden aria-live="polite"></section>
        <div class="grain"></div>
        <div class="hud top"><span class="tag">EPPING · rooftop entrance</span>
          <div class="group"><label class="pal"><span class="sr">Palette</span><select id="pals" aria-label="Palette"></select></label><button id="snd" aria-pressed="false">Sound off</button><button id="skip">Skip ↓</button></div></div>
        <div class="hud bottom"><div class="stage"><span><span class="n" id="sn">01</span> / 03</span><b id="sl"></b><div class="bar"><i id="bar"></i></div></div><span class="hint" id="hint">Scroll to get in</span></div>
      </div><div class="spacer"></div>`);
    const $ = (id) => document.getElementById(id);
    const cv = document.querySelector('.ent canvas'), ctx = cv.getContext('2d');
    const fin = document.querySelector('.finale'), vid = fin.querySelector('video');

    function setPal(k) {
      pal = k;
      const p = PALETTES[k], r = document.documentElement.style;
      for (const n of ['bg', 'fg', 'a', 'b']) r.setProperty('--' + n, p[n]);
      if (!$('pals').options.length) $('pals').innerHTML = Object.entries(PALETTES).map(([key, q]) => `<option value="${key}">${q.name}</option>`).join('');
      $('pals').value = k;
      document.querySelector('.fin-logo').innerHTML = logoSVG(p);
      history.replaceState(null, '', '#' + k);
    }
    $('pals').onchange = (e) => setPal(e.target.value);
    $('snd').onclick = async () => { const on = await sound.toggle(); $('snd').setAttribute('aria-pressed', on); $('snd').textContent = on ? 'Sound on' : 'Sound off'; };
    $('skip').onclick = () => { p = autoFrom; scrollTo(0, document.documentElement.scrollHeight); };
    // lock / unlock scrolling once you're on the roof
    let autoStart = null;
    const block = (e) => { if (autoStart !== null && !e.target.closest?.('.floor-page')) e.preventDefault(); };
    addEventListener('wheel', block, { passive: false }); addEventListener('touchmove', block, { passive: false });
    addEventListener('keydown', (e) => { if (autoStart !== null && ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' ', 'End', 'Home'].includes(e.key)) e.preventDefault(); });
    const lock = (on) => { document.documentElement.style.overflow = on ? 'hidden' : ''; document.body.style.overflow = on ? 'hidden' : ''; };
    // clickable doors: a draw function registers hit areas each frame with S.hit(x, y, w, h, toP)
    let hits = [], anim = null;
    const pad = 24, hitAt = (x, y) => hits.find((r) => x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad);
    function goTo(toP) {
      const max = document.documentElement.scrollHeight - innerHeight, from = scrollY, to = clamp(toP / autoFrom) * max;
      anim = { from, to, t0: performance.now(), dur: 1000 + Math.abs(toP - p) * 6000 };
    }
    cv.addEventListener('click', (e) => { const r = autoStart === null && hitAt(e.clientX, e.clientY); if (r) goTo(r.toP); });
    cv.addEventListener('mousemove', (e) => { cv.style.cursor = autoStart === null && hitAt(e.clientX, e.clientY) ? 'pointer' : ''; });
    for (const ev of ['wheel', 'touchstart', 'keydown']) addEventListener(ev, () => { anim = null; }, { passive: true });
    $('again').onclick = () => { autoStart = null; lock(false); p = 0; scrollTo(0, 0); };
    // ---------- floor pages: black, readable, video paused ----------
    const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    function floorHTML(f) {
      const C = window.CONTACT, mail = `mailto:${C.email}?subject=${encodeURIComponent(f.mail.subject)}&body=${encodeURIComponent(f.mail.body)}`;
      const wa = `https://wa.me/${C.whatsapp}?text=${encodeURIComponent(f.whatsapp)}`;
      const bars = Array.from({ length: 48 }, (_, i) => `<i style="height:${Math.round(20 + 80 * Math.abs(Math.sin(i * 0.7) * Math.sin(i * 0.23 + 1)))}%"></i>`).join('');
      const others = window.FLOORS.filter((o) => o.id !== f.id).map((o) => `<a href="#" data-floor="${o.id}">${o.name} →</a>`).join('');
      return `<div class="fp-in">
        <button class="fp-back" data-back>← Back to the roof</button>
        <p class="fp-k">Floor ${f.n} · ${esc(f.tagline)}</p>
        <h1 class="fp-h">${esc(f.name)}</h1>
        <p class="fp-head">${esc(f.headline)}</p>
        <p class="fp-intro">${esc(f.intro)}</p>
        ${f.event ? `<div class="fp-event"><span>Next night</span><b>${esc(f.event.date)}</b><span>${esc(f.event.place)} · ${esc(f.event.note)}</span></div>` : ''}
        <div class="fp-cols">
          <div class="fp-body">${f.body.map((b) => `<p>${esc(b)}</p>`).join('')}</div>
          <ul class="fp-list">${f.includes.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
        </div>
        <div class="sc">
          <span class="sc-play" aria-hidden="true">▶</span>
          <div class="sc-meta"><span>SoundCloud · ${esc(f.mix.length)}</span><b>${esc(f.mix.title)}</b><div class="sc-wave">${bars}</div></div>
          <a class="sc-link" href="${f.mix.url}" target="_blank" rel="noopener">Listen ↗</a>
        </div>
        <p class="fp-note">On the live site this is the real SoundCloud player. This preview can't embed other sites.</p>
        <div class="fp-contact">
          <h2>${esc(f.cta)}</h2>
          <div class="fp-btns">
            <a class="btn-wa" href="${wa}" target="_blank" rel="noopener">WhatsApp</a>
            <a class="btn-mail" href="${mail}">Email</a>
          </div>
          <p class="fp-addr"><span>${esc(C.email)}</span><button data-copy="${esc(C.email)}">Copy</button> · <span>${esc(C.whatsappLabel)}</span></p>
          <p class="fp-social"><a href="${C.instagram}" target="_blank" rel="noopener">Instagram ${esc(C.instagramLabel)} ↗</a><a href="${C.soundcloud}" target="_blank" rel="noopener">All mixes on SoundCloud ↗</a></p>
        </div>
        <nav class="fp-others" aria-label="Other floors">${others}</nav>
      </div>`;
    }
    const fp = $('fp');
    function openFloor(id) {
      const f = (window.FLOORS || []).find((x) => x.id === id);
      if (!f) return;
      fp.innerHTML = floorHTML(f); fp.hidden = false; fp.scrollTop = 0;
      document.querySelector('.ent').classList.add('reading');
      vid.pause();
    }
    function closeFloor() { fp.hidden = true; document.querySelector('.ent').classList.remove('reading'); vid.play().catch(() => {}); }
    document.querySelector('.ent').addEventListener('click', (e) => {
      const fl = e.target.closest('[data-floor]'), back = e.target.closest('[data-back]'), cp = e.target.closest('[data-copy]');
      if (fl) { e.preventDefault(); openFloor(fl.dataset.floor); }
      if (back) closeFloor();
      if (cp) navigator.clipboard.writeText(cp.dataset.copy).then(() => (cp.textContent = 'Copied'), () => {});
    });
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && !fp.hidden) closeFloor(); });
    setPal(pal);

    let p = 0;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    function frame(ms) {
      const dpr = Math.min(devicePixelRatio || 1, 2), w = cv.clientWidth, h = cv.clientHeight;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      const max = document.documentElement.scrollHeight - innerHeight;
      if (anim) { // door-click auto walk
        const k = clamp((ms - anim.t0) / anim.dur), e2 = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
        scrollTo(0, anim.from + (anim.to - anim.from) * e2);
        if (k >= 1) anim = null;
      }
      if (autoStart === null) {
        const target = (max > 0 ? clamp(scrollY / max) : 0) * autoFrom;
        p = reduce ? target : p + (target - p) * 0.12;
        if (p >= autoFrom - 0.003) { autoStart = ms; lock(true); }
      }
      if (autoStart !== null) p = autoFrom + (1 - autoFrom) * clamp((ms - autoStart) / 1000 / autoDur);
      const st = p < STAGES[1].from ? 0 : p < STAGES[2].from ? 1 : 2, S0 = STAGES[st], local = clamp((p - S0.from) / (S0.to - S0.from));
      const t = ms / 1000, beat = sound.on ? sound.el.currentTime / SPB : t / SPB, kick = reduce ? 0 : sound.on ? sound.kick() : Math.exp(-(beat % 1) * 5);
      hits = [];
      const S = { w, h, t, p, stage: st, local, beat, kick, pal: PALETTES[pal], palKey: pal, energy: [0.25, 0.55, 1][st], dpr, util, hit: (x, y, ww, hh, toP) => hits.push({ x, y, w: ww, h: hh, toP }) };
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0;
      draw(ctx, S);
      sound.update(st, local);
      $('sn').textContent = '0' + (st + 1); $('sl').textContent = S0.label; $('bar').style.width = (p * 100).toFixed(1) + '%';
      $('skip').hidden = autoStart !== null;
      $('hint').style.opacity = p < 0.02 ? 0.8 : 0;
      const f = clamp((p - 0.86) / 0.08);
      fin.style.opacity = finale === 'circle' ? 1 : f;
      if (finale === 'circle') fin.style.clipPath = `circle(${(f * 75).toFixed(1)}% at 50% 50%)`;
      fin.classList.toggle('on', f > 0.6);
      if (f > 0 && vid.paused) { vid.preload = 'auto'; vid.play().catch(() => {}); }
      if (f === 0 && !vid.paused) vid.pause();
      if (!fp.hidden && !vid.paused) vid.pause();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  const util = { clamp, lerp, ease, rgba, mix, rand, drawLogo, G_COUNTER, VB, PATH };
  window.Entrance = { start, util, PALETTES };
})();
