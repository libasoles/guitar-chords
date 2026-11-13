const { test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/site/score-model');

function scoreWith(measure) {
  const score = { ...M.emptyScore(), clef: 'guitar', meter: '6/8', fifths: -1 };
  score.rows[0][0] = structuredClone(measure);
  return score;
}

function lines(measure) {
  return M.voices(measure).map(v => v.groups.map(g => g.indices.map(i => measure[i].n)));
}

const reportedMeasure = [
  { d: 'q', n: 35, v: 1, at: 0 }, { d: 'e', n: 28, v: 2, at: 0 },
  { d: 'e', n: 36, v: 1, at: 24 }, { d: 'e', n: 30, v: 1, at: 24 },
  { d: 'e', n: 38, v: 1, at: 36 }, { d: 'e', n: 32, v: 1, at: 36 },
  { d: 'q', n: 35, v: 1, at: 48 }, { d: 'q', n: 28, v: 1, at: 48 },
];

test('equal rhythms do not erase four independent parts', () => {
  const measure = [0, 24].flatMap((at, k) => [42, 38, 34, 28].map(n => ({ d: 'q', n: n + k, at })));
  assert.deepEqual(lines(measure), [42, 38, 34, 28].map(n => [[n], [n + 1]]));
  const xml = M.toMusicXml(scoreWith(measure));
  assert.equal((xml.match(/<chord\/>/g) || []).length, 0);
  for (let v = 1; v <= 4; v++) assert.ok(xml.includes(`<voice>${v}</voice>`));
});

test('melodic continuity replaces fixed register boundaries', () => {
  const measure = [[40, 32], [36, 34], [35, 33]].flatMap((notes, k) => notes.map(n => ({ n, d: 'q', at: k * 24 })));
  assert.deepEqual(lines(measure), [[[40], [36], [35]], [[32], [34], [33]]]);
});

test('simultaneous assignment minimizes combined movement rather than greedily claiming a part', () => {
  const measure = [
    { n: 40, d: 'q', at: 0 }, { n: 35, d: 'q', at: 0 },
    { n: 38, d: 'q', at: 24 }, { n: 42, d: 'q', at: 24 },
  ];
  assert.deepEqual(lines(measure), [[[40], [42]], [[35], [38]]]);
});

test('explicit identities survive crossing, overlapping ranges, and large leaps', () => {
  const measure = [[40, 34], [32, 36], [41, 33]].flatMap((notes, k) => notes.map((n, j) => ({ n, v: j + 1, d: 'q', at: k * 24 })));
  assert.deepEqual(lines(measure), [[[40], [32], [41]], [[34], [36], [33]]]);
  assert.deepEqual(lines(M.sanitize(scoreWith(measure)).rows[0][0]), lines(measure));
});

test('following explicit notes inform ambiguous unassigned parts', () => {
  const measure = [
    { n: 40, v: 1, d: 'q', at: 0 }, { n: 34, v: 2, d: 'q', at: 0 },
    { n: 32, d: 'q', at: 24 }, { n: 36, d: 'q', at: 24 },
    { n: 30, v: 1, d: 'q', at: 48 }, { n: 38, v: 2, d: 'q', at: 48 },
  ];
  assert.deepEqual(lines(measure), [[[40], [32], [30]], [[34], [36], [38]]]);
});

test('a monophonic leap does not create another voice', () => {
  assert.deepEqual(lines([{ n: 28, d: 'q' }, { n: 45, d: 'q' }, { n: 30, d: 'q' }]), [[[28], [45], [30]]]);
});

test('assigning the reported bass to its active voice restores it without changing musical time', () => {
  const score = scoreWith(reportedMeasure);
  const measure = score.rows[0][0];
  const refs = [1, 3, 5, 7].map((i) => ({ mi: 0, i }));
  const original = structuredClone(measure);
  assert.ok(!M.selectionActions(score, refs).includes('revoice'));
  assert.ok(M.selectionActions(score, refs, [2]).includes('assignVoice2'));
  assert.equal(M.applySelection(score, refs, 'assignVoice2'), true);
  assert.deepEqual(measure.map(ev => ev.v), [1, 2, 1, 2, 1, 2, 1, 2]);
  assert.deepEqual(measure.map(({ v, ...ev }) => ev), original.map(({ v, ...ev }) => ev));
  // Voice assignment must not silently bridge the missing eighth at time 12.
  assert.ok(!M.selectionActions(score, refs).includes('beam'));
  assert.equal(M.applySelection(score, [{ mi: 0, i: 3 }, { mi: 0, i: 5 }], 'beam'), true);
  assert.equal(measure[3].beam, 'join');
  assert.equal(measure[2].beam, undefined, 'beaming the bass must not beam the melody');
});

test('recalculation preserves four parts and rolls back when rhythm cannot be preserved', () => {
  const measure = [0, 24].flatMap(at => [42, 38, 34, 28].map(n => ({ d: 'q', n, at, v: 1 })));
  assert.equal(M.mergeVoices(measure, 72), true);
  assert.equal(M.voices(measure).length, 4, 'no arbitrary two-voice reduction');
  const original = structuredClone(measure);
  assert.equal(M.mergeVoices(measure, 12), false);
  assert.deepEqual(measure, original);
});

test('recalculation refuses an ambiguous crossing when reassignment would move attacks', () => {
  const measure = [
    { n: 40, d: 'q', v: 1, at: 0 }, { n: 27, d: 'e', v: 2, at: 0 },
    { n: 41, d: 'q', v: 2, at: 12 }, { n: 28, d: 'e', v: 1, at: 24 },
    { n: 29, d: 'e', v: 1, at: 36 },
  ];
  const original = structuredClone(measure);
  assert.deepEqual(M.onsets(measure), [0, 0, 12, 24, 36]);
  assert.equal(M.mergeVoices(measure, 72), false);
  assert.deepEqual(measure, original);
});

test('a new note shares neither a voice nor a stem solely because its rhythm matches', () => {
  for (const n of [28, 42]) {
    const measure = [{ n: 35, d: 'q', at: 0 }];
    M.insertNote(measure, { n, d: 'q' }, 0);
    assert.equal(M.voices(measure).length, 2);
    assert.equal(measure.find(ev => ev.n === Math.max(35, n)).v, 1);
    assert.equal(measure.find(ev => ev.n === Math.min(35, n)).v, 2);
  }
});

test('six simultaneous guitar notes survive persistence as separate parts', () => {
  const score = scoreWith([28, 30, 32, 35, 37, 40].map(n => ({ n, d: 'q', at: 0 })));
  const restored = M.sanitize(score);
  assert.equal(restored.rows[0][0].length, 6);
  assert.equal(M.voices(restored.rows[0][0]).length, 6);
  assert.deepEqual(M.sanitize(restored).rows, restored.rows);
});

test('forming a chord is explicit and survives sanitization, copy and paste', () => {
  const score = scoreWith([{ n: 35, d: 'e', at: 0 }, { n: 28, d: 'e', at: 0 }]);
  const refs = [{ mi: 0, i: 0 }, { mi: 0, i: 1 }];
  assert.equal(M.applySelection(score, refs, 'joinChord'), true);
  const restored = M.sanitize(score);
  assert.deepEqual(lines(restored.rows[0][0]), [[[35, 28]]]);
  assert.ok(M.toMusicXml(restored).includes('<chord/>'));
  const copied = M.copySelection(restored, refs);
  const target = scoreWith([]);
  assert.ok(M.pasteSelection(target, copied, 0));
  assert.deepEqual(lines(target.rows[0][0]), [[[35, 28]]]);
});

test('forming a chord cannot change durations or consume only part of an existing chord', () => {
  const refs = [{ mi: 0, i: 0 }, { mi: 0, i: 1 }];
  const different = scoreWith([{ n: 35, d: 'q', at: 0 }, { n: 28, d: 'e', at: 0 }]);
  assert.equal(M.applySelection(different, refs, 'joinChord'), false);
  const partial = scoreWith([{ n: 35, d: 'e', v: 1, at: 0 }, { n: 28, d: 'e', v: 2, at: 0 }, { n: 37, d: 'e', v: 1, at: 0 }]);
  const original = structuredClone(partial);
  assert.equal(M.applySelection(partial, refs, 'joinChord'), false);
  assert.deepEqual(partial, original);
  const continuation = scoreWith([
    { n: 35, d: 'e', v: 1, at: 0 }, { n: 28, d: 'e', v: 2, at: 0 },
    { n: 29, d: 'e', v: 2, at: 12 },
  ]);
  const saved = structuredClone(continuation);
  assert.equal(M.applySelection(continuation, refs, 'joinChord'), false, 'the remaining bass must not jump to time zero');
  assert.deepEqual(continuation, saved);
});
