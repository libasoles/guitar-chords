#!/usr/bin/env node
'use strict';
/* vendor.js — Downloads pinned third-party libraries into vendor/.
   Run once after cloning: npm run vendor
   CI runs this automatically before the build step. */

const https = require('https');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const VENDOR = path.join(ROOT, 'vendor');

// Pinned URL. To upgrade: change the URL and commit the new vendor file.
const SVGUITAR_URL = 'https://omnibrain.github.io/svguitar/js/svguitar.umd.js';
const SVGUITAR_OUT = path.join(VENDOR, 'svguitar.umd.js');

function say(msg) { process.stdout.write('  ' + msg + '\n'); }
function fail(msg) { process.stderr.write('ERROR: ' + msg + '\n'); process.exit(1); }

fs.mkdirSync(VENDOR, { recursive: true });

// Skip if already present (idempotent in CI with cache).
if (fs.existsSync(SVGUITAR_OUT)) {
  say('vendor/svguitar.umd.js already present, skipping download.');
  process.exit(0);
}

console.log('==> Downloading svguitar...');
const file = fs.createWriteStream(SVGUITAR_OUT);
https.get(SVGUITAR_URL, function (res) {
  if (res.statusCode !== 200) {
    file.close();
    fs.unlinkSync(SVGUITAR_OUT);
    fail('HTTP ' + res.statusCode + ' from ' + SVGUITAR_URL);
  }
  res.pipe(file);
  file.on('finish', function () {
    file.close();
    say(SVGUITAR_URL + ' → vendor/svguitar.umd.js');
    console.log('==> Done.');
  });
}).on('error', function (err) {
  file.close();
  if (fs.existsSync(SVGUITAR_OUT)) fs.unlinkSync(SVGUITAR_OUT);
  fail(err.message);
});
