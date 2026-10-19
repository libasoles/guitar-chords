/* E2E for Partitura y tablatura and the privacy policy.

   Builds the site into a temp directory twice (without and with the API URL),
   serves it and drives the tool with the API, Turnstile and uploads mocked by
   network interception, in both locales. Needs no AWS and no real Turnstile. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { chromium } = require('playwright');
const { playwrightExecutablePath } = require('../scripts/lib/chrome-path');
const { serveStatic } = require('../scripts/lib/static-server');
const { pagePath, pageFile } = require('../scripts/lib/slugs');

const ROOT = path.join(__dirname, '..');
const API = 'https://api.partitura.test';
const FILES = 'https://files.partitura.test';
const JOB = 'job-abc123XYZ';
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': '*',
};

function build(outDir, env) {
  const result = spawnSync('node', [path.join(ROOT, 'scripts', 'build-site.js')], {
    cwd: ROOT,
    env: Object.assign({}, process.env, { SITE_OUT_DIR: outDir, PARTITURA_API_URL: '' }, env),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

const SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="800px" height="200px">',
  '<g class="measure" id="x-m1"><path d="M0 60H400" stroke="#000" fill="none"/>',
  '<g class="note" id="x-n2" data-id="tab-note-1"><g class="notehead"><ellipse cx="250" cy="80" rx="8" ry="6"/></g></g>',
  '<g class="note" id="x-n1" data-id="tab-note-0"><g class="notehead"><ellipse cx="100" cy="80" rx="8" ry="6"/></g></g></g>',
  '<g class="measure" id="x-m2"><path d="M400 60H800" stroke="#000" fill="none"/>',
  '<g class="note" id="x-n4" data-id="tab-note-3"><g class="notehead"><ellipse cx="560" cy="80" rx="8" ry="6"/></g></g>',
  '<g class="note" id="x-n3" data-id="tab-note-2"><g class="notehead"><ellipse cx="460" cy="80" rx="8" ry="6"/></g></g></g>',
  '</svg>',
].join('');

const PREVIEW = { staff_space: 10, rows: [{ svg: 'preview-01.svg', first: 0, last: 1 }] };
const SUGGESTION = {
  version: 1,
  tabs: [
    [[null, null, null, 2, null, null], [null, null, 0, null, null, 3]],
    [[null, 1, null, null, null, null], [12, null, null, null, null, 5]],
  ],
  preview_columns: [
    [{ note_ids: ['tab-note-0'], bass_strings: [3] }, { note_ids: ['tab-note-1'], bass_strings: [5] }],
    [{ note_ids: ['tab-note-2'], bass_strings: [] }, { note_ids: ['tab-note-3'], bass_strings: [5] }],
  ],
  dropped: [{ measure: 2, pitch: 'C#2' }],
  title: 'Camino de las Tropas',
  subtitles: ['Falú', 'Trans. X'],
};
const DROPPED = [{ measure: 2, pitch: 'C#2' }];

const DOWNLOADS = {
  pdf: FILES + '/out.pdf',
  musicxml: FILES + '/out.musicxml',
  tabs: FILES + '/out.json',
  intermediate: FILES + '/intermediate.musicxml',
};

function json(route, body, status) {
  return route.fulfill({
    status: status || 200,
    contentType: 'application/json',
    headers: CORS,
    body: JSON.stringify(body),
  });
}

/* Installs the API mock. `script` drives GET /jobs/:id: an array of job
   objects returned in order (the last one repeats). */
async function mockApi(page, options) {
  const state = {
    calls: [],
    createError: options.createError || null,
    jobs: options.jobs.slice(),
    exportBody: null,
    exported: false,
  };
  await page.addInitScript(() => {
    let cfg;
    Object.defineProperty(window, 'PARTITURA_CONFIG', {
      configurable: true,
      get() { return cfg; },
      set(value) { cfg = Object.assign(value, { pollMs: 80 }); },
    });
  });
  await page.route('https://challenges.cloudflare.com/**', route =>
    route.fulfill({
      contentType: 'text/javascript',
      body: `window.turnstile = {
        render(node, opts) { node.dataset.sitekey = opts.sitekey; setTimeout(() => opts.callback('token-' + (window.__ts = (window.__ts || 0) + 1)), 10); return 'w1'; },
        reset() { setTimeout(() => window.dispatchEvent(new Event('ts-reset')), 0); },
      };`,
    }));
  await page.route(FILES + '/**', route => {
    const url = route.request().url();
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (url.endsWith('/preview.json')) return json(route, options.preview || PREVIEW);
    if (url.endsWith('/suggestion.json')) return json(route, SUGGESTION);
    if (url.endsWith('/preview-01.svg')) {
      return route.fulfill({ contentType: 'image/svg+xml', headers: CORS, body: options.svg || SVG });
    }
    if (url.endsWith('.pdf')) {
      return route.fulfill({
        contentType: 'application/pdf',
        headers: Object.assign({ 'content-disposition': 'attachment; filename="out.pdf"' }, CORS),
        body: '%PDF-1.4 mock',
      });
    }
    return route.fulfill({ contentType: 'text/plain', headers: CORS, body: 'x' });
  });
  await page.route('https://upload.partitura.test/**', route => {
    state.calls.push('UPLOAD ' + route.request().method());
    return route.fulfill({ status: route.request().method() === 'OPTIONS' ? 204 : 200, headers: CORS });
  });
  await page.route(API + '/**', route => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const pathname = new URL(req.url()).pathname;
    const call = req.method() + ' ' + pathname;
    state.calls.push(call);
    if (call === 'POST /jobs') {
      state.createBody = req.postDataJSON();
      if (state.createError) {
        return json(route, { error: { code: state.createError, message: 'x' } }, 429);
      }
      return json(route, {
        id: JOB,
        upload: { url: 'https://upload.partitura.test/post/' + JOB, fields: { key: 'jobs/x/input' } },
      }, 201);
    }
    if (call === 'POST /jobs/' + JOB + '/process') return json(route, {});
    if (call === 'POST /jobs/' + JOB + '/export') {
      state.exportBody = req.postDataJSON();
      state.exportCount = (state.exportCount || 0) + 1;
      state.exported = false;
      state.exportPolls = 0;
      return json(route, {});
    }
    if (call === 'GET /jobs/' + JOB + '/downloads') {
      return json(route, { id: JOB, status: 'exported', downloads: DOWNLOADS });
    }
    if (call === 'GET /jobs/' + JOB) {
      if (state.exportBody !== null && !state.exported) {
        state.exportPolls += 1;
        if (state.exportPolls < 2) return json(route, { status: 'exporting', elapsedSeconds: 1 });
        state.exported = true;
        return json(route, Object.assign({}, READY, { status: 'exported' }));
      }
      const next = state.jobs.length > 1 ? state.jobs.shift() : state.jobs[0];
      if (next.httpStatus) return json(route, { error: { code: next.error, message: 'x' } }, next.httpStatus);
      return json(route, next);
    }
    return json(route, { error: 'unknown' }, 404);
  });
  return state;
}

