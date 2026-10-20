/* Artefactos publicados de los Preludios de Carcassi (downloads/carcassi-preludios).
   Run: node --test test/carcassi-preludios.unit.js
   Contrato: cada preludio publicado tiene PDF y MusicXML con el mismo nombre base,
   el MusicXML es legible y trae los compases esperados. Independencia: ningun
   archivo conserva rastros del PDF de origen y el PDF lleva los metadatos fijados. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const editions = require('../scripts/lib/article-carcassi-preludes');

/* Compases de cada preludio, contados una vez sobre la partitura del libro. */
const MEASURES = { 1: 8, 2: 8, 3: 7, 4: 8, 5: 8, 6: 16, 7: 8, 8: 11, 9: 8, 10: 10, 11: 8, 12: 12, 13: 8, 14: 8, 15: 8, 16: 10 };

/* Cadenas del PDF de origen: nombre del archivo, productor del original, editor, licencia de la edicion. */
const SOURCE_TRACES = [/CarcassiMethod/i, /Ghostscript/i, /Santisteban/i, /Mutopia/i, /LilyPond/i, /Preludes in Progressive/i];

test('Mi mayor, compás 3: alterna si–mi con re natural sobre el bajo mi', () => {
  for (const file of [
    '../scripts/carcassi-preludios/corrected/prelude-09.musicxml',
    '../downloads/carcassi-preludios/Prelude 9 in E Major - Matteo Carcassi.musicxml',
  ]) {
    const xml = fs.readFileSync(path.join(__dirname, file), 'utf8');
    const bar = xml.match(/<measure\b[^>]*number="3"[^>]*>([\s\S]*?)<\/measure>/)[1];
    const attacks = [];
    const bass = [];
    for (const [, note] of bar.matchAll(/<note\b[^>]*>([\s\S]*?)<\/note>/g)) {
      if (!/<pitch>/.test(note) || /<staff>2<\/staff>/.test(note)) continue;
      const pitch = note.match(/<step>(.*?)<\/step>/)[1]
        + (/<alter>1<\/alter>/.test(note) ? '#' : '') + note.match(/<octave>(.*?)<\/octave>/)[1];
      const type = note.match(/<type>(.*?)<\/type>/)[1];
      if (/<voice>2<\/voice>/.test(note)) {
        bass.push([pitch, type]);
      } else if (/<chord\s*\//.test(note)) {
        attacks.at(-1).push(pitch);
      } else {
        assert.equal(type, '16th', file);
        attacks.push([pitch]);
      }
    }
    assert.deepEqual(attacks, [['B4', 'E5'], ['D5'], ['B4', 'E5'], ['D5'], ['B4', 'E5'], ['D5']], file);
    assert.deepEqual(bass, [['E3', 'half']], file);
    assert.match(bar, /<accidental>natural<\/accidental>/, file);
  }
});

