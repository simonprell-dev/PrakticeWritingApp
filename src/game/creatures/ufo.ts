// "Türme bauen": the little alien in its flying saucer, its faces, hats and props, the blue tractor
// beam and the small extras of the gags (rain cloud, bird, butterfly, ...). Origin = saucer centre.
import type { Ctx } from '../canvas.ts';
import { clamp, hsl, TAU } from '../math.ts';
import type { Face, Hat, Prop } from '../tower/gags.ts';
import { crown, sparkleStar } from './parts.ts';

export interface UfoLook {
  /** colour of the pilot */
  hue: number;
  face: Face;
  hat?: Hat;
  prop?: Prop;
  propP?: number;
  /** team colour for the flag */
  flag?: string;
  /** seconds, for blinking lights and idle animation */
  t: number;
  /** eyes closed for a moment */
  blink?: boolean;
  /** Zork (the original) wears a tiny crown, clones don't */
  boss?: boolean;
}

const INK = '#2b1d45';

function line(ctx: Ctx, pts: [number, number][], w: number, color = INK): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.restore();
}

function heart(ctx: Ctx, x: number, y: number, s: number, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 20, s / 20);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 7);
  ctx.bezierCurveTo(-15, -4, -8, -16, 0, -8);
  ctx.bezierCurveTo(8, -16, 15, -4, 0, 7);
  ctx.fill();
  ctx.restore();
}

/** one eye of the pilot */
function eye(ctx: Ctx, x: number, y: number, face: Face, side: number, blink: boolean, t: number): void {
  const r = 7.5;
  if (blink || face === 'sleep') {
    line(ctx, [
      [x - r, y],
      [x, y + 3],
      [x + r, y],
    ], 2.6);
    return;
  }
  if (face === 'grin' || (face === 'wink' && side > 0)) {
    line(ctx, [
      [x - r, y + 2],
      [x, y - 5],
      [x + r, y + 2],
    ], 2.8);
    return;
  }
  if (face === 'strain') {
    line(ctx, [
      [x - r * side, y - 5],
      [x + r * side, y],
      [x - r * side, y + 5],
    ], 2.8);
    return;
  }
  if (face === 'love') {
    heart(ctx, x, y, 17 + Math.sin(t * 10) * 2, '#ff4f81');
    return;
  }
  if (face === 'dizzy') {
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let a = 0; a < TAU * 2.2; a += 0.3) {
      const rr = 1 + a * 0.9;
      const px = x + Math.cos(a + t * 8 * side) * rr;
      const py = y + Math.sin(a + t * 8 * side) * rr;
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
    return;
  }
  const big = face === 'surprised' || face === 'scared' ? 1.25 : 1;
  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x, y, r * big, r * big * (face === 'focus' || face === 'yuck' ? 0.55 : 1.1), 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  const pr = face === 'scared' ? 2.2 : face === 'focus' ? 3 : 4.2;
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(x + (face === 'confused' ? 2 * side : 1), y + (face === 'sad' ? 2 : 0.5), pr, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x - 0.5, y - 1.5, pr * 0.38, 0, TAU);
  ctx.fill();
  ctx.restore();
  if (face === 'sad')
    line(ctx, [
      [x - 7 * side, y - 9],
      [x + 6 * side, y - 13],
    ], 2.2);
  if (face === 'confused' && side > 0)
    line(ctx, [
      [x - 7, y - 14],
      [x + 7, y - 11],
    ], 2.2);
}

