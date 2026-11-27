'use strict';
const assert = require('node:assert/strict');
const sor = require('../scripts/lib/article-sor-op44');
const { pagePath } = require('../scripts/lib/slugs');
const { run, checkCollection, checkLateralNav, assertPdfServed } = require('./articles-harness');

run('articles-sor-op44', async (env) => {
  const published = sor.publishedPieces();
  assert.ok(published.length > 0);
  await checkCollection(env, {
    slug: 'articulo-piezas-sor-op44',
    locales: ['es', 'en', 'pt'],
    published,
    titles: (locale, pieces) => pieces.map((p) => sor.pieceName(p, locale)),
    firstSrc: /\/full\/sor-op44-4401-p1(?:\.[a-f0-9]+)?\.svg$/,
    extra: async (page, locale) => {
      for (const link of await page.locator('.prelude-card > .example-download').all()) {
        await assertPdfServed(env.context, env.base, await link.getAttribute('href'));
      }
      const title = await page.locator('h1').textContent();
      assert.match(title, /Op\. 44/);
      await page.goto(env.base + pagePath('partituras', locale));
      assert.equal(await page.locator('.article-card[href="' + pagePath('articulo-piezas-sor-op44', locale) + '"]').count(), 1);
      await page.goto(env.base + pagePath('articulo-piezas-sor-op44', locale));
    },
  });
  await checkLateralNav(env, 'articulo-piezas-sor-op44', ['es', 'en', 'pt']);
});
