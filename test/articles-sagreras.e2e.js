'use strict';
const sagreras = require('../scripts/lib/article-sagreras');
const { run, checkCollection, checkLateralNav } = require('./articles-harness');

run('articles-sagreras', async (env) => {
  const published = sagreras.publishedPieces();
  await checkCollection(env, {
    slug: 'articulo-lecciones-sagreras',
    published,
    titles: (locale, published) => published.map((p) => new RegExp('^' + (locale === 'es' ? 'Lecci\u00f3n ' : 'Lesson ') + p.number + '$')),
    firstSrc: new RegExp('/full/lesson-' + String(published[0].number).padStart(2, '0') + '-p1(?:\\.[a-f0-9]+)?\\.svg$'),
    steps: true,
    download: true,
  });
  await checkLateralNav(env, 'articulo-lecciones-sagreras');
});
