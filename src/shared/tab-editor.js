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
      annotations: editor.annotations,
      tabTitles: editor.tabTitles,
    }));
  } catch {
    // Editing still works when storage is unavailable or full.
  }
}
for (const event of ['change', 'annotationchange', 'titlechange']) {
  editor.addEventListener(event, saveDocument);
}

// The slot underline invites writing in an empty column; a column that already
// has an annotation shows no such hint. Slots are rebuilt on every render.
function markAnnotatedSlots() {
  editor.annotations.forEach((entries, t) => {
    const columns = new Set(entries.map((entry) => entry.column));
    for (const slot of editor.querySelectorAll(`.ascii-tabs-annotation-slot[data-t="${t}"]`)) {
      slot.toggleAttribute('data-annotated', columns.has(+slot.dataset.c));
    }
  });
}
new MutationObserver(markAnnotatedSlots).observe(editor, { childList: true, subtree: true });
markAnnotatedSlots();

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
