// Camera wizard: fixed camera, phone/tablet in the hand or tablet with a mirror; choose the camera,
// rotate/mirror, drag the region of interest (fixed camera) or the four corners of the sheet (mirror), test scan.
import type { CameraMode, Settings } from '../app/settings.ts';
import { Camera, CameraError } from '../camera/camera.ts';
import { DEFAULT_QUAD, quadPoint, type Quad } from '../camera/perspective.ts';
import { TIER_LABEL } from '../recog/score.ts';
import type { ScanResult } from '../vision/types.ts';
import { button, h, modal, segmented } from './dom.ts';

export interface CameraSetupDeps {
  camera: Camera;
  settings: Settings;
  save: () => void;
  testScan: () => Promise<ScanResult | null>;
  reopen: (deviceId?: string) => Promise<void>;
  /** fixed camera or in the hand (the app closes the camera; the wizard starts it again) */
  setMode: (mode: CameraMode) => void;
  /** the settings a photo is taken with (a camera in the hand is never turned or cut) */
  camConfig: () => Settings['camera'];
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
  // ---- corners of the sheet (mirror): the nearest corner jumps to the finger ----
  let corner = -1;
  const moveCorner = (e: PointerEvent) => {
    const p = toNorm(e);
    const q = cam.quad!.map((c) => [...c]) as Quad;
    q[corner] = [Math.min(1, Math.max(0, p.x)), Math.min(1, Math.max(0, p.y))];
    cam.quad = q;
  };
  overlay.addEventListener('pointerdown', (e) => {
    if (cam.mode !== 'spiegel' || !cam.quad) return;
    const p = toNorm(e);
    const r = overlay.getBoundingClientRect();
    const dist = cam.quad.map(([x, y]) => Math.hypot((x - p.x) * r.width, (y - p.y) * r.height));
    corner = dist.indexOf(Math.min(...dist));
    moveCorner(e);
    overlay.setPointerCapture(e.pointerId);
  });
  overlay.addEventListener('pointermove', (e) => {
    if (corner >= 0) moveCorner(e);
  });
  overlay.addEventListener('pointerup', () => {
    if (corner < 0) return;
    corner = -1;
    d.save();
  });

