// In-game overlay: title, practice task, camera thumbnail, auto-scan ring, big "Fertig!" button.
import { saveSettings, type Settings } from '../app/settings.ts';
import { setSound } from '../game/audio.ts';
import { hushAll } from '../game/voice/speaker.ts';
import type { Camera } from '../camera/camera.ts';
import { drawGuideLines, drawPencil, drawWriting, writeDuration, writtenGlyph } from '../game/strokes.ts';
import { isDigit } from '../recog/classes.ts';
import { strokeStyle } from '../recog/scripts.ts';
import type { PlayerId } from '../vision/types.ts';
import { button, h } from './dom.ts';
import { fairBadge } from './fairBadge.ts';
import { t } from '../i18n/i18n.ts';

export interface HudDeps {
  title: string;
  settings: Settings;
  camera: Camera;
  /** phone or tablet in the hand: no live camera picture, no automatic scans */
  handheld?: boolean;
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
  /** the counter was tapped (Mal-Aquarium: show all animals) */
  onCounter?: () => void;
}

export class Hud {
  /** sound and reading aloud on or off; kept in the settings, a running story stops at once */
  toggleSound(): void {
    const g = this.d.settings.game;
    g.sound = !g.sound;
    saveSettings(this.d.settings);
    setSound(g.sound, g.volume);
    if (!g.sound) hushAll();
    this.showSound();
  }

