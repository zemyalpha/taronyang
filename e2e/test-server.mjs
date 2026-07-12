import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve, sep } from 'node:path';

const ROOT = resolve(join(process.cwd(), 'frontend'));
const PORT = 8000;

function isPathSafe(filePath) {
  return filePath === ROOT || filePath.startsWith(ROOT + sep);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

createServer(async (req, res) => {
  try {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/') urlPath = '/index.html';

    let filePath = resolve(join(ROOT, urlPath));

    if (!isPathSafe(filePath)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }

    // Try exact file first
    let info;
    try {
      info = await stat(filePath);
    } catch {
      // Clean URL fallback: /tarot -> tarot.html
      filePath = resolve(join(ROOT, urlPath + '.html'));
      if (!isPathSafe(filePath)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
      }
      try {
        info = await stat(filePath);
      } catch {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }
    }

    if (info.isDirectory()) {
      filePath = resolve(join(filePath, 'index.html'));
    }

    const data = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Server Error');
  }
}).listen(PORT, () => {
  console.log(`Static server running on http://localhost:${PORT}`);
});
