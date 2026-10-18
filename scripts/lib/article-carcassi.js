'use strict';
/* article-carcassi.js — Cuerpo del articulo «Descomposicion de acordes para
   arpegios en Carcassi». Todo es HTML y SVG estatico generado en el build: la
   partitura y la TAB son los SVG de scripts/articles/carcassi/build.py y los
   diagramas salen de la base de acordes (chord-forms.js). Las TAB de las formas
   son <ascii-tabs readonly> (vendor/ascii-tabs.js): el valor viaja en
   data-value y lo asigna un script al final del cuerpo. */

const fs = require('fs');
const path = require('path');
const { fullForm, chordFingers, diagramSvg } = require('./chord-forms');

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

/* Columnas para <ascii-tabs>: una por forma. La libreria no tiene barras de
   compas, asi que entre acordes va una columna vacia que los separa. */
function formsColumns(forms) {
  const columns = [];
  forms.forEach(function (form, i) {
    if (i > 0) columns.push(new Array(6).fill(null));
    columns.push(form);
  });
  return columns;
}

/* TAB de solo lectura, sin boton de copiar (la <ascii-tabs-sheet> vacia
   reemplaza las herramientas por defecto) ni pista de edicion. */
function asciiTab(forms, locale) {
  // Width fits the columns (label + 4 characters each) so the strings do not
  // run on with empty dashes.
  const width = 4 * formsColumns(forms).length + 3;
  return '<ascii-tabs class="article-tab" readonly theme="light" variant="flat" spacing="3" lang="' + locale + '"' +
    ' style="width:' + width + 'ch"' +
    ' data-value=\'' + JSON.stringify([formsColumns(forms)]) + '\'><ascii-tabs-sheet></ascii-tabs-sheet></ascii-tabs>';
}

function formFigure(caption, form, locale) {
  return '<figure class="form"><figcaption>' + caption + '</figcaption>' +
    asciiTab([form], locale) + '</figure>';
}

/* Diagramas de la Forma completa (solo los acordes del primer ejemplo) y,
   debajo, la comparacion apilada: completa arriba, descompuesta abajo. */
function comparisons(names, strings, locale) {
  const cards = names.map(function (name) {
    const diagram = diagramSvg(chordFingers(name), strings.artChordDiagramLabel + ' ' + name);
    return '<div class="chord-card"><h3>' + name + '</h3>' + diagram +
      formFigure(strings.artFormFull, fullForm(name), locale) +
      formFigure(strings.artFormDecomposed, DECOMPOSED[name], locale) + '</div>';
  });
  return '<div class="chord-grid">' + cards.join('') + '</div>';
}

/* Los cuatro acordes del preludio en un mismo TAB por forma: completa y
   descompuesta de Carcassi. El E7 suma aparte la descomposicion facil. */
function sequenceComparison(names, strings, locale) {
  const row = function (caption, forms) {
    return '<figure class="form sequence"><figcaption>' + caption + ' <span class="form-text">' + names.join(' ') + '</span></figcaption>' +
      asciiTab(forms, locale) + '</figure>';
  };
  const e7 = '<figure class="form sequence"><figcaption>' + strings.artFormE7Compare + ' <span class="form-text">E7</span></figcaption>' +
    asciiTab([EASY_DECOMPOSED.E7, DECOMPOSED.E7], locale) + '</figure>';
  return '<div class="sequence-forms">' +
    row(strings.artFormFull, names.map(fullForm)) +
    row(strings.artFormDecomposedCarcassi, names.map(function (name) { return DECOMPOSED[name]; })) +
    e7 + '</div>';
}

/* Carga la libreria y le pasa a cada TAB su valor. */
const TAB_LOADER = '<script type="module" src="/assets/vendor/ascii-tabs.js"></script>' +
  '<script>document.querySelectorAll("ascii-tabs[data-value]").forEach(function(el){el.value=JSON.parse(el.dataset.value);});</script>';

/* Cuerpo del articulo para un idioma: la prosa vive en body.<locale>.html. */
function renderBody(locale, strings) {
  const prose = fs.readFileSync(path.join(ARTICLE_DIR, 'body.' + locale + '.html'), 'utf8');
  return prose
    .split('%%EXAMPLE_ALLEGRETTO%%').join(exampleCard('allegretto-compases-1-4', strings.artAllegrettoAlt, strings))
    .split('%%FORMS_ALLEGRETTO%%').join(comparisons(ALLEGRETTO_CHORDS, strings, locale))
    .split('%%EXAMPLE_PRELUDE%%').join(exampleCard('prelude-compases-3-4', strings.artPreludeAlt, strings))
    .split('%%FORMS_PRELUDE%%').join(sequenceComparison(PRELUDE_CHORDS, strings, locale))
    .concat(TAB_LOADER);
}

/* Archivos que el build copia a dist/site/assets/articles/carcassi/. */
function pdfFiles() {
  return Object.values(PDFS).map(function (name) {
    return { src: path.join(ARTICLE_DIR, name), name: name };
  });
}

/* Partitura del preludio: la imagen de la tarjeta del indice. */
const CARD_IMAGE = 'prelude-compases-3-4.svg';

function cardImage() {
  return { src: path.join(ARTICLE_DIR, CARD_IMAGE), name: CARD_IMAGE, url: ASSETS_URL + CARD_IMAGE };
}

module.exports = { renderBody, pdfFiles, cardImage, PDFS };
