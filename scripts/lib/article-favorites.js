'use strict';
/* article-favorites.js — Pagina «Favoritas del editor»: las partituras marcadas `favorite` en editor-marks.js, de todas las
   colecciones, con las mismas tarjetas y modales que su articulo. Pagina oculta: noindex, fuera del sitemap y sin enlaces. */

const { PIECES } = require('./editor-marks');

/* Clave de editor-marks.js -> [modulo de la coleccion, clave del titulo de su articulo en strings]. */
const COLLECTIONS = {
  sor: [require('./article-sor'), 'artSorH1'],
  'sor-estudios': [require('./article-sor-estudios'), 'artSorEstudiosH1'],
  'carcassi-preludios': [require('./article-carcassi-preludes'), 'artPreludesH1'],
  'santisteban-preludios': [require('./article-carcassi-preludes').santisteban, 'artSantistebanH1'],
  'carcassi-valses': [require('./article-carcassi-preludes').waltzes, 'artWaltzesH1'],
  'carcassi-progresivas': [require('./article-carcassi-progressive'), 'artProgressiveH1'],
  aguado: [require('./article-aguado'), 'artAguadoH1'],
  sagreras: [require('./article-sagreras'), 'artSagrerasH1'],
  barrios: [require('./article-barrios'), 'artBarriosH1'],
  giuliani: [require('./article-giuliani'), 'artGiulianiH1'],
  'giuliani-arpegios': [require('./article-giuliani-arpegios'), 'artGiulianiArpegiosH1'],
};

function renderBody(locale, strings) {
  return Object.keys(COLLECTIONS)
    .filter((key) => ((PIECES[key] || {}).favorite || []).length)
    .map((key) => {
      const [collection, titleKey] = COLLECTIONS[key];
      return '<section class="favorites-collection"><p class="favorites-collection-title">' + strings[titleKey] + '</p>' +
        collection.renderCards(locale, strings, PIECES[key].favorite) + '</section>';
    })
    .join('');
}

module.exports = { renderBody };
