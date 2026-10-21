const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
http.createServer((req, res) => {
  const name = req.url.split('?')[0];
  const file = name === '/' || name === '/Index.html' ? 'Index.html' : name === '/install' ? 'docs/installation.html' : null;
  if (!file) { res.writeHead(404); return res.end('Not found'); }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(fs.readFileSync(path.join(root, file)));
}).listen(4173, '127.0.0.1', () => console.log('Inventory preview: http://127.0.0.1:4173'));
