// How letters are written: stroke order and direction for the animated templates (Druckschrift as
// taught in German primary schools; Grundschrift adds the small exit hooks of the lowercase letters).
//
// Order, direction and numbering follow the "Richtformen" of the Bavarian LehrplanPLUS: every numbered
// arrow of that chart is one stroke here, so the start numbers in the app match the chart.
//
// Coordinates are in bands of the school lines: top line y = 0, middle line 1, base line 2, bottom
// line 3; x from 0 to the glyph width. A stroke is a little path language:
//   M x y            move (start of the stroke)
//   L x y            straight line
//   C x1 y1 x2 y2 x y  cubic curve
//   O cx cy rx ry a0 a1  elliptic arc from angle a0 to a1 (degrees; decreasing = counter-clockwise)
//   D x y [x y]      a dot, or both umlaut dots as one stroke

interface GlyphDef {
  w: number;
  strokes: string[];
}

const RING = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number) => `O${cx} ${cy} ${rx} ${ry} ${a0} ${a1}`;
/** small letter bowl, counter-clockwise from the top right (a, d, g, q) */
const BOWL = RING(0.45, 1.5, 0.4, 0.5, -55, -415);

const GLYPHS: Record<string, GlyphDef> = {
  A: { w: 1.4, strokes: ['M0.05 2 L0.7 0', 'M0.7 0 L1.35 2', 'M0.32 1.25 L1.08 1.25'] },
  B: { w: 1.15, strokes: ['M0.1 0 L0.1 2', 'M0.1 0 L0.5 0 C0.98 0 0.98 0.95 0.5 0.95 L0.1 0.95 L0.58 0.95 C1.12 0.95 1.12 2 0.58 2 L0.1 2'] },
  C: { w: 1.3, strokes: [RING(0.68, 1, 0.62, 1, -40, -320)] },
  D: { w: 1.25, strokes: ['M0.1 0 L0.1 2', 'M0.1 0 L0.45 0 C1.25 0 1.25 2 0.45 2 L0.1 2'] },
  E: { w: 1.0, strokes: ['M0.1 0 L0.1 2', 'M0.1 0 L0.95 0', 'M0.1 1 L0.8 1', 'M0.1 2 L0.95 2'] },
  F: { w: 0.95, strokes: ['M0.1 0 L0.1 2', 'M0.1 0 L0.9 0', 'M0.1 1 L0.75 1'] },
  G: { w: 1.35, strokes: [RING(0.68, 1, 0.62, 1, -40, -360), 'M0.78 1 L1.3 1'] },
  H: { w: 1.2, strokes: ['M0.1 0 L0.1 2', 'M1.1 0 L1.1 2', 'M0.1 1 L1.1 1'] },
  I: { w: 0.3, strokes: ['M0.15 0 L0.15 2'] },
  J: { w: 0.9, strokes: ['M0.75 0 L0.75 1.5 C0.75 2.08 0.08 2.12 0.05 1.6'] },
  K: { w: 1.1, strokes: ['M0.1 0 L0.1 2', 'M0.12 1.1 L1.0 0', 'M0.38 0.78 L1.05 2'] },
  L: { w: 0.9, strokes: ['M0.1 0 L0.1 2', 'M0.1 2 L0.85 2'] },
  // M and N start at the bottom: M up, down, up, down; N up, down, up
  M: { w: 1.5, strokes: ['M0.1 2 L0.1 0', 'M0.1 0 L0.75 1.35', 'M0.75 1.35 L1.4 0', 'M1.4 0 L1.4 2'] },
  N: { w: 1.2, strokes: ['M0.1 2 L0.1 0', 'M0.1 0 L1.1 2', 'M1.1 2 L1.1 0'] },
  O: { w: 1.4, strokes: [RING(0.7, 1, 0.62, 1, -90, -450)] },
  P: { w: 1.05, strokes: ['M0.1 0 L0.1 2', 'M0.1 0 L0.5 0 C1.02 0 1.02 1.05 0.5 1.05 L0.1 1.05'] },
  Q: { w: 1.45, strokes: [RING(0.7, 1, 0.62, 1, -90, -450), 'M0.85 1.45 L1.4 2.05'] },
  R: { w: 1.1, strokes: ['M0.1 0 L0.1 2', 'M0.1 0 L0.5 0 C1.0 0 1.0 1.05 0.5 1.05 L0.1 1.05', 'M0.45 1.05 L1.05 2'] },
  S: {
    w: 1.05,
    strokes: ['M0.95 0.3 C0.8 0.02 0.6 0 0.5 0 C0.22 0 0.08 0.22 0.1 0.48 C0.12 0.78 0.5 0.9 0.6 0.95 C0.9 1.05 1.0 1.3 0.98 1.5 C0.95 1.85 0.72 2 0.5 2 C0.3 2 0.12 1.9 0.05 1.7'],
  },
  T: { w: 1.2, strokes: ['M0.6 0 L0.6 2', 'M0.05 0 L1.15 0'] },
  U: { w: 1.2, strokes: ['M0.1 0 L0.1 1.4 C0.1 2.1 1.1 2.1 1.1 1.4 L1.1 0'] },
  V: { w: 1.3, strokes: ['M0.05 0 L0.65 2', 'M0.65 2 L1.25 0'] },
  W: { w: 1.9, strokes: ['M0.05 0 L0.5 2', 'M0.5 2 L0.95 0', 'M0.95 0 L1.4 2', 'M1.4 2 L1.85 0'] },
  X: { w: 1.2, strokes: ['M0.1 0 L1.1 2', 'M1.1 0 L0.1 2'] },
  Y: { w: 1.2, strokes: ['M0.1 0 L0.6 1', 'M0.6 1 L1.1 0', 'M0.6 1 L0.6 2'] },
  Z: { w: 1.1, strokes: ['M0.1 0 L1.0 0', 'M1.0 0 L0.1 2', 'M0.1 2 L1.05 2'] },

  a: { w: 0.95, strokes: [BOWL, 'M0.85 1 L0.85 2'] },
  b: { w: 0.95, strokes: ['M0.1 0 L0.1 2', 'M0.1 1.45 C0.2 1.05 0.85 0.95 0.85 1.5 C0.85 2.05 0.25 2.05 0.1 1.85'] },
  c: { w: 0.85, strokes: [RING(0.45, 1.5, 0.4, 0.5, -40, -320)] },
  d: { w: 0.95, strokes: [BOWL, 'M0.85 0 L0.85 2'] },
  e: { w: 0.9, strokes: ['M0.08 1.52 L0.85 1.52', 'M0.85 1.52 C0.88 1.2 0.7 1 0.45 1 C0.2 1 0.05 1.25 0.05 1.5 C0.05 1.8 0.25 2 0.47 2 C0.65 2 0.78 1.92 0.85 1.8'] },
  f: { w: 0.75, strokes: ['M0.72 0.15 C0.6 -0.02 0.3 -0.05 0.3 0.4 L0.3 2', 'M0.05 1 L0.65 1'] },
  g: { w: 0.95, strokes: [BOWL, 'M0.85 1 L0.85 2.6 C0.85 3.1 0.2 3.1 0.1 2.75'] },
  h: { w: 0.95, strokes: ['M0.1 0 L0.1 2', 'M0.1 1.4 C0.2 1.05 0.85 0.95 0.85 1.4 L0.85 2'] },
  i: { w: 0.3, strokes: ['M0.15 1 L0.15 2', 'D0.15 0.55'] },
  j: { w: 0.6, strokes: ['M0.45 1 L0.45 2.65 C0.45 3.1 0.05 3.05 0.02 2.8', 'D0.45 0.55'] },
  k: { w: 0.9, strokes: ['M0.1 0 L0.1 2', 'M0.12 1.55 L0.8 1', 'M0.3 1.4 L0.85 2'] },
  l: { w: 0.3, strokes: ['M0.15 0 L0.15 2'] },
  m: { w: 1.45, strokes: ['M0.1 1 L0.1 2', 'M0.1 1.4 C0.18 1.05 0.72 0.95 0.72 1.35 L0.72 2', 'M0.72 1.4 C0.8 1.05 1.35 0.95 1.35 1.35 L1.35 2'] },
  n: { w: 0.95, strokes: ['M0.1 1 L0.1 2', 'M0.1 1.4 C0.2 1.05 0.85 0.95 0.85 1.4 L0.85 2'] },
  o: { w: 0.9, strokes: [RING(0.45, 1.5, 0.4, 0.5, -90, -450)] },
  p: { w: 0.95, strokes: ['M0.1 1 L0.1 3', 'M0.1 1.4 C0.2 1.02 0.85 0.98 0.85 1.5 C0.85 2.05 0.25 2.05 0.1 1.85'] },
  q: { w: 0.95, strokes: [BOWL, 'M0.85 1 L0.85 3'] },
  r: { w: 0.75, strokes: ['M0.1 1 L0.1 2', 'M0.1 1.4 C0.2 1.08 0.5 0.95 0.75 1.08'] },
  s: {
    w: 0.8,
    strokes: ['M0.75 1.15 C0.65 1 0.45 0.98 0.4 1 C0.15 1.02 0.1 1.2 0.12 1.3 C0.15 1.48 0.4 1.5 0.45 1.52 C0.7 1.56 0.8 1.7 0.78 1.8 C0.75 1.98 0.55 2.02 0.4 2 C0.25 1.98 0.12 1.92 0.05 1.82'],
  },
  t: { w: 0.7, strokes: ['M0.3 0.4 L0.3 1.75 C0.3 2.05 0.55 2.02 0.68 1.9', 'M0.05 1 L0.62 1'] },
  u: { w: 0.95, strokes: ['M0.1 1 L0.1 1.6 C0.1 2.1 0.85 2.1 0.85 1.6 L0.85 1', 'M0.85 1 L0.85 2'] },
  v: { w: 0.9, strokes: ['M0.05 1 L0.45 2', 'M0.45 2 L0.85 1'] },
  w: { w: 1.3, strokes: ['M0.05 1 L0.35 2', 'M0.35 2 L0.65 1', 'M0.65 1 L0.95 2', 'M0.95 2 L1.25 1'] },
  x: { w: 0.9, strokes: ['M0.1 1 L0.85 2', 'M0.85 1 L0.1 2'] },
  y: { w: 0.9, strokes: ['M0.05 1 L0.45 2', 'M0.85 1 L0.2 3'] },
  z: { w: 0.9, strokes: ['M0.1 1 L0.8 1', 'M0.8 1 L0.1 2', 'M0.1 2 L0.85 2'] },
  // written upwards, starting below the base line
  ß: { w: 1.0, strokes: ['M0.1 2.6 L0.1 0.5 C0.1 0.05 0.75 -0.05 0.75 0.45 C0.75 0.75 0.45 0.9 0.4 0.95 C0.8 1.0 0.95 1.25 0.95 1.5 C0.95 1.95 0.55 2.05 0.3 1.9'] },

  '0': { w: 1.0, strokes: [RING(0.5, 1, 0.45, 1, -90, -450)] },
  '1': { w: 0.75, strokes: ['M0.1 0.6 L0.6 0', 'M0.6 0 L0.6 2'] },
  '2': { w: 1.05, strokes: ['M0.1 0.45 C0.15 0.05 0.5 0 0.55 0 C0.85 0 1.0 0.25 0.95 0.55 C0.9 0.85 0.55 1.2 0.1 2 L1.0 2'] },
  '3': {
    w: 1.05,
    strokes: ['M0.12 0.25 C0.3 0 0.5 0 0.55 0 C0.9 0 0.95 0.3 0.9 0.5 C0.85 0.75 0.6 0.92 0.4 0.95 C0.75 0.97 1.0 1.15 1.0 1.45 C1.0 1.85 0.7 2 0.5 2 C0.3 2 0.12 1.9 0.05 1.75'],
  },
  '4': { w: 1.05, strokes: ['M0.55 0 L0.05 1.35 L1.0 1.35', 'M0.78 0.1 L0.78 2'] },
  '5': { w: 1.0, strokes: ['M0.2 0 L0.15 0.92', 'M0.15 0.92 C0.4 0.8 0.95 0.8 0.95 1.4 C0.95 1.95 0.5 2.05 0.1 1.8', 'M0.2 0 L0.9 0'] },
  '6': { w: 1.0, strokes: ['M0.85 0.15 C0.6 -0.05 0.1 0 0.08 1.2 C0.05 1.8 0.3 2 0.5 2 C0.8 2 0.95 1.8 0.95 1.45 C0.95 1.1 0.7 0.9 0.5 0.9 C0.3 0.9 0.12 1.05 0.08 1.3'] },
  // with the bar through the middle
  '7': { w: 1.0, strokes: ['M0.05 0 L0.95 0', 'M0.95 0 L0.35 2', 'M0.35 1 L0.95 1'] },
  '8': {
    w: 1.0,
    strokes: ['M0.85 0.35 C0.8 0.05 0.6 0 0.5 0 C0.25 0 0.12 0.2 0.12 0.45 C0.12 0.75 0.4 0.88 0.5 0.95 C0.75 1.08 0.95 1.25 0.95 1.5 C0.95 1.82 0.75 2 0.5 2 C0.25 2 0.05 1.82 0.05 1.5 C0.05 1.25 0.25 1.08 0.5 0.95 C0.6 0.88 0.88 0.72 0.85 0.35'],
  },
  '9': { w: 1.0, strokes: [RING(0.5, 0.5, 0.42, 0.5, -40, -400), 'M0.92 0.5 L0.92 2'] },
};

