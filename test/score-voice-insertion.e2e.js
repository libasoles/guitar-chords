'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const { playwrightExecutablePath } = require('../scripts/lib/chrome-path');
const { serveStatic } = require('../scripts/lib/static-server');
const M = require('../src/site/score-model');
const cases = [];
function test(name, run) { cases.push({ name, run }); }
async function count(locator, expected) {
  const deadline = Date.now() + 5000;
  while (await locator.count() !== expected && Date.now() < deadline) await locator.page().waitForTimeout(50);
  assert.equal(await locator.count(), expected);
}

function exampleScore(bassDuration = 'q') {
  const score = { ...M.emptyScore(), clef: 'guitar', meter: '6/8', fifths: -1 };
  score.rows[0][0] = [
    { d: 'e', rest: true, v: 1, at: 0 },
    { d: 'e', n: 28, v: 2, at: 0 },
    { d: 'e', n: 33, v: 1, at: 12 },
    { d: 'e', n: 35, v: 1, at: 24 },
    { d: 'e', n: 28, v: 1, at: 24 },
    { d: 'e', n: 40, v: 1, at: 36 },
    { d: 'e', n: 39, v: 1, at: 48 },
    { d: bassDuration, n: 24, v: 2, at: 48 },
    { d: 'e', n: 41, tie: true, v: 1, at: 60 },
  ];
  return score;
}

test('moving a bass eighth under the A preserves the measure', async ({ page }) => {
  const score = exampleScore();
  await page.addInitScript(score => {
    localStorage.setItem('scoreEditor.tabs.v1', JSON.stringify({ active: 0, scores: [score] }));
  }, score);
  await page.goto(baseUrl + '/partitura');
  const notes = page.locator('#scoreStage g.note');
  await count(notes, 8);
  await page.evaluate(() => {
    const save = window.ScoreStore.save;
    window.ScoreStore.save = value => {
      window.lastSavedScore = structuredClone(value);
      save(value);
    };
  });
  const source = await page.locator('[id="e0-1"] .notehead').boundingBox();
  const target = await page.locator('[id="e0-2"] .notehead').boundingBox();
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2 + 2, source.y + source.height / 2 + 2, { steps: 10 });
  await page.mouse.up();
  await count(notes, 8);
  // Moving a bass note onto a melody column must not turn it into a chord member.
  assert.match(await page.locator('[id="e0-2"]').getAttribute('class'), /note/);
  assert.equal(await page.locator('[id="e0-2"]').evaluate(node => !!node.closest('g.chord')), false);
  const expected = structuredClone(score.rows[0][0]);
  const moved = expected.splice(1, 1)[0];
  moved.at = 12;
  expected.splice(2, 0, moved);
  assert.deepEqual(await page.evaluate(() => window.lastSavedScore.scores[0].rows[0][0]), expected);
  await page.keyboard.press('ControlOrMeta+z');
  await count(notes, 8);
  assert.deepEqual(await page.evaluate(() => window.lastSavedScore.scores[0].rows[0][0]), score.rows[0][0]);
});

for (const beforeFirst of [true, false]) {
  test(`inserting a rest before the bass preserves the full melody (beforeFirst=${beforeFirst})`, async ({ page }) => {
    const score = exampleScore('e');
    await page.addInitScript(score => {
      localStorage.setItem('scoreEditor.tabs.v1', JSON.stringify({ active: 0, scores: [score] }));
    }, score);
    await page.goto(baseUrl + '/partitura');
    await count(page.locator('#scoreStage g.note'), 8);
    await page.evaluate(() => {
      const save = window.ScoreStore.save;
      window.ScoreStore.save = value => {
        window.lastSavedScore = structuredClone(value);
        save(value);
      };
    });
    const rest = await page.locator('[id="e0-0"]').boundingBox();
    const bass = await page.locator('[id="e0-1"] .notehead').boundingBox();
    const tool = await page.locator('[data-shortcut="e"]').boundingBox();
    await page.mouse.move(tool.x + tool.width / 2, tool.y + tool.height / 2);
    await page.mouse.down();
    await page.mouse.move(rest.x + rest.width / 2 + 2 - (beforeFirst ? 20 : 0), bass.y + bass.height / 2 + 2, { steps: 10 });
    await page.mouse.up();
    await count(page.locator('#scoreStage g.rest'), 2);
    await count(page.locator('#scoreStage g.note'), 8);
    const result = await page.evaluate(() => window.lastSavedScore.scores[0].rows[0][0]);
    assert.deepEqual(result.filter(ev => ev.v === 1), score.rows[0][0].filter(ev => ev.v === 1));
    assert.deepEqual(result.filter(ev => ev.v === 2).map(ev => [!!ev.rest, ev.at]), [[true, 0], [false, 12], [false, 48]]);
    await page.keyboard.press('Escape');
    await page.keyboard.press('ControlOrMeta+z');
    await count(page.locator('#scoreStage g.rest'), 1);
  });
}

