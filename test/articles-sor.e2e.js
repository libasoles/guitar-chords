'use strict';
const sor = require('../scripts/lib/article-sor');
const { run, checkCollection, checkLateralNav } = require('./articles-harness');

run('articles-sor', async (env) => {
  const published = sor.publishedPieces();
  await checkCollection(env, {
    slug: 'articulo-lecciones-sor',
    published,
    titles: (locale, published) => published.map((p) => sor.pieceName(p, locale)),
    firstSrc: /\/full\/sor-01-p1(?:\.[a-f0-9]+)?\.svg$/,
  });
  await checkLateralNav(env, 'articulo-lecciones-sor');
});
