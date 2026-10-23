// In-game overlay: title, practice task, camera thumbnail, auto-scan ring, big "Fertig!" button.
import type { Settings } from '../app/settings.ts';
import type { Camera } from '../camera/camera.ts';
import { drawPencil, drawSchoolLines, drawWriting, writeDuration, writtenGlyph } from '../game/strokes.ts';
import { withArticle } from '../recog/classes.ts';
import type { PlayerId } from '../vision/types.ts';
import { button, h } from './dom.ts';

export interface HudDeps {
  title: string;
  settings: Settings;
  camera: Camera;
  practice: boolean;
  onScan: () => void;
  onMenu: () => void;
  onNewSheet: () => void;
  onToggleAuto: () => void;
  onFullscreen: () => void;
  onCamera: () => void;
  /** save the game under a name or as a file */
  onSave?: () => void;
  /** label of the "new sheet" button */
  newSheetLabel?: string;
  /** the animated template in the task was tapped (show the big demonstration again) */
  onTemplate?: () => void;
  /** team modes: one button per team takes the photo for that team (like the number keys) */
  teams?: { id: PlayerId; name: string; color: string }[];
  onTeamScan?: (id: PlayerId) => void;
}

export class Hud {
  root: HTMLElement;
  private go: HTMLButtonElement;
  private goLabel: HTMLElement;
  private titleEl: HTMLElement;
  private task: HTMLElement | null = null;
  /** the practice letter writes itself in the task, again and again */
  private writing: HTMLCanvasElement | null = null;
  private writeChar = '';
  private writeStart = 0;
  private raf = 0;
  private counter: HTMLElement;
  private cam: HTMLCanvasElement;
  private autoBtn: HTMLButtonElement;
  private ring: SVGCircleElement;
  private d: HudDeps;
  private timer = 0;
  private idle = 0;
  private wake = () => {
    this.idle = 0;
    this.root.classList.remove('idle-fade');
  };

  constructor(parent: HTMLElement, d: HudDeps) {
    this.d = d;
    this.titleEl = h('div', { class: 'hud-title' }, d.title);
    this.cam = h('canvas', { width: 256, height: 144 });
    const thumb = h('div', { class: 'camthumb', title: 'Kamera einrichten' }, this.cam, h('span', { class: 'camlabel' }, '📷'));
    thumb.addEventListener('click', d.onCamera);
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 64 64');
    this.ring = document.createElementNS(ns, 'circle');
    this.ring.setAttribute('cx', '32');
    this.ring.setAttribute('cy', '32');
    this.ring.setAttribute('r', '29');
    this.ring.setAttribute('fill', 'none');
    this.ring.setAttribute('stroke', '#27c46b');
    this.ring.setAttribute('stroke-width', '5');
    this.ring.setAttribute('stroke-linecap', 'round');
    this.ring.setAttribute('transform', 'rotate(-90 32 32)');
    this.ring.style.strokeDasharray = `${2 * Math.PI * 29}`;
    this.ring.style.strokeDashoffset = `${2 * Math.PI * 29}`;
    svg.append(this.ring);
    this.autoBtn = button('👁', d.onToggleAuto, 'btn icon auto-btn', 'Automatisch scannen (A)');
    this.autoBtn.append(svg);
    if (d.practice) {
      this.task = h('div', { class: 'task' });
      this.writing = h('canvas', { class: 'writing', title: 'So schreibt man ihn – antippen zum Zeigen' });
      this.writing.addEventListener('click', () => d.onTemplate?.());
      this.raf = requestAnimationFrame(this.animate);
    }
    this.goLabel = h('span', null, 'Fertig!');
    this.go = button([h('span', { class: 'spin' }), '✓ ', this.goLabel], d.onScan, 'btn primary go-btn', 'Scannen (Leertaste)');
    this.counter = h('div', { class: 'counter' });
    this.root = h(
      'div',
      { class: 'hud' },
      h(
        'div',
        { class: 'hud-top' },
        button('⌂', d.onMenu, 'btn icon', 'Menü (Esc)'),
        this.titleEl,
        this.task,
        h(
          'div',
          { class: `hud-right${this.task ? '' : ' no-task'}` },
          thumb,
          h(
            'div',
            { class: 'hud-buttons' },
            this.autoBtn,
            d.onSave ? button('💾', d.onSave, 'btn icon', 'Spiel speichern (S)') : null,
            button('⛶', d.onFullscreen, 'btn icon', 'Vollbild (F)'),
          ),
        ),
      ),
      h(
        'div',
        { class: 'hud-bottom' },
        h('div', { class: 'side-btns' }, button(d.newSheetLabel ?? '🗒 Neues Blatt', d.onNewSheet, 'btn small', `${(d.newSheetLabel ?? 'Neues Blatt').replace(/^\S+ /, '')} (N)`)),
        this.go,
        d.teams?.length
          ? h(
              'div',
              { class: `team-btns${d.teams.length > 4 ? ' compact' : ''}` },
              ...d.teams.map((t, i) =>
                button(
                  [h('span', { class: 'dot', style: `background:${t.color}` }, String(i + 1)), h('span', { class: 'name' }, t.name)],
                  () => d.onTeamScan?.(t.id),
                  'btn team-btn',
                  `Foto nur für ${t.name} (Taste ${i + 1})`,
                ),
              ),
            )
          : null,
        this.counter,
      ),
    );
    parent.append(this.root);
    this.timer = window.setInterval(() => this.drawCam(), 100);
    window.addEventListener('pointermove', this.wake);
    window.addEventListener('pointerdown', this.wake);
  }

