// Pictures of the Wörter-Zoo, group 3: Mama, Ast, Nase, Lama, Hut, Auto, Nudel, Lampe, Krone, Blume, Rad,
// Ameise, Bär, Melone, Schaf, Buch, Stern, Schiff, Drache, Uhr, Affe. Each is drawn around (0, 0) with a thick
// dark outline, round shapes and a friendly face; alive it plays its own funny moment, then rests calmly.
import type { Ctx2D, Picto } from '../picto.ts';

type C = Ctx2D;
type Pt = [number, number];
type Fill = string | CanvasGradient;

const TAU = Math.PI * 2;
const INK = '#3b2a3a';
const LW = 6;

// ---------- timing ----------
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** 0..1 while p runs from a to b */
const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const smooth = (x: number) => x * x * (3 - 2 * x);
/** 0 -> 1 -> 0 while p runs from a to b */
const hump = (p: number, a: number, b: number) => Math.sin(seg(p, a, b) * Math.PI);
const backOut = (x: number) => {
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
};

interface St {
  /** the funny animation is running */
  act: boolean;
  /** its progress 0..1 */
  p: number;
  /** seconds of calm rest after it */
  r: number;
  calm: boolean;
  /** breathing -1..1 while calm */
  br: number;
  /** eye openness (blinks while alive) */
  open: number;
  /** seconds alive (0 while still) */
  t: number;
}

function blink(t: number): number {
  const c = t % 3.3;
  return c > 3.1 ? Math.abs(c - 3.2) / 0.1 : 1;
}

function st(t: number, alive: boolean, anim: number): St {
  const act = alive && t < anim;
  const calm = alive && !act;
  const r = calm ? t - anim : 0;
  return { act, p: act ? t / anim : 0, r, calm, br: calm ? Math.sin(r * 2.4) : 0, open: alive ? blink(t) : 1, t: alive ? t : 0 };
}

// ---------- drawing helpers ----------
function tone(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(k >= 0 ? c + (255 - c) * k : c * (1 + k)));
  return `rgb(${ch[0]},${ch[1]},${ch[2]})`;
}

/** soft round light from the top left */
function shade(ctx: C, x: number, y: number, r: number, hex: string): CanvasGradient {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.15);
  g.addColorStop(0, tone(hex, 0.32));
  g.addColorStop(0.55, hex);
  g.addColorStop(1, tone(hex, -0.22));
  return g;
}

function fs(ctx: C, fill: Fill, lw = LW, stroke = INK): void {
  ctx.fillStyle = fill;
  ctx.fill();
  if (lw > 0) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}

function oval(ctx: C, x: number, y: number, rx: number, ry: number, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
}

function rrect(ctx: C, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** a fluffy scalloped blob with n bumps */
function bumpy(ctx: C, cx: number, cy: number, rx: number, ry: number, n: number, amp: number, ph = 0): void {
  ctx.beginPath();
  const N = n * 12;
  for (let i = 0; i <= N; i++) {
    const th = (i / N) * TAU;
    const f = 1 + amp * (Math.abs(Math.sin((th * n) / 2 + ph)) - 0.6);
    const x = cx + Math.cos(th) * rx * f;
    const y = cy + Math.sin(th) * ry * f;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** several shapes filled as one with one outline around all */
function union(ctx: C, shapes: (() => void)[], fill: Fill, lw = LW): void {
  for (const s of shapes) {
    s();
    ctx.lineWidth = lw * 2;
    ctx.strokeStyle = INK;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
  ctx.fillStyle = fill;
  for (const s of shapes) {
    s();
    ctx.fill();
  }
}

function curve(ctx: C, pts: Pt[]): void {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  if (pts.length === 2) {
    ctx.lineTo(pts[1][0], pts[1][1]);
    return;
  }
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  const l = pts[pts.length - 1];
  ctx.lineTo(l[0], l[1]);
}

/** a thick round limb (leg, arm, neck, tail, noodle) with outline */
function limb(ctx: C, pts: Pt[], w: number, color: string, lw = LW): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  curve(ctx, pts);
  ctx.strokeStyle = INK;
  ctx.lineWidth = w + lw * 2;
  ctx.stroke();
  curve(ctx, pts);
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.stroke();
  ctx.restore();
}

function line(ctx: C, pts: Pt[], w: number, color = INK): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  curve(ctx, pts);
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.stroke();
  ctx.restore();
}

function shine(ctx: C, x: number, y: number, rx: number, ry: number, rot = -0.5, a = 0.6): void {
  ctx.save();
  ctx.fillStyle = `rgba(255,255,255,${a})`;
  oval(ctx, x, y, rx, ry, rot);
  ctx.fill();
  oval(ctx, x + rx * 1.15, y - ry * 0.6, rx * 0.25, rx * 0.25);
  ctx.fill();
  ctx.restore();
}

/** big cute eye; open < 0.2 draws it closed */
function eye(ctx: C, x: number, y: number, r: number, open = 1, lx = 0.15, ly = 0.1): void {
  if (open < 0.2) {
    line(ctx, [[x - r, y], [x, y + r * 0.45], [x + r, y]], Math.max(3, r * 0.28));
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, open);
  oval(ctx, 0, 0, r, r * 1.08);
  fs(ctx, '#fff', Math.max(2.5, r * 0.18));
  const pr = r * 0.62;
  const px = lx * r * 0.4;
  const py = ly * r * 0.4;
  oval(ctx, px, py, pr, pr * 1.05);
  ctx.fillStyle = '#2a1d33';
  ctx.fill();
  ctx.fillStyle = 'rgba(120,90,200,0.35)';
  ctx.beginPath();
  ctx.arc(px, py + pr * 0.3, pr * 0.6, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = '#fff';
  oval(ctx, px - pr * 0.35, py - pr * 0.4, pr * 0.36, pr * 0.36);
  ctx.fill();
  oval(ctx, px + pr * 0.32, py + pr * 0.32, pr * 0.15, pr * 0.15);
  ctx.fill();
  ctx.restore();
}

/** a happy closed eye ^ */
function happyEye(ctx: C, x: number, y: number, r: number): void {
  line(ctx, [[x - r, y + r * 0.35], [x, y - r * 0.65], [x + r, y + r * 0.35]], Math.max(3, r * 0.3));
}

/** squeezed eye > or < */
function squeezeEye(ctx: C, x: number, y: number, r: number, dir: 1 | -1): void {
  line(ctx, [[x - r * 0.8 * dir, y - r * 0.6], [x + r * 0.6 * dir, y], [x - r * 0.8 * dir, y + r * 0.6]], Math.max(3, r * 0.3));
}

function smile(ctx: C, x: number, y: number, w: number, lw = 5, color = INK): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y - w * 0.3, w * 0.55, 0.2 * Math.PI, 0.8 * Math.PI);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();
}

/** open laughing mouth */
function openMouth(ctx: C, x: number, y: number, w: number, h: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.quadraticCurveTo(x, y + h * 2, x + w / 2, y);
  ctx.closePath();
  fs(ctx, '#7a2340', 4);
  ctx.beginPath();
  ctx.ellipse(x, y + h * 0.75, w * 0.22, h * 0.28, 0, 0, TAU);
  ctx.fillStyle = '#ff8fa8';
  ctx.fill();
  ctx.restore();
}

/** round 'o' mouth */
function oMouth(ctx: C, x: number, y: number, r: number): void {
  oval(ctx, x, y, r * 0.8, r);
  fs(ctx, '#7a2340', 4);
}

function cheek(ctx: C, x: number, y: number, r: number, a = 0.45): void {
  ctx.save();
  ctx.fillStyle = `rgba(255,110,150,${a})`;
  oval(ctx, x, y, r, r * 0.6);
  ctx.fill();
  ctx.restore();
}

function heartPath(ctx: C, x: number, y: number, s: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.4, y + s * 0.1, x - s * 1.0, y - s * 1.0, x, y - s * 0.4);
  ctx.bezierCurveTo(x + s * 1.0, y - s * 1.0, x + s * 1.4, y + s * 0.1, x, y + s * 0.9);
  ctx.closePath();
}

function heart(ctx: C, x: number, y: number, s: number, color = '#ff4f81'): void {
  heartPath(ctx, x, y, s);
  fs(ctx, shade(ctx, x, y, s, color), Math.max(3, s * 0.18));
  shine(ctx, x - s * 0.45, y - s * 0.3, s * 0.22, s * 0.12, -0.6, 0.6);
}

/** four-pointed twinkle */
function sparkle(ctx: C, x: number, y: number, r: number, color = '#ffe45c'): void {
  if (r <= 0.5) return;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU - Math.PI / 2;
    const rr = i % 2 ? r * 0.3 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  fs(ctx, color, Math.max(2, r * 0.15), '#b8860b');
}

/** a little puff cloud */
function puff(ctx: C, x: number, y: number, r: number, color = '#ffffff', a = 1): void {
  if (r <= 0.5 || a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  union(
    ctx,
    [() => oval(ctx, x, y, r, r * 0.85), () => oval(ctx, x - r * 0.75, y + r * 0.2, r * 0.65, r * 0.55), () => oval(ctx, x + r * 0.75, y + r * 0.2, r * 0.65, r * 0.55)],
    color,
    2.5,
  );
  ctx.restore();
}

/** sound arcs from (x, y) towards angle a */
function soundArcs(ctx: C, x: number, y: number, a: number, k: number, color = INK): void {
  for (let i = 0; i < 3; i++) {
    const v = clamp01(k * 3 - i);
    if (v <= 0) continue;
    ctx.save();
    ctx.globalAlpha = Math.min(1, v);
    ctx.beginPath();
    ctx.arc(x, y, 14 + i * 13, a - 0.55, a + 0.55);
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
  }
}

function leaf(ctx: C, x: number, y: number, len: number, ang: number, color = '#5cc45c'): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -len * 0.38, len, 0);
  ctx.quadraticCurveTo(len * 0.5, len * 0.38, 0, 0);
  ctx.closePath();
  fs(ctx, shade(ctx, len * 0.5, 0, len * 0.5, color), 4.5);
  line(ctx, [[len * 0.1, 0], [len * 0.8, 0]], 2.5, tone(color, -0.35));
  ctx.restore();
}

// ---------- the pictures ----------

const mama: Picto = {
  anim: 3,
  draw(ctx, t, alive) {
    const s = st(t, alive, 3);
    const p = s.p;
    const tilt = s.act ? 0.15 * hump(p, 0.05, 0.92) : s.calm ? 0.05 * Math.sin(s.r * 1.3) : 0;
    const pulse = s.act ? 1 + 0.14 * Math.sin(p * TAU * 3) * hump(p, 0, 1) : 1 + 0.04 * s.br;
    const hair = '#7a4526';
    const skin = '#ffd6b0';
    ctx.save();
    ctx.translate(0, -s.br * 1.5);
    // long hair behind
    ctx.save();
    ctx.translate(0, 35);
    ctx.rotate(tilt * 0.7);
    ctx.translate(0, -35);
    union(ctx, [() => oval(ctx, 0, -45, 86, 90), () => rrect(ctx, -86, -45, 172, 120, 34)], shade(ctx, 0, -20, 110, hair));
    ctx.restore();
    // neck
    rrect(ctx, -18, 10, 36, 45, 10);
    fs(ctx, tone(skin, -0.08));
    // dress
    ctx.beginPath();
    ctx.moveTo(-40, 45);
    ctx.bezierCurveTo(-95, 52, -112, 95, -116, 140);
    ctx.lineTo(116, 140);
    ctx.bezierCurveTo(112, 95, 95, 52, 40, 45);
    ctx.quadraticCurveTo(0, 62, -40, 45);
    ctx.closePath();
    fs(ctx, shade(ctx, 0, 80, 110, '#ff6fa8'));
    // white collar dots
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (const [dx, dy] of [[-70, 110], [-45, 128], [70, 110], [45, 128], [-88, 132], [88, 132]] as Pt[]) {
      oval(ctx, dx, dy, 5, 5);
      ctx.fill();
    }
    // head
    ctx.save();
    ctx.translate(0, 35);
    ctx.rotate(tilt);
    ctx.translate(0, -35);
    // earrings
    for (const sx of [-1, 1]) {
      oval(ctx, sx * 60, 0, 7, 7);
      fs(ctx, '#ffd23f', 3);
    }
    oval(ctx, 0, -35, 62, 68);
    fs(ctx, shade(ctx, 0, -35, 68, skin));
    // bangs
    ctx.beginPath();
    ctx.moveTo(-66, -30);
    ctx.bezierCurveTo(-78, -115, 78, -125, 66, -30);
    ctx.quadraticCurveTo(48, -70, 8, -78);
    ctx.quadraticCurveTo(-30, -66, -66, -30);
    ctx.closePath();
    fs(ctx, shade(ctx, 0, -85, 70, hair));
    // flower clip
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      oval(ctx, 48 + Math.cos(a) * 9, -82 + Math.sin(a) * 9, 7, 7);
      fs(ctx, '#ff9ccc', 2.5);
    }
    oval(ctx, 48, -82, 5, 5);
    fs(ctx, '#ffd23f', 2);
    // eyes with lashes
    const happy = s.act && p > 0.25 && p < 0.8;
    for (const sx of [-1, 1]) {
      const ex = sx * 24;
      if (happy) happyEye(ctx, ex, -36, 12);
      else eye(ctx, ex, -36, 12, s.open, 0.1, 0.15);
      line(ctx, [[ex + sx * 10, -46], [ex + sx * 17, -53]], 3);
      line(ctx, [[ex + sx * 4, -49], [ex + sx * 7, -57]], 3);
    }
    cheek(ctx, -40, -12, 11);
    cheek(ctx, 40, -12, 11);
    line(ctx, [[-3, -22], [3, -16], [-2, -12]], 3, tone(skin, -0.35));
    if (s.act && p > 0.2 && p < 0.5) heart(ctx, 0, 2, 9, '#e8334f');
    else smile(ctx, 0, 6, 34, 6, '#d6334f');
    ctx.restore();
    // arms hugging the heart
    limb(ctx, [[-82, 62], [-80, 108], [-30, 104]], 26, '#ff6fa8');
    limb(ctx, [[82, 62], [80, 108], [30, 104]], 26, '#ff6fa8');
    heart(ctx, 0, 92, 30 * pulse);
    for (const sx of [-1, 1]) {
      oval(ctx, sx * 28, 102, 14, 12);
      fs(ctx, skin, 4.5);
    }
    // little hearts flying up
    if (s.act)
      for (let i = 0; i < 4; i++) {
        const q = seg(p, 0.12 + i * 0.16, 0.57 + i * 0.16);
        if (q <= 0 || q >= 1) continue;
        ctx.save();
        ctx.globalAlpha = 1 - q * q;
        const x = (i % 2 ? 1 : -1) * (75 + q * 55) + Math.sin(q * 8) * 10;
        heart(ctx, x, 60 - q * 190, 11 + i * 2);
        ctx.restore();
      }
    ctx.restore();
  },
};

