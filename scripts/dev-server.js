// Local preview without the Vercel CLI: `ADMIN_PASSWORD=test npm run dev`
import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = path.resolve('public');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.png': 'image/png', '.mjs': 'text/javascript', '.ico': 'image/x-icon' };
const PORT = process.env.PORT || 3000;

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    const name = url.pathname.slice(5).replace(/[^a-z-]/g, '');
    try {
      const mod = await import(path.resolve('api', `${name}.js`));
      return mod.default(req, res);
    } catch { res.statusCode = 404; return res.end('Not found'); }
  }
  const clean = { '/': 'index.html' };
  let file = path.join(root, clean[url.pathname] || url.pathname);
  if (!file.startsWith(root)) { res.statusCode = 403; return res.end(); }
  try {
    const data = await fs.readFile(file);
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  } catch { res.statusCode = 404; res.end('Not found'); }
}).listen(PORT, () => console.log(`Dashboard running on http://localhost:${PORT}`));
