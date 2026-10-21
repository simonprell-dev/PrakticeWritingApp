import './ui/styles.css';
import { App } from './app/app.ts';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const ui = document.getElementById('ui') as HTMLElement;
document.getElementById('loading')?.remove();
const app = new App(canvas, ui);
// test hook for the end-to-end checks (only with ?debug)
if (new URLSearchParams(location.search).has('debug')) (window as unknown as { __app: App }).__app = app;

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
