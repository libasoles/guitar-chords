'use strict';
const aguado = require('../scripts/lib/article-aguado');
const { run, checkCollection, checkLateralNav } = require('./articles-harness');

run('articles-aguado', async (env) => {
  const published = aguado.publishedPieces();
  await checkCollection(env, {
    slug: 'articulo-partituras-aguado',
    published,
    titles: (locale, published) => published.map((p) => aguado.pieceName(p, locale)),
    firstSrc: new RegExp('/full/aguado-' + String(published[0].number).padStart(2, '0') + '-p1(?:\\.[a-f0-9]+)?\\.svg$'),
  });
  await checkLateralNav(env, 'articulo-partituras-aguado');
});
