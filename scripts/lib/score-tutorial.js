'use strict';
/* score-tutorial.js — Markup for the "shortcuts and gestures" dropdown of the
   /partitura editor: the keys under each figure, and two looping CSS-only
   demos (double-click a note to toggle its dot; click a special barline and
   press the x to delete it). Styles live in src/site/score-editor.css
   (.score-keys*, .score-demo*). The stages are decorative (aria-hidden); the
   text carries the instructions. The glyph paths mirror GLYPHS in
   src/site/score-editor.js (Lucide has no musical figures). */

const tabTutorial = require('./tab-tutorial');

const HEAD ='M13.2 29.2c-3.6 0-6.2-1.6-6.2-3.9 0-2.9 3.7-5.5 7.6-5.5 3.3 0 5.4 1.5 5.4 3.8 0 3.1-3.6 5.6-6.8 5.6z';
const HOLLOW_HEAD = 'M14.4 19.8c3.5 0 5.6 1.5 5.6 3.8 0 3-3.7 5.7-7.2 5.7-3.4 0-5.8-1.6-5.8-3.9 0-3 3.9-5.6 7.4-5.6zm-.4 1.9c-2.7 1.2-5 3.3-5 4.7 0 .9.9 1.4 2.2 1.4 2.4-.9 4.9-3.2 4.9-4.7 0-.8-.8-1.5-2.1-1.4z';
const STEM = 'stroke="currentColor" stroke-width="1.6" fill="none"';
const LINE = 'stroke="currentColor" stroke-width="1.7" fill="none"';

const NOTES = [
  ['1', '<path d="' + HEAD + '"/><path d="M19.6 24.2V-3m0 0c0 4 5 5.5 5 11m-5-6c0 4 5 5.5 5 11m-5-6c0 4 5 5.5 5 11" ' + STEM + '/>'],
  ['2', '<path d="' + HEAD + '"/><path d="M19.6 24.2V-2m0 0c0 4 5 5.5 5 11m-5-6c0 4 5 5.5 5 11" ' + STEM + '/>'],
  ['3', '<path d="' + HEAD + '"/><path d="M19.6 24.2V-1c0 4 5 5.5 5 11" ' + STEM + '/>'],
  ['4', '<path d="' + HEAD + '"/><path d="M19.6 24.2V-1" ' + STEM + '/>'],
  ['5', '<path d="' + HOLLOW_HEAD + '" fill-rule="evenodd"/><path d="M19.6 24.2V-1" ' + STEM + '/>'],
  ['6', '<path d="' + HOLLOW_HEAD + '" fill-rule="evenodd"/>'],
];

const DEAD = ['X', '<path d="M8.5 19.5l11 11M19.5 19.5l-11 11" stroke="currentColor" stroke-width="2.2" fill="none"/><path d="M19.6 24.2V-1" ' + STEM + '/>'];

const RESTS = [
  ['q', '<circle cx="12" cy="5" r="2.2"/><circle cx="10" cy="12" r="2.2"/><circle cx="8" cy="19" r="2.2"/><path d="M13 6c3 0 5-1.3 6-3.5l-8 26" ' + LINE + '/>'],
  ['w', '<circle cx="12" cy="9" r="2.4"/><circle cx="10" cy="17" r="2.4"/><path d="M13 10c3 0 5-1.3 6-3.5l-6.5 22" ' + LINE + '/>'],
  ['e', '<circle cx="12" cy="11" r="2.4"/><path d="M13 12.5c3 0 5-1.3 6-3.5l-5 20" ' + LINE + '/>'],
  ['r', '<path d="M12 5l7 8-5 5 6 7c-3-1-6.5-.5-6 3" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linejoin="round"/>'],
  ['t', '<path d="M5 18h20" stroke="currentColor" stroke-width="1.4"/><path d="M9 12h12v6H9z"/>'],
  ['y', '<path d="M5 12h20" stroke="currentColor" stroke-width="1.4"/><path d="M9 12h12v6H9z"/>'],
];

const MARKS = [
  ['dot', '<circle cx="15" cy="15" r="3.2"/>'],
  ['sharp', '<path d="M11 6v20M18 4v20M7.5 12.5l14-3.5M7.5 21l14-3.5" stroke="currentColor" stroke-width="1.8" fill="none"/>'],
  ['flat', '<path d="M10 4v22c4-2 8-5 8-8.5 0-2.5-2-3.5-4-3.5-1.5 0-3 .8-4 2" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linejoin="round"/>'],
  ['natural', '<path d="M10 5v16l10-3.5M20 27V11L10 14.5" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linejoin="round"/>'],
];

function glyph(paths, tall) {
  return (
    '<svg viewBox="' + (tall ? '0 -6 30 38' : '0 0 30 32') + '" width="30" height="' + (tall ? 38 : 32) +
    '" fill="currentColor" aria-hidden="true">' + paths + '</svg>'
  );
}

function keyCell(paths, label, tall) {
  return '<li class="score-keys__item">' + glyph(paths, tall) + '<kbd>' + label + '</kbd></li>';
}

function keyGroup(title, cells) {
  return '<div class="score-keys__group"><h4>' + title + '</h4><ul class="score-keys__list">' + cells.join('') + '</ul></div>';
}

const STAFF_Y = [5.5, 15, 24.5, 34, 43.5];

