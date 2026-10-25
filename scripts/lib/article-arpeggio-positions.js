'use strict';

const OPEN = [64, 59, 55, 50, 45, 40];
const STRING_SETS = [[0, 1, 2, 3], [0, 1, 2, 4], [0, 1, 2, 5], [1, 2, 3, 4], [1, 2, 3, 5]];
const NATURAL = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const QUALITIES = {
  Major: ['', [0, 4, 7]], Minor: ['m', [0, 3, 7]],
  Seventh: ['7', [0, 4, 7, 10]], MinorSeventh: ['m7', [0, 3, 7, 10]],
  MajorSeventh: ['maj7', [0, 4, 7, 11]], Diminished: ['dim', [0, 3, 6]],
  SeventhNoFifth: ['7', [0, 4, 10]],
};

function toneNames(root, intervals) {
  const letters = 'CDEFGAB';
  const rootPitch = NATURAL[root[0]] + (root[1] === '#' ? 1 : root[1] === 'b' ? -1 : 0);
  return intervals.map((interval) => {
    // A seventh without its fifth still uses the seventh letter, not the fifth.
    const degree = interval >= 9 ? 3 : interval >= 6 ? 2 : interval > 0 ? 1 : 0;
    const letter = letters[(letters.indexOf(root[0]) + degree * 2) % 7];
    const pitch = (rootPitch + interval + 12) % 12;
    const delta = (pitch - NATURAL[letter] + 18) % 12 - 6;
    return { pitch, name: letter + (delta < 0 ? 'b'.repeat(-delta) : '#'.repeat(delta)) };
  });
}

function fingering(form) {
  const result = form.map((fret) => fret === null ? '-' : fret === 0 ? '0' : null);
  const pending = form.map((fret, string) => ({ fret, string })).filter(({ fret }) => fret > 0)
    .sort((a, b) => a.fret - b.fret || a.string - b.string);
  let finger = 0;
  while (pending.length) {
    const { fret, string: first } = pending[0];
    let last = first;
    for (const position of pending) {
      if (position.fret === fret && position.string > first &&
          form.slice(first, position.string + 1).every((value) => value === null || value >= fret)) last = position.string;
    }
    finger++;
    for (let i = pending.length - 1; i >= 0; i--) {
      const position = pending[i];
      if (position.fret === fret && position.string >= first && position.string <= last) {
        result[position.string] = String(finger);
        pending.splice(i, 1);
      }
    }
  }
  return result.join('');
}

// Exhaust first position (open strings through fret 4) for the two treble
// layouts used by this article. Called at build time, never in the browser.
function firstPositionForms(root, quality) {
  const symmetric = quality.startsWith('Dim7');
  const [suffix, intervals] = symmetric ? ['dim7', [0, 3, 6, 9]] : QUALITIES[quality];
  const tones = toneNames(root, intervals);
  const positions = [];
  for (const strings of STRING_SETS) {
    const form = Array(6).fill(null);
    function visit(index) {
      if (index === strings.length) {
        const pitches = strings.map((string) => OPEN[string] + form[string]);
        if (new Set(pitches.map((pitch) => pitch % 12)).size !== tones.length) return;
        const bass = tones.find((tone) => tone.pitch === Math.min(...pitches) % 12);
        const name = symmetric ? ['C', 'C#', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'][bass.pitch] + suffix : root + suffix + (bass.pitch === tones[0].pitch ? '' : '/' + bass.name);
        positions.push({ name, form: [...form], fingering: fingering(form) });
        return;
      }
      const string = strings[index];
      for (let fret = 0; fret <= 4; fret++) {
        if (!tones.some((tone) => tone.pitch === (OPEN[string] + fret) % 12)) continue;
        form[string] = fret;
        visit(index + 1);
      }
      form[string] = null;
    }
    visit(0);
  }
  return positions;
}

module.exports = { firstPositionForms };
