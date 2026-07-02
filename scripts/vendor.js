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

// Pinned URLs. To upgrade: change the URL and commit the new vendor file.
const LIBS = [
  { url: 'https://omnibrain.github.io/svguitar/js/svguitar.umd.js', out: path.join(VENDOR, 'svguitar.umd.js') },
  { url: 'https://cdn.jsdelivr.net/npm/fuzzysort@3.1.0/fuzzysort.js', out: path.join(VENDOR, 'fuzzysort.js') },
];

function say(msg) { process.stdout.write('  ' + msg + '\n'); }
function fail(msg) { process.stderr.write('ERROR: ' + msg + '\n'); process.exit(1); }

function download(lib) {
  return new Promise(function (resolve, reject) {
    if (fs.existsSync(lib.out)) {
      say(path.relative(ROOT, lib.out) + ' already present, skipping download.');
      resolve();
      return;
    }
    console.log('==> Downloading ' + path.basename(lib.out) + '...');
    const file = fs.createWriteStream(lib.out);
    https.get(lib.url, function (res) {
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(lib.out);
        reject(new Error('HTTP ' + res.statusCode + ' from ' + lib.url));
        return;
      }
      res.pipe(file);
      file.on('finish', function () {
        file.close();
        say(lib.url + ' → ' + path.relative(ROOT, lib.out));
        resolve();
      });
    }).on('error', function (err) {
      file.close();
      if (fs.existsSync(lib.out)) fs.unlinkSync(lib.out);
      reject(err);
    });
  });
}

fs.mkdirSync(VENDOR, { recursive: true });

LIBS.reduce(function (chain, lib) {
  return chain.then(function () { return download(lib); });
}, Promise.resolve())
  .then(function () { console.log('==> Done.'); })
  .catch(function (err) { fail(err.message); });
