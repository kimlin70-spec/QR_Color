/* Tiny static file server for local testing: `node test/serve.cjs` → http://127.0.0.1:8080/ */
const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

function serve(root, port) {
  root = path.resolve(root);
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        let p = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        if (p.endsWith('/')) p += 'index.html';
        const f = path.normalize(path.join(root, p));
        if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          return res.end('Not found');
        }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        fs.createReadStream(f).pipe(res);
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(String(e));
      }
    });
    server.on('error', reject);
    server.listen(port || 0, '127.0.0.1', () => resolve({ server, base: 'http://127.0.0.1:' + server.address().port + '/' }));
  });
}

module.exports = { serve };

if (require.main === module) {
  serve(path.resolve(__dirname, '..'), parseInt(process.env.PORT || '8080', 10)).then(({ base }) => console.log('Serving ' + base));
}
