'use strict';
/* site-css.js — The site stylesheet lives as ordered parts in src/site/css/
   (one per section, numbered in cascade order). The build concatenates all of
   them into assets/site.css for every page. */

const fs = require('fs');
const path = require('path');

const CSS_DIR = path.join(__dirname, '..', '..', 'src', 'site', 'css');

function partNames() {
  return [...fs.readdirSync(CSS_DIR).filter((f) => f.endsWith('.css')).map((f) => f.slice(0, -4)), '07b-tab-demo'].sort();
}

function readParts(names) {
  const shared = path.join(__dirname, '..', '..', 'src', 'shared');
  return names.map((name) => {
    if (name === '07b-tab-demo') return fs.readFileSync(path.join(shared, 'tab-demo.css'), 'utf8');
    const css = fs.readFileSync(path.join(CSS_DIR, name + '.css'), 'utf8');
    // The fifths wheel styles are shared with the Circle of Fifths extension.
    return name === '07-tab-editor'
      ? fs.readFileSync(path.join(shared, 'tab-editor.css'), 'utf8') + css + fs.readFileSync(path.join(shared, 'fifths-wheel.css'), 'utf8')
      : css;
  }).join('');
}

const readSiteCss = () => readParts(partNames());

module.exports = { readSiteCss, partNames };
