// Phone or tablet in the hand: a full-screen viewfinder. The child holds the device over the paper and
// presses the big shutter. The camera only runs while the viewfinder is open.
import { CameraError, type Camera, type Grab } from '../camera/camera.ts';
import { button, h } from './dom.ts';

export interface ViewfinderOptions {
  camera: Camera;
  /** starts the camera (the app knows which one) */
  open: () => Promise<void>;
  /** takes the picture */
  grab: () => Promise<Grab>;
  /** e.g. "Foto für die Roten Raketen" */
  title: string;
  /** what has to be in the picture */
  hint: string;
  /** shape of the guide frame: a sheet of paper or a colouring card */
  frame?: 'sheet' | 'card';
}

/** Resolves with the photo, or null when the viewfinder was closed without one. */
export function openViewfinder(o: ViewfinderOptions): Promise<Grab | null> {
  return new Promise((resolve) => {
    const video = o.camera.video;
    video.className = 'vf-video';
    const msg = h('div', { class: 'vf-msg' }, 'Kamera startet …');
    const flash = h('div', { class: 'vf-flash' });
    const guide = h('div', { class: `vf-guide ${o.frame ?? 'sheet'}` }, h('i'), h('i'), h('i'), h('i'));
    const hint = h('div', { class: 'vf-hint' }, o.hint);
    let torch = false;
    const torchBtn = button('🔦', () => {
      torch = !torch;
      torchBtn.classList.toggle('on', torch);
      void o.camera.setTorch(torch);
    }, 'btn icon vf-torch', 'Licht an/aus');
    torchBtn.style.display = 'none';
    const shutter = button(h('span', { class: 'vf-dot' }), () => void shoot(), 'vf-shutter', 'Foto machen (Leertaste)');
    shutter.disabled = true;
    const back = h(
      'div',
      { class: 'modal-back viewfinder-back' },
      h(
        'div',
        { class: 'viewfinder', role: 'dialog', 'aria-modal': 'true', 'aria-label': o.title },
        video,
        guide,
        msg,
        h('div', { class: 'vf-top' }, button('✕', () => done(null), 'btn icon vf-close', 'Abbrechen (Esc)'), h('div', { class: 'vf-title' }, o.title), torchBtn),
        hint,
        shutter,
        flash,
      ),
    );
    let finished = false;
    const done = (g: Grab | null) => {
      if (finished) return;
      finished = true;
      document.removeEventListener('keydown', onKey, true);
      if (torch) void o.camera.setTorch(false);
      back.classList.add('closing');
      setTimeout(() => {
        back.remove();
        video.remove();
      }, 180);
      resolve(g);
    };
    const shoot = async () => {
      if (shutter.disabled || finished) return;
      shutter.disabled = true;
      hint.textContent = 'Ganz still halten …';
      try {
        const g = await o.grab();
        flash.classList.add('on');
        setTimeout(() => done(g), 220);
      } catch (e) {
        shutter.disabled = false;
        hint.textContent = (e as Error).message;
      }
    };
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        done(null);
      } else if (e.key === ' ' || e.key === 'Enter' || e.key === 'PageDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        void shoot();
      }
    };
    document.addEventListener('keydown', onKey, true);
    document.body.append(back);

    const start = async () => {
      msg.textContent = 'Kamera startet …';
      msg.style.display = '';
      try {
        if (!o.camera.ready()) await o.open();
        // iOS pauses a video that moves into the page
        await video.play().catch(() => undefined);
        if (finished) return;
        msg.style.display = 'none';
        shutter.disabled = false;
        if (o.camera.hasTorch()) torchBtn.style.display = '';
      } catch (e) {
        if (finished) return;
        msg.textContent = '';
        msg.append(
          h('b', null, e instanceof CameraError ? e.message : 'Die Kamera konnte nicht gestartet werden.'),
          h('p', null, e instanceof CameraError ? e.hint : String((e as Error).message ?? e)),
          button('Nochmal versuchen', () => void start(), 'btn primary'),
        );
      }
    };
    void start();
  });
}
