'use strict';
/* icon-png.js — Renderiza el logo (diapason con dos puntos) a PNG sin
   dependencias externas. Se usa como fallback cuando rsvg-convert no esta
   disponible (p. ej. en el runner de GitHub Actions que despliega el sitio).

   El dibujo es a sangre completa sobre fondo papel y con el logo dentro del
   ~66% central, por lo que sirve tanto para iconos "any" como "maskable".
   Portado desde scripts/build-ext.js (drawIcon/writePng). */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }

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

module.exports = { drawIcon, writePng };
