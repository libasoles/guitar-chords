const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');

test('building Chords preserves sibling outputs and packages its complete runtime', t => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'extension-build-'));
  t.after(() => fs.rmSync(output, { recursive: true, force: true }));
  fs.mkdirSync(path.join(output, 'other'));
  fs.writeFileSync(path.join(output, 'other', 'keep.txt'), 'other product');
  fs.writeFileSync(path.join(output, 'other.zip'), 'other archive');
  execFileSync(process.execPath, ['scripts/build-ext.js', 'chords', '--out-dir', output], { cwd: ROOT, stdio: 'pipe' });
  assert.equal(fs.readFileSync(path.join(output, 'other', 'keep.txt'), 'utf8'), 'other product');
  assert.equal(fs.readFileSync(path.join(output, 'other.zip'), 'utf8'), 'other archive');
  const extension = path.join(output, 'chords');
  const manifest = JSON.parse(fs.readFileSync(path.join(extension, 'manifest.json')));
  assert.equal(manifest.version, '0.3.6');
  assert.equal(manifest.default_locale, 'en');
  assert.deepEqual(manifest.permissions, []);
  assert.equal(JSON.parse(fs.readFileSync(path.join(extension, '_locales/en/messages.json'))).appName.message, 'Guitar Chords');
  for (const file of ['popup.html', 'popup.js', 'popup.css', 'chords-db.js', 'chord-search.js', 'chord-positions.js', 'chord-diagram.js', 'note-names.js', 'vendor/svguitar.umd.js', 'vendor/fuzzysort.js', ...Object.values(manifest.icons)]) {
    assert.ok(fs.statSync(path.join(extension, file)).size > 0, file);
  }
  const packaged = execFileSync('unzip', ['-Z1', path.join(output, 'chords.zip')], { encoding: 'utf8' }).trim().split('\n').filter(name => !name.endsWith('/')).sort();
  const files = fs.readdirSync(extension, { recursive: true }).filter(file => fs.statSync(path.join(extension, file)).isFile()).sort();
  assert.deepEqual(packaged, files);
  for (const file of files) {
    assert.deepEqual(execFileSync('unzip', ['-p', path.join(output, 'chords.zip'), file]), fs.readFileSync(path.join(extension, file)), file);
  }
});

test('a ZIP generation failure fails the build and removes the incomplete archive', t => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'extension-zip-failure-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const bin = path.join(temporary, 'bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'zip'), '#!' + process.execPath + '\nrequire("node:fs").writeFileSync(process.argv[3], "partial"); process.exit(23);\n', { mode: 0o755 });
  const result = spawnSync(process.execPath, ['scripts/build-ext.js', 'chords', '--out-dir', temporary], {
    cwd: ROOT, encoding: 'utf8', env: { ...process.env, PATH: bin + path.delimiter + process.env.PATH },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Extension build failed/);
  assert.doesNotMatch(result.stdout, /Done:/);
  assert.equal(fs.existsSync(path.join(temporary, 'chords.zip')), false);
});

test('both products build independently and Tabs packages its local editor resources', t => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'extension-products-'));
  t.after(() => fs.rmSync(output, { recursive: true, force: true }));
  const build = (...args) => execFileSync(process.execPath, ['scripts/build-ext.js', ...args, '--out-dir', output], { cwd: ROOT, stdio: 'pipe' });
  build();
  const chordsZip = fs.readFileSync(path.join(output, 'chords.zip'));
  build('tabs');
  assert.deepEqual(fs.readFileSync(path.join(output, 'chords.zip')), chordsZip);
  const tabsZip = fs.readFileSync(path.join(output, 'tabs.zip'));
  build('chords');
  assert.deepEqual(fs.readFileSync(path.join(output, 'tabs.zip')), tabsZip);
  const extension = path.join(output, 'tabs');
  const manifest = JSON.parse(fs.readFileSync(path.join(extension, 'manifest.json')));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, '0.1.1');
  assert.deepEqual(manifest.permissions || [], []);
  assert.equal(JSON.parse(fs.readFileSync(path.join(extension, '_locales/en/messages.json'))).appName.message, 'Guitar Tabs');
  for (const file of ['popup.html', 'popup.es.html', 'popup.en.html', 'popup.js', 'popup.css', 'tab-editor.js', 'tab-editor.css', 'vendor/ascii-tabs.js', ...Object.values(manifest.icons)]) {
    assert.ok(fs.statSync(path.join(extension, file)).size > 0, file);
  }
  const files = fs.readdirSync(extension, { recursive: true }).filter(file => fs.statSync(path.join(extension, file)).isFile()).sort();
  const packaged = execFileSync('unzip', ['-Z1', path.join(output, 'tabs.zip')], { encoding: 'utf8' }).trim().split('\n').filter(name => !name.endsWith('/')).sort();
  assert.deepEqual(packaged, files);
  for (const file of files) assert.deepEqual(execFileSync('unzip', ['-p', path.join(output, 'tabs.zip'), file]), fs.readFileSync(path.join(extension, file)), file);
});

