// The presentation film: a child at the desk with a document camera and a laptop, the camera moves over
// the shoulder, the child writes three B, presses the space bar, the fish hatch – then the camera flies into
// the laptop and every game is shown full screen. One pure function of time, so the player can seek.
import { drawPencil } from '../game/strokes.ts';
import { drawCalm, drawDuell, drawKidLetters, drawMalen, drawMeer, drawResult, drawRiesenburg, drawSavanne, drawTask, drawTuerme, drawWeltraum, kidWriteDuration, KID_B } from './games.ts';
import { clamp, H, INK, lerp, pill, span, text, W } from './kit.ts';

type C = CanvasRenderingContext2D;

// ---------- the timeline ----------

const SPEED = 1.6;
const GAP = 0.5;
const WRITE_AT = 17;
const LETTER = () => kidWriteDuration() / SPEED;
const letterStart = (i: number) => WRITE_AT + i * (LETTER() + GAP);
const WRITE_END = () => letterStart(2) + LETTER();
const PRESS = () => WRITE_END() + 2.1;
const SNAP = () => PRESS() + 0.15;
const FULL = () => SNAP() + 8.5;

interface Part {
  id: string;
  title: string;
  len: number;
  draw: (ctx: C, u: number) => void;
  info?: { title: string; points: string[] };
  sub: string[];
}

/** the games, one after the other on the full screen */
const GAMES: Part[] = [
  {
    id: 'meer',
    title: 'Meer',
    len: 8,
    draw: drawMeer,
    info: {
      title: '🐠 Meer: Buchstaben üben',
      points: [
        'Frei schreiben – jedes Zeichen zählt',
        'Üben: „Schreibe 5× das B“, auch B → D → P nacheinander',
        'Überraschungs-Buchstaben in Blasen: schreiben, und die Blase platzt',
      ],
    },
    sub: ['Das ist das Meer: Hier wird geübt.', 'Schwebt eine Blase mit einem Buchstaben vorbei, befreit ihn, wer ihn schreibt.'],
  },
  {
    id: 'weltraum',
    title: 'Weltraum',
    len: 6,
    draw: drawWeltraum,
    info: {
      title: '🚀 Weltraum',
      points: ['Aus Buchstaben werden Aliens', 'Schöne Zeichen glitzern und tragen eine Krone', 'Krakelige werden zerknittert und lustig – nie beschämend'],
    },
    sub: ['Im Weltraum schlüpfen Aliens.', 'Auch krakelige Buchstaben werden liebenswerte Wesen.'],
  },
  {
    id: 'savanne',
    title: 'Savanne',
    len: 6,
    draw: drawSavanne,
    info: {
      title: '🦁 Savanne',
      points: ['Löwe, Elefant, Giraffe, Zebra, Nilpferd', 'Auf jedem Bauch klebt das echte Zeichen des Kindes', 'Großbuchstaben, Kleinbuchstaben und Ziffern'],
    },
    sub: ['In der Savanne werden Buchstaben zu Tieren.', 'Auf jedem Bauch klebt das echte Zeichen des Kindes.'],
  },
  {
    id: 'duell',
    title: 'Team-Duell',
    len: 7.5,
    draw: drawDuell,
    info: {
      title: '⚔️ Team-Duell',
      points: ['Zwei Teams, erkannt an Stift- oder Zettelfarbe', 'Jede Figur hat 1–5 Sterne: je schöner, desto stärker', 'Burgen aus Seifenblasen – wer zuerst alle platzen lässt, gewinnt'],
    },
    sub: ['Im Team-Duell schreiben zwei Teams gegeneinander, zum Beispiel Rot gegen Blau.', 'Je schöner der Buchstabe, desto mehr Sterne hat seine Figur.'],
  },
  {
    id: 'riesenburg',
    title: 'Riesenburg',
    len: 7.5,
    draw: drawRiesenburg,
    info: {
      title: '🏰 Klasse gegen Riesenburg',
      points: ['Die ganze Klasse ist ein Team gegen Riese Rumpel', '2–4 Mauern aus Seifenblasen, Tintenklecks-Wächter', 'Am Ende schwenkt der Riese die weiße Fahne'],
    },
    sub: ['Bei der Riesenburg spielt die ganze Klasse zusammen gegen Riese Rumpel.', 'Jeder Buchstabe hilft, eine Mauer zum Platzen zu bringen.'],
  },
  {
    id: 'tuerme',
    title: 'Türme bauen',
    len: 7.5,
    draw: drawTuerme,
    info: {
      title: '🗼 Türme bauen',
      points: ['2–8 Teams bauen um die Wette', 'Je schöner der Buchstabe, desto höher der Stein', 'Alien Zork beamt jeden Stein auf den richtigen Turm'],
    },
    sub: ['Beim Türme bauen wird jeder Buchstabe zu einem Baustein.', 'Alien Zork beamt ihn auf den Turm des richtigen Teams.'],
  },
  {
    id: 'malen',
    title: 'Mal-Aquarium',
    len: 7,
    draw: drawMalen,
    info: {
      title: '🎨 Mal-Aquarium',
      points: ['Kopiervorlage drucken, Fisch ausmalen, Namen draufschreiben', 'Der Fisch schwimmt in genau diesen Farben', 'Und er sagt seinen handgeschriebenen Namen'],
    },
    sub: ['Im Mal-Aquarium wird gemalt statt geschrieben.', 'Jeder ausgemalte Fisch schwimmt in seinen eigenen Farben los.'],
  },
];

