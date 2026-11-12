'use strict';
const { drawIcon } = require('./icon-png');

// Paths are relative to the repository; each product owns its packaged resources.
module.exports = {
  chords: {
    source: 'src/extensions/chords',
    files: ['manifest.json', 'popup.html', 'popup.js', 'popup.css', '_locales'],
    resources: [
      ...['chords-db.js', 'chord-diagram.js', 'chord-positions.js', 'chord-search.js', 'note-names.js'].map(file => ({ from: 'src/shared/' + file, to: file })),
      { from: 'src/site/guitar-player-cubist-left-head.svg', to: 'guitar-player-cubist-left-head.svg' },
      { from: 'src/site/note-finder-empty.png', to: 'note-finder-empty.png' },
      { from: 'vendor/svguitar.umd.js', to: 'vendor/svguitar.umd.js' },
      { from: 'vendor/fuzzysort.js', to: 'vendor/fuzzysort.js' },
    ],
    icons: { source: 'src/site/guitar-player-cubist-left-head.svg', fallback: drawIcon },
  },
  tabs: {
    source: 'src/extensions/tabs',
    files: ['manifest.json', 'popup.html', 'popup.js', 'popup.css', '_locales'],
    resources: [
      { from: 'src/shared/tab-editor.js', to: 'tab-editor.js' },
      { from: 'src/shared/tab-editor.css', to: 'tab-editor.css' },
      { from: 'src/shared/tab-demo.css', to: 'tab-demo.css' },
      { from: 'src/site/css/01-base.css', to: 'base.css' },
      { from: 'src/extensions/tabs/icon.svg', to: 'icon.svg' },
      { from: 'vendor/ascii-tabs.js', to: 'vendor/ascii-tabs.js' },
    ],
    icons: { source: 'src/extensions/tabs/icon.svg', fallback: require('./tab-icon').drawTabIcon },
    prepare({ root, output }) {
      const fs = require('fs');
      const path = require('path');
      const { renderSharedTabEditor } = require('./tab-editor');
      const { pagePath } = require('./slugs');
      const template = fs.readFileSync(path.join(root, 'src/extensions/tabs/editor.html'), 'utf8');
      for (const locale of ['es', 'en']) {
        const strings = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/strings.' + locale + '.json'), 'utf8'));
        const editor = renderSharedTabEditor(strings, locale, { heading: 'Guitar Tabs' });
        const html = template.replace('%%LOCALE%%', locale).replace('%%TAB_EDITOR%%', editor)
          .replace('%%ARPEGGIOS_URL%%', 'https://acordesdeguitarra.com.ar' + pagePath('articulo-tablaturas-arpegios', locale))
          .replace('%%ARPEGGIOS_LABEL%%', strings.artArpeggiosH1)
          .replace('%%DESKTOP_TABS_LABEL%%', strings.tabDesktopLink)
          .replace('%%DESKTOP_TABS_URL%%', 'https://acordesdeguitarra.com.ar' + pagePath('crear-tablaturas-de-guitarra', locale));
        fs.writeFileSync(path.join(output, 'popup.' + locale + '.html'), html);
      }
    },
  },
  fifths: {
    source: 'src/extensions/fifths',
    files: ['manifest.json', 'popup.html', 'popup.js', 'popup.css', '_locales'],
    resources: [
      { from: 'src/site/fifths-wheel.js', to: 'fifths-wheel.js' },
      { from: 'src/shared/fifths-wheel.css', to: 'fifths-wheel.css' },
      { from: 'src/site/css/01-base.css', to: 'base.css' },
      { from: 'src/extensions/fifths/icon.svg', to: 'icon.svg' },
    ],
    icons: { source: 'src/extensions/fifths/icon.svg', fallback: require('./fifths-icon').drawFifthsIcon },
  },
  identifier: {
    source: 'src/extensions/identifier',
    files: ['manifest.json', 'popup.html', 'popup.js', 'popup.css', 'icon.svg', '_locales'],
    resources: [
      ...['chord-diagram.js', 'chord-card.js', 'note-names.js'].map(file => ({ from: 'src/shared/' + file, to: file })),
      { from: 'src/site/note-finder-empty.png', to: 'note-finder-empty.png' },
      { from: 'vendor/svguitar.umd.js', to: 'vendor/svguitar.umd.js' },
      { from: 'vendor/ascii-tabs.js', to: 'vendor/ascii-tabs.js' },
    ],
    icons: { source: 'src/extensions/identifier/icon.svg', fallback: require('./identifier-icon').drawIdentifierIcon },
    // The positions are the arpeggio page's, with their diagrams, as one script.
    prepare({ output }) {
      const fs = require('fs');
      const path = require('path');
      const { extensionChords } = require('./article-arpeggios');
      fs.writeFileSync(path.join(output, 'arpeggio-data.js'), 'window.ARPEGGIO_ROOTS = ' + JSON.stringify(extensionChords()) + ';\n');
    },
  },
};