const UMLAUT_BASE: Record<string, string> = { Ä: 'A', Ö: 'O', Ü: 'U', ä: 'a', ö: 'o', ü: 'u' };
/** lowercase letters that end with a small hook to the right in the Grundschrift */
const HOOKED = 'adhilmnqtu';

export interface Pt {
  x: number;
  y: number;
}

export interface WrittenStroke {
  pts: Pt[];
  /** cumulative length at every point */
  len: number[];
  total: number;
  dot: boolean;
}

export interface WrittenGlyph {
  char: string;
  w: number;
  strokes: WrittenStroke[];
}

function arc(out: Pt[], cx: number, cy: number, rx: number, ry: number, a0: number, a1: number): void {
  const n = Math.max(8, Math.ceil(Math.abs(a1 - a0) / 6));
  for (let i = out.length ? 1 : 0; i <= n; i++) {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    out.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
  }
}

/** flattens one stroke into a polyline */
function flatten(d: string): { pts: Pt[]; dot: boolean } {
  const tok = d.match(/[MLCOD]|-?\d*\.?\d+/g) ?? [];
  const pts: Pt[] = [];
  let i = 0;
  let dot = false;
  const num = () => Number(tok[i++]);
  while (i < tok.length) {
    const cmd = tok[i++];
    if (cmd === 'M') pts.push({ x: num(), y: num() });
    else if (cmd === 'D') {
      dot = true;
      while (i < tok.length && !/[A-Z]/.test(tok[i])) pts.push({ x: num(), y: num() });
    } else if (cmd === 'L') pts.push({ x: num(), y: num() });
    else if (cmd === 'C') {
      const p0 = pts[pts.length - 1];
      const [x1, y1, x2, y2, x, y] = [num(), num(), num(), num(), num(), num()];
      for (let k = 1; k <= 16; k++) {
        const t = k / 16;
        const u = 1 - t;
        pts.push({
          x: u * u * u * p0.x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x,
          y: u * u * u * p0.y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y,
        });
      }
    } else if (cmd === 'O') {
      const [cx, cy, rx, ry, a0, a1] = [num(), num(), num(), num(), num(), num()];
      arc(pts, cx, cy, rx, ry, a0, a1);
    }
  }
  return { pts, dot };
}

