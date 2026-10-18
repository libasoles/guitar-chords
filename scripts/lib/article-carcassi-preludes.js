'use strict';
/* article-carcassi-preludes.js — Pagina «Preludios de Carcassi». Cada preludio
   publicado es un PDF y un MusicXML en downloads/carcassi-preludios (salida de
   scripts/carcassi-preludios/extract.py) mas un SVG de vista previa en
   src/site/articles/carcassi-preludios. La pagina lista los que existen, en
   orden numerico: publicar uno nuevo es agregar sus tres archivos. */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const DOWNLOADS_DIR = path.join(ROOT, 'downloads', 'carcassi-preludios');
const PREVIEW_DIR = path.join(ROOT, 'src', 'site', 'articles', 'carcassi-preludios');
const ASSETS_URL = '/assets/articles/carcassi-preludios/';

const KEYS = {
  es: { C: 'Do', D: 'Re', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si', Major: 'mayor', Minor: 'menor' },
};

/* [{number, base, key, pdf, preview}] de los preludios con PDF, MusicXML y vista previa. */
function publishedPreludes() {
  if (!fs.existsSync(DOWNLOADS_DIR)) return [];
  return fs.readdirSync(DOWNLOADS_DIR)
    .map((file) => file.match(/^(Prelude (\d+) in ([A-G][#b]?) (Major|Minor) - Matteo Carcassi)\.pdf$/))
    .filter(Boolean)
    .map((m) => ({ number: Number(m[2]), base: m[1], tonic: m[3], mode: m[4], pdf: m[0] }))
    .filter((p) => fs.existsSync(path.join(DOWNLOADS_DIR, p.base + '.musicxml')) &&
      fs.existsSync(path.join(PREVIEW_DIR, 'prelude-' + String(p.number).padStart(2, '0') + '.svg')))
    .sort((a, b) => a.number - b.number);
}

function keyName(prelude, locale) {
  const accidental = prelude.tonic.slice(1) === '#' ? '#' : prelude.tonic.slice(1) === 'b' ? 'b' : '';
  if (locale === 'en') return prelude.tonic + ' ' + (prelude.mode === 'Major' ? 'major' : 'minor');
  const k = KEYS.es;
  return k[prelude.tonic[0]] + accidental + ' ' + k[prelude.mode];
}

function escapeAttr(text) {
  return String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/* El SVG de Verovio sin saltos entre etiquetas y sin tamano fijo: se escala al ancho de la tarjeta. */
function inlineScore(svg, alt) {
  return svg
    .trim()
    .replace(/>\s+</g, '><')
    .replace(/^<svg\b([^>]*)>/, function (_, attrs) {
      return '<svg class="score-svg"' + attrs + ' role="img" aria-label="' + escapeAttr(alt) + '">';
    });
}

function card(prelude, locale, strings) {
  const name = (locale === 'es' ? 'Preludio ' : 'Prelude ') + prelude.number + (locale === 'es' ? ' en ' : ' in ') + keyName(prelude, locale);
  const svg = fs.readFileSync(path.join(PREVIEW_DIR, 'prelude-' + String(prelude.number).padStart(2, '0') + '.svg'), 'utf8');
  return '<a class="example-card prelude-card" href="' + ASSETS_URL + encodeURIComponent(prelude.pdf) + '" download="' + escapeAttr(prelude.pdf) + '">' +
    '<h2 class="prelude-card-title">' + name + '</h2>' +
    inlineScore(svg, strings.artPreludesAltPrefix + ' ' + name) +
    '<span class="example-download">' + strings.artPreludesDownload + '</span></a>';
}

function renderBody(locale, strings) {
  const prose = fs.readFileSync(path.join(PREVIEW_DIR, 'body.' + locale + '.html'), 'utf8');
  const grid = '<div class="prelude-grid">' + publishedPreludes().map((p) => card(p, locale, strings)).join('') + '</div>';
  return prose.split('%%PRELUDES%%').join(grid);
}

/* Archivos que el build copia a dist/site/assets/articles/carcassi-preludios/. */
function pdfFiles() {
  return publishedPreludes().map((p) => ({ src: path.join(DOWNLOADS_DIR, p.pdf), name: p.pdf }));
}

/* Imagen de la tarjeta del indice: la vista previa del primer preludio. */
function cardImage() {
  const first = publishedPreludes()[0];
  const name = 'prelude-' + String(first.number).padStart(2, '0') + '.svg';
  return { src: path.join(PREVIEW_DIR, name), name, url: ASSETS_URL + name };
}

module.exports = { publishedPreludes, renderBody, pdfFiles, cardImage, keyName, DOWNLOADS_DIR, PREVIEW_DIR };