  overlay.addEventListener('pointerdown', (e) => {
    if (cam.mode !== 'fest') return;
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
    if (cam.mode === 'spiegel' && cam.quad) {
      const q = cam.quad;
      drawQuad(c, W, H, q);
      drawScan(c, (u, v) => {
        const [x, y] = quadPoint(q, u, v);
        return [x * W, y * H];
      });
      return;
    }
    const r = (cam.mode === 'hand' ? undefined : cam.roi) ?? { x: 0, y: 0, w: 1, h: 1 };
    const inRoi = (u: number, v: number): [number, number] => [(r.x + u * r.w) * W, (r.y + v * r.h) * H];
    if (cam.mode === 'hand') {
      drawScan(c, inRoi);
      return;
    }
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
    drawScan(c, inRoi);
  };

  /** the sheet between its four corners; the thick top edge is where the writing points */
  const drawQuad = (c: CanvasRenderingContext2D, W: number, H: number, q: Quad) => {
    const pts = q.map(([x, y]) => [x * W, y * H]);
    const outline = () => {
      c.beginPath();
      c.moveTo(pts[0][0], pts[0][1]);
      for (const [x, y] of pts.slice(1)) c.lineTo(x, y);
      c.closePath();
    };
    c.fillStyle = 'rgba(20,10,40,0.55)';
    outline();
    c.rect(0, 0, W, H);
    c.fill('evenodd');
    c.strokeStyle = '#ffcf3d';
    c.lineWidth = 3;
    outline();
    c.stroke();
    c.lineWidth = 7;
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    c.lineTo(pts[1][0], pts[1][1]);
    c.stroke();
    // the canvas is scaled to the screen: handles and text keep their size for the finger
    const k = W / (overlay.getBoundingClientRect().width || W);
    c.font = `600 ${Math.round(15 * k)}px Fredoka, sans-serif`;
    c.textAlign = 'center';
    c.lineWidth = 3 * k;
    c.strokeStyle = 'rgba(0,0,0,0.7)';
    c.fillStyle = '#fff';
    const mx = (pts[0][0] + pts[1][0]) / 2;
    const my = (pts[0][1] + pts[1][1]) / 2 - 12 * k;
    c.strokeText('oben', mx, my);
    c.fillText('oben', mx, my);
    c.textAlign = 'start';
    for (const [x, y] of pts) {
      c.fillStyle = 'rgba(255,207,61,0.35)';
      c.beginPath();
      c.arc(x, y, 22 * k, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#ffcf3d';
      c.beginPath();
      c.arc(x, y, 9 * k, 0, Math.PI * 2);
      c.fill();
    }
  };

  /** the letters of the last test scan, with their score */
  const drawScan = (c: CanvasRenderingContext2D, at: (u: number, v: number) => [number, number]) => {
    if (lastScan && performance.now() < lastScan.until) {
      const res = lastScan.res;
      const fw = res.frameW / res.scale;
      const fh = res.frameH / res.scale;
      c.font = '600 15px Fredoka, sans-serif';
      for (const g of res.glyphs) {
        const u0 = g.box.x / fw;
        const v0 = g.box.y / fh;
        const u1 = (g.box.x + g.box.w) / fw;
        const v1 = (g.box.y + g.box.h) / fh;
        const [x, y] = at(u0, v0);
        c.strokeStyle = g.score.score >= 70 ? '#27c46b' : g.score.score >= 40 ? '#ffcf3d' : '#ff5470';
        c.beginPath();
        for (const [u, v] of [
          [u0, v0],
          [u1, v0],
          [u1, v1],
          [u0, v1],
        ])
          c.lineTo(...at(u, v));
        c.closePath();
        c.stroke();
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
    if (d.camera.preview(view, d.camConfig(), 680)) drawOverlay();
    raf = requestAnimationFrame(loop);
  };

  // a phone or tablet: no turning, no frame to drag, just how the photos work
  const fixedOnly = h(
    'div',
    null,
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
  );
  // a tablet with a mirror sees the sheet at a slant: four corners instead of a rectangle
  const mirrorOnly = h(
    'div',
    null,
    h(
      'div',
      { class: 'row' },
      button('⟳ Drehen', () => {
        cam.rotation = ((cam.rotation + 90) % 360) as Settings['camera']['rotation'];
        cam.quad = structuredClone(DEFAULT_QUAD);
        d.save();
      }, 'btn small'),
      button('⇋ Spiegeln', () => {
        cam.mirror = !cam.mirror;
        d.save();
      }, 'btn small'),
      button('↺ Ecken zurücksetzen', () => {
        cam.quad = structuredClone(DEFAULT_QUAD);
        d.save();
      }, 'btn small'),
    ),
    h(
      'p',
      { class: 'help' },
      'Ziehe die vier gelben Punkte auf die Ecken des Blatts – oder auf die Ecken des Teils, der zu sehen ist. Die dicke Linie mit „oben“ gehört an den oberen Rand der Schrift. Die App rechnet das Blatt dann gerade. Steht die Schrift auf dem Kopf oder spiegelverkehrt: „Drehen“ oder „Spiegeln“.',
    ),
  );
  const handOnly = h(
    'div',
    { class: 'hand-help' },
    h('p', null, h('b', null, 'So geht es mit Handy oder Tablet: '), 'Beim Spielen auf „Fertig!“ tippen – dann geht die Kamera auf. Das Gerät ruhig über das Blatt halten, bis alles im Rahmen ist, und auf den runden Knopf tippen.'),
    h('p', { class: 'help' }, 'Die Kamera ist nur an, solange der Sucher offen ist. Am besten das Gerät quer halten: dann ist das Spiel am größten.'),
  );
  const tips = h('ul', { class: 'help', style: 'padding-left:1.2em;margin:0' });
  const showMode = () => {
    if (cam.mode === 'spiegel' && !cam.quad) cam.quad = structuredClone(DEFAULT_QUAD);
    fixedOnly.style.display = cam.mode === 'fest' ? '' : 'none';
    mirrorOnly.style.display = cam.mode === 'spiegel' ? '' : 'none';
    handOnly.style.display = cam.mode === 'hand' ? '' : 'none';
    wrap.classList.toggle('roi', cam.mode !== 'hand');
    tips.replaceChildren(
      ...(cam.mode === 'hand'
        ? ['Gutes Licht, kein Schatten vom Gerät auf dem Blatt (🔦 hilft)', 'Das Blatt flach hinlegen', 'Beim Auslösen kurz ganz still halten', 'Datenschutz: nur das Papier fotografieren, keine Gesichter']
        : cam.mode === 'spiegel'
          ? ['Das Blatt immer an dieselbe Stelle vor das Tablet legen (z. B. mit Klebeband markieren)', 'Groß und kräftig schreiben: hinten auf dem Blatt wird die Schrift im Bild klein', 'Gutes Licht von oben, Schatten der Hand vermeiden', 'Datenschutz: nur das Papier ins Bild, keine Gesichter']
          : ['Filzstift oder weicher Bleistift (B/2B)', 'Licht der Dokumentenkamera einschalten, Schatten vermeiden', 'Zwischen den Buchstaben etwas Platz lassen', 'Bei Zetteln: dunkle Unterlage hilft', 'Datenschutz: nur das Papier filmen, keine Gesichter']
      ).map((t) => h('li', null, t)),
    );
  };
  const modeSwitch = segmented(
    [
      { value: 'fest', label: '📽️ Kamera steht fest' },
      { value: 'hand', label: '📱 Handy/Tablet in der Hand' },
      { value: 'spiegel', label: '🪞 Tablet mit Spiegel' },
    ],
    cam.mode,
    (v: CameraMode) => {
      d.setMode(v);
      lastScan = null;
      showMode();
      if (!msg.isConnected) wrap.prepend(msg);
      msg.textContent = 'Kamera wird gestartet …';
      void start(undefined);
    },
    'cam-mode',
  );

  const content = h(
    'div',
    null,
    h('h2', null, '📷 Kamera einrichten'),
    h('div', { class: 'row' }, modeSwitch),
    h(
      'div',
      { class: 'cam-setup' },
      h('div', null, wrap, errBox),
      h(
        'div',
        null,
        h('div', { class: 'row' }, h('label', { style: 'min-width:auto' }, 'Kamera'), select),
        handOnly,
        fixedOnly,
        mirrorOnly,
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
        tips,
      ),
    ),
    h('div', { class: 'actions' }, button('Fertig', () => m.close(), 'btn primary')),
  );
  showMode();
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
