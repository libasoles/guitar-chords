'use strict';
/* article-sor-estudios.js — Pagina «Estudios de Sor» (Op. 6 y Op. 35).
   Los archivos salen de scripts/sor/build.py (coleccion «estudios»); ver article-sor-collection.js. */

const { createSorCollection } = require('./article-sor-collection');

/* Titulo de la pieza: «Op. 35 No. 4: G Major» / «Op. 35 n.º 4: Sol mayor» (es el /Title del PDF en ingles). */
function pieceName(piece, locale) {
  return 'Op. ' + piece.opus + (locale === 'es' ? ' n.º ' : ' No. ') + piece.n + ': ' + (locale === 'es' ? piece.es : piece.form);
}

module.exports = createSorCollection({ folder: 'sor-estudios', catalog: 'estudios.json', prefix: 'sor-est-', pieceName });
