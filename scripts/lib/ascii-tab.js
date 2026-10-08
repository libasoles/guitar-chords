// Parse an ASCII guitar tab into the column format used by the tab editor
// (src/site/tab-editor.js): one array per column, one fret string per guitar
// string from the 1st (high e) to the 6th, '' where nothing is played.
// Every column is 4 characters wide ("---3", "--10"), after the "e|" label.

function parseAsciiTab(text) {
  const lines = text.trim().split('\n').map(function (line) {
    return line.trim().replace(/^[A-Za-z]\|/, '');
  });
  if (lines.length !== 6) throw new Error('ASCII tab needs 6 strings, got ' + lines.length);
  const width = lines[0].length;
  if (width % 4 !== 0 || lines.some(function (line) { return line.length !== width; })) {
    throw new Error('ASCII tab lines must share a width that is a multiple of 4');
  }
  const cols = [];
  for (let c = 0; c < width / 4; c++) {
    cols.push(lines.map(function (line) { return line.slice(c * 4, c * 4 + 4).replace(/-/g, ''); }));
  }
  return cols;
}

module.exports = { parseAsciiTab };
