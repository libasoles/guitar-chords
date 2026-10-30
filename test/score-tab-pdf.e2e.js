'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const { playwrightExecutablePath } = require('../scripts/lib/chrome-path');
const { serveStatic } = require('../scripts/lib/static-server');

(async () => {
  const server = await serveStatic(path.join(__dirname, '..', 'dist/site'), 0);
  let browser;
  try {
    browser = await chromium.launch({ executablePath: playwrightExecutablePath() });
    const page = await browser.newPage();
    await page.goto('http://localhost:' + server.address().port + '/partitura');
    await page.waitForSelector('#scoreStage g.measure');
    await page.evaluate(() => {
      const create = URL.createObjectURL.bind(URL);
      window.exportSvgs = [];
      URL.createObjectURL = (blob) => {
        if (blob.type === 'image/svg+xml') window.exportSvgs.push(blob.text());
        return create(blob);
      };
      scoreEditor.score.rows[0][0] = [{ n: 28, d: 'q', at: 0 }];
      scoreEditor.score.tabs = { '0:0': [null, null, null, 7, null, null] };
      scoreEditor.score.showTabs = true;
      scoreEditor.render();
    });
    async function exportPages() {
      await page.evaluate(() => { window.exportSvgs = []; });
      await page.locator('#scoreDownloadToggle').click();
      const pending = page.waitForEvent('download');
      await page.locator('#scoreDownloadPdf').click();
      await (await pending).delete();
      await page.waitForFunction(() => !document.getElementById('scoreDownloadPdf').disabled);
      return page.evaluate(async () => Promise.all(window.exportSvgs));
    }
    let pages = await exportPages();
    assert.ok(pages[0].includes('class="pdf-tab"'), 'PDF includes TAB when enabled');
    assert.match(pages[0], />7<\/text>/, 'PDF preserves edited fingering');
    await page.locator('#scoreTabToggle').click();
    pages = await exportPages();
    assert.ok(pages.every(svg => !svg.includes('class="pdf-tab"')), 'PDF omits TAB when disabled');
    await page.evaluate(() => {
      const row = [[{ n: 24, d: 'h', at: 0 }], [], [], []];
      scoreEditor.score.rows = Array.from({ length: 12 }, () => structuredClone(row));
      scoreEditor.score.showTabs = true;
      scoreEditor.render();
    });
    pages = await exportPages();
    assert.ok(pages.length > 1, 'TAB score paginates');
    const geometry = await page.evaluate((pages) => pages.map(markup => {
      const host = document.createElement('div');
      host.innerHTML = markup;
      document.body.appendChild(host);
      try {
        const svg = host.querySelector('svg');
        const pageBox = svg.getBoundingClientRect();
        const tabs = [...svg.querySelectorAll('.pdf-tab')];
        const systems = [...svg.querySelectorAll('g.system')];
        return {
          count: tabs.length,
          clear: tabs.every(tab => {
            const music = [...tab.parentNode.querySelectorAll('g.layer')].map(node => node.getBoundingClientRect());
            const fret = [...tab.querySelectorAll('text')].find(node => /^\d+$/.test(node.textContent));
            return fret && fret.getBoundingClientRect().top > Math.max(...music.map(box => box.bottom));
          }),
          frets: tabs.map(tab => [...tab.querySelectorAll('text')].map(text => text.textContent).join('')),
          inside: tabs.every(tab => tab.getBoundingClientRect().bottom < pageBox.bottom),
          separated: tabs.every((tab, i) => !systems[i + 1] ||
            tab.getBoundingClientRect().bottom < systems[i + 1].getBoundingClientRect().top),
          aligned: tabs.every(tab => {
            const fret = [...tab.querySelectorAll('text')].find(text => /^\d+$/.test(text.textContent));
            const head = tab.parentNode.querySelector('.notehead');
            const a = fret.getBoundingClientRect();
            const b = head.getBoundingClientRect();
            return Math.abs((a.left + a.right - b.left - b.right) / 2) < 1;
          }),
        };
      } finally { host.remove(); }
    }), pages);
    assert.equal(geometry.reduce((sum, page) => sum + page.count, 0), 12, 'all systems include TAB');
    assert.ok(geometry.every(page => page.clear), 'low notes stay above the TAB frets');
    assert.ok(geometry.every(page => page.inside), 'TAB stays inside each PDF page');
    assert.ok(geometry.every(page => page.separated), 'TAB does not overlap the next system');
    assert.ok(geometry.every(page => page.aligned), 'frets align with their notation');
    assert.ok(geometry.every(page => page.frets.every(text => /\d/.test(text))), 'automatic fingering on every system');
    console.log('score-tab-pdf e2e: OK');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
