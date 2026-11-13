// Host adapter: the editor logic comes from Partitura; controls stay in the sidebar.
import { startEditor } from 'partitura/editor';

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
  document.getElementById('scoreDownloadPdf').addEventListener('click', (event) => actions.exportPdf(event.currentTarget));
}

startEditor({
  defaultClef: 'guitar', saveDelay: 0, tools: { playback: true },  vendorBase: new URL('./vendor/', import.meta.url).href,
  bindActions,
}).catch((error) => {
  const stage = document.getElementById('scoreStage');
  stage.removeAttribute('aria-busy');
  stage.classList.remove('is-loading');
  console.error('Score editor could not start', error);
});
