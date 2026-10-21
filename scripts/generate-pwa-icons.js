#!/usr/bin/env node
'use strict';
// Run after changing the site logo. Deployment uses these committed PNGs so
// the install icon is identical even when no SVG renderer is installed.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const site = path.join(__dirname, '..', 'src', 'site');
const output = path.join(site, 'icons');
// librsvg does not reliably load a nested external SVG. Inline its vector
// content before rendering, keeping the safe-area geometry from the wrapper.
const source = fs.readFileSync(path.join(site, 'icon-maskable.svg'), 'utf8')
  .replace(/<image href="([^"]+)"([^>]*)\/>/g, (_, file, placement) => {
    const logo = fs.readFileSync(path.join(site, file), 'utf8')
      .replace(/<\?xml[^>]*\?>/, '');
    return logo.replace('<svg ', '<svg ' + placement + ' ');
  });
fs.mkdirSync(output, { recursive: true });
for (const size of [192, 512]) {
  execFileSync('rsvg-convert', [
    '-w', String(size), '-h', String(size),
    '-o', path.join(output, `icon-${size}.png`),
  ], { input: source, stdio: ['pipe', 'inherit', 'inherit'] });
}
