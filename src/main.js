// $VWFEST Drag Strip: Three.js quarter-mile, christmas tree, launch + shift timing, AI lane, local bests + shared nickname leaderboard.
import * as THREE from 'three';
import { MODELS, MODEL_LIST, buildCar } from './cars.js';
import { DragSim, SPEC, makeAi, LEVELS, QM, MPH, IDLE, LAUNCH_GREEN, SHIFT_PERFECT, SHIFT_GOOD } from './drag.js';
import { buildWorld, LANE_X } from './world.js';
import { Particles } from './fx.js';
import { Sfx } from './audio.js';

const API = 'https://race.vwfestmemecoin.com/api/arcade/drag', LS_KEY = 'vwfest_drag_v1', DT = 1 / 240;
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const params = new URLSearchParams(location.search);
const manual = !!params.get('manual');                       // test hook: stop the realtime loop; tests advance time with __drag.step()

// ---------- quality / renderer ----------
const touchDev = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
if (touchDev) document.body.classList.add('touch');
const isMobile = touchDev && (matchMedia('(pointer:coarse)').matches || innerWidth < 900) || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
const low = params.get('q') === 'low' || (params.get('q') !== 'high' && isMobile);
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas: $('game'), antialias: !low, powerPreference: 'high-performance' }); } catch (e) { $('noGL').classList.remove('hidden'); throw e; }
let pr = low ? Math.min(devicePixelRatio || 1, 1.25) : Math.min(devicePixelRatio || 1, 2);
renderer.setPixelRatio(pr); renderer.shadowMap.enabled = !low; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const world = buildWorld(low), scene = world.scene;
const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.5, 4000);
const particles = new Particles(scene, low ? 120 : 320), sfx = new Sfx();
function resize() {
  const st = $('stage'), w = st.clientWidth, h = st.clientHeight; if (!w || !h) return;
  renderer.setPixelRatio(pr); renderer.setSize(w, h, false); camera.aspect = w / h;
  const portrait = w / h < 1; camera.userData.base = portrait ? clamp(2 * Math.atan(Math.tan(33 * Math.PI / 180) / (w / h)) * 180 / Math.PI, 60, 90) : 58;
  camera.fov = camera.userData.base; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); new ResizeObserver(resize).observe($('stage'));

// ---------- garage ----------
const PAINTS = [0, 0xC8402F, 0x2E6DA4, 0x5FA8A0, 0x6B8E4E, 0xE9E4D4];
const AI_PAINT = [0x2E6DA4, 0xC8402F, 0x5FA8A0, 0x6B8E4E, 0xE9E4D4, 0x8E5BA8, 0xE06B2D, 0xf2d04a];
const ls = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
let myModel = MODEL_LIST.includes(ls.get('vwfest_car')) ? ls.get('vwfest_car') : 'beetle';
let myPaint = PAINTS.includes(+ls.get('vwfest_paint')) ? +ls.get('vwfest_paint') : 0;
let level = LEVELS[ls.get('vwfest_drag_level')] ? ls.get('vwfest_drag_level') : 'medium';
const paintOf = () => myPaint || MODELS[myModel].color;
const STAT = ['Launch', 'Top end', 'Weight', 'Grip'];
const dragUi = { beetle: [3, 3, 3, 3], bus: [2, 2, 5, 2], ghia: [4, 5, 2, 3], thing: [5, 3, 3, 5] };
function renderGarage() {
  $('carChips').innerHTML = MODEL_LIST.map(id => `<button type="button" role="radio" aria-checked="${id === myModel}" class="${id === myModel ? 'on' : ''}" data-car="${id}">${MODELS[id].name}</button>`).join('');
  $('carStats').replaceChildren(...dragUi[myModel].map((v, i) => { const d = document.createElement('div'), u = document.createElement('u'), b = document.createElement('s'); d.append(STAT[i], u); u.append(b); b.style.width = v * 20 + '%'; return d; }));
  $('levelChips').innerHTML = Object.keys(LEVELS).map(l => `<button type="button" role="radio" aria-checked="${l === level}" class="${l === level ? 'on' : ''}" data-l="${l}">${l[0].toUpperCase() + l.slice(1)} rival</button>`).join('');
  $('swatches').replaceChildren(...PAINTS.map(c => { const b = document.createElement('button'); b.type = 'button'; b.dataset.c = c; b.setAttribute('aria-label', 'paint ' + (c ? '#' + c.toString(16) : 'stock')); b.style.background = '#' + (c || MODELS[myModel].color).toString(16).padStart(6, '0'); if (c === myPaint) b.className = 'on'; return b; }));
}
$('carChips').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; myModel = b.dataset.car; ls.set('vwfest_car', myModel); renderGarage(); if (state === 'menu') buildPlayer(); updateHud(); });
$('swatches').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; myPaint = +b.dataset.c; ls.set('vwfest_paint', String(myPaint)); renderGarage(); if (state === 'menu') buildPlayer(); });
$('levelChips').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; level = b.dataset.l; ls.set('vwfest_drag_level', level); renderGarage(); });

