'use strict';
/* tab-tutorial.js — Markup for the "how to use the editor" dropdown at the
   foot of the tab-editor page: one looping, CSS-only mini tab per gesture
   (drag a note, duplicate a column, fill with zeros, toggle bold). The keys to press are
   lit in colour while the gesture plays. Styles live in site.css
   (.tab-demo*). The stage is decorative (aria-hidden); the text carries the
   instructions. */

const STRING_COUNT = 6;
const COLUMN_COUNT = 5;

// A fret placed at column `c` on string `s` (0 = top string). `cls` hooks the
// animation of that note.
function note(c, s, fret, cls) {
  return (
    '<span class="tab-demo__note' + (cls ? ' ' + cls : '') + '" ' +
    'style="--c:' + c + ';--s:' + s + '">' + fret + '</span>'
  );
}

function key(label, cls) {
  return '<kbd class="tab-demo__key ' + cls + '">' + label + '</kbd>';
}

function stage(notes, labeled) {
  const strings = '<span class="tab-demo__string"></span>'.repeat(STRING_COUNT);
  return (
    '<div class="tab-demo__stage' + (labeled ? ' tab-demo__stage--labeled' : '') + '" aria-hidden="true" style="--cols:' + COLUMN_COUNT + '">' +
    strings + notes.join('') + '</div>'
  );
}

// `captionFirst` puts the title and description above the animation (Partitura).
function demo(opts) {
  const caption = '<figcaption><h3>' + opts.title + '</h3><p>' + opts.body + '</p></figcaption>';
  const media =
    stage(opts.notes, opts.labeled) +
    '<div class="tab-demo__keys" aria-hidden="true">' + opts.keys.join('<span class="tab-demo__plus">+</span>') + '</div>';
  return (
    '<li><figure class="tab-demo ' + opts.cls + (opts.captionFirst ? ' tab-demo--caption-first' : '') + '">' +
    (opts.captionFirst ? caption + media : media + caption) +
    '</figure></li>'
  );
}

// The bold demo without its caption: the Partitura tip supplies its own text.
function renderBoldDemo() {
  return (
    '<figure class="tab-demo tab-demo--bold">' +
    stage(boldNotes()) +
    '<div class="tab-demo__keys" aria-hidden="true">' + key('B', 'tab-demo__key--bold') + '</div>' +
    '</figure>'
  );
}

function boldNotes() {
  return [
    note(1, 1, 1), note(1, 3, 2),
    // Only the selected bass note toggles; the others stay normal.
    note(1, 4, 3, 'tab-demo__note--bold tab-demo__note--selected'),
  ];
}

function renderTabTutorial(strings) {
  const s = function (k) { return strings[k] || ''; };
  const modifier = s('tabTutorialModifierKey');

  const drag = demo({
    cls: 'tab-demo--drag',
    // The cursor ring travels with the note.
    notes: [note(0, 3, 5), note(1, 1, 2, 'tab-demo__note--dragged'), '<span class="tab-demo__cursor"></span>'],
    keys: [key(s('tabTutorialDragKey'), 'tab-demo__key--drag')],
    title: s('tabDragTitle'),
    body: s('tabDragBody'),
  });

  const duplicate = demo({
    cls: 'tab-demo--duplicate',
    notes: [
      note(0, 1, 1), note(0, 3, 2), note(0, 4, 3),
      note(1, 1, 1, 'tab-demo__note--copy-1'), note(1, 3, 2, 'tab-demo__note--copy-1'), note(1, 4, 3, 'tab-demo__note--copy-1'),
      note(2, 1, 1, 'tab-demo__note--copy-2'), note(2, 3, 2, 'tab-demo__note--copy-2'), note(2, 4, 3, 'tab-demo__note--copy-2'),
    ],
    keys: [key(modifier, 'tab-demo__key--mod'), key('→', 'tab-demo__key--arrow')],
    title: s('tabDupTitle'),
    body: s('tabDupBody'),
  });

  const zeros = demo({
    cls: 'tab-demo--zeros',
    notes: [
      note(1, 0, 0, 'tab-demo__note--zero'), note(1, 1, 0, 'tab-demo__note--zero'),
      note(1, 2, 0, 'tab-demo__note--zero'), note(1, 3, 2), note(1, 4, 2),
      note(1, 5, 0, 'tab-demo__note--zero'),
    ],
    keys: [key(modifier, 'tab-demo__key--mod'), key('0', 'tab-demo__key--zero')],
    title: s('tabZeroTitle'),
    body: s('tabZeroBody'),
  });

  const bold = demo({
    cls: 'tab-demo--bold',
    notes: boldNotes(),
    keys: [key('B', 'tab-demo__key--bold')],
    title: s('tabBoldTitle'),
    body: s('tabBoldBody'),
  });

  // The text lands in the strip above the tab (title) or above a column (annotation).
  const label = function (c, text) {
    return '<span class="tab-demo__label" style="--c:' + c + '">' + text + '</span>' +
      '<span class="tab-demo__cursor tab-demo__cursor--strip" style="--c:' + c + '"></span>';
  };

  const title = demo({
    cls: 'tab-demo--title',
    labeled: true,
    notes: [label(0, s('tabTitleDemoText')), note(1, 1, 1), note(1, 3, 2), note(2, 2, 0)],
    keys: [key('Enter', 'tab-demo__key--enter')],
    title: s('tabTitleTitle'),
    body: s('tabTitleBody'),
  });

  const annotation = demo({
    cls: 'tab-demo--annotation',
    labeled: true,
    notes: [label(1, 'Am'), note(1, 1, 1), note(1, 2, 2), note(1, 3, 2), note(3, 2, 0)],
    keys: [key('Enter', 'tab-demo__key--enter')],
    title: s('tabAnnotationTitle'),
    body: s('tabAnnotationBody'),
  });

  return (
    '<details class="tab-tutorial">' +
    '<summary>' + s('tabTutorialSummary') + '</summary>' +
    '<p class="tab-tutorial__intro">' + s('tabTutorialIntro') + '</p>' +
    '<ul class="tab-tutorial__list">' + drag + duplicate + zeros + bold + title + annotation + '</ul>' +
    '</details>'
  );
}

module.exports = { renderTabTutorial, renderBoldDemo, demo, note, key };