/* Verifica que el XML este bien formado (etiquetas balanceadas); devuelve el texto sin la cabecera. */
function assertWellFormed(xml) {
  const stack = [];
  const tags = xml.replace(/<!--[\s\S]*?-->/g, '').replace(/<\?[\s\S]*?\?>/g, '').replace(/<!DOCTYPE[^>]*>/g, '');
  for (const m of tags.matchAll(/<(\/?)([A-Za-z][\w:.-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g)) {
    if (m[4]) continue;
    if (m[1]) assert.equal(stack.pop(), m[2], 'etiqueta sin cerrar: ' + m[2]);
    else stack.push(m[2]);
  }
  assert.deepEqual(stack, [], 'etiquetas sin cerrar');
}

/* Compases de la parte y pentagramas que declara (notacion + TAB comparten parte). */
function scoreShape(xml) {
  const part = xml.match(/<part id="[^"]*">([\s\S]*?)<\/part>/)[1];
  return { parts: (xml.match(/<part id=/g) || []).length, measures: (part.match(/<measure\b/g) || []).length,
    staves: Number((part.match(/<staves>(\d+)<\/staves>/) || [])[1]) };
}

for (const [edition, catalog] of [['carcassi', editions], ['santisteban', editions.santisteban]]) {
  const { publishedPreludes, DOWNLOADS_DIR, PREVIEW_DIR } = catalog;
  const preludes = publishedPreludes();

  test('hay al menos un preludio publicado y salen en orden numerico', () => {
    assert.equal(preludes.length, 16, edition + ': complete collection');
    assert.deepEqual(preludes.map((p) => p.number), preludes.map((p) => p.number).sort((a, b) => a - b));
  });

  for (const prelude of preludes) {
    test('preludio ' + prelude.number + ': PDF y MusicXML con el mismo nombre base', () => {
      assert.match(prelude.base, /^Prelude \d+ in [A-G][#b]? (Major|Minor) - Matteo Carcassi(?: - Santisteban)?$/);
      assert.ok(fs.existsSync(path.join(DOWNLOADS_DIR, prelude.base + '.pdf')));
      assert.ok(fs.existsSync(path.join(DOWNLOADS_DIR, prelude.base + '.musicxml')));
    });

    test('preludio ' + prelude.number + ': MusicXML legible, con notacion y TAB y los compases del libro', () => {
      const xml = fs.readFileSync(path.join(DOWNLOADS_DIR, prelude.base + '.musicxml'), 'utf8');
      assertWellFormed(xml);
      const shape = scoreShape(xml);
      assert.equal(shape.staves, 2, 'notacion + pentagrama TAB');
      assert.equal(shape.measures, edition === 'carcassi' ? ({ 6: 12, 9: 16, 10: 12 }[prelude.number] || MEASURES[prelude.number]) : MEASURES[prelude.number]);
    });

    test('preludio ' + prelude.number + ': preview de un sistema con partitura y TAB', () => {
      const svg = fs.readFileSync(path.join(PREVIEW_DIR, catalog.SCORE_PREFIX + String(prelude.number).padStart(2, '0') + '.svg'), 'utf8');
      assertWellFormed(svg);
      assert.equal((svg.match(/ class="system"/g) || []).length, 1);
      const measures = (svg.match(/ class="measure"/g) || []).length;
      assert.ok(measures > 0);
      assert.equal((svg.match(/ class="staff"/g) || []).length, measures * 2);
      assert.match(svg, / class="tabGrp"/);
    });

    test('preludio ' + prelude.number + ': independiente del PDF de origen', () => {
      const pdf = fs.readFileSync(path.join(DOWNLOADS_DIR, prelude.base + '.pdf'));
      const xml = fs.readFileSync(path.join(DOWNLOADS_DIR, prelude.base + '.musicxml'), 'utf8');
      assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
      const text = pdf.toString('latin1');
      for (const trace of SOURCE_TRACES.filter((trace) => edition !== 'santisteban' || !trace.test('Santisteban'))) {
        assert.doesNotMatch(text, trace, 'PDF: ' + trace);
        assert.doesNotMatch(xml, trace, 'MusicXML: ' + trace);
      }
      const info = text.match(/\/Title\s*\(((?:\\.|[^\\)])*)\)/);
      assert.ok(info, 'el PDF declara /Title');
      // El PDF escapa algunos caracteres (p. ej. # como \043).
      const title = info[1].replace(/\\(\d{3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8))).replace(/\\([()\\])/g, '$1');
      assert.equal(title, prelude.base.split(' - ')[0] + (edition === 'santisteban' ? ' (Santisteban)' : ''));
      assert.match(text, /\/Author\s*\(Matteo Carcassi\)/);
      assert.doesNotMatch(text, /\/Producer|\/Creator|\/CreationDate|\/ModDate/);
      assert.doesNotMatch(text, /<x:xmpmeta|\/Metadata/);
      assert.doesNotMatch(xml, /<encoding>|<software>|<rights>|<source>|<encoding-date>/);
    });
  }

}

// The D-major basses distinguish the source texts, including our former transcription error.
test('Re mayor: cada edición conserva sus bajos y su armonía', () => {
  const basses = (folder) => {
    const xml = fs.readFileSync(path.join(__dirname, '../scripts/carcassi-preludios', folder, 'prelude-05.musicxml'), 'utf8');
    return Array.from(xml.matchAll(/<measure\b[^>]*>([\s\S]*?)<\/measure>/g), (bar) =>
      Array.from(bar[1].matchAll(/<note\b[^>]*>([\s\S]*?)<\/note>/g)).filter((n) => /<voice>2<\/voice>/.test(n[1]) && /<pitch>/.test(n[1]))
        .map((n) => n[1].match(/<step>(.*?)<\/step>/)[1] + (/<alter>1<\/alter>/.test(n[1]) ? '#' : '') + n[1].match(/<octave>(.*?)<\/octave>/)[1]));
  };
  assert.deepEqual(basses('corrected').slice(1, 5), [['E4', 'E4'], ['A3', 'A3'], ['D4', 'D4'], ['E4', 'E4']]);
  assert.deepEqual(basses('santisteban').slice(1, 5), [['E4', 'A3'], ['A3', 'D4'], ['D4', 'G3'], ['E3', 'E4']]);
  assert.equal(basses('corrected')[6][1], 'A3');
  assert.equal(basses('santisteban')[6][1], 'F#4');
});
