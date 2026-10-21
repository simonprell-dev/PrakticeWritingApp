// Vision lab: run the full pipeline on photos or camera frames and inspect every stage.
import { Engine } from '../recog/engine.ts';
import { TIER_LABEL } from '../recog/score.ts';
import type { RGBAImage, ScanResult, VisionOptions } from '../vision/types.ts';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const engine = new Engine();
const status = $('status');
const out = $('out');
const list = $('list');
let current: RGBAImage | null = null;
let video: HTMLVideoElement | null = null;

status.textContent = 'lade Modell …';
const ready = engine.init(new URL('/', location.href).href).then((info) => {
  status.textContent = info.hasModel ? `Modell ok (Gruppe ${(100 * (info.accuracy?.group ?? 0)).toFixed(1)} %)` : 'ohne Modell (nur Vorlagen)';
});

function opts(): VisionOptions {
  const target = ($('target') as HTMLInputElement).value.trim();
  return {
    pen: ($('pen') as HTMLSelectElement).value as VisionOptions['pen'],
    ruled: ($('ruled') as HTMLSelectElement).value as VisionOptions['ruled'],
    strictness: ($('strict') as HTMLSelectElement).value as VisionOptions['strictness'],
    style: ($('style') as HTMLSelectElement).value as VisionOptions['style'],
    target: target || undefined,
    dedup: 'sheet',
    debug: true,
  };
}

function toCanvas(img: RGBAImage): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d')!;
  const id = ctx.createImageData(img.width, img.height);
  id.data.set(img.data);
  ctx.putImageData(id, 0, 0);
  return c;
}

async function analyse(img: RGBAImage) {
  await ready;
  current = img;
  engine.reset();
  const copy: RGBAImage = { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) };
  const t0 = performance.now();
  const res = engine.scan(copy, opts());
  status.textContent = `${res.glyphs.length} Zeichen · ${Math.round(performance.now() - t0)} ms · ${JSON.stringify(res.timings)}`;
  render(img, res);
}

function render(img: RGBAImage, res: ScanResult) {
  out.innerHTML = '';
  const photo = toCanvas(img);
  const ctx = photo.getContext('2d')!;
  const s = res.scale;
  ctx.lineWidth = 3;
  ctx.font = `${Math.round(16 * s)}px system-ui`;
  for (const r of res.regions) {
    ctx.strokeStyle = 'rgba(124,92,255,0.6)';
    ctx.setLineDash([8, 6]);
    ctx.strokeRect(r.box.x * s, r.box.y * s, r.box.w * s, r.box.h * s);
  }
  ctx.setLineDash([]);
  for (const g of res.glyphs) {
    ctx.strokeStyle = g.score.score >= 70 ? '#1aa35a' : g.score.score >= 40 ? '#e0a800' : '#e0304f';
    ctx.strokeRect(g.box.x * s, g.box.y * s, g.box.w * s, g.box.h * s);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fillText(`${g.score.char} ${g.score.score}`, g.box.x * s, g.box.y * s - 4);
  }
  const layers = document.createElement('div');
  layers.className = 'layers';
  if (res.debug) {
    const { ink, mask } = res.debug;
    const heat = document.createElement('canvas');
    heat.width = ink.width;
    heat.height = ink.height;
    const hc = heat.getContext('2d')!;
    const id = hc.createImageData(ink.width, ink.height);
    for (let i = 0; i < ink.data.length; i++) {
      const v = Math.min(255, ink.data[i] * 500);
      id.data[i * 4] = 255 - v * 0.2;
      id.data[i * 4 + 1] = 255 - v;
      id.data[i * 4 + 2] = 255 - v * 0.7;
      id.data[i * 4 + 3] = 255;
    }
    hc.putImageData(id, 0, 0);
    const mk = document.createElement('canvas');
    mk.width = mask.width;
    mk.height = mask.height;
    const mc = mk.getContext('2d')!;
    const md = mc.createImageData(mask.width, mask.height);
    for (let i = 0; i < mask.data.length; i++) {
      const v = mask.data[i] ? 0 : 255;
      md.data[i * 4] = md.data[i * 4 + 1] = md.data[i * 4 + 2] = v;
      md.data[i * 4 + 3] = 255;
    }
    mc.putImageData(md, 0, 0);
    mc.strokeStyle = 'rgba(0,170,0,0.7)';
    for (const l of res.debug.lines) {
      mc.beginPath();
      if (l.orientation === 'h') {
        mc.moveTo(0, l.pos);
        mc.lineTo(mask.width, l.pos);
      } else {
        mc.moveTo(l.pos, 0);
        mc.lineTo(l.pos, mask.height);
      }
      mc.stroke();
    }
    layers.append(labelled('Tinte (Inkness)', heat), labelled(`Maske · ${res.debug.lines.length} Linien`, mk));
  }
  const table = document.createElement('table');
  table.innerHTML = '<tr><th>Ausschnitt</th><th>CNN 28²</th><th>Zeichen</th><th>Top-3</th><th>L</th><th>T</th><th>S</th><th>P</th><th>Score</th><th>Stufe</th><th>Tipp</th></tr>';
  res.glyphs.forEach((g, i) => {
    const tr = document.createElement('tr');
    const crop = toCanvas(g.crop);
    crop.style.maxHeight = '56px';
    const c28 = document.createElement('canvas');
    c28.width = c28.height = 28;
    c28.style.width = c28.style.height = '56px';
    c28.style.imageRendering = 'pixelated';
    const v = res.debug?.cnnInputs[i];
    if (v) {
      const cx = c28.getContext('2d')!;
      const im = cx.createImageData(28, 28);
      for (let k = 0; k < 784; k++) {
        const val = 255 - v[k] * 255;
        im.data[k * 4] = im.data[k * 4 + 1] = im.data[k * 4 + 2] = val;
        im.data[k * 4 + 3] = 255;
      }
      cx.putImageData(im, 0, 0);
    }
    const cells: (string | HTMLElement)[] = [
      crop,
      c28,
      g.score.char + (g.dots ? ` (${g.dots}·)` : ''),
      g.score.top3?.map((t) => `${t.char} ${(t.p * 100).toFixed(0)}%`).join(', ') ?? '–',
      g.score.parts.L.toFixed(2),
      g.score.parts.T.toFixed(2),
      g.score.parts.S.toFixed(2),
      g.score.parts.P.toFixed(2),
      String(g.score.score),
      TIER_LABEL[g.score.tier],
      g.score.tip + (g.score.looksLike ? ` (${g.score.looksLike})` : ''),
    ];
    for (const c of cells) {
      const td = document.createElement('td');
      td.append(c);
      tr.append(td);
    }
    table.append(tr);
  });
  out.append(labelled('Ergebnis', photo), layers, table);
}