/** "length" of one dot, so it takes a moment to appear */
const DOT = 0.3;

function measure(pts: Pt[], dot: boolean): WrittenStroke {
  const len = [0];
  for (let k = 1; k < pts.length; k++) len.push(len[k - 1] + Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y));
  return { pts, len, total: dot ? DOT * pts.length : len[len.length - 1], dot };
}

const cache = new Map<string, WrittenGlyph | null>();

/** the strokes of a character, null if it is unknown; \`grund\` adds the Grundschrift exit hooks */
export function writtenGlyph(ch: string, grund: boolean): WrittenGlyph | null {
  const key = ch + (grund ? 'G' : 'D');
  if (cache.has(key)) return cache.get(key)!;
  const base = UMLAUT_BASE[ch] ?? ch;
  const def = GLYPHS[base];
  if (!def) {
    cache.set(key, null);
    return null;
  }
  const strokes = def.strokes.map(flatten);
  if (grund && HOOKED.includes(base)) {
    // the last stroke that ends on the base line gets a little hook to the right
    const last = [...strokes].reverse().find((s) => !s.dot && Math.abs(s.pts[s.pts.length - 1].y - 2) < 0.05);
    if (last) {
      const e = last.pts[last.pts.length - 1];
      const p0 = { ...e };
      for (let k = 1; k <= 8; k++) {
        const t = k / 8;
        last.pts.push({ x: p0.x + 0.24 * t, y: p0.y + 0.1 * Math.sin(Math.PI * t) - 0.16 * t * t });
      }
    }
  }
  if (base !== ch) {
    // umlaut dots above the letter (capitals: above the top line), one number for both
    const top = base === base.toUpperCase() ? -0.35 : 0.55;
    strokes.push({ pts: [{ x: def.w * 0.32, y: top }, { x: def.w * 0.68, y: top }], dot: true });
  }
  const g: WrittenGlyph = { char: ch, w: def.w + (grund && HOOKED.includes(base) ? 0.2 : 0), strokes: strokes.map((s) => measure(s.pts, s.dot)) };
  cache.set(key, g);
  return g;
}

