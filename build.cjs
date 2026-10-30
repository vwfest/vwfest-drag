// Bundles src/main.js + three.js (tree-shaken, local — no CDN) into game.js. Run: npm run build
require('esbuild').build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', target: 'es2020', outfile: 'game.js', legalComments: 'none', logLevel: 'info' }).catch(() => process.exit(1));
