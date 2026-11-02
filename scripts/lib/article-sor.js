'use strict';
/* article-sor.js — Pagina «Lecciones progresivas de Sor» (Op. 60, Introduction a l'etude de la guitare).
   Los archivos salen de scripts/sor/build.py (coleccion «lecciones»); ver article-sor-collection.js. */

const { createSorCollection } = require('./article-sor-collection');

/* Titulo de la pieza: «Lesson 4: E-flat Major» / «Lección 4: Mi bemol mayor» (el PDF y el visor llevan el titulo en español). */
function pieceName(piece, locale) {
  if (locale === 'es') return 'Lección ' + piece.n + ': ' + piece.es;
  if (locale === 'pt') return 'Lição ' + piece.n + ': ' + piece.pt;
  if (locale === 'en') return 'Lesson ' + piece.n + ': ' + piece.form;
  throw new Error('article-sor: idioma sin nombre de pieza: ' + locale);
}

module.exports = createSorCollection({ folder: 'sor', catalog: 'pieces.json', prefix: 'sor-', pieceName });
