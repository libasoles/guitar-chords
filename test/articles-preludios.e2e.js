'use strict';
const assert = require('node:assert/strict');
const { pagePath } = require('../scripts/lib/slugs');
const { publishedPreludes, santisteban } = require('../scripts/lib/article-carcassi-preludes');
const { run, checkLateralNav, assertPdfServed } = require('./articles-harness');

run('articles-preludios', async ({ base, context, page, BASE_URL }) => {
  // Carcassi preludes: one card per published prelude, in numeric order.
  for (const [editionKey, catalog, otherKey] of [
    ['articulo-preludios-carcassi', { publishedPreludes }, 'articulo-preludios-santisteban'],
    ['articulo-preludios-santisteban', santisteban, 'articulo-preludios-carcassi'],
  ]) {
    const published = catalog.publishedPreludes();
    for (const locale of ['es', 'en']) {
      const url = pagePath(editionKey, locale);
      await page.goto(base + url);
      assert.equal(await page.locator('.article-back a[href="' + pagePath(otherKey, locale) + '"]').count(), 1);
      assert.ok(await page.locator('.article-back a[href="' + pagePath(otherKey, locale) + '"]').evaluate((link) => Boolean(document.querySelector('.prelude-grid').compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING)));
      const cards = page.locator('.prelude-card');
      assert.equal(await cards.count(), published.length);
      const hrefs = await page.locator('.prelude-card > .example-download').evaluateAll((els) => els.map((el) => decodeURIComponent(el.getAttribute('href'))));
      assert.deepEqual(hrefs.map((href) => href.split('/').pop()), published.map((p) => p.pdf));
      const titles = await cards.locator('.prelude-open').allTextContents();
      titles.forEach((title, i) => assert.match(title, new RegExp('^' + (locale === 'es' ? 'Preludio ' : 'Prelude ') + published[i].number + ' (en|in) ')));
      // Inline static SVG with alternative text naming the prelude; no extra JS.
      assert.equal(await cards.locator('svg.score-svg').count(), published.length);
      const alts = await cards.locator('svg.score-svg').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
      alts.forEach((alt, i) => assert.ok(alt.includes(titles[i]), alt));
      const scripts = await page.locator('script[src]').evaluateAll((els) => els.map((el) => el.src));
      assert.ok(scripts.every((src) => src.includes('googletagmanager')), scripts.join(','));
      // Fits the phone viewport without horizontal scroll.
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(overflow <= 0, 'scroll horizontal de ' + overflow + 'px en ' + url);
      const rights = await cards.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().right));
      rights.forEach((right) => assert.ok(right <= 375, 'tarjeta fuera del viewport'));
      // On a phone the card does not open the preview: its title downloads the PDF directly.
      assert.equal(await cards.first().locator('.prelude-open').isVisible(), false);
      assert.equal(decodeURIComponent(await cards.first().locator('.prelude-pdf-link').getAttribute('href')).split('/').pop(), published[0].pdf);
      {
        const tab = await context.newPage();
        await tab.setViewportSize({ width: 375, height: 800 });
        await tab.goto(base + url);
        const [download] = await Promise.all([tab.waitForEvent('download'), tab.locator('.prelude-card').first().click()]);
        assert.equal(download.suggestedFilename(), published[0].pdf);
        assert.equal(await tab.locator('.modal-full:popover-open').count(), 0);
        await tab.close();
      }
      // On desktop, clicking the card opens a full-screen modal with the score pages (SVG), requested only on open; the X closes it.
      const fullRequests = () => page.evaluate(() => performance.getEntriesByType('resource').filter((e) => e.name.includes('/full/')).length);
      assert.equal(await page.locator('.modal-full:popover-open').count(), 0);
      await page.setViewportSize({ width: 1280, height: 800 });
      // (Blink loads lazy images that are already in its memory cache, so only the first visit is checked.)
      if (locale === 'es') assert.equal(await fullRequests(), 0);
      await cards.first().click();
      const modal = page.locator('.modal-full:popover-open');
      assert.equal(await modal.count(), 1);
      const box = await modal.evaluate((el) => { const r = el.getBoundingClientRect(); return [r.width, r.height]; });
      assert.deepEqual(box, [1280, 800]);
      // The footer sits at the bottom of the viewport even though the score is short, and the pages have no card background.
      assert.equal(await page.evaluate(() => innerHeight - Math.round(document.querySelector('.modal-full:popover-open .modal-footer').getBoundingClientRect().bottom)), 0);
      assert.equal(await modal.locator('img.modal-page').first().evaluate((img) => getComputedStyle(img).backgroundColor), 'rgba(0, 0, 0, 0)');
      const first = modal.locator('img.modal-page').first();
      await first.evaluate((img) => img.decode());
      assert.ok(await first.evaluate((img) => img.naturalWidth > 0 && img.getBoundingClientRect().right <= 1280 && img.getBoundingClientRect().width <= 1440));
      assert.match(await first.getAttribute('src'), /\/full\/(?:santisteban-)?prelude-01-p1(?:\.[a-f0-9]+)?\.svg$/);
      assert.ok(await fullRequests() >= 1);
      assert.equal(decodeURIComponent(await modal.locator('.modal-footer .modal-download').getAttribute('href')).split('/').pop(), published[0].pdf);
      assert.equal(await modal.locator('.modal-pages').evaluate((el) => getComputedStyle(el).maxWidth), '1440px');
      // The footer links to the relative key (C major -> A minor) and the dominant (G major), each replacing this preview.
      const keys = modal.locator('.modal-footer .modal-key');
      assert.equal(await keys.count(), 2);
      assert.equal(await keys.nth(0).locator('svg').count(), 1);
      assert.equal(await keys.nth(0).locator('.modal-key-label').evaluate((el) => getComputedStyle(el).color), 'rgb(118, 118, 118)');
      const expected = locale === 'es'
        ? [/^Preludio \d+ en La menor Relativo menor$/, /^Preludio \d+ en Sol mayor Dominante$/]
        : [/^Prelude \d+ in A minor Relative minor$/, /^Prelude \d+ in G major Dominant$/];
      const suffix = locale === 'es' ? [/La menor$/, /Sol mayor$/] : [/A minor$/, /G major$/];
      for (let k = 0; k < 2; k++) {
        assert.match(await keys.nth(k).evaluate((el) => Array.from(el.querySelectorAll('span')).map((s) => s.textContent).join(' ')), expected[k]);
        await keys.nth(k).click();
        assert.equal(await page.locator('.modal-full:popover-open').count(), 1);
        assert.match(await page.locator('.modal-full:popover-open').getAttribute('aria-label'), suffix[k]);
        await page.locator('.modal-full:popover-open .modal-close').click();
        assert.equal(await page.locator('.modal-full:popover-open').count(), 0);
        if (k === 0) await cards.first().click();
      }
      // The open modal is mirrored in the URL hash: opening sets it, closing clears it, and a reload or a shared link reopens it.
      await cards.first().click();
      const openId = await page.locator('.modal-full:popover-open').getAttribute('id');
      await page.waitForFunction((id) => location.hash === '#' + id, openId);
      await page.reload();
      assert.equal(await page.locator('.modal-full:popover-open').getAttribute('id'), openId);
      await page.locator('.modal-full:popover-open .modal-close').click();
      await page.waitForFunction(() => location.hash === '');
      await page.goto('about:blank');
      await page.goto(base + url + '#' + openId);
      assert.equal(await page.locator('.modal-full:popover-open').getAttribute('id'), openId);
      await page.locator('.modal-full:popover-open .modal-close').click();
      await page.setViewportSize({ width: 375, height: 800 });
      // Every card's PDF link serves a PDF; the first one is also clicked, which downloads it with the expected name.
      const pdfLinks = await page.locator('.prelude-card > .example-download').evaluateAll((els) => els.map((el) => el.getAttribute('href')));
      for (const href of pdfLinks) await assertPdfServed(context, base, href);
      {
        const tab = await context.newPage();
        await tab.setViewportSize({ width: 375, height: 800 });
        await tab.goto(base + url);
        const [download] = await Promise.all([tab.waitForEvent('download'), tab.locator('.prelude-card > .example-download').first().click()]);
        assert.equal(download.suggestedFilename(), published[0].pdf);
        await tab.close();
      }
      const links = await page.locator('link[rel=canonical], link[rel=alternate]').evaluateAll((els) => els.map((el) => [el.getAttribute('hreflang'), el.href]));
      assert.ok(links.some(([, href]) => href === BASE_URL + url));
      ['es', 'en'].forEach((l) => assert.ok(links.some(([lang, href]) => lang === l && href === BASE_URL + pagePath(editionKey, l))));
    }

  }
  for (const slug of ['articulo-preludios-carcassi', 'articulo-preludios-santisteban']) await checkLateralNav({ base, context, page }, slug);
});
