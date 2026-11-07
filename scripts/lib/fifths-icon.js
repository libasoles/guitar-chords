'use strict';

const fs = require('fs');
const path = require('path');

// Pre-rendered from src/extensions/fifths/icon.svg with rsvg-convert at each
// packaged size, for builds where rsvg is unavailable.
function drawFifthsIcon(size, outFile) {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.copyFileSync(path.join(__dirname, '../../src/extensions/fifths/icons', 'icon-' + size + '.png'), outFile);
}

module.exports = { drawFifthsIcon };
