// The register of the "Mal-Aquarium" animals: outlines, colouring lines, eye and placement on the card of each
// species, in the animal's own units. Pure data, shared by the print sheet, the card detection and the sprites.

export type SpeciesId = 'fisch' | 'clownfisch' | 'doktorfisch' | 'kugelfisch' | 'karpfen' | 'hecht' | 'hai'
  | 'seepferdchen' | 'qualle' | 'krake' | 'schildkroete' | 'krebs' | 'freiform';
export type Motion = 'swim' | 'dart' | 'puff' | 'bob' | 'pulse' | 'arms' | 'glide' | 'walk' | 'sway';

export interface Eye { x: number; y: number; r: number; pupil: { x: number; y: number; r: number } }

export interface SpeciesDef {
  id: SpeciesId;
  name: string;
  article: 'der' | 'die' | 'das';
  /** closed outline parts, back to front, in the animal's own units */
  parts: { id: string; d: string }[];
  /** ids of the parts drawn as the separately animated limb (tail, fins, claws, arms); may be empty */
  moving: string[];
  /** pivot of the moving part (animal units) */
  pivot: { x: number; y: number };
  /** inner lines (colouring areas) */
  lines: string[];
  /** mouth and other open details */
  strokes: string[];
  eyes: Eye[];
  box: { x0: number; y0: number; x1: number; y1: number };
  /** animal units -> card mm */
  place: { s: number; x: number; y: number };
  motion: Motion;
  /** size in the aquarium relative to the fish (1) */
  size: number;
}

/** The fish (100 × 76 units, facing right). The tail and the fins tuck under the body. */
const FISCH: SpeciesDef = {
  id: 'fisch',
  name: 'Fisch',
  article: 'der',
  parts: [
    { id: 'tail', d: 'M 34 33 C 26 27 16 17 4 11 C 8 23 12 31 13 38 C 12 45 8 53 4 65 C 16 59 26 49 34 43 Z' },
    { id: 'dorsal', d: 'M 72 18 C 66 7 54 1 41 3 C 46 9 47 15 46 23 Z' },
    { id: 'anal', d: 'M 43 58 C 39 64 34 68 28 68 C 31 64 33 59 34 53 Z' },
    { id: 'pelvic', d: 'M 65 61 C 61 68 55 72 47 73 C 50 69 52 65 53 62 Z' },
    { id: 'body', d: 'M 30 30 C 40 15 62 10 78 16 C 90 21 97 31 97 39 C 97 49 88 58 74 62 C 58 66 40 61 30 46 C 28 42 28 34 30 30 Z' },
    { id: 'pectoral', d: 'M 66 45 C 60 46 53 51 52 57 C 58 57 65 53 68 48 Z' },
  ],
  moving: ['tail'],
  pivot: { x: 31, y: 38 },
  lines: [
    // gill and two stripes
    'M 79 22 C 73 30 73 47 79 56',
    'M 61 14 C 56 26 56 49 61 63',
    'M 45 20 C 41 31 41 48 45 58',
    // fin rays
    'M 25 33 L 13 22',
    'M 25 38 L 15 38',
    'M 25 43 L 13 54',
  ],
  strokes: ['M 89.5 46 Q 92.5 48.5 95.5 45.5'],
  eyes: [{ x: 85, y: 32, r: 5.4, pupil: { x: 86.3, y: 32.6, r: 2.5 } }],
  box: { x0: 3, y0: 1.5, x1: 98.5, y1: 74.5 },
  place: { s: 0.82, x: 6, y: 12 },
  motion: 'swim',
  size: 1,
};

// ---------------------------------------------------------------- drawing helpers (run once, when the module loads)

type P = [number, number];
const f1 = (v: number) => String(Math.round(v * 10) / 10);
const pt = ([x, y]: P) => `${f1(x)} ${f1(y)}`;