const READY = {
  id: JOB,
  status: 'ready',
  stage: null,
  elapsedSeconds: 12,
  discardedNotes: DROPPED,
  preview: {
    json: FILES + '/preview.json',
    suggestion: FILES + '/suggestion.json',
    svgs: [FILES + '/preview-01.svg'],
  },
};

async function fillForm(page, name) {
  await page.locator('#partRights').check();
  await page.locator('#partFile').setInputFiles({
    name: name || 'score.musicxml',
    mimeType: 'application/xml',
    buffer: Buffer.from('<score-partwise/>'),
  });
}

(async function () {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'partitura-e2e-'));
  const withoutDir = path.join(tmp, 'without');
  const withDir = path.join(tmp, 'with');
  build(withoutDir, {});
  build(withDir, { PARTITURA_API_URL: API });

  // Without the API URL the tool, its banner and its home links do not exist.
  for (const file of [pageFile('partitura-y-tablatura', 'es'), pageFile('partitura-y-tablatura', 'en')]) {
    assert.ok(!fs.existsSync(path.join(withoutDir, file)), file + ' must not be generated');
  }
  for (const file of ['index.html', 'en/index.html']) {
    const html = fs.readFileSync(path.join(withoutDir, file), 'utf8');
    assert.ok(!html.includes('partitura-y-tablatura') && !html.includes('sheet-music-to-tab'), file + ' links to the tool');
    assert.ok(!html.includes('part-promo'), file + ' has the banner');
  }
  assert.ok(!/partitura-y-tablatura|sheet-music-to-tab/.test(fs.readFileSync(path.join(withoutDir, 'sitemap.xml'), 'utf8')));
  for (const file of [pageFile('politica-de-privacidad', 'es'), pageFile('politica-de-privacidad', 'en')]) {
    assert.ok(fs.existsSync(path.join(withoutDir, file)), file + ' must always be generated');
  }

  for (const locale of ['es', 'en']) {
    const html = fs.readFileSync(path.join(withDir, pageFile('partitura-y-tablatura', locale)), 'utf8');
    assert.ok(!/%%part\w+%%/.test(html), 'unresolved partitura translation in ' + locale);
    const strings = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/i18n/strings.' + locale + '.json'), 'utf8'));
    assert.ok(html.includes('<h2 class="part-duration">' + strings.partDurationHint + '</h2>'));
  }

  const server = await serveStatic(withDir, 0);
  const base = 'http://localhost:' + server.address().port;
  let browser;
  try {
    browser = await chromium.launch({ executablePath: playwrightExecutablePath() });
    const sitemap = fs.readFileSync(path.join(withDir, 'sitemap.xml'), 'utf8');
    assert.ok(sitemap.includes(pagePath('partitura-y-tablatura', 'es') + '<') && sitemap.includes(pagePath('partitura-y-tablatura', 'en') + '<'));
    assert.ok(sitemap.includes(pagePath('politica-de-privacidad', 'es') + '<') && sitemap.includes(pagePath('politica-de-privacidad', 'en') + '<'));

    for (const locale of ['es', 'en']) {
      const prefix = locale === 'en' ? '/en' : '';
      const S = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'i18n', 'strings.' + locale + '.json'), 'utf8'));
      const toolUrl = base + pagePath('partitura-y-tablatura', locale);

      // Privacy policy and the footer link on every kind of page.
      {
        const page = await browser.newPage();
        await page.goto(base + pagePath('politica-de-privacidad', locale));
        assert.equal(await page.locator('h1').textContent(), S.privH1);
        assert.ok((await page.locator('main').textContent()).includes('hola@acordesdeguitarra.com.ar'));
        for (const url of [prefix + '/', pagePath('crear-tablaturas-de-guitarra', locale), pagePath('circulo-de-quintas', locale), pagePath('partitura-y-tablatura', locale)]) {
          await page.goto(base + url);
          const link = page.locator('a[href="' + pagePath('politica-de-privacidad', locale) + '"]').last();
          assert.ok(await link.count(), 'footer privacy link on ' + url);
        }
        // Home banner: lazy, fixed dimensions, links to the tool.
        await page.goto(base + (prefix || '/'));
        const img = page.locator('.part-promo-img');
        assert.equal(await img.getAttribute('loading'), 'lazy');
        assert.equal(await img.getAttribute('width'), '480');
        assert.equal(await img.getAttribute('height'), '436');
        assert.equal(await page.locator('.part-promo-link').getAttribute('href'), pagePath('partitura-y-tablatura', locale));
        await page.close();
      }

      // The example is a full row of real notation and TAB, with the TAB clef
      // and string names, aligned on resize.
      {
        const page = await browser.newPage();
        await mockApi(page, { jobs: [READY] });
        await page.goto(toolUrl);
        assert.equal(await page.locator('.part-example strong').textContent(), S.partExampleTitle);
        assert.equal(await page.locator('.part-example figcaption span').textContent(), S.partExampleCaption);
        assert.equal(await page.locator('.part-example img, .part-example image').count(), 0);
        for (const width of [1100, 800]) {
          await page.setViewportSize({ width, height: 1000 });
          await page.waitForFunction(() => {
            const root = document.querySelector('#partExampleScore');
            const example = window.PARTITURA_CONFIG.example;
            const all = Array.from(root.querySelectorAll('ascii-tabs'));
            const cells = example.measures.reduce((n, m) => n + m.reduce((k, a) => k + a.frets.filter(f => f !== null).length, 0), 0);
            if (all.length !== example.measures.length || root.querySelectorAll('.ascii-tabs-has').length !== cells) return false;
            const center = node => {
              const box = node.getBoundingClientRect();
              return box.left + box.width / 2;
            };
            return example.measures.every((attacks, m) => attacks.every((attack, c) => {
              const positions = attack.noteIds.map(id => center(root.querySelector('[data-id="' + id + '"] .notehead')));
              const x = positions.reduce((a, b) => a + b) / positions.length;
              const cell = all[m].querySelector('.ascii-tabs-has[data-c="' + c + '"]');
              return cell && Math.abs(x - center(cell)) < 3;
            }));
          });
          assert.ok(await page.locator('.part-example ascii-tabs').first().evaluate(tabs => tabs.readonly));
          assert.equal((await page.locator('.part-example-clef').allTextContents()).join(''), 'TAB');
          assert.equal(await page.locator('.part-example .part-row-join').count(), 1);
          // The TAB lines start on the barline, never left of it.
          assert.ok(await page.evaluate(() => {
            const join = document.querySelector('.part-example .part-row-join').getBoundingClientRect();
            const tabs = document.querySelector('.part-example ascii-tabs');
            const inset = parseFloat((tabs.style.clipPath.match(/inset\(0px 0px 0px ([\d.]+)px\)|inset\(0 0 0 ([\d.]+)px\)/) || [])[1] || (tabs.style.clipPath.match(/([\d.]+)px\)/) || [])[1] || 0);
            return tabs.getBoundingClientRect().left + inset >= join.left - 0.5;
          }));
          // The author sits at the right, below the title, as in the PDF.
          assert.ok(await page.evaluate(() => {
            const title = document.querySelector('.part-example-title').getBoundingClientRect();
            const author = document.querySelector('.part-example-header span').getBoundingClientRect();
            const frame = document.querySelector('.part-example-score');
            const box = getComputedStyle(frame);
            return author.top >= title.bottom - 1 &&
              Math.abs(frame.getBoundingClientRect().right - parseFloat(box.paddingRight) - 1 - author.right) < 3;
          }));
          // On desktop the row fills the frame's padding box exactly (centered).
          if (width === 1100) assert.ok(await page.evaluate(() => {
            const frame = document.querySelector('.part-example-score');
            const box = getComputedStyle(frame);
            const svg = frame.querySelector('.part-row-notation svg').getBoundingClientRect();
            const inner = frame.getBoundingClientRect();
            const left = svg.left - inner.left - parseFloat(box.paddingLeft);
            const right = inner.right - svg.right - parseFloat(box.paddingRight);
            return Math.abs(left) < 3 && Math.abs(right) < 3;
          }));
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        }
        // Phones have no preview, so the example is hidden there.
        await page.setViewportSize({ width: 390, height: 1000 });
        assert.ok(await page.locator('.part-example').isHidden());
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.close();
      }

      // On a phone the example is neither shown nor rendered, and the
      // ascii-tabs module is not requested.
      {
        const page = await browser.newPage({ viewport: { width: 390, height: 800 } });
        await mockApi(page, { jobs: [READY] });
        const requested = [];
        page.on('request', request => requested.push(request.url()));
        await page.goto(toolUrl);
        assert.ok(await page.locator('.part-example').isHidden());
        assert.equal(await page.locator('#partExampleScore ascii-tabs').count(), 0);
        assert.equal(requested.filter(url => /ascii-tabs/.test(url)).length, 0);
        await page.close();
      }

      // Cloudflare's script and the toast bundle stay out of the page load and
      // arrive with the first interaction with the form.
      {
        const page = await browser.newPage();
        await mockApi(page, { jobs: [READY] });
        const requested = [];
        page.on('request', request => requested.push(request.url()));
        await page.goto(toolUrl);
        await page.waitForLoadState('networkidle');
        assert.equal(requested.filter(url => /turnstile|\/toast[.\w]*\.js/.test(url)).length, 0, 'nothing before interaction');
        assert.equal(await page.evaluate(() => typeof window.SiteToast), 'undefined');
        await page.locator('#partRights').check();
        await page.waitForFunction(() => window.SiteToast && document.querySelector('#partTurnstile').dataset.sitekey);
        assert.equal(requested.filter(url => /turnstile/.test(url)).length, 1);
        assert.equal(requested.filter(url => /\/toast[.\w]*\.js/.test(url)).length, 1);
        await page.close();
      }

      // Rights checkbox gates the upload; privacy details stay visible with one footer link.
      {
        const page = await browser.newPage();
        await mockApi(page, { jobs: [READY] });
        await page.goto(toolUrl);
        assert.ok(await page.locator('#partFile').isEnabled());
        assert.equal(await page.locator('#partSubmit, #partTuning').count(), 0);
        assert.equal(await page.locator('#partDropzone').getAttribute('aria-disabled'), 'false');
        assert.equal(await page.locator('#partRightsLabel').textContent(), S.partRightsLabel);
        assert.equal(await page.locator('#partDropTitle').textContent(), S.partDropTitle);
        const contrast = await page.evaluate(() => {
          function luminance(color) {
            const rgb = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => {
              const c = value / 255;
              return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
            });
            return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
          }
          function ratio(a, b) {
            const x = luminance(a), y = luminance(b);
            return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
          }
          const zone = getComputedStyle(document.querySelector('#partDropzone'));
          const hint = getComputedStyle(document.querySelector('#partDropHint'));
          const checkbox = getComputedStyle(document.querySelector('#partRights'));
          return {
            text: ratio(hint.color, zone.backgroundColor),
            border: ratio(zone.borderTopColor, zone.backgroundColor),
            checkbox: ratio(checkbox.borderTopColor, checkbox.backgroundColor),
            width: document.querySelector('#partDropzone').getBoundingClientRect().width,
            available: document.querySelector('main').getBoundingClientRect().width,
          };
        });
        assert.ok(contrast.text >= 4.5);
        assert.ok(contrast.border >= 3 && contrast.checkbox >= 3);
        assert.ok(Math.abs(contrast.width - contrast.available) < 2);
        await page.locator('#partRights').check();
        assert.ok(await page.locator('#partFile').isEnabled());
        assert.equal(await page.locator('#partDropzone').getAttribute('aria-disabled'), 'false');
        assert.ok(await page.locator('.part-privacy p').first().isVisible());
        assert.equal(await page.locator('.part-privacy a').count(), 0);
        assert.equal(await page.locator('a[href="' + pagePath('politica-de-privacidad', locale) + '"]').count(), 1);
        assert.equal(
          await page.locator('.privacy-link a').getAttribute('href'),
          pagePath('politica-de-privacidad', locale),
        );
        // Turnstile script only loads on this page, widget gets the site key.
        await page.waitForFunction(() => document.querySelector('#partTurnstile').dataset.sitekey);
        assert.equal(
          await page.locator('#partTurnstile').getAttribute('data-sitekey'),
          '0x4AAAAAAFX8ivpyYAAvr-8D',
        );
        await page.close();
      }

      // Dropping is gated by rights and starts exactly one automatic upload.
      {
        const page = await browser.newPage();
        const api = await mockApi(page, { jobs: [READY] });
        await page.goto(toolUrl);
        async function dropScore() {
          await page.locator('#partDropzone').evaluate(node => {
            const data = new DataTransfer();
            data.items.add(new File(['<score-partwise/>'], 'dropped.musicxml', { type: 'application/xml' }));
            node.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: data }));
          });
        }
        await dropScore();
        assert.equal(api.calls.length, 0);
        assert.ok(await page.locator('.part-rights.needs-rights').count());
        assert.equal(await page.locator('#partRightsError').textContent(), S.partErrRights);
        assert.ok(await page.locator('#partRightsError').isVisible());
        assert.equal(await page.locator('.toast').count(), 0);
        assert.equal(await page.locator('#partRights').getAttribute('aria-describedby'), 'partRightsError');
        assert.equal(await page.locator('#partDropTitle').textContent(), 'dropped.musicxml');
        assert.ok(await page.locator('#partRights').evaluate(node => node === document.activeElement));
        await page.locator('#partRights').check();
        await dropScore();
        await page.waitForSelector('#partRows .part-row');
        assert.equal(api.createBody.filename, 'dropped.musicxml');
        assert.equal(api.createBody.tuning, 'auto');
        assert.equal(api.calls.filter(call => call === 'POST /jobs').length, 1);
        await page.close();
      }

      // Selecting first also waits for consent, with accessible mobile sizing.
      {
        const page = await browser.newPage({ viewport: { width: 375, height: 800 }, reducedMotion: 'reduce' });
        const api = await mockApi(page, { jobs: [READY] });
        await page.goto(toolUrl);
        const sizing = await page.evaluate(() => {
          const box = document.querySelector('#partRights').getBoundingClientRect();
          const zone = document.querySelector('#partDropzone').getBoundingClientRect();
          const main = document.querySelector('main').getBoundingClientRect();
          return { checkbox: box.width, width: zone.width, available: main.width };
        });
        assert.ok(sizing.checkbox >= 28);
        assert.ok(Math.abs(sizing.width - sizing.available) < 2);
        await page.locator('#partFile').setInputFiles({ name: 'pending.musicxml', mimeType: 'application/xml', buffer: Buffer.from('<score-partwise/>') });
        assert.equal(api.calls.length, 0);
        assert.equal(await page.locator('#partDropTitle').textContent(), 'pending.musicxml');
        const highlight = await page.locator('.part-rights').evaluate(node => {
          const style = getComputedStyle(node);
          return { border: style.borderTopWidth, background: style.backgroundColor };
        });
        assert.equal(highlight.border, '0px');
        assert.equal(highlight.background, 'rgb(250, 246, 238)');
        const inlineError = await page.locator('#partRightsError').evaluate(node => {
          const label = document.querySelector('#partRightsLabel');
          const box = node.getBoundingClientRect();
          const text = label.getBoundingClientRect();
          const checkbox = document.querySelector('#partRights').getBoundingClientRect();
          return { aligned: Math.abs(box.left - checkbox.left) < 1, gap: box.top - text.bottom, smaller: parseFloat(getComputedStyle(node).fontSize) < parseFloat(getComputedStyle(label).fontSize) };
        });
        assert.ok(inlineError.aligned && inlineError.gap >= 0 && inlineError.gap <= 3 && inlineError.smaller);
        assert.equal(await page.locator('.part-rights').evaluate(node => getComputedStyle(node).animationName), 'none');
        const processed = page.waitForResponse(response => response.url().endsWith('/process'));
        await page.locator('#partRights').check();
        await processed;
        assert.equal(api.createBody.filename, 'pending.musicxml');
        assert.ok(await page.locator('#partRightsError').isHidden());
        await page.close();
      }

      // Consent remains visible for 500 ms, then both panels crossfade in place.
      for (const viewport of [{ width: 1280, height: 900 }, { width: 375, height: 800 }]) {
        const page = await browser.newPage({ viewport });
        await mockApi(page, { jobs: [READY] });
        let releaseUpload;
        const gate = new Promise(resolve => { releaseUpload = resolve; });
        await page.route('https://upload.partitura.test/**', async route => {
          if (route.request().method() !== 'OPTIONS') await gate;
          return route.fulfill({ status: 200, headers: CORS });
        });
        await page.goto(toolUrl);
        await page.locator('#partFile').setInputFiles({ name: 'score.musicxml', mimeType: 'application/xml', buffer: Buffer.from('<score-partwise/>') });
        await page.locator('#partRights').check();
        const before = await page.locator('.part-how').boundingBox();
        assert.ok(await page.locator('#partRights').isChecked());
        assert.ok(await page.locator('#partRightsRow').isVisible());
        assert.ok(await page.locator('#partProgress').isHidden());
        await page.waitForTimeout(250);
        assert.ok(await page.locator('#partRightsRow').isVisible());
        assert.ok(await page.locator('#partProgress').isHidden());
        await page.waitForSelector('#partProgress:not([hidden])');
        const entrance = await page.locator('#partProgress').evaluate(node => {
          const animation = node.getAnimations()[0];
          return animation.effect.getKeyframes().map(frame => ({ opacity: frame.opacity, transform: frame.transform }));
        });
        assert.equal(entrance[0].opacity, '0');
        assert.equal(entrance[0].transform, 'scale(0.85)');
        await page.waitForFunction(() => getComputedStyle(document.querySelector('#partForm')).visibility === 'hidden');
        const geometry = await page.evaluate(() => {
          const form = document.querySelector('#partForm').getBoundingClientRect();
          const loading = document.querySelector('#partProgress').getBoundingClientRect();
          const svg = document.querySelector('.part-loading').getBoundingClientRect();
          const subtitle = document.querySelector('.part-resume').getBoundingClientRect();
          const status = document.querySelector('#partStatus').getBoundingClientRect();
          const elapsed = document.querySelector('#partElapsed').getBoundingClientRect();
          return {
            form: { top: form.top, height: form.height },
            loading: { top: loading.top, height: loading.height },
            svgGapAbove: svg.top - subtitle.bottom,
            svgGapBelow: status.top - svg.bottom,
            elapsedGap: elapsed.top - status.bottom,
            title: getComputedStyle(document.querySelector('.part-duration')).textAlign,
            subtitle: getComputedStyle(document.querySelector('.part-resume')).textAlign,
          };
        });
        assert.deepEqual(geometry.form, geometry.loading);
        assert.equal(geometry.title, 'left');
        assert.equal(geometry.subtitle, 'left');
        assert.ok(geometry.svgGapAbove >= 36 && geometry.svgGapAbove <= 40, 'loader has extra space above: ' + JSON.stringify(geometry));
        assert.ok(geometry.svgGapBelow >= 0 && geometry.svgGapBelow <= 4, 'loader has a small gap below: ' + JSON.stringify(geometry));
        assert.ok(geometry.elapsedGap >= 0 && geometry.elapsedGap <= 8, 'loader status and elapsed time stay closely grouped: ' + JSON.stringify(geometry));
        const after = await page.locator('.part-how').boundingBox();
        assert.ok(Math.abs(before.y - after.y) < 1, 'content below the upload does not shift');
        assert.ok(await page.locator('.part-example').isHidden());
        assert.ok(await page.locator('#partDropzone').isHidden());
        assert.ok(await page.locator('#partRightsRow').isHidden());
        assert.equal(await page.locator('.part-duration').textContent(), S.partDurationHint);
        releaseUpload();
        if (viewport.width >= 768) await page.waitForSelector('#partRows .part-row');
        else await page.waitForSelector('.part-mobile-ready');
        await page.close();
      }

      // Each system clips the first TAB measure to the vertical joining barline.
      {
        const page = await browser.newPage();
        const ready = Object.assign({}, READY, {
          preview: Object.assign({}, READY.preview, {
            svgs: [FILES + '/preview-01.svg', FILES + '/preview-01.svg'],
          }),
        });
        await mockApi(page, {
          jobs: [ready],
          preview: { staff_space: 10, rows: [
            { first: 0, last: 0 }, { first: 1, last: 1 },
          ] },
          // As in Verovio, the measure box extends left of the staff paths.
          svg: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="140">' +
            '<g class="measure"><path d="M0 60H400" stroke="black"/>' +
            '<g class="staff"><path d="M8 60H400 M8 70H400 M8 80H400 M8 90H400 M8 100H400" stroke="black"/></g>' +
            '</g></svg>',
        });
        await page.goto(toolUrl + '?trabajo=' + JOB);
        await page.waitForSelector('#partRows .part-row-join');
        for (const width of [1280, 900]) {
          await page.setViewportSize({ width, height: 900 });
          // Wait for both layout animation frames after a resize.
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          const starts = await page.locator('#partRows .part-row').evaluateAll(rows => rows.map(row => {
            const tabs = row.querySelector('ascii-tabs');
            const clip = getComputedStyle(tabs).clipPath;
            const values = clip.startsWith('inset(') ? clip.slice(6, -1).split(/\s+/).map(parseFloat) : [];
            const inset = values.length === 4 ? values[3] : 0;
            return {
              start: tabs.getBoundingClientRect().left + inset,
              barline: row.querySelector('.part-row-join').getBoundingClientRect().left,
            };
          }));
          assert.equal(starts.length, 2);
          starts.forEach((row, i) => assert.ok(Math.abs(row.start - row.barline) < 0.5,
            'system ' + (i + 1) + ' TAB lines start at the barline: ' + JSON.stringify(row)));
        }
        await page.locator('#partNotation').check();
        await page.waitForFunction(() => [...document.querySelectorAll('#partRows .part-row')].every(row => {
          const tabs = row.querySelector('ascii-tabs');
          return getComputedStyle(tabs).clipPath.startsWith('inset(');
        }));
        await page.close();
      }

      // Desktop flow: create, upload, process, poll, preview, edit, export.
      {
        const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        const api = await mockApi(page, {
          jobs: [
            { status: 'processing', stage: 'ocr', elapsedSeconds: 7 },
            { status: 'processing', stage: 'preparing', elapsedSeconds: 9 },
            READY,
          ],
        });
        await page.goto(toolUrl);
        await fillForm(page, 'score.musicxml');
        await page.waitForFunction(() => /7|9|8/.test(document.querySelector('#partElapsed').textContent));
        assert.ok(/\d/.test(await page.locator('#partElapsed').textContent()));
        await page.waitForSelector('#partRows .part-row');
        assert.equal(api.createBody.filename, 'score.musicxml');
        assert.equal(api.createBody.kind, 'musicxml');
        assert.equal(api.createBody.tuning, 'auto');
        assert.ok(/^token-/.test(api.createBody.turnstileToken));
        assert.ok(api.calls.includes('UPLOAD POST'));
        assert.ok(api.calls.indexOf('POST /jobs/' + JOB + '/process') > api.calls.indexOf('UPLOAD POST'));
        assert.equal(new URL(page.url()).searchParams.get('trabajo'), JOB);

        const previewSize = await page.locator('#partRows').evaluate(rows => ({
          available: rows.clientWidth,
          score: rows.querySelector('svg').getBoundingClientRect().width,
          font: parseFloat(getComputedStyle(rows.querySelector('.part-row-tabs')).getPropertyValue('--ascii-tabs-font-size')),
        }));
        assert.ok(Math.abs(previewSize.score - previewSize.available * 800 / 900) < 2);
        assert.ok(previewSize.font >= 13 && previewSize.font <= 28);

        // The preview is a full-viewport modal with a close button on the top right.
        const modal = await page.locator('#partResult').evaluate(node => {
          const r = node.getBoundingClientRect();
          const c = node.querySelector('.part-modal-close').getBoundingClientRect();
          return {
            role: node.getAttribute('role'),
            w: r.width, h: r.height, vw: innerWidth, vh: innerHeight,
            closeRight: innerWidth - c.right, closeTop: c.top, hasIcon: !!node.querySelector('.part-modal-close svg path'),
          };
        });
        assert.equal(modal.role, 'dialog');
        assert.ok(modal.w === modal.vw && modal.h === modal.vh);
        assert.ok(modal.hasIcon && modal.closeTop < 40 && modal.closeRight < 60);
        assert.ok(previewSize.available <= 1024 && previewSize.available > 760);

        // One editor per measure, aligned to the notes by identifier.
        await page.waitForFunction(() => document.querySelectorAll('.part-measure-tab .ascii-tabs-has').length === 6);
        assert.equal(await page.locator('.part-measure-tab').count(), 2);
        const align = await page.evaluate(() => {
          const ids = ['n1', 'n2', 'n3', 'n4'];
          const center = r => r.left + r.width / 2;
          const tabs = [...document.querySelectorAll('.part-measure-tab')];
          const cells = [
            tabs[0].querySelector('.ascii-tabs-has[data-c="0"]'),
            tabs[0].querySelector('.ascii-tabs-has[data-c="1"]'),
            tabs[1].querySelector('.ascii-tabs-has[data-c="0"]'),
            tabs[1].querySelector('.ascii-tabs-has[data-c="1"]'),
          ];
          return ids.map((id, i) => {
            const head = document.querySelector('#x-' + id + ' .notehead').getBoundingClientRect();
            return Math.abs(center(head) - center(cells[i].getBoundingClientRect()));
          });
        });
        align.forEach(delta => assert.ok(delta < 3, 'tab column aligned with the note, off by ' + delta));
        // Common scale: both measures share the row's top-left geometry.
        for (const gone of ['#partEdited', '#partReset']) {
          assert.equal(await page.locator(gone).count(), 0, gone + ' is gone');
        }
        assert.ok(await page.locator('.part-row .part-example-clef').count() >= 3, 'TAB clef letters');
        assert.equal(await page.locator('.part-row .part-string-name').count() % 6, 0);
        assert.ok(await page.locator('.part-footer #partConfirm svg').count() === 1, 'footer confirm has an icon');
        // A short score still leaves the footer flush with the bottom of the viewport.
        const footerGap = await page.evaluate(() => innerHeight - document.querySelector('.part-footer').getBoundingClientRect().bottom);
        assert.ok(Math.abs(footerGap) <= 1, 'footer a ' + footerGap + 'px del borde inferior');

        // Positioned frets must not mask the library's selection background.
        const firstMeasure = page.locator('.part-measure-tab').first();
        const selectedNote = firstMeasure.locator('.ascii-tabs-cell[data-c="0"][data-s="3"]');
        async function assertHighlight(locator) {
          const colors = await locator.evaluate(node => ({
            cell: getComputedStyle(node).backgroundColor,
            fret: getComputedStyle(node.querySelector('.ascii-tabs-fret')).backgroundColor,
          }));
          assert.notEqual(colors.cell, 'rgba(0, 0, 0, 0)', 'selection has a visible background');
          assert.equal(colors.fret, colors.cell, 'fret does not mask the selected cell');
        }
        await selectedNote.click();
        await assertHighlight(selectedNote);
        const startSelection = await firstMeasure.locator('.ascii-tabs-cell[data-c="0"][data-s="4"]').boundingBox();
        const endSelection = await firstMeasure.locator('.ascii-tabs-cell[data-c="1"][data-s="2"]').boundingBox();
        await page.mouse.move(startSelection.x, startSelection.y + startSelection.height);
        await page.mouse.down();
        await page.mouse.move(endSelection.x + endSelection.width, endSelection.y, { steps: 8 });
        await page.mouse.up();
        const selectedNotes = firstMeasure.locator('.ascii-tabs-selected');
        assert.equal(await selectedNotes.count(), 2);
        for (const note of await selectedNotes.all()) await assertHighlight(note);
        await page.keyboard.press('Escape');

        // Edit a Fret: the edit survives a reload.
        const cell = page.locator('.part-measure-tab').first().locator('.ascii-tabs-cell[data-c="0"][data-s="0"]');
        await cell.click();
        await page.keyboard.type('7');
        await page.keyboard.press('Enter');
        const stored = await page.evaluate(id => localStorage.getItem('partitura.edits.v1.' + id), JOB);
        assert.ok(stored && JSON.parse(stored)[0][0][0] === 7);
        await page.reload();
        await page.waitForSelector('#partRows .part-row');
        await page.waitForFunction(() => document.querySelectorAll('.part-measure-tab .ascii-tabs-has').length === 7);
        // Frets/solfege toggle.
        const heightOf = () => page.locator('.part-measure-tab').first().evaluate(n => n.offsetHeight);
        const tabHeight = await heightOf();
        await page.locator('#partNotation').check();
        assert.equal(await heightOf(), tabHeight, 'toggling note names keeps the TAB height');
        assert.equal(await page.locator('.part-measure-tab').first().evaluate(n => n.notation), 'solfege');
        await page.locator('#partNotation').uncheck();
        const plain = await page.locator('.part-measure-tab .ascii-tabs-fret').first().evaluate(n => getComputedStyle(n).fontWeight);
        assert.ok(Number(plain) < 600, 'frets are not bold by default: ' + plain);
        await page.locator('#partBoldBass').check();
        const weights = await page.evaluate(() => {
          const m = document.querySelectorAll('.part-measure-tab')[1];
          const col = m.querySelector('.ascii-tabs-has[data-c="1"][data-s="5"] .ascii-tabs-fret');
          const top = m.querySelector('.ascii-tabs-has[data-c="1"][data-s="0"] .ascii-tabs-fret');
          return [getComputedStyle(col).fontWeight, getComputedStyle(top).fontWeight];
        });
        assert.ok(Number(weights[0]) >= 600 && Number(weights[1]) < 600, 'bass bold only: ' + weights);
        // A Column with no downward stems has no bass: nothing is bold there.
        const upStem = await page.evaluate(() => {
          const m = document.querySelectorAll('.part-measure-tab')[1];
          const cell = m.querySelector('.ascii-tabs-has[data-c="0"][data-s="1"] .ascii-tabs-fret');
          return getComputedStyle(cell).fontWeight;
        });
        assert.ok(Number(upStem) < 600, 'up-stem Column not bold: ' + upStem);
        await page.locator('#partBoldBass').uncheck();

        // First use: the bass tip, then the B-key tip. Expiring alone does not
        // remember them; closing each one does.
        const tipTitle = () => page.locator('.part-tip .part-tip-title').allTextContents();
        const strings = await page.evaluate(() => window.PARTITURA_CONFIG.strings);
        assert.deepEqual(await tipTitle(), [strings.partTipBassTitle], 'bass tip shown first');
        assert.equal(await page.locator('.part-tip svg.part-tip-graphic').count(), 1);
        assert.equal(await page.evaluate(() => localStorage.getItem('partitura.tip.bass')), null);
        await page.locator('.part-tip-close').click();
        assert.equal(await page.evaluate(() => localStorage.getItem('partitura.tip.bass')), '1');
        assert.deepEqual(await tipTitle(), [strings.partTipBoldTitle], 'bold tip follows immediately');
        assert.equal(await page.locator('.part-tip .tab-demo--bold').count(), 1);
        await page.locator('.part-tip-close').click();
        assert.equal(await page.evaluate(() => localStorage.getItem('partitura.tip.bold')), '1');
        assert.equal(await page.locator('.part-tip').count(), 0);

        // Confirm and export: the Digitación confirmada goes to POST /export.
        assert.equal(await page.locator('#partTitle').inputValue(), 'Camino de las Tropas');
        assert.equal(await page.locator('#partAuthor').inputValue(), 'Falú · Trans. X');
        const underline = await page.locator('#partTitle').evaluate(n => {
          const s = getComputedStyle(n);
          return [s.borderBottomWidth, s.borderTopWidth, s.borderBottomLeftRadius];
        });
        assert.deepEqual(underline, ['1px', '0px', '0px']);
        // The author line ends where the checkboxes end.
        const bottoms = await page.evaluate(() => ['#partNotation', '#partAuthor']
          .map(id => document.querySelector(id).getBoundingClientRect().bottom));
        assert.ok(Math.abs(bottoms[0] - bottoms[1]) < 1, 'author underline aligned with checkboxes: ' + bottoms);
        await page.locator('#partAuthor').fill('Cuchi Leguizamón');
        await page.locator('#partConfirm').click();
        await page.waitForFunction(() => !document.querySelector('#partConfirm').hasAttribute('aria-busy'));
        assert.ok(await page.locator('#partConfirm').isDisabled());
        assert.ok(await page.locator('.part-result-modal').isVisible());
        await page.waitForSelector('.toast-description');
        assert.equal(await page.locator('.toast-description').textContent(), strings.partPdfDownloaded);
        await page.mouse.move(0, 0);
        await page.waitForTimeout(4000);
        assert.ok(await page.locator('.toast').isVisible(), 'success toast stays visible before six seconds');
        await page.locator('.toast').waitFor({ state: 'hidden', timeout: 4000 });
        assert.ok(await page.locator('#partConfirm').isDisabled(), 'toast dismissal does not allow another download');
        assert.equal(api.exportBody.title, 'Camino de las Tropas');
        assert.equal(api.exportBody.subtitle, 'Cuchi Leguizamón');
        assert.equal(api.exportBody.tabs.length, 2);
        assert.equal(api.exportBody.tabs[0][0][0], 7);
        assert.deepEqual(api.exportBody.tabs[1][1], [12, null, null, null, null, 5]);
        assert.equal(await page.locator('#partDownloads').count(), 0);

        // Editing a tab enables a new export in the same Trabajo.
        await page.locator('.part-measure-tab').first()
          .locator('.ascii-tabs-cell[data-c="0"][data-s="0"]').click();
        await page.keyboard.type('8');
        assert.ok(await page.locator('#partConfirm').isEnabled());
        await page.locator('#partConfirm').click();
        await page.waitForFunction(() => !document.querySelector('#partConfirm').hasAttribute('aria-busy'));
        assert.ok(await page.locator('#partConfirm').isDisabled());
        assert.equal(api.exportCount, 2);
        assert.equal(api.exportBody.tabs[0][0][0], 8);
        await page.locator('#partTitle').fill('Nuevo título');
        assert.ok(await page.locator('#partConfirm').isEnabled(), 'PDF header edits also enable downloading');
        assert.deepEqual(errors, []);
        await context.close();
      }

      // Resume from ?trabajo= with a Trabajo that is already ready.
      {
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        await mockApi(page, { jobs: [READY] });
        await page.goto(toolUrl + '?trabajo=' + JOB);
        assert.ok(await page.locator('#partForm').isHidden());
        await page.waitForSelector('#partRows .part-row');
        await page.close();
      }

      // A scan the OCR could only read with doubts asks for a better copy; any other reading says nothing.
      for (const doubtful of [true, false]) {
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        await mockApi(page, { jobs: [Object.assign({}, READY, { lowQualityScan: doubtful })] });
        await page.goto(toolUrl);
        await fillForm(page, 'score.pdf');
        await page.waitForSelector('#partRows .part-row');
        if (doubtful) {
          await page.waitForSelector('.toast-description');
          assert.equal(await page.locator('.toast-description').textContent(), S.partLowQualityScan);
          assert.equal(await page.locator('.toast-alert').count(), 0, 'advice, not an error');
        } else {
          await page.waitForTimeout(600);
          assert.equal(await page.locator('.toast').count(), 0, 'no advice for a good reading');
        }
        await page.close();
      }

      // Every error code is translated, on creation and when a job fails.
      const codes = ['rate_limited', 'busy', 'budget_paused', 'turnstile_failed', 'too_large', 'omr_failed', 'no_notes', 'timeout', 'export_limit', 'expired'];
      for (const code of codes) {
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        await mockApi(page, { createError: code, jobs: [READY] });
        await page.goto(toolUrl);
        await fillForm(page);
        await page.waitForSelector('.toast-description');
        assert.equal(await page.locator('.toast-description').textContent(), S['partErr_' + code], code);
        assert.ok(await page.locator('#partDropzone').isVisible());
        assert.ok(await page.locator('#partRightsRow').isVisible());
        await page.close();

        const failed = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        await mockApi(failed, { jobs: [{ status: 'failed', error: code }] });
        await failed.goto(toolUrl + '?trabajo=' + JOB);
        await failed.waitForSelector('.toast-description');
        assert.equal(await failed.locator('.toast-description').textContent(), S['partErr_' + code], 'job ' + code);
        await failed.close();
      }
      {
        const page = await browser.newPage();
        await mockApi(page, { jobs: [{ httpStatus: 410, error: 'expired' }] });
        await page.goto(toolUrl + '?trabajo=' + JOB);
        await page.waitForSelector('.toast-description');
        assert.equal(await page.locator('.toast-description').textContent(), S.partErr_expired);
        assert.equal(await page.locator('#partResult button').count(), 0);
        assert.ok(await page.locator('#partForm').isVisible());
        assert.ok(!page.url().includes('trabajo='));
        await page.close();
      }

      // Toasts float outside the form, pause on hover, and close after nine seconds.
      {
        const page = await browser.newPage({ viewport: { width: 375, height: 800 } });
        await page.clock.install();
        await mockApi(page, { createError: 'rate_limited', jobs: [READY] });
        await page.goto(toolUrl);
        await fillForm(page);
        const toast = page.locator('.toast');
        await toast.waitFor();
        assert.equal(await page.locator('#partErrorBanner').count(), 0);
        const box = await toast.boundingBox();
        assert.ok(box.x >= 0 && box.x + box.width <= 375, 'toast fits mobile viewport');
        await toast.hover();
        await page.clock.runFor(7000);
        assert.ok(await toast.isVisible(), 'hover pauses auto-dismiss');
        await page.mouse.move(0, 0);
        await page.clock.runFor(5000);
        assert.ok(await toast.isVisible(), 'alerts last longer than five seconds');
        await page.clock.runFor(4100);
        assert.equal(await toast.count(), 0, 'alerts dismiss after nine seconds');
        await page.locator('#partFile').setInputFiles({ name: 'bad.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('x') });
        await toast.waitFor();
        await page.getByRole('button', { name: S.toastClose }).click();
        assert.equal(await toast.count(), 0, 'close button dismisses immediately');
        await page.locator('#partFile').setInputFiles({ name: 'bad.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('x') });
        await toast.waitFor();
        await toast.focus();
        await page.keyboard.press('Escape');
        assert.equal(await toast.count(), 0, 'Escape dismisses repeated messages');
        await page.close();
      }

      // Client-side validation: type and size.
      {
        const page = await browser.newPage();
        await mockApi(page, { jobs: [READY] });
        await page.goto(toolUrl);
        await page.locator('#partRights').check();
        await page.locator('#partFile').setInputFiles({ name: 'cancion.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('x') });
        assert.equal(await page.locator('.toast-description').textContent(), S.partErrBadType);
        await page.locator('#partFile').setInputFiles({
          name: 'big.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.alloc(20 * 1024 * 1024 + 1),
        });
        assert.equal(await page.locator('.toast-description').textContent(), S.partErr_too_large);
        await page.close();
      }

      // Mobile: no preview, direct download of the suggested PDF.
      {
        const context = await browser.newContext({ viewport: { width: 375, height: 800 }, acceptDownloads: true });
        const page = await context.newPage();
        const api = await mockApi(page, { jobs: [READY] });
        await page.goto(toolUrl);
        const downloadPromise = page.waitForEvent('download');
        await fillForm(page, 'score.pdf');
        const download = await downloadPromise;
        assert.equal(download.suggestedFilename(), 'out.pdf');
        assert.equal(api.createBody.kind, 'pdf');
        assert.deepEqual(api.exportBody.tabs, SUGGESTION.tabs);
        assert.equal(await page.locator('#partRows').count(), 0);
        assert.equal(await page.locator('.part-measure-tab').count(), 0);
        assert.ok(await page.locator('#partResult .part-download').count() >= 1);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await context.close();
      }
    }
    console.log('Partitura y tablatura E2E passed (es + en)');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(tmp, { recursive: true, force: true });
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});
