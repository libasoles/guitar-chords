"use strict";

const { renderTabTutorial } = require("./tab-tutorial");

// Only the editor belongs here; the web page and popup provide their own shell.
function renderSharedTabEditor(strings, locale, { heading = strings.tabH1, lead = strings.tabLead } = {}) {
  const values = { ...strings, htmlLang: locale, heading, lead };
  const markup = `      <div class="tab-editor-heading">
        <h1>%%heading%%</h1>
        <details class="tab-editor-menu">
          <summary role="button" aria-label="%%tabDisplayOptions%%" title="%%tabDisplayOptions%%">
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
          </summary>
          <div class="tab-editor-options">
            <label>
              <input type="checkbox" id="tabNoteNames" aria-controls="tabEditor" />
              %%tabNoteNames%%
            </label>
            <label>
              <input type="checkbox" id="tabLetterLabels" aria-controls="tabEditor" />
              %%tabLetterLabels%%
            </label>
          </div>
        </details>
      </div>
      <p class="lead">%%lead%%</p>

      <ascii-tabs
        class="tab-editor"
        id="tabEditor"
        lang="%%htmlLang%%"
        theme="light"
        spacing="2"
        annotations-editable
        titles-editable
        data-chord-label="%%artChordDiagramLabel%%"
        data-chord-show="%%artArpeggiosShowFingering%%"
        data-chord-close="%%artArpeggiosClose%%"
      >
        <ascii-tabs-storage key="tabEditor.tabs"></ascii-tabs-storage>
        <ascii-tabs-hint></ascii-tabs-hint>
        <ascii-tabs-spacing></ascii-tabs-spacing>
        <ascii-tabs-sheet>
          <ascii-tabs-copy></ascii-tabs-copy>
          <ascii-tabs-delete></ascii-tabs-delete>
        </ascii-tabs-sheet>
        <ascii-tabs-add></ascii-tabs-add>
      </ascii-tabs>
`;
  return markup.replace(/%%(\w+)%%/g, (_, key) => values[key] || "") + renderTabTutorial(strings);
}

module.exports = { renderSharedTabEditor };
