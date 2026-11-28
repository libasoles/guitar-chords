// Host adapter: the editor logic comes from Partitura; controls stay in the sidebar.
import { startEditor } from 'partitura/editor';

// The published MusicXML carries the tablature as a second staff (clef TAB) repeating the notation's notes. The
// editor has one guitar staff and would pour those notes into it, doubling every note, so drop that staff first.
function withoutTabStaff(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) return xml;
  const tab = Array.from(doc.getElementsByTagName('clef')).find((clef) => clef.getElementsByTagName('sign')[0]?.textContent.trim() === 'TAB');
  const staff = tab?.getAttribute('number');
  if (!staff) return xml;
  doc.querySelectorAll('measure').forEach((measure) => {
    Array.from(measure.children).forEach((node) => {
      if (!['note', 'forward', 'direction', 'harmony'].includes(node.tagName) || node.getElementsByTagName('staff')[0]?.textContent.trim() !== staff) return;
      // The <backup> that rewinds to the start of the measure before the tablature's notes goes too.
      const before = node.previousElementSibling;
      if (node.tagName === 'note' && before?.tagName === 'backup') before.remove();
      node.remove();
    });
  });
  return new XMLSerializer().serializeToString(doc);
}

// The tablature the published MusicXML carries (second staff, clef TAB) as the editor's own `tabs` map:
// { 'measure:onset': [fret per string, string 1 first] }, so the original fingering comes along instead of
// being recalculated from the notes. Onsets use the editor's 24 divisions per quarter, like its importer.
const EDITOR_DIVISIONS = 24;
function originalTabs(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) return {};
  const clef = Array.from(doc.getElementsByTagName('clef')).find((node) => node.getElementsByTagName('sign')[0]?.textContent.trim() === 'TAB');
  const staff = clef?.getAttribute('number');
  const part = doc.getElementsByTagName('part')[0];
  if (!staff || !part) return {};
  const tabs = {};
  let divisions = 1;
  Array.from(part.children).filter((node) => node.tagName === 'measure').forEach((measure, mi) => {
    let cursor = 0;
    let last = 0;
    Array.from(measure.children).forEach((node) => {
      const duration = parseInt(node.getElementsByTagName('duration')[0]?.textContent, 10) || 0;
      if (node.tagName === 'attributes') {
        const value = parseInt(node.getElementsByTagName('divisions')[0]?.textContent, 10);
        if (value > 0) divisions = value;
      } else if (node.tagName === 'backup') cursor -= duration;
      else if (node.tagName === 'forward') cursor += duration;
      else if (node.tagName === 'note') {
        const chord = !!node.getElementsByTagName('chord')[0];
        const grace = !!node.getElementsByTagName('grace')[0];
        const start = chord ? last : cursor;
        if (!chord) last = cursor;
        if (!chord && !grace) cursor += duration;
        if (node.getElementsByTagName('staff')[0]?.textContent.trim() !== staff) return;
        const string = parseInt(node.getElementsByTagName('string')[0]?.textContent, 10);
        const fret = parseInt(node.getElementsByTagName('fret')[0]?.textContent, 10);
        if (!(string >= 1 && string <= 6) || !(fret >= 0)) return;
        const key = mi + ':' + Math.round(start * EDITOR_DIVISIONS / divisions);
        tabs[key] = tabs[key] || Array(6).fill(null);
        tabs[key][string - 1] = fret;
      }
    });
  });
  return tabs;
}

// The score viewer ("I" key in the sheet-music pages) leaves its MusicXML in sessionStorage; open it as a new tab,
// with its original tablature showing.
async function openHandoff(actions) {
  let handoff = null;
  try {
    handoff = JSON.parse(sessionStorage.getItem('partitura.handoff'));
    sessionStorage.removeItem('partitura.handoff');
  } catch (e) { return; }
  if (!handoff || typeof handoff.xml !== 'string') return;
  await actions.ready;
  const loaded = await actions.loadFile(new File([withoutTabStaff(handoff.xml)], String(handoff.name || 'score.musicxml'), { type: 'application/vnd.recordare.musicxml+xml' }));
  const tabs = originalTabs(handoff.xml);
  if (!loaded || !Object.keys(tabs).length) return;
  // `loaded` is now the open score: keep the original fingering and let the TAB button show it (it saves and redraws).
  loaded.tabs = tabs;
  if (!loaded.showTabs) document.getElementById('scoreTabToggle')?.click();
}

function bindActions(actions) {
  const icons = {
    upload: '<path d="M12 3v12"/><path d="m17 8-5-5-5 5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>',
    'file-music': '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M9 18v-6l5-1v6"/><circle cx="7.5" cy="18" r="1.5"/><circle cx="12.5" cy="17" r="1.5"/>',
  };
  Object.entries(icons).forEach(([name, paths]) => {
    document.querySelectorAll('[data-icon="' + name + '"]').forEach((node) => {
      node.innerHTML = '<svg class="lucide" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>' + node.textContent;
    });
  });
  const downloads = document.getElementById('scoreDownloads');
  const downloadToggle = document.getElementById('scoreDownloadToggle');
  const downloadOptions = document.getElementById('scoreDownloadOptions');
  function closeDownloads() {
    downloadOptions.hidden = true;
    downloadToggle.setAttribute('aria-expanded', 'false');
  }
  downloadToggle.addEventListener('click', () => {
    downloadOptions.hidden = !downloadOptions.hidden;
    downloadToggle.setAttribute('aria-expanded', String(!downloadOptions.hidden));
  });
  document.addEventListener('click', (event) => {
    if (!downloads.contains(event.target)) closeDownloads();
  });
  downloads.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !downloadOptions.hidden) {
      event.preventDefault();
      closeDownloads();
      downloadToggle.focus();
    }
  });
  downloadOptions.addEventListener('click', (event) => {
    if (event.target.closest('button')) {
      closeDownloads();
      downloadToggle.focus();
    }
  });

  const fileInput = document.getElementById('scoreImportFile');
  document.getElementById('scoreImport').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const [file] = fileInput.files;
    fileInput.value = '';
    actions.loadFile(file);
  });
  downloadToggle.addEventListener('pointerenter', actions.warm, { once: true });
  downloadToggle.addEventListener('focus', actions.warm, { once: true });
  document.getElementById('scoreDownloadXml').addEventListener('click', () => actions.exportMusicXml());
  document.getElementById('scoreDownloadMidi').addEventListener('click', () => actions.exportMidi());
  openHandoff(actions);
  document.getElementById('scoreDownloadPdf').addEventListener('click', (event) => actions.exportPdf(event.currentTarget));
}

startEditor({
  defaultClef: 'guitar', saveDelay: 0, tools: { playback: true },
  vendorBase: new URL('./vendor/', import.meta.url).href,
  bindActions,
}).catch((error) => {
  const stage = document.getElementById('scoreStage');
  stage.removeAttribute('aria-busy');
  stage.classList.remove('is-loading');
  console.error('Score editor could not start', error);
});
