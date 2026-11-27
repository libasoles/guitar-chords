'use strict';
const sorEstudios = require('../scripts/lib/article-sor-estudios');
const { run, checkCollection, checkLateralNav } = require('./articles-harness');

run('articles-sor-estudios', async (env) => {
  const published = sorEstudios.publishedPieces();
  await checkCollection(env, {
    slug: 'articulo-estudios-sor',
    published,
    titles: (locale, published) => published.map((p) => sorEstudios.pieceName(p, locale)),
    firstSrc: /\/full\/sor-est-3501-p1(?:\.[a-f0-9]+)?\.svg$/,
  });
  await checkLateralNav(env, 'articulo-estudios-sor');
  const op6 = require('../scripts/lib/article-sor-op6');
  await checkCollection(env, {
    slug: 'articulo-estudios-sor-op6',
    published: op6.publishedPieces(),
    titles: (locale, pieces) => pieces.map((p) => op6.pieceName(p, locale)),
    firstSrc: /\/full\/sor-est-601-p1(?:\.[a-f0-9]+)?\.svg$/,
  });
  await checkLateralNav(env, 'articulo-estudios-sor-op6');
});