const ast: Picto = {
  anim: 3,
  draw(ctx, t, alive) {
    const s = st(t, alive, 3);
    const p = s.p;
    const bark = '#9a6236';
    const ang = s.act ? -0.07 * Math.sin(p * TAU * 3) * hump(p, 0, 0.7) : s.calm ? 0.025 * Math.sin(s.r * 1.4) : 0;
    const puffUp = 1 + 0.06 * hump(p, 0.05, 0.45);
    const shake = s.act ? 0.45 * Math.sin(s.t * 32) * hump(p, 0.08, 0.6) : s.calm ? 0.12 * Math.sin(s.r * 3) : 0;
    const fallen = s.act ? p > 0.45 : s.calm;
    ctx.save();
    ctx.translate(-125, 40);
    ctx.rotate(ang);
    ctx.scale(puffUp, puffUp);
    ctx.translate(125, -40);
    // side twig with leaves
    limb(ctx, [[30, -12], [52, -52], [72, -92]], 13, bark);
    leaf(ctx, 72, -92, 50, -1.25 + shake);
    leaf(ctx, 54, -58, 44, -2.6 - shake);
    leaf(ctx, 60, -60, 42, -0.35 + shake * 0.8);
    // main branch
    ctx.beginPath();
    ctx.moveTo(-125, 6);
    ctx.bezierCurveTo(-40, -6, 60, -30, 138, -44);
    ctx.quadraticCurveTo(146, -38, 136, -31);
    ctx.bezierCurveTo(60, -8, -40, 42, -125, 74);
    ctx.closePath();
    fs(ctx, shade(ctx, -20, 10, 120, bark));
    // bark lines and knot
    line(ctx, [[-10, 4], [30, -6], [70, -18]], 3, tone(bark, -0.35));
    line(ctx, [[0, 30], [50, 12]], 3, tone(bark, -0.35));
    oval(ctx, 20, 14, 9, 5, -0.2);
    fs(ctx, tone(bark, -0.25), 3);
    // leaves on the tip (the front one falls off)
    leaf(ctx, 134, -38, 46, -0.1 - shake * 0.7);
    if (!fallen) leaf(ctx, 120, -32, 44, 0.9 + shake);
    // cut end with rings
    oval(ctx, -125, 40, 17, 34);
    fs(ctx, '#f0cf96');
    oval(ctx, -125, 40, 10, 22);
    ctx.strokeStyle = '#c0915a';
    ctx.lineWidth = 3;
    ctx.stroke();
    oval(ctx, -125, 40, 4, 9);
    ctx.stroke();
    // face
    const angry = s.act && p < 0.55;
    eye(ctx, -78, 20, 11, s.open, 0.3, 0);
    eye(ctx, -42, 14, 11, s.open, 0.3, 0);
    if (angry) {
      line(ctx, [[-90, 4], [-68, 9]], 4);
      line(ctx, [[-52, 4], [-31, -3]], 4);
      oMouth(ctx, -58, 40, 7);
    } else smile(ctx, -58, 38, 24, 4.5);
    cheek(ctx, -90, 36, 8);
    cheek(ctx, -30, 30, 8);
    ctx.restore();
    // the leaf that falls
    if (fallen) {
      const q = s.act ? seg(p, 0.45, 1) : 1;
      const x = 118 - q * 50 + Math.sin(q * 9) * 28;
      const y = -30 + smooth(q) * 150;
      leaf(ctx, x, y, 44, 0.9 * (1 - q) + Math.sin(q * 9) * 0.6 + q * 0.2);
    }
  },
};

const nase: Picto = {
  anim: 3,
  draw(ctx, t, alive) {
    const s = st(t, alive, 3);
    const p = s.p;
    const skin = '#ffc9a0';
    const inhale = s.act ? smooth(seg(p, 0, 0.42)) * (1 - seg(p, 0.45, 0.5)) : 0;
    const boom = s.act ? hump(p, 0.45, 0.62) : 0;
    const wob = s.act ? 0.08 * Math.sin(s.t * 18) * seg(p, 0.55, 0.62) * (1 - seg(p, 0.62, 1)) : 0;
    const nost = 1 + 0.45 * inhale + 0.1 * s.br;
    ctx.save();
    ctx.translate(0, boom * 18);
    ctx.rotate(wob);
    ctx.translate(0, 100);
    ctx.scale(1 + 0.05 * inhale + 0.08 * boom, 1 + 0.1 * inhale - 0.12 * boom);
    ctx.translate(0, -100);
    // the nose
    ctx.beginPath();
    ctx.moveTo(-28, -118);
    ctx.quadraticCurveTo(0, -150, 28, -118);
    ctx.bezierCurveTo(32, -60, 45, -10, 60, 18);
    ctx.bezierCurveTo(112, 18, 120, 98, 62, 98);
    ctx.quadraticCurveTo(0, 122, -62, 98);
    ctx.bezierCurveTo(-120, 98, -112, 18, -60, 18);
    ctx.bezierCurveTo(-45, -10, -32, -60, -28, -118);
    ctx.closePath();
    fs(ctx, shade(ctx, 0, 30, 120, skin));
    // rosy tip and nostril wings
    ctx.fillStyle = 'rgba(255,110,120,0.3)';
    oval(ctx, 0, 45, 45, 32);
    ctx.fill();
    line(ctx, [[-62, 30], [-78, 58], [-66, 86]], 4, tone(skin, -0.3));
    line(ctx, [[62, 30], [78, 58], [66, 86]], 4, tone(skin, -0.3));
    shine(ctx, -18, 30, 20, 11, -0.5, 0.65);
    // nostrils
    for (const sx of [-1, 1]) {
      oval(ctx, sx * 32, 86, 14 * nost, 9 * nost, sx * 0.3);
      fs(ctx, '#7a3b3b', 3);
    }
    // eyes on top
    if (s.act && p > 0.45 && p < 0.62) {
      squeezeEye(ctx, -16, -95, 12, 1);
      squeezeEye(ctx, 16, -95, 12, -1);
    } else if (s.act && p > 0.62 && p < 0.85) {
      happyEye(ctx, -16, -95, 12);
      happyEye(ctx, 16, -95, 12);
    } else {
      const o = s.act && p < 0.45 ? 1 - 0.55 * inhale : s.open;
      eye(ctx, -16, -95, 12, o, 0, 0.3);
      eye(ctx, 16, -95, 12, o, 0, 0.3);
    }
    if (s.act && p < 0.45) {
      // eyebrows up while it tickles
      line(ctx, [[-28, -118], [-8, -122]], 3.5);
      line(ctx, [[8, -122], [28, -118]], 3.5);
    }
    ctx.restore();
    if (!s.act) return;
    // air sucked in
    if (p < 0.43)
      for (let i = 0; i < 4; i++) {
        const q = (s.t * 1.6 + i / 4) % 1;
        const sx = i % 2 ? 1 : -1;
        const x = sx * (40 + (1 - q) * 70);
        const y = 150 - q * 40;
        line(ctx, [[x, y], [x - sx * 16, y - 8]], 4, 'rgba(120,170,230,0.8)');
      }
    // ha-tschi spray
    const q = seg(p, 0.47, 0.95);
    if (q > 0 && q < 1) {
      ctx.save();
      ctx.globalAlpha = 1 - q;
      puff(ctx, 0, 140 + q * 15, 20 + q * 28, '#ffffff', 1);
      for (let i = 0; i < 14; i++) {
        const a = Math.PI * (0.12 + (0.76 * i) / 13);
        const d = 30 + q * (110 + (i % 3) * 18);
        const x = (i < 7 ? -32 : 32) + Math.cos(a) * d;
        const y = 104 + Math.sin(a) * d * 0.55;
        oval(ctx, x, y, 5, 6);
        fs(ctx, '#9fd8ff', 2, '#4a86c0');
      }
      ctx.restore();
    }
  },
};

const lama: Picto = {
  anim: 3.5,
  draw(ctx, t, alive) {
    const s = st(t, alive, 3.5);
    const p = s.p;
    const wool = '#f6e6c4';
    const chew = s.act && p < 0.4 ? Math.sin(s.t * 22) * 3 : s.calm ? Math.sin(s.r * 6) * 1.5 * (Math.sin(s.r * 0.9) > 0.3 ? 1 : 0) : 0;
    const cheeks = s.act ? smooth(seg(p, 0.12, 0.38)) * (1 - seg(p, 0.45, 0.5)) : 0;
    const headRot = s.act ? -0.14 * smooth(seg(p, 0.35, 0.45)) * (1 - seg(p, 0.45, 0.5)) + 0.08 * hump(p, 0.45, 0.6) - 0.06 * seg(p, 0.65, 0.8) : s.calm ? -0.06 + 0.02 * Math.sin(s.r * 1.2) : 0;
    ctx.save();
    ctx.translate(0, -s.br * 1.5);
    // legs
    for (const [x, d] of [[-70, -0.1], [22, -0.1], [-42, 0], [50, 0]] as Pt[]) {
      limb(ctx, [[x, 55], [x, 132]], 20, tone(wool, d));
      oval(ctx, x + 2, 134, 13, 7);
      fs(ctx, '#6a4a3a', 4);
    }
    // tail and body
    bumpy(ctx, -112, 22, 18, 22, 5, 0.25);
    fs(ctx, wool);
    bumpy(ctx, -18, 42, 92, 48, 16, 0.12);
    fs(ctx, shade(ctx, -18, 42, 92, wool));
    // blanket
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-74, 2);
    ctx.quadraticCurveTo(-25, -16, 22, 2);
    ctx.lineTo(24, 52);
    ctx.lineTo(-72, 52);
    ctx.closePath();
    fs(ctx, '#e94f64', 5);
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(-71, 22, 93, 10);
    ctx.fillStyle = '#4fb3ff';
    for (let i = 0; i < 5; i++) {
      oval(ctx, -60 + i * 19, 42, 4, 4);
      ctx.fill();
    }
    for (let i = 0; i < 6; i++) line(ctx, [[-68 + i * 18, 52], [-68 + i * 18, 62]], 4, '#ffd23f');
    ctx.restore();
    // neck and head (turn around the neck base)
    ctx.save();
    ctx.translate(40, 25);
    ctx.rotate(headRot);
    ctx.translate(-40, -25);
    limb(ctx, [[38, 30], [52, -20], [66, -76]], 44, wool);
    oval(ctx, 54, -138, 9, 26, -0.25);
    fs(ctx, wool, 5);
    oval(ctx, 86, -140, 9, 26, 0.2);
    fs(ctx, wool, 5);
    oval(ctx, 75, -96, 38, 32);
    fs(ctx, shade(ctx, 75, -96, 38, wool));
    bumpy(ctx, 70, -124, 24, 12, 6, 0.3);
    fs(ctx, tone(wool, 0.4), 4);
    oval(ctx, 106, -80 + chew * 0.3, 26, 19);
    fs(ctx, '#fff4e0', 5);
    if (cheeks > 0) {
      oval(ctx, 98, -76, 6 + cheeks * 14, 5 + cheeks * 12);
      fs(ctx, '#fff4e0', 4);
    }
    oval(ctx, 122, -88, 3.5, 2.5);
    ctx.fillStyle = INK;
    ctx.fill();
    const innocent = s.act && p > 0.6;
    if (innocent) {
      happyEye(ctx, 62, -100, 10);
      happyEye(ctx, 87, -102, 10);
    } else {
      const look = s.act && p < 0.45 ? -0.8 : 0.5;
      eye(ctx, 62, -100, 10, s.open, look, 0);
      eye(ctx, 87, -102, 10, s.open, look, 0);
    }
    line(ctx, [[54, -110], [50, -116]], 3);
    line(ctx, [[94, -112], [97, -118]], 3);
    cheek(ctx, 86, -80, 8);
    if (s.act && p > 0.44 && p < 0.55) oMouth(ctx, 124, -70, 6);
    else line(ctx, [[110, -68 + chew], [118, -64 + chew], [126, -70 + chew]], 3.5);
    ctx.restore();
    // the little spit
    if (s.act) {
      const q = seg(p, 0.47, 0.82);
      if (q > 0 && q < 1) {
        const x = 128 + 52 * q;
        const y = -72 - 70 * q + 190 * q * q;
        oval(ctx, x, y, 6, 7);
        fs(ctx, '#bfe6ff', 2.5, '#4a86c0');
      }
      const k = seg(p, 0.82, 0.95);
      if (k > 0 && k < 1)
        for (let i = 0; i < 5; i++) {
          const a = Math.PI + (i / 4) * Math.PI;
          oval(ctx, 180 + Math.cos(a) * 16 * k, 48 + Math.sin(a) * 12 * k, 3.5, 3.5);
          fs(ctx, '#bfe6ff', 2, '#4a86c0');
        }
    }
    ctx.restore();
  },
};

