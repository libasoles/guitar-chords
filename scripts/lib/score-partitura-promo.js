// Static notation for the link to the full Partitura editor. Keep explicit voices
// and onsets: simultaneous notes belong to two independent melodic lines.
const { createRequire } = require('node:module');
const M = require('../../src/site/score-model');
const selection = require('../partitura-promo-example.json');
const COLORS = { 1: '#ad4d33', 2: '#bd913b' };

async function renderPartituraPromo() {
  // Initialize the shared editor's Verovio runtime before creating a toolkit.
  const { renderEmptyStaff } = await import('partitura/staff');
  await renderEmptyStaff();
  const verovio = createRequire(require.resolve('partitura/staff'))('verovio');
  const toolkit = new verovio.toolkit();
  const score = { meter: selection.meter, fifths: selection.fifths, clef: 'guitar', rows: [selection.measures] };
  const xml = M.toMusicXml(score).replace(/<note id="([^"]+)">([\s\S]*?)<\/note>/g, (_, id, body) => {
    const voice = body.match(/<voice>(\d+)<\/voice>/)[1];
    const color = COLORS[voice];
    return `<note id="${id}" color="${color}">${body.replace(/<tied /g, `<tied color="${color}" `)}</note>`;
  });
  try {
    toolkit.setOptions({
      scale: 60, pageWidth: 1567, adjustPageHeight: true,
      breaks: 'none', header: 'none', footer: 'none', svgViewBox: true,
      pageMarginLeft: 20, pageMarginRight: 20, pageMarginTop: 40,
      pageMarginBottom: 40, minLastJustification: 0, mnumInterval: 0,
    });
    toolkit.loadData(xml);
    // Beams are siblings of notes; color their entire voice layer as well.
    let svg = toolkit.renderToSVG(1).replace(/<g ([^>]*class="layer"[^>]*)>(?=[\s\S]*?<g id="e(\d+)-(\d+)")/g, (_, attrs, mi, i) => {
      const color = COLORS[selection.measures[mi][i].v];
      return `<g ${attrs} color="${color}" fill="${color}">`;
    });
    // The editable score uses the same event IDs. Keep this preview's IDs and
    // glyph references separate so both SVGs can safely coexist on the page.
    const rootId = svg.match(/<svg[^>]* id="([^"]+)"/)[1];
    svg = svg.replace(/(id="|href="#)([^"]+)"/g, '$1promo-$2"');
    return svg.replaceAll('#' + rootId, '#promo-' + rootId);
  } finally {
    toolkit.destroy();
  }
}
module.exports = { renderPartituraPromo };