// ---------- cars on the strip ----------
let P = null, O = null;   // {sim, view, lane, model, ai}
function addCar(modelId, paint, lane, isPlayer) {
  const M = MODELS[modelId], view = buildCar(modelId, paint, M.color2, low), sim = new DragSim(modelId);
  scene.add(view.root); view.root.position.x = lane;
  return { sim, view, lane, model: modelId, M, isPlayer, spinAng: 0, vis: -4, ai: null, launchClock: null };
}
function buildPlayer() { if (P) scene.remove(P.view.root); P = addCar(myModel, paintOf(), LANE_X, true); P.vis = 0; placeCar(P); }
function buildOpp() {
  if (O) scene.remove(O.view.root);
  const pool = MODEL_LIST.filter(m => m !== myModel || Math.random() < 0.3), mid = pool[(Math.random() * pool.length) | 0];
  const paints = AI_PAINT.filter(c => c !== paintOf()); O = addCar(mid, paints[(Math.random() * paints.length) | 0], -LANE_X, false); O.ai = makeAi(level); O.vis = 0; placeCar(O);
}
function placeCar(c) {
  const z = c.sim.z + c.vis - c.M.len / 2 + 0.15; c.view.root.position.set(c.lane, 0, z);
  const a = c.sim.a || 0; c.view.body.rotation.x = c.sim.launched && !c.sim.finished ? -clamp(a * 0.0085, 0, 0.1) : 0;
  c.view.body.position.y = 0;
  for (const w of c.view.wheels) w.spin.rotation.x += 0; // spin handled in animate
}

// ---------- tree + lamps ----------
const LAMPS = ['pre', 'stage', 'a1', 'a2', 'a3', 'green', 'red'];
const lampState = { left: {}, right: {} };
function setLamp(side, name, on) { if (!!lampState[side][name] === on) return; lampState[side][name] = on; world.setLamp(side, name, on); document.querySelector(side === 'left' ? '#treeL i[data-n=' + name + ']' : '#treeR i[data-n=' + name + ']').classList.toggle('on', on); }
function clearTree() { for (const s of ['left', 'right']) for (const n of LAMPS) setLamp(s, n, false); }
function setBoth(name, on) { setLamp('left', name, on); setLamp('right', name, on); }

// ---------- flow ----------
let state = 'menu';               // menu | stage | tree | run | slip
let clock = 0, stageT = 0, waitT = 1.2, treeT = -1, greenAt = null, token = null, foul = null, rt = null, slipTimer = null, firstFinishAt = null, lastResult = null;
const keys = { gas: false };
let toastT = 0;
function toast(txt, cls) { const t = $('toast'); t.textContent = txt; t.className = 'show ' + cls; toastT = 1.3; }
function tip(txt) { const t = $('tip'); t.textContent = txt || ''; t.classList.toggle('hidden', !txt); }
function show(id) { ['cardMenu', 'cardSlip'].forEach(c => $(c).classList.toggle('hidden', c !== id)); $('overlay').classList.toggle('off', !id); }
function setPlaying(on) { document.body.classList.toggle('playing', on); }

