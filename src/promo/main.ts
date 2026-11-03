// /vorstellung: the presentation film with subtitles, info cards and chapters.
import './promo.css';
import { chapters, FEATURES, H, length, overlay, renderFilm, W } from './film.ts';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;

const stage = $('.stage');
const canvas = $<HTMLCanvasElement>('.stage canvas');
const ctx = canvas.getContext('2d')!;
const sub = $('.sub');
const info = $('.info');
const title = $('.ov-title');
const feats = $('.ov-features');
const outro = $('.ov-outro');
const playBtn = $<HTMLButtonElement>('.play');
const bigPlay = $<HTMLButtonElement>('.big-play');
const bar = $('.bar');
const fill = $('.bar-fill');
const clock = $('.clock');
const chapterList = $('.chapters');

let t = 0;
let playing = false;
let last = 0;
let total = 1;

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

function resize(): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(stage.clientWidth * dpr);
  canvas.height = Math.round(stage.clientHeight * dpr);
  draw();
}

let shownSub = '';
let shownInfo = '';
let shownMode = '';
function draw(): void {
  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  renderFilm(ctx, t);
  const o = overlay(t);
  if (o.sub !== shownSub) {
    shownSub = o.sub;
    sub.textContent = o.sub;
    sub.hidden = !o.sub;
  }
  const key = o.info ? o.info.title : '';
  if (key !== shownInfo) {
    shownInfo = key;
    info.replaceChildren();
    info.hidden = !o.info;
    if (o.info) {
      const h = document.createElement('h3');
      h.textContent = o.info.title;
      const ul = document.createElement('ul');
      for (const p of o.info.points) {
        const li = document.createElement('li');
        li.textContent = p;
        ul.append(li);
      }
      info.append(h, ul);
      info.classList.remove('in');
      void info.offsetWidth;
      info.classList.add('in');
    }
  }
  if (o.mode !== shownMode) {
    shownMode = o.mode ?? '';
    title.hidden = o.mode !== 'title';
    feats.hidden = o.mode !== 'features';
    outro.hidden = o.mode !== 'outro';
  }
  [...feats.children].forEach((c, i) => c.classList.toggle('on', i < o.features));
  fill.style.width = `${(t / total) * 100}%`;
  clock.textContent = `${fmt(t)} / ${fmt(total)}`;
  const ch = chapters();
  let cur = 0;
  ch.forEach((c, i) => {
    if (t >= c.at) cur = i;
  });
  [...chapterList.children].forEach((c, i) => c.classList.toggle('on', i === cur));
}

function frame(now: number): void {
  if (playing) {
    t += Math.min(0.1, (now - last) / 1000);
    if (t >= total) {
      t = total;
      setPlaying(false);
    }
  }
  last = now;
  draw();
  requestAnimationFrame(frame);
}

function setPlaying(on: boolean): void {
  if (on && t >= total) t = 0;
  playing = on;
  playBtn.textContent = on ? '⏸' : '▶';
  playBtn.setAttribute('aria-label', on ? 'Pause' : 'Abspielen');
  bigPlay.hidden = on;
}

function seek(to: number): void {
  t = Math.max(0, Math.min(total, to));
  draw();
}

async function start(): Promise<void> {
  // the creatures' letters are drawn with the school fonts, so they must be there first
  await Promise.allSettled([document.fonts.load("90px 'Grundschrift'"), document.fonts.load("600 40px 'Fredoka'"), document.fonts.load("90px 'Druckvorlage'")]);
  total = length();
  for (const [icon, head, text] of FEATURES) {
    const card = document.createElement('div');
    card.className = 'feat';
    card.innerHTML = `<span class="feat-icon"></span><b></b><span class="feat-text"></span>`;
    card.children[0].textContent = icon;
    card.children[1].textContent = head;
    card.children[2].textContent = text;
    feats.append(card);
  }
  for (const c of chapters()) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = c.title;
    b.addEventListener('click', () => {
      seek(c.at);
      setPlaying(true);
    });
    chapterList.append(b);
    const mark = document.createElement('span');
    mark.className = 'mark';
    mark.style.left = `${(c.at / total) * 100}%`;
    bar.append(mark);
  }
  playBtn.addEventListener('click', () => setPlaying(!playing));
  bigPlay.addEventListener('click', () => setPlaying(true));
  canvas.addEventListener('click', () => setPlaying(!playing));
  $('.again').addEventListener('click', () => {
    seek(0);
    setPlaying(true);
  });
  const fromBar = (e: PointerEvent) => {
    const r = bar.getBoundingClientRect();
    seek(((e.clientX - r.left) / r.width) * total);
  };
  bar.addEventListener('pointerdown', (e) => {
    bar.setPointerCapture(e.pointerId);
    fromBar(e);
  });
  bar.addEventListener('pointermove', (e) => {
    if (bar.hasPointerCapture(e.pointerId)) fromBar(e);
  });
  document.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLButtonElement && (e.key === ' ' || e.key === 'Enter')) return;
    if (e.key === ' ' || e.key === 'k') {
      e.preventDefault();
      setPlaying(!playing);
    } else if (e.key === 'ArrowRight') seek(t + 5);
    else if (e.key === 'ArrowLeft') seek(t - 5);
  });
  new ResizeObserver(resize).observe(stage);
  resize();
  const e2e = new URLSearchParams(location.search).get('t');
  if (e2e) seek(Number(e2e));
  else setPlaying(!matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (!playing) bigPlay.hidden = false;
  (window as unknown as { __promo: unknown }).__promo = { seek, setPlaying, total };
  requestAnimationFrame((now) => {
    last = now;
    frame(now);
  });
}

void start();