/** a smooth line through the points (Catmull-Rom), `n` steps per span */
function smooth(pts: P[], n = 6): P[] {
  const out: P[] = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const t2 = t * t;
      const t3 = t2 * t;
      const cr = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([cr(p0[0], p1[0], p2[0], p3[0]), cr(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  return out;
}

/**
 * Arms, tentacles and legs: bands of width `w0` (root) to `w1` (tip) along smooth lines, all in one closed outline.
 * The roots are joined by straight lines, so they must lie under a part drawn later (head, bell, body).
 */
function bands(...arms: { at: P[]; w0: number; w1: number }[]): string {
  const ring: P[] = [];
  for (const { at, w0, w1 } of arms) {
    const c = smooth(at);
    const left: P[] = [];
    const right: P[] = [];
    c.forEach((p, i) => {
      const a = c[Math.max(0, i - 1)];
      const b = c[Math.min(c.length - 1, i + 1)];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const nx = -(b[1] - a[1]) / len;
      const ny = (b[0] - a[0]) / len;
      const w = (w0 + ((w1 - w0) * i) / (c.length - 1)) / 2;
      left.push([p[0] + nx * w, p[1] + ny * w]);
      right.push([p[0] - nx * w, p[1] - ny * w]);
    });
    // a round tip
    const e = c[c.length - 1];
    const q = c[c.length - 2];
    const len = Math.hypot(e[0] - q[0], e[1] - q[1]) || 1;
    const tip: P = [e[0] + ((e[0] - q[0]) / len) * w1 * 0.6, e[1] + ((e[1] - q[1]) / len) * w1 * 0.6];
    ring.push(...left, tip, ...right.reverse());
  }
  return `M ${ring.map(pt).join(' L ')} Z`;
}

/** a round body with little spikes (height `h`) on the given arcs [from, to] in degrees, clockwise from the right */
function spiky(cx: number, cy: number, r: number, h: number, spikes: [number, number][]): string {
  const at = (deg: number, rr = r): P => [cx + Math.cos((deg * Math.PI) / 180) * rr, cy + Math.sin((deg * Math.PI) / 180) * rr];
  const arc = (a: number, b: number) => `Q ${pt(at((a + b) / 2, r / Math.cos(((b - a) * Math.PI) / 360)))} ${pt(at(b))}`;
  const spike = (deg: number) => spikes.some(([a, b]) => deg >= a && deg <= b);
  let d = `M ${pt(at(0))}`;
  for (let a = 0; a < 360; a += 20) {
    if (spike(a + 10)) d += ` ${arc(a, a + 6)} L ${pt(at(a + 10, r + h))} L ${pt(at(a + 14))} ${arc(a + 14, a + 20)}`;
    else d += ` ${arc(a, a + 10)} ${arc(a + 10, a + 20)}`;
  }
  return `${d} Z`;
}

/** the same path mirrored at the vertical line x = `ax` */
const mirror = (d: string, ax: number) => {
  let i = 0;
  return d.replace(/-?\d*\.?\d+/g, (v) => (i++ % 2 === 0 ? f1(2 * ax - Number(v)) : v));
};

// ---------------------------------------------------------------- the other animals

/** the clownfish: chubby, round tail, two-lobed dorsal fin and three bands */
const CLOWNFISCH: SpeciesDef = {
  id: 'clownfisch',
  name: 'Clownfisch',
  article: 'der',
  parts: [
    { id: 'tail', d: 'M 26 34 C 20 28 13 21 7 19 C 0 28 0 52 7 61 C 13 59 20 52 26 46 Z' },
    { id: 'dorsal', d: 'M 36 24 C 35 14 43 7 52 9 C 56 10 58 13 60 14 C 64 7 75 7 79 15 C 80 18 80 20 79 23 Z' },
    { id: 'anal', d: 'M 42 58 C 40 66 46 73 54 71 C 59 70 61 65 60 59 Z' },
    { id: 'body', d: 'M 22 40 C 22 26 40 16 60 16 C 80 16 94 27 94 40 C 94 53 80 64 60 64 C 40 64 22 54 22 40 Z' },
    { id: 'pectoral', d: 'M 62 45 C 56 46 51 52 53 58 C 60 59 66 53 67 47 Z' },
  ],
  moving: ['tail'],
  pivot: { x: 24, y: 40 },
  lines: [
    // the white bands: behind the eye, in the middle, at the tail
    'M 75 18.5 C 68 30 68 50 75 61.5',
    'M 67 16.5 C 60 30 60 50 67 63.5',
    'M 52 16.3 C 46 30 46 50 52 63.7',
    'M 43 18 C 37 30 37 50 43 62',
    'M 30 26 C 27 33 27 47 30 54',
    // fin rays
    'M 19 32 L 10 26',
    'M 19 40 L 8 40',
    'M 19 48 L 10 54',
  ],
  strokes: ['M 86.5 47 Q 89.5 49.5 92.5 46.5'],
  eyes: [{ x: 83, y: 33, r: 6, pupil: { x: 84.4, y: 33.6, r: 2.8 } }],
  box: { x0: 1, y0: 8, x1: 94.5, y1: 72 },
  place: { s: 0.82, x: 6, y: 12 },
  motion: 'swim',
  size: 0.75,
};

/** the palette surgeonfish: deep oval body, long fins along the back and the belly, the dark palette marking */
const DOKTORFISCH: SpeciesDef = {
  id: 'doktorfisch',
  name: 'Doktorfisch',
  article: 'der',
  parts: [
    { id: 'tail', d: 'M 26 35 C 20 30 13 22 5 15 C 11 30 11 50 5 65 C 13 58 20 50 26 45 Z' },
    { id: 'dorsal', d: 'M 27 34 C 31 18 46 6 62 6 C 70 6 76 9 80 16 L 76 24 L 40 30 Z' },
    { id: 'anal', d: 'M 30 50 C 36 64 49 73 63 73 C 72 73 78 68 80 60 L 62 56 Z' },
    { id: 'body', d: 'M 22 40 C 26 24 44 13 63 13 C 77 13 89 25 94 38 C 89 52 77 66 61 66 C 43 66 26 56 22 40 Z' },
    { id: 'palette', d: 'M 77 23 C 62 16 40 19 27 34 C 24 38 24 43 27 47 C 36 57 56 61 70 53 C 72 51 70 48 67 48 C 58 50 48 49 42 45 C 37 42 38 36 44 33 C 54 29 66 29 76 32 C 79 30 80 25 77 23 Z' },
  ],
  moving: ['tail'],
  pivot: { x: 24, y: 40 },
  lines: [
    // fin rays
    'M 19 33 L 11 26',
    'M 19 40 L 10 40',
    'M 19 47 L 11 54',
  ],
  strokes: ['M 89 44 Q 91 45.5 93 43.5', 'M 25 47 L 29 49'],
  eyes: [{ x: 83, y: 33, r: 5.6, pupil: { x: 84.4, y: 33.6, r: 2.6 } }],
  box: { x0: 4.5, y0: 5.5, x1: 94.5, y1: 73.5 },
  place: { s: 0.82, x: 6, y: 12 },
  motion: 'swim',
  size: 0.9,
};

/** the pufferfish: a spiky ball with small fins */
const KUGELFISCH: SpeciesDef = {
  id: 'kugelfisch',
  name: 'Kugelfisch',
  article: 'der',
  parts: [
    { id: 'tail', d: 'M 26 34 C 20 30 14 26 8 26 C 5 34 5 46 8 54 C 14 54 20 50 26 46 Z' },
    { id: 'dorsal', d: 'M 40 16 C 34 9 27 7 20 9 C 22 16 27 22 33 25 Z' },
    { id: 'anal', d: 'M 38 65 C 34 70 29 72 24 71 C 25 66 28 61 32 58 Z' },
    { id: 'body', d: spiky(56, 40, 31, 5, [[130, 310]]) },
    { id: 'pectoral', d: 'M 66 46 C 60 46 54 50 54 56 C 60 58 67 54 69 49 Z' },
  ],
  moving: ['tail'],
  pivot: { x: 26, y: 40 },
  lines: [
    // the light belly
    'M 31 52 C 42 62 64 66 80 58',
    'M 19 34 L 10 31',
    'M 19 40 L 8 40',
    'M 19 46 L 10 49',
  ],
  strokes: ['M 80 49 Q 83 51.5 86 48.5'],
  eyes: [{ x: 73, y: 32, r: 7.5, pupil: { x: 75, y: 33, r: 3.4 } }],
  box: { x0: 5, y0: 3.5, x1: 87.5, y1: 72 },
  place: { s: 0.82, x: 9, y: 11 },
  motion: 'puff',
  size: 0.7,
};

/** the carp: high back, long dorsal fin, big scales and whiskers */
const KARPFEN: SpeciesDef = {
  id: 'karpfen',
  name: 'Karpfen',
  article: 'der',
  parts: [
    { id: 'tail', d: 'M 26 36 C 18 28 10 18 2 12 C 7 24 10 33 14 42 C 10 51 7 60 2 72 C 10 66 18 56 26 48 Z' },
    { id: 'dorsal', d: 'M 38 28 C 42 14 50 6 58 6 C 64 8 70 14 74 22 L 64 24 Z' },
    { id: 'anal', d: 'M 40 58 C 37 65 33 70 27 71 C 30 66 32 61 32 55 Z' },
    { id: 'pelvic', d: 'M 66 60 C 63 67 57 71 50 72 C 52 68 54 64 54 61 Z' },
    { id: 'body', d: 'M 22 42 C 28 26 46 16 66 17 C 82 18 94 30 97 42 C 96 52 84 62 66 63 C 46 64 28 58 22 42 Z' },
    { id: 'pectoral', d: 'M 74 48 C 68 49 62 54 61 59 C 67 59 73 55 76 50 Z' },
  ],
  moving: ['tail'],
  pivot: { x: 24, y: 42 },
  lines: [
    // gill
    'M 80 22 C 74 32 74 50 80 59',
    // scales
    'M 36 30 Q 41 37 46 30 Q 51 37 56 30 Q 61 37 66 30 Q 71 37 75 31',
    'M 31 40 Q 36 47 41 40 Q 46 47 51 40 Q 56 47 61 40 Q 66 47 71 40 Q 74 45 76 43',
    'M 34 50 Q 39 57 44 50 Q 49 57 54 50 Q 59 57 64 50 Q 68 55 72 51',
    // fin rays
    'M 19 34 L 9 22',
    'M 19 42 L 12 42',
    'M 19 50 L 9 62',
  ],
  strokes: ['M 97 45 Q 94 48 91 46.5', 'M 93 48 Q 94 54 90 58', 'M 95 47 Q 98 52 97 57'],
  eyes: [{ x: 86, y: 33, r: 5.2, pupil: { x: 87.3, y: 33.6, r: 2.4 } }],
  box: { x0: 1.5, y0: 5.5, x1: 97.5, y1: 72.5 },
  place: { s: 0.82, x: 6, y: 12 },
  motion: 'swim',
  size: 1.1,
};

/** the pike: long and slim, flat duck-bill snout, the fins far back near the tail */
const HECHT: SpeciesDef = {
  id: 'hecht',
  name: 'Hecht',
  article: 'der',
  parts: [
    { id: 'tail', d: 'M 24 36 C 18 30 10 24 2 20 C 5 28 8 34 10 40 C 8 46 5 52 2 60 C 10 56 18 50 24 44 Z' },
    { id: 'dorsal', d: 'M 27 35 C 29 28 33 23 40 21 C 42 25 43 29 44 33 Z' },
    { id: 'anal', d: 'M 28 45 C 30 52 34 57 41 58 C 42 54 43 51 43 48 Z' },
    { id: 'pelvic', d: 'M 62 49 C 59 56 54 60 47 61 C 50 57 52 53 53 49 Z' },
    { id: 'body', d: 'M 20 40 C 30 31 50 28 70 28 C 80 28 90 32 100 38 C 98 41 92 43 86 46 C 70 52 44 53 20 42 Z' },
    { id: 'pectoral', d: 'M 78 44 C 73 45 69 49 68 53 C 73 53 78 50 80 46 Z' },
  ],
  moving: ['tail'],
  pivot: { x: 22, y: 40 },
  lines: [
    // gill
    'M 77 31 C 74 36 74 43 77 48',
    // spots
    'M 60 34 Q 64 31 66 35 Q 63 38 60 34 Z',
    'M 50 40 Q 54 37 56 41 Q 53 44 50 40 Z',
    'M 40 33 Q 44 30 46 34 Q 43 37 40 33 Z',
    'M 63 43 Q 67 40 69 44 Q 66 47 63 43 Z',
    'M 33 41 Q 37 38 39 42 Q 36 45 33 41 Z',
    // fin rays
    'M 18 34 L 8 26',
    'M 18 40 L 11 40',
    'M 18 46 L 8 54',
  ],
  strokes: ['M 99 39.5 C 94 41 89 42 85 41.5'],
  eyes: [{ x: 86, y: 34, r: 4.4, pupil: { x: 87.1, y: 34.4, r: 2.1 } }],
  box: { x0: 1.5, y0: 19.5, x1: 100.5, y1: 61.5 },
  place: { s: 0.82, x: 5.5, y: 10 },
  motion: 'dart',
  size: 1.3,
};

/** the shark: tall dorsal fin, long upper tail lobe, big pectoral fin, light belly and gills */
const HAI: SpeciesDef = {
  id: 'hai',
  name: 'Hai',
  article: 'der',
  parts: [
    { id: 'tail', d: 'M 24 39 C 18 29 10 17 2 6 C 7 22 10 34 12 43 C 10 49 8 55 6 61 C 12 57 18 51 24 46 Z' },
    { id: 'dorsal', d: 'M 47 31 C 50 21 54 11 60 4 C 62 14 66 23 72 29 Z' },
    { id: 'pelvic', d: 'M 38 51 C 36 57 32 61 27 62 C 29 58 30 54 30 50 Z' },
    { id: 'body', d: 'M 18 42 C 30 33 50 27 70 27 C 84 27 94 33 99 41 C 94 47 86 51 74 53 C 56 56 34 53 18 44 Z' },
    { id: 'pectoral', d: 'M 66 49 C 61 56 54 63 45 68 C 55 67 65 61 73 51 Z' },
  ],
  moving: ['tail'],
  pivot: { x: 21, y: 43 },
  lines: [
    // the light belly
    'M 22 44 C 40 47 58 48 72 46 C 82 44 90 43 98 42',
    // gills
    'M 74 34 C 72 37 72 41 74 44',
    'M 78 34 C 76 37 76 41 78 44',
    'M 82 35 C 80 38 80 41 82 44',
  ],
  strokes: ['M 88 47 Q 92 49 96 45.5'],
  eyes: [{ x: 88, y: 36, r: 4.6, pupil: { x: 89.2, y: 36.5, r: 2.2 } }],
  box: { x0: 1.5, y0: 3.5, x1: 99.5, y1: 68.5 },
  place: { s: 0.84, x: 5, y: 12 },
  motion: 'swim',
  size: 1.6,
};

/** the seahorse: upright, snout to the right, curled tail, little fin on the back */
const SEEPFERDCHEN: SpeciesDef = {
  id: 'seepferdchen',
  name: 'Seepferdchen',
  article: 'das',
  parts: [
    { id: 'tail', d: bands({ at: [[47, 54], [41, 62], [40, 70], [45, 75.5], [53, 75.5], [57, 70], [54, 65]], w0: 11, w1: 3 }) },
    { id: 'fin', d: 'M 39 34 C 31 31 25 37 27 46 C 30 49 35 48 39 45 Z' },
    { id: 'crest', d: 'M 45 8 C 43 2 47 -1 51 1 C 54 -1 58 1 58 5 C 61 5 62 8 60 10 Z' },
    { id: 'body', d: 'M 44 9 C 48 3 58 3 62 9 C 66 11 72 12 78 13 C 81 14 81 19 78 20 C 72 21 66 21 62 23 C 59 26 58 29 60 33 C 67 41 68 53 60 60 C 56 64 51 66 46 66 C 40 61 35 51 37 41 C 38 33 39 25 41 18 C 41 14 42 11 44 9 Z' },
  ],
  moving: ['fin'],
  pivot: { x: 38, y: 40 },
  lines: [
    // belly rings
    'M 42 36 Q 52 38 61 34',
    'M 40 43 Q 52 46 64 42',
    'M 39 50 Q 52 54 65 50',
    'M 41 57 Q 51 60 61 58',
  ],
  strokes: ['M 77 17.5 L 73 18'],
  eyes: [{ x: 56, y: 13, r: 4.6, pupil: { x: 57.2, y: 13.4, r: 2.2 } }],
  box: { x0: 26, y0: -0.5, x1: 81, y1: 80 },
  place: { s: 0.8, x: 3, y: 11 },
  motion: 'bob',
  size: 0.8,
};

/** the jellyfish: a round bell with a wavy rim, four thin tentacles and frilly mouth arms */
const QUALLE: SpeciesDef = {
  id: 'qualle',
  name: 'Qualle',
  article: 'die',
  parts: [
    {
      id: 'tentacles',
      d: bands(
        { at: [[27, 30], [25, 44], [29, 54], [25, 64], [28, 72]], w0: 5, w1: 3 },
        { at: [[37, 32], [35, 46], [39, 56], [36, 66], [38, 74]], w0: 5, w1: 3 },
        { at: [[63, 32], [65, 46], [61, 56], [64, 66], [62, 74]], w0: 5, w1: 3 },
        { at: [[73, 30], [75, 44], [71, 54], [75, 64], [72, 72]], w0: 5, w1: 3 },
      ),
    },
    { id: 'arms', d: bands({ at: [[50, 30], [46, 44], [54, 54], [47, 64], [51, 72]], w0: 12, w1: 6 }) },
    { id: 'bell', d: 'M 20 36 C 18 16 34 2 50 2 C 66 2 82 16 80 36 Q 75 42 70 36 Q 65 42 60 36 Q 55 42 50 36 Q 45 42 40 36 Q 35 42 30 36 Q 25 42 20 36 Z' },
  ],
  moving: ['tentacles', 'arms'],
  pivot: { x: 50, y: 36 },
  lines: [
    // the inner bell
    'M 26 28 C 28 16 38 9 50 9 C 62 9 72 16 74 28',
  ],
  strokes: ['M 45 28 Q 50 32 55 28'],
  eyes: [
    { x: 41, y: 21, r: 4.8, pupil: { x: 41.6, y: 21.6, r: 2.3 } },
    { x: 59, y: 21, r: 4.8, pupil: { x: 59.6, y: 21.6, r: 2.3 } },
  ],
  box: { x0: 19, y0: 1.5, x1: 81, y1: 76.5 },
  place: { s: 0.82, x: 6, y: 12 },
  motion: 'pulse',
  size: 0.9,
};

/** the octopus: a round head and eight curly arms, four of them in front */
const KRAKE: SpeciesDef = {
  id: 'krake',
  name: 'Krake',
  article: 'der',
  parts: [
    {
      id: 'back',
      d: bands(
        { at: [[40, 44], [33, 60], [24, 70], [18, 68]], w0: 9, w1: 3 },
        { at: [[50, 46], [50, 62], [47, 72], [43, 72]], w0: 9, w1: 3 },
        { at: [[60, 44], [67, 60], [76, 70], [82, 68]], w0: 9, w1: 3 },
      ),
    },
    {
      id: 'front',
      d: bands(
        { at: [[36, 42], [28, 54], [18, 60], [10, 57], [9, 50], [14, 48]], w0: 11, w1: 3 },
        { at: [[44, 46], [41, 60], [36, 70], [30, 74], [27, 69]], w0: 11, w1: 3 },
        { at: [[56, 46], [59, 60], [64, 70], [70, 74], [73, 69]], w0: 11, w1: 3 },
        { at: [[64, 42], [72, 54], [82, 60], [90, 57], [91, 50], [86, 48]], w0: 11, w1: 3 },
      ),
    },
    { id: 'head', d: 'M 26 38 C 20 20 32 2 50 2 C 68 2 80 20 74 38 C 71 47 62 52 50 52 C 38 52 29 47 26 38 Z' },
  ],
  moving: ['back', 'front'],
  pivot: { x: 50, y: 46 },
  lines: [
    // spots on the head
    'M 37 15 Q 40 11 43 15 Q 40 19 37 15 Z',
    'M 52 9 Q 55 5 58 9 Q 55 13 52 9 Z',
    'M 61 19 Q 64 15 67 19 Q 64 23 61 19 Z',
  ],
  strokes: ['M 45 43 Q 50 47 55 43'],
  eyes: [
    { x: 42, y: 32, r: 5.4, pupil: { x: 42.6, y: 32.8, r: 2.6 } },
    { x: 58, y: 32, r: 5.4, pupil: { x: 58.6, y: 32.8, r: 2.6 } },
  ],
  box: { x0: 5.5, y0: 1.5, x1: 94.5, y1: 77 },
  place: { s: 0.82, x: 6, y: 12 },
  motion: 'arms',
  size: 1,
};

/** the sea turtle: domed shell with plates, head to the right, big front flipper */
const SCHILDKROETE: SpeciesDef = {
  id: 'schildkroete',
  name: 'Schildkröte',
  article: 'die',
  parts: [
    { id: 'rear', d: 'M 30 48 C 24 54 15 59 5 59 C 9 52 16 47 24 44 Z' },
    { id: 'front', d: 'M 72 46 C 68 57 58 67 42 72 C 46 64 54 55 60 47 Z' },
    { id: 'head', d: 'M 76 34 C 81 24 96 23 100 32 C 103 40 99 47 90 48 C 85 48 80 47 76 45 Z' },
    { id: 'shell', d: 'M 16 46 C 18 22 38 10 56 10 C 74 10 86 24 88 46 C 88 50 86 52 83 52 C 64 56 38 56 21 52 C 18 51 16 49 16 46 Z' },
  ],
  moving: ['rear', 'front'],
  pivot: { x: 64, y: 47 },
  lines: [
    // the rim and the plates
    'M 17 45 C 36 49 68 49 87.5 45',
    'M 40 31 L 47 21 L 63 21 L 70 31 L 63 41 L 47 41 Z',
    'M 40 31 L 18.5 36',
    'M 47 21 L 41 13',
    'M 63 21 L 70 13',
    'M 70 31 L 86 34',
    'M 63 41 L 68 47.5',
    'M 47 41 L 40 47.5',
  ],
  strokes: ['M 91 42 Q 95 43.5 98.5 40.5'],
  eyes: [{ x: 90, y: 33, r: 5, pupil: { x: 91.2, y: 33.5, r: 2.4 } }],
  box: { x0: 4.5, y0: 9.5, x1: 101.5, y1: 72.5 },
  place: { s: 0.82, x: 5, y: 8 },
  motion: 'glide',
  size: 1.2,
};

const CLAW = 'M 32 42 C 26 40 22 36 22 30 C 26 26 28 18 26 11 C 23 15 21 18 18 19 C 18 14 17 9 14 5 C 5 9 2 21 6 30 C 9 37 15 44 22 47 C 26 49 30 50 32 50 Z';
const LEGS: P[][] = [
  [[34, 48], [20, 48], [11, 53], [7, 60]],
  [[35, 52], [22, 56], [15, 63], [13, 70]],
  [[38, 56], [28, 62], [23, 69], [23, 75]],
];

/** the crab: wide shell, eyes on stalks, two big claws and three legs on each side */
const KREBS: SpeciesDef = {
  id: 'krebs',
  name: 'Krebs',
  article: 'der',
  parts: [
    {
      id: 'legs',
      d: bands(
        ...LEGS.map((at) => ({ at, w0: 5, w1: 3 })),
        ...LEGS.map((at) => ({ at: at.map(([x, y]): P => [100 - x, y]), w0: 5, w1: 3 })).reverse(),
      ),
    },
    { id: 'clawL', d: CLAW },
    { id: 'clawR', d: mirror(CLAW, 50) },
    { id: 'body', d: 'M 24 48 C 24 36 34 30 42 29 L 41 14 C 41 10 45 10 45 14 L 46 28 C 48.7 27.8 51.3 27.8 54 28 L 55 14 C 55 10 59 10 59 14 L 58 29 C 66 30 76 36 76 48 C 76 58 64 64 50 64 C 36 64 24 58 24 48 Z' },
  ],
  moving: ['clawL', 'clawR'],
  pivot: { x: 50, y: 46 },
  lines: [
    // the shell's edge
    'M 30 40 C 38 35 62 35 70 40',
  ],
  strokes: ['M 44 51 Q 50 56 56 51'],
  eyes: [
    { x: 43, y: 13, r: 5, pupil: { x: 43.6, y: 13.8, r: 2.4 } },
    { x: 57, y: 13, r: 5, pupil: { x: 57.6, y: 13.8, r: 2.4 } },
  ],
  box: { x0: 3.5, y0: 4.5, x1: 96.5, y1: 77.5 },
  place: { s: 0.82, x: 6, y: 12 },
  motion: 'walk',
  size: 0.8,
};

export const SPECIES: Record<SpeciesId, SpeciesDef> = {
  fisch: FISCH,
  clownfisch: CLOWNFISCH,
  doktorfisch: DOKTORFISCH,
  kugelfisch: KUGELFISCH,
  karpfen: KARPFEN,
  hecht: HECHT,
  hai: HAI,
  seepferdchen: SEEPFERDCHEN,
  qualle: QUALLE,
  krake: KRAKE,
  schildkroete: SCHILDKROETE,
  krebs: KREBS,
  freiform: { ...FISCH, id: 'freiform', name: 'Freiform', parts: [], moving: [], lines: [], strokes: [], eyes: [], motion: 'sway' },
};

export const ANIMALS: SpeciesId[] = (Object.keys(SPECIES) as SpeciesId[]).filter((id) => id !== 'freiform');
