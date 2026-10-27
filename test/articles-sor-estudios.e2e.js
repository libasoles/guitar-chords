'use strict';
const sorEstudios = require('../scripts/lib/article-sor-estudios');
const { run, checkCollection, checkLateralNav } = require('./articles-harness');

run('articles-sor-estudios', async (env) => {
  const published = sorEstudios.publishedPieces();
  await checkCollection(env, {
    slug: 'articulo-estudios-sor',
    published,
    titles: (locale, published) => published.map((p) => sorEstudios.pieceName(p, locale)),
    firstSrc: /\/full\/sor-est-601-p1(?:\.[a-f0-9]+)?\.svg$/,
  });
  await checkLateralNav(env, 'articulo-estudios-sor');
});
