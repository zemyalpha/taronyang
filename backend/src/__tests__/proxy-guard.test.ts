import fs from 'fs';
import path from 'path';

interface ProxyContext {
  env: { BACKEND_URL?: string };
  params: { path?: string[] };
  request: Request;
}

type OnRequestFn = (ctx: ProxyContext) => Promise<Response>;

const PROXY_FILE = path.resolve(__dirname, '../../../frontend/functions/api/[[path]].js');

function loadProxy(): OnRequestFn {
  const src = fs.readFileSync(PROXY_FILE, 'utf-8');
  const code = src.replace(/^export\s+/m, '');
  const factory = new Function(`${code}\nreturn onRequest;`);
  return factory() as OnRequestFn;
}

const onRequest = loadProxy();

function makeContext(pathSegments: string[] | undefined, env?: { BACKEND_URL?: string }): ProxyContext {
  const url = 'https://taronyang.pages.dev/api/' + (pathSegments ? pathSegments.join('/') : '');
  return {
    env: env || { BACKEND_URL: 'https://backend.example.com' },
    params: { path: pathSegments },
    request: new Request(url),
  };
}

describe('API proxy path-traversal guard (ZEMA-3445)', () => {
  it('guard present in source code', () => {
    const src = fs.readFileSync(PROXY_FILE, 'utf-8');
    expect(src).toContain('..');
    expect(src).toMatch(/includes\(['"]\.\.['"]\)/);
    expect(src).toMatch(/400/);
  });

  it('rejects ".." in a single path segment with 400', async () => {
    const res = await onRequest(makeContext(['..']));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Bad Request');
  });

  it('rejects ".." nested in multi-segment path with 400', async () => {
    const res = await onRequest(makeContext(['foo', '..', 'bar']));
    expect(res.status).toBe(400);
  });

  it('rejects "..." (triple dot, contains "..") with 400', async () => {
    const res = await onRequest(makeContext(['...']));
    expect(res.status).toBe(400);
  });

  it('does NOT reject normal single-segment API paths (no 400 from guard)', async () => {
    const res = await onRequest(makeContext(['auth', 'me']));
    expect(res.status).not.toBe(400);
  });

  it('does NOT reject when path param is undefined (root)', async () => {
    const res = await onRequest(makeContext(undefined));
    expect(res.status).not.toBe(400);
  });

  it('does NOT reject filenames with dots (e.g. tarot.json)', async () => {
    const res = await onRequest(makeContext(['data', 'tarot.json']));
    expect(res.status).not.toBe(400);
  });

  it('returns 503 when BACKEND_URL not configured', async () => {
    const res = await onRequest(makeContext(['auth', 'me'], {}));
    expect(res.status).toBe(503);
  });
});

describe('proxy guard — allow-list header forwarding', () => {
  it('rejects path traversal even with malicious headers', async () => {
    const ctx = makeContext(['..']);
    ctx.request = new Request('https://taronyang.pages.dev/api/..', {
      headers: { 'X-Evil': 'yes', authorization: 'Bearer stolen' },
    });
    const res = await onRequest(ctx);
    expect(res.status).toBe(400);
    const body = await res.text();
    expect(body).not.toContain('stolen');
  });
});
