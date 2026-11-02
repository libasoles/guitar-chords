'use strict';
/* article-favorites.js — Pagina «Favoritas del editor»: las partituras marcadas `favorite` en editor-marks.js, de todas las
   colecciones, con las mismas tarjetas y modales que su articulo. Pagina oculta: noindex, fuera del sitemap y sin enlaces. */

const { PIECES } = require('./editor-marks');
const { isTranslated } = require('./translations');

/* Clave de editor-marks.js -> [modulo de la coleccion, clave del titulo de su articulo en strings, clave de slug de su articulo].
   En un idioma solo salen las colecciones cuyo articulo esta traducido a ese idioma. */
const COLLECTIONS = {
  sor: [require('./article-sor'), 'artSorH1', 'articulo-lecciones-sor'],
  'sor-estudios': [require('./article-sor-estudios'), 'artSorEstudiosH1', 'articulo-estudios-sor'],
  'carcassi-preludios': [require('./article-carcassi-preludes'), 'artPreludesH1', 'articulo-preludios-carcassi'],
  'santisteban-preludios': [require('./article-carcassi-preludes').santisteban, 'artSantistebanH1', 'articulo-preludios-santisteban'],
  'carcassi-valses': [require('./article-carcassi-preludes').waltzes, 'artWaltzesH1', 'articulo-valses-carcassi'],
  'carcassi-progresivas': [require('./article-carcassi-progressive'), 'artProgressiveH1', 'articulo-piezas-progresivas-carcassi'],
  aguado: [require('./article-aguado'), 'artAguadoH1', 'articulo-partituras-aguado'],
  sagreras: [require('./article-sagreras'), 'artSagrerasH1', 'articulo-lecciones-sagreras'],
  barrios: [require('./article-barrios'), 'artBarriosH1', 'articulo-partituras-barrios'],
  giuliani: [require('./article-giuliani'), 'artGiulianiH1', 'articulo-estudios-giuliani'],
  'giuliani-arpegios': [require('./article-giuliani-arpegios'), 'artGiulianiArpegiosH1', 'articulo-arpegios-giuliani'],
};

function renderBody(locale, strings) {
  return Object.keys(COLLECTIONS)
    .filter((key) => ((PIECES[key] || {}).favorite || []).length && isTranslated(COLLECTIONS[key][2], locale))
    .map((key) => {
      const [collection, titleKey] = COLLECTIONS[key];
      return '<section class="favorites-collection"><p class="favorites-collection-title">' + strings[titleKey] + '</p>' +
        collection.renderCards(locale, strings, PIECES[key].favorite) + '</section>';
    })
    .join('');
}

module.exports = { renderBody };