function startStaging() {
  sfx.init(); buildPlayer(); buildOpp(); clearTree(); state = 'stage'; stageT = 0; clock = 0; waitT = 0.9 + Math.random() * 1.1; treeT = -1; greenAt = null; foul = null; rt = null; token = null; firstFinishAt = null; lastResult = null;
  P.vis = -4; O.vis = -4; O.sim.rpm = IDLE; show(null); setPlaying(true); $('tAct').textContent = 'LAUNCH'; $('hRt').textContent = '-.---'; $('hEt').textContent = '0.000'; $('toast').className = '';
  tip('Staging… hold GAS to rev into the green zone'); $('sMsg').textContent = ''; $('sMsg').className = 'msg'; updateHud();
}
function treeLogic(dt) {
  treeT += dt;
  const T = treeT - waitT;
  if (T >= 0) setBoth('a1', true); if (T >= 0.5) setBoth('a2', true); if (T >= 1.0) setBoth('a3', true);
  for (const [n, t0] of [['a1', 0], ['a2', 0.5], ['a3', 1.0]]) if (T >= t0 && (T - dt) < t0) sfx.beep(520 + t0 * 200, 0.2, 0.22);
  if (T >= 1.5 && greenAt == null) {
    greenAt = clock; for (const n of ['a1', 'a2', 'a3']) setBoth(n, false); setBoth('green', true); sfx.beep(1040, 0.5, 0.3);
    if (!foul) fetch(API + '/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.json()).then(j => { if (j.ok) token = j.token; }).catch(() => {});
    tip('');
  }
}
function playerAction() {
  if (state === 'stage' || state === 'tree') {
    if (P.sim.launched) return;
    if (state === 'stage' && stageT < 1.5) return; // still rolling up to the line
    if (greenAt == null) return falseStart();
    rt = clock - greenAt; const q = P.sim.launch(); P.launchClock = clock; state = state === 'tree' ? 'tree' : state; tip('');
    $('hRt').textContent = rt.toFixed(3);
    const msg = { perfect: 'PERFECT LAUNCH', good: 'GOOD LAUNCH', spin: 'WHEELSPIN!', bog: 'BOGGED DOWN' }[q];
    toast(msg, q === 'perfect' ? 'perfect' : q === 'good' ? 'good' : 'bad'); sfx.thud(0.7);
    if (q === 'spin') smokeBurst(P, 22);
    $('tAct').textContent = 'SHIFT';
    state = 'run';
  } else if (state === 'run') {
    const q = P.sim.shift(); if (!q) return; sfx.shift();
    toast({ perfect: 'PERFECT SHIFT', good: 'GOOD SHIFT', early: 'EARLY SHIFT', late: 'LATE · LIMITER' }[q], q === 'perfect' ? 'perfect' : q === 'good' ? 'good' : 'bad');
    if (q === 'perfect') flame(P);
    if (P.sim.gear >= 4) $('tAct').textContent = 'FULL SEND';
  }
}
function falseStart() {
  foul = 'red'; setLamp('left', 'red', true); setBoth('a1', false); setBoth('a2', false); setBoth('a3', false); P.sim.launched = false;
  sfx.beep(180, 0.9, 0.35); toast('FALSE START · RED LIGHT', 'bad'); tip(''); state = 'run'; // opponent still runs so you can watch
  $('hRt').textContent = 'RED';
}
function aiLogic() {
  if (greenAt == null || O.sim.launched || clock < greenAt + O.ai.rt) return;
  O.sim.rpm = O.ai.launchX * O.sim.S.redline; O.sim.launch(); O.launchClock = clock; if (O.sim.launchQ === 'spin') smokeBurst(O, 14);
}
function aiShift() { const s = O.sim; if (!s.launched || s.gear >= 4) return; const need = O.ai.shiftX[s.gear - 1]; if (s.vRpm() / s.S.redline >= need) { s.shift(); } }

// ---------- particles ----------
const rnd = (a, b) => a + Math.random() * (b - a);
function smokeBurst(c, n) { for (let i = 0; i < n; i++) for (const sx of [-1, 1]) particles.emit(c.lane + sx * 0.7 + rnd(-0.2, 0.2), 0.25, c.view.root.position.z - c.M.wheelbase / 2, rnd(-1, 1), rnd(0.3, 1.4), rnd(-2, 0.5), rnd(0.8, 1.7), rnd(0.8, 1.4), rnd(2, 4), 0.55, 0.9, 0.9, 0.9); }
function flame(c) { for (let i = 0; i < 8; i++) particles.emit(c.lane + rnd(-0.3, 0.3), 0.35, c.view.root.position.z - c.M.len / 2 - 0.1, rnd(-0.3, 0.3), rnd(0, 0.4), rnd(-4, -1), 0.25, 0.5, 0.8, 0.9, 1, 0.55, 0.1); }

// ---------- sim step ----------
function simStep(dt) {
  clock += dt;
  if (state === 'stage') {
    stageT += dt; const k = Math.min(1, stageT / 1.5), e = 1 - (1 - k) * (1 - k);
    P.vis = O.vis = -4 * (1 - e);
    if (k >= 1 && !(lampState.left.pre)) { setBoth('pre', true); sfx.beep(660, 0.12, 0.2); }
    if (stageT >= 1.5 && !(lampState.left.stage)) { setBoth('stage', true); sfx.beep(660, 0.12, 0.2); tip('Hold GAS to rev · launch on GREEN · too soon = red light'); state = 'tree'; treeT = 0; }
  }
  if (state === 'tree' || state === 'stage') { /* handled below */ }
  if (state === 'tree' || (state === 'run' && foul && greenAt == null)) treeLogic(dt);
  // the player's engine before launch
  if (!P.sim.launched) P.sim.rev(dt, keys.gas && !foul); else P.sim.step(dt);
  if (state === 'tree' || state === 'run') { if (O) { if (!O.sim.launched && O.ai) { const target = clock > (greenAt ?? 1e9) - 0.6 ? O.ai.launchX * O.sim.S.redline : IDLE; O.sim.rpm += (target - O.sim.rpm) * Math.min(1, dt * 6); O.sim.clock += dt; } aiLogic(); aiShift(); if (O.sim.launched) O.sim.step(dt); } }
  // visuals tied to sim
  if (P.sim.launched && !P.sim.finished && P.sim.v > 0.5) { if (P.sim.spin > 0 && Math.random() < 0.9) smokeBurst(P, 1); }
  if (O && O.sim.launched && O.sim.spin > 0 && Math.random() < 0.5) smokeBurst(O, 1);
  // results
  if (state === 'run') {
    if (P.sim.finished || (foul && O.sim.finished)) { if (firstFinishAt == null) firstFinishAt = clock; }
    if (O.sim.finished && firstFinishAt == null) firstFinishAt = clock;
    const bothDone = (P.sim.finished || foul) && O.sim.finished;
    if (firstFinishAt != null && ((bothDone && clock - firstFinishAt > 1.6) || clock - firstFinishAt > 4.5 || (foul && clock - firstFinishAt > 1.8))) showSlip();
  }
}
let acc = 0;
function animateCars(dtv) {
  for (const c of [P, O]) { if (!c) continue;
    const slip = c.sim.spin > 0 ? 2.6 : 1; c.spinAng = c.sim.v / 0.34 * dtv * slip;
    for (const w of c.view.wheels) w.spin.rotation.x += c.spinAng; placeCar(c); }
  particles.update(dtv, 520 * (renderer.getPixelRatio()));
}
function stepFor(dt) { acc += Math.min(dt, 0.1); while (acc >= DT) { simStep(DT); acc -= DT; } }

// ---------- results ----------
function f3(x) { return x == null || !isFinite(x) ? '--' : x.toFixed(3); }
function loadStore() { try { return JSON.parse(ls.get(LS_KEY)) || { best: {}, runs: [] }; } catch { return { best: {}, runs: [] }; } }
function saveStore(s) { ls.set(LS_KEY, JSON.stringify(s)); }
function myNick() { return ls.get('vwfest_nick') || ''; }
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function showSlip() {
  state = 'slip'; setPlaying(false); tip('');
  const ps = P.sim, os = O.sim, rows = [];
  const row = (n, a, b) => rows.push(`<tr><td>${n}</td><td>${a}</td><td>${b}</td></tr>`);
  const pAbs = ps.finished && !foul ? (P.launchClock - greenAt) + ps.finT : Infinity, oAbs = os.finished ? (O.launchClock - greenAt) + os.finT : Infinity;
  const won = !foul && pAbs < oAbs;
  let head, sub, valid = false;
  if (foul) { head = '🔴 FALSE START'; sub = 'You left before the green. Disqualified.'; $('sEt').textContent = 'RED LIGHT'; }
  else { head = won ? '🏆 YOU WIN!' : 'Opponent wins'; const margin = isFinite(oAbs) ? Math.abs(oAbs - pAbs) : null; sub = margin != null ? (won ? 'by ' : 'by ') + margin.toFixed(3) + ' s' : ''; $('sEt').textContent = f3(ps.et); valid = ps.et != null; }
  $('sHead').textContent = head; $('sSub').textContent = sub;
  rows.push('<tr><th></th><th>YOU</th><th>RIVAL</th></tr>');
  row('Car', esc(MODELS[myModel].name), esc(MODELS[O.model].name));
  row('Reaction', foul ? 'RED' : f3(rt), f3(O.ai.rt));
  row("60'", f3(ps.marks.ft60?.et), f3(os.marks.ft60?.et));
  row('1/8 mi', f3(ps.marks.e8?.et) + ' @ ' + (ps.marks.e8 ? ps.marks.e8.mph.toFixed(1) : '--'), f3(os.marks.e8?.et) + ' @ ' + (os.marks.e8 ? os.marks.e8.mph.toFixed(1) : '--'));
  row('1/4 mi ET', f3(ps.et), f3(os.et));
  row('Trap mph', ps.trap ? ps.trap.toFixed(1) : '--', os.trap ? os.trap.toFixed(1) : '--');
  row('Launch', ps.launchQ || '--', os.launchQ || '--');
  row('Shifts', ps.shifts.join(' · ') || '--', os.shifts.join(' · ') || '--');
  $('sTable').innerHTML = rows.join('');
  let pb = '';
  if (valid) {
    const st = loadStore(), prev = st.best[myModel] ?? Infinity, any = Math.min(...Object.values(st.best), Infinity);
    st.runs.unshift({ et: ps.et, rt, trap: ps.trap, car: myModel, at: Date.now(), won, nick: myNick() }); st.runs = st.runs.slice(0, 12);
    const newPB = ps.et < prev; if (newPB) st.best[myModel] = ps.et; saveStore(st);
    pb = ps.et < any ? '🏁 New overall personal best!' : newPB ? `🏁 New best in the ${MODELS[myModel].name}!` : 'Best in this car: ' + f3(prev) + ' s';
    renderLocal(); updateHud();
  }
  $('sPB').textContent = pb; $('nick').value = myNick();
  lastResult = valid ? { et: ps.et, rt, trap: ps.trap } : null;
  $('fSubmit').classList.toggle('hidden', !(valid && token)); $('bSubmit').disabled = false;
  if (valid && !token) $('sMsg').textContent = 'Leaderboard offline: time saved on this device.';
  show('cardSlip');
  sfx.stopEngine(); if (won) { sfx.beep(660, 0.12); setTimeout(() => sfx.beep(990, 0.3), 140); }
}
$('fSubmit').onsubmit = e => {
  e.preventDefault(); if (!lastResult || !token) return; const nick = $('nick').value.trim(); $('bSubmit').disabled = true; ls.set('vwfest_nick', nick);
  fetch(API + '/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, nickname: nick, score: Math.round(lastResult.et * 1000), rt_ms: Math.round(lastResult.rt * 1000), trap: Math.round(lastResult.trap * 10) / 10, car: myModel }) })
    .then(r => r.json()).then(j => {
      if (j.ok) { token = null; $('fSubmit').classList.add('hidden'); $('sMsg').className = 'msg ok'; $('sMsg').textContent = 'Posted! You are #' + j.rank + ' on the quarter-mile board.'; renderGlobal(j.top, nick); }
      else { $('sMsg').textContent = j.error || 'Could not post.'; $('bSubmit').disabled = false; }
    }).catch(() => { $('sMsg').textContent = 'Network hiccup. Try again.'; $('bSubmit').disabled = false; });
};
$('bStart').onclick = startStaging; $('bAgain').onclick = startStaging;
$('bGarage').onclick = () => { state = 'menu'; clearTree(); buildPlayer(); if (O) { scene.remove(O.view.root); O = null; } show('cardMenu'); setPlaying(false); sfx.stopEngine(); updateHud(); };
$('bClear').onclick = () => { ls.set(LS_KEY, JSON.stringify({ best: {}, runs: [] })); renderLocal(); updateHud(); };

// ---------- boards ----------
function renderLocal() { const st = loadStore(); $('local').innerHTML = st.runs.length ? st.runs.map(x => `<li>${esc(MODELS[x.car]?.name || '')} · ${new Date(x.at).toLocaleDateString()}<span>${f3(x.et)}</span></li>`).join('') : '<li class="muted">No runs yet. Stage up!</li>'; }
function renderGlobal(top, me) {
  const row = r => `<li class="${r.nickname === me ? 'me' : ''}">${esc(r.nickname)}<span>${(r.score / 1000).toFixed(3)}</span></li>`, none = '<li class="muted">No times yet. Be first.</li>';
  document.querySelectorAll('.miniTop').forEach(o => o.innerHTML = top && top.length ? top.slice(0, 3).map(row).join('') : none); $('global').innerHTML = top && top.length ? top.map(row).join('') : none;
}
function loadGlobal() { fetch(API + '/top').then(r => r.json()).then(j => renderGlobal(j.top, myNick())).catch(() => { $('global').innerHTML = '<li class="muted">Leaderboard unavailable.</li>'; document.querySelectorAll('.miniTop').forEach(o => o.innerHTML = '<li class="muted">Leaderboard unavailable.</li>'); }); }

// ---------- HUD + gauge ----------
const tach = $('tach'), tg = tach.getContext('2d');
function updateHud() {
  const st = loadStore(), b = st.best[myModel]; $('hBest').textContent = b ? f3(b) : '--'; $('hBestCar').textContent = '· ' + MODELS[myModel].name;
  if (P) { const s = P.sim; if (s.launched && !s.finished || state === 'run') { $('hMph').textContent = Math.round(s.v * MPH); } else if (s.finished) $('hMph').textContent = Math.round(s.trap || 0); else $('hMph').textContent = '0';
    if (s.launched && s.etT != null) $('hEt').textContent = s.finished ? f3(s.et) : f3(Math.max(0, s.t - s.etT)); }
}
function drawTach() {
  const W = tach.width, H = tach.height; tg.clearRect(0, 0, W, H); if (!P) return;
  const s = P.sim, R = s.S.redline, cx = W / 2, cy = H - 20, rad = 130, a0 = Math.PI * 1.08, a1 = Math.PI * 1.92, ang = f => a0 + (a1 - a0) * f;
  tg.fillStyle = 'rgba(18,17,16,.78)'; tg.beginPath(); tg.arc(cx, cy, rad + 14, Math.PI, 2 * Math.PI); tg.lineTo(cx + rad + 14, H); tg.lineTo(cx - rad - 14, H); tg.fill(); tg.strokeStyle = '#2c2925'; tg.lineWidth = 2; tg.stroke();
  const arc = (f0, f1, col, w) => { tg.strokeStyle = col; tg.lineWidth = w; tg.beginPath(); tg.arc(cx, cy, rad - 6, ang(f0), ang(f1)); tg.stroke(); };
  const inLaunch = !s.launched; const pre = inLaunch && (state === 'stage' || state === 'tree');
  arc(0, 1, '#2c2925', 14);
  if (pre) arc(LAUNCH_GREEN[0], LAUNCH_GREEN[1], '#2dff6a', 14); else { arc(SHIFT_GOOD[0], SHIFT_PERFECT[0], '#ffd24a', 14); arc(SHIFT_PERFECT[0], 1, '#2dff6a', 14); }
  tg.fillStyle = '#A89F93'; tg.font = '600 15px system-ui'; tg.textAlign = 'center';
  for (let k = 0; k <= 6; k++) { const f = k / 6.6, a = ang(f), tx = cx + Math.cos(a) * (rad - 30), ty = cy + Math.sin(a) * (rad - 30) + 5; tg.fillText(String(k), tx, ty); }
  const x = clamp(s.rpm / (R * 1.0), 0, 1.02), a = ang(Math.min(1, x));
  tg.strokeStyle = '#ff3b22'; tg.lineWidth = 4; tg.lineCap = 'round'; tg.beginPath(); tg.moveTo(cx, cy); tg.lineTo(cx + Math.cos(a) * (rad - 12), cy + Math.sin(a) * (rad - 12)); tg.stroke();
  tg.fillStyle = '#F3E6C8'; tg.beginPath(); tg.arc(cx, cy, 8, 0, 7); tg.fill();
  tg.font = '800 44px ui-monospace,Menlo,monospace'; tg.fillText(s.launched ? String(s.gear) : 'N', cx, cy - 36); tg.font = '600 13px system-ui'; tg.fillStyle = '#A89F93'; tg.fillText('x1000 rpm', cx, cy - 74);
  const lamp = s.launched && !s.finished && s.gear < 4 && s.cut <= 0 && s.vRpm() / R >= SHIFT_PERFECT[0] - 0.01; $('shiftLamp').classList.toggle('on', lamp);
}

// ---------- camera ----------
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(); let camInit = false, shake = 0;
function updateCamera(dt) {
  const c = P; if (!c) return; const front = c.sim.z + c.vis, v = c.sim.v, fin = c.sim.finished;
  const cx = c.lane * 0.55, back = 6.8 + Math.min(1.4, v * 0.03), h = 2.25 + Math.min(0.5, v * 0.01);
  const tx = cx, ty = h, tz = front - back - c.M.len * 0.1; if (!camInit) { camPos.set(tx, ty, tz); camInit = true; } else { camPos.x += (tx - camPos.x) * Math.min(1, dt * 4); camPos.y += (ty - camPos.y) * Math.min(1, dt * 4); camPos.z = tz; }
  shake = Math.max(0, shake - dt * 3); if (c.sim.launched && c.sim.t < 0.5 && c.sim.launchQ !== 'bog') shake = Math.max(shake, 0.5 * (1 - c.sim.t * 2)); const sk = (shake + (c.sim.spin > 0 ? 0.2 : 0) + v * 0.0012) * 0.05;
  camera.position.set(camPos.x + (Math.random() - .5) * sk, camPos.y + (Math.random() - .5) * sk, camPos.z); camLook.set(c.lane * 0.85, 1.0, front + 18 + v * 0.1); camera.lookAt(camLook);
  const targetFov = camera.userData.base + clamp(v * 0.28, 0, 15); camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 3); camera.updateProjectionMatrix();
  if (world.sun) { world.sun.position.set(camPos.x - 40, 80, front + 30); world.sun.target.position.set(camPos.x, 0, front + 10); world.sun.target.updateMatrixWorld(); }
}

// ---------- input ----------
const actKeys = new Set(['Space', 'Enter', 'ShiftLeft', 'ShiftRight', 'KeyE', 'ArrowRight']), gasKeys = new Set(['ArrowUp', 'KeyW']);
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (gasKeys.has(e.code)) { keys.gas = true; if (state !== 'menu' && state !== 'slip') e.preventDefault(); sfx.init(); }
  else if (actKeys.has(e.code) && !e.repeat) { if (state === 'stage' || state === 'tree' || state === 'run') { e.preventDefault(); playerAction(); } }
  else if (e.code === 'KeyM') $('bMute').click();
});
addEventListener('keyup', e => { if (gasKeys.has(e.code)) keys.gas = false; });
const hold = (el, on, off) => { el.addEventListener('pointerdown', e => { e.preventDefault(); el.setPointerCapture?.(e.pointerId); on(); }); ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => el.addEventListener(ev, () => off())); el.addEventListener('contextmenu', e => e.preventDefault()); };
hold($('tGas'), () => { keys.gas = true; $('tGas').classList.add('on'); sfx.init(); }, () => { keys.gas = false; $('tGas').classList.remove('on'); });
hold($('tAct'), () => playerAction(), () => {});
const syncMute = () => { $('bMute').textContent = sfx.muted ? '🔇' : '🔊'; };
$('bMute').onclick = () => { sfx.setMuted(!sfx.muted); syncMute(); }; syncMute();
document.addEventListener('visibilitychange', () => { if (document.hidden) { sfx.stopEngine(); keys.gas = false; } });

// ---------- frame loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (!manual) tickReal(dt);
  render(dt); requestAnimationFrame(frame);
}
function tickReal(dt) { stepFor(dt); }
function render(dt) {
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').className = ''; }
  if (P) { const s = P.sim; if (sfx.ok) sfx.update({ rpm: s.rpm, throttle: state === 'run' && s.launched && !s.finished ? 1 : keys.gas ? 1 : 0.05, speed: s.v, slip: s.spin > 0 ? 0.9 : 0, off: false, running: state !== 'slip' && state !== 'menu' }); }
  animateCars(dt); updateCamera(dt); updateHud(); drawTach(); renderer.render(scene, camera);
}

// ---------- boot ----------
renderGarage(); renderLocal(); buildPlayer(); show('cardMenu'); loadGlobal(); resize();
requestAnimationFrame(frame);
window.__drag = { get state() { return state; }, get P() { return P; }, get O() { return O; }, keys, clock: () => clock, treeT: () => treeT, greenAt: () => greenAt, get foul() { return foul; }, get rt() { return rt; }, get token() { return token; },
  step(n, dt = 1 / 60) { for (let i = 0; i < n; i++) { stepFor(dt); } render(dt); }, action: playerAction, lampState, SPEC, QM };
