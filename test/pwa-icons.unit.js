const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

test('deployment without rsvg uses the current logo in both manifests, touch icons and offline cache', t => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pwa-icons-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const bin = path.join(temporary, 'bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'rsvg-convert'), '#!/bin/sh\nexit 127\n', { mode: 0o755 });
  const output = path.join(temporary, 'site');
  execFileSync(process.execPath, ['scripts/build-site.js'], {
    cwd: ROOT, stdio: 'pipe',
    env: { ...process.env, PATH: bin + path.delimiter + process.env.PATH, SITE_OUT_DIR: output },
  });
  const sw = fs.readFileSync(path.join(output, 'sw.js'), 'utf8');
  for (const locale of ['es', 'en']) {
    const manifest = JSON.parse(fs.readFileSync(path.join(output, 'assets', `manifest.${locale}.webmanifest`)));
    const html = fs.readFileSync(path.join(output, locale === 'es' ? 'index.html' : 'en.html'), 'utf8');
    for (const size of [192, 512]) {
      const icon = manifest.icons.find(icon => icon.sizes === `${size}x${size}`);
      assert.equal(icon.purpose, 'any maskable');
      assert.match(icon.src, new RegExp(`^icons/icon-${size}\\.[0-9a-f]{10}\\.png$`));
      const png = fs.readFileSync(path.join(output, 'assets', icon.src));
      assert.equal(png.readUInt32BE(16), size);
      assert.equal(png.readUInt32BE(20), size);
      assert.ok(png.equals(fs.readFileSync(path.join(ROOT, 'src', 'site', 'icons', `icon-${size}.png`))), 'install icon must use the current guitarist logo');
      assert.ok(sw.includes('/assets/' + icon.src), 'offline cache must use the same versioned icon');
      if (size === 192) {
        const touchIcon = html.match(/<link rel="apple-touch-icon" href="([^"]+)"/);
        assert.ok(touchIcon, 'page must expose a touch icon');
        assert.ok(touchIcon[1].endsWith('assets/' + icon.src), 'touch icon must use the same versioned logo');
      }
    }
  }
});
