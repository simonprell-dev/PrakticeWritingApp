// "Farbe anlernen": the teacher taps a pen stroke (or an empty part of a slip) in a photo. The colour is
// measured right there, the pixels that were used light up, and a colour that is too close to another
// team's colour is reported, so the teams can be told apart reliably.
import { angleDeg, chroma, normalize3, PEN_PRESETS, SLIP_PRESETS, type Vec3 } from '../vision/color.ts';
import { button, h, modal } from './dom.ts';

export interface ColorPickerOpts {
  kind: 'pen' | 'slip';
  name: string;
  /** the colours of the other teams (same kind) */
  others: { name: string; value: Vec3 }[];
  photo: () => Promise<HTMLCanvasElement | null>;
  onPick: (value: Vec3) => void;
}

interface Sample {
  value: Vec3;
  /** pixel indices that were measured */
  used: number[];
  /** colour to show as a swatch */
  css: string;
}

const around = (w: number, h: number, x: number, y: number, r: number, fn: (i: number) => void) => {
  for (let yy = Math.max(0, Math.round(y - r)); yy < Math.min(h, Math.round(y + r)); yy++) {
    for (let xx = Math.max(0, Math.round(x - r)); xx < Math.min(w, Math.round(x + r)); xx++) {
      if ((xx - x) ** 2 + (yy - y) ** 2 <= r * r) fn(yy * w + xx);
    }
  }
};

/**
 * Ink colour around (x, y) as the recognition measures it: the absorption direction 1 - I/paper of
 * the ink pixels, the paper being the brightest tenth of a wider neighbourhood.
 */
export function samplePen(img: ImageData, x: number, y: number, r: number): Sample | null {
  const { width: w, height: h, data } = img;
  const near: number[] = [];
  around(w, h, x, y, r * 3, (i) => near.push(i));
  near.sort((a, b) => data[b * 4] + data[b * 4 + 1] + data[b * 4 + 2] - (data[a * 4] + data[a * 4 + 1] + data[a * 4 + 2]));
  const bright = near.slice(0, Math.max(1, Math.floor(near.length * 0.1)));
  const paper = [0, 1, 2].map((c) => bright.reduce((s, i) => s + data[i * 4 + c], 0) / bright.length);
  const acc: Vec3 = [0, 0, 0];
  const used: number[] = [];
  around(w, h, x, y, r, (i) => {
    const n = [0, 1, 2].map((c) => data[i * 4 + c] / Math.max(8, paper[c]));
    if (Math.min(n[0], n[1], n[2]) > 0.78) return;
    for (let c = 0; c < 3; c++) acc[c] += Math.max(0, 1 - n[c]);
    used.push(i);
  });
  if (used.length < 12) return null;
  const a = normalize3(acc);
  const k = 0.85 / Math.max(a[0], a[1], a[2]);
  const css = `rgb(${a.map((v, c) => Math.round(paper[c] * (1 - v * k))).join(',')})`;
  return { value: a, used, css };
}

/** paper colour of a slip around (x, y): the median of the brighter half (ink left out) */
export function sampleSlip(img: ImageData, x: number, y: number, r: number): Sample | null {
  const { width: w, height: h, data } = img;
  const px: number[] = [];
  around(w, h, x, y, r, (i) => px.push(i));
  if (px.length < 12) return null;
  const lum = (i: number) => data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2];
  px.sort((a, b) => lum(b) - lum(a));
  const used = px.slice(0, Math.ceil(px.length / 2));
  const med = (c: number) => used.map((i) => data[i * 4 + c]).sort((a, b) => a - b)[used.length >> 1];
  const rgb: Vec3 = [med(0), med(1), med(2)];
  return { value: chroma(rgb[0], rgb[1], rgb[2]), used, css: `rgb(${rgb.join(',')})` };
}

/** the preset colour that is closest, for a friendly name */
function nearestName(kind: 'pen' | 'slip', v: Vec3): string {
  if (kind === 'pen') {
    return Object.values(PEN_PRESETS).reduce((best, p) => (angleDeg(v, p.absorb) < angleDeg(v, best.absorb) ? p : best)).label;
  }
  const d = (p: Vec3) => Math.hypot(p[0] - v[0], p[1] - v[1]);
  return Object.values(SLIP_PRESETS).reduce((best, p) => (d(p.slip) < d(best.slip) ? p : best)).label;
}

