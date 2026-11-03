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
  expected.splice(2, 0, { d: 'e', n: 28, v: 2, at: 12 });
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
async function seedVoices(page, measure) {
  const score = { ...M.emptyScore(), clef: 'guitar', meter: '6/8', fifths: -1 };
  score.rows[0][0] = measure;
  await page.addInitScript(score => {
    if (!sessionStorage.getItem('voicesSeeded')) {
      localStorage.setItem('scoreEditor.tabs.v1', JSON.stringify({ active: 0, scores: [score] }));
      sessionStorage.setItem('voicesSeeded', 'true');
    }
  }, score);
  await page.goto(baseUrl + '/partitura');
  await count(page.locator('#scoreStage g.note'), measure.length);
}

async function selectVoices(page, indices) {
  await page.keyboard.press('Escape');
  for (const [k, i] of indices.entries()) {
    await page.locator(`[id="e0-${i}"] .notehead`).click(k ? { modifiers: ['Shift'] } : {});
  }
}

test('recalculating the reported bass separates its stems and beams independently with undo', async ({ page }) => {
  const measure = [
    { d: 'q', n: 35, v: 1, at: 0 }, { d: 'e', n: 28, v: 2, at: 0 },
    { d: 'e', n: 36, v: 1, at: 24 }, { d: 'e', n: 30, v: 1, at: 24 },
    { d: 'e', n: 38, v: 1, at: 36 }, { d: 'e', n: 32, v: 1, at: 36 },
    { d: 'q', n: 35, v: 1, at: 48 }, { d: 'q', n: 28, v: 1, at: 48 },
  ];
  await seedVoices(page, measure);
  await count(page.locator('#scoreStage g.chord'), 3);
  await selectVoices(page, [1, 3]);
  await page.getByRole('button', { name: 'Recalcular voces del compás', exact: true }).click();
  await count(page.locator('#scoreStage g.chord'), 0);
  assert.deepEqual(await page.evaluate(() => scoreEditor.score.rows[0][0].map(ev => ev.v)), [1, 2, 1, 2, 1, 2, 1, 2]);
  await count(page.locator('[data-action="beam"]'), 0);
  await selectVoices(page, [3, 5]);
  await page.getByRole('button', { name: 'Barrar', exact: true }).click();
  const beam = page.locator('#scoreStage g.beam');
  await count(beam, 1);
  assert.deepEqual(await beam.locator('g.note').evaluateAll(nodes => nodes.map(n => n.id)), ['e0-3', 'e0-5']);
  await page.keyboard.press('ControlOrMeta+z');
  await count(beam, 0);
  await count(page.locator('#scoreStage g.chord'), 0);
  await page.keyboard.press('ControlOrMeta+z');
  await count(page.locator('#scoreStage g.chord'), 3);
  assert.deepEqual(await page.evaluate(() => scoreEditor.score.rows[0][0]), measure);
});

test('explicit chord grouping supports undo and survives reload', async ({ page }) => {
  await seedVoices(page, [{ n: 35, d: 'e', at: 0 }, { n: 28, d: 'e', at: 0 }]);
  await count(page.locator('#scoreStage g.chord'), 0);
  await selectVoices(page, [0, 1]);
  await page.getByRole('button', { name: 'Formar acorde', exact: true }).click();
  await count(page.locator('#scoreStage g.chord'), 1);
  await page.keyboard.press('ControlOrMeta+z');
  await count(page.locator('#scoreStage g.chord'), 0);
  await selectVoices(page, [0, 1]);
  await page.getByRole('button', { name: 'Formar acorde', exact: true }).click();
  const expected = await page.evaluate(() => JSON.stringify(scoreEditor.score.rows[0][0]));
  await page.waitForFunction(expected => new Promise((resolve, reject) => {
    const open = indexedDB.open('partitura', 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const read = db.transaction('workspace').objectStore('workspace').get('tabs');
      read.onsuccess = () => { db.close(); resolve(JSON.stringify(read.result?.scores[0].rows[0][0]) === expected); };
      read.onerror = () => { db.close(); reject(read.error); };
    };
  }), expected);
  await page.reload();
  await count(page.locator('#scoreStage g.chord'), 1);
  await count(page.locator('#scoreStage g.note'), 2);
});

test('MusicXML preserves explicit single-voice chords and separate homorhythmic parts', async ({ page }) => {
  await page.goto(baseUrl + '/partitura');
  await page.waitForSelector('#scoreStage:not([aria-busy]) g.measure');
  await page.addScriptTag({ content: require('node:fs').readFileSync(path.join(__dirname, '../src/site/score-io.js'), 'utf8') });
  const result = await page.evaluate(() => {
    const M = ScoreModel;
    const score = M.emptyScore();
    const roundTrip = measure => {
      score.rows[0][0] = measure;
      const parsed = ScoreIO.parseMusicXml(M.toMusicXml(score), M);
      return M.voices(parsed.rows[0][0]).map(v => v.groups.map(g => g.indices
        .filter(i => !parsed.rows[0][0][i].rest).map(i => parsed.rows[0][0][i].n)).filter(g => g.length));
    };
    return {
      chord: roundTrip([{ n: 35, d: 'q', at: 0, v: 1 }, { n: 28, d: 'q', at: 0, v: 1 }]),
      parts: roundTrip([{ n: 35, d: 'q', at: 0, v: 1 }, { n: 28, d: 'q', at: 0, v: 2 }]),
    };
  });
  assert.deepEqual(result.chord, [[[35, 28]]]);
  assert.deepEqual(result.parts, [[[35]], [[28]]]);
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
