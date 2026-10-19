// Set defaults before registration upgrades the element. ascii-tabs then loads
// existing storage during its connection, so saved tabs always take precedence.
const editor = document.getElementById('tabEditor');
editor.value = [[], [], []];
await import('./vendor/ascii-tabs.js');
await customElements.whenDefined('ascii-tabs');

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