const hut: Picto = {
  anim: 3,
  draw(ctx, t, alive) {
    const s = st(t, alive, 3);
    const p = s.p;
    const blue = '#4c7bd9';
    const crouch = hump(p, 0, 0.22) + hump(p, 0.6, 0.72) * 0.8;
    const jump = s.act ? -80 * Math.sin(seg(p, 0.2, 0.62) * Math.PI) : s.calm ? -4 * Math.abs(Math.sin(s.r * 1.6)) : 0;
    const spin = s.act ? Math.cos(smooth(seg(p, 0.22, 0.6)) * TAU) : 1;
    const tilt = s.act ? 0.16 * backOut(seg(p, 0.7, 0.85)) : s.calm ? 0.16 + 0.03 * Math.sin(s.r * 1.6) : 0;
    ctx.save();
    ctx.translate(0, jump);
    ctx.translate(0, 85);
    ctx.rotate(tilt);
    ctx.scale((1 + 0.12 * crouch) * (0.15 + 0.85 * Math.abs(spin)), 1 - 0.15 * crouch);
    ctx.translate(0, -85);
    // brim
    oval(ctx, 0, 58, 135, 32);
    const brim = ctx.createLinearGradient(0, 26, 0, 90);
    brim.addColorStop(0, tone(blue, 0.25));
    brim.addColorStop(1, tone(blue, -0.15));
    fs(ctx, brim);
    // crown: narrower at the top with a pinch in the middle
    const crown = () => {
      ctx.beginPath();
      ctx.moveTo(-78, 55);
      ctx.bezierCurveTo(-74, 10, -68, -40, -58, -64);
      ctx.quadraticCurveTo(-50, -80, -28, -76);
      ctx.quadraticCurveTo(-10, -72, 0, -64);
      ctx.quadraticCurveTo(10, -72, 28, -76);
      ctx.quadraticCurveTo(50, -80, 58, -64);
      ctx.bezierCurveTo(68, -40, 74, 10, 78, 55);
      ctx.quadraticCurveTo(0, 70, -78, 55);
      ctx.closePath();
    };
    crown();
    fs(ctx, shade(ctx, 0, -10, 100, blue));
    ctx.save();
    crown();
    ctx.clip();
    ctx.fillStyle = '#e94f64';
    ctx.fillRect(-90, 22, 180, 30);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(-90, 22, 180, 5);
    ctx.restore();
    crown();
    ctx.lineWidth = LW;
    ctx.strokeStyle = INK;
    ctx.stroke();
    line(ctx, [[-75, 22], [75, 22]], 4);
    line(ctx, [[-75, 52], [75, 52]], 4);
    shine(ctx, -48, -45, 12, 24, 0.2, 0.45);
    // flower on the band (only from the front)
    if (spin > -0.2) {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        oval(ctx, 52 + Math.cos(a) * 11, 34 + Math.sin(a) * 11, 9, 9);
        fs(ctx, '#ffd23f', 3);
      }
      oval(ctx, 52, 34, 7, 7);
      fs(ctx, '#ff7b39', 2.5);
    }
    // face
    if (spin > 0.3) {
      const wink = s.act ? p > 0.72 : s.calm;
      eye(ctx, -26, -22, 13, s.open, 0.1, 0.1);
      if (wink) happyEye(ctx, 26, -22, 13);
      else eye(ctx, 26, -22, 13, s.open, 0.1, 0.1);
      cheek(ctx, -46, -2, 9);
      cheek(ctx, 46, -2, 9);
      if (s.act && p > 0.2 && p < 0.65) openMouth(ctx, 0, 0, 26, 12);
      else smile(ctx, 0, 4, 30, 5);
    }
    ctx.restore();
    if (s.act || s.calm) {
      const k = s.act ? hump(p, 0.68, 1) : 0.5 + 0.5 * Math.sin(s.r * 3);
      sparkle(ctx, -150, -60, 16 * k);
      sparkle(ctx, 150, -90, 13 * k);
      sparkle(ctx, 130, 30, 10 * (s.act ? hump(p, 0.75, 1) : 0.5 + 0.5 * Math.sin(s.r * 3 + 2)));
    }
  },
};

function wheel(ctx: C, x: number, y: number, r: number, rot: number, spokes: number, tire = '#34303a'): void {
  oval(ctx, x, y, r, r);
  fs(ctx, tire, 4);
  oval(ctx, x, y, r * 0.55, r * 0.55);
  fs(ctx, '#d6d9e0', 3);
  for (let i = 0; i < spokes; i++) {
    const a = rot + (i / spokes) * TAU;
    line(ctx, [[x, y], [x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5]], 3, '#8a8f9c');
  }
  oval(ctx, x, y, r * 0.16, r * 0.16);
  fs(ctx, '#8a8f9c', 2.5);
}

const auto: Picto = {
  anim: 3,
  draw(ctx, t, alive) {
    const s = st(t, alive, 3);
    const p = s.p;
    const red = '#e8443a';
    const bounce = s.act ? -20 * Math.abs(Math.sin(p * Math.PI * 4)) * (1 - p * 0.6) : s.calm ? -1.5 * (1 + s.br) : 0;
    const squash = s.act ? 0.05 * Math.cos(p * Math.PI * 8) * (1 - p) : 0;
    const honk = s.act ? hump(p, 0.42, 0.78) : 0;
    const wrot = s.t * (s.act ? 9 : 1.2);
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    oval(ctx, 0, 112, 140, 10);
    ctx.fill();
    // exhaust puffs
    if (s.act)
      for (let i = 0; i < 4; i++) {
        const q = (p * 4 + i / 4) % 1;
        puff(ctx, -142 - q * 38, 58 - q * 25, 8 + q * 11, '#e8e8f0', 1 - q);
      }
    ctx.save();
    ctx.translate(0, bounce);
    ctx.translate(0, 70);
    ctx.scale(1 + squash, 1 - squash);
    ctx.translate(0, -70);
    ctx.rotate(s.act ? 0.03 * Math.sin(p * Math.PI * 8) : 0);
    ctx.beginPath();
    ctx.moveTo(-138, 60);
    ctx.lineTo(-138, 15);
    ctx.quadraticCurveTo(-138, -2, -120, -3);
    ctx.lineTo(-78, -6);
    ctx.bezierCurveTo(-66, -62, -40, -68, -2, -68);
    ctx.lineTo(22, -68);
    ctx.bezierCurveTo(52, -68, 70, -32, 86, -6);
    ctx.lineTo(124, 0);
    ctx.quadraticCurveTo(142, 4, 142, 24);
    ctx.lineTo(142, 60);
    ctx.quadraticCurveTo(142, 72, 130, 72);
    ctx.lineTo(-126, 72);
    ctx.quadraticCurveTo(-138, 72, -138, 60);
    ctx.closePath();
    fs(ctx, shade(ctx, 0, 0, 150, red));
    // windows
    ctx.beginPath();
    ctx.moveTo(-64, -10);
    ctx.bezierCurveTo(-56, -52, -36, -56, -12, -56);
    ctx.lineTo(-12, -10);
    ctx.closePath();
    fs(ctx, '#bfe6ff', 4.5);
    ctx.beginPath();
    ctx.moveTo(-1, -56);
    ctx.lineTo(22, -56);
    ctx.bezierCurveTo(44, -56, 60, -32, 72, -10);
    ctx.lineTo(-1, -10);
    ctx.closePath();
    fs(ctx, '#bfe6ff', 4.5);
    shine(ctx, -46, -36, 5, 12, 0.4, 0.7);
    // door and handle
    line(ctx, [[-6, -8], [-6, 64]], 3.5, tone(red, -0.4));
    rrect(ctx, 10, 6, 18, 6, 3);
    fs(ctx, '#ffd9d4', 2.5);
    // lights and bumper
    oval(ctx, 134, 16, 9, 12);
    fs(ctx, honk > 0.2 ? '#fff6a0' : '#ffe066', 4);
    rrect(ctx, -142, 8, 10, 20, 4);
    fs(ctx, '#b31f2e', 3);
    rrect(ctx, 112, 54, 36, 12, 6);
    fs(ctx, '#d6d9e0', 4);
    rrect(ctx, -146, 54, 30, 12, 6);
    fs(ctx, '#d6d9e0', 4);
    shine(ctx, -105, 12, 22, 6, -0.05, 0.4);
    // face in the windscreen
    const wide = honk > 0.3;
    eye(ctx, 18, -31, wide ? 13 : 11, s.open, 0.5, 0.1);
    eye(ctx, 46, -29, wide ? 13 : 11, s.open, 0.5, 0.1);
    cheek(ctx, 104, 26, 9);
    if (honk > 0.15) openMouth(ctx, 112, 32, 22, 9);
    else smile(ctx, 112, 36, 22, 4.5);
    ctx.restore();
    // wheels
    wheel(ctx, -80, 78, 34, wrot, 5);
    wheel(ctx, 82, 78, 34, wrot, 5);
    if (honk > 0) soundArcs(ctx, 150, -14 + bounce, -0.4, honk);
  },
};

const nudel: Picto = {
  anim: 4,
  draw(ctx, t, alive) {
    const s = st(t, alive, 4);
    const p = s.p;
    const pasta = '#f7d470';
    const grow = s.act ? smooth(seg(p, 0.05, 0.4)) * (1 - 0.55 * smooth(seg(p, 0.8, 1))) : s.calm ? 0.45 : 0;
    const L = 95 + grow * 175;
    const ph = s.t * 4;
    const amp = 14 + grow * 34;
    // plate
    oval(ctx, 0, 96, 142, 38);
    fs(ctx, shade(ctx, 0, 96, 142, '#f4f6fb'));
    oval(ctx, 0, 92, 108, 26);
    ctx.strokeStyle = '#7fb0e0';
    ctx.lineWidth = 4;
    ctx.stroke();
    // the long noodle (behind the heap where it starts)
    const N = 40;
    const pts: Pt[] = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const sLen = u * L;
      pts.push([-30 + amp * Math.sin(u * 7 + ph) * u + 18 * u, 55 - sLen * 0.82]);
    }
    limb(ctx, pts, 15, pasta, 5);
    // heap of spaghetti
    bumpy(ctx, 0, 70, 90, 36, 12, 0.14);
    fs(ctx, shade(ctx, 0, 60, 90, pasta));
    ctx.save();
    bumpy(ctx, 0, 70, 90, 36, 12, 0.14);
    ctx.clip();
    for (let j = 0; j < 8; j++) {
      const strand: Pt[] = [];
      for (let x = -95; x <= 95; x += 10) strand.push([x, 40 + j * 9 + 6 * Math.sin(x * 0.09 + j * 1.7)]);
      line(ctx, strand, 3, tone(pasta, -0.28));
    }
    ctx.restore();
    // sauce, meatball, basil
    bumpy(ctx, 10, 52, 50, 20, 9, 0.25);
    fs(ctx, shade(ctx, 10, 52, 50, '#e8402e'), 5);
    oval(ctx, 22, 42, 17, 15);
    fs(ctx, shade(ctx, 22, 42, 17, '#8a4a2c'), 4.5);
    leaf(ctx, -10, 40, 26, -0.6, '#4fb848');
    // head at the end of the noodle
    const end = pts[N];
    const prev = pts[N - 3];
    const dir = Math.atan2(end[1] - prev[1], end[0] - prev[0]);
    ctx.save();
    ctx.translate(end[0], end[1]);
    ctx.rotate(dir + Math.PI / 2);
    oval(ctx, 0, 0, 17, 17);
    fs(ctx, shade(ctx, 0, 0, 17, pasta), 5);
    const confused = s.act && p > 0.45 && p < 0.82;
    eye(ctx, -7, -2, 7, s.open, 0, confused ? 1 : 0.1);
    eye(ctx, 7, -2, 7, s.open, 0, confused ? 1 : 0.1);
    if (confused) oMouth(ctx, 0, 10, 4);
    else smile(ctx, 0, 11, 12, 3);
    cheek(ctx, -12, 7, 4);
    cheek(ctx, 12, 7, 4);
    ctx.restore();
    if (s.act && p > 0.45 && p < 0.82) sparkle(ctx, end[0] + 30, end[1] - 12, 9 * hump(p, 0.45, 0.82), '#ffffff');
  },
};

