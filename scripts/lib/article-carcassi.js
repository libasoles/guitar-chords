'use strict';
/* article-carcassi.js — Cuerpo del articulo «Descomposicion de acordes para
   arpegios en Carcassi». Todo es HTML y SVG estatico generado en el build: la
   partitura y la TAB son los SVG de scripts/articles/carcassi/build.py y los
   diagramas salen de la base de acordes (chord-forms.js). */

const fs = require('fs');
const path = require('path');
const { fullForm, chordFingers, formText, formTab, diagramSvg } = require('./chord-forms');

const ARTICLE_DIR = path.join(__dirname, '..', '..', 'src', 'site', 'articles', 'carcassi');
const ASSETS_URL = '/assets/articles/carcassi/';

const PDFS = {
  allegretto: 'Allegretto in C - Matteo Carcassi · (1792—1853).pdf',
  prelude: 'Prelude A Minor, Op.59 - Matteo Carcassi.pdf',
};

/* Formas descompuestas: salen del propio PDF compas a compas (ver
   scripts/articles/carcassi/build.py). Cuerda 1 primero; null = no suena. */
const DECOMPOSED = {
  C: [0, 1, 0, null, 3, null],
  G7: [1, 0, 0, null, null, 3],
  Am: [0, 1, 2, null, 0, null],
  E7: [0, 3, 1, null, 2, null],
};

/* Descomposicion facil, para comparar con la que usa Carcassi. */
const EASY_DECOMPOSED = {
  E7: [0, 0, 1, null, null, 0],
};

const ALLEGRETTO_CHORDS = ['C', 'G7'];
const PRELUDE_CHORDS = ['Am', 'G7', 'C', 'E7'];

function escapeAttr(text) {
  return String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/* El SVG de Verovio sin saltos entre etiquetas y sin tamano fijo: se escala al
   ancho de la tarjeta con su viewBox. */
function inlineScore(svg, alt) {
  return svg
    .trim()
    .replace(/>\s+</g, '><')
    .replace(/^<svg\b([^>]*)>/, function (_, attrs) {
      const kept = attrs.replace(/\s(?:width|height)="[^"]*"/g, '');
      return '<svg class="score-svg"' + kept + ' role="img" aria-label="' + escapeAttr(alt) + '">';
    });
}

function exampleCard(name, alt, strings) {
  const svg = fs.readFileSync(path.join(ARTICLE_DIR, name + '.svg'), 'utf8');
  const pdf = name.startsWith('allegretto') ? PDFS.allegretto : PDFS.prelude;
  return '<a class="example-card" href="' + ASSETS_URL + encodeURIComponent(pdf) + '" download="' + escapeAttr(pdf) + '">' +
    inlineScore(svg, alt) +
    '<span class="example-download">' + strings.artDownloadPdf + '</span></a>';
}

function formFigure(caption, form) {
  return '<figure class="form"><figcaption>' + caption + ' <span class="form-text">' + formText(form) + '</span></figcaption>' +
    '<pre aria-hidden="true">' + formTab(form) + '</pre></figure>';
}

/* Diagramas de la Forma completa (solo los acordes del primer ejemplo) y,
   debajo, la comparacion apilada: completa arriba, descompuesta abajo. */
function comparisons(names, strings, withDiagrams) {
  const cards = names.map(function (name) {
    const diagram = withDiagrams ? diagramSvg(chordFingers(name), strings.artChordDiagramLabel + ' ' + name) : '';
    // Where an easier decomposition exists it comes first, then Carcassi's.
    const easy = EASY_DECOMPOSED[name];
    const decomposed = easy
      ? formFigure(strings.artFormDecomposedEasy, easy) + formFigure(strings.artFormDecomposedCarcassi, DECOMPOSED[name])
      : formFigure(strings.artFormDecomposed, DECOMPOSED[name]);
    return '<div class="chord-card"><h3>' + name + '</h3>' + diagram +
      formFigure(strings.artFormFull, fullForm(name)) + decomposed + '</div>';
  });
  return '<div class="chord-grid">' + cards.join('') + '</div>';
}

/* Cuerpo del articulo para un idioma: la prosa vive en body.<locale>.html. */
function renderBody(locale, strings) {
  const prose = fs.readFileSync(path.join(ARTICLE_DIR, 'body.' + locale + '.html'), 'utf8');
  return prose
    .split('%%EXAMPLE_ALLEGRETTO%%').join(exampleCard('allegretto-compases-1-4', strings.artAllegrettoAlt, strings))
    .split('%%FORMS_ALLEGRETTO%%').join(comparisons(ALLEGRETTO_CHORDS, strings, true))
    .split('%%EXAMPLE_PRELUDE%%').join(exampleCard('prelude-compases-3-4', strings.artPreludeAlt, strings))
    .split('%%FORMS_PRELUDE%%').join(comparisons(PRELUDE_CHORDS, strings, false));
}

/* Archivos que el build copia a dist/site/assets/articles/carcassi/. */
function pdfFiles() {
  return Object.values(PDFS).map(function (name) {
    return { src: path.join(ARTICLE_DIR, name), name: name };
  });
}

module.exports = { renderBody, pdfFiles, PDFS };
