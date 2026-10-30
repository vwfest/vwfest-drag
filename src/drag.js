// Drag-strip physics: 4-speed manual, torque curve, launch (clutch dump) quality, shift quality, rev limiter, traction. Pure maths, no DOM.
export const QM = 402.336, FT60 = 18.288, FT330 = 100.584, E8 = 201.168, FT1000 = 304.8, TRAP_LEN = 20.117, MPH = 2.23694;
export const IDLE = 1000;
// vRL: speed (m/s) at redline in each gear. A: peak first-gear accel (m/s^2). cd: aero drag coefficient. trac: traction cap (m/s^2)
export const SPEC = {
  beetle: { redline: 6200, vRL: [14, 26, 40, 58], A: 10.2, cd: 0.00034, trac: 8.2 },
  bus:    { redline: 5600, vRL: [13, 24, 36, 52], A: 8.0, cd: 0.00048, trac: 7.4 },
  ghia:   { redline: 6600, vRL: [15, 28, 43, 63], A: 10.9, cd: 0.00030, trac: 8.0 },
  thing:  { redline: 6000, vRL: [13, 25, 38, 54], A: 11.2, cd: 0.00043, trac: 8.9 },
};
export const torque = x => Math.max(0.35, 1 - 1.7 * (x - 0.7) * (x - 0.7));
export const LAUNCH_GREEN = [0.55, 0.80];     // fraction of redline that gives a perfect launch
export const SHIFT_PERFECT = [0.92, 1.0], SHIFT_GOOD = [0.82, 0.92];

