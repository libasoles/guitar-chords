'use strict';
/* minify-assets.js — Minifies the .js and .css files under dist/site/assets in
   place with esbuild. Runs before fingerprinting, so the content hash covers
   the minified bytes. Files that already ship minified (*.min.js) are skipped,
   and so is Verovio (7 MB with its WASM embedded: minifying it takes minutes).
   Returns { files, before, after } byte totals for logging. */

const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const LOADERS = { '.js': 'js', '.css': 'css' };

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

function minifyAssets(assetsDir) {
  let files = 0;
  let before = 0;
  let after = 0;
  walk(assetsDir).forEach((file) => {
    const loader = LOADERS[path.extname(file)];
    if (!loader || /\.min\.(js|css)$|verovio-toolkit-wasm\.js$/.test(file)) return;
    const source = fs.readFileSync(file, 'utf8');
    const out = esbuild.transformSync(source, { loader, minify: true, legalComments: 'none', sourcefile: file }).code;
    fs.writeFileSync(file, out, 'utf8');
    files += 1;
    before += Buffer.byteLength(source);
    after += Buffer.byteLength(out);
  });
  return { files, before, after };
}

module.exports = { minifyAssets };