const lampe: Picto = {
  anim: 3,
  draw(ctx, t, alive) {
    const s = st(t, alive, 3);
    const p = s.p;
    const pull = s.act ? 26 * hump(p, 0.08, 0.32) : 0;
    let on = s.act ? (p > 0.22 ? 1 : 0) : s.calm ? 1 : 0;
    if (s.act && p > 0.22 && p < 0.32 && Math.sin(s.t * 70) < 0) on = 0.35;
    const hop = s.act ? -14 * Math.abs(Math.sin(seg(p, 0.5, 0.9) * Math.PI * 2)) : 0;
    const glowK = s.calm ? 0.85 + 0.15 * Math.sin(s.r * 2) : 1;
    // glow and light cone
    if (on > 0) {
      ctx.save();
      ctx.globalAlpha = on;
      const g = ctx.createRadialGradient(0, -50, 20, 0, -50, 175 * glowK);
      g.addColorStop(0, 'rgba(255,236,140,0.75)');
      g.addColorStop(1, 'rgba(255,236,140,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-180, -225, 360, 360);
      ctx.fillStyle = 'rgba(255,240,150,0.45)';
      ctx.beginPath();
      ctx.moveTo(-88, -18 + hop);
      ctx.lineTo(88, -18 + hop);
      ctx.lineTo(140, 128);
      ctx.lineTo(-140, 128);
      ctx.closePath();
      ctx.fill();
      for (let i = 0; i < 9; i++) {
        const a = Math.PI + 0.15 + (i / 8) * (Math.PI - 0.3);
        const r1 = 118 + 6 * Math.sin(s.t * 6 + i);
        line(ctx, [[Math.cos(a) * r1, -70 + hop + Math.sin(a) * r1], [Math.cos(a) * (r1 + 20), -70 + hop + Math.sin(a) * (r1 + 20)]], 6, '#ffb92e');
      }
      ctx.restore();
    }
    // base and stem
    oval(ctx, 0, 128, 62, 15);
    fs(ctx, shade(ctx, 0, 128, 62, '#c9a14a'));
    ctx.save();
    ctx.translate(0, hop);
    limb(ctx, [[0, 118 - hop], [0, -20]], 14, '#d8b25a');
    oval(ctx, 0, 60 - hop * 0.5, 13, 10);
    fs(ctx, '#d8b25a', 4.5);
    // pull chain
    line(ctx, [[62, -18], [62, 28 + pull]], 3, '#8a8f9c');
    oval(ctx, 62, 34 + pull, 7, 7);
    fs(ctx, '#e94f64', 3.5);
    // shade
    ctx.beginPath();
    ctx.moveTo(-50, -125);
    ctx.lineTo(50, -125);
    ctx.quadraticCurveTo(57, -125, 59, -118);
    ctx.lineTo(98, -30);
    ctx.quadraticCurveTo(102, -18, 90, -18);
    ctx.lineTo(-90, -18);
    ctx.quadraticCurveTo(-102, -18, -98, -30);
    ctx.lineTo(-59, -118);
    ctx.quadraticCurveTo(-57, -125, -50, -125);
    ctx.closePath();
    fs(ctx, shade(ctx, 0, -72, 100, on > 0.5 ? '#ffe27a' : '#5cb8c4'));
    rrect(ctx, -100, -30, 200, 14, 7);
    fs(ctx, on > 0.5 ? '#ffb92e' : '#3f8f9a', 4.5);
    shine(ctx, -40, -100, 8, 16, 0.4, 0.5);
    // face
    const surprised = s.act && p > 0.24 && p < 0.48;
    const happy = s.act && p >= 0.48;
    if (happy) {
      happyEye(ctx, -26, -76, 13);
      happyEye(ctx, 26, -76, 13);
    } else {
      const lk = s.act && p < 0.24 ? 1 : 0.1;
      eye(ctx, -26, -76, surprised ? 15 : 13, s.open, lk, lk);
      eye(ctx, 26, -76, surprised ? 15 : 13, s.open, lk, lk);
    }
    cheek(ctx, -48, -52, 9);
    cheek(ctx, 48, -52, 9);
    if (surprised) oMouth(ctx, 0, -50, 8);
    else if (happy || s.calm) openMouth(ctx, 0, -54, 28, 10);
    else smile(ctx, 0, -50, 28, 5);
    ctx.restore();
  },
};

const krone: Picto = {
  anim: 3,
  draw(ctx, t, alive) {
    const s = st(t, alive, 3);
    const p = s.p;
    const proud = s.act ? smooth(seg(p, 0, 0.25)) * (1 - 0.6 * seg(p, 0.85, 1)) : s.calm ? 0.4 : 0;
    const hop = s.act ? -22 * Math.abs(Math.sin(seg(p, 0.6, 0.92) * Math.PI * 2)) : s.calm ? -3 * (1 + s.br) : 0;
    const sc = 1 + 0.1 * proud;
    const body = () => {
      ctx.beginPath();
      ctx.moveTo(-110, 48);
      ctx.lineTo(-124, -66);
      ctx.lineTo(-88, -14);
      ctx.lineTo(-62, -98);
      ctx.lineTo(-30, -30);
      ctx.lineTo(0, -122);
      ctx.lineTo(30, -30);
      ctx.lineTo(62, -98);
      ctx.lineTo(88, -14);
      ctx.lineTo(124, -66);
      ctx.lineTo(110, 48);
      ctx.closePath();
    };
    ctx.save();
    ctx.translate(0, hop + 10);
    ctx.translate(0, 80);
    ctx.rotate(-0.08 * proud);
    ctx.scale(sc, sc);
    ctx.translate(0, -80);
    const gold = ctx.createLinearGradient(0, -120, 0, 60);
    gold.addColorStop(0, '#fff3a8');
    gold.addColorStop(1, '#f2b705');
    body();
    ctx.fillStyle = gold;
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.lineWidth = LW;
    ctx.strokeStyle = INK;
    ctx.stroke();
    // shine sweeping over the gold
    const sw = s.act ? seg(p, 0.28, 0.62) : 0;
    if (sw > 0 && sw < 1) {
      ctx.save();
      body();
      ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      const x = -170 + sw * 340;
      ctx.moveTo(x, -130);
      ctx.lineTo(x + 30, -130);
      ctx.lineTo(x - 30, 60);
      ctx.lineTo(x - 60, 60);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // pearls on the tips
    for (const [x, y] of [[-124, -66], [-62, -98], [0, -122], [62, -98], [124, -66]] as Pt[]) {
      oval(ctx, x, y, 11, 11);
      fs(ctx, shade(ctx, x, y, 11, '#fff8f0'), 4);
    }
    // band with gems
    rrect(ctx, -120, 40, 240, 46, 14);
    fs(ctx, shade(ctx, 0, 55, 130, '#f0a800'));
    oval(ctx, 0, 63, 15, 13);
    fs(ctx, shade(ctx, 0, 63, 15, '#ff4f81'), 4);
    for (const [x, c] of [[-50, '#3fc1ff'], [50, '#3fc1ff'], [-95, '#5fd36a'], [95, '#5fd36a']] as [number, string][]) {
      oval(ctx, x, 63, 10, 10);
      fs(ctx, shade(ctx, x, 63, 10, c), 3.5);
    }
    shine(ctx, -85, 50, 20, 4, 0, 0.5);
    // face
    if (s.act && p < 0.3) {
      happyEye(ctx, -34, -2, 14);
      happyEye(ctx, 34, -2, 14);
    } else {
      eye(ctx, -34, -2, 14, s.open, 0, 0);
      eye(ctx, 34, -2, 14, s.open, 0, 0);
    }
    cheek(ctx, -58, 18, 10);
    cheek(ctx, 58, 18, 10);
    if (s.act && p > 0.55) openMouth(ctx, 0, 16, 30, 11);
    else smile(ctx, 0, 22, 30, 5);
    ctx.restore();
    // sparkles bursting around
    if (s.act || s.calm)
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + 0.3;
        const k = s.act ? hump(p, 0.35 + i * 0.05, 0.75 + i * 0.05) : Math.max(0, Math.sin(s.r * 2 + i * 1.7));
        const d = s.act ? 120 + 45 * seg(p, 0.35 + i * 0.05, 0.75 + i * 0.05) : 155;
        sparkle(ctx, Math.cos(a) * d, -20 + Math.sin(a) * d * 0.85, 15 * k);
      }
  },
};

function bee(ctx: C, x: number, y: number, t: number, face: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(face * 1.35, 1.35);
  const flap = 0.6 + 0.4 * Math.sin(t * 50);
  ctx.globalAlpha = 0.85;
  oval(ctx, -4, -13, 9, 12 * flap, -0.4);
  fs(ctx, '#eaf6ff', 2.5);
  oval(ctx, 6, -13, 8, 11 * flap, 0.3);
  fs(ctx, '#eaf6ff', 2.5);
  ctx.globalAlpha = 1;
  const body = () => oval(ctx, 0, 0, 17, 12);
  body();
  fs(ctx, '#ffd23f', 3.5);
  ctx.save();
  body();
  ctx.clip();
  ctx.fillStyle = INK;
  ctx.fillRect(-8, -14, 5, 28);
  ctx.fillRect(2, -14, 5, 28);
  ctx.restore();
  body();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = INK;
  ctx.stroke();
  oval(ctx, 11, -3, 3, 3);
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.restore();
}

const blume: Picto = {
  anim: 4,
  draw(ctx, t, alive) {
    const s = st(t, alive, 4);
    const p = s.p;
    const look = s.act ? Math.sin(seg(p, 0, 0.45) * TAU) : 0;
    const sway = s.act ? -0.1 * look : s.calm ? 0.05 * Math.sin(s.r * 1.2) : 0;
    // bee
    let bx = 0;
    let by = 0;
    let bk = 0;
    let bface = 1;
    if (s.act && p > 0.42) {
      const q = seg(p, 0.42, 1);
      const a = q * TAU * 1.4;
      const R = 140 - 35 * q;
      bx = Math.cos(a) * R;
      by = -60 + Math.sin(a) * R * 0.55;
      bk = backOut(seg(p, 0.42, 0.5));
      bface = Math.sin(a) > 0 ? -1 : 1;
    } else if (s.calm) {
      const a = TAU * 1.4 + s.r * 1.3;
      bx = Math.cos(a) * 105;
      by = -60 + Math.sin(a) * 105 * 0.55;
      bk = 1;
      bface = Math.sin(a) > 0 ? -1 : 1;
    }
    const beeBehind = bk > 0 && by < -60;
    if (beeBehind) bee(ctx, bx, by, s.t, bface);
    // grass
    ctx.beginPath();
    ctx.moveTo(-110, 140);
    for (let i = 0; i < 10; i++) {
      const x = -110 + i * 22;
      ctx.quadraticCurveTo(x + 4, 122, x + 11 + (i % 2 ? 5 : -5), 102 + (i % 3) * 7);
      ctx.quadraticCurveTo(x + 16, 124, x + 22, 140);
    }
    ctx.closePath();
    fs(ctx, '#5fc45a', 4.5);
    ctx.save();
    ctx.translate(0, 135);
    ctx.rotate(sway);
    ctx.translate(0, -135);
    limb(ctx, [[0, 135], [8, 40], [0, -40]], 13, '#4fb848');
    leaf(ctx, 4, 80, 58, -0.5);
    leaf(ctx, 2, 60, 55, Math.PI + 0.45);
    // flower head
    const hx = 0;
    const hy = -58;
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(0.15 * look);
    const pet = () => {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + 0.2;
        ctx.save();
        oval(ctx, Math.cos(a) * 52, Math.sin(a) * 52, 33, 22, a);
        ctx.restore();
        ctx.lineWidth = LW;
        ctx.strokeStyle = INK;
        ctx.stroke();
        ctx.fillStyle = shade(ctx, Math.cos(a) * 52, Math.sin(a) * 52, 33, '#ff7eb6');
        ctx.fill();
      }
    };
    pet();
    oval(ctx, 0, 0, 42, 42);
    fs(ctx, shade(ctx, 0, 0, 42, '#ffd23f'));
    const lx = bk > 0 ? Math.max(-1, Math.min(1, bx / 100)) : look;
    const ly = bk > 0 ? Math.max(-1, Math.min(1, (by - hy) / 60)) : 0.1;
    if (s.act && p > 0.5 && p < 0.6) {
      happyEye(ctx, -15, -6, 10);
      happyEye(ctx, 15, -6, 10);
    } else {
      eye(ctx, -15, -6, 10, s.open, lx, ly);
      eye(ctx, 15, -6, 10, s.open, lx, ly);
    }
    cheek(ctx, -27, 10, 7);
    cheek(ctx, 27, 10, 7);
    if (s.act && p < 0.42) oMouth(ctx, 0, 18, 6);
    else if (bk > 0) openMouth(ctx, 0, 12, 22, 8);
    else smile(ctx, 0, 16, 22, 4.5);
    ctx.restore();
    ctx.restore();
    if (bk > 0 && !beeBehind) {
      ctx.save();
      ctx.translate(bx, by);
      ctx.scale(bk, bk);
      bee(ctx, 0, 0, s.t, bface);
      ctx.restore();
    }
  },
};

