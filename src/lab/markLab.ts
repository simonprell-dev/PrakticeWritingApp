// Lab section for the test sheet: print it, draw the frame around a field, take a series of 10 pictures.
// The dots are measured in the camera's full picture. The recognition gets the whole frame at its own size,
// as in the game, because that is what decides whether printed marks count as writing.
import type { Engine } from '../recog/engine.ts';
import { DETECT_SIZE } from '../vision/constants.ts';
import { probeDots } from '../vision/markProbe.ts';
import type { Box, RGBAImage, VisionOptions } from '../vision/types.ts';
import { exposureKnob, overexposedShare, type ExposureCaps, type ExposureKnob } from './markExposure.ts';
import { glyphsInside, markPitchMm, pxPerMm, SERIES, summarize, type Shot } from './markSeries.ts';
import { FIELD_INSET, markTestSvg, TEST_FIELDS } from './markTestSheet.ts';

/** the frame before it is drawn by hand, as a share of the picture's width */
const START_W = { nah: 0.6, ganz: 0.12 };
const FIELD_ASPECT = 58 / 20;
const PAUSE_MS = 300;
/** a shorter drag is a click, px on screen */
const MIN_DRAG = 12;
/** how often the blown out share is shown, ms */
const CLIP_EVERY_MS = 500;
const STORE = 'krakelkrone.markshots.2';

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
  const area = $('mark-view-box');
  const field = $<HTMLSelectElement>('mark-field');
  const source = $<HTMLSelectElement>('mark-source');
  const view = $<HTMLSelectElement>('mark-view');
  const cams = $<HTMLSelectElement>('mark-cams');
  const info = $('mark-info');
  const table = $('mark-table');
  const exposure = $<HTMLInputElement>('mark-exposure');
  const exposureNote = $('mark-exposure-note');
  const clip = $('mark-clip');
  const controls: (HTMLSelectElement | HTMLButtonElement | HTMLInputElement)[] = [exposure, field, source, view, cams, $<HTMLButtonElement>('mark-series'), $<HTMLButtonElement>('mark-cam'), $<HTMLButtonElement>('mark-clear')];
  let shots = loadShots();
  let running = false;
  /** the frame drawn by hand, as shares of the picture; null: the starting frame of the view */
  let drawn: Box | null = null;
  let knob: ExposureKnob | null = null;

  for (const f of TEST_FIELDS) field.append(new Option(f.id, f.id));

  /** the whole field in video px */
  function fieldBox(): Box {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (drawn) return { x: drawn.x * vw, y: drawn.y * vh, w: drawn.w * vw, h: drawn.h * vh };
    const w = vw * START_W[view.value as Shot['view']];
    const h = w / FIELD_ASPECT;
    return { x: (vw - w) / 2, y: (vh - h) / 2, w, h };
  }

  function placeFrame(): void {
    if (!video.videoWidth) return;
    const b = fieldBox();
    frame.style.left = `${(100 * b.x) / video.videoWidth}%`;
    frame.style.top = `${(100 * b.y) / video.videoHeight}%`;
    frame.style.width = `${(100 * b.w) / video.videoWidth}%`;
    frame.style.height = `${(100 * b.h) / video.videoHeight}%`;
  }

  /** the whole camera picture, at `scale` */
  function picture(scale: number): RGBAImage {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(video.videoWidth * scale));
    c.height = Math.max(1, Math.round(video.videoHeight * scale));
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(video, 0, 0, c.width, c.height);
    const id = ctx.getImageData(0, 0, c.width, c.height);
    return { width: id.width, height: id.height, data: id.data };
  }

  /** the inner part of the field, so a sheet that moves a little keeps the neighbours out */
  function innerPart(full: RGBAImage, b: Box): RGBAImage {
    const x = Math.max(0, Math.round(b.x + b.w * FIELD_INSET));
    const y = Math.max(0, Math.round(b.y + b.h * FIELD_INSET));
    const w = Math.min(full.width - x, Math.round(b.w * (1 - 2 * FIELD_INSET)));
    const h = Math.min(full.height - y, Math.round(b.h * (1 - 2 * FIELD_INSET)));
    const data = new Uint8ClampedArray(w * h * 4);
    for (let r = 0; r < h; r++) data.set(full.data.subarray(((y + r) * full.width + x) * 4, ((y + r) * full.width + x + w) * 4), r * w * 4);
    return { width: w, height: h, data };
  }

  /** offers what this camera lets the browser change */
  function setupExposure(track: MediaStreamTrack | undefined): void {
    knob = exposureKnob((track?.getCapabilities?.() ?? {}) as ExposureCaps);
    exposure.hidden = !knob;
    exposureNote.textContent = knob ? '' : 'Diese Kamera lässt sich vom Browser aus nicht regeln.';
    if (!knob) return;
    exposure.min = String(knob.min);
    exposure.max = String(knob.max);
    exposure.step = String(knob.step ?? 'any');
    const now = (track?.getSettings() as unknown as Record<string, unknown>)[knob.key];
    exposure.value = String(typeof now === 'number' ? now : knob.max);
  }

  function render(): void {
    const rows = summarize(shots)
      .reverse()
      .map((r) => {
        const done = r.shots >= SERIES;
        return `<tr class="${r.ok ? 'ok' : done ? 'bad' : ''}"><td>${r.field}</td><td>${r.source}</td><td>${r.view}</td><td>${r.passed} von ${r.shots}</td><td>${r.ok ? 'bestanden' : done ? 'durchgefallen' : 'zu wenig Bilder'}</td></tr>`;
      })
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
    setupExposure(stream.getVideoTracks()[0]);
    if (cams.options.length <= 1) {
      const list = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
      if (list.length) cams.replaceChildren(...list.map((d, i) => new Option(d.label || `Kamera ${i + 1}`, d.deviceId)));
      const now = stream.getVideoTracks()[0]?.getSettings().deviceId;
      if (now) cams.value = now;
    }
  }

  async function takeSeries(): Promise<void> {
    await ready;
    // everything of the series is fixed here; the controls are off until it ends
    const f = TEST_FIELDS.find((x) => x.id === field.value)!;
    const base = {
      series: Date.now(),
      field: f.id,
      source: source.value as Shot['source'],
      view: view.value as Shot['view'],
      camera: cams.selectedOptions[0]?.text ?? '',
      size: `${video.videoWidth} × ${video.videoHeight}`,
    };
    const b = fieldBox();
    const pitchPx = (b.w / f.box.w) * markPitchMm(f);
    const scale = Math.min(1, DETECT_SIZE / Math.max(video.videoWidth, video.videoHeight));
    const small = { x: b.x * scale, y: b.y * scale, w: b.w * scale, h: b.h * scale };
    for (let k = 0; k < SERIES; k++) {
      const inner = innerPart(picture(1), b);
      const probe = probeDots(inner, { pitchPx });
      const clipped = overexposedShare(inner);
      engine.reset();
      const glyphs = glyphsInside(engine.scan(picture(scale), opts()).glyphs, small);
      const mm = pxPerMm(f, probe.pitchPx || pitchPx);
      shots.push({ ...base, probe, glyphs, pxPerMm: mm, clipped });
      info.textContent = `Bild ${k + 1} von ${SERIES}: ${probe.readable ? 'lesbar' : 'nicht lesbar'}, Treffer ${Math.round(100 * probe.hitRate)} %, Kontrast ${(100 * probe.contrast).toFixed(1)} %, ${mm.toFixed(1)} px/mm, ${glyphs} Zeichen`;
      saveShots(shots);
      render();
      await new Promise((r) => setTimeout(r, PAUSE_MS));
    }
  }

  async function series(): Promise<void> {
    if (running || video.videoWidth < 100) return;
    running = true;
    controls.forEach((c) => (c.disabled = true));
    try {
      await takeSeries();
    } catch (e) {
      info.textContent = `Messung abgebrochen: ${e}`;
    }
    controls.forEach((c) => (c.disabled = false));
    running = false;
  }

  // the frame is drawn around the field on the live picture
  let from: { x: number; y: number } | null = null;
  const at = (e: PointerEvent) => {
    const r = video.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  area.addEventListener('pointerdown', (e) => {
    if (running || !video.videoWidth) return;
    from = at(e);
    area.setPointerCapture(e.pointerId);
  });
  area.addEventListener('pointermove', (e) => {
    if (!from) return;
    const p = at(e);
    const r = video.getBoundingClientRect();
    if (Math.abs(p.x - from.x) * r.width < MIN_DRAG || Math.abs(p.y - from.y) * r.height < MIN_DRAG) return;
    drawn = { x: Math.min(from.x, p.x), y: Math.min(from.y, p.y), w: Math.abs(p.x - from.x), h: Math.abs(p.y - from.y) };
    placeFrame();
  });
  area.addEventListener('pointerup', () => (from = null));

  exposure.addEventListener('input', () => {
    if (!knob) return;
    const track = (video.srcObject as MediaStream | null)?.getVideoTracks()[0];
    const set = { ...(knob.manual ? { exposureMode: 'manual' } : {}), [knob.key]: Number(exposure.value) };
    void track?.applyConstraints({ advanced: [set as MediaTrackConstraintSet] }).catch((e) => (info.textContent = `Belichtung geht nicht: ${e}`));
  });
  setInterval(() => {
    if (running || video.videoWidth < 100) return;
    clip.textContent = `Überstrahlt im Rahmen: ${Math.round(100 * overexposedShare(innerPart(picture(1), fieldBox())))} %`;
  }, CLIP_EVERY_MS);

  $('mark-print').addEventListener('click', () => {
    $('mark-sheets').innerHTML = markTestSvg(1) + markTestSvg(2);
    requestAnimationFrame(() => setTimeout(() => window.print(), 50));
  });
  $('mark-cam').addEventListener('click', () => void open().catch((e) => (info.textContent = `Kamera geht nicht: ${e}`)));
  cams.addEventListener('change', () => void open(cams.value).catch((e) => (info.textContent = `Kamera geht nicht: ${e}`)));
  view.addEventListener('change', () => {
    drawn = null;
    placeFrame();
  });
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