export const FEATURES: [string, string, string][] = [
  ['📽️', 'Dokumentenkamera & Beamer', 'für die ganze Klasse'],
  ['📱', 'Handy oder Tablet', 'Foto mit der Rückkamera – für zu Hause'],
  ['✍️', 'Richtige Strichreihenfolge', 'nach LehrplanPLUS, Grund- und Druckschrift'],
  ['📏', 'Lineatur 1–3 erkannt', '„Genau bis an die Linien schreiben!“'],
  ['🔒', 'Datenschutz eingebaut', 'Auswertung im Browser, keine Fotos gespeichert, keine Cookies'],
  ['💾', 'Weiterspielen', 'Spielstände für jede Klasse speichern'],
  ['🌍', '17 Sprachen', 'und viele Schriften der Welt'],
  ['💛', 'Kostenlos & ohne Werbung', 'ohne Anmeldung, einfach im Browser'],
];

const FEATURE_LEN = 11;
const OUTRO_LEN = 9;

function gamesStart(i: number): number {
  let t = FULL();
  for (let k = 0; k < i; k++) t += GAMES[k].len;
  return t;
}
const FEATURES_AT = () => gamesStart(GAMES.length);
const OUTRO_AT = () => FEATURES_AT() + FEATURE_LEN;
export const length = () => OUTRO_AT() + OUTRO_LEN;

export interface Chapter {
  at: number;
  title: string;
}
export function chapters(): Chapter[] {
  return [
    { at: 0, title: 'Start' },
    { at: 5, title: 'Am Schreibtisch' },
    { at: WRITE_AT - 2, title: 'Schreiben' },
    { at: WRITE_END(), title: 'Leertaste' },
    { at: SNAP(), title: 'Wesen schlüpfen' },
    ...GAMES.map((g, i) => ({ at: gamesStart(i), title: g.title })),
    { at: FEATURES_AT(), title: 'Alles drin' },
    { at: OUTRO_AT(), title: 'Ausprobieren' },
  ];
}

/** what the overlays show at time t */
export interface Overlay {
  sub: string;
  info: Part['info'] | null;
  mode: 'title' | 'features' | 'outro' | null;
  features: number;
}