function mouth(ctx: Ctx, face: Face, t: number): void {
  const y = -26;
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.fillStyle = '#7a2340';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  switch (face) {
    case 'surprised':
    case 'scared':
      ctx.ellipse(0, y + 1, 4, 5.5 + (face === 'scared' ? Math.sin(t * 30) : 0), 0, 0, TAU);
      ctx.fill();
      break;
    case 'grin':
    case 'love':
      ctx.moveTo(-8, y - 2);
      ctx.quadraticCurveTo(0, y + 11, 8, y - 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    case 'strain':
      ctx.rect(-7, y - 3, 14, 6);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.stroke();
      break;
    case 'sad':
      ctx.arc(0, y + 6, 6, 1.15 * Math.PI, 1.85 * Math.PI);
      ctx.stroke();
      break;
    case 'yuck':
      ctx.moveTo(-7, y);
      ctx.lineTo(7, y - 2);
      ctx.stroke();
      ctx.fillStyle = '#ff8fa8';
      ctx.beginPath();
      ctx.ellipse(3, y + 4, 4, 5, 0.3, 0, TAU);
      ctx.fill();
      break;
    case 'dizzy':
    case 'confused':
      ctx.moveTo(-7, y);
      ctx.quadraticCurveTo(-3, y - 4, 0, y);
      ctx.quadraticCurveTo(3, y + 4, 7, y);
      ctx.stroke();
      break;
    case 'focus':
      ctx.moveTo(-6, y);
      ctx.lineTo(6, y);
      ctx.stroke();
      ctx.fillStyle = '#ff8fa8';
      ctx.beginPath();
      ctx.ellipse(6, y + 2, 3, 3.5, 0, 0, TAU);
      ctx.fill();
      break;
    case 'sleep':
      ctx.ellipse(0, y, 3, 2.5 + Math.sin(t * 3) * 1.2, 0, 0, TAU);
      ctx.stroke();
      break;
    case 'cool':
      ctx.moveTo(-6, y);
      ctx.quadraticCurveTo(2, y + 5, 8, y - 3);
      ctx.stroke();
      break;
    default:
      ctx.arc(0, y - 3, 7, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
  }
  ctx.restore();
}

function hat(ctx: Ctx, kind: Hat): void {
  ctx.save();
  if (kind === 'sunglasses') {
    ctx.fillStyle = '#15121f';
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.roundRect(sx * 10 - 9, -46, 18, 11, 4);
      ctx.fill();
    }
    ctx.fillRect(-2, -43, 4, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(-15, -44, 5, 2);
    ctx.fillRect(5, -44, 5, 2);
  } else {
    ctx.translate(4, -60);
    ctx.rotate(0.2);
    ctx.fillStyle = '#ff6fb5';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-13, 6);
    ctx.lineTo(0, -26);
    ctx.lineTo(13, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffe14d';
    for (const [x, y] of [
      [-4, -2],
      [4, -10],
      [-1, 2],
    ])
      ctx.fillRect(x, y, 4, 4);
    ctx.fillStyle = '#7cdcff';
    ctx.beginPath();
    ctx.arc(0, -27, 5, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** the arm that holds a prop, from the cockpit to (hx, hy) */
function arm(ctx: Ctx, hue: number, hx: number, hy: number): void {
  line(ctx, [
    [22, -16],
    [(22 + hx) / 2 + 6, (hy - 16) / 2 - 6],
    [hx, hy],
  ], 9, INK);
  line(ctx, [
    [22, -16],
    [(22 + hx) / 2 + 6, (hy - 16) / 2 - 6],
    [hx, hy],
  ], 5, hsl(hue, 0.6, 0.6));
  ctx.save();
  ctx.fillStyle = hsl(hue, 0.6, 0.62);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(hx, hy, 6, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function prop(ctx: Ctx, look: UfoLook): void {
  const p = look.propP ?? 0;
  const t = look.t;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  switch (look.prop) {
    case 'camera':
      arm(ctx, look.hue, 52, -40);
      ctx.translate(58, -52);
      ctx.rotate(-0.25);
      ctx.fillStyle = '#3d3d55';
      ctx.beginPath();
      ctx.roundRect(-12, -20, 24, 36, 5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#8fd3ff';
      ctx.fillRect(-8, -15, 16, 24);
      break;
    case 'map': {
      arm(ctx, look.hue, 50, -40);
      ctx.translate(62, -54);
      ctx.rotate(p);
      ctx.fillStyle = '#fff3c9';
      ctx.beginPath();
      ctx.rect(-24, -17, 48, 34);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#b07a3a';
      ctx.beginPath();
      ctx.moveTo(-18, 10);
      ctx.quadraticCurveTo(-4, -14, 14, -6);
      ctx.stroke();
      ctx.setLineDash([]);
      line(ctx, [
        [10, -11],
        [18, -1],
      ], 3, '#e5484d');
      line(ctx, [
        [18, -11],
        [10, -1],
      ], 3, '#e5484d');
      break;
    }
    case 'horn':
      arm(ctx, look.hue, 48, -36);
      ctx.translate(48, -40);
      ctx.fillStyle = '#ffcf3d';
      ctx.beginPath();
      ctx.moveTo(0, -4);
      ctx.lineTo(30, -16);
      ctx.lineTo(30, 12);
      ctx.lineTo(0, 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ff6f91';
      ctx.beginPath();
      ctx.arc(-6, 0, 8, 0, TAU);
      ctx.fill();
      ctx.stroke();
      break;
    case 'umbrella':
      arm(ctx, look.hue, 34, -44);
      line(ctx, [
        [34, -40],
        [34, -112],
      ], 4);
      ctx.fillStyle = '#ff5d8f';
      ctx.beginPath();
      ctx.moveTo(-36, -104);
      ctx.quadraticCurveTo(34, -170, 104, -104);
      for (let i = 0; i < 4; i++) ctx.quadraticCurveTo(104 - i * 35 - 17, -116, 104 - (i + 1) * 35, -104);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    case 'icecream': {
      const lick = p >= 0 && Math.sin(p * 40) > 0.4;
      arm(ctx, look.hue, lick ? 30 : 44, lick ? -30 : -38);
      ctx.translate(lick ? 30 : 44, lick ? -40 : -48);
      ctx.fillStyle = '#e9b26b';
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.lineTo(0, 26);
      ctx.lineTo(10, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (p >= 0) {
        ctx.fillStyle = '#ff9fc6';
        ctx.beginPath();
        ctx.arc(0, -6, 12, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(-4, -10, 3, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 'sponge': {
      const a = p * 40;
      const hx = Math.cos(a) * 48;
      const hy = 2 + Math.sin(a) * 6;
      arm(ctx, look.hue, hx * 0.6 + 24, hy - 4);
      ctx.translate(hx, hy);
      ctx.fillStyle = '#ffe14d';
      ctx.beginPath();
      ctx.roundRect(-14, -9, 28, 18, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(180,140,0,0.5)';
      for (const [x, y] of [
        [-6, -2],
        [4, 3],
        [7, -4],
      ]) {
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 'flag': {
      arm(ctx, look.hue, 46, -38);
      line(ctx, [
        [46, -34],
        [46, -100],
      ], 4, '#6b4e3a');
      const w = Math.sin(t * 9) * 6;
      ctx.fillStyle = look.flag ?? '#ff6f91';
      ctx.beginPath();
      ctx.moveTo(46, -100);
      ctx.quadraticCurveTo(70, -100 + w, 92, -94);
      ctx.lineTo(92, -70);
      ctx.quadraticCurveTo(70, -76 - w, 46, -74);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'tape':
      arm(ctx, look.hue, 40, 14);
      ctx.fillStyle = '#ffcf3d';
      ctx.beginPath();
      ctx.roundRect(30, 6, 22, 20, 5);
      ctx.fill();
      ctx.stroke();
      break;
    case 'flower':
      arm(ctx, look.hue, 50, 4);
      ctx.translate(56, -8);
      line(ctx, [
        [0, 12],
        [0, -6],
      ], 3, '#2f8f3a');
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = '#ff7eb6';
        ctx.beginPath();
        ctx.arc(Math.cos((i / 5) * TAU) * 6, -12 + Math.sin((i / 5) * TAU) * 6, 5, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#ffe14d';
      ctx.beginPath();
      ctx.arc(0, -12, 4, 0, TAU);
      ctx.fill();
      break;
    case 'cloth': {
      const hx = Math.sin(p * 30) * 40;
      arm(ctx, look.hue, hx * 0.5 + 20, 40);
      ctx.translate(hx * 0.5 + 20, 48);
      ctx.rotate(Math.sin(p * 30) * 0.4);
      ctx.fillStyle = '#7cdcff';
      ctx.beginPath();
      ctx.roundRect(-14, -8, 28, 16, 4);
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'wand':
      arm(ctx, look.hue, 44, 12);
      line(ctx, [
        [44, 12],
        [60, 42],
      ], 5, '#5b4a8a');
      sparkleStar(ctx, 62, 46, 10 + Math.sin(t * 20) * 3, '#fff36b');
      break;
    case 'wave': {
      const a = Math.sin(t * 12) * 0.5;
      arm(ctx, look.hue, 40 + Math.sin(a) * 18, -60 + Math.cos(a) * 4);
      break;
    }
    case 'flute':
      ctx.save();
      ctx.rotate(-0.15);
      ctx.fillStyle = '#c99a5b';
      ctx.beginPath();
      ctx.roundRect(-4, -20, 56, 7, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = INK;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(14 + i * 9, -16.5, 1.6, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
      arm(ctx, look.hue, 36, -16);
      break;
  }
  ctx.restore();
}

/** the flying saucer with the pilot, drawn around (0, 0) */
export function drawUfo(ctx: Ctx, look: UfoLook): void {
  const t = look.t;
  const body = hsl(look.hue, 0.62, 0.6);
  const bodyDark = hsl(look.hue, 0.62, 0.42);
  ctx.save();
  ctx.lineJoin = 'round';
  // pilot: head with antennae
  for (const sx of [-1, 1]) {
    const wob = Math.sin(t * 5 + sx) * 3;
    line(ctx, [
      [sx * 8, -52],
      [sx * 14 + wob, -64],
    ], 3, bodyDark);
    ctx.fillStyle = hsl(look.hue + 60, 0.9, 0.7);
    ctx.beginPath();
    ctx.arc(sx * 14 + wob, -66, 4.5, 0, TAU);
    ctx.fill();
  }
  const head = ctx.createRadialGradient(-7, -46, 3, 0, -36, 25);
  head.addColorStop(0, hsl(look.hue, 0.6, 0.75));
  head.addColorStop(1, body);
  ctx.fillStyle = head;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(0, -36, 23, 21, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  for (const sx of [-1, 1]) eye(ctx, sx * 9.5, -40, look.face, sx, !!look.blink, t);
  ctx.fillStyle = 'rgba(255,110,150,0.45)';
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(sx * 15, -29, 4.5, 2.6, 0, 0, TAU);
    ctx.fill();
  }
  mouth(ctx, look.face, t);
  if (look.hat) hat(ctx, look.hat);
  if (look.boss && look.hat !== 'party') crown(ctx, -13, -54, 18, -0.35);
  // glass dome
  ctx.fillStyle = 'rgba(190,235,255,0.28)';
  ctx.strokeStyle = 'rgba(60,90,140,0.7)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(0, -8, 46, 66, 0, Math.PI, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.ellipse(0, -8, 37, 55, 0, 1.15 * Math.PI, 1.38 * Math.PI);
  ctx.stroke();
  // saucer
  const metal = ctx.createLinearGradient(0, -14, 0, 18);
  metal.addColorStop(0, '#f4f6ff');
  metal.addColorStop(0.5, '#b9c0dd');
  metal.addColorStop(1, '#7c84a8');
  ctx.fillStyle = metal;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, 2, 80, 22, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = hsl(look.hue, 0.45, 0.55);
  ctx.beginPath();
  ctx.ellipse(0, 13, 44, 10, 0, 0, Math.PI);
  ctx.fill();
  ctx.stroke();
  // blinking rim lights
  const colors = ['#ff5d8f', '#ffe14d', '#5df2ff', '#8dff6b'];
  for (let i = 0; i < 7; i++) {
    const x = -60 + i * 20;
    const on = Math.floor(t * 6 + i) % 3 !== 0;
    ctx.fillStyle = on ? colors[i % colors.length] : 'rgba(80,80,110,0.6)';
    ctx.beginPath();
    ctx.arc(x, 4 + Math.abs(x) * 0.06, 4.5, 0, TAU);
    ctx.fill();
  }
  if (look.prop) prop(ctx, look);
  ctx.restore();
}

/** blue tractor beam from the saucer down to a block (top y0, bottom y1) */
export function drawBeam(ctx: Ctx, x: number, y0: number, y1: number, w: number, strength: number, t: number, rainbow = false): void {
  if (strength <= 0.02 || y1 <= y0) return;
  ctx.save();
  ctx.globalAlpha = clamp(strength);
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  if (rainbow) {
    const h = (t * 240) % 360;
    g.addColorStop(0, hsl(h, 0.9, 0.7, 0.55));
    g.addColorStop(0.5, hsl(h + 120, 0.9, 0.7, 0.4));
    g.addColorStop(1, hsl(h + 240, 0.9, 0.7, 0.3));
  } else {
    g.addColorStop(0, 'rgba(120,220,255,0.6)');
    g.addColorStop(1, 'rgba(80,170,255,0.25)');
  }
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - 26, y0);
  ctx.lineTo(x + 26, y0);
  ctx.lineTo(x + w / 2, y1);
  ctx.lineTo(x - w / 2, y1);
  ctx.closePath();
  ctx.fill();
  // rings travelling down the beam
  ctx.strokeStyle = rainbow ? 'rgba(255,255,255,0.7)' : 'rgba(200,245,255,0.75)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 4; i++) {
    const u = (t * 1.6 + i / 4) % 1;
    const y = y0 + (y1 - y0) * u;
    const hw = 26 + (w / 2 - 26) * u;
    ctx.globalAlpha = clamp(strength) * (1 - u) * 0.9;
    ctx.beginPath();
    ctx.ellipse(x, y, hw, 5 + 5 * u, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

/** the swirling portal in the sky; open 0..1 */
export function drawPortal(ctx: Ctx, x: number, y: number, r: number, t: number, open: number, pulse = 0): void {
  if (open <= 0.01) return;
  const R = r * open * (1 + pulse * 0.12);
  ctx.save();
  const glow = ctx.createRadialGradient(x, y, R * 0.3, x, y, R * 1.6);
  glow.addColorStop(0, 'rgba(190,140,255,0.55)');
  glow.addColorStop(1, 'rgba(120,80,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, R * 1.6, 0, TAU);
  ctx.fill();
  const core = ctx.createRadialGradient(x, y, 2, x, y, R);
  core.addColorStop(0, '#fff6ff');
  core.addColorStop(0.35, '#b98bff');
  core.addColorStop(0.75, '#5b3bd6');
  core.addColorStop(1, '#2a1670');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.ellipse(x, y, R, R * 0.92, 0, 0, TAU);
  ctx.fill();
  // spiral arms
  ctx.translate(x, y);
  ctx.rotate(t * 1.8);
  for (let k = 0; k < 4; k++) {
    ctx.rotate(TAU / 4);
    ctx.strokeStyle = k % 2 ? 'rgba(255,255,255,0.55)' : 'rgba(140,230,255,0.6)';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 20; i++) {
      const a = i * 0.18;
      const rr = R * (0.08 + i * 0.042);
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr * 0.92;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = '#ffe9ff';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.ellipse(x, y, R, R * 0.92, 0, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = '#7d4cff';
  ctx.lineWidth = 3;
  ctx.stroke();
  // sparkles around the rim
  for (let i = 0; i < 6; i++) {
    const a = t * 1.2 + (i / 6) * TAU;
    sparkleStar(ctx, x + Math.cos(a) * R * 1.1, y + Math.sin(a) * R * 1.02, 6 + 3 * Math.sin(t * 5 + i), '#fff6b0');
  }
  ctx.restore();
}

// ---------------------------------------------------------------- gag extras

export function drawCloud(ctx: Ctx, x: number, y: number, t: number): void {
  ctx.save();
  ctx.fillStyle = '#8f97b8';
  ctx.strokeStyle = '#4b4f6b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (const [ox, oy, r] of [
    [-40, 6, 24],
    [-12, -10, 32],
    [24, -4, 28],
    [48, 8, 20],
  ])
    ctx.arc(x + ox, y + oy, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(90,150,255,0.8)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const dx = -45 + i * 18;
    const u = (t * 2.4 + i * 0.37) % 1;
    ctx.beginPath();
    ctx.moveTo(x + dx, y + 26 + u * 70);
    ctx.lineTo(x + dx - 3, y + 38 + u * 70);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawBird(ctx: Ctx, x: number, y: number, t: number, flying: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#ffb347';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 14, 11, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(11, -9, 8, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(13, -11, 1.8, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ff7a1a';
  ctx.beginPath();
  ctx.moveTo(18, -9);
  ctx.lineTo(26, -7);
  ctx.lineTo(18, -5);
  ctx.fill();
  const flap = flying ? Math.sin(t * 40) * 10 : 2;
  ctx.fillStyle = '#ff9f2e';
  ctx.beginPath();
  ctx.ellipse(-2, -4 - flap * 0.5, 10, 5, -0.4 - flap * 0.05, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function drawButterfly(ctx: Ctx, x: number, y: number, t: number): void {
  ctx.save();
  ctx.translate(x, y);
  const f = 0.35 + 0.65 * Math.abs(Math.sin(t * 16));
  for (const sx of [-1, 1]) {
    ctx.save();
    ctx.scale(sx * f, 1);
    ctx.fillStyle = sx < 0 ? '#ff7eb6' : '#b48bff';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(10, -6, 11, 9, 0.4, 0, TAU);
    ctx.ellipse(8, 8, 7, 6, -0.4, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  line(ctx, [
    [0, -10],
    [0, 12],
  ], 3);
  ctx.restore();
}

/** three little stars flying in a circle above the dome */
export function drawJuggle(ctx: Ctx, x: number, y: number, t: number): void {
  for (let i = 0; i < 3; i++) {
    const a = t * 7 + (i * TAU) / 3;
    sparkleStar(ctx, x + Math.cos(a) * 34, y - 30 + Math.sin(a) * 26, 11, ['#ffe14d', '#ff7eb6', '#7cdcff'][i]);
  }
}

export function drawFlames(ctx: Ctx, x: number, y: number, dir: number, t: number): void {
  ctx.save();
  ctx.translate(x - dir * 78, y + 4);
  ctx.scale(-dir, 1);
  for (const [c, len, w] of [
    ['#ff7a1a', 70, 18],
    ['#ffe14d', 44, 10],
  ] as const) {
    const l = len * (0.8 + 0.2 * Math.sin(t * 50));
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(0, -w);
    ctx.quadraticCurveTo(l * 0.6, -w * 0.6, l, 0);
    ctx.quadraticCurveTo(l * 0.6, w * 0.6, 0, w);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** measuring tape from the UFO down to the ground with metre marks */
export function drawTape(ctx: Ctx, x: number, y0: number, y1: number, ppm: number): void {
  if (y1 <= y0) return;
  ctx.save();
  ctx.fillStyle = '#ffe14d';
  ctx.strokeStyle = '#a86b00';
  ctx.lineWidth = 2;
  ctx.fillRect(x - 6, y0, 12, y1 - y0);
  ctx.strokeRect(x - 6, y0, 12, y1 - y0);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  const step = Math.max(6, ppm);
  for (let y = y1; y > y0; y -= step) {
    ctx.beginPath();
    ctx.moveTo(x - 6, y);
    ctx.lineTo(x + 1, y);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawShootingStar(ctx: Ctx, x: number, y: number, p: number): void {
  if (p <= 0 || p >= 1) return;
  const sx = x - 500 + p * 1000;
  const sy = y - 160 + p * 120;
  ctx.save();
  const g = ctx.createLinearGradient(sx - 160, sy - 20, sx, sy);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(255,250,200,0.95)');
  ctx.strokeStyle = g;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(sx - 160, sy - 20);
  ctx.lineTo(sx, sy);
  ctx.stroke();
  sparkleStar(ctx, sx, sy, 14, '#fff6b0');
  ctx.restore();
}

export function drawDizzy(ctx: Ctx, x: number, y: number, t: number): void {
  for (let i = 0; i < 3; i++) {
    const a = t * 6 + (i * TAU) / 3;
    sparkleStar(ctx, x + Math.cos(a) * 32, y + Math.sin(a) * 10, 9, '#ffe14d');
  }
}

export function drawGumBubble(ctx: Ctx, x: number, y: number, r: number): void {
  if (r < 2) return;
  ctx.save();
  ctx.fillStyle = 'rgba(255,120,190,0.85)';
  ctx.strokeStyle = '#c43d86';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.35, y - r * 0.4, r * 0.25, r * 0.15, -0.5, 0, TAU);
  ctx.fill();
  ctx.restore();
}
