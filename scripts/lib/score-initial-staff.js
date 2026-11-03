'use strict';
// This runs only during the build. The published page needs no Node/server.
const M = require('../../src/site/score-model');
let cached;
function renderEmptyStaff() {
  if (cached) return cached;
  cached = new Promise((resolve, reject) => {
    const verovio = require('../../vendor/verovio-toolkit-wasm');
    const render = () => {
      let toolkit;
      try { toolkit = new verovio.toolkit(); } catch (_) { return false; }
      try {
        toolkit.setOptions({
          scale: 60, pageWidth: Math.round(940 * 100 / 60),
          adjustPageHeight: true, breaks: 'encoded', header: 'none', footer: 'none',
          svgViewBox: true, pageMarginLeft: 60, pageMarginRight: 60,
          pageMarginTop: 60, pageMarginBottom: 60, spacingSystem: 12,
          minLastJustification: 0, justifyVertically: false, mnumInterval: 0,
        });
        toolkit.loadData(M.toMusicXml(M.emptyScore()));
        resolve(toolkit.renderToSVG(1));
      } catch (error) { reject(error); }
      finally { toolkit.destroy(); }
      return true;
    };
    if (!render()) verovio.module.onRuntimeInitialized = render;
  });
  return cached;
}
module.exports = { renderEmptyStaff };
