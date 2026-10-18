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
  assert.equal(manifest.version, '0.3.2');
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
  const tabsZip = fs.readFileSync(path.join(output, 'tabs.zip'));
  build('tabs');
  assert.deepEqual(fs.readFileSync(path.join(output, 'chords.zip')), chordsZip);
  build('chords');
  assert.deepEqual(fs.readFileSync(path.join(output, 'tabs.zip')), tabsZip);
  const extension = path.join(output, 'tabs');
  const manifest = JSON.parse(fs.readFileSync(path.join(extension, 'manifest.json')));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, '0.1.0');
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
