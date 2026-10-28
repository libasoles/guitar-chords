// Set defaults before registration upgrades the element. ascii-tabs then loads
// existing storage during its connection, so saved tabs always take precedence.
const editor = document.getElementById('tabEditor');
editor.value = [[], [], []];
await import('./vendor/ascii-tabs.js');
await customElements.whenDefined('ascii-tabs');

// Built-in storage preserves the legacy notes key. Save the full document as
// well: annotations can anchor to empty columns omitted by note-only storage.
const DOCUMENT_KEY = 'tabEditor.document';
try {
  const saved = JSON.parse(localStorage.getItem(DOCUMENT_KEY));
  if (saved?.version === 1 && Array.isArray(saved.value)) {
    editor.setDocument(saved);
  }
} catch {
  // An unavailable or invalid document leaves the legacy notes in place.
}
function saveDocument() {
  try {
    localStorage.setItem(DOCUMENT_KEY, JSON.stringify({
      version: 1,
      value: editor.value,
      // Chord links are rebuilt on load, so only the typed text is stored.
      annotations: editor.annotations.map((entries) => entries.map(({ column, text }) => ({ column, text }))),
      tabTitles: editor.tabTitles,
    }));
  } catch {
    // Editing still works when storage is unavailable or full.
  }
}
for (const event of ['change', 'annotationchange', 'titlechange']) {
  editor.addEventListener(event, saveDocument);
}

// A column annotation that is exactly a chord name from the chord database
// becomes a button that opens that chord's fingering, as in the arpeggio tabs.
// Pages without the chord scripts (the extension) keep plain annotations.
const chordDb = window.CHORDS && window.ChordCard ? window.CHORDS : null;
const chordByName = new Map();
function chordKey(text) {
  return text.trim().replace(/♭/g, 'b').replace(/♯/g, '#').replace(/\s+/g, '');
}
for (const chord of chordDb || []) {
  for (const name of [chord.name, ...(chord.aliases || [])]) {
    const key = chordKey(name);
    if (!chordByName.has(key)) chordByName.set(key, chord);
  }
}
function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

let chordPopover = null;
let chordSource = null;
function openChord(button) {
  const chord = chordByName.get(chordKey(button.textContent));
  if (!chord) return;
  if (!chordPopover) {
    chordPopover = document.createElement('div');
    chordPopover.className = 'modal chord-popover';
    chordPopover.setAttribute('popover', '');
    chordPopover.setAttribute('role', 'dialog');
    chordPopover.innerHTML =
      '<button type="button" class="modal-close" aria-label="' + escapeHtml(editor.dataset.chordClose || '') + '">×</button>' +
      '<div class="chord-popover-slot"></div>' +
      '<button type="button" class="chord-popover-edit">' + escapeHtml(editor.dataset.chordEdit || '') + '</button>';
    chordPopover.querySelector('.modal-close').addEventListener('click', () => chordPopover.hidePopover());
    chordPopover.querySelector('.chord-popover-edit').addEventListener('click', () => {
      chordPopover.hidePopover();
      // The annotation owns the text editor: a click on it (not on the button) opens it.
      chordSource?.closest('.ascii-tabs-annotation')?.click();
    });
    document.body.append(chordPopover);
  }
  chordSource = button;
  const label = (editor.dataset.chordLabel || '') + ' ' + chord.name;
  chordPopover.setAttribute('aria-label', label);
  const card = document.createElement('div');
  card.setAttribute('data-chord-card', '');
  card.dataset.chord = JSON.stringify({ name: chord.name, fingers: chord.fingers, barres: chord.barres || [], position: chord.position || 1 });
  card.setAttribute('role', 'img');
  card.setAttribute('aria-label', label);
  chordPopover.querySelector('.chord-popover-slot').replaceChildren(card);
  chordPopover.showPopover();
  window.ChordCard.render(card);
}
// Captured on the editor so the annotation's own click (which edits it) never sees these.
editor.addEventListener('click', (event) => {
  const button = event.target.closest('.tab-chord');
  if (!button) return;
  event.stopPropagation();
  openChord(button);
}, true);
editor.addEventListener('keydown', (event) => {
  const button = event.target.closest?.('.tab-chord');
  if (!button || (event.key !== 'Enter' && event.key !== ' ')) return;
  event.preventDefault();
  event.stopPropagation();
  openChord(button);
}, true);

function linkChords() {
  if (!chordDb) return;
  const current = editor.annotations;
  const linked = current.map((entries) => entries.map(({ column, text }) => {
    const entry = { column, text };
    if (text && chordByName.has(chordKey(text))) {
      const name = escapeHtml(text.trim());
      entry.html = '<button type="button" class="arpeggio-chord tab-chord" aria-label="' +
        escapeHtml(editor.dataset.chordShow || '') + ' ' + name + '">' + name + '</button>';
    }
    return entry;
  }));
  if (JSON.stringify(linked) !== JSON.stringify(current)) editor.annotations = linked;
}
editor.addEventListener('annotationchange', linkChords);
linkChords();

const noteNames = document.getElementById('tabNoteNames');
const letterLabels = document.getElementById('tabLetterLabels');
const LETTER_LABELS_KEY = 'tabLetterLabels';
try {
  letterLabels.checked = localStorage.getItem(LETTER_LABELS_KEY) === '1';
} catch {
  // localStorage may be unavailable; keep the default.
}
function updateDisplay() {
  editor.notation = noteNames.checked
    ? (editor.lang === 'es' ? 'solfege' : 'letters')
    : 'frets';
  editor.labels = letterLabels.checked ? 'notes' : 'numbers';
}
noteNames.addEventListener('change', updateDisplay);
letterLabels.addEventListener('change', () => {
  try {
    localStorage.setItem(LETTER_LABELS_KEY, letterLabels.checked ? '1' : '0');
  } catch {
    // localStorage may be unavailable; ignore.
  }
  updateDisplay();
});
updateDisplay();

const menu = document.querySelector('.tab-editor-menu');
document.addEventListener('click', (event) => {
  if (!menu.contains(event.target)) menu.open = false;
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menu.open) {
    menu.open = false;
    menu.querySelector('summary').focus();
  }
});

if (new URLSearchParams(location.search).has('tutorial')) {
  const tutorial = document.querySelector('details.tab-tutorial');
  if (tutorial) tutorial.open = true;
}
