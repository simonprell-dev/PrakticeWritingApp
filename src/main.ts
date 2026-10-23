import './ui/styles.css';
import { App } from './app/app.ts';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const ui = document.getElementById('ui') as HTMLElement;
const app = new App(canvas, ui);
// the loading animation fades out over the freshly built start screen
const loading = document.getElementById('loading');
loading?.classList.add('done');
setTimeout(() => loading?.remove(), 500);
// test hook for the end-to-end checks (only with ?debug or ?e2e)
const q = new URLSearchParams(location.search);
if (q.has('debug') || q.has('e2e')) (window as unknown as { __app: App }).__app = app;

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