export function overlay(t: number): Overlay {
  const o: Overlay = { sub: '', info: null, mode: null, features: 0 };
  if (t < 5) o.mode = 'title';
  else if (t < 9) o.sub = 'Ein ganz normaler Schreibtisch: Blatt, Stift, eine Dokumentenkamera und ein Laptop.';
  else if (t < 12.4) o.sub = 'Die Kamera schaut von oben aufs Blatt.';
  else if (t < 15.4) o.sub = 'Ein Blick über die Schulter …';
  else if (t < WRITE_AT) o.sub = 'Der Laptop zeigt die Aufgabe – und schreibt das B in der richtigen Strichreihenfolge vor.';
  else if (t < WRITE_END()) o.sub = 'Das Kind schreibt mit dem Stift auf Papier, ganz wie im Heft.';
  else if (t < SNAP()) o.sub = 'Fertig? Leertaste drücken – die Kamera macht ein Foto.';
  else if (t < SNAP() + 3.6) o.sub = 'Aus jedem Buchstaben schlüpft ein Wesen. Je schöner geschrieben, desto prächtiger.';
  else if (t < FULL() - 2) o.sub = 'Aufgabe geschafft! Die schönsten bekommen eine Krone.';
  else if (t < FULL()) o.sub = 'Und was steckt sonst noch drin?';
  else if (t < FEATURES_AT()) {
    const i = GAMES.findIndex((_, k) => t < gamesStart(k + 1));
    const g = GAMES[i];
    const u = t - gamesStart(i);
    o.info = g.info ?? null;
    o.sub = g.sub[u < g.len / 2 ? 0 : 1];
  } else if (t < OUTRO_AT()) {
    o.mode = 'features';
    o.features = Math.floor((t - FEATURES_AT() - 0.6) / 0.7) + 1;
    o.sub = 'Und das ist auch noch drin.';
  } else o.mode = 'outro';
  return o;
}

// ---------- camera ----------

interface Cam {
  t: number;
  x: number;
  y: number;
  z: number;
}

function camAt(keys: Cam[], t: number): Cam {
  if (t <= keys[0].t) return keys[0];
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1];
    const b = keys[i];
    if (t <= b.t) {
      const k = span(t, a.t, b.t);
      return { t, x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), z: Math.exp(lerp(Math.log(a.z), Math.log(b.z), k)) };
    }
  }
  return keys[keys.length - 1];
}

/** applies the camera to a layer at depth d (1 = the desk, more = closer to the viewer) */
function look(ctx: C, cam: Cam, d = 1): void {
  const z = 1 + (cam.z - 1) * d;
  const cx = W / 2 + (cam.x - W / 2) * d;
  const cy = H / 2 + (cam.y - H / 2) * d;
  ctx.translate(W / 2, H / 2);
  ctx.scale(z, z);
  ctx.translate(-cx, -cy);
}

// ---------- the room, seen from the side ----------

const SKIN = '#ffd9b8';
const HAIR = '#6a3f2a';
const SWEATER = '#6fb1ff';
const WOOD = '#e3b07a';

/** the laptop screen in the wide shot */
const WIDE_SCREEN = { x: 962, y: 342, w: 276, h: 155.25 };

