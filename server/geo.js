// Country of a page view from the visitor's IP address, looked up in DB-IP's free "IP to Country Lite"
// list (CC BY 4.0, https://db-ip.com). The list lives on our own server: it is downloaded once a month
// into GEOIP_DIR (default .geoip/), no visitor data goes anywhere. Only the country is used; the IP
// address is not kept.
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { isIPv4, isIPv6 } from 'node:net';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

const URL_OF = (month) => `https://download.db-ip.com/free/dbip-country-lite-${month}.csv.gz`;
const FILE_RE = /^dbip-country-lite-(\d{4}-\d{2})\.csv\.gz$/;
const DAY_MS = 24 * 3600 * 1000;

/** IPv4 as an unsigned 32-bit number, IPv6 as its upper 64 bits (BigInt); null for anything else */
export function parseIp(raw) {
  let ip = String(raw || '').trim();
  if (ip.startsWith('[')) ip = ip.slice(1, ip.indexOf(']'));
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) ip = mapped[1];
  if (isIPv4(ip)) return { v: 4, n: ip.split('.').reduce((a, p) => a * 256 + Number(p), 0) };
  if (!isIPv6(ip)) return null;
  ip = ip.split('%')[0];
  // an embedded IPv4 tail (::1.2.3.4) only touches the lower 64 bits, which are not used
  const [head, tail = ''] = ip.split('::');
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  const groups = ip.includes('::') ? [...h, ...Array(8 - h.length - t.length).fill('0'), ...t] : h;
  let hi = 0n;
  for (let i = 0; i < 4; i++) hi = (hi << 16n) | BigInt(parseInt(groups[i] || '0', 16) || 0);
  return { v: 6, hi };
}

const code = (cc) => cc.charCodeAt(0) * 256 + cc.charCodeAt(1);
const uncode = (n) => String.fromCharCode(n >> 8, n & 255);

/** The search tables of the CSV "first,last,CC" (ranges sorted by their first address, as DB-IP ships them). */
export function buildIndex(csv) {
  const v4 = { start: [], end: [], cc: [] };
  const v6 = { start: [], end: [], cc: [] };
  for (const line of csv.split('\n')) {
    const [a, b, cc] = line.trim().split(',');
    if (!cc || cc.length !== 2) continue;
    const pa = parseIp(a);
    const pb = parseIp(b);
    if (!pa || !pb || pa.v !== pb.v) continue;
    const t = pa.v === 4 ? v4 : v6;
    t.start.push(pa.v === 4 ? pa.n : pa.hi);
    t.end.push(pa.v === 4 ? pb.n : pb.hi);
    t.cc.push(code(cc));
  }
  return {
    v4: { start: Uint32Array.from(v4.start), end: Uint32Array.from(v4.end), cc: Uint16Array.from(v4.cc) },
    v6: { start: BigUint64Array.from(v6.start), end: BigUint64Array.from(v6.end), cc: Uint16Array.from(v6.cc) },
  };
}

/** ISO 3166 code of the country of `ip`, or null (unknown, private network, not loaded) */
export function lookup(index, ip) {
  const p = parseIp(ip);
  if (!index || !p) return null;
  const t = p.v === 4 ? index.v4 : index.v6;
  const x = p.v === 4 ? p.n : p.hi;
  // the last range starting at or before x
  let lo = 0;
  let hi = t.start.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (t.start[mid] <= x) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  if (found < 0 || x > t.end[found]) return null;
  const cc = uncode(t.cc[found]);
  // ZZ: reserved and private address ranges
  return cc === 'ZZ' ? null : cc;
}

const monthOf = (d) => d.toISOString().slice(0, 7);

/** Keeps the country list loaded and fresh. Without it (offline, download failed) countries are just unknown. */
export class GeoIp {
  /** @param {{dir: string, fetch?: typeof fetch, now?: () => Date}} o */
  constructor({ dir, fetch: fetchFn = globalThis.fetch, now = () => new Date() }) {
    this.dir = dir;
    this.fetch = fetchFn;
    this.now = now;
    this.index = null;
    this.month = null;
    this.timer = null;
  }

  country(ip) {
    return lookup(this.index, ip);
  }

  /** loads the newest saved list, then looks for a newer one now and once a day */
  async start() {
    await this.loadSaved().catch((e) => console.warn('Länderliste:', e.message));
    void this.refresh();
    this.timer = setInterval(() => void this.refresh(), DAY_MS);
    this.timer.unref?.();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  async loadSaved() {
    const names = (await readdir(this.dir).catch(() => [])).filter((n) => FILE_RE.test(n)).sort();
    const newest = names.at(-1);
    if (!newest) return;
    this.use(await readFile(join(this.dir, newest)), FILE_RE.exec(newest)[1]);
  }

  use(gz, month) {
    this.index = buildIndex(gunzipSync(gz).toString('utf8'));
    this.month = month;
    console.log(`Länderliste ${month} geladen (${this.index.v4.cc.length + this.index.v6.cc.length} Bereiche, IP Geolocation by DB-IP).`);
  }

  /** DB-IP publishes at the start of each month: try this month, else last month */
  async refresh() {
    const now = this.now();
    const months = [monthOf(now), monthOf(new Date(now.getTime() - 20 * DAY_MS))];
    if (this.month && this.month >= months[0]) return;
    for (const month of [...new Set(months)]) {
      if (this.month && this.month >= month) return;
      try {
        const r = await this.fetch(URL_OF(month), { signal: AbortSignal.timeout(120_000) });
        if (!r.ok) continue;
        const gz = Buffer.from(await r.arrayBuffer());
        this.use(gz, month);
        await this.save(gz, month).catch((e) => console.warn('Länderliste nicht gespeichert:', e.message));
        return;
      } catch (e) {
        console.warn(`Länderliste ${month} nicht geladen:`, e.message);
      }
    }
  }

  async save(gz, month) {
    await mkdir(this.dir, { recursive: true });
    const file = join(this.dir, `dbip-country-lite-${month}.csv.gz`);
    await writeFile(file + '.part', gz);
    await rename(file + '.part', file);
    // keep only the newest list
    for (const n of await readdir(this.dir)) if (FILE_RE.test(n) && n !== `dbip-country-lite-${month}.csv.gz`) await rm(join(this.dir, n));
  }
}
