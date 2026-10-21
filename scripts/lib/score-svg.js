'use strict';
/* score-svg.js — Vistas previas de partitura en linea, compartidas por las paginas de Carcassi.
   Cada vista previa lleva su propio <defs> (clave, cabezas, alteraciones), metadatos y estilos de Verovio: con
   16 tarjetas la pagina pesaba 620 KB. Se quitan los metadatos y los estilos (las reglas que hacen falta
   estan en 11-articles.css) y los glifos, identicos entre previews, se declaran una sola vez en la pagina. */

const GLYPH_SUFFIX = /(E[0-9A-F]{3,4})-[a-z0-9]{6,9}/g;

/* Verovio's textual directions inherit bold/italic styles and may contain their
   own font attributes. Normalize the text itself before slimming previews or
   publishing standalone SVGs, so both use the same engraving-unit size. */
function normalizeScoreDirections(svg) {
  return svg.replace(/<g\b[^>]*\bclass="(?:dir|tempo)"[^>]*>[\s\S]*?<\/g>/g, (group) =>
    group.replace(/<(?:text|tspan)\b[^>]*>/g, (tag) => {
      const sized = /\bfont-size="(?!0(?:px)?")[^"]+"/.test(tag);
      return tag
        .replace(/\sfont-(?:family|weight|style)="[^"]*"/g, '')
        .replace(/\bfont-size="(?!0(?:px)?")[^"]+"/g, 'font-size="270px"')
        .replace(/>$/, ' font-family="Georgia, Times New Roman, serif" font-weight="normal" font-style="normal"' +
          (!sized && !/\bfont-size=/.test(tag) && tag.startsWith('<text') ? ' font-size="270px"' : '') + '>');
    }));
}

function escapeAttr(text) {
  return String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function slimScore(svg, sharedGlyphs) {
  return svg
    .replace(GLYPH_SUFFIX, '$1')
    .replace(/<desc>[\s\S]*?<\/desc>/g, '')
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/g, '')
    .replace(/<style\b[\s\S]*?<\/style>/g, '')
    .replace(/<defs>([\s\S]*?)<\/defs>/g, function (_, body) {
      for (const glyph of body.matchAll(/<g id="(E[0-9A-F]{3,4})">[\s\S]*?<\/g>/g)) {
        sharedGlyphs.set(glyph[1], glyph[0].replace(/>\s+</g, '><'));
      }
      return '';
    })
    .replace(/ data-class="[^"]*"/g, '')
    .replace(/ class="(?!(?:fing|tabDurSym|tabRhythm)")[^"]*"/g, '')
    .replace(/ overflow="visible"/g, '')
    .replace(/ id="[a-z0-9]{6,9}"/g, '');
}

/* El SVG de Verovio sin saltos entre etiquetas y sin tamano fijo: se escala al ancho de la tarjeta. */
function inlineScore(svg, alt, sharedGlyphs) {
  return slimScore(normalizeScoreDirections(svg), sharedGlyphs)
    .trim()
    .replace(/>\s+</g, '><')
    .replace(/^<svg\b([^>]*)>/, function (_, attrs) {
      return '<svg class="score-svg"' + attrs + ' role="img" aria-label="' + escapeAttr(alt) + '">';
    });
}

/* El <svg> oculto con los glifos compartidos por todas las vistas previas de la pagina. */
function glyphDefs(sharedGlyphs) {
  return '<svg class="score-glyphs" width="0" height="0" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" ' +
    'xmlns:xlink="http://www.w3.org/1999/xlink"><defs>' + Array.from(sharedGlyphs.values()).join('') + '</defs></svg>';
}

const DOWNLOAD_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
  'stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>';

module.exports = { escapeAttr, inlineScore, glyphDefs, DOWNLOAD_ICON, normalizeScoreDirections };
