// Camera wizard: choose the camera, rotate/mirror, drag the region of interest, test scan.
import type { Settings } from '../app/settings.ts';
import { Camera, CameraError } from '../camera/camera.ts';
import { TIER_LABEL } from '../recog/score.ts';
import type { ScanResult } from '../vision/types.ts';
import { button, h, modal } from './dom.ts';

export interface CameraSetupDeps {
  camera: Camera;
  settings: Settings;
  save: () => void;
  testScan: () => Promise<ScanResult | null>;
  reopen: (deviceId?: string) => Promise<void>;
}

type Roi = { x: number; y: number; w: number; h: number };

export function openCameraSetup(d: CameraSetupDeps, onClose?: () => void): void {
  const cam = d.settings.camera;
  const view = h('canvas');
  const overlay = h('canvas', { style: 'position:absolute;inset:0;width:100%;height:100%' });
  const msg = h('div', { class: 'cam-msg' }, 'Kamera wird gestartet …');
  const wrap = h('div', { class: 'cam-view' }, view, overlay);
  const errBox = h('div');
  const select = h('select') as HTMLSelectElement;
  const info = h('p', { class: 'help' });
  let lastScan: { res: ScanResult; until: number } | null = null;
  let raf = 0;

  const fillDevices = async () => {
    const devs = await Camera.devices();
    select.innerHTML = '';
    devs.forEach((dv, i) => {
      const o = h('option', { value: dv.deviceId }, (dv.label || `Kamera ${i + 1}`) + (Camera.isDocCam(dv.label) ? ' 📄' : ''));
      if (dv.deviceId === d.camera.deviceId) o.selected = true;
      select.append(o);
    });
    if (!devs.length) select.append(h('option', null, 'Keine Kamera gefunden'));
  };

  const showError = (e: unknown) => {
    errBox.innerHTML = '';
    if (e instanceof CameraError) errBox.append(h('div', { class: 'err-box' }, h('b', null, e.message), h('p', null, e.hint)));
    else if (e) errBox.append(h('div', { class: 'err-box' }, String((e as Error).message ?? e)));
  };

  const start = async (deviceId?: string) => {
    showError(null);
    try {
      await d.reopen(deviceId);
      cam.deviceId = d.camera.deviceId;
      cam.label = d.camera.label;
      d.save();
      await fillDevices();
      msg.remove();
    } catch (e) {
      showError(e);
      if (!msg.isConnected) wrap.prepend(msg);
      msg.textContent = 'Keine Kamera';
    }
  };

  select.addEventListener('change', () => {
    cam.roi = undefined;
    void start(select.value);
  });

  // ---- ROI dragging ----
  let drag: { mode: 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'new'; x: number; y: number; roi: Roi } | null = null;
  const toNorm = (e: PointerEvent) => {
    const r = overlay.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };
  overlay.addEventListener('pointerdown', (e) => {
    const p = toNorm(e);
    const roi = cam.roi ?? { x: 0, y: 0, w: 1, h: 1 };
    const near = (ax: number, ay: number) => Math.hypot(p.x - ax, p.y - ay) < 0.05;
    let mode: NonNullable<typeof drag>['mode'] = 'new';
    if (near(roi.x, roi.y)) mode = 'nw';
    else if (near(roi.x + roi.w, roi.y)) mode = 'ne';
    else if (near(roi.x, roi.y + roi.h)) mode = 'sw';
    else if (near(roi.x + roi.w, roi.y + roi.h)) mode = 'se';
    else if (p.x > roi.x && p.x < roi.x + roi.w && p.y > roi.y && p.y < roi.y + roi.h && cam.roi) mode = 'move';
    drag = { mode, x: p.x, y: p.y, roi: { ...roi } };
    overlay.setPointerCapture(e.pointerId);
  });
  overlay.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = toNorm(e);
    const r = { ...drag.roi };
    const dx = p.x - drag.x;
    const dy = p.y - drag.y;
    const cl = (v: number) => Math.min(1, Math.max(0, v));
    if (drag.mode === 'move') {
      r.x = cl(Math.min(1 - r.w, r.x + dx));
      r.y = cl(Math.min(1 - r.h, r.y + dy));
    } else if (drag.mode === 'new') {
      r.x = cl(Math.min(drag.x, p.x));
      r.y = cl(Math.min(drag.y, p.y));
      r.w = Math.abs(p.x - drag.x);
      r.h = Math.abs(p.y - drag.y);
    } else {
      let x0 = r.x;
      let y0 = r.y;
      let x1 = r.x + r.w;
      let y1 = r.y + r.h;
      if (drag.mode.includes('w')) x0 = cl(x0 + dx);
      if (drag.mode.includes('e')) x1 = cl(x1 + dx);
      if (drag.mode.includes('n')) y0 = cl(y0 + dy);
      if (drag.mode.includes('s')) y1 = cl(y1 + dy);
      r.x = Math.min(x0, x1);
      r.y = Math.min(y0, y1);
      r.w = Math.abs(x1 - x0);
      r.h = Math.abs(y1 - y0);
    }
    if (r.w > 0.08 && r.h > 0.08) cam.roi = r;
  });
  overlay.addEventListener('pointerup', () => {
    drag = null;
    d.save();
  });

  const drawOverlay = () => {
    overlay.width = view.width;
    overlay.height = view.height;
    const c = overlay.getContext('2d')!;
    const W = overlay.width;
    const H = overlay.height;
    c.clearRect(0, 0, W, H);
    const r = cam.roi ?? { x: 0, y: 0, w: 1, h: 1 };
    c.fillStyle = 'rgba(20,10,40,0.55)';
    c.fillRect(0, 0, W, H);
    c.clearRect(r.x * W, r.y * H, r.w * W, r.h * H);
    c.strokeStyle = '#ffcf3d';
    c.lineWidth = 3;
    c.strokeRect(r.x * W, r.y * H, r.w * W, r.h * H);
    c.fillStyle = '#ffcf3d';
    for (const [x, y] of [
      [r.x, r.y],
      [r.x + r.w, r.y],
      [r.x, r.y + r.h],
      [r.x + r.w, r.y + r.h],
    ]) {
      c.beginPath();
      c.arc(x * W, y * H, 9, 0, Math.PI * 2);
      c.fill();
    }
    if (lastScan && performance.now() < lastScan.until) {
      const res = lastScan.res;
      const sx = (r.w * W) / (res.frameW / res.scale);
      const sy = (r.h * H) / (res.frameH / res.scale);
      c.font = '600 15px Fredoka, sans-serif';
      for (const g of res.glyphs) {
        const x = r.x * W + g.box.x * sx;
        const y = r.y * H + g.box.y * sy;
        c.strokeStyle = g.score.score >= 70 ? '#27c46b' : g.score.score >= 40 ? '#ffcf3d' : '#ff5470';
        c.strokeRect(x - 2, y - 2, g.box.w * sx + 4, g.box.h * sy + 4);
        c.fillStyle = '#fff';
        c.strokeStyle = 'rgba(0,0,0,0.7)';
        c.lineWidth = 3;
        const label = `${g.score.char} ${g.score.score}`;
        c.strokeText(label, x, y - 6);
        c.fillText(label, x, y - 6);
        c.lineWidth = 3;
      }
    }
  };

  const loop = () => {
    if (d.camera.preview(view, cam, 680)) drawOverlay();
    raf = requestAnimationFrame(loop);
  };

  const content = h(
    'div',
    null,
    h('h2', null, '📷 Kamera einrichten'),
    h(
      'div',
      { class: 'cam-setup' },
      h('div', null, wrap, errBox),
      h(
        'div',
        null,
        h('div', { class: 'row' }, h('label', { style: 'min-width:auto' }, 'Kamera'), select),
        h(
          'div',
          { class: 'row' },
          button('⟳ Drehen', () => {
            cam.rotation = ((cam.rotation + 90) % 360) as Settings['camera']['rotation'];
            cam.roi = undefined;
            d.save();
          }, 'btn small'),
          button('⇋ Spiegeln', () => {
            cam.mirror = !cam.mirror;
            d.save();
          }, 'btn small'),
          button('▢ Ganzes Bild', () => {
            cam.roi = undefined;
            d.save();
          }, 'btn small'),
        ),
        h('p', { class: 'help' }, 'Ziehe im Bild einen Rahmen um das Blatt. Nur dort wird gesucht. Die Schrift sollte aufrecht zu sehen sein – sonst „Drehen“.'),
        h(
          'div',
          { class: 'row' },
          button('✏️ Testscan', async () => {
            info.textContent = 'Schaue …';
            const res = await d.testScan();
            if (res) {
              lastScan = { res, until: performance.now() + 8000 };
              info.textContent = res.glyphs.length
                ? `${res.glyphs.length} Zeichen gefunden: ${res.glyphs.map((g) => `${g.score.char} (${TIER_LABEL[g.score.tier]})`).join(', ')}`
                : 'Keine Zeichen gefunden. Schreib ein paar Buchstaben mit einem dunklen Stift und versuche es nochmal.';
            } else info.textContent = '';
          }, 'btn accent'),
        ),
        info,
        h('h3', null, 'Tipps für gute Erkennung'),
        h(
          'ul',
          { class: 'help', style: 'padding-left:1.2em;margin:0' },
          h('li', null, 'Filzstift oder weicher Bleistift (B/2B)'),
          h('li', null, 'Licht der Dokumentenkamera einschalten, Schatten vermeiden'),
          h('li', null, 'Zwischen den Buchstaben etwas Platz lassen'),
          h('li', null, 'Bei Zetteln: dunkle Unterlage hilft'),
          h('li', null, 'Datenschutz: nur das Papier filmen, keine Gesichter'),
        ),
      ),
    ),
    h('div', { class: 'actions' }, button('Fertig', () => m.close(), 'btn primary')),
  );
  const m = modal(content, () => {
    cancelAnimationFrame(raf);
    d.save();
    onClose?.();
  });
  if (!d.camera.ready()) void start(cam.deviceId);
  else {
    msg.remove();
    void fillDevices();
  }
  wrap.prepend(msg);
  if (d.camera.ready()) msg.remove();
  loop();
}
