'use strict';
/* Op. 44: colección independiente de las lecciones del Op. 60. */
const { createSorCollection } = require('./article-sor-collection');
const { pieceName } = require('./article-sor-estudios');
module.exports = createSorCollection({ folder: 'sor-op44', catalog: 'opus44.json', prefix: 'sor-op44-', pieceName });
