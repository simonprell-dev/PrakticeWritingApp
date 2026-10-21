// In-game overlay: title, practice task, camera thumbnail, auto-scan ring, big "Fertig!" button.
import type { Settings } from '../app/settings.ts';
import type { Camera } from '../camera/camera.ts';
import { withArticle } from '../recog/classes.ts';
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
}

export class Hud {
  root: HTMLElement;
  private go: HTMLButtonElement;
  private goLabel: HTMLElement;
  private titleEl: HTMLElement;
  private task: HTMLElement | null = null;
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
    if (d.practice) this.task = h('div', { class: 'task' });
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
          h('div', { class: 'hud-buttons' }, this.autoBtn, button('⛶', d.onFullscreen, 'btn icon', 'Vollbild (F)')),
        ),
      ),
      h('div', { class: 'hud-bottom' }, h('div', { class: 'side-btns' }, button('🗒 Neues Blatt', d.onNewSheet, 'btn small', 'Neues Blatt (N)')), this.go, this.counter),
    );
    parent.append(this.root);
    this.timer = window.setInterval(() => this.drawCam(), 100);
    window.addEventListener('pointermove', this.wake);
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

  setBusy(busy: boolean, label = 'Fertig!'): void {
    this.go.classList.toggle('busy', busy);
    this.goLabel.textContent = busy ? 'Schaue …' : label;
  }

  setCounter(text: string): void {
    this.counter.textContent = text;
    this.counter.style.display = text ? '' : 'none';
  }

  setTask(target: string, done: number, count: number): void {
    if (!this.task) return;
    const style = this.d.settings.recog.style === 'druck' ? 'glyph druck' : 'glyph';
    const n = Math.min(done, count);
    this.task.innerHTML = '';
    this.task.append(
      h('span', null, `Schreibe ${count}× ${withArticle(target).split(' ')[0]}`),
      h('span', { class: style }, target),
      h('span', { class: 'stars' }, '★'.repeat(n), h('span', { class: 'off' }, '★'.repeat(Math.max(0, count - n)))),
    );
  }

  setAuto(on: boolean, progress: number): void {
    this.autoBtn.classList.toggle('on', on);
    const c = 2 * Math.PI * 29;
    this.ring.style.strokeDashoffset = `${c * (1 - progress)}`;
  }

  destroy(): void {
    clearInterval(this.timer);
    window.removeEventListener('pointermove', this.wake);
    this.root.remove();
  }
}
