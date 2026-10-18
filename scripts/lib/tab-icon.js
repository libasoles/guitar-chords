'use strict';

const { writePng } = require('./icon-png');

// A horizontal tablature, including fret digits, also on machines without rsvg.
function drawTabIcon(size, outFile) {
  const rgba = Buffer.alloc(size * size * 4);
  const segments = [
    [37, 36, 49, 36], [49, 36, 42, 52],
    [79, 64, 91, 64], [91, 64, 91, 72], [91, 72, 79, 72],
    [79, 72, 79, 80], [79, 80, 91, 80],
  ];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = (x + 0.5) * 128 / size;
      const py = (y + 0.5) * 128 / size;
      let color = [253, 250, 245, 255];
      if (px >= 16 && px <= 112 && [29, 43, 57, 71, 85, 99].some(line => Math.abs(py - line) < 1.5)) color = [74, 124, 147, 255];
      if ((px > 31 && px < 54 && py > 32 && py < 56) || (px > 73 && px < 96 && py > 60 && py < 84)) color = [253, 250, 245, 255];
      for (const [x1, y1, x2, y2] of segments) {
        const t = Math.max(0, Math.min(1, ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / ((x2 - x1) ** 2 + (y2 - y1) ** 2)));
        if (Math.hypot(px - x1 - t * (x2 - x1), py - y1 - t * (y2 - y1)) <= 3) color = [139, 0, 0, 255];
      }
      rgba.set(color, (y * size + x) * 4);
    }
  }
  writePng(outFile, size, size, rgba);
}

module.exports = { drawTabIcon };