function wideRoom(ctx: C, t: number): void {
  const wall = ctx.createLinearGradient(0, 0, 0, 740);
  wall.addColorStop(0, '#fdf1e4');
  wall.addColorStop(1, '#f6e1cc');
  ctx.fillStyle = wall;
  ctx.fillRect(-400, -200, W + 800, 940);
  ctx.fillStyle = '#e7c69a';
  ctx.fillRect(-400, 740, W + 800, 400);
  ctx.strokeStyle = '#d4ad7c';
  ctx.lineWidth = 3;
  for (let x = -400; x < W + 400; x += 160) {
    ctx.beginPath();
    ctx.moveTo(x, 740);
    ctx.lineTo(x - 80, 1100);
    ctx.stroke();
  }
  // window with a cloud
  pill(ctx, 100, 100, 330, 270, 14, '#bfe6ff', INK, 6);
  ctx.fillStyle = '#fff';
  const cx = 200 + Math.sin(t * 0.2) * 40;
  for (const [dx, dy, r] of [
    [0, 0, 30],
    [34, -12, 36],
    [70, 0, 28],
  ])
    (ctx.beginPath(), ctx.arc(cx + dx, 200 + dy, r, 0, Math.PI * 2), ctx.fill());
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(265, 100);
  ctx.lineTo(265, 370);
  ctx.moveTo(100, 235);
  ctx.lineTo(430, 235);
  ctx.stroke();
  // ABC poster
  pill(ctx, 1210, 90, 260, 180, 10, '#fffdf7', INK, 5);
  ['A', 'B', 'C'].forEach((ch, i) => text(ctx, ch, 1265 + i * 75, 185, 90, ['#ff6fb1', '#5b3bd6', '#2fa36b'][i], 'center', 400, "'Grundschrift', 'Druckvorlage', cursive"));
  // plant
  ctx.fillStyle = '#c96f4a';
  ctx.beginPath();
  ctx.moveTo(1440, 640);
  ctx.lineTo(1540, 640);
  ctx.lineTo(1525, 740);
  ctx.lineTo(1455, 740);
  ctx.fill();
  ctx.fillStyle = '#5fae5a';
  for (let i = 0; i < 6; i++) {
    ctx.save();
    ctx.translate(1490, 640);
    ctx.rotate(-1.2 + i * 0.48 + Math.sin(t + i) * 0.03);
    ctx.beginPath();
    ctx.ellipse(0, -70, 22, 70, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // chair
  ctx.fillStyle = '#ff8a5c';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  for (const r of [
    [218, 400, 26, 230],
    [228, 610, 180, 24],
    [240, 634, 14, 110],
    [386, 634, 14, 110],
  ]) {
    ctx.beginPath();
    ctx.roundRect(r[0], r[1], r[2], r[3], 8);
    ctx.fill();
    ctx.stroke();
  }
  // desk
  ctx.fillStyle = WOOD;
  ctx.beginPath();
  ctx.moveTo(420, 500);
  ctx.lineTo(1360, 500);
  ctx.lineTo(1400, 560);
  ctx.lineTo(380, 560);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#c98f55';
  ctx.beginPath();
  ctx.roundRect(380, 560, 1020, 30, 4);
  ctx.fill();
  ctx.stroke();
  for (const x of [400, 1354]) {
    ctx.beginPath();
    ctx.roundRect(x, 590, 26, 160, 4);
    ctx.fill();
    ctx.stroke();
  }
  // paper
  ctx.fillStyle = '#fffdf7';
  ctx.beginPath();
  ctx.moveTo(560, 548);
  ctx.lineTo(800, 548);
  ctx.lineTo(780, 512);
  ctx.lineTo(585, 512);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.stroke();
  // document camera
  const flash = clamp(1 - Math.abs(t - PRESS() - 0.15) / 0.25);
  ctx.fillStyle = `rgba(255,243,168,${0.38 + flash * 0.6})`;
  ctx.beginPath();
  ctx.moveTo(660, 330);
  ctx.lineTo(735, 330);
  ctx.lineTo(800, 530);
  ctx.lineTo(570, 530);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#6b5a8f';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(820, 520, 100, 16, 6);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(870, 522);
  ctx.lineTo(870, 300);
  ctx.lineTo(735, 300);
  ctx.stroke();
  ctx.fillStyle = '#8f7bff';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(650, 285, 100, 48, 12);
  ctx.fill();
  ctx.stroke();
  // laptop
  ctx.fillStyle = '#c9c4d9';
  ctx.beginPath();
  ctx.moveTo(930, 548);
  ctx.lineTo(1270, 548);
  ctx.lineTo(1250, 508);
  ctx.lineTo(950, 508);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  pill(ctx, 948, 328, 304, 184, 12, '#2b2340', INK, 5);
  screen(ctx, WIDE_SCREEN, t);
  // the child, from the side
  child(ctx, t);
}

function child(ctx: C, t: number): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // legs
  ctx.strokeStyle = INK;
  ctx.lineWidth = 52;
  ctx.beginPath();
  ctx.moveTo(300, 596);
  ctx.lineTo(430, 600);
  ctx.lineTo(440, 715);
  ctx.stroke();
  ctx.strokeStyle = '#4a5fa8';
  ctx.lineWidth = 42;
  ctx.stroke();
  ctx.fillStyle = '#ff6f61';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(462, 735, 40, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // body, leaning to the desk
  ctx.fillStyle = SWEATER;
  ctx.beginPath();
  ctx.moveTo(250, 615);
  ctx.quadraticCurveTo(240, 470, 300, 430);
  ctx.quadraticCurveTo(360, 405, 385, 450);
  ctx.quadraticCurveTo(395, 540, 365, 615);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // writing arm: shoulder, elbow, hand on the paper
  const wob = t > WRITE_AT && t < WRITE_END() ? Math.sin(t * 9) * 8 : 0;
  const hand = { x: 650 + wob, y: 520 + Math.cos(t * 7) * (wob ? 4 : 0) };
  ctx.strokeStyle = INK;
  ctx.lineWidth = 40;
  ctx.beginPath();
  ctx.moveTo(345, 470);
  ctx.quadraticCurveTo(420, 560, hand.x - 30, hand.y + 6);
  ctx.stroke();
  ctx.strokeStyle = SWEATER;
  ctx.lineWidth = 30;
  ctx.stroke();
  ctx.save();
  ctx.translate(hand.x + 12, hand.y + 8);
  ctx.rotate(0.9);
  drawPencil(ctx, 0, 0, 0.9);
  ctx.restore();
  ctx.fillStyle = SKIN;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(hand.x - 8, hand.y - 4, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // head
  ctx.fillStyle = HAIR;
  ctx.beginPath();
  ctx.arc(282, 352, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ff6fb1';
  ctx.beginPath();
  ctx.arc(306, 352, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = SKIN;
  ctx.beginPath();
  ctx.arc(368, 368, 68, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = HAIR;
  ctx.beginPath();
  ctx.arc(362, 360, 72, Math.PI * 0.82, Math.PI * 1.85);
  ctx.quadraticCurveTo(400, 330, 345, 345);
  ctx.quadraticCurveTo(330, 400, 300, 405);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // face, looking down to the paper
  const blink = t % 4 < 0.12;
  ctx.fillStyle = '#2a1d33';
  if (blink) {
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(398, 382);
    ctx.lineTo(414, 382);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.ellipse(406, 380, 6, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,120,140,0.45)';
  ctx.beginPath();
  ctx.arc(396, 404, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(418, 410, 9, 0.2, 1.6);
  ctx.stroke();
}

// ---------- over the shoulder ----------

/** the laptop screen in the shot over the shoulder (16:9) */
const SCREEN = { x: 1040, y: 170, w: 440, h: 247.5 };
const PAPER = { x: 640, y: 640, rot: -0.05 };
/** keyboard: unit square → the keyboard area in perspective */
const kb = (s: number, q: number) => ({ x: lerp(lerp(1045, 1005, q), lerp(1475, 1520, q), s), y: lerp(462, 628, q) });
const SPACE = kb(0.5, 0.9);

/** a point on the paper in world coordinates */
function onPaper(p: { x: number; y: number }): { x: number; y: number } {
  const c = Math.cos(PAPER.rot);
  const s = Math.sin(PAPER.rot);
  return { x: PAPER.x + c * p.x - s * p.y, y: PAPER.y + s * p.x + c * p.y };
}

let probe: C | null = null;
/** where the pen is at time t (world coordinates), null when the child does not write */
function penAt(t: number): { x: number; y: number } | null {
  probe ??= document.createElement('canvas').getContext('2d')!;
  const at = (i: number, w: number) => {
    const times = KID_B.map((_, k) => (k < i ? 99 : k === i ? w : 0));
    for (let back = 0; back < 10; back++) {
      const p = drawKidLetters(probe!, -230, -120, 90, times.map((v, k) => (k === i ? Math.max(0.01, v - back * 0.06) : v)));
      if (p) return onPaper(p);
    }
    return null;
  };
  const d = LETTER();
  for (let i = 0; i < 3; i++) {
    const a = letterStart(i);
    if (t >= a && t <= a + d) return at(i, (t - a) * SPEED);
    if (i < 2 && t > a + d && t < letterStart(i + 1)) {
      const from = at(i, d * SPEED - 0.02);
      const to = at(i + 1, 0.02);
      if (from && to) {
        const k = span(t, a + d, letterStart(i + 1));
        return { x: lerp(from.x, to.x, k), y: lerp(from.y, to.y, k) - Math.sin(k * Math.PI) * 30 };
      }
    }
  }
  return null;
}

function overShoulder(ctx: C, t: number, cam: Cam): void {
  // wall
  ctx.save();
  look(ctx, cam, 0.85);
  ctx.fillStyle = '#fbeee0';
  ctx.fillRect(-600, -400, W + 1200, 760);
  pill(ctx, 640, 40, 300, 190, 10, '#fffdf7', INK, 5);
  ['K', 'r', 'o'].forEach((ch, i) => text(ctx, ch, 710 + i * 80, 140, 100, ['#ff6fb1', '#5b3bd6', '#2fa36b'][i], 'center', 400, "'Grundschrift', 'Druckvorlage', cursive"));
  pill(ctx, -200, -40, 520, 300, 14, '#bfe6ff', INK, 6);
  ctx.restore();

  ctx.save();
  look(ctx, cam, 1);
  // desk
  ctx.fillStyle = WOOD;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-300, 330);
  ctx.lineTo(W + 300, 330);
  ctx.lineTo(W + 600, 1200);
  ctx.lineTo(-600, 1200);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(160,100,50,0.25)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.moveTo(-200 + i * 330, 335);
    ctx.lineTo(-500 + i * 420, 1200);
    ctx.stroke();
  }
  // paper with school lines and the child's letters
  ctx.save();
  ctx.translate(PAPER.x, PAPER.y);
  ctx.rotate(PAPER.rot);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(-292, -182, 600, 380);
  ctx.fillStyle = '#fffdf7';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.fillRect(-300, -190, 600, 380);
  ctx.strokeRect(-300, -190, 600, 380);
  ctx.strokeStyle = '#9fb6ea';
  ctx.lineWidth = 2.5;
  for (const [y, w] of [
    [-120, 2.5],
    [-30, 2.5],
    [60, 2.5],
    [150, 2.5],
  ]) {
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(-280, y);
    ctx.lineTo(280, y);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(159,182,234,0.18)';
  ctx.fillRect(-280, -30, 560, 90);
  const d = LETTER();
  drawKidLetters(
    ctx,
    -230,
    -120,
    90,
    KID_B.map((_, i) => clamp((t - letterStart(i)) / d) * d * SPEED + (t > letterStart(i) + d ? 99 : 0)),
  );
  ctx.restore();
  // the pencil lies on the paper after writing
  const down = WRITE_END() + 0.35;
  if (t > down) {
    ctx.save();
    ctx.translate(880, 760);
    ctx.rotate(1.3);
    drawPencil(ctx, 0, 0, 1.5);
    ctx.restore();
  }
  docCam(ctx, t);
  laptop(ctx, t);
  arm(ctx, t, down);
  ctx.restore();

  // the child's head and shoulder in front
  ctx.save();
  look(ctx, cam, 1.5);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 7;
  ctx.fillStyle = SWEATER;
  ctx.beginPath();
  ctx.moveTo(-300, 1200);
  ctx.quadraticCurveTo(-260, 940, 120, 930);
  ctx.quadraticCurveTo(420, 930, 520, 1200);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = HAIR;
  ctx.beginPath();
  ctx.arc(80, 830, 175, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-80, 760, 70, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ff6fb1';
  ctx.beginPath();
  ctx.arc(-25, 780, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = SKIN;
  ctx.beginPath();
  ctx.ellipse(252, 850, 26, 40, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(80, 830, 130, -2.4, -1.4);
  ctx.stroke();
  ctx.restore();
}

function docCam(ctx: C, t: number): void {
  const flash = clamp(1 - Math.abs(t - PRESS() - 0.15) / 0.3);
  ctx.fillStyle = `rgba(255,243,168,${0.22 + flash * 0.6})`;
  ctx.beginPath();
  ctx.moveTo(560, 175);
  ctx.lineTo(690, 175);
  ctx.lineTo(960, 840);
  ctx.lineTo(320, 840);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.fillStyle = '#6b5a8f';
  ctx.beginPath();
  ctx.ellipse(210, 590, 110, 46, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 34;
  ctx.beginPath();
  ctx.moveTo(210, 580);
  ctx.lineTo(210, 150);
  ctx.lineTo(560, 150);
  ctx.stroke();
  ctx.strokeStyle = '#8a7ab0';
  ctx.lineWidth = 20;
  ctx.stroke();
  pill(ctx, 520, 110, 190, 70, 18, '#8f7bff', INK, 6);
  ctx.fillStyle = '#2b2340';
  ctx.beginPath();
  ctx.ellipse(625, 180, 34, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  if (flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${flash})`;
    ctx.beginPath();
    ctx.ellipse(625, 182, 60, 22, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function laptop(ctx: C, t: number): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.fillStyle = '#d5d0e4';
  ctx.beginPath();
  ctx.moveTo(1010, 440);
  ctx.lineTo(1510, 440);
  ctx.lineTo(1580, 700);
  ctx.lineTo(950, 700);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // keys
  const pressed = t > PRESS() && t < PRESS() + 0.3;
  ctx.lineWidth = 2;
  for (let r = 0; r < 5; r++) {
    const q0 = 0.04 + r * 0.16;
    const q1 = q0 + 0.12;
    const cols = 12;
    for (let c = 0; c < cols; c++) {
      if (r === 4 && c >= 4 && c < 8) continue;
      const s0 = 0.02 + (c / cols) * 0.96;
      const s1 = s0 + 0.96 / cols - 0.012;
      key(ctx, s0, s1, q0, q1, false);
    }
  }
  key(ctx, 0.02 + (4 / 12) * 0.96, 0.02 + (8 / 12) * 0.96 - 0.012, 0.84, 0.96, pressed);
  ctx.fillStyle = '#c4bed6';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(1185, 640, 170, 50, 8);
  ctx.fill();
  ctx.stroke();
  // lid
  pill(ctx, 1022, 152, 476, 290, 16, '#2b2340', INK, 6);
  screen(ctx, SCREEN, t);
}

function key(ctx: C, s0: number, s1: number, q0: number, q1: number, down: boolean): void {
  const a = kb(s0, q0);
  const b = kb(s1, q0);
  const c = kb(s1, q1);
  const d = kb(s0, q1);
  const dy = down ? 4 : 0;
  ctx.fillStyle = down ? '#ffd34d' : '#f4f2fa';
  ctx.strokeStyle = '#8a82a6';
  ctx.beginPath();
  ctx.moveTo(a.x, a.y + dy);
  ctx.lineTo(b.x, b.y + dy);
  ctx.lineTo(c.x, c.y + dy);
  ctx.lineTo(d.x, d.y + dy);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/** the writing hand: holds the pencil while writing, then goes to the space bar */
function arm(ctx: C, t: number, down: number): void {
  const pen = penAt(t);
  let hand: { x: number; y: number };
  let pointing = false;
  const rest = onPaper({ x: 260, y: 120 });
  if (pen) hand = pen;
  else if (t < letterStart(0)) {
    const first = penAt(letterStart(0) + 0.01) ?? rest;
    const k = span(t, letterStart(0) - 1.2, letterStart(0));
    hand = { x: lerp(rest.x, first.x, k), y: lerp(rest.y + 80, first.y, k) };
  } else {
    // after writing: put the pencil down, then press the space bar
    const end = penAt(WRITE_END() - 0.01) ?? rest;
    const k1 = span(t, WRITE_END(), down);
    const k2 = span(t, down + 0.15, PRESS() - 0.1);
    const press = t > PRESS() - 0.1 && t < PRESS() + 0.35 ? 8 : 0;
    const back = span(t, PRESS() + 0.6, PRESS() + 1.6);
    pointing = k1 >= 1;
    const p1 = { x: lerp(end.x, 880, k1), y: lerp(end.y, 760, k1) };
    hand = {
      x: lerp(lerp(p1.x, SPACE.x, k2), 1180, back),
      y: lerp(p1.y, SPACE.y + 2, k2) - Math.sin(k2 * Math.PI) * 120 + press + back * 120,
    };
  }
  // the arm comes in from the shoulder at the bottom left
  const sx = 470;
  const sy = 1000;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 78;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.quadraticCurveTo((sx + hand.x) / 2 + 60, (sy + hand.y) / 2 + 90, hand.x - (pointing ? 14 : 50), hand.y + (pointing ? 60 : -20));
  ctx.stroke();
  ctx.strokeStyle = SWEATER;
  ctx.lineWidth = 66;
  ctx.stroke();
  if (!pointing) {
    // fingers hold the pencil a little above the tip, so the tip stays visible
    ctx.fillStyle = SKIN;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(hand.x - 40, hand.y - 40, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    drawPencil(ctx, hand.x, hand.y, 1.5);
    ctx.fillStyle = SKIN;
    ctx.beginPath();
    ctx.ellipse(hand.x - 22, hand.y - 34, 14, 11, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillStyle = SKIN;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(hand.x - 9, hand.y - 6, 18, 44, 9);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(hand.x - 14, hand.y + 46, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

/** what the laptop shows, drawn into a screen rectangle */
function screen(ctx: C, r: { x: number; y: number; w: number; h: number }, t: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  ctx.translate(r.x, r.y);
  ctx.scale(r.w / W, r.h / H);
  screenContent(ctx, t);
  ctx.restore();
}

function screenContent(ctx: C, t: number): void {
  if (t < SNAP()) drawTask(ctx, t - 15.3);
  else drawResult(ctx, t - SNAP());
  const flash = clamp(1 - Math.abs(t - PRESS() - 0.15) / 0.2);
  if (flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${flash})`;
    ctx.fillRect(0, 0, W, H);
  }
}

// ---------- the whole film ----------

const WIDE: Cam[] = [
  { t: 5, x: 800, y: 450, z: 1 },
  { t: 10.6, x: 780, y: 455, z: 1.08 },
  { t: 12.6, x: 520, y: 460, z: 2.3 },
];

function shoulderCams(): Cam[] {
  const full = W / SCREEN.w;
  const cx = SCREEN.x + SCREEN.w / 2;
  const cy = SCREEN.y + SCREEN.h / 2;
  return [
    { t: 12, x: 560, y: 600, z: 1.5 },
    { t: 14.6, x: 800, y: 450, z: 1 },
    { t: 15.4, x: 800, y: 450, z: 1 },
    { t: 16.2, x: 1200, y: 330, z: 2.2 },
    { t: WRITE_AT - 0.2, x: 1200, y: 330, z: 2.2 },
    { t: WRITE_AT + 0.6, x: 640, y: 600, z: 1.55 },
    { t: WRITE_END(), x: 700, y: 600, z: 1.6 },
    { t: WRITE_END() + 1, x: 980, y: 560, z: 1.1 },
    { t: PRESS() + 0.4, x: 980, y: 560, z: 1.1 },
    { t: SNAP() + 1.2, x: 1210, y: 330, z: 2.1 },
    { t: SNAP() + 6, x: 1230, y: 315, z: 2.4 },
    { t: FULL(), x: cx, y: cy, z: full },
  ];
}

let shoulderKeys: Cam[] | null = null;

/** draws the film at time t (logical size W × H) */
export function renderFilm(ctx: C, t: number): void {
  ctx.save();
  if (t < 5 || t >= FEATURES_AT()) {
    drawCalm(ctx, t);
  } else if (t < FULL()) {
    shoulderKeys ??= shoulderCams();
    if (t < 12.6) {
      ctx.save();
      look(ctx, camAt(WIDE, t), 1);
      wideRoom(ctx, t);
      ctx.restore();
    }
    if (t > 11.9) {
      ctx.save();
      ctx.globalAlpha = span(t, 11.9, 12.6);
      overShoulder(ctx, t, camAt(shoulderKeys, t));
      ctx.restore();
    }
    // fade in from the title
    if (t < 5.6) {
      ctx.globalAlpha = 1 - span(t, 5, 5.6);
      drawCalm(ctx, t);
    }
  } else {
    const i = GAMES.findIndex((_, k) => t < gamesStart(k + 1));
    const u = t - gamesStart(i);
    GAMES[i].draw(ctx, u);
    // short cross fade from the previous scene
    if (u < 0.5) {
      ctx.globalAlpha = 1 - span(u, 0, 0.5);
      if (i === 0) screenContent(ctx, t);
      else GAMES[i - 1].draw(ctx, GAMES[i - 1].len + u);
    }
  }
  ctx.restore();
}

export { W, H };
