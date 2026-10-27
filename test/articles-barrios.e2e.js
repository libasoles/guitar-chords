'use strict';
const barrios = require('../scripts/lib/article-barrios');
const { run, checkCollection, checkLateralNav } = require('./articles-harness');

run('articles-barrios', async (env) => {
  const published = barrios.publishedPieces();
  await checkCollection(env, {
    slug: 'articulo-partituras-barrios',
    published,
    titles: (locale, published) => published.map((p) => barrios.pieceName(p, locale)),
    firstSrc: /\/full\/barrios-01-p1(?:\.[a-f0-9]+)?\.svg$/,
  });
  await checkLateralNav(env, 'articulo-partituras-barrios');
});
