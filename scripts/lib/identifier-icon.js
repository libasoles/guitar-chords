'use strict';

const fs = require('fs');
const path = require('path');

// Pre-rendered from src/extensions/identifier/icon.svg with rsvg-convert at each
// packaged size, for builds where rsvg is unavailable.
function drawIdentifierIcon(size, outFile) {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.copyFileSync(path.join(__dirname, '../../src/extensions/identifier/icons', 'icon-' + size + '.png'), outFile);
}

module.exports = { drawIdentifierIcon };