  private showSound(): void {
    const on = this.d.settings.game.sound;
    this.soundBtn.textContent = on ? '🔊' : '🔇';
    this.soundBtn.setAttribute('aria-pressed', String(!on));
  }

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
  private fair: HTMLElement | null = null;
  private cam: HTMLCanvasElement;
  private autoBtn: HTMLButtonElement;
  private soundBtn: HTMLButtonElement;
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
    const thumb = h('div', { class: 'camthumb', title: t('Kamera einrichten') }, this.cam, h('span', { class: 'camlabel' }, '📷'));
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
    this.autoBtn = button('👁', d.onToggleAuto, 'btn icon auto-btn', t('Automatisch scannen (A)'));
    this.soundBtn = button('', () => this.toggleSound(), 'btn icon sound-btn', t('Ton an oder aus (M)'));
    this.showSound();
    this.autoBtn.append(svg);
    if (d.practice) {
      this.task = h('div', { class: 'task' });
      this.writing = h('canvas', { class: 'writing', title: t('So schreibt man ihn – antippen zum Zeigen') });
      this.writing.addEventListener('click', () => d.onTemplate?.());
      this.raf = requestAnimationFrame(this.animate);
    }
    this.goLabel = h('span', null, t('Fertig!'));
    this.go = button([h('span', { class: 'spin' }), h('span', { class: 'go-icon' }), this.goLabel], d.onScan, 'btn primary go-btn', t('Foto machen (Leertaste)'));
    this.counter = d.onCounter ? button('', d.onCounter, 'counter clickable', t('Alle Tiere ansehen')) : h('div', { class: 'counter' });
    this.root = h(
      'div',
      { class: 'hud' },
      h(
        'div',
        { class: 'hud-top' },
        button('⌂', d.onMenu, 'btn icon', t('Menü (Esc)')),
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
            this.soundBtn,
            d.onSave ? button('💾', d.onSave, 'btn icon', t('Spiel speichern (S)')) : null,
            button('⛶', d.onFullscreen, 'btn icon', t('Vollbild (F)')),
          ),
        ),
      ),
      h(
        'div',
        { class: 'hud-bottom' },
        h('div', { class: 'side-btns' }, button(d.newSheetLabel ?? t('🗒 Neues Blatt'), d.onNewSheet, 'btn small', `${d.newSheetLabel ? d.newSheetLabel.replace(/^\S+ /, '') : t('Neues Blatt')} (N)`)),
        this.go,
        d.teams?.length
          ? h(
              'div',
              { class: `team-btns${d.teams.length > 4 ? ' compact' : ''}` },
              ...d.teams.map((tm, i) =>
                button(
                  [h('span', { class: 'dot', style: `background:${tm.color}` }, String(i + 1)), h('span', { class: 'name' }, tm.name)],
                  () => d.onTeamScan?.(tm.id),
                  'btn team-btn',
                  t('Foto nur für {name} (Taste {n})', { name: tm.name, n: i + 1 }),
                ),
              ),
            )
          : null,
        this.counter,
      ),
    );
    this.setHandheld(!!d.handheld);
    parent.append(this.root);
    this.timer = window.setInterval(() => this.drawCam(), 100);
    window.addEventListener('pointermove', this.wake);
    window.addEventListener('pointerdown', this.wake);
  }

  /** a camera in the hand: "Fertig!" opens the viewfinder, there is no live picture */
  setHandheld(on: boolean): void {
    this.d.handheld = on;
    this.root.classList.toggle('handheld', on);
  }

  private drawCam(): void {
    this.idle += 0.1;
    if (this.idle > 6) this.root.classList.add('idle-fade');
    if (this.d.handheld) return;
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

  /** trade fair mode: QR code and web address in the corner */
  setFair(on: boolean): void {
    this.fair?.remove();
    this.fair = on ? fairBadge() : null;
    if (this.fair) this.root.append(this.fair);
  }

  setTitle(t: string): void {
    this.titleEl.textContent = t;
  }

  setBusy(busy: boolean, busyLabel = t('Schaue …')): void {
    this.go.classList.toggle('busy', busy);
    this.goLabel.textContent = busy ? busyLabel : t('Fertig!');
  }

  setCounter(text: string): void {
    this.counter.textContent = text;
    this.counter.style.display = text ? '' : 'none';
  }

  /** practice task; with several letters a small queue shows which are done and which come next */
  setTask(target: string, done: number, count: number, list: string[] = [target], index = 0): void {
    if (!this.task) return;
    const s = this.d.settings;
    const stroke = strokeStyle(s.script, s.recog.style);
    // other scripts are shown in their own font (CSS variable --script-font)
    const style = s.script !== 'druck' && s.script !== 'grund' ? 'glyph script' : stroke === 'druck' ? 'glyph druck' : 'glyph';
    const n = Math.min(done, count);
    this.task.innerHTML = '';
    if (target !== this.writeChar) {
      this.writeChar = target;
      this.writeStart = performance.now();
    }
    const known = !!stroke && !!writtenGlyph(target, stroke);
    this.task.append(
      // the letter itself follows as its own element (animated template or glyph)
      h('span', null, isDigit(target) ? t('Schreibe {n}× die', { n: count }) : t('Schreibe {n}× das', { n: count })),
      known && this.writing ? this.writing : h('span', { class: style }, target),
      h('span', { class: 'stars' }, '★'.repeat(n), h('span', { class: 'off' }, '★'.repeat(Math.max(0, count - n)))),
    );
    if (list.length > 1) {
      this.task.append(h('span', { class: 'task-queue', title: t('Reihenfolge') }, ...list.map((c, i) => h('span', { class: i < index ? 'done' : i === index ? 'now' : '' }, c))));
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
    const st = strokeStyle(s.script, s.recog.style);
    const g = st ? writtenGlyph(this.writeChar, st) : null;
    if (!g) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cssH = cv.clientHeight || 60;
    // room above the top line for the dots of Ä, Ö, Ü (half a band up), below the bottom line a little;
    // kana have only their square box (2 bands) and can be bigger
    const unit = (cssH * dpr) / (g.box ? 2.5 : 3.75);
    const W = Math.ceil(Math.max(2.4, g.w + (g.box ? 0.6 : 0.9)) * unit);
    const H = Math.ceil(cssH * dpr);
    if (cv.width !== W || cv.height !== H) {
      cv.width = W;
      cv.height = H;
      cv.style.width = `${W / dpr}px`;
    }
    const ctx = cv.getContext('2d')!;
    ctx.clearRect(0, 0, W, H);
    const top = unit * (g.box ? 0.25 : 0.55);
    drawGuideLines(ctx, g, 0, W, top, unit, s.recog.lineatur === 'L3' ? 2 : 4);
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
