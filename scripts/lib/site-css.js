'use strict';
/* site-css.js — The site stylesheet lives as ordered parts in src/site/css/
   (one per section, numbered in cascade order). The build concatenates all of
   them into assets/site.css for every page, and a subset into the page
   stylesheets of tools that do not need the rest (Partitura y tablatura). */

const fs = require('fs');
const path = require('path');

const CSS_DIR = path.join(__dirname, '..', '..', 'src', 'site', 'css');

// Parts the Partitura y tablatura page needs, in cascade order: shared base
// (header, typography), footer, privacy link and the tool's own styles.
const PARTITURA_PARTS = ['01-base', '05-footer', '07b-tab-demo', '08-privacy', '10-partitura'];

function partNames() {
  return [...fs.readdirSync(CSS_DIR).filter((f) => f.endsWith('.css')).map((f) => f.slice(0, -4)), '07b-tab-demo'].sort();
}

function readParts(names) {
  const shared = path.join(__dirname, '..', '..', 'src', 'shared');
  return names.map((name) => {
    if (name === '07b-tab-demo') return fs.readFileSync(path.join(shared, 'tab-demo.css'), 'utf8');
    const css = fs.readFileSync(path.join(CSS_DIR, name + '.css'), 'utf8');
    return name === '07-tab-editor'
      ? fs.readFileSync(path.join(shared, 'tab-editor.css'), 'utf8') + css
      : css;
  }).join('');
}

const readSiteCss = () => readParts(partNames());
const readPartituraCss = () => readParts(PARTITURA_PARTS);

module.exports = { readSiteCss, readPartituraCss, partNames, PARTITURA_PARTS };
