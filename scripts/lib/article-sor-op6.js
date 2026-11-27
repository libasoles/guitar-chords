'use strict';
/* Op. 6: pagina independiente; conserva las URL de los archivos publicados. */
const { createSorCollection } = require('./article-sor-collection');
const { pieceName } = require('./article-sor-estudios');
module.exports = createSorCollection({ folder: 'sor-estudios', catalog: 'estudios.json', prefix: 'sor-est-', pieceName, opus: 6, bodyFolder: 'sor-op6' });
