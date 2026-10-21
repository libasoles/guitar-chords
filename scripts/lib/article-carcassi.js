'use strict';
/* article-carcassi.js — Cuerpo del articulo «Descomposicion de acordes para
   arpegios en Carcassi». Todo es HTML y SVG estatico generado en el build: la
   partitura y la TAB son los SVG de scripts/articles/carcassi/build.py y los
   diagramas salen de la base de acordes (chord-forms.js). Las TAB de las formas
   son <ascii-tabs readonly> (vendor/ascii-tabs.js): el valor viaja en
   data-value y lo asigna un script al final del cuerpo. */

const fs = require('fs');
const path = require('path');
const { fullForm, chordObject, chordCard, CHORD_CARD_LOADER } = require('./chord-forms');
const { PREVIEW_DIR } = require('./article-carcassi-preludes');
const { normalizeScoreDirections } = require('./score-svg');

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

/* Prelude 1 in C Major: dos formas con distintos bajos en los
   compases 1 (C), 3 (Dm) y 4 (G7). Cuerda 1 primero. */
const C_MAJOR_FORMS = {
  C: [[0, 1, 0, null, 3, null], [0, 1, 0, 2, null, null]],
  Dm: [[1, 3, 2, 0, null, null], [1, 3, 2, 3, null, null]],
  G7: [[1, 0, 0, null, null, 3], [1, 0, 0, null, 2, null]],
};

function escapeAttr(text) {
  return String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/* El SVG de Verovio sin saltos entre etiquetas y sin tamano fijo: se escala al
   ancho de la tarjeta con su viewBox. */
function inlineScore(svg, alt) {
  return normalizeScoreDirections(svg)
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

function cMajorExampleCard(strings) {
  const pdf = 'Prelude 1 in C Major - Matteo Carcassi.pdf';
  const svg = fs.readFileSync(path.join(PREVIEW_DIR, 'prelude-01.svg'), 'utf8');
  return '<a class="example-card" href="/assets/articles/carcassi-preludios/' + encodeURIComponent(pdf) + '" download="' + pdf + '">' +
    inlineScore(svg, 'Prelude 1 in C Major — Matteo Carcassi') +
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

/* Caracteres de ancho de una TAB: etiqueta de cuerda + 4 por columna. ascii-tabs
   nunca dibuja un Staff de menos de 18. */
function tabChars(forms) {
  return Math.max(18, 4 * formsColumns(forms).length + 3);
}

/* TAB de solo lectura, sin boton de copiar (la <ascii-tabs-sheet> vacia
   reemplaza las herramientas por defecto) ni pista de edicion. */
function asciiTab(forms, locale, annotations) {
  return '<ascii-tabs class="article-tab" readonly theme="light" labels="notes" spacing="3" lang="' + locale + '"' +
    (annotations ? ' variant="flat" data-annotations="' + escapeAttr(JSON.stringify([annotations])) + '"' : '') +
    ' data-value=\'' + JSON.stringify([formsColumns(forms)]) + '\'><ascii-tabs-sheet></ascii-tabs-sheet></ascii-tabs>';
}

/* Nombres de los acordes, uno sobre la columna de su forma (la misma
   cuadricula de 4 caracteres que la TAB, con la columna vacia entre acordes). */
function chordNames(names) {
  const cells = [];
  names.forEach(function (name, i) {
    if (i > 0) cells.push('<span></span>');
    cells.push('<span>' + name + '</span>');
  });
  return '<div class="tab-chords" aria-hidden="true">' + cells.join('') + '</div>';
}

/* Titulo (y nombres de acorde) por fuera de la hoja blanca de la TAB. El
   tamano de letra se comparte para que los nombres queden sobre sus columnas. */
function tabFigure(caption, forms, locale, names, annotations) {
  return '<figure class="form tab-figure" style="--chars:' + tabChars(forms) + '"><figcaption>' + caption + '</figcaption>' +
    (names && !annotations ? chordNames(names) : '') + asciiTab(forms, locale, annotations) + '</figure>';
}

function formFigure(caption, form, locale) {
  return tabFigure(caption, [form], locale);
}

/* Diagramas de la Forma completa (solo los acordes del primer ejemplo) y,
   debajo, la comparacion apilada: completa arriba, descompuesta abajo. */
function comparisons(names, strings, locale) {
  const cards = names.map(function (name) {
    const card = chordCard(chordObject(name), strings.artChordDiagramLabel + ' ' + name);
    return '<div class="chord-card">' + card +
      formFigure(strings.artFormFull, fullForm(name), locale) +
      formFigure(strings.artFormDecomposed, DECOMPOSED[name], locale) + '</div>';
  });
  return '<div class="chord-grid">' + cards.join('') + '</div>';
}

/* Los cuatro acordes del preludio en un mismo TAB por forma: completa, la
   descompuesta con el E7 facil y la de Carcassi. Siempre la secuencia entera;
   solo cambia como se toca el E7. */
function sequenceComparison(names, strings, locale) {
  const decomposed = function (overrides) {
    return names.map(function (name) { return overrides[name] || DECOMPOSED[name]; });
  };
  const row = function (caption, forms) {
    return tabFigure(caption, forms, locale, names);
  };
  return '<div class="sequence-forms">' +
    row(strings.artFormFull, names.map(fullForm)) +
    row(strings.artFormDecomposedEasy, decomposed(EASY_DECOMPOSED)) +
    row(strings.artFormDecomposedCarcassi, decomposed({})) +
    '</div>';
}

/* Carga la libreria y le pasa a cada TAB su valor. */
const TAB_LOADER = '<script type="module" src="/assets/vendor/ascii-tabs.js"></script>' +
  '<script>customElements.whenDefined("ascii-tabs").then(function(){document.querySelectorAll("ascii-tabs[data-value]").forEach(function(el){el.setDocument({value:JSON.parse(el.dataset.value),annotations:el.dataset.annotations?JSON.parse(el.dataset.annotations):null});});});</script>';

/* Cuerpo del articulo para un idioma: la prosa vive en body.<locale>.html. */
function renderBody(locale, strings) {
  const prose = fs.readFileSync(path.join(ARTICLE_DIR, 'body.' + locale + '.html'), 'utf8');
  return prose
    .split('%%EXAMPLE_ALLEGRETTO%%').join(exampleCard('allegretto-compases-1-4', strings.artAllegrettoAlt, strings))
    .split('%%FORMS_ALLEGRETTO%%').join(comparisons(ALLEGRETTO_CHORDS, strings, locale))
    .split('%%EXAMPLE_PRELUDE%%').join(exampleCard('prelude-compases-3-4', strings.artPreludeAlt, strings))
    .split('%%FORMS_PRELUDE%%').join(sequenceComparison(PRELUDE_CHORDS, strings, locale))
    .split('%%EXAMPLE_C_MAJOR%%').join(cMajorExampleCard(strings))
    .split('%%FORMS_C_MAJOR%%').join('<div class="bass-forms">' +
      Object.entries(C_MAJOR_FORMS).map(function ([name, forms]) {
        return tabFigure(name, forms, locale);
      }).join('') + '</div>')
    .split('%%FORM_C_G_BASS%%').join(formFigure('C', [0, 1, 0, null, null, 3], locale))
    .concat(CHORD_CARD_LOADER, TAB_LOADER);
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

module.exports = { renderBody, pdfFiles, cardImage, PDFS, tabFigure, TAB_LOADER };
