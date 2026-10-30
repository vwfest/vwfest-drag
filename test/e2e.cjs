// Headless Playwright e2e (desktop + mobile). Usage: npm run build && (python3 -m http.server 8098 &) && node test/e2e.cjs
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8098/'; const OUT = path.join(__dirname, '..', 'screenshots'); fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const ok = (c, m) => { console.log((c ? '  PASS ' : '  FAIL ') + m); if (!c) fails++; };
const args = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];
const step = (p, n, dt = 1 / 60) => p.evaluate(([n, dt]) => __drag.step(n, dt), [n, dt]);
const until = async (p, cond, max = 4000, dt = 1 / 60) => { for (let i = 0; i < max; i++) { if (await p.evaluate(cond)) return true; await step(p, 4, dt); } return false; };
async function mockApi(ctx, posted) {
  await ctx.route('https://race.vwfestmemecoin.com/**', async (r) => {
    const u = r.request().url(), m = r.request().method(), h = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };
    if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: { ...h, 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET,POST' } });
    if (u.endsWith('/start')) return r.fulfill({ status: 200, headers: h, body: JSON.stringify({ ok: true, token: 'tok.1.sig' }) });
    if (u.endsWith('/submit')) { posted.push(JSON.parse(r.request().postData())); return r.fulfill({ status: 200, headers: h, body: JSON.stringify({ ok: true, rank: 2, top: [{ nickname: 'DuneDan', score: 12610 }, { nickname: 'BugLife209', score: posted[posted.length - 1].score }] }) }); }
    return r.fulfill({ status: 200, headers: h, body: JSON.stringify({ ok: true, top: [{ nickname: 'DuneDan', score: 12610 }, { nickname: 'CampKate', score: 13040 }, { nickname: 'GhiaGus', score: 13555 }] }) });
  });
}
async function run(b, name, mobile) {
  console.log(`\n== ${name} ==`);
  const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1280, height: 800 } });
  const posted = []; await mockApi(ctx, posted);
  const p = await ctx.newPage(); const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  const resp = await p.goto(BASE + '?manual=1' + (mobile ? '' : '&q=high')); ok(resp.status() === 200, 'page 200');
  await p.waitForFunction(() => window.__drag, null, { timeout: 30000 }); await step(p, 2);
  ok(await p.evaluate(() => __drag.state === 'menu'), 'menu shown'); ok(await p.evaluate(() => document.querySelectorAll('#carChips button').length === 4), '4 VW cars offered');
  ok(await p.evaluate(() => document.querySelectorAll('#swatches button').length === 6), '6 paint colours');
  await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}/${name}-1-menu.png` });
  // pick the Karmann Ghia + red paint
  if (mobile) { await p.tap('#carChips button[data-car=ghia]'); await p.tap('#swatches button:nth-child(2)'); } else { await p.click('#carChips button[data-car=ghia]'); await p.click('#swatches button:nth-child(2)'); }
  ok(await p.evaluate(() => __drag.P.model === 'ghia'), 'Karmann Ghia selected');
  if (mobile) await p.tap('#bStart'); else await p.click('#bStart');
  ok(await p.evaluate(() => __drag.state === 'stage'), 'staging starts');
  // false-start test first: launch before green
  await until(p, () => __drag.state === 'tree' && __drag.treeT() > 0.3, 600); ok(await p.evaluate(() => __drag.greenAt() == null), 'tree running, not green yet');
  await p.evaluate(() => __drag.action()); ok(await p.evaluate(() => __drag.foul === 'red' && __drag.lampState.left.red === true), 'launching before green = false start (red light)');
  await until(p, () => __drag.state === 'slip', 2500); ok(await p.evaluate(() => __drag.state === 'slip'), 'slip card shown after false start');
  ok(await p.evaluate(() => /FALSE START/.test(document.getElementById('sHead').textContent) && document.getElementById('fSubmit').classList.contains('hidden')), 'false start: DQ, no submit form');
  await p.screenshot({ path: `${OUT}/${name}-2-falsestart.png` });
  // proper run
  if (mobile) await p.tap('#bAgain'); else await p.click('#bAgain');
  if (mobile) { await until(p, () => __drag.state === 'tree', 400); const t = await p.evaluate(() => { const b = document.getElementById('tGas').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; }); await p.evaluate(() => { }); const cdp = await ctx.newCDPSession(p); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: t[0], y: t[1], id: 1 }] }); p.cdp = cdp; ok(await p.evaluate(() => __drag.keys.gas === true), 'touch GAS held'); }
  else { await until(p, () => __drag.state === 'tree', 400); await p.keyboard.down('KeyW'); }
  // rev into the launch zone
  await until(p, () => __drag.P.sim.rpm > __drag.P.sim.S.redline * 0.64, 600); 
  ok(await p.evaluate(() => __drag.lampState.left.stage === true && __drag.lampState.left.pre === true), 'pre-stage + stage lights on');
  await p.screenshot({ path: `${OUT}/${name}-3-tree.png` });
  await until(p, () => __drag.greenAt() != null, 800, 1 / 120);
  ok(await p.evaluate(() => __drag.lampState.left.green === true), 'green light shown');
  // reaction ~0.2s then keep rpm in green zone
  await p.evaluate(() => { __drag.keys.gas = false; __drag.P.sim.rpm = __drag.P.sim.S.redline * 0.68; });
  if (!mobile) await p.keyboard.up('KeyW'); await step(p, 12, 1 / 60); await p.evaluate(() => { __drag.P.sim.rpm = __drag.P.sim.S.redline * 0.68; });
  const t0 = await p.evaluate(() => __drag.clock() - __drag.greenAt());
  if (mobile) { const r = await p.evaluate(() => { const b = document.getElementById('tAct').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; }); await p.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.touchscreen.tap(r[0], r[1]); }
  else await p.keyboard.press('Space');
  const info = await p.evaluate(() => ({ rt: __drag.rt, q: __drag.P.sim.launchQ, launched: __drag.P.sim.launched, state: __drag.state }));
  ok(info.launched && info.state === 'run', 'launch on green works'); ok(info.rt > 0.1 && info.rt < 0.4, 'reaction time recorded: ' + (info.rt && info.rt.toFixed(3)));
  ok(info.q === 'perfect', 'launch quality: ' + info.q);
  await step(p, 90, 1 / 60); await p.screenshot({ path: `${OUT}/${name}-4-launch.png` });
  // shifts
  let perfect = 0;
  for (let g = 1; g <= 3; g++) {
    await until(p, () => __drag.P.sim.vRpm() / __drag.P.sim.S.redline >= 0.94, 3000, 1 / 120);
    if (mobile) { const r = await p.evaluate(() => { const b = document.getElementById('tAct').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; }); await p.touchscreen.tap(r[0], r[1]); } else await p.keyboard.press('Space');
    if (g === 1) { await p.screenshot({ path: `${OUT}/${name}-5-shift.png` }); ok(await p.evaluate(() => document.getElementById('toast').textContent === 'PERFECT SHIFT'), 'perfect-shift popup'); }
    if (await p.evaluate(() => __drag.P.sim.lastShift === 'perfect')) perfect++;
    await step(p, 8, 1 / 60);
    if (g === 2) await p.screenshot({ path: `${OUT}/${name}-6-fast.png` });
  }
  ok(perfect === 3, 'three perfect shifts'); ok(await p.evaluate(() => __drag.P.sim.gear === 4), 'in 4th gear');
  await until(p, () => __drag.state === 'slip', 6000, 1 / 60);
  const res = await p.evaluate(() => ({ st: __drag.state, et: __drag.P.sim.et, trap: __drag.P.sim.trap, ot: __drag.O.sim.et, z: __drag.P.sim.z }));
  ok(res.st === 'slip', 'run ends with the time slip'); ok(res.et > 11.5 && res.et < 14, 'ET plausible: ' + res.et?.toFixed(3) + ' s'); ok(res.trap > 90 && res.trap < 115, 'trap speed plausible: ' + res.trap?.toFixed(1) + ' mph');
  ok(res.ot > 11.5 && res.ot < 19, 'AI finished too: ' + res.ot?.toFixed(3));
  ok(await p.evaluate(() => document.querySelectorAll('#sTable tr').length >= 8), 'slip shows RT / 60ft / 1/8 / ET / trap'); ok(await p.evaluate(() => !document.getElementById('fSubmit').classList.contains('hidden')), 'nickname submit form shown (valid run)');
  ok(await p.evaluate(() => JSON.parse(localStorage.getItem('vwfest_drag_v1')).best.ghia > 0), 'best time saved locally');
  await p.screenshot({ path: `${OUT}/${name}-7-slip.png` });
  await p.fill('#nick', 'BugLife209'); if (mobile) await p.tap('#bSubmit'); else await p.click('#bSubmit');
  await p.waitForFunction(() => /Posted/.test(document.getElementById('sMsg').textContent), null, { timeout: 5000 }).catch(() => {});
  ok(posted.length === 1 && posted[0].nickname === 'BugLife209' && posted[0].score > 11000 && posted[0].car === 'ghia', 'score posted with nickname only'); ok(await p.evaluate(() => /Posted/.test(document.getElementById('sMsg').textContent)), 'posted confirmation + rank shown');
  ok(await p.evaluate(() => document.getElementById('local').children.length >= 1), 'garage lists run');
  // XSS: nickname from the server is escaped
  await p.evaluate(() => { document.getElementById('global').innerHTML = ''; });
  await ctx.route('https://race.vwfestmemecoin.com/api/arcade/drag/top', r => r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: JSON.stringify({ ok: true, top: [{ nickname: '<img src=x onerror=window.__xss=1>', score: 12000 }] }) }));
  await p.reload(); await p.waitForFunction(() => window.__drag); await p.waitForTimeout(600);
  ok(await p.evaluate(() => window.__xss === undefined && document.querySelectorAll('#global img').length === 0), 'leaderboard output is HTML-escaped (no XSS)');
  ok(errs.length === 0, 'no console/page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await ctx.close();
}
(async () => { const b = await chromium.launch({ args }); await run(b, 'desktop', false); await run(b, 'mobile', true); await b.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0); })();
