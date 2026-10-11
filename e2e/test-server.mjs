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
    // Mirror production asset layout: build-gh-pages.mjs maps /static/* to the
    // frontend root (css/, js/, icons/), and _headers serves manifest.json as
    // application/manifest+json. Without this alias local E2E loads no CSS/JS.
    if (urlPath.startsWith('/static/')) urlPath = urlPath.slice('/static'.length);

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
    // Match production: _headers serves /manifest.json as application/manifest+json,
    // and build-gh-pages.mjs step 5.6 rewrites its GitHub Pages base path
    // (/taronyang/*) to root-relative paths for the custom domain.
    if (filePath.endsWith(`${sep}manifest.json`)) {
      const prefix = '/taronyang/';
      const stripBasePath = (value) =>
        typeof value === 'string' && value.startsWith(prefix)
          ? '/' + value.slice(prefix.length)
          : value;
      const manifest = JSON.parse(data.toString('utf8'));
      if (typeof manifest.id === 'string') manifest.id = stripBasePath(manifest.id);
      if (typeof manifest.start_url === 'string') manifest.start_url = stripBasePath(manifest.start_url);
      if (typeof manifest.scope === 'string') manifest.scope = stripBasePath(manifest.scope);
      if (Array.isArray(manifest.icons)) {
        manifest.icons = manifest.icons.map((icon) => ({ ...icon, src: stripBasePath(icon.src) }));
      }
      if (Array.isArray(manifest.shortcuts)) {
        manifest.shortcuts = manifest.shortcuts.map((shortcut) => ({
          ...shortcut,
          icons: Array.isArray(shortcut.icons)
            ? shortcut.icons.map((icon) => ({ ...icon, src: stripBasePath(icon.src) }))
            : shortcut.icons,
        }));
      }
      res.writeHead(200, { 'Content-Type': 'application/manifest+json; charset=utf-8' });
      res.end(JSON.stringify(manifest, null, 2) + '\n');
      return;
    }
    const contentType = MIME[extname(filePath)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Server Error');
  }
}).listen(PORT, () => {
  console.log(`Static server running on http://localhost:${PORT}`);
});
