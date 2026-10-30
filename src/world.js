// Drag strip scene: asphalt, rubbered launch pads, lane lines, walls with VW Fest ad panels, timing gantry, 3D christmas tree, grandstands, trees, hills, sky.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { QM, FT60, FT330, E8, FT1000 } from './drag.js';

export const LANE_X = 2.4, WALL_X = 5.9, END_Z = 900, START_Z = -70;
const AMBER = '#E8A317', CREAM = '#F3E6C8', DARK = '#121110';
function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); } return t;
}
function textBoard(lines, w = 512, h = 160, bg = DARK) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = AMBER; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach((l, i) => { g.fillStyle = i === 0 ? AMBER : CREAM; g.font = (i === 0 ? '800 ' : '600 ') + (l.size || (i === 0 ? 76 : 34)) + 'px system-ui,Arial,sans-serif'; g.fillText(l.t, w / 2, l.y || (lines.length === 1 ? h / 2 : (i === 0 ? h * .4 : h * .78))); });
  });
}
function asphaltTex() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#3b3937'; g.fillRect(0, 0, w, h);
    const r = rng(7); for (let i = 0; i < 9000; i++) { const v = 40 + r() * 50 | 0; g.fillStyle = `rgba(${v},${v},${v - 2},.55)`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
    for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(15,15,15,.15)'; g.fillRect(0, r() * h, w, 1 + r() * 3); }       // tar snakes
  });
}
function grassTex() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#6a8f3e'; g.fillRect(0, 0, w, h); const r = rng(11);
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(${70 + r() * 50 | 0},${110 + r() * 50 | 0},${40 + r() * 30 | 0},.28)`; g.beginPath(); g.arc(r() * w, r() * h, 20 + r() * 50, 0, 7); g.fill(); }
    for (let i = 0; i < 9000; i++) { const v = r(); g.fillStyle = v < .5 ? 'rgba(40,80,30,.35)' : 'rgba(160,190,80,.3)'; g.fillRect(r() * w, r() * h, 1.5, 3); }
  }, [300, 300]);
}
const po = (m, f) => { m.polygonOffset = true; m.polygonOffsetFactor = -f; m.polygonOffsetUnits = -f; return m; };

export function buildWorld(low) {
  const scene = new THREE.Scene(), R = rng(209), world = { scene };
  scene.fog = new THREE.Fog(0xcfe3f2, 220, 1700);
  scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x6a7040, 1.15));
  const sun = new THREE.DirectionalLight(0xfff0d6, 2.6); sun.position.set(-40, 80, 30); scene.add(sun, sun.target);
  const sunDir = new THREE.Vector3(-0.45, 0.62, 0.45).normalize();
  if (!low) { sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera; sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40; sc.near = 1; sc.far = 220; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.06; }
  world.sun = sun;
  const skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { sun: { value: sunDir } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying vec3 vD; uniform vec3 sun; void main(){ float h = clamp(vD.y,-0.2,1.0); vec3 top = vec3(0.22,0.46,0.80), mid = vec3(0.55,0.76,0.93), hor = vec3(0.81,0.89,0.95);' +
      ' vec3 c = mix(hor, mid, smoothstep(0.0,0.25,h)); c = mix(c, top, smoothstep(0.2,0.9,h)); c = mix(c, hor, 1.0 - smoothstep(-0.2,0.02,h));' +
      ' float s = max(dot(normalize(vD), sun), 0.0); c += vec3(1.0,0.85,0.55)*pow(s,24.0)*0.35 + vec3(1.0,0.95,0.8)*pow(s,900.0)*2.0; gl_FragColor = vec4(c,1.0); }' });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(3500, 24, 12), skyMat); sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky); world.sky = sky;
  const gm = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshLambertMaterial({ map: grassTex() }));
  gm.rotation.x = -Math.PI / 2; gm.position.y = -0.05; gm.receiveShadow = !low; scene.add(gm);

  // ---- asphalt (x +-7.2, z START_Z..END_Z)
  const len = END_Z - START_Z, zc = (END_Z + START_Z) / 2;
  const at = asphaltTex(); at.repeat.set(1, len / 14); at.anisotropy = low ? 2 : 8;
  const road = new THREE.Mesh(new THREE.PlaneGeometry(WALL_X * 2 + 1.4, len), po(new THREE.MeshLambertMaterial({ map: at }), 1)); road.rotation.x = -Math.PI / 2; road.position.set(0, 0.0, zc); road.receiveShadow = !low; scene.add(road);
  // rubbered launch pads + lane lines + staging lines + markers (one canvas laid over the first 90 m)
  {
    const PW = 512, PH = 1024, padLen = 100, pad = canvasTex(PW, PH, (g, w, h) => {
      const r = rng(5), sx = (x) => (x / (WALL_X * 2 + 1.4) + 0.5) * w, sz = (z) => (1 - (z - START_Z) / (padLen + 70)) * h; g.clearRect(0, 0, w, h);
      for (const lx of [-LANE_X, LANE_X]) {
        const grd = g.createLinearGradient(0, sz(0), 0, sz(60)); grd.addColorStop(0, 'rgba(8,8,8,.62)'); grd.addColorStop(1, 'rgba(8,8,8,0)');
        for (const dx of [-0.85, 0.85]) { g.fillStyle = grd; g.fillRect(sx(lx + dx - 0.55), sz(60), sx(lx + dx + 0.55) - sx(lx + dx - 0.55), sz(0) - sz(60)); }
        g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(sx(lx - 1.8), sz(8), sx(lx + 1.8) - sx(lx - 1.8), sz(0) - sz(8));
        for (let i = 0; i < 160; i++) { g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(sx(lx + (r() - .5) * 3.2), sz(r() * 40), 2, 2 + r() * 14); }
        g.fillStyle = '#e9e4d4'; g.fillRect(sx(lx - 2.2), sz(0.0), sx(lx + 2.2) - sx(lx - 2.2), 5);          // starting line
        g.fillStyle = 'rgba(232,227,212,.8)'; g.fillRect(sx(lx - 2.2), sz(-0.9), sx(lx + 2.2) - sx(lx - 2.2), 3);  // pre-stage
      }
      g.fillStyle = '#e9e4d4'; for (let z = START_Z; z < padLen; z += 4) g.fillRect(sx(-0.07), sz(z + 2), sx(0.07) - sx(-0.07), sz(z) - sz(z + 2));
      g.fillStyle = AMBER; g.fillRect(sx(-WALL_X + 0.15), 0, 6, h); g.fillRect(sx(WALL_X - 0.15) - 6, 0, 6, h);
    });
    pad.wrapS = pad.wrapT = THREE.ClampToEdgeWrapping; const pm = new THREE.Mesh(new THREE.PlaneGeometry(WALL_X * 2 + 1.4, padLen + 70), po(new THREE.MeshLambertMaterial({ map: pad, transparent: true }), 3));
    pm.rotation.x = -Math.PI / 2; pm.position.set(0, 0.01, START_Z + (padLen + 70) / 2); scene.add(pm);
    // long lane lines for the rest of the strip
    const ln = new THREE.Mesh(new THREE.PlaneGeometry(0.16, END_Z - padLen), po(new THREE.MeshBasicMaterial({ color: 0xe9e4d4 }), 2)); ln.rotation.x = -Math.PI / 2; ln.position.set(0, 0.012, padLen + (END_Z - padLen) / 2); scene.add(ln);
    for (const sx of [-1, 1]) { const el = new THREE.Mesh(new THREE.PlaneGeometry(0.16, END_Z - padLen), po(new THREE.MeshBasicMaterial({ color: 0xE8A317 }), 2)); el.rotation.x = -Math.PI / 2; el.position.set(sx * (WALL_X - 0.2), 0.012, padLen + (END_Z - padLen) / 2); scene.add(el); }
    // distance stripes (1/8 mile, finish)
    const chk = canvasTex(256, 32, (g, w, h) => { const s = 16; for (let y = 0; y < 2; y++) for (let x = 0; x < 16; x++) { g.fillStyle = (x + y) % 2 ? '#111' : '#f3ece0'; g.fillRect(x * s, y * s, s, s); } }); chk.magFilter = THREE.NearestFilter;
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(WALL_X * 2, 1.4), po(new THREE.MeshBasicMaterial({ map: chk }), 4)); fl.rotation.x = -Math.PI / 2; fl.position.set(0, 0.014, QM + 0.7); scene.add(fl);
    for (const d of [FT60, FT330, E8, FT1000]) { const st = new THREE.Mesh(new THREE.PlaneGeometry(WALL_X * 2, 0.35), po(new THREE.MeshBasicMaterial({ color: d === E8 ? 0xE8A317 : 0xcfc8b8 }), 3)); st.rotation.x = -Math.PI / 2; st.position.set(0, 0.014, d); scene.add(st); }
  }
  // ---- walls with ad panels (both sides), run START_Z..END_Z
  {
    const steel = new THREE.MeshPhongMaterial({ color: 0x2b2a28, shininess: 40 });
    const ads = [[{ t: '$VWFEST' }, { t: 'pure enthusiast energy' }], [{ t: 'AIR-COOLED' }, { t: 'forever roadtrip' }], [{ t: 'ARCADE ROOM', size: 64 }, { t: 'drag · race · survive' }], [{ t: 'vwfestmemecoin.com', size: 54 }, { t: 'join the convoy' }], [{ t: 'FOLLOW' }, { t: '@VWFESTLIVE' }]];
    const wallMat = new THREE.MeshLambertMaterial({ color: 0xc9c3b6 });
    const barrier = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.0, END_Z - START_Z), wallMat); 
    for (const s of [-1, 1]) {
      const b = barrier.clone(); b.position.set(s * (WALL_X + 0.3), 0.5, zc); b.castShadow = !low; b.receiveShadow = !low; scene.add(b);
      let i = 0; for (let z = START_Z + 8; z < END_Z - 10; z += 24, i++) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(8, 0.9), new THREE.MeshBasicMaterial({ map: textBoard(ads[(i + (s > 0 ? 2 : 0)) % ads.length], 512, 58, DARK) }));
        p.position.set(s * (WALL_X - 0.005), 0.5, z); p.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2; scene.add(p);
      }
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, END_Z - START_Z), new THREE.MeshLambertMaterial({ color: 0x8a867e })); cap.position.set(s * (WALL_X + 0.3), 1.02, zc); scene.add(cap);
    }
    // distance signs on the right wall tops
    const sign = (txt, sub, z, side) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.5), new THREE.MeshBasicMaterial({ map: textBoard([{ t: txt, size: 78 }, { t: sub, size: 36 }], 512, 214) })); m.position.set(side * (WALL_X + 0.7), 2.4, z);
      m.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2; scene.add(m); const pole = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.4, 0.15), steel); pole.position.set(side * (WALL_X + 0.72), 1.2, z); scene.add(pole); };
    sign('60 FT', 'launch', FT60, 1); sign('330 FT', 'first gear done', FT330, 1); sign('1/8 MILE', '660 ft', E8, 1); sign('1000 FT', 'almost there', FT1000, 1);
    for (const s of [-1, 1]) sign('1/4 MILE', 'FINISH', QM, s);
  }
  // ---- timing gantry at the finish + starting-line light posts + scoreboard
  {
    const steel = new THREE.MeshPhongMaterial({ color: 0x2b2a28, shininess: 40 }), gx = new THREE.Group(); gx.position.set(0, 0, QM + 1.2); scene.add(gx);
    for (const s of [-1, 1]) { const pl = new THREE.Mesh(new THREE.BoxGeometry(0.7, 8, 0.7), steel); pl.position.set(s * (WALL_X + 1.6), 4, 0); pl.castShadow = !low; gx.add(pl); }
    const beam = new THREE.Mesh(new THREE.BoxGeometry((WALL_X + 1.6) * 2, 1.9, 0.6), new THREE.MeshBasicMaterial({ map: textBoard([{ t: '$VWFEST · FINISH', size: 74, y: 70 }, { t: 'quarter mile · 1320 ft', size: 34, y: 125 }], 1024, 150) })); beam.position.set(0, 7.4, 0); gx.add(beam);
    // shutdown-end tire wall
    const tw = new THREE.Mesh(new THREE.BoxGeometry(WALL_X * 2, 2.2, 2), new THREE.MeshLambertMaterial({ color: 0x1b1a19 })); tw.position.set(0, 1.1, END_Z + 1); scene.add(tw);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(WALL_X * 2 + .05, 0.5, 2.05), new THREE.MeshLambertMaterial({ color: 0xd23a2a })); stripe.position.set(0, 1.3, END_Z + 1); scene.add(stripe);
    // grandstands on the far sides along the first 300 m
    const crowd = canvasTex(256, 64, (g, w, h) => { const r = rng(3); g.fillStyle = '#3a3a3a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 700; i++) { g.fillStyle = ['#E8A317', '#F3E6C8', '#C8402F', '#5FA8A0', '#2E6DA4', '#e9d36c'][r() * 6 | 0]; g.fillRect(r() * w, r() * h, 3, 4); } }); crowd.wrapS = THREE.RepeatWrapping; crowd.repeat.set(8, 1);
    for (const [z0, side, n] of [[-20, -1, 70], [60, -1, 90], [150, -1, 70], [-10, 1, 60], [120, 1, 90], [330, 1, 60]]) {
      const st = new THREE.Group();
      for (let k = 0; k < 5; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.0, n), new THREE.MeshLambertMaterial({ map: crowd })); b.position.set(side * k * 2.6, 0.5 + k * 1.0, 0); b.castShadow = !low; st.add(b); }
      const roof = new THREE.Mesh(new THREE.BoxGeometry(14, 0.25, n + 2), new THREE.MeshLambertMaterial({ color: 0xE8E0CC })); roof.position.set(side * 5.5, 7.4, 0); roof.castShadow = !low; st.add(roof);
      for (const dz of [-n / 2, 0, n / 2]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 7.4, 0.3), steel); post.position.set(side * 11, 3.7, dz); st.add(post); }
      st.position.set(side * (WALL_X + 9), 0, z0 + n / 2); scene.add(st);
    }
    // light poles
    for (let z = -40; z < 520; z += 70) for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 9, 6), steel); p.position.set(s * (WALL_X + 3.5), 4.5, z); p.castShadow = !low; scene.add(p); const l = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, 0.6), new THREE.MeshBasicMaterial({ color: 0xfff6d8 })); l.position.set(s * (WALL_X + 3.0), 9.0, z); scene.add(l); }
  }
  // ---- christmas tree (center, 16 m ahead of the line, faces the cars)
  {
    const g = new THREE.Group(); g.position.set(0, 0, 17); scene.add(g);
    const steel = new THREE.MeshPhongMaterial({ color: 0x242321, shininess: 40 });
    const col = new THREE.Mesh(new THREE.BoxGeometry(1.35, 4.6, 0.5), steel); col.position.y = 2.3 + 0.2; g.add(col);
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.5, 1.2), steel); base.position.y = 0.25; g.add(base);
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 0.7), steel); top.position.y = 4.95; g.add(top);
    const cols = { blue: 0x3b8cff, amber: 0xffb81c, green: 0x2dff6a, red: 0xff2a1a }, dim = (c) => new THREE.Color(c).multiplyScalar(0.12);
    const bulbG = new THREE.SphereGeometry(0.19, 14, 10), lamps = { left: {}, right: {} };
    const rows = [['pre', 'blue', 4.45], ['stage', 'blue', 4.05], ['a1', 'amber', 3.45], ['a2', 'amber', 2.85], ['a3', 'amber', 2.25], ['green', 'green', 1.55], ['red', 'red', 0.95]];
    for (const [side, sx] of [['left', 0.33], ['right', -0.33]]) for (const [name, c, y] of rows) {
      const m = new THREE.MeshBasicMaterial({ color: dim(cols[c]) }), b = new THREE.Mesh(bulbG, m); b.position.set(sx, y + 0.2, -0.28); b.scale.z = 0.6; g.add(b);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 6, 16), new THREE.MeshLambertMaterial({ color: 0x0c0b0a })); ring.position.set(sx, y + 0.2, -0.26); g.add(ring); lamps[side][name] = { m, on: new THREE.Color(cols[c]), off: dim(cols[c]) };
    }
    const sgn = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.45), new THREE.MeshBasicMaterial({ map: textBoard([{ t: '$VWFEST', size: 100 }], 512, 135) })); sgn.position.set(0, 5.5, -0.0); sgn.rotation.y = Math.PI; sgn.position.z = -0.37; g.add(sgn);
    world.lamps = lamps; world.setLamp = (side, name, on) => { const l = lamps[side][name]; l.m.color.copy(on ? l.on : l.off); };
  }
  // ---- trees (instanced), both sides
  {
    const want = low ? 150 : 380, pts = [];
    while (pts.length < want) { const side = R() < 0.5 ? -1 : 1, x = side * (WALL_X + 24 + R() * 190), z = START_Z + R() * (END_Z - START_Z + 200); pts.push([x, z, R()]); }
    const trunkG = new THREE.CylinderGeometry(0.22, 0.32, 1, 6); trunkG.translate(0, 0.5, 0);
    const kinds = [{ g: new THREE.IcosahedronGeometry(1, 0), y: 4.4, sx: 2.6, sy: 2.4, th: 3.2, col: 0x3f7a35 }, { g: new THREE.ConeGeometry(1, 1, 7), y: 6.0, sx: 2.2, sy: 7.5, th: 2.2, col: 0x2d5f3a }, { g: new THREE.SphereGeometry(1, 6, 5), y: 6.5, sx: 1.2, sy: 5.2, th: 3.4, col: 0x5d8c3a }];
    const buckets = kinds.map(() => []); pts.forEach(p => buckets[Math.min(2, p[2] * 3 | 0)].push(p));
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5b4330 }), dummy = new THREE.Object3D(), col = new THREE.Color();
    buckets.forEach((arr, ki) => { const K = kinds[ki], fol = new THREE.InstancedMesh(K.g, new THREE.MeshLambertMaterial({ flatShading: true }), Math.max(1, arr.length)), tr = new THREE.InstancedMesh(trunkG, trunkMat, Math.max(1, arr.length));
      arr.forEach((p, i) => { const sc = 0.75 + R() * 0.7; dummy.position.set(p[0], 0, p[1]); dummy.rotation.set(0, R() * 6.28, 0); dummy.scale.set(sc * 0.9, sc * K.th, sc * 0.9); dummy.updateMatrix(); tr.setMatrixAt(i, dummy.matrix);
        dummy.position.set(p[0], K.y * sc, p[1]); dummy.scale.set(K.sx * sc, K.sy * sc, K.sx * sc); dummy.updateMatrix(); fol.setMatrixAt(i, dummy.matrix); col.setHex(K.col).offsetHSL((R() - .5) * 0.05, (R() - .5) * 0.15, (R() - .5) * 0.1); fol.setColorAt(i, col); });
      if (!arr.length) { fol.count = 0; tr.count = 0; } fol.castShadow = tr.castShadow = !low; fol.frustumCulled = tr.frustumCulled = false; scene.add(fol, tr); });
  }
  // ---- hills + mountains + clouds
  {
    const hm = new THREE.MeshLambertMaterial({ flatShading: true, color: 0x6e8f50 }), mm = new THREE.MeshLambertMaterial({ flatShading: true, color: 0x7d8fa6 }), gold = new THREE.MeshLambertMaterial({ flatShading: true, color: 0xa39a5a });
    for (let i = 0; i < 22; i++) { const a = i / 22 * Math.PI * 2 + R() * 0.2, r = 700 + R() * 500, s = 140 + R() * 220;
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), i % 4 === 0 ? gold : hm); m.scale.set(s, s * (0.25 + R() * 0.25), s); m.position.set(Math.cos(a) * r, 0, zc + Math.sin(a) * r); m.rotation.y = R() * 6; scene.add(m); }
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + R() * 0.3, r = 1700 + R() * 300, s = 400 + R() * 400;
      const m = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 6), mm); m.scale.set(s, s * (0.5 + R() * 0.5), s); m.position.set(Math.cos(a) * r, s * 0.2, zc + Math.sin(a) * r); m.rotation.y = R() * 6; scene.add(m); }
    const parts = [], sph = new THREE.SphereGeometry(1, 7, 5);
    for (let c = 0; c < 16; c++) { const a = R() * 6.28, r = 500 + R() * 1800, y = 220 + R() * 160, cx = Math.cos(a) * r, cz = zc + Math.sin(a) * r;
      for (let k = 0; k < 4 + R() * 3; k++) { const g = sph.clone(), s = 35 + R() * 45; g.scale(s * 1.6, s * 0.55, s); g.translate(cx + (R() - .5) * 120, y + (R() - .5) * 14, cz + (R() - .5) * 60); parts.push(g); } }
    const m = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, fog: false })); m.frustumCulled = false; scene.add(m);
  }
  return world;
}
