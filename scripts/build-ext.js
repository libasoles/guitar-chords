#!/usr/bin/env node
'use strict';
/* build-ext.js — Assembles the Chrome extension into dist/extension/ and
   packages it as dist/extension.zip.
   Source of truth: src/extension/ + src/shared/ + vendor/.
   Does NOT modify src/ — everything lands in dist/. */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SRC_EXT = path.join(ROOT, 'src', 'extension');
const SRC_SHARED = path.join(ROOT, 'src', 'shared');
const SRC_VENDOR = path.join(ROOT, 'vendor');
const DIST_EXT = path.join(ROOT, 'dist', 'extension');
const DIST_ZIP = path.join(ROOT, 'dist', 'extension.zip');

// ---- helpers ---------------------------------------------------------------

function say(msg) { process.stdout.write('  ' + msg + '\n'); }
function fail(msg) { process.stderr.write('ERROR: ' + msg + '\n'); process.exit(1); }

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }

function copyFile(src, dst) {
  ensureDir(path.dirname(dst));
  fs.copyFileSync(src, dst);
  say(path.relative(ROOT, src) + ' → ' + path.relative(ROOT, dst));
}

function copyDir(src, dst) {
  ensureDir(dst);
  fs.readdirSync(src).forEach(function (entry) {
    const s = path.join(src, entry);
    const d = path.join(dst, entry);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else copyFile(s, d);
  });
}

// ---- validation ------------------------------------------------------------

const SVGUITAR = path.join(SRC_VENDOR, 'svguitar.umd.js');
if (!fs.existsSync(SVGUITAR)) fail('vendor/svguitar.umd.js not found. Run: npm run vendor');

// ---- assemble dist/extension -----------------------------------------------

console.log('==> Cleaning dist/extension...');
fs.rmSync(DIST_EXT, { recursive: true, force: true });
ensureDir(DIST_EXT);

console.log('==> Copying shared sources...');
['chords-db.js', 'chord-diagram.js', 'chord-search.js'].forEach(function (f) {
  copyFile(path.join(SRC_SHARED, f), path.join(DIST_EXT, f));
});

console.log('==> Copying extension sources...');
['manifest.json', 'popup.html', 'popup.js', 'popup.css'].forEach(function (f) {
  copyFile(path.join(SRC_EXT, f), path.join(DIST_EXT, f));
});
copyDir(path.join(SRC_EXT, '_locales'), path.join(DIST_EXT, '_locales'));
copyDir(path.join(SRC_EXT, 'icons'), path.join(DIST_EXT, 'icons'));

console.log('==> Copying vendored svguitar...');
ensureDir(path.join(DIST_EXT, 'vendor'));
copyFile(SVGUITAR, path.join(DIST_EXT, 'vendor', 'svguitar.umd.js'));

// ---- icons (rsvg-convert if available) -------------------------------------

const iconSrc = path.join(SRC_EXT, 'icon-source.svg');
const iconsDir = path.join(DIST_EXT, 'icons');
if (fs.existsSync(iconSrc)) {
  const hasRsvg = (() => {
    try { execSync('rsvg-convert --version', { stdio: 'ignore' }); return true; } catch { return false; }
  })();
  if (hasRsvg) {
    console.log('==> Regenerating icons...');
    ensureDir(iconsDir);
    [16, 32, 48, 128].forEach(function (size) {
      const out = path.join(iconsDir, 'icon-' + size + '.png');
      execSync('rsvg-convert -w ' + size + ' -h ' + size + ' "' + iconSrc + '" -o "' + out + '"');
      say('icon-' + size + '.png');
    });
  } else {
    say('(rsvg-convert not found — skipping icon regeneration, using pre-built PNGs)');
    // Copy pre-built PNGs from src if they exist.
    const srcIcons = path.join(SRC_EXT, 'icons');
    if (fs.existsSync(srcIcons)) copyDir(srcIcons, iconsDir);
  }
}

// ---- package as zip --------------------------------------------------------

console.log('==> Packaging extension.zip...');
if (fs.existsSync(DIST_ZIP)) fs.unlinkSync(DIST_ZIP);
try {
  execSync('cd "' + DIST_EXT + '" && zip -qr "' + DIST_ZIP + '" .', { stdio: 'inherit' });
  say('dist/extension.zip');
} catch {
  say('(zip not available — skipping zip step)');
}

console.log('==> Done. Extension output: dist/extension/  zip: dist/extension.zip');
