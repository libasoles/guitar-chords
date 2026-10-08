// Parse an ASCII guitar tab into one Tab of the ascii-tabs `value` format
// (vendor/ascii-tabs.js): one array per column, one fret number per guitar
// string from the 1st (high e) to the 6th, null where nothing is played.
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
    cols.push(lines.map(function (line) {
      const fret = line.slice(c * 4, c * 4 + 4).replace(/-/g, '');
      return fret === '' ? null : Number(fret);
    }));
  }
  return cols;
}

module.exports = { parseAsciiTab };
