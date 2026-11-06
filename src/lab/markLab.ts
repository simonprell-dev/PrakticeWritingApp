// Lab section for the test sheet: print it, hold a field into the frame, take a series of 10 pictures.
import type { Engine } from '../recog/engine.ts';
import { probeDots } from '../vision/markProbe.ts';
import type { RGBAImage, VisionOptions } from '../vision/types.ts';
import { pxPerMm, SERIES, summarize, type Shot } from './markSeries.ts';
import { markTestSvg, TEST_FIELDS } from './markTestSheet.ts';

/** share of the picture's width the frame takes; a field is 58 × 20 mm */
const FRAME_W = { nah: 0.6, ganz: 0.12 };
const FIELD_ASPECT = 58 / 20;
const PAUSE_MS = 300;
const STORE = 'krakelkrone.markshots';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function loadShots(): Shot[] {
  try {
    const v = JSON.parse(localStorage.getItem(STORE) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function saveShots(shots: Shot[]): void {
  try {
    localStorage.setItem(STORE, JSON.stringify(shots));
  } catch {
    // the series stay on the page
  }
}

export function setupMarkLab(engine: Engine, opts: () => VisionOptions, ready: Promise<void>): void {
  const video = $<HTMLVideoElement>('mark-video');
  const frame = $('mark-frame');
  const field = $<HTMLSelectElement>('mark-field');
  const source = $<HTMLSelectElement>('mark-source');
  const view = $<HTMLSelectElement>('mark-view');
  const cams = $<HTMLSelectElement>('mark-cams');
  const info = $('mark-info');
  const table = $('mark-table');
  let shots = loadShots();
  let running = false;

  for (const f of TEST_FIELDS) field.append(new Option(f.id, f.id));

  /** the frame in video px */
  function frameBox() {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const w = Math.round(vw * FRAME_W[view.value as Shot['view']]);
    const h = Math.round(w / FIELD_ASPECT);
    return { x: Math.round((vw - w) / 2), y: Math.round((vh - h) / 2), w, h };
  }

  function placeFrame(): void {
    if (!video.videoWidth) return;
    const b = frameBox();
    frame.style.left = `${(100 * b.x) / video.videoWidth}%`;
    frame.style.top = `${(100 * b.y) / video.videoHeight}%`;
    frame.style.width = `${(100 * b.w) / video.videoWidth}%`;
    frame.style.height = `${(100 * b.h) / video.videoHeight}%`;
  }

  function grabFrame(): RGBAImage {
    const b = frameBox();
    const c = document.createElement('canvas');
    c.width = b.w;
    c.height = b.h;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(video, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
    const id = ctx.getImageData(0, 0, b.w, b.h);
    return { width: id.width, height: id.height, data: id.data };
  }

  function render(): void {
    const rows = summarize(shots)
      .map((r) => `<tr class="${r.ok ? 'ok' : r.shots >= SERIES ? 'bad' : ''}"><td>${r.field}</td><td>${r.source}</td><td>${r.view}</td><td>${r.passed} von ${r.shots}</td><td>${r.ok ? 'bestanden' : r.shots >= SERIES ? 'durchgefallen' : 'zu wenig Bilder'}</td></tr>`)
      .join('');
    table.innerHTML = rows ? `<table><tr><th>Feld</th><th>Quelle</th><th>Abstand</th><th>Gut</th><th>Ergebnis</th></tr>${rows}</table>` : '';
  }

  async function open(deviceId?: string): Promise<void> {
    (video.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1920 }, height: { ideal: 1080 }, ...(deviceId ? { deviceId: { exact: deviceId } } : {}) },
    });
    video.srcObject = stream;
    await video.play();
    if (cams.options.length <= 1) {
      const list = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
      cams.replaceChildren(...list.map((d, i) => new Option(d.label || `Kamera ${i + 1}`, d.deviceId)));
      const now = stream.getVideoTracks()[0]?.getSettings().deviceId;
      if (now) cams.value = now;
    }
  }

  async function series(): Promise<void> {
    if (running || !video.videoWidth) return;
    running = true;
    try {
      await takeSeries();
    } catch (e) {
      info.textContent = `Messung abgebrochen: ${e}`;
    }
    running = false;
  }

  async function takeSeries(): Promise<void> {
    await ready;
    const f = TEST_FIELDS.find((x) => x.id === field.value)!;
    for (let k = 0; k < SERIES; k++) {
      const img = grabFrame();
      const probe = probeDots(img);
      engine.reset();
      const glyphs = engine.scan({ width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) }, opts()).glyphs.length;
      shots.push({ field: f.id, source: source.value as Shot['source'], view: view.value as Shot['view'], probe, glyphs, pxPerMm: pxPerMm(f, probe.pitchPx) });
      info.textContent = `Bild ${k + 1} von ${SERIES}: ${probe.readable ? 'lesbar' : 'nicht lesbar'}, Treffer ${Math.round(100 * probe.hitRate)} %, Kontrast ${(100 * probe.contrast).toFixed(1)} %, ${pxPerMm(f, probe.pitchPx).toFixed(1)} px/mm, ${glyphs} Zeichen`;
      saveShots(shots);
      render();
      await new Promise((r) => setTimeout(r, PAUSE_MS));
    }
  }

  $('mark-print').addEventListener('click', () => {
    $('mark-sheets').innerHTML = markTestSvg(1) + markTestSvg(2);
    requestAnimationFrame(() => setTimeout(() => window.print(), 50));
  });
  $('mark-cam').addEventListener('click', () => void open().catch((e) => (info.textContent = `Kamera geht nicht: ${e}`)));
  cams.addEventListener('change', () => void open(cams.value).catch((e) => (info.textContent = `Kamera geht nicht: ${e}`)));
  view.addEventListener('change', placeFrame);
  // the first frames of a camera can be tiny; the real size comes with this event
  video.addEventListener('resize', () => {
    placeFrame();
    info.textContent = `Kamera: ${video.videoWidth} × ${video.videoHeight}`;
  });
  $('mark-series').addEventListener('click', () => void series());
  $('mark-copy').addEventListener('click', () => {
    void navigator.clipboard.writeText(JSON.stringify(shots)).then(
      () => (info.textContent = `${shots.length} Aufnahmen kopiert`),
      () => (info.textContent = JSON.stringify(shots)),
    );
  });
  $('mark-clear').addEventListener('click', () => {
    if (!confirm('Alle Messungen löschen?')) return;
    shots = [];
    saveShots(shots);
    render();
  });
  render();
}
