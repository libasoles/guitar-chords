'use strict';
/* article-aguado.js — Pagina «Partituras de Aguado» (Nuevo metodo para guitarra, 1843).
   Cada pieza publicada es un PDF y un MusicXML en downloads/aguado (salida de scripts/aguado/build.py) mas un SVG
   de vista previa y las paginas SVG del modal en src/site/articles/aguado. El catalogo y los nombres salen de
   scripts/aguado/pieces.json; la pagina lista las que tienen archivos, en el orden del catalogo. */

const fs = require('fs');
const path = require('path');
const { modal, CLOSE_ICON } = require('./modal');
const { pagePath } = require('./slugs');
const { scoreNavigation } = require('./score-navigation');
const { escapeAttr, inlineScore, glyphDefs, DOWNLOAD_ICON } = require('./score-svg');

const ROOT = path.join(__dirname, '..', '..');
const FOLDER = 'aguado';
const DOWNLOADS_DIR = path.join(ROOT, 'downloads', FOLDER);
const PREVIEW_DIR = path.join(ROOT, 'src', 'site', 'articles', FOLDER);
const ASSETS_URL = '/assets/articles/' + FOLDER + '/';
const FULL_DIR = path.join(PREVIEW_DIR, 'full');
const SCORE_PREFIX = 'aguado-';
const AUTHOR = 'Dionisio Aguado';

const PIECES = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', FOLDER, 'pieces.json'), 'utf8'));

const LABELS = {
  lesson: { en: 'Lesson', es: 'Lección' },
  righthand: { en: 'Right Hand Exercises', es: 'Ejercicios de mano derecha' },
  study: { en: 'Study', es: 'Estudio' },
};

/* Titulo de la pieza: «Lesson 14: Waltz in G» / «Lección 14: Vals en Sol» (es el /Title del PDF en ingles). */
function pieceName(piece, locale) {
  const base = LABELS[piece.kind][locale] + ' ' + piece.n;
  return piece.form ? base + ': ' + (locale === 'es' ? piece.es : piece.form) : base;
}

function fileBase(piece) {
  return pieceName(piece, 'en').replace(': ', ' - ') + ' - ' + AUTHOR;
}

function previewFile(number) {
  return SCORE_PREFIX + String(number).padStart(2, '0') + '.svg';
}

/* Orden en la pagina: lecciones por numero, luego ejercicios de mano derecha y estudios por numero. La clave del
   catalogo solo da el nombre de los archivos (aguado-NN), asi una leccion nueva puede ir antes de las ya publicadas. */
const KIND_ORDER = { lesson: 0, righthand: 1, study: 2 };

function pageOrder(a, b) {
  return KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || parseInt(a.n, 10) - parseInt(b.n, 10);
}

/* [{number, base, pdf, ...pieza}] de las piezas con PDF, MusicXML y vista previa, en el orden de la pagina. */
function publishedPieces() {
  return Object.keys(PIECES)
    .map((key) => ({ number: Number(key), ...PIECES[key] }))
    .map((piece) => ({ ...piece, base: fileBase(piece), pdf: fileBase(piece) + '.pdf' }))
    .filter((p) => fs.existsSync(path.join(DOWNLOADS_DIR, p.pdf)) && fs.existsSync(path.join(DOWNLOADS_DIR, p.base + '.musicxml')) &&
      fs.existsSync(path.join(PREVIEW_DIR, previewFile(p.number))))
    .sort(pageOrder);
}

function card(piece, locale, strings, sharedGlyphs, pieces) {
  const name = pieceName(piece, locale);
  const svg = fs.readFileSync(path.join(PREVIEW_DIR, previewFile(piece.number)), 'utf8');
  const id = 'aguado-score-' + piece.number;
  const href = ASSETS_URL + encodeURIComponent(piece.pdf);
  const download = '<a class="example-download" href="' + href + '" download="' + escapeAttr(piece.pdf) + '">' + strings.artPreludesDownload + '</a>';
  /* El titulo es el boton que abre la partitura completa en un modal; su ::after cubre toda la tarjeta.
     El enlace de descarga del pie queda por encima. */
  return '<article class="example-card prelude-card">' +
    '<h2 class="prelude-card-title"><button type="button" class="prelude-open" popovertarget="' + id + '" aria-haspopup="dialog" ' +
      'aria-label="' + escapeAttr(strings.artPreludesView + ' ' + name) + '">' + name + '</button>' +
      '<a class="prelude-pdf-link" href="' + href + '" download="' + escapeAttr(piece.pdf) + '">' + name + '</a></h2>' +
    inlineScore(svg, strings.artPreludesAltPrefix + ' ' + name, sharedGlyphs) +
    download +
    modal({ id, label: name, closeLabel: strings.artArpeggiosClose, className: 'modal-full', closeContent: CLOSE_ICON, locale, strings, logoHref: pagePath('articulos', locale), content: fullScore(piece, name, href, strings, pieces, locale) }) +
    '</article>';
}

