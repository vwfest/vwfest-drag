// Low-poly VW models + per-model driving stats.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const MODELS = {
  beetle: { id: 'beetle', name: 'Beetle', blurb: 'The all-rounder. Balanced and friendly, with a wiggly rear-engine tail.', color: 0xE8A317, color2: 0xF3E6C8,
    vmax: 40, accel: 8.2, brake: 14, grip: 1.0, steer: 1.0, mass: 1.0, offTop: 0.45, wheelbase: 2.4, len: 4.0, wid: 1.6, ui: [3, 3, 3, 3] },
  bus:    { id: 'bus', name: 'Bus', blurb: 'Slow to wake up, heavy to turn, and a rolling wall in traffic. Great at bumping.', color: 0x5FA8A0, color2: 0xF3E6C8,
    vmax: 35, accel: 6.2, brake: 11, grip: 0.84, steer: 0.82, mass: 1.7, offTop: 0.42, wheelbase: 2.5, len: 4.4, wid: 1.8, ui: [2, 2, 2, 5] },
  ghia:   { id: 'ghia', name: 'Karmann Ghia', blurb: 'Low and sleek. Highest top speed and the sharpest handling, but easy to overcook.', color: 0xC8402F, color2: 0x1c1a18,
    vmax: 44, accel: 8.0, brake: 14.5, grip: 1.1, steer: 1.12, mass: 0.9, offTop: 0.4, wheelbase: 2.4, len: 4.1, wid: 1.6, ui: [5, 3, 5, 2] },
  thing:  { id: 'thing', name: 'Thing', blurb: 'Boxy off-roader. Quick off the line and barely slowed by grass, but lower top speed.', color: 0x9aa35a, color2: 0x4a4a3a,
    vmax: 37, accel: 9.2, brake: 13, grip: 0.95, steer: 0.96, mass: 1.15, offTop: 0.72, wheelbase: 2.0, len: 3.5, wid: 1.6, ui: [2, 5, 3, 3] },
};
export const MODEL_LIST = ['beetle', 'bus', 'ghia', 'thing'];

const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sph: new THREE.SphereGeometry(1, 12, 8),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 12),
};
const shared = {
  trim: new THREE.MeshPhongMaterial({ color: 0xcfd3d6, shininess: 90 }),
  glass: new THREE.MeshPhongMaterial({ color: 0x1f2e3a, shininess: 120, specular: 0x88aacc }),
  black: new THREE.MeshLambertMaterial({ color: 0x151515 }),
  head: new THREE.MeshBasicMaterial({ color: 0xfff2c0 }),
  tail: new THREE.MeshBasicMaterial({ color: 0xff2a1a }),
  seat: new THREE.MeshLambertMaterial({ color: 0x2a2420 }),
  tire: new THREE.MeshLambertMaterial({ color: 0x111111 }),
  rim: new THREE.MeshPhongMaterial({ color: 0xb9bec2, shininess: 60 }),
};
const wheelGeo = (() => {
  const t = G.cyl.clone(); t.scale(0.32, 0.22, 0.32); t.rotateZ(Math.PI / 2);
  return t;
})();
const rimGeo = (() => { const t = G.cyl.clone(); t.scale(0.17, 0.235, 0.17); t.rotateZ(Math.PI / 2); return t; })();

// part: [geo, matKey, pos, scale, rot?]
function part(geo, mat, p, s, r = [0, 0, 0]) { return { geo, mat, p, s, r }; }
const B = (m, p, s, r) => part('box', m, p, s, r), S = (m, p, s, r) => part('sph', m, p, s, r), C = (m, p, s, r) => part('cyl', m, p, s, r);
const WZ = [0, 0, Math.PI / 2], WX = [Math.PI / 2, 0, 0];