function labelled(text: string, el: HTMLElement) {
  const d = document.createElement('div');
  const p = document.createElement('div');
  p.className = 'muted';
  p.textContent = text;
  d.append(p, el);
  return d;
}

async function fileToImage(f: File): Promise<RGBAImage> {
  const bmp = await createImageBitmap(f);
  const c = document.createElement('canvas');
  c.width = bmp.width;
  c.height = bmp.height;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(bmp, 0, 0);
  const id = ctx.getImageData(0, 0, c.width, c.height);
  return { width: id.width, height: id.height, data: id.data };
}

$('files').addEventListener('change', async (e) => {
  const files = [...((e.target as HTMLInputElement).files ?? [])];
  for (const f of files) {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(f);
    img.title = f.name;
    img.addEventListener('click', async () => {
      list.querySelectorAll('img').forEach((i) => i.classList.remove('on'));
      img.classList.add('on');
      await analyse(await fileToImage(f));
    });
    list.append(img);
  }
  (list.querySelector('img') as HTMLImageElement | null)?.click();
});

$('cam').addEventListener('click', async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1920 }, height: { ideal: 1080 } } });
  video = document.createElement('video');
  video.srcObject = stream;
  video.muted = true;
  await video.play();
  status.textContent = `Kamera: ${stream.getVideoTracks()[0]?.label}`;
});

$('snap').addEventListener('click', async () => {
  if (!video) return;
  const c = document.createElement('canvas');
  c.width = video.videoWidth;
  c.height = video.videoHeight;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(video, 0, 0);
  const id = ctx.getImageData(0, 0, c.width, c.height);
  await analyse({ width: id.width, height: id.height, data: id.data });
});

$('save').addEventListener('click', () => {
  if (!current) return;
  const c = toCanvas(current);
  c.toBlob((b) => {
    if (!b) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = `aufnahme-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
    a.click();
  }, 'image/png');
});

for (const id of ['target', 'strict', 'pen', 'ruled', 'style']) {
  $(id).addEventListener('change', () => {
    if (current) void analyse(current);
  });
}