test('Circle of Fifths builds independently and packages the shared wheel locally', t => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'extension-fifths-'));
  t.after(() => fs.rmSync(output, { recursive: true, force: true }));
  execFileSync(process.execPath, ['scripts/build-ext.js', 'fifths', '--out-dir', output], { cwd: ROOT, stdio: 'pipe' });
  const extension = path.join(output, 'fifths');
  const manifest = JSON.parse(fs.readFileSync(path.join(extension, 'manifest.json')));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, []);
  assert.equal(JSON.parse(fs.readFileSync(path.join(extension, '_locales/en/messages.json'))).appName.message, 'Circle of Fifths');
  assert.equal(JSON.parse(fs.readFileSync(path.join(extension, '_locales/es/messages.json'))).appName.message, 'Círculo de quintas');
  // The site links must match the real page paths, English ones carrying the /en prefix.
  const { pagePath } = require('../scripts/lib/slugs');
  for (const locale of ['en', 'es']) {
    const messages = JSON.parse(fs.readFileSync(path.join(extension, '_locales', locale, 'messages.json')));
    assert.equal(messages.siteUrl.message, 'https://acordesdeguitarra.com.ar' + pagePath('circulo-de-quintas', locale));
  }
  for (const file of ['popup.html', 'popup.js', 'popup.css', 'fifths-wheel.js', 'fifths-wheel.css', 'base.css', 'icon.svg', ...Object.values(manifest.icons)]) {
    assert.ok(fs.statSync(path.join(extension, file)).size > 0, file);
  }
  assert.ok(fs.statSync(path.join(output, 'fifths.zip')).size > 0);
  assert.doesNotMatch(fs.readFileSync(path.join(extension, 'popup.html'), 'utf8'), /https?:/);
});

test('Chord Identifier builds independently with the arpeggio positions and its tab and diagram libraries', t => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'extension-identifier-'));
  t.after(() => fs.rmSync(output, { recursive: true, force: true }));
  execFileSync(process.execPath, ['scripts/build-ext.js', 'identifier', '--out-dir', output], { cwd: ROOT, stdio: 'pipe' });
  const extension = path.join(output, 'identifier');
  const manifest = JSON.parse(fs.readFileSync(path.join(extension, 'manifest.json')));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions || [], []);
  assert.equal(JSON.parse(fs.readFileSync(path.join(extension, '_locales/en/messages.json'))).appName.message, 'Chord Identifier');
  assert.equal(JSON.parse(fs.readFileSync(path.join(extension, '_locales/es/messages.json'))).appName.message, 'Identificador de acordes');
  for (const file of ['popup.html', 'popup.js', 'popup.css', 'arpeggio-data.js', 'chord-diagram.js', 'chord-card.js', 'note-names.js', 'vendor/svguitar.umd.js', 'vendor/ascii-tabs.js', ...Object.values(manifest.icons)]) {
    assert.ok(fs.statSync(path.join(extension, file)).size > 0, file);
  }
  const sandbox = { window: {} };
  require('node:vm').runInNewContext(fs.readFileSync(path.join(extension, 'arpeggio-data.js'), 'utf8'), sandbox);
  const roots = sandbox.window.ARPEGGIO_ROOTS;
  assert.equal(roots[0].root, 'C');
  assert.equal(roots[0].variants[0].label.es, 'mayor');
  assert.equal(JSON.stringify(roots[0].variants[0].chords[0].form), '[0,1,0,null,3,null]');
  assert.equal(roots[0].variants[0].chords[0].card.name, 'C');
  assert.ok(roots.every(root => root.variants.every(variant => variant.chords.every(chord => chord.form.length === 6 && chord.card.fingers.length === 6))));
  const packaged = execFileSync('unzip', ['-Z1', path.join(output, 'identifier.zip')], { encoding: 'utf8' }).trim().split('\n').filter(name => !name.endsWith('/')).sort();
  const files = fs.readdirSync(extension, { recursive: true }).filter(file => fs.statSync(path.join(extension, file)).isFile()).sort();
  assert.deepEqual(packaged, files);
});