function partsFor(id) {
  const P = [];
  if (id === 'beetle') {
    P.push(B('paint', [0, 0.62, 0], [1.5, 0.5, 3.5]));                    // lower body
    for (const sx of [-1, 1]) for (const z of [1.3, -1.25]) P.push(C('paint', [sx * 0.68, 0.6, z], [0.45, 0.62, 0.45], WX)); // fenders (axis along z)
    P.push(B('paint', [0, 0.86, 1.45], [1.2, 0.16, 1.1], [0.2, 0, 0]));   // sloping hood
    P.push(B('paint', [0, 0.9, -1.35], [1.2, 0.2, 1.0], [-0.2, 0, 0]));  // engine deck
    P.push(S('glass', [0, 1.1, -0.12], [0.74, 0.44, 1.12]));              // greenhouse
    P.push(S('paint2', [0, 1.19, -0.12], [0.72, 0.5, 1.05]));             // roof cap
    P.push(B('trim', [0, 0.45, 1.92], [1.5, 0.1, 0.12])); P.push(B('trim', [0, 0.45, -1.9], [1.5, 0.1, 0.12]));
    for (const sx of [-1, 1]) { P.push(S('head', [sx * 0.5, 0.92, 1.88], [0.14, 0.14, 0.12])); P.push(B('tail', [sx * 0.55, 0.85, -1.78], [0.18, 0.1, 0.06])); }
  } else if (id === 'bus') {
    P.push(B('paint', [0, 0.78, 0], [1.78, 0.75, 4.3]));                  // lower
    P.push(B('paint2', [0, 1.43, -0.05], [1.74, 0.6, 4.1]));              // upper white
    P.push(B('paint2', [0, 1.78, -0.05], [1.66, 0.12, 4.0]));             // roof
    P.push(B('glass', [0, 1.4, 1.98], [1.5, 0.5, 0.1], [0.12, 0, 0]));    // windscreen
    for (const sx of [-1, 1]) { P.push(B('glass', [sx * 0.88, 1.43, 0.1], [0.05, 0.4, 3.1])); P.push(B('trim', [sx * 0.895, 1.15, 0.1], [0.02, 0.04, 3.1])); }
    P.push(B('paint2', [0, 0.95, 2.18], [1.5, 0.4, 0.12], [-0.3, 0, 0])); // V nose
    P.push(B('trim', [0, 0.95, 2.26], [0.35, 0.3, 0.04], [-0.3, 0, 0]));
    P.push(B('trim', [0, 0.5, 2.2], [1.7, 0.1, 0.14])); P.push(B('trim', [0, 0.5, -2.17], [1.7, 0.1, 0.14]));
    for (const sx of [-1, 1]) { P.push(S('head', [sx * 0.55, 0.75, 2.2], [0.16, 0.16, 0.1])); P.push(B('tail', [sx * 0.7, 0.9, -2.17], [0.16, 0.22, 0.06])); }
  } else if (id === 'ghia') {
    P.push(B('paint', [0, 0.55, 0], [1.56, 0.42, 3.8]));
    for (const sx of [-1, 1]) for (const z of [1.4, -1.2]) P.push(C('paint', [sx * 0.7, 0.58, z], [0.42, 0.55, 0.42], WX));
    P.push(B('paint', [0, 0.78, 1.5], [1.3, 0.12, 1.0], [0.13, 0, 0]));   // low hood
    P.push(B('paint', [0, 0.84, -1.45], [1.3, 0.14, 0.9], [-0.12, 0, 0]));
    P.push(B('glass', [0, 1.0, -0.15], [1.28, 0.34, 1.35]));              // cabin glass
    P.push(B('glass', [0, 1.0, 0.72], [1.24, 0.36, 0.06], [-0.9, 0, 0])); // raked windscreen
    P.push(B('glass', [0, 1.0, -1.0], [1.24, 0.34, 0.06], [0.9, 0, 0]));
    P.push(B('paint2', [0, 1.2, -0.1], [1.3, 0.07, 1.2]));                // roof
    P.push(B('trim', [0, 0.42, 1.95], [1.56, 0.08, 0.1])); P.push(B('trim', [0, 0.42, -1.93], [1.56, 0.08, 0.1]));
    for (const sx of [-1, 1]) { P.push(S('head', [sx * 0.52, 0.8, 1.9], [0.14, 0.12, 0.1])); P.push(B('tail', [sx * 0.55, 0.86, -1.9], [0.22, 0.08, 0.05])); }
  } else { // thing
    P.push(B('paint', [0, 0.66, 0], [1.56, 0.55, 3.4]));
    P.push(B('paint', [0, 0.97, 1.0], [1.5, 0.08, 1.1]));                 // flat hood
    for (const sx of [-1, 1]) for (const z of [1.1, -1.0]) P.push(B('paint', [sx * 0.74, 0.62, z], [0.2, 0.6, 0.85]));
    P.push(B('glass', [0, 1.3, 0.45], [1.38, 0.5, 0.05], [-0.12, 0, 0]));  // flat windscreen
    P.push(B('black', [0, 1.3, 0.45], [1.48, 0.04, 0.06], [-0.12, 0, 0]));
    P.push(B('seat', [-0.38, 1.0, -0.2], [0.5, 0.5, 0.45])); P.push(B('seat', [0.38, 1.0, -0.2], [0.5, 0.5, 0.45]));
    P.push(B('seat', [0, 1.0, -1.0], [1.3, 0.5, 0.45]));
    P.push(B('trim', [0, 1.35, -1.25], [1.4, 0.05, 0.05])); P.push(B('trim', [-0.7, 1.15, -1.25], [0.05, 0.45, 0.05])); P.push(B('trim', [0.7, 1.15, -1.25], [0.05, 0.45, 0.05])); // roll bar
    P.push(C('black', [0, 0.95, -1.75], [0.3, 0.12, 0.3], WX)); // spare wheel
    P.push(B('black', [0, 0.45, 1.75], [1.56, 0.1, 0.12])); P.push(B('black', [0, 0.45, -1.72], [1.56, 0.1, 0.12]));
    for (const sx of [-1, 1]) { P.push(C('head', [sx * 0.55, 0.9, 1.72], [0.15, 0.1, 0.15], WX)); P.push(B('tail', [sx * 0.62, 0.8, -1.72], [0.16, 0.1, 0.05])); }
  }
  return P;
}

