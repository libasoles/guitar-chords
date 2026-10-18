'use strict';

const fs = require('fs');
const path = require('path');

// Pre-rendered from src/extensions/tabs/icon.svg with rsvg-convert at each
// packaged size. Keep the actual artwork and alpha when rsvg is unavailable.
function drawTabIcon(size, outFile) {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.copyFileSync(path.join(__dirname, '../../src/extensions/tabs/icons', 'icon-' + size + '.png'), outFile);
}

module.exports = { drawTabIcon };
