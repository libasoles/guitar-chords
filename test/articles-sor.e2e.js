'use strict';
const sor = require('../scripts/lib/article-sor');
const assert = require('node:assert/strict');
const { run, checkCollection, checkLateralNav, assertPdfServed } = require('./articles-harness');

run('articles-sor', async (env) => {
  const published = sor.publishedPieces();
  assert.deepEqual(published.map((piece) => piece.number), Array.from({ length: 25 }, (_, i) => i + 1));
  await checkCollection(env, {
    slug: 'articulo-lecciones-sor',
    locales: ['es', 'en', 'pt'],
    published,
    titles: (locale, published) => published.map((p) => sor.pieceName(p, locale)),
    firstSrc: /\/full\/sor-01-p1(?:\.[a-f0-9]+)?\.svg$/,
    extra: async (page, locale) => {
      if (locale === 'es') {
        for (const href of await page.locator('.prelude-card > .example-download').evaluateAll((links) => links.map((a) => a.href))) {
          await assertPdfServed(env.context, env.base, href);
        }
      }
      for (let i = 15; i < 25; i++) {
        await page.locator('.prelude-card').nth(i).locator('.prelude-open').click();
        const modal = page.locator('.modal-full:popover-open');
        for (const img of await modal.locator('img.modal-page').all()) {
          await img.evaluate((el) => el.decode());
          assert.ok(await img.evaluate((el) => el.naturalWidth > 0));
        }
        await modal.locator('.modal-close').click();
      }
    },
  });
  await checkLateralNav(env, 'articulo-lecciones-sor', ['es', 'en', 'pt']);
});
