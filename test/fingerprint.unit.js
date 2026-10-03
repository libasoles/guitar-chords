/* Fingerprinting de assets: URLs versionadas por contenido y referencias
   reescritas. Run: node --test test/fingerprint.unit.js */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { fingerprintAssets } = require('../scripts/lib/fingerprint');

function makeSite(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-'));
  Object.entries(files).forEach(([rel, body]) => {
    const p = path.join(dir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
  });
  return dir;
}
const read = (dir, rel) => fs.readFileSync(path.join(dir, rel), 'utf8');

const base = () => ({
  'index.html': '<link href="assets/site.css"><script src="/assets/app.js"></script><script src="assets/vendor/lib.js"></script>',
  'assets/site.css': 'body{}',
  'assets/app.js': "load('lib.js'); // /assets/vendor/lib.js",
  'assets/vendor/lib.js': 'var lib=1',
  'assets/icons/icon.png': 'png',
  'sw.js': 'const P=["/assets/site.css","/assets/app.js"];',
});

test('renombra js/css con hash de contenido y reescribe HTML, JS y sw.js', () => {
  const dir = makeSite(base());
  const map = fingerprintAssets(dir);
  const css = map.get('assets/site.css');
  assert.match(css, /^assets\/site\.[0-9a-f]{10}\.css$/);
  assert.ok(fs.existsSync(path.join(dir, css)));
  assert.ok(!fs.existsSync(path.join(dir, 'assets/site.css')));
  const html = read(dir, 'index.html');
  assert.ok(html.includes(css) && html.includes(map.get('assets/app.js')) && html.includes(map.get('assets/vendor/lib.js')));
  assert.ok(read(dir, 'sw.js').includes(map.get('assets/app.js')));
  assert.ok(read(dir, map.get('assets/app.js')).includes(path.basename(map.get('assets/vendor/lib.js'))));
});

test('no versiona assets que no son js/css/svg', () => {
  const dir = makeSite(base());
  fingerprintAssets(dir);
  assert.ok(fs.existsSync(path.join(dir, 'assets/icons/icon.png')));
});

test('el hash cambia solo cuando cambia el contenido (propagando a quien lo referencia)', () => {
  const a = fingerprintAssets(makeSite(base()));
  const b = fingerprintAssets(makeSite(base()));
  assert.deepEqual([...a], [...b]);
  const c = fingerprintAssets(makeSite({ ...base(), 'assets/vendor/lib.js': 'var lib=2' }));
  assert.notEqual(c.get('assets/vendor/lib.js'), a.get('assets/vendor/lib.js'));
  assert.notEqual(c.get('assets/app.js'), a.get('assets/app.js'));
  assert.equal(c.get('assets/site.css'), a.get('assets/site.css'));
});

test('propaga el hash de un SVG a la hoja CSS que lo usa', () => {
  const files = {
    'index.html': '<link href="assets/site.css">',
    'assets/site.css': '.logo { background: url("logo.svg") }',
    'assets/logo.svg': '<svg>first</svg>',
  };
  const firstDir = makeSite(files);
  const first = fingerprintAssets(firstDir);
  const firstCss = first.get('assets/site.css');
  const firstLogo = first.get('assets/logo.svg');
  assert.ok(read(firstDir, firstCss).includes(path.basename(firstLogo)));

  const second = fingerprintAssets(makeSite({ ...files, 'assets/logo.svg': '<svg>second</svg>' }));
  assert.notEqual(second.get('assets/logo.svg'), firstLogo);
  assert.notEqual(second.get('assets/site.css'), firstCss);
});

// ---- contra el build real (needs `npm run build:site`) ----------------------
const DIST = path.join(__dirname, '..', 'dist', 'site');
const HASHED = /\.[0-9a-f]{10}\.(js|css|svg)$/;

test('build: HTML solo referencia assets propios con hash y todos existen', () => {
  const pages = ['index.html', 'en/index.html', 'note-finder.html', 'canciones'];
  const htmls = [];
  (function collect(d) {
    fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== 'assets') collect(p); } else if (p.endsWith('.html')) htmls.push(p);
    });
  })(DIST);
  assert.ok(htmls.length > 5 && pages.length);
  htmls.forEach((f) => {
    const html = fs.readFileSync(f, 'utf8');
    for (const m of html.matchAll(/(?:src|href)="([^"]*assets\/[^"]+\.(?:js|css|svg))"/g)) {
      assert.match(m[1], HASHED, f + ' → ' + m[1]);
      const rel = m[1].replace(/^(\.\.\/|\/)*/, '').replace(/^.*?assets\//, 'assets/');
      assert.ok(fs.existsSync(path.join(DIST, rel)), f + ' → missing ' + rel);
    }
  });
});

test('build: las imagenes referenciadas desde CSS existen', () => {
  const assets = path.join(DIST, 'assets');
  const css = fs.readdirSync(assets).find((name) => /^site\.[0-9a-f]{10}\.css$/.test(name));
  assert.ok(css, 'missing fingerprinted site stylesheet');
  const content = fs.readFileSync(path.join(assets, css), 'utf8');
  for (const match of content.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
    const url = match[1];
    if (/^(?:data:|https?:|#)/.test(url)) continue;
    assert.ok(fs.existsSync(path.resolve(assets, url)), css + ' → missing ' + url);
  }
});

test('build: el precache del service worker apunta a archivos existentes (modo offline)', () => {
  const sw = fs.readFileSync(path.join(DIST, 'sw.js'), 'utf8');
  const urls = JSON.parse(sw.match(/PRECACHE_URLS = (\[.*?\]);/s)[1]);
  urls.filter((u) => u.startsWith('/assets/')).forEach((u) => {
    assert.ok(fs.existsSync(path.join(DIST, u)), 'missing ' + u);
  });
  assert.ok(urls.some((u) => HASHED.test(u)));
});

test('build: los loaders lazy de chord-finder apuntan a vendor versionado', () => {
  const f = fs.readdirSync(path.join(DIST, 'assets')).find((n) => /^chord-finder\./.test(n));
  const js = fs.readFileSync(path.join(DIST, 'assets', f), 'utf8');
  for (const name of js.match(/'(?:svguitar|jspdf)[^']*\.js'/g)) {
    assert.match(name.slice(1, -1), HASHED);
    assert.ok(fs.existsSync(path.join(DIST, 'assets', 'vendor', name.slice(1, -1))));
  }
});