function staff(width) {
  return STAFF_Y.map(function (y) {
    return '<path class="score-demo__line" d="M0 ' + y + 'H' + width + '"/>';
  }).join('');
}

// A click ring and the pointer; both are moved and shown by the keyframes.
const CURSOR = '<path d="M2 1l11 7-5 1.2L5.5 14z" fill="#222" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>';

function demo(cls, svg, title, body) {
  return (
    '<li><figure class="tab-demo tab-demo--caption-first score-demo ' + cls + '">' +
    '<figcaption><h3>' + title + '</h3><p>' + body + '</p></figcaption>' +
    '<svg class="score-demo__stage" viewBox="0 -10 150 62" aria-hidden="true">' + svg + '</svg>' +
    '</figure></li>'
  );
}

function dotDemo(s) {
  const svg =
    staff(150) +
    '<g transform="translate(60 0)">' +
    '<path d="' + HEAD + '" fill="currentColor"/><path d="M19.6 24.2V-1" ' + STEM + '/>' +
    '<circle class="score-demo__dot" cx="26" cy="19.7" r="1.9" fill="currentColor"/></g>' +
    '<circle class="score-demo__ring score-demo__ring--a" cx="74" cy="25" r="7"/>' +
    '<circle class="score-demo__ring score-demo__ring--b" cx="74" cy="25" r="7"/>' +
    '<circle class="score-demo__ring score-demo__ring--c" cx="74" cy="25" r="7"/>' +
    '<circle class="score-demo__ring score-demo__ring--d" cx="74" cy="25" r="7"/>' +
    '<g class="score-demo__pointer" transform="translate(74 25)">' + CURSOR + '</g>';
  return demo('score-demo--dot', svg, s('scoreDotTitle'), s('scoreDotBody'));
}

function barDemo(s) {
  const svg =
    staff(150) +
    '<path class="score-demo__bar" d="M0 5.5V43.5M148 5.5V43.5" stroke="currentColor" stroke-width="1.6"/>' +
    '<path class="score-demo__bar score-demo__bar--a" d="M73 5.5V43.5" stroke="currentColor" stroke-width="1.6"/>' +
    '<path class="score-demo__bar score-demo__bar--b" d="M77.5 5.5V43.5" stroke="currentColor" stroke-width="1.6"/>' +
    '<g class="score-demo__delete" transform="translate(110 -3)">' +
    '<rect x="-22" y="-8" width="44" height="16" rx="3" fill="var(--paper)" stroke="var(--rule)" stroke-width=".8"/>' +
    '<text text-anchor="middle" dominant-baseline="central" font-size="10" fill="currentColor">Delete</text></g>' +
    '<circle class="score-demo__ring score-demo__ring--e" cx="73" cy="25" r="7"/>' +
    '<g class="score-demo__pointer score-demo__pointer--bar" transform="translate(73 25)">' + CURSOR + '</g>';
  return demo('score-demo--bar', svg, s('scoreBarTitle'), s('scoreBarBody'));
}

// The two ways to change a tab under the staff: type a new fret into a cell, or drag a cell elsewhere.
function tabEditDemo(s) {
  const note = tabTutorial.note;
  return tabTutorial.demo({
    cls: 'tab-demo--edit',
    captionFirst: true,
    notes: [
      note(0, 3, 5),
      note(1, 1, 2, 'tab-demo__note--before'),
      note(1, 1, 7, 'tab-demo__note--after'),
      '<span class="tab-demo__cursor tab-demo__cursor--edit"></span>',
    ],
    keys: [tabTutorial.key('0–9', 'tab-demo__key--digit')],
    title: s('scoreTabEditTitle'),
    body: s('scoreTabEditBody'),
  });
}

function tabMoveDemo(s) {
  const note = tabTutorial.note;
  return tabTutorial.demo({
    cls: 'tab-demo--drag',
    captionFirst: true,
    notes: [note(0, 3, 5), note(1, 1, 2, 'tab-demo__note--dragged'), '<span class="tab-demo__cursor"></span>'],
    keys: [tabTutorial.key(s('scoreTabMoveKey'), 'tab-demo__key--drag')],
    title: s('scoreTabMoveTitle'),
    body: s('scoreTabMoveBody'),
  });
}

function renderScoreTutorial(strings) {
  const s = function (k) { return strings[k] || ''; };
  const keys = (strings.scoreUiStrings && strings.scoreUiStrings.shortcuts) || {};
  const notes = NOTES.concat([DEAD]).map(function (n) { return keyCell(n[1], n[0], true); });
  const rests = RESTS.map(function (r) { return keyCell(r[1], r[0].toUpperCase()); });
  const marks = MARKS.map(function (m) { return keyCell(m[1], String(keys[m[0]] || '').toUpperCase()); });
  return (
    '<p class="score-tutorial__intro">' + s('scoreShortcutsIntro') + '</p>' +
    '<div class="score-keys">' +
    keyGroup(s('scoreShortcutsNotes'), notes) +
    keyGroup(s('scoreShortcutsRests'), rests) +
    keyGroup(s('scoreShortcutsMarks'), marks) +
    '</div>' +
    '<ul class="tab-tutorial__list">' + dotDemo(s) + barDemo(s) + '</ul>' +
    '<ul class="tab-tutorial__list">' + tabEditDemo(s) + tabMoveDemo(s) + '</ul>'
  );
}

module.exports = { renderScoreTutorial };