export class DragSim {
  constructor(model) { this.model = model; this.S = SPEC[model]; this.reset(); }
  reset() {
    Object.assign(this, { z: 0, v: 0, a: 0, gear: 1, rpm: IDLE, launched: false, t: 0, cut: 0, boost: 0, boostMul: 1, spin: 0, bog: 0, launchRpm: IDLE, lim: 0, limHit: false,
      etT: null, et: null, marks: {}, trapStart: null, trap: null, finished: false, clock: 0, launchQ: '', lastShift: '', shifts: [] });
  }
  vRpm() { return this.v / this.S.vRL[this.gear - 1] * this.S.redline; }
  // before launch: rev the engine
  rev(dt, gas) {
    const R = this.S.redline;
    if (gas) this.rpm = Math.min(R, this.rpm + 3300 * dt * (this.rpm > R * 0.97 ? 0.1 : 1)); else this.rpm = Math.max(IDLE, this.rpm - 2600 * dt);
    if (gas && this.rpm >= R * 0.985) this.rpm = R * (0.955 + 0.03 * Math.sin(this.clock * 55)); // limiter bounce
    this.clock += dt;
  }
  launch() {
    if (this.launched) return null; this.launched = true; this.launchRpm = this.rpm;
    const x = this.rpm / this.S.redline;
    if (x > LAUNCH_GREEN[1] + 0.06) { this.spin = 1.0 + (x - 0.85) * 4; this.launchQ = 'spin'; }
    else if (x > LAUNCH_GREEN[1]) { this.spin = 0.45; this.launchQ = 'good'; }
    else if (x >= LAUNCH_GREEN[0]) { this.boost = 1.4; this.boostMul = 1.05; this.launchQ = 'perfect'; }
    else if (x >= 0.42) { this.launchQ = 'good'; }
    else { this.bog = 0.8; this.launchQ = 'bog'; }
    return this.launchQ;
  }
  shift() {
    if (!this.launched || this.gear >= 4 || this.cut > 0) return null;
    const x = this.vRpm() / this.S.redline; let q;
    if (this.limHit || x >= 0.995) { q = 'late'; this.cut = 0.2; }
    else if (x >= SHIFT_PERFECT[0]) { q = 'perfect'; this.cut = 0.09; this.boost = 1.1; this.boostMul = 1.04; }
    else if (x >= SHIFT_GOOD[0]) { q = 'good'; this.cut = 0.14; }
    else { q = 'early'; this.cut = 0.17; }
    this.gear++; this.limHit = false; this.lim = 0; this.lastShift = q; this.shifts.push(q); this.cutQ = q; return q;
  }
  step(dt) {
    this.clock += dt;
    if (!this.launched) return;
    const S = this.S, R = S.redline; this.t += dt;
    const k = Math.min(1, this.t / 0.8), vr = this.vRpm();
    const slipRpm = this.launchRpm * (1 - k * k * (3 - 2 * k));
    this.rpm = Math.max(vr, slipRpm, IDLE);
    let x = Math.min(this.rpm / R, 1.02);
    let a = 0;
    if (this.cut > 0) { this.cut -= dt; this.rpm = Math.max(IDLE, vr * 0.97); x = this.rpm / R; }
    else {
      let m = this.boost > 0 ? this.boostMul : 1; if (this.boost > 0) this.boost -= dt;
      if (this.bog > 0) { m *= 0.7; this.bog -= dt; }
      a = S.A * torque(x) * (S.vRL[0] / S.vRL[this.gear - 1]) * m;
      let cap = S.trac * (this.launchQ === 'perfect' && this.t < 1.2 ? 1.06 : 1);
      if (this.spin > 0) { cap *= 0.62 + 0.38 * (1 - Math.min(1, this.spin)); this.spin -= dt * (1.1 + this.v * 0.04); }
      if (this.gear === 1 || this.v < 12) a = Math.min(a, cap);
    }
    a -= S.cd * this.v * this.v + 0.12;
    // rev limiter
    const vmaxG = S.vRL[this.gear - 1] * 1.0;
    if (this.v >= vmaxG * 0.995 && this.cut <= 0) { this.limHit = true; this.lim += dt; a = Math.min(a, (vmaxG - this.v) * 8); this.rpm = R * (0.96 + 0.035 * Math.sin(this.clock * 60)); }
    this.a = a;
    const z0 = this.z, v0 = this.v, tPrev = this.t - dt;
    if (!this.finished) this.v = Math.max(0, this.v + a * dt); else this.v = Math.max(0, this.v - 8 * dt);
    this.z += (v0 + this.v) / 2 * dt;
    // timing (interpolated crossings)
    const cross = (d) => z0 < d && this.z >= d ? tPrev + dt * (d - z0) / (this.z - z0) : null, M = this.marks;
    if (this.etT == null) { const c = cross(0.3); if (c != null) this.etT = c; }
    if (this.etT != null) for (const [n, d] of [['ft60', FT60], ['ft330', FT330], ['e8', E8], ['ft1000', FT1000]]) if (M[n] == null) { const c = cross(d); if (c != null) { M[n] = { et: c - this.etT, mph: this.v * MPH }; } }
    if (this.trapStart == null) { const c = cross(QM - TRAP_LEN); if (c != null) this.trapStart = c; }
    if (!this.finished) { const c = cross(QM); if (c != null) { this.finished = true; this.et = c - this.etT; this.trap = TRAP_LEN / (c - this.trapStart) * MPH; this.finT = c; } }
  }
}

// AI opponent profile
export const LEVELS = {
  easy:   { rt: [0.26, 0.08], launch: [0.45, 0.88], shift: [0.80, 0.97] },
  medium: { rt: [0.19, 0.05], launch: [0.52, 0.80], shift: [0.88, 0.99] },
  hard:   { rt: [0.14, 0.03], launch: [0.60, 0.74], shift: [0.925, 0.985] },
};
export function makeAi(level, rnd = Math.random) {
  const L = LEVELS[level] || LEVELS.medium, g = () => (rnd() + rnd() + rnd() - 1.5) / 1.5;
  const u = (a, b) => a + (b - a) * rnd();
  return { rt: Math.max(0.1, L.rt[0] + g() * L.rt[1]), launchX: u(L.launch[0], L.launch[1]), shiftX: [u(L.shift[0], L.shift[1]), u(L.shift[0], L.shift[1]), u(L.shift[0], L.shift[1])] };
}
