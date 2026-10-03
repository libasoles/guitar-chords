'use strict';
/* static-server.js — Sirve un directorio por HTTP en localhost. Lo usan
   scripts/dev.js y scripts/lighthouse.js para servir dist/site. */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { HASHED_NAME_RE } = require('./fingerprint');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
};

/* Resuelve con el server ya escuchando. Con port 0 el sistema elige uno
   libre; leerlo de server.address().port. */
function serveStatic(root, port) {
  const server = http.createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath.endsWith('/')) urlPath += 'index.html';
    let filePath = path.join(root, urlPath);

    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        // Fallback: try appending .html (for extensionless routes like /en)
        fs.readFile(filePath + '.html', (err2, data2) => {
          if (err2) {
            res.writeHead(404);
            res.end('Not found');
            return;
          }
          res.writeHead(200, { 'Content-Type': MIME['.html'] });
          res.end(data2);
        });
        return;
      }
      const ext = path.extname(filePath);
      const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
      // Fingerprinted assets never change under the same URL (see fingerprint.js).
      if (HASHED_NAME_RE.test(filePath)) headers['Cache-Control'] = 'public, max-age=31536000, immutable';
      res.writeHead(200, headers);
      res.end(data);
    });
  });

  return new Promise((resolve) => {
    server.listen(port, () => resolve(server));
  });
}

module.exports = { serveStatic };