/* Paginas de la partitura completa (full/aguado-NN-pP.svg, ver build.py) como <img> perezosas: dentro del
   modal cerrado (display: none) el navegador no las pide hasta que se abre. */
function pageFiles(piece) {
  const prefix = SCORE_PREFIX + String(piece.number).padStart(2, '0') + '-p';
  return fs.existsSync(FULL_DIR)
    ? fs.readdirSync(FULL_DIR).filter((file) => file.startsWith(prefix) && file.endsWith('.svg'))
      .sort((a, b) => parseInt(a.slice(prefix.length), 10) - parseInt(b.slice(prefix.length), 10))
    : [];
}

function fullScore(piece, name, href, strings, pieces, locale) {
  const pages = pageFiles(piece).map((file, i, all) => {
    const head = fs.readFileSync(path.join(FULL_DIR, file), 'utf8').slice(0, 300);
    const [, width, height] = head.match(/<svg width="(\d+)(?:\.\d+)?px" height="(\d+)(?:\.\d+)?px"/);
    return '<img class="modal-page" src="' + ASSETS_URL + 'full/' + file + '" width="' + width + '" height="' + height +
      '" loading="lazy" decoding="async" alt="' + escapeAttr(name + (all.length > 1 ? ' (' + (i + 1) + '/' + all.length + ')' : '')) + '">';
  });
  return '<div class="modal-pages">' + pages.join('') + '</div>' +
    '<div class="modal-footer">' + scoreNavigation(pieces, piece, 'aguado-score-', pieceName, locale) + '<div class="modal-keys"></div><a class="modal-download" href="' + href + '" download="' + escapeAttr(piece.pdf) + '">' +
    DOWNLOAD_ICON + '<span>' + strings.artPreludesDownload + '</span></a></div>';
}

function renderBody(locale, strings) {
  const prose = fs.readFileSync(path.join(PREVIEW_DIR, 'body.' + locale + '.html'), 'utf8');
  const sharedGlyphs = new Map();
  const pieces = publishedPieces();
  const cards = pieces.map((p) => card(p, locale, strings, sharedGlyphs, pieces)).join('');
  const grid = glyphDefs(sharedGlyphs) + '<div class="prelude-grid">' + cards + '</div>';
  return prose.split('%%PIECES%%').join(grid);
}

/* Archivos que el build copia a dist/site/assets/articles/aguado/. */
function pdfFiles() {
  return publishedPieces().map((p) => ({ src: path.join(DOWNLOADS_DIR, p.pdf), name: p.pdf }));
}

/* Paginas SVG de la partitura completa, que el build copia a .../aguado/full/. */
function pageSvgFiles() {
  return publishedPieces().flatMap((p) => pageFiles(p).map((name) => ({ src: path.join(FULL_DIR, name), name })));
}

/* Imagen de la tarjeta del indice: la vista previa de la primera pieza. */
function cardImage() {
  const first = publishedPieces()[0];
  const name = previewFile(first.number);
  const src = path.join(PREVIEW_DIR, name);
  const [, width, height] = fs.readFileSync(src, 'utf8').slice(0, 200).match(/viewBox="0 0 (\d+) (\d+)"/);
  return { src, name, url: ASSETS_URL + name, size: [684, Math.round(684 * height / width)] };
}

module.exports = { publishedPieces, renderBody, pdfFiles, pageSvgFiles, cardImage, pieceName, DOWNLOADS_DIR, PREVIEW_DIR, SCORE_PREFIX, PIECES, AUTHOR };
