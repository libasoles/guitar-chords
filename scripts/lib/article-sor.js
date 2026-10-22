'use strict';
/* article-sor.js — Pagina «Lecciones progresivas de Sor» (Op. 60, Introduction a l'etude de la guitare).
   Los archivos salen de scripts/sor/build.py (coleccion «lecciones»); ver article-sor-collection.js. */

const { createSorCollection } = require('./article-sor-collection');

/* Titulo de la pieza: «Lesson 4: E-flat Major» / «Lección 4: Mi bemol mayor» (es el /Title del PDF en ingles). */
function pieceName(piece, locale) {
  return (locale === 'es' ? 'Lección ' : 'Lesson ') + piece.n + ': ' + (locale === 'es' ? piece.es : piece.form);
}

module.exports = createSorCollection({ folder: 'sor', catalog: 'pieces.json', prefix: 'sor-', pieceName });
