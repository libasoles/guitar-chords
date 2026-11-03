'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/site/score-model');
const F = require('../src/site/score-fingering');
const IO = require('../src/site/score-io');

test('all alternate tunings assign sounding pitches and sanitize their identity', () => {
  assert.equal(M.emptyScore().clef, 'guitar');
  for (const tuning of M.TUNINGS) {
    const score = M.sanitize({ ...M.emptyScore(), tuning: tuning.id });
    assert.equal(M.tuningOf(score).id, tuning.id);
    F.assign(tuning.opens.map(midi => [midi]), tuning.opens).forEach((cells, i) => {
      assert.equal(cells.length, 1);
      assert.equal(tuning.opens[cells[0][0]] + cells[0][1], tuning.opens[i]);
    });
  }
  assert.deepEqual(F.assign([[38]], M.tuningOf({ tuning: 'drop-d' }).opens), [[[5, 0]]]);
  assert.equal(M.tuningOf(M.sanitize({ ...M.emptyScore(), tuning: 'invalid' })).id, 'standard');
});

test('hairpins reject overlaps, share dynamics and retain them in MusicXML', () => {
  const score = M.emptyScore();
  const cresc = M.setHairpin(score, 0, { kind: 'cresc', at: 0, to: 48, startDyn: 'p' });
  assert.ok(cresc);
  assert.equal(M.setHairpin(score, 0, { kind: 'dim', at: 24, to: 72 }), false);
  const dim = M.setHairpin(score, 0, { kind: 'dim', at: 48 });
  assert.ok(dim);
  assert.equal(M.setHairpinDynamic(score, 0, cresc, 'end', 'ff'), true);
  assert.equal(dim.startDyn, 'ff');
  const clean = M.sanitize(score);
  assert.deepEqual(clean.hairpins, score.hairpins);
  const xml = M.toMusicXml(clean);
  assert.match(xml, /wedge type="crescendo"/);
  assert.match(xml, /wedge type="diminuendo"/);
  assert.match(xml, /<ff\s*\/>/);
});

test('measure insert, remove and reorder preserve valid hairpin spans', () => {
  const score = M.emptyScore();
  M.setHairpin(score, 0, { kind: 'cresc', at: 0, span: 2, to: 48 });
  M.insertMeasure(score, 1);
  assert.equal(score.hairpins[0][0].span, undefined, 'inserting inside a span truncates it before the inserted measure');
  M.removeMeasureAt(score, 1);
  M.setHairpin(score, 1, { kind: 'dim', at: 0, span: 1 });
  M.moveMeasure(score, 1, 4);
  assert.equal(score.hairpins[3][0].span, undefined, 'a span detaches when only its initial measure moves');
  assert.deepEqual(M.sanitize(score).hairpins, score.hairpins);
});

test('MIDI round-trip preserves sounding pitches, chords and tied duration', () => {
  const score = M.emptyScore();
  score.rows[0][0] = [{ n: 23, d: 'q', tie: true }, { n: 23, d: 'q' }, { n: 25, d: 'q' }, { n: 27, d: 'q', chord: true }];
  const bytes = IO.toMidi(score, M);
  assert.equal(Buffer.from(bytes.subarray(0, 4)).toString(), 'MThd');
  const loaded = IO.parseMidi(bytes.buffer, M);
  assert.deepEqual(M.attacks(loaded).map(a => [a.at, a.midis]), M.attacks(score).map(a => [a.at, a.midis]));
  assert.equal(M.length(loaded.rows[0][0][0]), 48);
  assert.throws(() => IO.parseMidi(new Uint8Array([0, 1, 2]).buffer, M));
});