/** how close two team colours are (pen: angle in degrees; slip: chromaticity distance) and when too close */
function tooClose(kind: 'pen' | 'slip', a: Vec3, b: Vec3): boolean {
  return kind === 'pen' ? angleDeg(normalize3(a), normalize3(b)) < 12 : Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.05;
}

export function openColorPicker(o: ColorPickerOpts): void {
  const photoCv = h('canvas');
  const marks = h('canvas', { class: 'marks' });
  const stage = h('div', { class: 'picker-photo' }, photoCv, marks);
  const info = h('div', { class: 'picker-info' }, 'Foto wird gemacht …');
  let img: ImageData | null = null;
  let picked: Sample | null = null;
  const take = button('Übernehmen', () => {
    if (!picked) return;
    o.onPick(picked.value);
    m.close();
  }, 'btn primary');
  take.disabled = true;

  const shoot = async () => {
    info.textContent = 'Foto wird gemacht …';
    picked = null;
    take.disabled = true;
    const shot = await o.photo();
    if (!shot) {
      info.textContent = 'Keine Kamera – bitte zuerst die Kamera einrichten.';
      return;
    }
    photoCv.width = marks.width = shot.width;
    photoCv.height = marks.height = shot.height;
    const ctx = photoCv.getContext('2d')!;
    ctx.drawImage(shot, 0, 0);
    img = ctx.getImageData(0, 0, shot.width, shot.height);
    marks.getContext('2d')!.clearRect(0, 0, marks.width, marks.height);
    info.textContent = o.kind === 'pen' ? `Tippe im Foto genau auf einen Strich von „${o.name}“.` : `Tippe im Foto auf eine freie Stelle eines Zettels von „${o.name}“.`;
  };

  marks.addEventListener('pointerdown', (e) => {
    if (!img) return;
    const r = marks.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * img.width;
    const y = ((e.clientY - r.top) / r.height) * img.height;
    const radius = Math.max(6, img.width * (o.kind === 'pen' ? 0.022 : 0.04));
    const s = o.kind === 'pen' ? samplePen(img, x, y, radius) : sampleSlip(img, x, y, radius);
    // show which pixels were measured
    const mc = marks.getContext('2d')!;
    mc.clearRect(0, 0, marks.width, marks.height);
    if (s) {
      const hl = mc.createImageData(img.width, img.height);
      for (const i of s.used) hl.data.set([255, 0, 200, 170], i * 4);
      mc.putImageData(hl, 0, 0);
    }
    mc.strokeStyle = '#fff';
    mc.lineWidth = 3;
    mc.beginPath();
    mc.arc(x, y, radius, 0, Math.PI * 2);
    mc.stroke();
    mc.strokeStyle = '#3b2a5c';
    mc.lineWidth = 1.5;
    mc.stroke();
    info.innerHTML = '';
    picked = s;
    take.disabled = !s;
    if (!s) {
      info.append(o.kind === 'pen' ? 'Hier sehe ich keine Tinte. Tippe direkt auf einen dicken Strich.' : 'Hier ist kein Zettel. Tippe auf eine freie Stelle des Zettels.');
      return;
    }
    const clash = o.others.find((t) => tooClose(o.kind, s.value, t.value));
    info.append(h('span', { class: 'swatch', style: `background:${s.css}` }), h('span', null, `Gemessen: ähnlich wie ${nearestName(o.kind, s.value)} (${s.used.length} Bildpunkte).`));
    if (clash) info.append(h('div', { class: 'warn-line' }, `⚠️ Sehr ähnlich wie die Farbe von „${clash.name}“ – die Teams könnten verwechselt werden. Besser eine andere Farbe nehmen.`));
  });

  const content = h(
    'div',
    { style: 'min-width:min(820px,94vw)' },
    h('h2', null, `🎨 Farbe für „${o.name}“ anlernen`),
    stage,
    info,
    h('div', { class: 'actions' }, button('📷 Neues Foto', () => void shoot(), 'btn small'), button('Abbrechen', () => m.close(), 'btn'), take),
  );
  const m = modal(content);
  void shoot();
}
