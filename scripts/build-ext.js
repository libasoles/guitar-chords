#!/usr/bin/env node
'use strict';
/* build-ext.js — Assembles the Chrome extension into dist/extension/ and
   packages it as dist/extension.zip.
   Source of truth: src/extension/ + src/shared/ + vendor/.
   Does NOT modify src/ — everything lands in dist/. */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const zlib = require('zlib');

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
  if (!fs.existsSync(src)) return;
  ensureDir(dst);
  fs.readdirSync(src).forEach(function (entry) {
    const s = path.join(src, entry);
    const d = path.join(dst, entry);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else copyFile(s, d);
  });
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function writePng(filePath, width, height, rgba) {
  ensureDir(path.dirname(filePath));
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    rows[rowStart] = 0;
    rgba.copy(rows, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const png = Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(rows)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(filePath, png);
}

function drawIcon(size, outFile) {
  const rgba = Buffer.alloc(size * size * 4, 0);

  function setPixel(x, y, color) {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const idx = (y * size + x) * 4;
    rgba[idx] = color[0];
    rgba[idx + 1] = color[1];
    rgba[idx + 2] = color[2];
    rgba[idx + 3] = color[3];
  }

  function fillRect(x, y, w, h, color) {
    for (let py = y; py < y + h; py += 1) {
      for (let px = x; px < x + w; px += 1) setPixel(px, py, color);
    }
  }

  function strokeRect(x, y, w, h, thickness, color) {
    fillRect(x, y, w, thickness, color);
    fillRect(x, y + h - thickness, w, thickness, color);
    fillRect(x, y, thickness, h, color);
    fillRect(x + w - thickness, y, thickness, h, color);
  }

  function drawLine(x1, y1, x2, y2, thickness, color) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    for (let step = 0; step <= steps; step += 1) {
      const x = Math.round(x1 + (dx * step) / steps);
      const y = Math.round(y1 + (dy * step) / steps);
      fillRect(x - Math.floor(thickness / 2), y - Math.floor(thickness / 2), thickness, thickness, color);
    }
  }

  function fillCircle(cx, cy, radius, color) {
    for (let y = cy - radius; y <= cy + radius; y += 1) {
      for (let x = cx - radius; x <= cx + radius; x += 1) {
        const dx = x - cx;
        const dy = y - cy;
        if ((dx * dx) + (dy * dy) <= radius * radius) setPixel(x, y, color);
      }
    }
  }

  const paper = [253, 250, 245, 255];
  const frame = [216, 210, 196, 255];
  const string = [26, 26, 26, 120];
  const dot = [139, 0, 0, 255];

  fillRect(0, 0, size, size, paper);

  const inset = Math.max(2, Math.round(size * 0.17));
  const boxSize = size - (inset * 2);
  const stroke = Math.max(1, Math.round(size * 0.08));
  strokeRect(inset, inset, boxSize, boxSize, stroke, frame);

  const x1 = inset + Math.round(boxSize * 0.31);
  const x2 = inset + Math.round(boxSize * 0.5);
  const x3 = inset + Math.round(boxSize * 0.69);
  const y1 = inset + Math.round(boxSize * 0.38);
  const y2 = inset + Math.round(boxSize * 0.69);
  const stringStroke = Math.max(1, Math.round(size * 0.04));

  drawLine(x1, inset, x1, inset + boxSize, stringStroke, string);
  drawLine(x2, inset, x2, inset + boxSize, stringStroke, string);
  drawLine(x3, inset, x3, inset + boxSize, stringStroke, string);
  drawLine(inset, y1, inset + boxSize, y1, stringStroke, string);
  drawLine(inset, y2, inset + boxSize, y2, stringStroke, string);

  const radius = Math.max(2, Math.round(size * 0.065));
  fillCircle(x1, inset + Math.round(boxSize * 0.53), radius, dot);
  fillCircle(x3, inset + Math.round(boxSize * 0.22), radius, dot);

  writePng(outFile, size, size, rgba);
}

// ---- validation ------------------------------------------------------------

const SVGUITAR = path.join(SRC_VENDOR, 'svguitar.umd.js');
if (!fs.existsSync(SVGUITAR)) fail('vendor/svguitar.umd.js not found. Run: npm run vendor');
const FUZZYSORT = path.join(SRC_VENDOR, 'fuzzysort.js');
if (!fs.existsSync(FUZZYSORT)) fail('vendor/fuzzysort.js not found. Run: npm run vendor');

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

console.log('==> Copying vendored svguitar and fuzzysort...');
ensureDir(path.join(DIST_EXT, 'vendor'));
copyFile(SVGUITAR, path.join(DIST_EXT, 'vendor', 'svguitar.umd.js'));
copyFile(FUZZYSORT, path.join(DIST_EXT, 'vendor', 'fuzzysort.js'));

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
    say('(rsvg-convert not found — using pre-built PNGs or generated fallbacks)');
    const srcIcons = path.join(SRC_EXT, 'icons');
    if (fs.existsSync(srcIcons)) copyDir(srcIcons, iconsDir);
    [16, 32, 48, 128].forEach(function (size) {
      const out = path.join(iconsDir, 'icon-' + size + '.png');
      if (!fs.existsSync(out)) {
        drawIcon(size, out);
        say('generated icon-' + size + '.png');
      }
    });
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
