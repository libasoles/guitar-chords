'use strict';
/* chrome-path.js — Resuelve el ejecutable de Chromium para Playwright y
   Lighthouse sin descargar nada.

   Orden: $CHROME_PATH, el navegador que trae la version instalada de
   Playwright (si ya fue descargado con `npx playwright install`), y por
   ultimo cualquier Chromium preinstalado en $PLAYWRIGHT_BROWSERS_PATH o
   /opt/pw-browsers (los sandboxes de agentes traen uno, pero de otra version
   y sin acceso a la CDN de Playwright). Devuelve undefined si no encuentra
   ninguno, para que Playwright use su default y falle con su mensaje. */

const fs = require('fs');
const path = require('path');

const PREINSTALLED_BINARIES = [
  'chrome-linux64/chrome',
  'chrome-linux/chrome',
  'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
];

function exists(file) {
  try { return fs.statSync(file).isFile(); } catch (_) { return false; }
}

function playwrightChromium() {
  try {
    const file = require('playwright').chromium.executablePath();
    return exists(file) ? file : undefined;
  } catch (_) {
    return undefined;
  }
}

function preinstalledChromium() {
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, '/opt/pw-browsers'].filter(Boolean);
  for (const root of roots) {
    let dirs;
    try { dirs = fs.readdirSync(root); } catch (_) { continue; }
    const builds = dirs
      .filter((d) => /^chromium-\d+$/.test(d))
      .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
    for (const build of builds) {
      for (const bin of PREINSTALLED_BINARIES) {
        const file = path.join(root, build, bin);
        if (exists(file)) return file;
      }
    }
  }
  return undefined;
}

function chromePath() {
  if (process.env.CHROME_PATH && exists(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  return playwrightChromium() || preinstalledChromium();
}

module.exports = { chromePath };