  private drawCam(): void {
    this.idle += 0.1;
    if (this.idle > 6) this.root.classList.add('idle-fade');
    const cam = this.d.camera;
    if (!cam.ready()) return;
    const s = this.d.settings.camera;
    const roi = s.roi;
    // draw oriented preview, cropped to the ROI
    const tmp = this.cam;
    const ok = cam.preview(tmp, s, 256);
    if (ok && roi) {
      const c = tmp.getContext('2d')!;
      const img = c.getImageData(roi.x * tmp.width, roi.y * tmp.height, Math.max(1, roi.w * tmp.width), Math.max(1, roi.h * tmp.height));
      tmp.width = img.width;
      tmp.height = img.height;
      c.putImageData(img, 0, 0);
    }
  }

  setTitle(t: string): void {
    this.titleEl.textContent = t;
  }

  setBusy(busy: boolean, busyLabel = 'Schaue …'): void {
    this.go.classList.toggle('busy', busy);
    this.goLabel.textContent = busy ? busyLabel : 'Fertig!';
  }

  setCounter(text: string): void {
    this.counter.textContent = text;
    this.counter.style.display = text ? '' : 'none';
  }

  /** practice task; with several letters a small queue shows which are done and which come next */
  setTask(target: string, done: number, count: number, list: string[] = [target], index = 0): void {
    if (!this.task) return;
    const style = this.d.settings.recog.style === 'druck' ? 'glyph druck' : 'glyph';
    const n = Math.min(done, count);
    this.task.innerHTML = '';
    if (target !== this.writeChar) {
      this.writeChar = target;
      this.writeStart = performance.now();
    }
    const known = !!writtenGlyph(target, false);
    this.task.append(
      h('span', null, `Schreibe ${count}× ${withArticle(target).split(' ')[0]}`),
      known && this.writing ? this.writing : h('span', { class: style }, target),
      h('span', { class: 'stars' }, '★'.repeat(n), h('span', { class: 'off' }, '★'.repeat(Math.max(0, count - n)))),
    );
    if (list.length > 1) {
      this.task.append(h('span', { class: 'task-queue', title: 'Reihenfolge' }, ...list.map((c, i) => h('span', { class: i < index ? 'done' : i === index ? 'now' : '' }, c))));
    }
  }

  setAuto(on: boolean, progress: number): void {
    this.autoBtn.classList.toggle('on', on);
    const c = 2 * Math.PI * 29;
    this.ring.style.strokeDashoffset = `${c * (1 - progress)}`;
  }

  private animate = (now: number): void => {
    this.raf = requestAnimationFrame(this.animate);
    const cv = this.writing;
    if (!cv || !cv.isConnected || !this.writeChar) return;
    const s = this.d.settings;
    const g = writtenGlyph(this.writeChar, s.recog.style !== 'druck');
    if (!g) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cssH = cv.clientHeight || 60;
    const unit = (cssH * dpr) / 3.4;
    const W = Math.ceil(Math.max(2.4, g.w + 0.9) * unit);
    const H = Math.ceil(cssH * dpr);
    if (cv.width !== W || cv.height !== H) {
      cv.width = W;
      cv.height = H;
      cv.style.width = `${W / dpr}px`;
    }
    const ctx = cv.getContext('2d')!;
    ctx.clearRect(0, 0, W, H);
    const top = unit * 0.2;
    drawSchoolLines(ctx, 0, W, top, unit, s.recog.lineatur === 'L3' ? 2 : 4);
    // write, hold, write again
    const dur = writeDuration(g);
    const t = ((now - this.writeStart) / 1000) % (dur + 1.8);
    const pen = drawWriting(ctx, g, (W - g.w * unit) / 2, top, t, { unit, ink: '#7c5cff', ghost: true, pen: 0.2 });
    if (pen) drawPencil(ctx, (W - g.w * unit) / 2 + pen.x * unit, top + pen.y * unit, unit / 45);
  };

  destroy(): void {
    cancelAnimationFrame(this.raf);
    clearInterval(this.timer);
    window.removeEventListener('pointermove', this.wake);
    window.removeEventListener('pointerdown', this.wake);
    this.root.remove();
  }
}