const geoOf = (k) => G[k];
const rotM = new THREE.Matrix4(), tmpE = new THREE.Euler(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3();
const cache = new Map();
function mergedFor(id) { // geometry merged by material key, cached per model
  if (cache.has(id)) return cache.get(id);
  const by = {};
  for (const p of partsFor(id)) {
    const g = geoOf(p.geo).clone(); tmpE.set(p.r[0], p.r[1], p.r[2]); tmpQ.setFromEuler(tmpE);
    rotM.compose(tmpP.set(p.p[0], p.p[1], p.p[2]), tmpQ, tmpS.set(p.s[0], p.s[1], p.s[2])); g.applyMatrix4(rotM);
    (by[p.mat] ||= []).push(g);
  }
  const out = {}; for (const k in by) out[k] = mergeGeometries(by[k]);
  cache.set(id, out); return out;
}

export function buildCar(modelId, paintHex, paint2Hex, lowQ) {
  const M = MODELS[modelId], root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const mats = { ...shared,
    paint: new THREE.MeshPhongMaterial({ color: paintHex ?? M.color, shininess: 70, specular: 0x555555 }),
    paint2: new THREE.MeshPhongMaterial({ color: paint2Hex ?? M.color2, shininess: 60, specular: 0x444444 }) };
  const geos = mergedFor(modelId);
  for (const k in geos) { const m = new THREE.Mesh(geos[k], mats[k]); m.castShadow = !lowQ; body.add(m); }
  const wheels = [], wx = M.wid / 2 - 0.1, zf = M.wheelbase / 2, rr = modelId === 'bus' ? 1.06 : 1;
  for (const [sx, z, front] of [[-1, zf, true], [1, zf, true], [-1, -zf, false], [1, -zf, false]]) {
    const pivot = new THREE.Group(), spin = new THREE.Group();
    const t = new THREE.Mesh(wheelGeo, shared.tire), r = new THREE.Mesh(rimGeo, shared.rim); t.castShadow = !lowQ;
    spin.add(t, r); spin.scale.setScalar(rr); pivot.add(spin); pivot.position.set(sx * wx, 0.32 * rr, z); body.add(pivot);
    wheels.push({ pivot, spin, front });
  }
  return { root, body, wheels, M };
}