/** seconds per band of stroke length, pause between strokes */
const PACE = 0.55;
const PAUSE = 0.35;

/** how long writing the whole character takes (seconds) */
export function writeDuration(g: WrittenGlyph): number {
  return g.strokes.reduce((t, s) => t + s.total * PACE + PAUSE, 0);
}

export interface WriteStyle {
  /** px per band */
  unit: number;
  ink: string;
  /** pen width in bands */
  pen?: number;
  /** the finished letter in light grey underneath */
  ghost?: boolean;
  /** start numbers and direction arrows */
  guides?: boolean;
}

function pointAt(s: WrittenStroke, d: number): Pt {
  const L = s.len;
  let k = 1;
  while (k < L.length - 1 && L[k] < d) k++;
  const a = s.pts[k - 1];
  const b = s.pts[k] ?? a;
  const seg = L[k] - L[k - 1] || 1;
  const u = Math.min(1, Math.max(0, (d - L[k - 1]) / seg));
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
}

function path(ctx: CanvasRenderingContext2D, s: WrittenStroke, upTo: number, ox: number, oy: number, u: number): void {
  ctx.beginPath();
  ctx.moveTo(ox + s.pts[0].x * u, oy + s.pts[0].y * u);
  for (let k = 1; k < s.pts.length && s.len[k] <= upTo; k++) ctx.lineTo(ox + s.pts[k].x * u, oy + s.pts[k].y * u);
  if (upTo < s.total) {
    const p = pointAt(s, upTo);
    ctx.lineTo(ox + p.x * u, oy + p.y * u);
  }
  ctx.stroke();
}