const rad: Picto = {
  anim: 3,
  draw(ctx, t, alive) {
    const s = st(t, alive, 3);
    const p = s.p;
    const red = '#e8443a';
    const dx = s.act ? 32 * Math.sin(seg(p, 0, 0.55) * TAU) : 0;
    const hop = s.act ? -24 * hump(p, 0.22, 0.36) : 0;
    const ring = s.act ? hump(p, 0.55, 0.9) : s.calm ? (s.r % 4 < 0.6 ? hump(s.r % 4, 0, 0.6) : 0) : 0;
    const rot = s.act ? dx / 55 + s.t * 3 : s.calm ? 0.08 * Math.sin(s.r * 1.5) : 0;
    // speed lines
    if (s.act && p < 0.55) {
      const v = Math.cos(seg(p, 0, 0.55) * TAU);
      ctx.save();
      ctx.globalAlpha = Math.abs(v);
      const side = v > 0 ? -1 : 1;
      for (let i = 0; i < 3; i++) line(ctx, [[dx + side * 150, -10 + i * 30], [dx + side * (150 + 26), -10 + i * 30]], 5, '#8a8f9c');
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    oval(ctx, dx, 126, 150, 8);
    ctx.fill();
    ctx.save();
    ctx.translate(dx, hop);
    const RH: Pt = [-85, 66];
    const FH: Pt = [85, 66];
    const BB: Pt = [-5, 70];
    const ST: Pt = [-25, -25];
    const HT: Pt = [55, -30];
    const HB: Pt = [62, -8];
    // wheels
    const wh = (c: Pt) => {
      oval(ctx, c[0], c[1], 55, 55);
      ctx.lineWidth = 16;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.lineWidth = 9;
      ctx.strokeStyle = '#4a4550';
      ctx.stroke();
      oval(ctx, c[0], c[1], 46, 46);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#b8bcc6';
      ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const a = rot + (i / 8) * Math.PI;
        line(ctx, [[c[0] - Math.cos(a) * 45, c[1] - Math.sin(a) * 45], [c[0] + Math.cos(a) * 45, c[1] + Math.sin(a) * 45]], 2, '#b8bcc6');
      }
      oval(ctx, c[0], c[1], 7, 7);
      fs(ctx, '#d6d9e0', 3);
    };
    wh(RH);
    wh(FH);
    // frame
    limb(ctx, [BB, RH], 8, red, 4);
    limb(ctx, [ST, RH], 8, red, 4);
    limb(ctx, [BB, ST], 10, red, 4);
    limb(ctx, [BB, HB], 11, red, 4);
    limb(ctx, [[ST[0] + 3, ST[1] + 6], [HT[0] - 2, HT[1] + 6]], 10, red, 4);
    limb(ctx, [HB, FH], 8, '#b8bcc6', 4);
    limb(ctx, [HT, HB], 12, red, 4);
    // saddle and post
    limb(ctx, [ST, [-30, -40]], 6, '#8a8f9c', 3);
    ctx.beginPath();
    ctx.moveTo(-58, -46);
    ctx.quadraticCurveTo(-36, -58, -6, -46);
    ctx.quadraticCurveTo(-30, -36, -58, -46);
    ctx.closePath();
    fs(ctx, '#5a3e36', 4.5);
    // handlebar and grip
    limb(ctx, [HT, [50, -55]], 6, '#8a8f9c', 3);
    limb(ctx, [[34, -58], [52, -58], [70, -50]], 6, '#8a8f9c', 3);
    limb(ctx, [[26, -60], [38, -60]], 10, '#3b3a4a', 3);
    // bell
    ctx.save();
    ctx.translate(62, -66);
    ctx.rotate(ring * 0.4 * Math.sin(s.t * 45));
    ctx.beginPath();
    ctx.arc(0, 0, 11, Math.PI, 0);
    ctx.closePath();
    fs(ctx, shade(ctx, 0, -4, 11, '#ffd23f'), 3.5);
    ctx.restore();
    // front lamp with a face
    oval(ctx, 74, -26, 11, 11);
    fs(ctx, shade(ctx, 74, -26, 11, '#fff3a0'), 3.5);
    // crank and pedals
    const ca = s.t * (s.act ? 8 : 0);
    const px = BB[0] + Math.cos(ca) * 20;
    const py = BB[1] + Math.sin(ca) * 20;
    oval(ctx, BB[0], BB[1], 13, 13);
    fs(ctx, '#d6d9e0', 3.5);
    line(ctx, [BB, [px, py]], 5, '#6a6f7c');
    rrect(ctx, px - 11, py - 4, 22, 8, 3);
    fs(ctx, '#3b3a4a', 3);
    ctx.restore();
    if (ring > 0.05) soundArcs(ctx, dx + 62, hop - 72, -Math.PI / 2 + 0.3, ring, '#e0a000');
  },
};

const ameise: Picto = {
  anim: 4,
  draw(ctx, t, alive) {
    const s = st(t, alive, 4);
    const p = s.p;
    const col = '#8e3b2e';
    const carry = s.act ? smooth(seg(p, 0, 0.15)) : s.calm ? 1 : 0;
    const pop = s.act ? backOut(seg(p, 0.02, 0.18)) : s.calm ? 1 : 0;
    const strain = s.act ? hump(p, 0.18, 0.55) : 0;
    const lift = s.act ? smooth(seg(p, 0.5, 0.65)) : s.calm ? 1 : 0;
    const jit = strain * 3 * Math.sin(s.t * 50);
    const by = 8 * strain - 6 * lift + (s.calm ? -1.5 * s.br : 0);
    const cookY = -92 + by - 18 * lift + 4 * strain;
    const cookWob = s.act ? 0.12 * Math.sin(s.t * 7) * seg(p, 0.5, 0.7) * (1 - seg(p, 0.85, 1)) : s.calm ? 0.04 * Math.sin(s.r * 1.6) : 0;
    ctx.save();
    ctx.translate(jit, 0);
    // legs (back pair and middle pair stay on the ground)
    const legs: [Pt, Pt, Pt][] = [
      [[-18, 34 + by], [-48, 62], [-64, 112]],
      [[-4, 38 + by], [6, 72], [0, 112]],
    ];
    for (const l of legs) limb(ctx, l, 8, tone(col, -0.2), 4);
    // front pair: on the ground or (behind the head) holding up the cookie
    const lerpPt = (a: Pt, b: Pt, k: number): Pt => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    const cookX = 62;
    const front: [Pt, Pt, Pt] = [
      [10, 34 + by],
      lerpPt([40, 62], [16, -20 + by], carry),
      lerpPt([62, 112], [cookX - 30, cookY + 36], carry),
    ];
    const front2: [Pt, Pt, Pt] = [
      [18, 36 + by],
      lerpPt([52, 66], [112, -10 + by], carry),
      lerpPt([78, 112], [cookX + 32, cookY + 36], carry),
    ];
    const raised = carry > 0.5;
    limb(ctx, front, 8, tone(col, -0.2), 4);
    if (raised) limb(ctx, front2, 8, col, 4);
    // antennae
    const aw = s.calm ? 0.1 * Math.sin(s.r * 3) : s.act ? 0.15 * Math.sin(s.t * 9) : 0;
    const ant = (bx: number, sgn: number) => {
      const tip: Pt = [bx + 26 + sgn * 18 + aw * 40, -100 + by + aw * 10];
      line(ctx, [[bx, -28 + by], [bx + sgn * 6, -72 + by], tip], 5);
      oval(ctx, tip[0], tip[1], 7, 7);
      fs(ctx, '#ff7eb6', 3.5);
    };
    ant(56, -1);
    ant(78, 1);
    // abdomen, waist, thorax
    oval(ctx, -76, 36 + by, 54, 40, -0.15);
    fs(ctx, shade(ctx, -76, 36 + by, 54, col));
    shine(ctx, -95, 18 + by, 14, 7, -0.4, 0.45);
    line(ctx, [[-100, 26 + by], [-94, 52 + by]], 3, tone(col, -0.35));
    line(ctx, [[-78, 18 + by], [-70, 58 + by]], 3, tone(col, -0.35));
    oval(ctx, -26, 34 + by, 11, 10);
    fs(ctx, col, 5);
    oval(ctx, 6, 28 + by, 30, 22);
    fs(ctx, shade(ctx, 6, 28 + by, 30, col));
    // head
    oval(ctx, 66, 2 + by, 40, 37);
    fs(ctx, shade(ctx, 66, 2 + by, 40, col));
    line(ctx, [[100, 22 + by], [110, 30 + by], [102, 36 + by]], 4.5);
    if (strain > 0.3) {
      squeezeEye(ctx, 54, -4 + by, 11, 1);
      squeezeEye(ctx, 82, -4 + by, 11, -1);
    } else if (s.act && p > 0.65) {
      happyEye(ctx, 54, -4 + by, 11);
      happyEye(ctx, 82, -4 + by, 11);
    } else {
      const up = carry > 0.5 ? -0.8 : 0.1;
      eye(ctx, 54, -4 + by, 11, s.open, 0.3, up);
      eye(ctx, 82, -4 + by, 11, s.open, 0.3, up);
    }
    cheek(ctx, 46, 18 + by, 8, 0.45 + 0.35 * strain);
    cheek(ctx, 92, 16 + by, 7, 0.45 + 0.35 * strain);
    if (strain > 0.3) line(ctx, [[60, 22 + by], [80, 22 + by]], 4.5);
    else smile(ctx, 70, 24 + by, 20, 4);
    // the big cookie
    if (carry > 0) {
      ctx.save();
      ctx.translate(cookX, cookY);
      ctx.rotate(cookWob);
      ctx.scale(pop, pop);
      oval(ctx, 0, 0, 54, 40);
      fs(ctx, shade(ctx, 0, 0, 54, '#e0a85a'));
      for (const [x, y] of [[-26, -10], [8, -20], [28, 4], [-6, 12], [-32, 14], [18, 22]] as Pt[]) {
        oval(ctx, x, y, 6, 5);
        ctx.fillStyle = '#5a3020';
        ctx.fill();
      }
      shine(ctx, -24, -22, 12, 6, -0.3, 0.4);
      ctx.restore();
      // the little hands on the cookie
      for (const h of [front[2], front2[2]]) {
        oval(ctx, h[0], h[1], 8, 7);
        fs(ctx, col, 4);
      }
    }
    if (!raised) limb(ctx, front2, 8, col, 4);
    // sweat drop
    if (strain > 0.4) {
      oval(ctx, 108, -18 + by + (s.t * 40) % 20, 4, 6);
      fs(ctx, '#9fd8ff', 2, '#4a86c0');
    }
    ctx.restore();
    if (s.act && p > 0.65) {
      const k = hump(p, 0.65, 1);
      sparkle(ctx, -40, -100, 14 * k);
      sparkle(ctx, 140, -120, 12 * k);
    }
  },
};

