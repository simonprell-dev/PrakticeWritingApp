// The first visit: the start screen with a welcome window. It explains the game in two sentences, asks how
// it is played (fixed camera or phone/tablet) and whether games may be kept on this device. The browser asks
// for the camera only when "Kamera einrichten" is pressed.
import type { CameraMode } from '../app/settings.ts';
import { button, h, modal, segmented, toggle } from './dom.ts';
import { openLegal } from './legal.ts';

export interface WelcomeDeps {
  mode: CameraMode;
  autosave: boolean | null;
  setMode: (mode: CameraMode) => void;
  setAutosave: (on: boolean) => void;
  /** opens the camera wizard (the browser asks for the camera there) */
  setupCamera: () => void;
  /** the welcome window was seen */
  done: () => void;
}

export function openWelcome(d: WelcomeDeps): void {
  let next: (() => void) | null = null;
  const content = h(
    'div',
    { class: 'welcome' },
    h('div', { class: 'welcome-wave', 'aria-hidden': 'true' }, '👋'),
    h('h2', null, 'Willkommen bei Krakel & Krone!'),
    h('p', { class: 'welcome-lead' }, 'Kinder schreiben oder malen auf Papier, eine Kamera schaut zu – daraus werden kleine Wesen.'),
    h('h3', null, 'Womit spielt ihr?'),
    segmented(
      [
        { value: 'fest', label: '📽️ Dokumentenkamera oder Webcam' },
        { value: 'hand', label: '📱 Handy oder Tablet' },
      ],
      d.mode,
      (v: CameraMode) => d.setMode(v),
      'cam-mode',
    ),
    h(
      'div',
      { class: 'welcome-keep' },
      toggle('💾 Spiele auf diesem Gerät merken', d.autosave === true, (on) => d.setAutosave(on)),
      h('p', { class: 'help' }, 'Dann könnt ihr später weiterspielen. Gespeichert werden nur Buchstaben und Bilder (keine Fotos), nur in diesem Browser.'),
    ),
    h(
      'p',
      { class: 'help' },
      'Gleich fragt der Browser nach der Kamera. Die Bilder bleiben auf diesem Gerät, Cookies gibt es keine. ',
      button('Datenschutz', () => {
        next = () => void openLegal('datenschutz');
        m.close();
      }, 'btn-link'),
    ),
    h(
      'div',
      { class: 'actions' },
      button('Erst mal umschauen', () => m.close(), 'btn'),
      button(
        '📷 Kamera einrichten',
        () => {
          next = d.setupCamera;
          m.close();
        },
        'btn primary',
      ),
    ),
  );
  const m = modal(content, () => {
    d.done();
    next?.();
  });
}