test('adding an eighth below the first eighth preserves both measures', async ({ page }) => {
  const score = { ...M.emptyScore(), clef: 'guitar', meter: '6/8', fifths: -1 };
  score.rows[0][0] = [
    { d: 'e', rest: true, v: 1, at: 0 },
    { d: 'e', n: 33, v: 1, at: 12 },
    { d: 'e', n: 35, v: 1, at: 24 },
    { d: 'e', n: 28, v: 1, at: 24 },
    { d: 'e', n: 40, v: 1, at: 36 },
    { d: 'e', n: 39, v: 1, at: 48 },
    { d: 'e', n: 24, v: 2, at: 48 },
    { d: 'e', n: 41, tie: true, v: 1, at: 60 },
  ];
  score.rows[0][1] = [
    { d: 'h', n: 41, dot: true, v: 1, at: 0 },
    { d: 'q', rest: true, n: 24, v: 2, at: 0 },
    { d: 'q', n: 25, v: 2, at: 24 },
    { d: 'q', n: 25, v: 2, at: 48 },
  ];
  await page.addInitScript(score => {
    localStorage.setItem('scoreEditor.tabs.v1', JSON.stringify({ active: 0, scores: [score] }));
  }, score);
  await page.goto(baseUrl + '/partitura');
  await count(page.locator('#scoreStage g.note'), 10);
  const first = await page.locator('[id="e0-1"] .notehead').boundingBox();
  const low = await page.locator('[id="e0-3"] .notehead').boundingBox();
  const tool = await page.locator('[data-shortcut="3"]').boundingBox();
  await page.mouse.move(tool.x + tool.width / 2, tool.y + tool.height / 2);
  await page.mouse.down();
  await page.mouse.move(first.x + first.width / 2 + 2, low.y + low.height / 2 + 2, { steps: 10 });
  await page.mouse.up();
  const result = await page.evaluate(() => window.scoreEditor.score);
  const expected = structuredClone(score.rows[0][0]);
  expected.splice(2, 0, { d: 'e', n: 28, v: 1, at: 12 });
  assert.deepEqual(result.rows[0][0], expected);
  assert.deepEqual(result.rows[0][1], score.rows[0][1]);
  const ids = await page.locator('#scoreStage g.note, #scoreStage g.rest').evaluateAll(nodes => nodes.map(node => node.id));
  const refs = ids.map(id => /^e(\d+)-(\d+)$/.exec(id)).filter(Boolean).map(match => ({ mi: +match[1], i: +match[2] }));
  // Copying a visible selection must include the beamed notes too (regression for 339effc).
  const copied = M.copySelection(result, refs);
  assert.deepEqual(copied.measures, [expected, score.rows[0][1]]);
  await count(page.locator('#scoreStage g.note'), 11);
  await page.keyboard.press('ControlOrMeta+z');
  await count(page.locator('#scoreStage g.note'), 10);
  assert.deepEqual(await page.evaluate(() => window.scoreEditor.score.rows[0].slice(0, 2)), score.rows[0].slice(0, 2));
});
let baseUrl;
(async () => {
  const server = await serveStatic(path.join(__dirname, '../dist/site'), 0);
  let browser;
  try {
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ executablePath: playwrightExecutablePath(), headless: true });
    for (const entry of cases) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
      try {
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await entry.run({ page });
        assert.deepEqual(errors, []);
        console.log('Passed:', entry.name);
      } finally { await context.close(); }
    }
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
