'use strict';
const giulianiArpegios = require('../scripts/lib/article-giuliani-arpegios');
const { run, checkCollection, checkLateralNav } = require('./articles-harness');

run('articles-giuliani-arpegios', async (env) => {
  const published = giulianiArpegios.publishedPieces();
  await checkCollection(env, {
    slug: 'articulo-arpegios-giuliani',
    published,
    titles: (locale, published) => published.map((p) => giulianiArpegios.pieceName(p, locale)),
    firstSrc: /\/full\/arpeggio-01-p1(?:\.[a-f0-9]+)?\.svg$/,
  });
  await checkLateralNav(env, 'articulo-arpegios-giuliani');
});
