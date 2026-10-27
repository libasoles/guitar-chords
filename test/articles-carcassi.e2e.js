'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pagePath } = require('../scripts/lib/slugs');
const { run } = require('./articles-harness');

const PDFS = [
  'Allegretto in C - Matteo Carcassi · (1792—1853).pdf',
  'Prelude A Minor, Op.59 - Matteo Carcassi.pdf',
];

run('articles-carcassi', async ({ base, page, tmp, BASE_URL }) => {
  for (const locale of ['es', 'en']) {
    const index = pagePath('articulos', locale);
    const article = pagePath('articulo-carcassi', locale);

    // Index: one card per article, linking to it.
    await page.goto(base + index);
    assert.equal(await page.locator('.article-card').count(), 13);
    assert.equal(await page.locator('.article-card').first().getAttribute('href'), article);
    assert.equal(await page.locator('.article-card').nth(1).getAttribute('href'), pagePath('articulo-preludios-carcassi', locale));
    assert.match(await page.locator('.article-card p').first().textContent(), /Carcassi/);
    const arpeggiosImage = page.locator('.article-card').nth(2).locator('img');
    assert.match(await arpeggiosImage.getAttribute('src'), /^\/assets\/articles\/arpeggios\/preview(?:\.[a-f0-9]+)?\.svg$/);
    await arpeggiosImage.evaluate((img) => img.decode());
    // No text link in the list besides the cards (the banner is the link).
    assert.equal(await page.locator('main a[href*="preludios"], main a[href*="preludes"]').count(), 2);

    // Article: static examples, no horizontal scroll on mobile.
    await page.goto(base + article);
    const pdfs = locale === 'es' ? PDFS.concat('Prelude 1 in C Major - Matteo Carcassi.pdf') : PDFS;
    assert.equal(await page.locator('.example-card .score-svg').count(), pdfs.length);
    assert.equal(await page.locator('.chord-card').count(), 2);
    // Chord cards are the finder's component: narrow, with the chord name.
    await page.waitForSelector('.chord-card .finder-card svg');
    assert.equal(await page.locator('.chord-card .finder-card').count(), 2);
    assert.ok(await page.locator('.chord-card .finder-card').first().evaluate((el) => el.getBoundingClientRect().width <= 180));
    assert.equal(await page.locator('.chord-card .finder-card .name').first().textContent(), 'C');
    // Tabs are read-only <ascii-tabs>: no copy button, no hint, no `x` marks.
    await page.waitForSelector('ascii-tabs .ascii-tabs-tab');
    assert.equal(await page.locator('pre').count(), 0);
    assert.equal(await page.locator('.ascii-tabs-copy, .ascii-tabs-hint').count(), 0);
    assert.ok(!(await page.locator('main').textContent()).includes(' x '));
    // The four Prelude chords share one tab per form: full, easy E7, Carcassi.
    const values = await page.locator('.sequence-forms ascii-tabs').evaluateAll((els) => els.map((el) => el.value[0].filter((c) => c.some((f) => f !== null))));
    assert.equal(values.length, 3);
    values.forEach((chords) => assert.equal(chords.length, 4));
    // Only the E7 changes between the two decomposed sequences.
    assert.deepEqual(values[1].slice(0, 3), values[2].slice(0, 3));
    assert.deepEqual(values[1][3], [0, 0, 1, null, null, 0]);
    assert.deepEqual(values[2][3], [0, 3, 1, null, 2, null]);
    // Letter labels on the strings.
    assert.match(await page.locator('.sequence-forms ascii-tabs').first().locator('.ascii-tabs-tab').first().innerText(), /^e\|/);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 0, 'scroll horizontal de ' + overflow + 'px en ' + article);
    // The score cards fit inside the viewport.
    const boxes = await page.locator('.example-card').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().right));
    boxes.forEach((right) => assert.ok(right <= 375, 'tarjeta fuera del viewport'));

    // The shared C-major example must agree with the original edition's G7/B.
    if (locale === 'es') {
      const forms = await page.locator('.bass-forms ascii-tabs').last().evaluate((el) => el.value[0].filter((c) => c.some((f) => f !== null)));
      const sounding = forms[1].flatMap((f, i) => f === null ? [] : [[64, 59, 55, 50, 45, 40][i] + f]).sort((a, b) => a - b);
      const xml = fs.readFileSync(path.join(__dirname, '../scripts/carcassi-preludios/corrected/prelude-01.musicxml'), 'utf8');
      const measure = [...xml.matchAll(/<measure\b[^>]*>([\s\S]*?)<\/measure>/g)][3][1];
      const pitches = new Set();
      let offset = 0;
      for (const [, tag, content] of measure.matchAll(/<(note|backup)\b[^>]*>([\s\S]*?)<\/\1>/g)) {
        const duration = Number(content.match(/<duration>(\d+)<\/duration>/)[1]);
        if (tag === 'backup') { offset -= duration; continue; }
        const step = content.match(/<step>([A-G])<\/step>/);
        if (step && offset >= 8) {
          const octave = Number(content.match(/<octave>(\d)<\/octave>/)[1]);
          const alter = Number((content.match(/<alter>(-?\d+)<\/alter>/) || [null, 0])[1]);
          pitches.add(12 * octave + { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[step[1]] + alter);
        }
        offset += duration;
      }
      assert.deepEqual(sounding, [...pitches].sort((a, b) => a - b));
    }

    // Only analytics, ascii-tabs and the site's own chord card scripts: the scores are static SVG.
    const scripts = await page.locator('script[src]').evaluateAll((els) => els.map((el) => el.src));
    assert.ok(scripts.every((src) => src.includes('googletagmanager') || /vendor\/(ascii-tabs|svguitar)|\/assets\/chord-(diagram|card)/.test(src)), scripts.join(','));

    // Each card downloads its score PDF.
    const cards = page.locator('.example-card');
    for (let i = 0; i < pdfs.length; i++) {
      const [download] = await Promise.all([page.waitForEvent('download'), cards.nth(i).click()]);
      assert.equal(download.suggestedFilename(), pdfs[i]);
      const saved = path.join(tmp, 'download-' + i + '.pdf');
      await download.saveAs(saved);
      assert.equal(fs.readFileSync(saved).subarray(0, 4).toString(), '%PDF');
    }

    // Canonical and hreflang pair.
    const links = await page.locator('link[rel=canonical], link[rel=alternate]').evaluateAll((els) => els.map((el) => [el.getAttribute('hreflang'), el.href]));
    assert.ok(links.some(([, href]) => href === BASE_URL + article));
    assert.ok(links.some(([lang, href]) => lang === 'es' && href === BASE_URL + pagePath('articulo-carcassi', 'es')));
    assert.ok(links.some(([lang, href]) => lang === 'en' && href === BASE_URL + pagePath('articulo-carcassi', 'en')));
  }
});
