// Set defaults before registration upgrades the element. ascii-tabs then loads
// existing storage during its connection, so saved tabs always take precedence.
const editor = document.getElementById('tabEditor');
editor.value = [[], [], []];
await import('./vendor/ascii-tabs.js');
await customElements.whenDefined('ascii-tabs');

const noteNames = document.getElementById('tabNoteNames');
const letterLabels = document.getElementById('tabLetterLabels');
function updateDisplay() {
  editor.notation = noteNames.checked
    ? (editor.lang === 'es' ? 'solfege' : 'letters')
    : 'frets';
  editor.labels = letterLabels.checked ? 'notes' : 'numbers';
}
noteNames.addEventListener('change', updateDisplay);
letterLabels.addEventListener('change', updateDisplay);
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
