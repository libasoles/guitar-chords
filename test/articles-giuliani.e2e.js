'use strict';
const giuliani = require('../scripts/lib/article-giuliani');
const { run, checkCollection, checkLateralNav } = require('./articles-harness');

run('articles-giuliani', async (env) => {
  const published = giuliani.publishedPieces();
  await checkCollection(env, {
    slug: 'articulo-estudios-giuliani',
    published,
    titles: (locale, published) => published.map((p) => giuliani.pieceName(p, locale)),
    firstSrc: /\/full\/giuliani-01-p1(?:\.[a-f0-9]+)?\.svg$/,
  });
  await checkLateralNav(env, 'articulo-estudios-giuliani');
});
