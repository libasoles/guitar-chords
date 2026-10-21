'use strict';
/* article-carcassi-preludes.js — Pagina «Preludios de Carcassi». Cada preludio
   publicado es un PDF y un MusicXML en downloads/carcassi-preludios (salida de
   scripts/carcassi-preludios/extract.py) mas un SVG de vista previa en
   src/site/articles/carcassi-preludios. La pagina lista los que existen, en
   orden numerico: publicar uno nuevo es agregar sus tres archivos. */

const fs = require('fs');
const path = require('path');
const { modal, CLOSE_ICON } = require('./modal');
const { escapeAttr, inlineScore, glyphDefs, DOWNLOAD_ICON } = require('./score-svg');

const ROOT = path.join(__dirname, '..', '..');
function createEdition(edition) {
  const waltzes = edition === 'valses';
  const folder = waltzes ? 'carcassi-valses' : edition === 'santisteban' ? 'santisteban-preludios' : 'carcassi-preludios';
  const DOWNLOADS_DIR = path.join(ROOT, 'downloads', folder);
  const PREVIEW_DIR = path.join(ROOT, 'src', 'site', 'articles', folder);
  const ASSETS_URL = '/assets/articles/' + folder + '/';
  const FULL_DIR = path.join(PREVIEW_DIR, 'full');
  const SCORE_PREFIX = waltzes ? 'waltz-' : edition === 'santisteban' ? 'santisteban-prelude-' : 'prelude-';
  const PIECE = waltzes ? 'Waltz' : 'Prelude';

  const KEYS = {
    es: { C: 'Do', D: 'Re', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si', Major: 'mayor', Minor: 'menor' },
  };

  /* [{number, base, key, pdf, preview}] de los preludios con PDF, MusicXML y vista previa. */
  function publishedPreludes() {
    if (!fs.existsSync(DOWNLOADS_DIR)) return [];
    return fs.readdirSync(DOWNLOADS_DIR)
      .map((file) => file.match(new RegExp('^(' + PIECE + ' (\\d+) in ([A-G][#b]?) (Major|Minor) - Matteo Carcassi(?: - Santisteban)?)\\.pdf$')))
      .filter(Boolean)
      .map((m) => ({ number: Number(m[2]), base: m[1], tonic: m[3], mode: m[4], pdf: m[0] }))
      .filter((p) => fs.existsSync(path.join(DOWNLOADS_DIR, p.base + '.musicxml')) &&
        fs.existsSync(path.join(PREVIEW_DIR, SCORE_PREFIX + String(p.number).padStart(2, '0') + '.svg')))
      .sort((a, b) => a.number - b.number);
  }

  function keyName(prelude, locale) {
    const accidental = prelude.tonic.slice(1) === '#' ? '#' : prelude.tonic.slice(1) === 'b' ? 'b' : '';
    if (locale === 'en') return prelude.tonic + ' ' + (prelude.mode === 'Major' ? 'major' : 'minor');
    const k = KEYS.es;
    return k[prelude.tonic[0]] + accidental + ' ' + k[prelude.mode];
  }

  const PITCH_CLASS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  function pitchClass(tonic) {
    return (PITCH_CLASS[tonic[0]] + (tonic[1] === '#' ? 1 : tonic[1] === 'b' ? -1 : 0) + 12) % 12;
  }

  /* El preludio publicado en la tonalidad relativa (menor de un mayor y viceversa), o undefined si no esta. */
  function relativeOf(prelude, all) {
    const major = prelude.mode === 'Major';
    const target = (pitchClass(prelude.tonic) + (major ? 9 : 3)) % 12;
    return all.find((p) => p.mode !== prelude.mode && pitchClass(p.tonic) === target);
  }

  /* El preludio publicado en la tonalidad dominante (una quinta arriba, mismo modo), o undefined si no esta. */
  function dominantOf(prelude, all) {
    const target = (pitchClass(prelude.tonic) + 7) % 12;
    return all.find((p) => p.mode === prelude.mode && pitchClass(p.tonic) === target);
  }

  const MUSIC_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
    'stroke-linejoin="round" aria-hidden="true"><path d="m19 6-5.2-3.9a.5.5 0 0 0-.8.4V18"/><circle cx="9" cy="18" r="4"/></svg>';

  function preludeName(prelude, locale) {
    return (locale === 'es' ? (waltzes ? 'Vals ' : 'Preludio ') : PIECE + ' ') + prelude.number + (locale === 'es' ? ' en ' : ' in ') + keyName(prelude, locale);
  }

  function card(prelude, locale, strings, sharedGlyphs, all) {
    const name = preludeName(prelude, locale);
    const svg = fs.readFileSync(path.join(PREVIEW_DIR, SCORE_PREFIX + String(prelude.number).padStart(2, '0') + '.svg'), 'utf8');
    const id = 'prelude-score-' + prelude.number;
    const href = ASSETS_URL + encodeURIComponent(prelude.pdf);
    const download = '<a class="example-download" href="' + href + '" download="' + escapeAttr(prelude.pdf) + '">' + strings.artPreludesDownload + '</a>';
    /* El titulo es el boton que abre la partitura completa en un modal; su ::after cubre toda la tarjeta.
       El enlace de descarga del pie queda por encima. */
    return '<article class="example-card prelude-card">' +
      '<h2 class="prelude-card-title"><button type="button" class="prelude-open" popovertarget="' + id + '" aria-haspopup="dialog" ' +
        'aria-label="' + escapeAttr(strings.artPreludesView + ' ' + name) + '">' + name + '</button>' +
        '<a class="prelude-pdf-link" href="' + href + '" download="' + escapeAttr(prelude.pdf) + '">' + name + '</a></h2>' +
      inlineScore(svg, strings.artPreludesAltPrefix + ' ' + name, sharedGlyphs) +
      download +
      modal({ id, label: name, closeLabel: strings.artArpeggiosClose, className: 'modal-full', closeContent: CLOSE_ICON,
        homeHref: locale === 'en' ? '/en' : '/', homeLabel: strings.wordmark + ' ' + strings.wordmarkSmall, content: fullScore(prelude, name, href, strings, all, locale) }) +
      '</article>';
  }

  /* Paginas de la partitura completa (full/prelude-NN-pP.svg, ver extract.py) como <img> perezosas: dentro del
     modal cerrado (display: none) el navegador no las pide hasta que se abre. width/height evitan saltos de layout. */
  function pageFiles(prelude) {
    const prefix = SCORE_PREFIX + String(prelude.number).padStart(2, '0') + '-p';
    return fs.existsSync(FULL_DIR)
      ? fs.readdirSync(FULL_DIR).filter((file) => file.startsWith(prefix) && file.endsWith('.svg'))
        .sort((a, b) => parseInt(a.slice(prefix.length), 10) - parseInt(b.slice(prefix.length), 10))
      : [];
  }

  function fullScore(prelude, name, href, strings, all, locale) {
    const pages = pageFiles(prelude).map((file, i, all) => {
      const head = fs.readFileSync(path.join(FULL_DIR, file), 'utf8').slice(0, 300);
      const [, width, height] = head.match(/<svg width="(\d+)(?:\.\d+)?px" height="(\d+)(?:\.\d+)?px"/);
      return '<img class="modal-page" src="' + ASSETS_URL + 'full/' + file + '" width="' + width + '" height="' + height +
        '" loading="lazy" decoding="async" alt="' + escapeAttr(name + (all.length > 1 ? ' (' + (i + 1) + '/' + all.length + ')' : '')) + '">';
    });
    /* El boton azul de descarga va en un pie fijo, como el de Partitura y tablatura. */
    const keyButton = (target, label) => target
      ? '<button type="button" class="modal-key" popovertarget="prelude-score-' + target.number + '" popovertargetaction="show">' +
        MUSIC_ICON + '<span>' + escapeAttr(preludeName(target, locale)) + '</span><span class="modal-key-label">' + label + '</span></button>'
      : '';
    const relative = relativeOf(prelude, all);
    const keyButtons = '<div class="modal-keys">' +
      keyButton(relative, relative && relative.mode === 'Minor' ? strings.artPreludesRelativeMinor : strings.artPreludesRelativeMajor) +
      keyButton(dominantOf(prelude, all), strings.artPreludesDominant) + '</div>';
    return '<div class="modal-pages">' + pages.join('') + '</div>' +
      '<div class="modal-footer">' + keyButtons + '<a class="modal-download" href="' + href + '" download="' + escapeAttr(prelude.pdf) + '">' +
      DOWNLOAD_ICON + '<span>' + strings.artPreludesDownload + '</span></a></div>';
  }

  function renderBody(locale, strings) {
    const prose = fs.readFileSync(path.join(PREVIEW_DIR, 'body.' + locale + '.html'), 'utf8');
    const sharedGlyphs = new Map();
    const all = publishedPreludes();
    const cards = all.map((p) => card(p, locale, strings, sharedGlyphs, all)).join('');
    const glyphs = glyphDefs(sharedGlyphs);
    /* Un popover abierto desde dentro de otro queda apilado; el boton de la tonalidad relativa cierra el actual. */
    const closer = '<script>document.querySelectorAll(".modal-key").forEach(function(b){b.addEventListener("click",function(){' +
      'b.closest("[popover]").hidePopover();});});</script>';
    const grid = glyphs + '<div class="prelude-grid">' + cards + '</div>' + closer;
    return prose.split('%%PRELUDES%%').join(grid);
  }

  /* Archivos que el build copia a dist/site/assets/articles/carcassi-preludios/. */
  function pdfFiles() {
    return publishedPreludes().map((p) => ({ src: path.join(DOWNLOADS_DIR, p.pdf), name: p.pdf }));
  }

  /* Paginas SVG de la partitura completa, que el build copia a .../carcassi-preludios/full/. */
  function pageSvgFiles() {
    return publishedPreludes().flatMap((p) => pageFiles(p).map((name) => ({ src: path.join(FULL_DIR, name), name })));
  }

  /* Imagen de la tarjeta del indice: la vista previa del primer preludio. */
  function cardImage() {
    const first = publishedPreludes()[0];
    const name = SCORE_PREFIX + String(first.number).padStart(2, '0') + '.svg';
    return { src: path.join(PREVIEW_DIR, name), name, url: ASSETS_URL + name };
  }

  return { publishedPreludes, renderBody, pdfFiles, pageSvgFiles, cardImage, keyName, DOWNLOADS_DIR, PREVIEW_DIR, SCORE_PREFIX };
}

module.exports = { ...createEdition('carcassi'), santisteban: createEdition('santisteban'), waltzes: createEdition('valses') };
