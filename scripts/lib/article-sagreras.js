'use strict';
/* article-sagreras.js — Pagina «Primeras lecciones de Sagreras» (Las lecciones de guitarra, libro 1).
   Cada leccion publicada es un PDF y un MusicXML en downloads/sagreras-lecciones (salida de
   scripts/sagreras/build.py) mas un SVG de vista previa y las paginas SVG del modal en
   src/site/articles/sagreras-lecciones. La pagina lista las que existen, en orden numerico: publicar una
   nueva es agregar sus archivos. */

const fs = require('fs');
const path = require('path');
const { modal, CLOSE_ICON } = require('./modal');
const { pagePath } = require('./slugs');
const { scoreNavigation } = require('./score-navigation');
const { escapeAttr, inlineScore, glyphDefs, DOWNLOAD_ICON } = require('./score-svg');
const { editorMarks } = require('./editor-marks');

const ROOT = path.join(__dirname, '..', '..');
const FOLDER = 'sagreras-lecciones';
const DOWNLOADS_DIR = path.join(ROOT, 'downloads', FOLDER);
const PREVIEW_DIR = path.join(ROOT, 'src', 'site', 'articles', FOLDER);
const ASSETS_URL = '/assets/articles/' + FOLDER + '/';
const FULL_DIR = path.join(PREVIEW_DIR, 'full');
const SCORE_PREFIX = 'lesson-';
const AUTHOR = 'Julio Salvador Sagreras';

/* [{number, base, pdf}] de las lecciones con PDF, MusicXML y vista previa. */
function publishedPieces() {
  if (!fs.existsSync(DOWNLOADS_DIR)) return [];
  return fs.readdirSync(DOWNLOADS_DIR)
    .map((file) => file.match(/^(Lesson (\d+) - Julio Salvador Sagreras)\.pdf$/))
    .filter(Boolean)
    .map((m) => ({ number: Number(m[2]), base: m[1], pdf: m[0] }))
    .filter((p) => fs.existsSync(path.join(DOWNLOADS_DIR, p.base + '.musicxml')) &&
      fs.existsSync(path.join(PREVIEW_DIR, SCORE_PREFIX + String(p.number).padStart(2, '0') + '.svg')))
    .sort((a, b) => a.number - b.number);
}

function pieceName(piece, locale) {
  return (locale === 'es' ? 'Lección ' : 'Lesson ') + piece.number;
}

function card(piece, locale, strings, sharedGlyphs, pieces) {
  const name = pieceName(piece, locale);
  const svg = fs.readFileSync(path.join(PREVIEW_DIR, SCORE_PREFIX + String(piece.number).padStart(2, '0') + '.svg'), 'utf8');
  const id = 'sagreras-score-' + piece.number;
  const href = ASSETS_URL + encodeURIComponent(piece.pdf);
  const download = '<a class="example-download" href="' + href + '" download="' + escapeAttr(piece.pdf) + '">' + strings.artPreludesDownload + '</a>';
  /* El titulo es el boton que abre la partitura completa en un modal; su ::after cubre toda la tarjeta.
     El enlace de descarga del pie queda por encima. */
  return '<article class="example-card prelude-card">' +
    '<h2 class="prelude-card-title">' + editorMarks('sagreras', piece.number, strings) + '<button type="button" class="prelude-open" popovertarget="' + id + '" aria-haspopup="dialog" ' +
      'aria-label="' + escapeAttr(strings.artPreludesView + ' ' + name) + '">' + name + '</button>' +
      '<a class="prelude-pdf-link" href="' + href + '" download="' + escapeAttr(piece.pdf) + '">' + name + '</a></h2>' +
    inlineScore(svg, strings.artPreludesAltPrefix + ' ' + name, sharedGlyphs) +
    download +
    modal({ id, label: name, closeLabel: strings.artArpeggiosClose, className: 'modal-full', closeContent: CLOSE_ICON, locale, strings, logoHref: pagePath('articulos', locale), content: fullScore(piece, name, href, strings, pieces, locale) }) +
    '</article>';
}

/* Paginas de la partitura completa (full/lesson-NN-pP.svg, ver build.py) como <img> perezosas: dentro del
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
  return '<div class="modal-pages">' + editorMarks('sagreras', piece.number, strings) + pages.join('') + '</div>' +
    '<div class="modal-footer"><div class="modal-keys">' +
    scoreNavigation(pieces, piece, 'sagreras-score-', pieceName, locale, { mobile: true }) + '</div><a class="modal-download" href="' + href + '" download="' + escapeAttr(piece.pdf) + '">' +
    DOWNLOAD_ICON + '<span>' + strings.artPreludesDownload + '</span></a></div>';
}

function renderBody(locale, strings) {
  const prose = fs.readFileSync(path.join(PREVIEW_DIR, 'body.' + locale + '.html'), 'utf8');
  const sharedGlyphs = new Map();
  const pieces = publishedPieces();
  const cards = pieces.map((p) => card(p, locale, strings, sharedGlyphs, pieces)).join('');
  const grid = glyphDefs(sharedGlyphs) + '<div class="prelude-grid">' + cards + '</div>';
  return prose.split('%%LESSONS%%').join(grid);
}

/* Archivos que el build copia a dist/site/assets/articles/carcassi-progresivas/. */
function pdfFiles() {
  return publishedPieces().map((p) => ({ src: path.join(DOWNLOADS_DIR, p.pdf), name: p.pdf }));
}

/* Paginas SVG de la partitura completa, que el build copia a .../carcassi-progresivas/full/. */
function pageSvgFiles() {
  return publishedPieces().flatMap((p) => pageFiles(p).map((name) => ({ src: path.join(FULL_DIR, name), name })));
}

/* Imagen de la tarjeta del indice: la vista previa de la primera pieza. */
function cardImage() {
  const first = publishedPieces()[0];
  const name = SCORE_PREFIX + String(first.number).padStart(2, '0') + '.svg';
  const src = path.join(PREVIEW_DIR, name);
  const [, width, height] = fs.readFileSync(src, 'utf8').slice(0, 200).match(/viewBox="0 0 (\d+) (\d+)"/);
  return { src, name, url: ASSETS_URL + name, size: [684, Math.round(684 * height / width)] };
}

module.exports = { publishedPieces, renderBody, pdfFiles, pageSvgFiles, cardImage, DOWNLOADS_DIR, PREVIEW_DIR, SCORE_PREFIX, AUTHOR };
