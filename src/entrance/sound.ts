// One track (Epping's ADE House Mix, from 18:30) through a low-pass: bass only outside, opening up while you climb, the full track on the roof.
// An analyser on the unfiltered song gives the kick that drives the neon.
const BPM = 126, SPB = 60 / BPM;
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

export class Sound {
  on = false;
  private ctx?: AudioContext; private el?: HTMLAudioElement; private lp?: BiquadFilterNode;
  private an?: AnalyserNode; private bins?: Uint8Array<ArrayBuffer>; private peak = 0.2;
  /** startAt: seconds into the track for the first play; afterwards it loops from the top */
  constructor(private src: string, private startAt = 0) {}

  async toggle(): Promise<boolean> {
    if (!this.ctx) this.init();
    this.on = !this.on;
    if (this.on) {
      const play = this.el!.play(); // inside the tap, before any await (iOS)
      void this.ctx!.resume();
      try { await play; } catch { this.on = false; }
    } else { this.el!.pause(); await this.ctx!.suspend(); }
    return this.on;
  }

  private init() {
    try { (navigator as Navigator & { audioSession?: { type: string } }).audioSession!.type = 'playback'; } catch { /* not Safari 17+ */ }
    const c = (this.ctx = new AudioContext());
    this.el = new Audio(this.src); this.el.loop = true; this.el.preload = 'auto'; this.el.setAttribute('playsinline', '');
    // Jump to startAt. Some browsers (iPhone Safari) ignore a seek before playback, so repeat it once it's actually playing.
    const seek = () => { if (Math.abs(this.el!.currentTime - this.startAt) > 3 && this.el!.currentTime < this.startAt) this.el!.currentTime = this.startAt; };
    this.el.currentTime = this.startAt;
    this.el.addEventListener('loadedmetadata', seek, { once: true });
    this.el.addEventListener('playing', seek, { once: true });
    const src = c.createMediaElementSource(this.el);
    this.an = c.createAnalyser(); this.an.fftSize = 1024; this.an.smoothingTimeConstant = 0.35; src.connect(this.an);
    this.bins = new Uint8Array(this.an.frequencyBinCount);
    this.lp = c.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 160; this.lp.Q.value = 0.9;
    const g = c.createGain(); g.gain.value = 0.9;
    src.connect(this.lp); this.lp.connect(g); g.connect(c.destination);
  }

  /** stage 0 outside, 1 stairs, 2 roof; local 0..1 within the stage */
  update(stage: number, local: number) {
    if (!this.ctx || !this.lp) return;
    const cut = stage === 0 ? 140 + 80 * local : stage === 1 ? 240 * Math.pow(18000 / 240, local ** 1.6) : 18000;
    this.lp.frequency.setTargetAtTime(cut, this.ctx.currentTime, 0.1);
  }

  /** 0..1 kick: from the music when playing, otherwise a 128 BPM clock */
  kick(t: number): number {
    if (!this.on || !this.an || !this.bins) return Math.exp(-((t / SPB) % 1) * 5);
    this.an.getByteFrequencyData(this.bins);
    const v = (this.bins[1] + this.bins[2] + this.bins[3]) / 765;
    this.peak = Math.max(v, this.peak * 0.995, 0.2);
    return clamp((v / this.peak - 0.55) / 0.45) ** 1.5;
  }
}
