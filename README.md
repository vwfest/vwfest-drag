# $VWFEST Drag Strip

A free 3D **quarter-mile drag racing** game for the $VWFEST community. Runs entirely in the browser (desktop and phone), no downloads, no accounts.

**Play:** https://vwfest.github.io/vwfest-drag/  ·  Part of the **Arcade Room:** https://vwfest.github.io/vwfest-arcade/

## How to play
1. Pick a VW (Beetle, Bus, Karmann Ghia, Thing), a paint colour and a rival (Easy / Medium / Hard), then **Stage up**.
2. **Hold GAS** (`W` / `↑`, or the GAS pad) to rev the engine. Keep the needle in the **green launch zone**.
3. Three ambers flash, then **GREEN**. Press **LAUNCH** (`Space`) as fast as you can. Leave early and it is a **red-light false start** (disqualified).
4. Press **SHIFT** (`Space`) as the needle hits the green band at the top of the tach: **PERFECT SHIFT** gives a tiny power boost, early shifts and the rev limiter cost you time. Four-speed manual.
5. The time slip shows **reaction time, 60 ft, 1/8 mile, 1/4 mile ET and trap speed (mph)** for you and the rival. Personal bests are saved on your device.

Optionally post your ET to the shared nickname-only leaderboard (no account). Time slips are validated server-side (signed single-use run token, plausibility limits, rate limit).

## Tech
Three.js (bundled into `game.js`, no CDN), Web Audio synthesised engine/tree/shift sounds, custom drag physics (`src/drag.js`: torque curve, clutch-launch quality, shift windows, rev limiter, traction). A strict Content-Security-Policy is set in `index.html`.

```
npm install
npm run build        # bundles src/main.js + three.js into game.js
npm run serve        # http://localhost:8098
npm test             # headless Playwright: desktop + mobile (needs the server running)
```
