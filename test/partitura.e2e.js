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
    [{ note_ids: ['tab-note-2'], bass_strings: [1] }, { note_ids: ['tab-note-3'], bass_strings: [5] }],
  ],
  dropped: [{ measure: 2, pitch: 'C#2' }],
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
    if (url.endsWith('/preview.json')) return json(route, PREVIEW);
    if (url.endsWith('/suggestion.json')) return json(route, SUGGESTION);
    if (url.endsWith('/preview-01.svg')) {
      return route.fulfill({ contentType: 'image/svg+xml', headers: CORS, body: SVG });
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
  for (const file of ['partitura-y-tablatura.html', 'en/partitura-y-tablatura.html']) {
    assert.ok(!fs.existsSync(path.join(withoutDir, file)), file + ' must not be generated');
  }
  for (const file of ['index.html', 'en/index.html']) {
    const html = fs.readFileSync(path.join(withoutDir, file), 'utf8');
    assert.ok(!html.includes('partitura-y-tablatura'), file + ' links to the tool');
    assert.ok(!html.includes('part-promo'), file + ' has the banner');
  }
  assert.ok(!fs.readFileSync(path.join(withoutDir, 'sitemap.xml'), 'utf8').includes('partitura-y-tablatura'));
  for (const file of ['politica-de-privacidad.html', 'en/politica-de-privacidad.html']) {
    assert.ok(fs.existsSync(path.join(withoutDir, file)), file + ' must always be generated');
  }

  for (const locale of ['es', 'en']) {
    const prefix = locale === 'en' ? 'en/' : '';
    const html = fs.readFileSync(path.join(withDir, prefix + 'partitura-y-tablatura.html'), 'utf8');
    assert.ok(!/%%part\w+%%/.test(html), 'unresolved partitura translation in ' + locale);
    const strings = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/i18n/strings.' + locale + '.json'), 'utf8'));
    assert.ok(html.includes('<p class="part-duration">' + strings.partDurationHint + '</p>'));
  }

  const server = await serveStatic(withDir, 0);
  const base = 'http://localhost:' + server.address().port;
  let browser;
  try {
    browser = await chromium.launch({ executablePath: playwrightExecutablePath() });
    const sitemap = fs.readFileSync(path.join(withDir, 'sitemap.xml'), 'utf8');
    assert.ok(sitemap.includes('/partitura-y-tablatura') && sitemap.includes('/en/partitura-y-tablatura'));
    assert.ok(sitemap.includes('/politica-de-privacidad') && sitemap.includes('/en/politica-de-privacidad'));

    for (const locale of ['es', 'en']) {
      const prefix = locale === 'en' ? '/en' : '';
      const S = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'i18n', 'strings.' + locale + '.json'), 'utf8'));
      const toolUrl = base + prefix + '/partitura-y-tablatura';

      // Privacy policy and the footer link on every kind of page.
      {
        const page = await browser.newPage();
        await page.goto(base + prefix + '/politica-de-privacidad');
        assert.equal(await page.locator('h1').textContent(), S.privH1);
        assert.ok((await page.locator('main').textContent()).includes('hola@acordesdeguitarra.com.ar'));
        for (const url of [prefix + '/', prefix + '/crear-tablaturas-de-guitarra', prefix + '/circulo-de-quintas', prefix + '/partitura-y-tablatura']) {
          await page.goto(base + url);
          const link = page.locator('a[href="' + prefix + '/politica-de-privacidad"]').last();
          assert.ok(await link.count(), 'footer privacy link on ' + url);
        }
        // Home banner: lazy, fixed dimensions, links to the tool.
        await page.goto(base + (prefix || '/'));
        const img = page.locator('.part-promo-img');
        assert.equal(await img.getAttribute('loading'), 'lazy');
        assert.equal(await img.getAttribute('width'), '480');
        assert.equal(await img.getAttribute('height'), '436');
        assert.equal(await page.locator('.part-promo-link').getAttribute('href'), prefix + '/partitura-y-tablatura');
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
        for (const width of [1100, 390]) {
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
          assert.equal((await page.locator('.part-example-string').allTextContents()).join(''), 'EBGDAE');
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        }
        await page.close();
      }

      // Rights checkbox gates the upload; privacy summary expands and links.
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
        assert.equal(
          await page.locator('.part-privacy a').getAttribute('href'),
          prefix + '/politica-de-privacidad',
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
        assert.equal(highlight.background, 'rgba(255, 215, 0, 0.15)');
        const inlineError = await page.locator('#partRightsError').evaluate(node => {
          const label = document.querySelector('#partRightsLabel');
          const box = node.getBoundingClientRect();
          const text = label.getBoundingClientRect();
          return { aligned: Math.abs(box.left - text.left) < 1, gap: box.top - text.bottom, smaller: parseFloat(getComputedStyle(node).fontSize) < parseFloat(getComputedStyle(label).fontSize) };
        });
        assert.ok(inlineError.aligned && inlineError.gap >= 0 && inlineError.gap <= 3 && inlineError.smaller);
        assert.equal(await page.locator('.part-rights').evaluate(node => getComputedStyle(node).animationName), 'none');
        await page.locator('#partRights').check();
        await page.waitForFunction(() => document.querySelector('#partForm').hidden);
        assert.equal(api.createBody.filename, 'pending.musicxml');
        assert.ok(await page.locator('#partRightsError').isHidden());
        await page.close();
      }

      // Upload controls and the example disappear as soon as an upload starts.
      {
        const page = await browser.newPage();
        await mockApi(page, { jobs: [READY] });
        let releaseUpload;
        const gate = new Promise(resolve => { releaseUpload = resolve; });
        await page.route('https://upload.partitura.test/**', async route => {
          if (route.request().method() !== 'OPTIONS') await gate;
          return route.fulfill({ status: 200, headers: CORS });
        });
        await page.goto(toolUrl);
        await fillForm(page);
        await page.waitForSelector('#partProgress:not([hidden])');
        assert.ok(await page.locator('.part-example').isHidden());
        assert.ok(await page.locator('#partDropzone').isHidden());
        assert.ok(await page.locator('#partRightsRow').isHidden());
        assert.equal(await page.locator('.part-duration').textContent(), S.partDurationHint);
        releaseUpload();
        await page.waitForSelector('#partRows .part-row');
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
        assert.ok(previewSize.font >= 10 && previewSize.font <= 22);

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
        assert.ok((await page.locator('#partDropped').textContent()).includes('C#2'));
        assert.equal(await page.locator('#partEdited').textContent(), S.partEditedCount.replace('{n}', '0'));

        // Edit a Fret: the measure counts as edited and survives a reload.
        const cell = page.locator('.part-measure-tab').first().locator('.ascii-tabs-cell[data-c="0"][data-s="0"]');
        await cell.click();
        await page.keyboard.type('7');
        await page.keyboard.press('Enter');
        await page.waitForFunction(
          n => document.querySelector('#partEdited').textContent.endsWith(n),
          '1',
        );
        const stored = await page.evaluate(id => localStorage.getItem('partitura.edits.v1.' + id), JOB);
        assert.ok(stored && JSON.parse(stored)[0][0][0] === 7);
        await page.reload();
        await page.waitForSelector('#partRows .part-row');
        await page.waitForFunction(() => document.querySelectorAll('.part-measure-tab .ascii-tabs-has').length === 7);
        assert.equal(await page.locator('#partEdited').textContent(), S.partEditedCount.replace('{n}', '1'));

        // Frets/solfege toggle and bass in bold.
        await page.locator('#partNotation').selectOption('solfege');
        assert.equal(await page.locator('.part-measure-tab').first().evaluate(n => n.notation), 'solfege');
        await page.locator('#partNotation').selectOption('frets');
        await page.locator('#partBoldBass').check();
        const weights = await page.evaluate(() => {
          const col = document.querySelectorAll('.part-measure-tab')[1].querySelector('.ascii-tabs-has[data-c="1"][data-s="5"] .ascii-tabs-fret');
          const top = document.querySelectorAll('.part-measure-tab')[1].querySelector('.ascii-tabs-has[data-c="1"][data-s="0"] .ascii-tabs-fret');
          return [getComputedStyle(col).fontWeight, getComputedStyle(top).fontWeight];
        });
        assert.ok(Number(weights[0]) >= 600 && Number(weights[1]) < 600, 'bass bold only: ' + weights);

        // Confirm and export: the Digitación confirmada goes to POST /export.
        await page.locator('#partConfirm').click();
        await page.waitForSelector('#partDownloads a');
        assert.equal(await page.locator('#partDownloads a').count(), 4);
        assert.equal(api.exportBody.tabs.length, 2);
        assert.equal(api.exportBody.tabs[0][0][0], 7);
        assert.deepEqual(api.exportBody.tabs[1][1], [12, null, null, null, null, 5]);
        assert.equal(await page.locator('#partDownloads a').first().getAttribute('href'), DOWNLOADS.pdf);

        // Re-export in the same Trabajo, then reset to the suggestion.
        await page.locator('#partConfirm').click();
        await page.waitForFunction(() => !document.querySelector('#partConfirm').disabled);
        await page.waitForFunction(() => document.querySelector('#partConfirm').textContent.length > 0);
        assert.equal(api.exportCount, 2);
        await page.locator('#partReset').click();
        assert.equal(await page.locator('#partEdited').textContent(), S.partEditedCount.replace('{n}', '0'));
        assert.equal(await page.evaluate(id => localStorage.getItem('partitura.edits.v1.' + id), JOB), null);
        assert.equal(
          await page.locator('.part-measure-tab').first().evaluate(n => n.value[0][0][0]),
          null,
        );
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

      // Toasts float outside the form, pause on hover, and close after six seconds.
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
        assert.ok(await toast.isVisible(), 'default lasts longer than five seconds');
        await page.clock.runFor(1100);
        assert.equal(await toast.count(), 0, 'default dismisses after six seconds');
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
