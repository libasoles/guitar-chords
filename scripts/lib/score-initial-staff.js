// Use the same model and Verovio version as the shared browser editor.
const M = require('../../src/site/score-model');
let cached;
function renderEmptyStaff() {
  return cached ||= import('partitura/staff').then(({ renderEmptyStaff }) => renderEmptyStaff(undefined, M.emptyScore()));
}
module.exports = { renderEmptyStaff };