const baer: Picto = {
  anim: 4,
  draw(ctx, t, alive) {
    const s = st(t, alive, 4);
    const p = s.p;
    const fur = '#a0663a';
    const light = '#ecc59a';
    const potUp = s.act ? smooth(seg(p, 0, 0.2)) * (1 - smooth(seg(p, 0.7, 0.85))) : 0;
    const dip = s.act ? seg(p, 0.25, 0.4) : 0;
    const toMouth = s.act ? smooth(seg(p, 0.4, 0.5)) * (1 - smooth(seg(p, 0.7, 0.8))) : 0;
    const licking = s.act && p > 0.48 && p < 0.72;
    const happy = s.act && p > 0.48;
    const sway = s.act ? 0.06 * Math.sin(seg(p, 0.72, 1) * TAU * 1.5) : s.calm ? 0.025 * Math.sin(s.r * 1.3) : 0;
    const potX = 0;
    const potY = 72 - 40 * potUp;
    ctx.save();
    ctx.translate(0, 140);
    ctx.rotate(sway);
    ctx.translate(0, -140);
    ctx.translate(0, -s.br * 1.5);
    // feet
    for (const sx of [-1, 1]) {
      oval(ctx, sx * 58, 128, 30, 17);
      fs(ctx, shade(ctx, sx * 58, 128, 30, fur));
      oval(ctx, sx * 58, 128, 14, 9);
      ctx.fillStyle = light;
      ctx.fill();
    }
    oval(ctx, 0, 62, 90, 72);
    fs(ctx, shade(ctx, 0, 62, 90, fur));
    oval(ctx, 0, 76, 56, 50);
    ctx.fillStyle = light;
    ctx.fill();
    // ears and head
    for (const sx of [-1, 1]) {
      oval(ctx, sx * 52, -108, 25, 25);
      fs(ctx, shade(ctx, sx * 52, -108, 25, fur));
      oval(ctx, sx * 52, -106, 13, 13);
      ctx.fillStyle = light;
      ctx.fill();
    }
    const hy = -52 + 6 * potUp * (1 - toMouth);
    oval(ctx, 0, hy, 70, 64);
    fs(ctx, shade(ctx, 0, hy, 70, fur));
    oval(ctx, 0, hy + 24, 34, 25);
    fs(ctx, light, 4);
    oval(ctx, 0, hy + 13, 13, 9);
    fs(ctx, '#3b2a3a', 3);
    shine(ctx, -4, hy + 10, 4, 2, 0, 0.7);
    line(ctx, [[0, hy + 22], [0, hy + 28]], 4);
    if (licking) {
      const lx = 8 * Math.sin(s.t * 14);
      oval(ctx, lx, hy + 38, 10, 8);
      fs(ctx, '#ff8fa8', 3.5);
    }
    smile(ctx, -8, hy + 32, 16, 4);
    smile(ctx, 8, hy + 32, 16, 4);
    if (happy) {
      happyEye(ctx, -27, hy - 12, 11);
      happyEye(ctx, 27, hy - 12, 11);
    } else {
      const ly = potUp > 0.3 ? 1 : 0.1;
      eye(ctx, -27, hy - 12, 11, s.open, 0, ly);
      eye(ctx, 27, hy - 12, 11, s.open, 0, ly);
    }
    cheek(ctx, -46, hy + 14, 10);
    cheek(ctx, 46, hy + 14, 10);
    // honey pot
    oval(ctx, potX, potY + 4, 44, 38);
    fs(ctx, shade(ctx, potX, potY, 44, '#d98b2b'));
    rrect(ctx, potX - 40, potY - 40, 80, 18, 8);
    fs(ctx, '#c47a20', 5);
    ctx.beginPath();
    ctx.moveTo(potX - 36, potY - 24);
    ctx.quadraticCurveTo(potX - 30, potY - 6, potX - 24, potY - 22);
    ctx.quadraticCurveTo(potX - 12, potY + 4, potX, potY - 22);
    ctx.quadraticCurveTo(potX + 18, potY - 2, potX + 26, potY - 22);
    ctx.lineTo(potX + 36, potY - 24);
    ctx.lineTo(potX + 36, potY - 30);
    ctx.lineTo(potX - 36, potY - 30);
    ctx.closePath();
    fs(ctx, '#ffc83d', 3.5);
    oval(ctx, potX, potY - 40, 30, 7);
    fs(ctx, '#ffc83d', 3.5);
    shine(ctx, potX - 22, potY - 6, 8, 12, 0.2, 0.4);
    // arms (the right one dips into the honey and to the mouth)
    limb(ctx, [[-72, 10], [-72, potY + 4], [-42, potY + 6]], 32, fur);
    oval(ctx, -40, potY + 6, 17, 16);
    fs(ctx, shade(ctx, -40, potY + 6, 17, fur), 5);
    const rest: Pt = [42, potY + 6];
    const inPot: Pt = [14, potY - 40];
    const mouth: Pt = [26, hy + 34];
    const k1 = Math.sin(dip * Math.PI) * (toMouth > 0 ? 0 : 1);
    let hand: Pt = [rest[0] + (inPot[0] - rest[0]) * k1, rest[1] + (inPot[1] - rest[1]) * k1];
    hand = [hand[0] + (mouth[0] - hand[0]) * toMouth, hand[1] + (mouth[1] - hand[1]) * toMouth];
    limb(ctx, [[72, 10], [80, (10 + hand[1]) / 2 + 20], hand], 32, fur);
    oval(ctx, hand[0], hand[1], 17, 16);
    fs(ctx, shade(ctx, hand[0], hand[1], 17, fur), 5);
    if (s.act && p > 0.33 && p < 0.72) {
      oval(ctx, hand[0] - 4, hand[1] - 8, 11, 8);
      fs(ctx, '#ffc83d', 3);
    }
    ctx.restore();
    if (s.act && p > 0.75) heart(ctx, 95, -120 - 30 * seg(p, 0.75, 1), 14 * hump(p, 0.75, 1));
  },
};

const melone: Picto = {
  anim: 3.5,
  draw(ctx, t, alive) {
    const s = st(t, alive, 3.5);
    const p = s.p;
    const cy = -30;
    const puffed = s.act ? smooth(seg(p, 0, 0.2)) * (1 - seg(p, 0.25, 0.3)) : 0;
    const spits = [0.28, 0.48, 0.68];
    let recoil = 0;
    for (const s0 of spits) recoil += hump(p, s0, s0 + 0.1);
    const rock = s.calm ? 0.06 * Math.sin(s.r * 1.6) : 0;
    ctx.save();
    ctx.translate(0, -recoil * 10 * (s.act ? 1 : 0));
    ctx.translate(0, 105);
    ctx.rotate(rock);
    ctx.translate(0, -105);
    const half = (r: number) => {
      ctx.beginPath();
      ctx.moveTo(-r, cy);
      ctx.arc(0, cy, r, 0, Math.PI, false);
      ctx.closePath();
    };
    // the arc goes from right (0) to left (pi) through the bottom
    half(136);
    fs(ctx, shade(ctx, 0, 30, 140, '#3fa34d'));
    half(122);
    ctx.fillStyle = '#d8f0a0';
    ctx.fill();
    half(112);
    ctx.fillStyle = shade(ctx, 0, 0, 120, '#ff5a6e');
    ctx.fill();
    half(136);
    ctx.lineWidth = LW;
    ctx.strokeStyle = INK;
    ctx.lineJoin = 'round';
    ctx.stroke();
    // rind stripes
    for (let i = 1; i < 8; i++) {
      const a = (i / 8) * Math.PI;
      line(ctx, [[Math.cos(a) * 124, cy + Math.sin(a) * 124], [Math.cos(a) * 134, cy + Math.sin(a) * 134]], 4, '#2a7a36');
    }
    // seeds
    const seeds: Pt[] = [[-85, 2], [85, 2], [-62, 42], [62, 42], [-26, 66], [26, 66], [-98, -14], [98, -14]];
    for (const [x, y] of seeds) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.atan2(y - cy, x) - Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.quadraticCurveTo(6, 2, 0, 7);
      ctx.quadraticCurveTo(-6, 2, 0, -8);
      ctx.fillStyle = '#2a1d33';
      ctx.fill();
      ctx.restore();
    }
    shine(ctx, -60, -12, 16, 6, 0.1, 0.4);
    // face
    const sq = s.act && p < 0.28;
    if (sq) {
      squeezeEye(ctx, -32, -2, 13, 1);
      squeezeEye(ctx, 32, -2, 13, -1);
    } else {
      eye(ctx, -32, -2, 13, s.open, 0, 0.1);
      eye(ctx, 32, -2, 13, s.open, 0, 0.1);
    }
    cheek(ctx, -52, 20, 10 + 6 * puffed, 0.5 + 0.3 * puffed);
    cheek(ctx, 52, 20, 10 + 6 * puffed, 0.5 + 0.3 * puffed);
    let spitting = false;
    for (const s0 of spits) if (s.act && p > s0 && p < s0 + 0.06) spitting = true;
    if (spitting) oMouth(ctx, 0, 26, 9);
    else if (puffed > 0.2) {
      oval(ctx, 0, 26, 6, 4);
      fs(ctx, '#7a2340', 3);
    } else smile(ctx, 0, 28, 30, 5);
    ctx.restore();
    // flying seeds
    if (s.act)
      spits.forEach((s0, i) => {
        const q = seg(p, s0, s0 + 0.3);
        if (q <= 0 || q >= 1) return;
        const dir = i === 1 ? 1 : i === 0 ? -1 : 0.6;
        const x = dir * q * 180;
        const y = 22 - 260 * q + 200 * q * q;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(q * 12);
        ctx.beginPath();
        ctx.moveTo(0, -15);
        ctx.quadraticCurveTo(11, 3, 0, 13);
        ctx.quadraticCurveTo(-11, 3, 0, -15);
        fs(ctx, '#2a1d33', 3, '#ffffff');
        ctx.restore();
        line(ctx, [[x - dir * 18, y + 6], [x - dir * 34, y + 12]], 3.5, 'rgba(59,42,58,0.5)');
        if (q < 0.3) puff(ctx, dir * 26, 18, 9 * (1 - q / 0.3), '#ffffff', 0.8);
      });
  },
};

const schaf: Picto = {
  anim: 3,
  draw(ctx, t, alive) {
    const s = st(t, alive, 3);
    const p = s.p;
    const face = '#5a4a55';
    const hop = s.act ? -42 * Math.abs(Math.sin(seg(p, 0, 0.55) * Math.PI * 2)) : 0;
    const land = s.act ? hump(p, 0.22, 0.3) + hump(p, 0.5, 0.58) : 0;
    const fluff = 1 + (s.act ? 0.16 * smooth(seg(p, 0.55, 0.7)) - 0.08 * seg(p, 0.85, 1) : s.calm ? 0.08 + 0.02 * s.br : 0);
    const maeh = s.act ? hump(p, 0.6, 0.92) : 0;
    ctx.save();
    ctx.translate(0, hop);
    ctx.translate(0, 130);
    ctx.scale(1 + 0.08 * land, 1 - 0.1 * land);
    ctx.translate(0, -130);
    const legY = hop < -5 ? 120 : 130;
    for (const [x, d] of [[-62, -0.2], [30, -0.2], [-34, 0], [58, 0]] as Pt[]) {
      limb(ctx, [[x, 50], [x + (hop < -5 ? 6 : 0), legY]], 17, tone(face, d));
      oval(ctx, x + 2, legY + 3, 11, 6);
      fs(ctx, '#2e2530', 3);
    }
    // tail and fluffy body
    bumpy(ctx, -112, 0, 20 * fluff, 18 * fluff, 5, 0.3);
    fs(ctx, '#fbf8f2');
    ctx.save();
    ctx.translate(-10, 18);
    ctx.scale(fluff, fluff);
    bumpy(ctx, 0, 0, 100, 60, 14, 0.12, s.t * 0.3);
    const g = ctx.createLinearGradient(0, -60, 0, 60);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#d9d4e6');
    fs(ctx, g);
    for (const [x, y] of [[-50, -10], [-10, 15], [35, -15], [-30, 30], [20, 30]] as Pt[]) {
      ctx.beginPath();
      ctx.arc(x, y, 10, 0.6, 4.6);
      ctx.strokeStyle = 'rgba(160,150,190,0.6)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.restore();
    // head
    const hx = 94;
    const hy = -30;
    oval(ctx, hx - 32, hy - 10, 24, 10, -0.5);
    fs(ctx, tone(face, 0.1), 5);
    oval(ctx, hx, hy, 36, 44, 0.25);
    fs(ctx, shade(ctx, hx, hy, 44, face));
    oval(ctx, hx + 30, hy - 18, 20, 9, 0.5);
    fs(ctx, tone(face, 0.1), 5);
    bumpy(ctx, hx - 8, hy - 42, 30 * fluff, 18 * fluff, 7, 0.3);
    fs(ctx, '#ffffff');
    if (s.act && p > 0.55 && p < 0.65) {
      happyEye(ctx, hx - 14, hy - 8, 11);
      happyEye(ctx, hx + 12, hy - 6, 11);
    } else {
      eye(ctx, hx - 14, hy - 8, 11, s.open, 0.3, 0);
      eye(ctx, hx + 12, hy - 6, 11, s.open, 0.3, 0);
    }
    cheek(ctx, hx - 22, hy + 14, 7, 0.6);
    cheek(ctx, hx + 24, hy + 14, 7, 0.6);
    if (maeh > 0.15) openMouth(ctx, hx + 6, hy + 22, 18 + 6 * maeh, 7 + 4 * maeh);
    else smile(ctx, hx + 6, hy + 26, 16, 3.5, '#ffc0d0');
    ctx.restore();
    if (maeh > 0) soundArcs(ctx, hx + 40, hy + 20 + hop, 0, maeh);
    // wool tufts floating up
    if (s.act && p > 0.6)
      for (let i = 0; i < 3; i++) {
        const q = seg(p, 0.6 + i * 0.08, 1);
        if (q <= 0 || q >= 1) continue;
        ctx.save();
        ctx.globalAlpha = 1 - q;
        bumpy(ctx, -60 + i * 50, -60 - q * 110, 12, 10, 5, 0.35);
        fs(ctx, '#ffffff', 3);
        ctx.restore();
      }
  },
};

const buch: Picto = {
  anim: 3.5,
  draw(ctx, t, alive) {
    const s = st(t, alive, 3.5);
    const p = s.p;
    const flips = [0.1, 0.32, 0.54];
    let hop = 0;
    for (const f of flips) hop += hump(p, f, f + 0.2);
    hop *= s.act ? -12 : 0;
    const rest = s.calm ? (s.r % 3.5 < 0.9 ? hump(s.r % 3.5, 0, 0.9) : 0) : 0;
    ctx.save();
    ctx.translate(0, hop - (s.calm ? 1.5 * (1 + s.br) : 0));
    // cover
    rrect(ctx, -142, -72, 284, 168, 12);
    fs(ctx, shade(ctx, 0, 0, 150, '#d94a4a'));
    // page stack
    const page = (sx: number, dy: number, fill: string) => {
      ctx.beginPath();
      ctx.moveTo(0, -60 + dy);
      ctx.quadraticCurveTo(sx * 60, -84 + dy, sx * 132, -68 + dy);
      ctx.lineTo(sx * 132, 80 + dy);
      ctx.quadraticCurveTo(sx * 60, 66 + dy, 0, 88 + dy);
      ctx.closePath();
      fs(ctx, fill, 4.5);
    };
    page(-1, 6, '#ece4d4');
    page(1, 6, '#ece4d4');
    page(-1, 0, '#fffaf0');
    page(1, 0, '#fffaf0');
    // lines of "text"
    for (const sx of [-1, 1])
      for (let i = 0; i < 4; i++) {
        const y = 18 + i * 14;
        line(ctx, [[sx * 18, y + 4], [sx * 66, y - 6], [sx * 112, y]], 4, '#c9c0d8');
      }
    // ribbon
    ctx.beginPath();
    ctx.moveTo(4, 84);
    ctx.lineTo(18, 84);
    ctx.lineTo(18, 128);
    ctx.lineTo(11, 120);
    ctx.lineTo(4, 128);
    ctx.closePath();
    fs(ctx, '#4fb3ff', 4);
    // face on the pages
    const happy = s.act && p > 0.75;
    if (happy) {
      happyEye(ctx, -44, -30, 13);
      happyEye(ctx, 44, -30, 13);
    } else {
      eye(ctx, -44, -30, 13, s.open, 0, 0.1);
      eye(ctx, 44, -30, 13, s.open, 0, 0.1);
    }
    cheek(ctx, -72, -10, 10);
    cheek(ctx, 72, -10, 10);
    if (s.act) openMouth(ctx, 0, -8, 28, 10);
    else smile(ctx, 0, -6, 26, 5);
    // a page turning over
    let th = -1;
    for (const f of flips) {
      const q = seg(p, f, f + 0.2);
      if (s.act && q > 0 && q < 1) th = smooth(q) * Math.PI;
    }
    if (rest > 0) th = rest * 0.5;
    if (th >= 0) {
      const w = 132 * Math.cos(th);
      const lift = 34 * Math.sin(th);
      ctx.beginPath();
      ctx.moveTo(0, -60);
      ctx.quadraticCurveTo(w * 0.45, -84 - lift, w, -68 - lift);
      ctx.lineTo(w, 80 - lift);
      ctx.quadraticCurveTo(w * 0.45, 66 - lift, 0, 88);
      ctx.closePath();
      fs(ctx, Math.cos(th) > 0 ? '#fffaf0' : '#f4ecdc', 4.5);
    }
    ctx.restore();
    // stars and hearts flying out of the story
    if (s.act)
      for (let i = 0; i < 6; i++) {
        const q = seg(p, 0.12 + i * 0.1, 0.52 + i * 0.1);
        if (q <= 0 || q >= 1) continue;
        const x = (i % 2 ? 1 : -1) * (15 + q * (40 + i * 12));
        const y = -70 - q * 120;
        const k = Math.sin(q * Math.PI);
        if (i % 3 === 2) heart(ctx, x, y, 12 * k);
        else sparkle(ctx, x, y, 16 * k, i % 3 ? '#ffe45c' : '#9fe0ff');
      }
  },
};

const stern: Picto = {
  anim: 3,
  draw(ctx, t, alive) {
    const s = st(t, alive, 3);
    const p = s.p;
    const spin = s.act ? smooth(seg(p, 0.05, 0.6)) * TAU * (2 / 5) : s.calm ? 0.06 * Math.sin(s.r * 1.4) : 0;
    const sc = 1 + (s.act ? 0.12 * hump(p, 0.05, 0.6) : 0.03 * s.br);
    const glow = s.act ? hump(p, 0, 1) : s.calm ? 0.35 + 0.15 * Math.sin(s.r * 2.5) : 0;
    const cy = 12;
    if (glow > 0) {
      const g = ctx.createRadialGradient(0, cy, 40, 0, cy, 195);
      g.addColorStop(0, `rgba(255,236,120,${0.7 * glow})`);
      g.addColorStop(1, 'rgba(255,236,120,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-200, cy - 200, 400, 400);
    }
    ctx.save();
    ctx.translate(0, cy);
    ctx.rotate(spin);
    ctx.scale(sc, sc);
    const pts: Pt[] = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * TAU;
      const r = i % 2 ? 60 : 135;
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    ctx.beginPath();
    const m0: Pt = [(pts[9][0] + pts[0][0]) / 2, (pts[9][1] + pts[0][1]) / 2];
    ctx.moveTo(m0[0], m0[1]);
    for (let i = 0; i < 10; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % 10];
      ctx.arcTo(a[0], a[1], b[0], b[1], i % 2 ? 10 : 14);
    }
    ctx.closePath();
    fs(ctx, shade(ctx, 0, 0, 135, '#ffd23f'), 7);
    ctx.restore();
    // face (does not spin along, the star turns under it)
    ctx.save();
    ctx.translate(0, cy);
    ctx.scale(sc, sc);
    shine(ctx, -30, -42, 14, 7, -0.6, 0.6);
    const wink = s.act ? p > 0.65 : false;
    eye(ctx, -30, -6, 15, s.open, 0, 0.1);
    if (wink) happyEye(ctx, 30, -6, 15);
    else eye(ctx, 30, -6, 15, s.open, 0, 0.1);
    cheek(ctx, -50, 18, 11);
    cheek(ctx, 50, 18, 11);
    if (s.act && p < 0.65) openMouth(ctx, 0, 18, 30, 11);
    else smile(ctx, 0, 24, 30, 5);
    ctx.restore();
    if (s.act || s.calm)
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + 0.5;
        const k = s.act ? hump(p, i * 0.08, 0.45 + i * 0.08) + hump(p, 0.62, 1) * (i % 2) : Math.max(0, Math.sin(s.r * 2.2 + i * 2));
        sparkle(ctx, Math.cos(a) * 165, cy + Math.sin(a) * 160, 14 * k);
      }
  },
};

