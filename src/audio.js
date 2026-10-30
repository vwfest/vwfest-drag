// Synthesised audio (Web Audio API): flat-four engine, tyre squeal, gravel, wind, thud, beeps. No samples.
export class Sfx {
  constructor() { this.ctx = null; this.muted = localStorage.getItem('vwfest_mute') === '1'; this.ok = false; }
  init() {
    if (this.ctx) { this.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC(); this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 0.8;
    const comp = c.createDynamicsCompressor(); this.master.connect(comp); comp.connect(c.destination);
    // noise source
    const nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb; const noise = () => { const s = c.createBufferSource(); s.buffer = nb; s.loop = true; s.start(); return s; };
    // engine: saw + square(2x) + sub through lowpass + soft clip, amplitude-modulated at firing rate
    const o1 = c.createOscillator(), o2 = c.createOscillator(), o3 = c.createOscillator(); o1.type = 'sawtooth'; o2.type = 'square'; o3.type = 'triangle';
    const g1 = c.createGain(), g2 = c.createGain(), g3 = c.createGain(); g1.gain.value = 0.5; g2.gain.value = 0.16; g3.gain.value = 0.5;
    const sh = c.createWaveShaper(), curve = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 127.5 - 1; curve[i] = Math.tanh(x * 2.2); } sh.curve = curve;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; lp.Q.value = 1.2;
    const am = c.createGain(); am.gain.value = 0.8; const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 30; lg.gain.value = 0.28; lfo.connect(lg); lg.connect(am.gain);
    this.eg = c.createGain(); this.eg.gain.value = 0;
    o1.connect(g1); o2.connect(g2); o3.connect(g3); g1.connect(sh); g2.connect(sh); g3.connect(sh); sh.connect(lp); lp.connect(am); am.connect(this.eg); this.eg.connect(this.master);
    [o1, o2, o3, lfo].forEach(o => o.start()); this.o1 = o1; this.o2 = o2; this.o3 = o3; this.lp = lp; this.lfo = lfo;
    // tyre squeal
    const sq = noise(), bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1700; bp.Q.value = 9; this.sg = c.createGain(); this.sg.gain.value = 0; this.sbp = bp;
    const sw = c.createOscillator(); sw.type = 'sawtooth'; sw.frequency.value = 870; const swg = c.createGain(); swg.gain.value = 0.05; sw.connect(swg); swg.connect(bp.frequency); sw.start();
    sq.connect(bp); bp.connect(this.sg); this.sg.connect(this.master);
    // gravel / grass rumble
    const gr = noise(), glp = c.createBiquadFilter(); glp.type = 'lowpass'; glp.frequency.value = 420; this.gg = c.createGain(); this.gg.gain.value = 0; gr.connect(glp); glp.connect(this.gg); this.gg.connect(this.master);
    // wind
    const wn = noise(), whp = c.createBiquadFilter(); whp.type = 'bandpass'; whp.frequency.value = 700; whp.Q.value = 0.5; this.wg = c.createGain(); this.wg.gain.value = 0; wn.connect(whp); whp.connect(this.wg); this.wg.connect(this.master);
    this.ok = true; this.resume();
  }
  resume() { if (this.ctx && this.ctx.state !== 'running') this.ctx.resume().catch(() => {}); }
  setMuted(m) { this.muted = m; localStorage.setItem('vwfest_mute', m ? '1' : '0'); if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.03); }
  update({ rpm, throttle, speed, slip, off, running }) {
    if (!this.ok) return; const t = this.ctx.currentTime, f = Math.max(14, rpm / 60 * 2), k = 0.06;
    this.o1.frequency.setTargetAtTime(f, t, k); this.o2.frequency.setTargetAtTime(f * 2, t, k); this.o3.frequency.setTargetAtTime(f * 0.5, t, k); this.lfo.frequency.setTargetAtTime(f, t, k);
    this.lp.frequency.setTargetAtTime(260 + rpm * 0.18 + throttle * 700, t, k);
    this.eg.gain.setTargetAtTime(running === false ? 0 : 0.2 + throttle * 0.2 + Math.min(0.12, rpm / 40000), t, 0.05);
    this.sg.gain.setTargetAtTime(Math.min(0.2, slip * 0.22) * (speed > 5 ? 1 : 0), t, 0.04);
    this.gg.gain.setTargetAtTime(off ? Math.min(0.5, speed / 40) : 0, t, 0.08);
    this.wg.gain.setTargetAtTime(Math.min(0.12, (speed / 45) ** 2 * 0.12), t, 0.1);
  }
  beep(freq, dur = 0.16, vol = 0.25) {
    if (!this.ok) return; const c = this.ctx, o = c.createOscillator(), g = c.createGain(), t = c.currentTime; o.type = 'square'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }
  thud(strength = 0.5) {
    if (!this.ok) return; const c = this.ctx, t = c.currentTime, v = Math.min(1, 0.25 + strength);
    const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.25);
    g.gain.setValueAtTime(0.7 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.35);
    const n = c.createBufferSource(); n.buffer = this.noiseBuf; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400; const ng = c.createGain();
    ng.gain.setValueAtTime(0.5 * v, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.22); n.connect(f); f.connect(ng); ng.connect(this.master); n.start(t, Math.random()); n.stop(t + 0.25);
  }
  shift() { if (!this.ok) return; const c = this.ctx, t = c.currentTime, n = c.createBufferSource(); n.buffer = this.noiseBuf; const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500; const g = c.createGain();
    g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.06); n.connect(f); f.connect(g); g.connect(this.master); n.start(t, Math.random()); n.stop(t + 0.08); }
  stopEngine() { if (this.ok) this.eg.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2); }
}
