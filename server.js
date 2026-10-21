// Dependency-free static server for Railway: serves dist/ on $PORT.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('./dist/', import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.bin': 'application/octet-stream',
  '.txt': 'text/plain; charset=utf-8',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.webmanifest', '.svg', '.txt', '.bin']);

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob: mediastream:",
    "worker-src 'self' blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'self'",
  ].join('; '),
};

/**
 * Operator details for imprint and privacy policy, set as Railway variables (see RECHTLICHES.md).
 * Without LEGAL_NAME the placeholder file dist/legal.json is served and the app shows a warning.
 */
function legalFromEnv() {
  const e = process.env;
  if (!e.LEGAL_NAME) return null;
  const lines = (v) => (v || '').replace(/\s*\|\s*/g, '\n').replace(/\\n/g, '\n').trim();
  const data = {
    configured: Boolean(e.LEGAL_NAME && e.LEGAL_ADDRESS && e.LEGAL_EMAIL),
    type: ['schule', 'privat', 'organisation'].includes(e.LEGAL_TYPE) ? e.LEGAL_TYPE : 'privat',
    name: e.LEGAL_NAME,
    representative: e.LEGAL_REPRESENTATIVE || '',
    address: lines(e.LEGAL_ADDRESS),
    email: e.LEGAL_EMAIL || '',
    phone: e.LEGAL_PHONE || '',
    dpo: lines(e.LEGAL_DPO),
    authority: lines(e.LEGAL_AUTHORITY),
    supervision: lines(e.LEGAL_SUPERVISION),
    contentResponsible: lines(e.LEGAL_CONTENT_RESPONSIBLE),
    serverLocation: e.LEGAL_SERVER_LOCATION || 'EU West (Amsterdam, Niederlande)',
    logDays: e.LEGAL_LOG_DAYS || '30',
    date: e.LEGAL_DATE || 'Oktober 2026',
  };
  return Buffer.from(JSON.stringify(data));
}
const LEGAL = legalFromEnv();
if (!LEGAL) console.warn('Hinweis: LEGAL_* Variablen fehlen – Impressum/Datenschutz zeigen Platzhalter (siehe RECHTLICHES.md).');

/** @type {Map<string, {body: Buffer, gz: Buffer|null, etag: string, mtime: number}>} */
const cache = new Map();

async function load(file) {
  const st = await stat(file);
  if (!st.isFile()) return null;
  const hit = cache.get(file);
  if (hit && hit.mtime === st.mtimeMs) return hit;
  const body = await readFile(file);
  const ext = extname(file);
  const gz = COMPRESSIBLE.has(ext) && body.length > 1024 ? gzipSync(body, { level: 9 }) : null;
  const etag = '"' + createHash('sha1').update(body).digest('base64url').slice(0, 20) + '"';
  const entry = { body, gz, etag, mtime: st.mtimeMs };
  cache.set(file, entry);
  return entry;
}

function cacheControl(urlPath) {
  if (urlPath.startsWith('/assets/')) return 'public, max-age=31536000, immutable';
  if (/^\/model\/.+-v\d+\.(bin|json)$/.test(urlPath)) return 'public, max-age=31536000, immutable';
  if (urlPath.startsWith('/fonts/')) return 'public, max-age=2592000';
  return 'no-cache';
}

const server = createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  const url = new URL(req.url || '/', 'http://localhost');
  if (url.pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok');
    return;
  }
  if (url.pathname === '/legal.json' && LEGAL) {
    res.writeHead(200, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-cache', ...SECURITY_HEADERS });
    res.end(req.method === 'HEAD' ? undefined : LEGAL);
    return;
  }
  let urlPath;
  try {
    urlPath = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (urlPath.endsWith('/')) urlPath += 'index.html';
  const file = normalize(join(ROOT, urlPath));
  if (!file.startsWith(ROOT.endsWith(sep) ? ROOT : ROOT + sep)) {
    res.writeHead(403).end();
    return;
  }

  let entry = null;
  let servedPath = urlPath;
  try {
    entry = await load(file);
  } catch {
    entry = null;
  }
  if (!entry && !extname(urlPath)) {
    // SPA fallback for routes without a file extension
    servedPath = '/index.html';
    entry = await load(join(ROOT, 'index.html')).catch(() => null);
  }
  if (!entry) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS }).end('Nicht gefunden');
    return;
  }

  const headers = {
    'Content-Type': MIME[extname(servedPath)] || 'application/octet-stream',
    'Cache-Control': cacheControl(servedPath),
    ETag: entry.etag,
    Vary: 'Accept-Encoding',
    ...SECURITY_HEADERS,
  };
  // behind Railway's HTTPS proxy: tell browsers to always use HTTPS
  if (req.headers['x-forwarded-proto'] === 'https') headers['Strict-Transport-Security'] = 'max-age=31536000';
  if (req.headers['if-none-match'] === entry.etag) {
    res.writeHead(304, headers).end();
    return;
  }
  const useGz = entry.gz && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  const body = useGz ? entry.gz : entry.body;
  if (useGz) headers['Content-Encoding'] = 'gzip';
  headers['Content-Length'] = body.length;
  res.writeHead(200, headers);
  res.end(req.method === 'HEAD' ? undefined : body);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Buchstaben-Zoo läuft auf http://localhost:${PORT}`);
});

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