const schiff: Picto = {
  anim: 3.5,
  draw(ctx, t, alive) {
    const s = st(t, alive, 3.5);
    const p = s.p;
    const rockA = s.act ? 0.09 * Math.sin(s.t * 4) : s.calm ? 0.03 * Math.sin(s.r * 1.5) : 0;
    const bob = s.act ? 5 * Math.sin(s.t * 4 + 1) : s.calm ? 2 * Math.sin(s.r * 1.5 + 1) : 0;
    const toots = [0.12, 0.5];
    let tut = 0;
    for (const f of toots) tut = Math.max(tut, s.act ? hump(p, f, f + 0.25) : 0);
    const wave = s.t * 2;
    // smoke clouds
    const smoke: [number, number][] = [];
    if (s.act)
      for (const f of toots)
        for (let i = 0; i < 3; i++) {
          const q = seg(p, f + i * 0.06, f + i * 0.06 + 0.4);
          if (q > 0 && q < 1) smoke.push([q, i]);
        }
    for (const [q] of smoke) puff(ctx, -30 - q * 70, -105 - q * 75, 12 + q * 12, '#eef0f6', 1 - q * q);
    if (s.calm) {
      const q = (s.r * 0.35) % 1;
      puff(ctx, -30 - q * 50, -105 - q * 60, 8 + q * 8, '#eef0f6', 0.8 * (1 - q));
    }
    ctx.save();
    ctx.translate(0, bob);
    ctx.translate(0, 80);
    ctx.rotate(rockA);
    ctx.translate(0, -80);
    // mast and flag
    line(ctx, [[38, -30], [38, -110]], 5);
    const fw = 6 * Math.sin(s.t * 8);
    ctx.beginPath();
    ctx.moveTo(38, -110);
    ctx.quadraticCurveTo(58, -112 + fw, 78, -100 + fw * 0.5);
    ctx.quadraticCurveTo(58, -92 - fw, 38, -86);
    ctx.closePath();
    fs(ctx, '#ffd23f', 4);
    // funnel
    ctx.save();
    ctx.translate(-30, -35);
    ctx.scale(1 + 0.12 * tut, 1 - 0.15 * tut);
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.lineTo(-22, -62);
    ctx.lineTo(22, -62);
    ctx.lineTo(18, 0);
    ctx.closePath();
    fs(ctx, shade(ctx, 0, -30, 40, '#e94f64'));
    rrect(ctx, -24, -66, 48, 16, 5);
    fs(ctx, '#3b3a4a', 4.5);
    ctx.restore();
    // cabin with portholes
    rrect(ctx, -92, -38, 140, 54, 12);
    fs(ctx, shade(ctx, -20, -10, 90, '#ffffff'));
    for (const x of [-64, -30, 4, 30]) {
      oval(ctx, x, -12, 10, 10);
      fs(ctx, '#bfe6ff', 4);
    }
    // hull
    ctx.beginPath();
    ctx.moveTo(-132, 14);
    ctx.lineTo(152, 4);
    ctx.quadraticCurveTo(126, 96, 96, 102);
    ctx.lineTo(-100, 102);
    ctx.quadraticCurveTo(-124, 92, -132, 14);
    ctx.closePath();
    fs(ctx, shade(ctx, 0, 40, 150, '#2f63c4'));
    line(ctx, [[-128, 34], [144, 26]], 7, '#ffffff');
    // face on the bow
    if (tut > 0.3) {
      squeezeEye(ctx, 46, 50, 13, 1);
      squeezeEye(ctx, 84, 48, 13, -1);
    } else {
      eye(ctx, 46, 50, 13, s.open, 0.3, 0);
      eye(ctx, 84, 48, 13, s.open, 0.3, 0);
    }
    cheek(ctx, 28, 66, 8);
    cheek(ctx, 104, 64, 8);
    if (tut > 0.15) oMouth(ctx, 65, 72, 8);
    else smile(ctx, 65, 74, 24, 5, '#ffffff');
    // anchor-ish lifebuoy
    oval(ctx, -70, 62, 15, 15);
    ctx.lineWidth = 12;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.lineWidth = 7;
    ctx.strokeStyle = '#ff7b39';
    ctx.stroke();
    ctx.restore();
    // water in front
    ctx.beginPath();
    ctx.moveTo(-150, 140);
    for (let x = -150; x <= 150; x += 6) ctx.lineTo(x, 92 + 7 * Math.sin(x * 0.06 + wave));
    ctx.lineTo(150, 140);
    ctx.closePath();
    fs(ctx, shade(ctx, 0, 110, 150, '#4aa3df'), 5);
    line(
      ctx,
      Array.from({ length: 26 }, (_, i): Pt => [-130 + i * 10, 118 + 4 * Math.sin(i * 0.9 - wave * 1.3)]),
      3.5,
      'rgba(255,255,255,0.75)',
    );
    if (tut > 0) soundArcs(ctx, 0, -120 + bob, -0.6, tut);
  },
};

function bubble(ctx: C, x: number, y: number, r: number, a: number): void {
  if (r <= 0.5 || a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  oval(ctx, x, y, r, r);
  ctx.fillStyle = 'rgba(190,230,255,0.35)';
  ctx.fill();
  ctx.lineWidth = 3;
  const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  g.addColorStop(0, '#7fd0ff');
  g.addColorStop(0.5, '#d48cff');
  g.addColorStop(1, '#7fffd4');
  ctx.strokeStyle = g;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  oval(ctx, x - r * 0.4, y - r * 0.4, r * 0.25, r * 0.15, -0.7);
  ctx.fill();
  ctx.restore();
}

const drache: Picto = {
  anim: 3.5,
  draw(ctx, t, alive) {
    const s = st(t, alive, 3.5);
    const p = s.p;
    const green = '#5cc46a';
    const inhale = s.act ? smooth(seg(p, 0, 0.18)) * (1 - seg(p, 0.2, 0.26)) : 0;
    const blowing = s.act && p > 0.2 && p < 0.85;
    const flap = s.act ? 0.25 * Math.sin(s.t * 12) : s.calm ? 0.06 * Math.sin(s.r * 2) : 0;
    const wag = s.act ? 0.2 * Math.sin(s.t * 7) : s.calm ? 0.1 * Math.sin(s.r * 1.8) : 0;
    ctx.save();
    ctx.translate(0, -s.br * 1.5);
    // tail
    ctx.save();
    ctx.translate(-50, 100);
    ctx.rotate(wag);
    limb(ctx, [[0, 0], [-60, 20], [-92, -20]], 24, green);
    ctx.beginPath();
    ctx.moveTo(-92, -24);
    ctx.lineTo(-112, -50);
    ctx.lineTo(-80, -42);
    ctx.closePath();
    fs(ctx, '#ff8a3d', 4.5);
    ctx.restore();
    // wing behind
    ctx.save();
    ctx.translate(-30, -6);
    ctx.rotate(-flap);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-30, -100, -92, -96);
    ctx.quadraticCurveTo(-74, -72, -90, -54);
    ctx.quadraticCurveTo(-64, -52, -74, -28);
    ctx.quadraticCurveTo(-44, -30, -14, 30);
    ctx.closePath();
    fs(ctx, shade(ctx, -50, -50, 60, '#9b6bd6'));
    line(ctx, [[-6, 4], [-60, -70]], 3, tone('#9b6bd6', -0.35));
    ctx.restore();
    // feet
    for (const x of [-42, 40]) {
      oval(ctx, x, 128, 28, 14);
      fs(ctx, shade(ctx, x, 128, 28, green));
      for (let i = -1; i <= 1; i++) {
        oval(ctx, x + 14 + i * 9, 136, 4, 4);
        ctx.fillStyle = '#fff4d0';
        ctx.fill();
      }
    }
    // back spikes
    for (const [x, y, a] of [[-70, 30, -2.4], [-62, -4, -2.0], [-40, -32, -1.7], [-8, -52, -1.4]] as [number, number, number][]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.lineTo(0, 24);
      ctx.lineTo(12, 0);
      ctx.closePath();
      fs(ctx, '#ff8a3d', 4.5);
      ctx.restore();
    }
    // body and neck
    const bs = 1 + 0.05 * inhale;
    union(ctx, [() => oval(ctx, -5, 64, 72 * bs, 68 * bs), () => oval(ctx, 22, 0, 40, 50, 0.5)], shade(ctx, -5, 40, 90, green));
    oval(ctx, 22, 78, 40, 52);
    fs(ctx, '#ffe08a', 4);
    for (let i = 0; i < 4; i++) line(ctx, [[-10, 46 + i * 20], [22, 52 + i * 20], [54, 46 + i * 20]], 3, '#e0b850');
    limb(ctx, [[22, 40], [48, 56], [52, 70]], 16, green, 5);
    // horns and head
    for (const [x, a] of [[34, -0.3], [62, 0.15]] as Pt[]) {
      ctx.save();
      ctx.translate(x, -92);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(-9, 6);
      ctx.quadraticCurveTo(-4, -22, 2, -28);
      ctx.quadraticCurveTo(6, -10, 9, 6);
      ctx.closePath();
      fs(ctx, '#fff4d0', 4.5);
      ctx.restore();
    }
    union(ctx, [() => oval(ctx, 52, -56, 56, 46), () => oval(ctx, 100, -42, 36 + 6 * inhale, 28 + 4 * inhale)], shade(ctx, 60, -56, 70, green));
    oval(ctx, 120, -54, 3.5, 3.5);
    ctx.fillStyle = INK;
    ctx.fill();
    oval(ctx, 108, -56, 3.5, 3.5);
    ctx.fill();
    if (blowing) {
      happyEye(ctx, 44, -70, 13);
      happyEye(ctx, 74, -72, 13);
    } else {
      eye(ctx, 44, -70, 13, s.open, 0.4, 0);
      eye(ctx, 74, -72, 13, s.open, 0.4, 0);
    }
    cheek(ctx, 84, -36, 9 + 5 * inhale, 0.45 + 0.3 * inhale);
    if (blowing) oMouth(ctx, 128, -30, 7);
    else if (inhale > 0.2) line(ctx, [[110, -28], [126, -28]], 4.5);
    else smile(ctx, 112, -28, 26, 4.5);
    ctx.restore();
    // soap bubbles
    if (s.act)
      for (let i = 0; i < 7; i++) {
        const s0 = 0.22 + i * 0.075;
        const q = seg(p, s0, s0 + 0.42);
        if (q <= 0 || q >= 1) continue;
        const dx = (i % 2 ? 26 : -50) * q + Math.sin(q * 8 + i) * 8;
        const r = (12 + (i % 3) * 7) * Math.min(1, q * 5);
        bubble(ctx, 132 + dx, -34 - q * (120 + (i % 3) * 14), r, q > 0.85 ? (1 - q) / 0.15 : 1);
      }
    if (s.calm) {
      const q = (s.r * 0.4) % 1;
      bubble(ctx, 132 - q * 20 + Math.sin(q * 8) * 6, -34 - q * 120, 10 * Math.min(1, q * 5), q > 0.85 ? (1 - q) / 0.15 : 1);
    }
  },
};

