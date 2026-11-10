// Handwriting samples ("Schriftproben") that a class gives after a lesson to improve the recognition (pure
// validation helpers, tested in test/server/samples.test.ts). A sample is one cut-out letter as a small PNG
// (ink in the alpha channel, no photo, no name), its place in the order of writing and its label. The admin
// downloads them as a ZIP package (server/zip.js) for tools/train/import_samples.py.
import { GAME_IDS, LANGS } from './validate.js';

/** at most this many letters in one lesson */
export const MAX_SAMPLES = 400;
/** a PNG of a letter is a few KB; base64 of 48 KB leaves room */
export const MAX_PNG_B64 = 48_000;
/** the longest side of a sample image */
export const MAX_PNG_SIDE = 160;
/** the whole upload of a lesson */
export const MAX_SAMPLES_BODY = 4 * 1024 * 1024;
/** where a label comes from: a word written right (Wörter-Zoo), the practice target the recogniser agreed with,
 * or only the recogniser's guess */
export const LABEL_SOURCES = ['wort', 'uebung', 'erkannt'];
const SCRIPTS = ['druck', 'grund', 'schreib', 'hiragana', 'katakana', 'kyrillisch', 'arabisch', 'devanagari', 'griechisch', 'hebraeisch', 'hangul', 'thai'];
const STYLES = ['beide', 'druck', 'grund'];
const TIERS = ['zerknittert', 'schief', 'nett', 'schoen', 'prachtvoll'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
/** exactly one character (one code point, letters of every script of the app) */
const oneChar = (v) => typeof v === 'string' && [...v].length === 1 && !/[\s\p{C}]/u.test(v);

/** width and height of a PNG, null when it is none */
export function pngSize(buf) {
  if (buf.length < 33) return null;
  if (buf.readUInt32BE(0) !== 0x89504e47 || buf.readUInt32BE(4) !== 0x0d0a1a0a || buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function sampleOf(s) {
  const keys = ['seq', 'scan', 'label', 'source', 'recognized', 'target', 'score', 'tier', 'mirrored', 'rejected', 'dots', 'box', 'png'];
  if (!isObj(s)) return null;
  for (const k of Object.keys(s)) if (!keys.includes(k)) return null;
  if (!isInt(s.seq, 0, MAX_SAMPLES - 1) || !isInt(s.scan, 0, 10_000)) return null;
  if (!oneChar(s.label) || !LABEL_SOURCES.includes(s.source)) return null;
  const optChar = (v) => (v === undefined || v === null || v === '' ? null : oneChar(v) ? v : undefined);
  const recognized = optChar(s.recognized);
  const target = optChar(s.target);
  if (recognized === undefined || target === undefined) return null;
  if (!isNum(s.score) || s.score < 0 || s.score > 100 || !TIERS.includes(s.tier)) return null;
  if (typeof s.mirrored !== 'boolean' || typeof s.rejected !== 'boolean' || !isInt(s.dots, 0, 9)) return null;
  const b = s.box;
  if (!isObj(b) || ![b.x, b.y, b.w, b.h].every((v) => isNum(v) && v >= -10_000 && v <= 10_000) || Object.keys(b).length !== 4) return null;
  if (typeof s.png !== 'string' || !s.png || s.png.length > MAX_PNG_B64 || !/^[A-Za-z0-9+/]+=*$/.test(s.png)) return null;
  const png = Buffer.from(s.png, 'base64');
  const size = pngSize(png);
  if (!size || size.w < 1 || size.h < 1 || size.w > MAX_PNG_SIDE || size.h > MAX_PNG_SIDE) return null;
  return { seq: s.seq, scan: s.scan, label: s.label, source: s.source, recognized, target, score: s.score, tier: s.tier, mirrored: s.mirrored, rejected: s.rejected, dots: s.dots, box: { x: b.x, y: b.y, w: b.w, h: b.h }, png };
}

/** the upload of one lesson: the game, its ticket (spam protection, server/ratingGuard.js) and the letters */
export function validateSampleBatch(body) {
  if (!isObj(body)) return { ok: false, error: 'not an object' };
  for (const k of Object.keys(body)) if (!['game', 'ticket', 'script', 'style', 'lang', 'samples'].includes(k)) return { ok: false, error: `unknown field ${k}` };
  if (!GAME_IDS.includes(body.game)) return { ok: false, error: 'game' };
  if (typeof body.ticket !== 'string' || !body.ticket || body.ticket.length > 400) return { ok: false, error: 'ticket' };
  if (!SCRIPTS.includes(body.script)) return { ok: false, error: 'script' };
  if (!STYLES.includes(body.style)) return { ok: false, error: 'style' };
  if (!LANGS.includes(body.lang)) return { ok: false, error: 'lang' };
  if (!Array.isArray(body.samples) || !body.samples.length || body.samples.length > MAX_SAMPLES) return { ok: false, error: 'samples' };
  const samples = [];
  for (const s of body.samples) {
    const v = sampleOf(s);
    if (!v) return { ok: false, error: `sample ${samples.length}` };
    samples.push(v);
  }
  return { ok: true, value: { game: body.game, ticket: body.ticket, script: body.script, style: body.style, lang: body.lang, samples } };
}

/** what the admin deletes: one lesson ({ batch }), the downloaded ones ({ exported: true }) or all ({ all: true }) */
export function validateSampleDelete(body) {
  if (!isObj(body) || Object.keys(body).length !== 1) return { ok: false, error: 'action' };
  if (typeof body.batch === 'string' && UUID.test(body.batch)) return { ok: true, value: { batch: body.batch } };
  if (body.exported === true) return { ok: true, value: { exported: true } };
  if (body.all === true) return { ok: true, value: { all: true } };
  return { ok: false, error: 'action' };
}
