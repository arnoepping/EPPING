// Rooftop entrance: shared engine (forked from mockups/entrance, which stays as the five-concept version).
// Scroll drives three stages: in line outside -> up the stairs (muffled, getting louder) -> the roof (open air, footage).
(function () {
  const PALETTES = {
    sunset: { name: 'Sunset rave', bg: '#12061A', fg: '#FFF4E8', a: '#FF4D00', b: '#FF2BD6' },
    gold: { name: 'Gold rush', bg: '#0A0A0A', fg: '#FFF8E1', a: '#FFC400', b: '#FF3D7F' },
  };
  const STAGES = [
    { label: 'In line outside', from: 0, to: 0.3 },
    { label: 'Up the stairs', from: 0.3, to: 0.72 },
    { label: 'On the roof', from: 0.72, to: 1 },
  ];
  const BPM = 124, SPB = 60 / BPM;

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

  // ---------- sound: queue murmur -> muffled club -> full bounce ----------
  const sound = {
    ctx: null, on: false,
    async toggle() {
      if (!this.ctx) this.init();
      this.on = !this.on;
      if (this.on) await this.ctx.resume(); else await this.ctx.suspend();
      return this.on;
    },
    noise(sec) {
      const c = this.ctx, b = c.createBuffer(1, c.sampleRate * sec, c.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return b;
    },
    init() {
      const c = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.out = c.createGain(); this.out.gain.value = 0.9; this.out.connect(c.destination);
      // Music goes through a low-pass: the walls between you and the floor.
      this.lp = c.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 140; this.lp.Q.value = 0.8;
      this.music = c.createGain(); this.music.gain.value = 0.5; this.music.connect(this.lp); this.lp.connect(this.out);
      // Crowd murmur: noise through wandering band-passes with syllable-rate wobble.
      this.crowd = c.createGain(); this.crowd.gain.value = 0.5; this.crowd.connect(this.out);
      this.nb = this.noise(4);
      for (let i = 0; i < 7; i++) {
        const src = c.createBufferSource(); src.buffer = this.nb; src.loop = true;
        const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 280 + Math.random() * 900; bp.Q.value = 5;
        const g = c.createGain(); g.gain.value = 0.35;
        const lfo = c.createOscillator(); lfo.frequency.value = 2.5 + Math.random() * 4; const lg = c.createGain(); lg.gain.value = 0.35; lfo.connect(lg); lg.connect(g.gain);
        const wob = c.createOscillator(); wob.frequency.value = 0.2 + Math.random() * 0.5; const wg = c.createGain(); wg.gain.value = 160; wob.connect(wg); wg.connect(bp.frequency);
        src.connect(bp); bp.connect(g); g.connect(this.crowd);
        src.start(0, Math.random() * 3); lfo.start(); wob.start();
      }
      const bed = c.createBufferSource(); bed.buffer = this.nb; bed.loop = true;
      const bl = c.createBiquadFilter(); bl.type = 'lowpass'; bl.frequency.value = 450;
      const bg = c.createGain(); bg.gain.value = 0.12; bed.connect(bl); bl.connect(bg); bg.connect(this.crowd); bed.start();
      this.t0 = this.next = c.currentTime + 0.1; this.step = 0;
      setInterval(() => this.schedule(), 25);
    },
    schedule() {
      if (!this.on) return;
      const c = this.ctx;
      while (this.next < c.currentTime + 0.12) { this.play(this.step, this.next); this.next += SPB / 4; this.step = (this.step + 1) % 64; }
    },
    env(node, t, peak, dur) { node.gain.setValueAtTime(peak, t); node.gain.exponentialRampToValueAtTime(0.001, t + dur); },
    play(s, t) {
      const c = this.ctx;
      if (s % 4 === 0) { // kick
        const o = c.createOscillator(), g = c.createGain();
        o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(44, t + 0.12);
        this.env(g, t, 1, 0.4); o.connect(g); g.connect(this.music); o.start(t); o.stop(t + 0.45);
      }
      if (s % 4 === 2 || (s % 16 === 15)) { // hats
        const n = c.createBufferSource(), hp = c.createBiquadFilter(), g = c.createGain();
        n.buffer = this.nb; hp.type = 'highpass'; hp.frequency.value = 7500;
        this.env(g, t, s % 4 === 2 ? 0.22 : 0.1, s % 4 === 2 ? 0.09 : 0.04); n.connect(hp); hp.connect(g); g.connect(this.music); n.start(t, Math.random() * 3); n.stop(t + 0.12);
      }
      if (s % 8 === 4) { // clap
        const n = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
        n.buffer = this.nb; bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.9;
        this.env(g, t, 0.45, 0.18); n.connect(bp); bp.connect(g); g.connect(this.music); n.start(t, Math.random() * 3); n.stop(t + 0.2);
      }
      const bassline = [0, 0, 1, 0, 0, 1, 0, 1]; // rolling offbeat bass, A minor
      if (s % 2 === 1 || s % 4 === 2) {
        const notes = [55, 55, 65.4, 49], f = notes[Math.floor(s / 16) % 4] * (bassline[(s >> 1) % 8] ? 2 : 1);
        const o = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain();
        o.type = 'sawtooth'; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(180, t + 0.14);
        this.env(g, t, 0.28, 0.16); o.connect(lp); lp.connect(g); g.connect(this.music); o.start(t); o.stop(t + 0.2);
      }
      if (s % 32 === 0) { // chord stab every two bars
        for (const f of [220, 261.6, 329.6]) {
          const o = c.createOscillator(), g = c.createGain(); o.type = 'square'; o.frequency.value = f;
          this.env(g, t, 0.06, 0.5); o.connect(g); g.connect(this.music); o.start(t); o.stop(t + 0.55);
        }
      }
    },
    update(st, local) {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const cut = st === 0 ? lerp(110, 200, local) : st === 1 ? lerp(240, 2400, local ** 2.2) : lerp(4000, 18000, clamp(local * 3));
      const crowd = st === 0 ? 0.55 : st === 1 ? lerp(0.12, 0.02, local) : 0.1;
      const music = st === 0 ? 0.5 : st === 1 ? lerp(0.55, 0.75, local) : 0.8;
      this.lp.frequency.setTargetAtTime(cut, now, 0.12);
      this.crowd.gain.setTargetAtTime(crowd, now, 0.2);
      this.music.gain.setTargetAtTime(music, now, 0.2);
    },
    beats() { return this.on ? (this.ctx.currentTime - this.t0) / SPB : null; },
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
          <nav class="floors" aria-label="Floors"><a href="#">Rave Wedding</a><a href="#">Private Events</a><a href="#">Epping Presents</a></nav><button class="again" id="again">↺ Back to the street</button></div></div>
        <div class="grain"></div>
        <div class="hud top"><span class="tag">EPPING · rooftop entrance</span>
          <div class="group"><span class="group" id="pals"></span><button id="snd" aria-pressed="false">Sound off</button><button id="skip">Skip ↓</button></div></div>
        <div class="hud bottom"><div class="stage"><span><span class="n" id="sn">01</span> / 03</span><b id="sl"></b><div class="bar"><i id="bar"></i></div></div><span class="hint" id="hint">Scroll to get in</span></div>
      </div><div class="spacer"></div>`);
    const $ = (id) => document.getElementById(id);
    const cv = document.querySelector('.ent canvas'), ctx = cv.getContext('2d');
    const fin = document.querySelector('.finale'), vid = fin.querySelector('video');

    function setPal(k) {
      pal = k;
      const p = PALETTES[k], r = document.documentElement.style;
      for (const n of ['bg', 'fg', 'a', 'b']) r.setProperty('--' + n, p[n]);
      $('pals').innerHTML = Object.entries(PALETTES).map(([key, q]) => `<button data-k="${key}" aria-pressed="${key === k}">${q.name}</button>`).join('');
      document.querySelector('.fin-logo').innerHTML = logoSVG(p);
      history.replaceState(null, '', '#' + k);
    }
    $('pals').onclick = (e) => { const b = e.target.closest('button'); if (b) setPal(b.dataset.k); };
    $('snd').onclick = async () => { const on = await sound.toggle(); $('snd').setAttribute('aria-pressed', on); $('snd').textContent = on ? 'Sound on' : 'Sound off'; };
    $('skip').onclick = () => { p = autoFrom; scrollTo(0, document.documentElement.scrollHeight); };
    // lock / unlock scrolling once you're on the roof
    let autoStart = null;
    const block = (e) => { if (autoStart !== null) e.preventDefault(); };
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
    for (const a of document.querySelectorAll('.floors a')) a.onclick = (e) => e.preventDefault();
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
      const t = ms / 1000, beat = sound.beats() ?? t / SPB, kick = reduce ? 0 : Math.exp(-(beat % 1) * 5);
      hits = [];
      const S = { w, h, t, p, stage: st, local, beat, kick, pal: PALETTES[pal], energy: [0.25, 0.55, 1][st], dpr, util, hit: (x, y, ww, hh, toP) => hits.push({ x, y, w: ww, h: hh, toP }) };
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
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  const util = { clamp, lerp, ease, rgba, mix, rand, drawLogo, G_COUNTER, VB, PATH };
  window.Entrance = { start, util, PALETTES };
})();