const uhr: Picto = {
  anim: 3,
  draw(ctx, t, alive) {
    const s = st(t, alive, 3);
    const p = s.p;
    const red = '#e84a4a';
    const ringK = s.act ? hump(p, 0.05, 0.85) : 0;
    const jitter = ringK * Math.sin(s.t * 45);
    const hop = -10 * ringK * Math.abs(Math.sin(s.t * 22));
    const spinM = s.act ? smooth(p) * TAU * 6 : 0;
    const spinH = s.act ? smooth(p) * TAU : 0;
    const tick = s.calm ? Math.floor(s.r) * (TAU / 60) : 0;
    const cy = 15;
    ctx.save();
    ctx.translate(0, hop);
    ctx.translate(0, 120);
    ctx.rotate(0.07 * jitter);
    ctx.translate(0, -120);
    // legs
    for (const sx of [-1, 1]) {
      limb(ctx, [[sx * 50, 95], [sx * 62, 118]], 12, '#3b3a4a', 4);
    }
    // hammer between the bells
    const hx = 12 * jitter;
    line(ctx, [[0, -82], [hx, -114]], 5);
    oval(ctx, hx, -116, 8, 8);
    fs(ctx, '#d6d9e0', 4);
    // bells
    for (const sx of [-1, 1]) {
      ctx.save();
      ctx.translate(sx * 58, -78);
      ctx.rotate(sx * 0.6 + 0.08 * jitter);
      ctx.beginPath();
      ctx.moveTo(-34, 8);
      ctx.bezierCurveTo(-34, -38, 34, -38, 34, 8);
      ctx.closePath();
      fs(ctx, shade(ctx, 0, -10, 34, '#ffd23f'));
      oval(ctx, 0, -26, 6, 6);
      fs(ctx, '#ffd23f', 4);
      ctx.restore();
    }
    // body and dial
    oval(ctx, 0, cy, 100, 100);
    fs(ctx, shade(ctx, 0, cy, 100, red));
    oval(ctx, 0, cy, 80, 80);
    fs(ctx, '#fffdf6', 5);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      const big = i % 3 === 0;
      const r1 = big ? 62 : 67;
      line(ctx, [[Math.cos(a) * r1, cy + Math.sin(a) * r1], [Math.cos(a) * 73, cy + Math.sin(a) * 73]], big ? 6 : 4, '#6a5a70');
    }
    // hands (10 past 10, spinning wildly when alive)
    const ah = -Math.PI / 2 - Math.PI / 3 + spinH;
    const am = -Math.PI / 2 + Math.PI / 3 + spinM + tick;
    line(ctx, [[0, cy], [Math.cos(ah) * 40, cy + Math.sin(ah) * 40]], 9, '#3b2a3a');
    line(ctx, [[0, cy], [Math.cos(am) * 58, cy + Math.sin(am) * 58]], 6, '#3b2a3a');
    oval(ctx, 0, cy, 7, 7);
    fs(ctx, red, 3);
    // face
    const dizzy = s.act && p > 0.3 && p < 0.85;
    if (dizzy) {
      for (const ex of [-32, 32]) {
        ctx.beginPath();
        for (let i = 0; i <= 30; i++) {
          const a = (i / 30) * TAU * 2 + s.t * 10;
          const rr = (i / 30) * 13;
          ctx.lineTo(ex + Math.cos(a) * rr, -12 + Math.sin(a) * rr);
        }
        ctx.strokeStyle = INK;
        ctx.lineWidth = 3.5;
        ctx.stroke();
      }
    } else if (s.act && p >= 0.85) {
      happyEye(ctx, -32, -12, 13);
      happyEye(ctx, 32, -12, 13);
    } else {
      eye(ctx, -32, -12, 13, s.open, 0, 0.1);
      eye(ctx, 32, -12, 13, s.open, 0, 0.1);
    }
    cheek(ctx, -50, 22, 10);
    cheek(ctx, 50, 22, 10);
    if (ringK > 0.2) openMouth(ctx, 0, 48, 30, 11);
    else smile(ctx, 0, 52, 28, 5);
    shine(ctx, -62, -44, 10, 18, 0.6, 0.45);
    ctx.restore();
    if (ringK > 0.05) {
      soundArcs(ctx, -95, -110 + hop, -2.3, ringK);
      soundArcs(ctx, 95, -110 + hop, -0.85, ringK);
    }
  },
};

function banana(ctx: C, x: number, y: number, k: number, rot: number): void {
  if (k <= 0.01) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(k, k);
  ctx.beginPath();
  ctx.moveTo(-30, -12);
  ctx.quadraticCurveTo(-2, 30, 34, -14);
  ctx.quadraticCurveTo(38, -20, 33, -24);
  ctx.quadraticCurveTo(0, 6, -26, -20);
  ctx.closePath();
  fs(ctx, shade(ctx, 0, 0, 32, '#ffd93b'), 4.5);
  line(ctx, [[-30, -14], [-34, -22]], 6, '#6a4a2a');
  line(ctx, [[-14, 0], [14, 0]], 2.5, 'rgba(200,150,0,0.6)');
  ctx.restore();
}

const affe: Picto = {
  anim: 4,
  draw(ctx, t, alive) {
    const s = st(t, alive, 4);
    const p = s.p;
    const fur = '#8b5a3c';
    const face = '#f2d0a4';
    const search = s.act ? hump(p, 0, 0.42) : 0;
    const look = s.act && p < 0.42 ? Math.sin(seg(p, 0, 0.42) * TAU * 1.5) : 0;
    const found = s.act ? seg(p, 0.42, 0.5) : s.calm ? 1 : 0;
    const joy = s.act ? (p > 0.5 ? 1 : 0) : 0;
    const jump = s.act ? -24 * Math.abs(Math.sin(seg(p, 0.52, 0.95) * Math.PI * 2)) : 0;
    const tilt = 0.12 * look;
    ctx.save();
    ctx.translate(0, jump - s.br * 1.5);
    // tail
    const tw = s.calm ? 0.1 * Math.sin(s.r * 1.6) : s.act ? 0.15 * Math.sin(s.t * 6) : 0;
    ctx.save();
    ctx.translate(48, 110);
    ctx.rotate(tw);
    limb(ctx, [[0, 0], [62, -10], [80, -60], [56, -82], [44, -62]], 13, fur);
    ctx.restore();
    // feet and body
    for (const sx of [-1, 1]) {
      oval(ctx, sx * 40, 134, 24, 12);
      fs(ctx, face);
    }
    oval(ctx, 0, 80, 62, 56);
    fs(ctx, shade(ctx, 0, 80, 62, fur));
    oval(ctx, 0, 88, 38, 36);
    ctx.fillStyle = face;
    ctx.fill();
    // head
    ctx.save();
    ctx.translate(0, 20);
    ctx.rotate(tilt);
    ctx.translate(0, -20);
    for (const sx of [-1, 1]) {
      oval(ctx, sx * 78, -38, 27, 27);
      fs(ctx, shade(ctx, sx * 78, -38, 27, fur));
      oval(ctx, sx * 78, -38, 15, 15);
      ctx.fillStyle = face;
      ctx.fill();
    }
    oval(ctx, 0, -40, 72, 70);
    fs(ctx, shade(ctx, 0, -40, 72, fur));
    // tuft
    ctx.beginPath();
    ctx.moveTo(-16, -104);
    ctx.quadraticCurveTo(-12, -128, 0, -122);
    ctx.quadraticCurveTo(8, -136, 16, -118);
    ctx.quadraticCurveTo(20, -110, 16, -104);
    ctx.closePath();
    fs(ctx, fur, 5);
    union(ctx, [() => oval(ctx, -24, -52, 30, 30), () => oval(ctx, 24, -52, 30, 30), () => oval(ctx, 0, -12, 48, 32)], face, 2.5);
    const lx = look * 0.9;
    if (joy) {
      happyEye(ctx, -24, -52, 14);
      happyEye(ctx, 24, -52, 14);
    } else {
      eye(ctx, -24, -52, 14, s.open, lx, 0);
      eye(ctx, 24, -52, 14, s.open, lx, 0);
    }
    if (search > 0.2) {
      line(ctx, [[-36, -76], [-14, -80]], 4);
      line(ctx, [[14, -80], [36, -76]], 4);
    }
    oval(ctx, -7, -24, 3.5, 3);
    ctx.fillStyle = INK;
    ctx.fill();
    oval(ctx, 7, -24, 3.5, 3);
    ctx.fill();
    cheek(ctx, -38, -14, 9);
    cheek(ctx, 38, -14, 9);
    if (joy) openMouth(ctx, 0, -6, 40, 13);
    else if (search > 0.2) oMouth(ctx, 0, 0, 8);
    else smile(ctx, 0, -2, 40, 5);
    ctx.restore();
    // right arm scratches the head while searching
    const scratch = Math.sin(s.t * 20) * 6;
    const rHand: Pt = search > 0.05 ? [58 + scratch * search, -92 + 70 * (1 - search)] : [42, 104];
    const rMid: Pt = search > 0.05 ? [100, 10] : [76, 78];
    limb(ctx, [[48, 46], rMid, rHand], 20, fur);
    oval(ctx, rHand[0], rHand[1], 14, 13);
    fs(ctx, face, 4.5);
    // left arm: holds up the banana once found
    const up = s.act ? smooth(seg(p, 0.42, 0.52)) : s.calm ? 0.92 + 0.05 * s.br : 0;
    const lHand: Pt = [-42 - 58 * up, 104 - 180 * up];
    const lMid: Pt = [-76 - 30 * up, 78 - 50 * up];
    limb(ctx, [[-48, 46], lMid, lHand], 20, fur);
    banana(ctx, lHand[0] + 4, lHand[1] - 18, backOut(found), -0.4 + (joy ? 0.3 * Math.sin(s.t * 10) : 0));
    oval(ctx, lHand[0], lHand[1], 14, 13);
    fs(ctx, face, 4.5);
    ctx.restore();
    if (s.act && p > 0.42 && p < 0.7) {
      const k = hump(p, 0.42, 0.7);
      sparkle(ctx, -150, -110, 14 * k);
      sparkle(ctx, -60, -150, 11 * k);
    }
  },
};

export const gruppe3: Record<string, Picto> = {
  Mama: mama,
  Ast: ast,
  Nase: nase,
  Lama: lama,
  Hut: hut,
  Auto: auto,
  Nudel: nudel,
  Lampe: lampe,
  Krone: krone,
  Blume: blume,
  Rad: rad,
  Ameise: ameise,
  Bär: baer,
  Melone: melone,
  Schaf: schaf,
  Buch: buch,
  Stern: stern,
  Schiff: schiff,
  Drache: drache,
  Uhr: uhr,
  Affe: affe,
};