/**
 * Draws the character written up to time \`t\` (seconds since the pen started) with the top line at
 * (ox, oy). Returns the pen position while writing, null when it is done.
 */
export function drawWriting(ctx: CanvasRenderingContext2D, g: WrittenGlyph, ox: number, oy: number, t: number, st: WriteStyle): Pt | null {
  const u = st.unit;
  const pen = (st.pen ?? 0.17) * u;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (st.ghost) {
    ctx.strokeStyle = 'rgba(120,110,160,0.22)';
    ctx.fillStyle = 'rgba(120,110,160,0.22)';
    ctx.lineWidth = pen;
    for (const s of g.strokes) {
      if (s.dot) {
        for (const p of s.pts) {
          ctx.beginPath();
          ctx.arc(ox + p.x * u, oy + p.y * u, pen * 0.75, 0, Math.PI * 2);
          ctx.fill();
        }
      } else path(ctx, s, s.total, ox, oy, u);
    }
  }
  // start numbers: up-left of the start, side by side when strokes start at the same point
  const r = Math.max(9, u * 0.17);
  const badges: Pt[] = [];
  for (const s of g.strokes) {
    const b = { x: ox + s.pts[0].x * u - r * 1.3, y: oy + s.pts[0].y * u - r * 1.3 };
    while (badges.some((o) => Math.hypot(o.x - b.x, o.y - b.y) < r * 2.1)) b.x += r * 2.2;
    badges.push(b);
  }
  let clock = 0;
  let penAt: Pt | null = null;
  g.strokes.forEach((s, i) => {
    const dur = s.total * PACE;
    const local = t - clock;
    clock += dur + PAUSE;
    if (local < 0) return;
    const d = Math.min(s.total, (local / Math.max(0.01, dur)) * s.total);
    if (st.guides) {
      const nx = badges[i].x;
      const ny = badges[i].y;
      ctx.fillStyle = '#ff6f91';
      ctx.beginPath();
      ctx.arc(nx, ny, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `700 ${r * 1.4}px Fredoka, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), nx, ny + r * 0.08);
    }
    ctx.strokeStyle = st.ink;
    ctx.fillStyle = st.ink;
    ctx.lineWidth = pen;
    if (s.dot) {
      // the dots appear one after the other
      s.pts.forEach((p, k) => {
        const grow = Math.min(1, (d - k * DOT) / (DOT * 0.6));
        if (grow <= 0) return;
        ctx.beginPath();
        ctx.arc(ox + p.x * u, oy + p.y * u, pen * 0.75 * grow, 0, Math.PI * 2);
        ctx.fill();
      });
    } else path(ctx, s, d, ox, oy, u);
    if (local < dur) penAt = s.dot ? s.pts[Math.min(s.pts.length - 1, Math.floor(d / DOT))] : pointAt(s, d);
    // direction arrow in the middle of a stroke that is being written; a stroke that goes back on
    // itself (M, N: down and up again) gets a second arrow for the way back
    if (st.guides && !s.dot && local < dur + PAUSE) {
      const dir = (f: number) => {
        const m = pointAt(s, s.total * f);
        const n = pointAt(s, Math.min(s.total, s.total * f + 0.08));
        return Math.atan2(n.y - m.y, n.x - m.x);
      };
      const turn = Math.abs(Math.atan2(Math.sin(dir(0.8) - dir(0.3)), Math.cos(dir(0.8) - dir(0.3))));
      for (const f of turn > 2.6 ? [0.3, 0.8] : [0.3]) {
        if (d <= s.total * (f + 0.05)) continue;
        const m = pointAt(s, s.total * f);
        ctx.save();
        ctx.translate(ox + m.x * u, oy + m.y * u);
        ctx.rotate(dir(f));
        ctx.fillStyle = '#ff6f91';
        const k = Math.max(7, u * 0.14);
        ctx.beginPath();
        ctx.moveTo(k, 0);
        ctx.lineTo(-k * 0.7, -k * 0.75);
        ctx.lineTo(-k * 0.7, k * 0.75);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  });
  ctx.restore();
  return penAt;
}

/**
 * School lines for a template, \`kind\` 4: top, middle (dashed), base and bottom line;
 * 2: only middle and base line (Lineatur 3). The middle band can be tinted.
 */
export function drawSchoolLines(ctx: CanvasRenderingContext2D, x0: number, x1: number, oy: number, u: number, kind: 2 | 4, tint = true): void {
  ctx.save();
  if (tint) {
    ctx.fillStyle = 'rgba(255,236,170,0.45)';
    ctx.fillRect(x0, oy + u, x1 - x0, u);
  }
  ctx.lineWidth = Math.max(1.5, u * 0.035);
  const lines: [number, boolean][] = kind === 4 ? [[0, false], [1, true], [2, false], [3, false]] : [[1, false], [2, false]];
  for (const [y, dashed] of lines) {
    ctx.strokeStyle = y === 2 ? 'rgba(70,100,200,0.7)' : 'rgba(90,120,210,0.45)';
    ctx.setLineDash(dashed ? [u * 0.12, u * 0.1] : []);
    ctx.beginPath();
    ctx.moveTo(x0, oy + y * u);
    ctx.lineTo(x1, oy + y * u);
    ctx.stroke();
  }
  ctx.restore();
}

/** a little pencil whose tip is at (x, y) */
export function drawPencil(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.6);
  ctx.scale(s, s);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#3b2a5c';
  ctx.lineWidth = 2.5;
  ctx.fillStyle = '#f2c79a';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(8, -14);
  ctx.lineTo(-8, -14);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#5b3bd6';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(3, -5);
  ctx.lineTo(-3, -5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffcf3d';
  ctx.fillRect(-8, -64, 16, 50);
  ctx.strokeRect(-8, -64, 16, 50);
  ctx.fillStyle = '#ff8fb1';
  ctx.fillRect(-8, -75, 16, 11);
  ctx.strokeRect(-8, -75, 16, 11);
  ctx.restore();
}
