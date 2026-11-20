// All sound is synthesised with WebAudio at runtime: no audio files.
// Night music = soft pad + pentatonic plucks; SFX = short tone/noise envelopes.

const PENTA = [220, 247, 277, 330, 370, 440, 494, 554, 659];

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.volume = 0.7;
    this.played = {};
    this.musicOn = false;
    this.nextNote = 0;
    this.step = 0;
  }

  /** Must be called from a user gesture (browsers block autoplay). */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    this.sfx = this.ctx.createGain();
    this.sfx.gain.value = 0.9;
    this.sfx.connect(this.master);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0.32;
    this.musicBus.connect(this.master);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const ch = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  tone(freq, dur, { type = 'sine', vol = 0.25, to = null, delay = 0, bus = this.sfx } = {}) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noise(dur, { freq = 1200, to = null, vol = 0.25, delay = 0, q = 0.9 } = {}) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfx);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  play(name) {
    this.played[name] = (this.played[name] || 0) + 1;
    if (!this.ctx) return;
    const arp = (notes, gap, opts) => notes.forEach((n, i) => this.tone(n, 0.35, { ...opts, delay: i * gap }));
    switch (name) {
      case 'pickup': this.tone(880, 0.12, { to: 1320, vol: 0.18 }); this.tone(1760, 0.08, { delay: 0.05, vol: 0.08 }); break;
      case 'deposit': this.tone(523, 0.15, { type: 'triangle', vol: 0.15 }); break;
      case 'lit': arp([523, 659, 784, 1047], 0.08, { type: 'triangle', vol: 0.2 }); break;
      case 'pulse': this.noise(0.5, { freq: 500, to: 3000, vol: 0.22 }); this.tone(220, 0.5, { to: 110, vol: 0.25 }); break;
      case 'hit': this.tone(160, 0.35, { type: 'sawtooth', to: 70, vol: 0.22 }); this.noise(0.2, { freq: 400, vol: 0.25 }); break;
      case 'jump': this.tone(400, 0.12, { type: 'square', to: 700, vol: 0.08 }); break;
      case 'dash': this.noise(0.22, { freq: 2500, to: 700, vol: 0.25 }); break;
      case 'win': arp([523, 659, 784, 1047, 1319], 0.12, { type: 'triangle', vol: 0.22 }); break;
      case 'lose': arp([440, 392, 349, 294], 0.22, { type: 'triangle', vol: 0.2 }); break;
      case 'shade': this.noise(0.8, { freq: 300, vol: 0.2 }); this.tone(80, 0.8, { type: 'sawtooth', to: 55, vol: 0.1 }); break;
      case 'countdown': this.tone(1000, 0.08, { type: 'square', vol: 0.1 }); break;
      case 'wind': this.noise(1.6, { freq: 900, to: 300, vol: 0.18, q: 0.5 }); break;
      case 'charm': this.tone(660, 0.2, { to: 990, vol: 0.18 }); this.tone(1320, 0.15, { delay: 0.1, vol: 0.1 }); break;
      case 'steal': this.tone(600, 0.3, { type: 'triangle', to: 300, vol: 0.18 }); break;
      case 'out': this.tone(330, 0.6, { type: 'triangle', to: 165, vol: 0.18 }); break;
      case 'refuel': this.tone(392, 0.15, { type: 'triangle', to: 523, vol: 0.15 }); break;
      case 'click': this.tone(700, 0.05, { type: 'square', vol: 0.06 }); break;
      default: break;
    }
  }

  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    const c = this.ctx;
    this.pad = [110, 165, 220].map((f, i) => {
      const o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      o.detune.value = (i - 1) * 6;
      const g = c.createGain();
      g.gain.value = 0.05;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 600;
      o.connect(lp).connect(g).connect(this.musicBus);
      o.start();
      return o;
    });
    this.nextNote = c.currentTime + 0.5;
  }

  stopMusic() {
    if (!this.musicOn) return;
    this.musicOn = false;
    for (const o of this.pad || []) o.stop();
    this.pad = null;
  }

  /** Schedules the next plucks; call every frame. */
  update() {
    if (!this.ctx || !this.musicOn) return;
    while (this.nextNote < this.ctx.currentTime + 0.4) {
      const n = PENTA[(this.step * 5 + (this.step >> 2)) % PENTA.length];
      const delay = this.nextNote - this.ctx.currentTime;
      this.tone(n * 2, 0.9, { type: 'sine', vol: 0.06, delay, bus: this.musicBus });
      if (this.step % 4 === 0) this.tone(n / 2, 1.6, { type: 'triangle', vol: 0.05, delay, bus: this.musicBus });
      this.step++;
      this.nextNote += this.step % 3 === 0 ? 1.2 : 0.6;
    }
  }
}
