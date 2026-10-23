// Recording page for the voice lines (voice.html, development only). Shows the lines of
// voice/lines.json one by one; space records, the take is trimmed (silence at both ends) and saved as
// WAV under its file name into a chosen folder (best: public/voice/).

interface Line {
  id: string;
  text: string;
  speaker: string;
  where: string;
  partOf?: string;
}

const SPEAKER: Record<string, string> = {
  erzaehler: 'Erzähler/in – freundlich, ruhig, deutlich',
  wesen: 'Wesen – niedlich, fröhlich',
  zork: 'Alien Zork – hell, quirlig, frech',
  riese: 'Riese Rumpel – tief, polternd, gutmütig',
  blase: 'Überraschungsblase – geheimnisvoll-fröhlich',
  ausruf: 'Ausruf – kurz, lautmalerisch',
  buchstaben: 'Buchstabe – deutlich wie beim Diktat',
};
const RATE = 24000;

type DirHandle = FileSystemDirectoryHandle & { values(): AsyncIterable<FileSystemHandle> };

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
let lines: Line[] = [];
let index = 0;
let onlyMissing = false;
const done = new Set<string>();
let dir: DirHandle | null = null;
let stream: MediaStream | null = null;
let recorder: MediaRecorder | null = null;
let chunks: Blob[] = [];
let lastTake: { id: string; wav: Blob } | null = null;
let meterRaf = 0;
const ac = new AudioContext();

function say(text: string): void {
  $('#status').textContent = text;
}

function visible(): Line[] {
  return onlyMissing ? lines.filter((l) => !done.has(l.id)) : lines;
}

function render(): void {
  const l = lines[index];
  if (!l) return;
  $('#nr').textContent = `${index + 1} / ${lines.length}`;
  $('#who').textContent = SPEAKER[l.speaker] ?? l.speaker;
  $('#text').textContent = l.text;
  $('#where').textContent = l.partOf ? `${l.where} · Teil von „${l.partOf}“` : l.where;
  $('#file').textContent = `${l.id}.wav`;
  $('#done').textContent = done.has(l.id) ? '✓ schon aufgenommen' : '';
  $('#count').textContent = `${done.size} von ${lines.length} aufgenommen`;
  const list = $('#list');
  list.innerHTML = '';
  for (const v of visible()) {
    const i = lines.indexOf(v);
    const li = document.createElement('li');
    li.textContent = `${i + 1}. ${v.text}`;
    li.className = `${done.has(v.id) ? 'ok' : ''} ${i === index ? 'now' : ''}`;
    li.onclick = () => {
      index = i;
      render();
    };
    list.append(li);
  }
  list.querySelector('.now')?.scrollIntoView({ block: 'nearest' });
}

function go(step: number): void {
  const vis = visible();
  if (!vis.length) return;
  const pos = vis.indexOf(lines[index]);
  const next = vis[Math.min(vis.length - 1, Math.max(0, (pos < 0 ? 0 : pos) + step))];
  index = lines.indexOf(next);
  render();
}

async function pickFolder(): Promise<void> {
  const pick = (window as unknown as { showDirectoryPicker?: (o: object) => Promise<DirHandle> }).showDirectoryPicker;
  if (!pick) {
    say('Dieser Browser kann keinen Ordner wählen – die Aufnahmen werden heruntergeladen.');
    return;
  }
  dir = await pick({ mode: 'readwrite', id: 'krakel-voice' });
  done.clear();
  for await (const h of dir.values()) if (h.kind === 'file' && h.name.endsWith('.wav')) done.add(h.name.slice(0, -4));
  $('#folder').textContent = `📁 ${dir.name}`;
  say(`${done.size} Aufnahmen im Ordner gefunden.`);
  render();
}

function meter(an: AnalyserNode): void {
  const buf = new Float32Array(an.fftSize);
  const tick = () => {
    an.getFloatTimeDomainData(buf);
    let peak = 0;
    for (const v of buf) peak = Math.max(peak, Math.abs(v));
    $('#level').style.width = `${Math.min(100, peak * 140)}%`;
    meterRaf = requestAnimationFrame(tick);
  };
  tick();
}

async function startRecording(): Promise<void> {
  if (!stream) stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: true } });
  await ac.resume();
  const an = ac.createAnalyser();
  ac.createMediaStreamSource(stream).connect(an);
  meter(an);
  chunks = [];
  recorder = new MediaRecorder(stream);
  recorder.ondataavailable = (e) => chunks.push(e.data);
  recorder.onstop = () => void finish();
  recorder.start();
  document.body.classList.add('rec');
  say('● Aufnahme läuft – Leertaste zum Stoppen');
}

function stopRecording(): void {
  recorder?.stop();
  cancelAnimationFrame(meterRaf);
  $('#level').style.width = '0';
  document.body.classList.remove('rec');
}

/** cuts the silence at both ends (keeps a little air) */
function trim(data: Float32Array, rate: number): Float32Array {
  const win = Math.round(rate * 0.02);
  const rms: number[] = [];
  for (let i = 0; i < data.length; i += win) {
    let s = 0;
    for (let k = i; k < Math.min(data.length, i + win); k++) s += data[k] * data[k];
    rms.push(Math.sqrt(s / win));
  }
  const peak = Math.max(...rms, 1e-6);
  const thr = Math.max(0.01, peak * 0.08);
  const first = rms.findIndex((v) => v > thr);
  const last = rms.length - 1 - [...rms].reverse().findIndex((v) => v > thr);
  if (first < 0) return data;
  const pad = Math.round(rate * 0.08);
  return data.slice(Math.max(0, first * win - pad), Math.min(data.length, (last + 1) * win + pad));
}

function wav(data: Float32Array, rate: number): Blob {
  const buf = new ArrayBuffer(44 + data.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + data.length * 2, true);
  str(8, 'WAVEfmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, data.length * 2, true);
  // normalise gently to -1 dBFS
  let peak = 1e-6;
  for (const x of data) peak = Math.max(peak, Math.abs(x));
  const gain = Math.min(4, 0.89 / peak);
  for (let i = 0; i < data.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, data[i] * gain)) * 0x7fff, true);
  return new Blob([buf], { type: 'audio/wav' });
}

async function finish(): Promise<void> {
  const l = lines[index];
  const raw = await new Blob(chunks).arrayBuffer();
  const decoded = await ac.decodeAudioData(raw);
  // mono, 24 kHz
  const off = new OfflineAudioContext(1, Math.ceil(decoded.duration * RATE), RATE);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  const mono = (await off.startRendering()).getChannelData(0);
  const cut = trim(mono, RATE);
  lastTake = { id: l.id, wav: wav(cut, RATE) };
  await play(lastTake.wav);
  await save();
}

async function save(): Promise<void> {
  if (!lastTake) return;
  const name = `${lastTake.id}.wav`;
  if (dir) {
    const fh = await dir.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(lastTake.wav);
    await w.close();
  } else {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(lastTake.wav);
    a.download = name;
    a.click();
  }
  done.add(lastTake.id);
  say(`✓ gespeichert: ${name} – weiter mit →, nochmal mit Leertaste`);
  render();
}

async function play(blob: Blob): Promise<void> {
  const audio = new Audio(URL.createObjectURL(blob));
  await audio.play().catch(() => undefined);
}

async function playSaved(): Promise<void> {
  const l = lines[index];
  if (lastTake?.id === l.id) return play(lastTake.wav);
  if (dir && done.has(l.id)) {
    const fh = await dir.getFileHandle(`${l.id}.wav`);
    return play(await fh.getFile());
  }
  say('Für diese Zeile gibt es noch keine Aufnahme.');
}

async function main(): Promise<void> {
  try {
    lines = await (await fetch('/voice/lines.json')).json();
  } catch {
    say('voice/lines.json fehlt – bitte zuerst „npm run voice“ ausführen.');
    return;
  }
  $('#pick').onclick = () => void pickFolder();
  $('#rec').onclick = () => (recorder?.state === 'recording' ? stopRecording() : void startRecording());
  $('#play').onclick = () => void playSaved();
  $('#prev').onclick = () => go(-1);
  $('#next').onclick = () => go(1);
  $('#missing').onchange = (e) => {
    onlyMissing = (e.target as HTMLInputElement).checked;
    render();
  };
  window.addEventListener('keydown', (e) => {
    if (e.key === ' ') {
      e.preventDefault();
      if (recorder?.state === 'recording') stopRecording();
      else void startRecording();
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      go(1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      go(-1);
    } else if (e.key === 'Enter') void playSaved();
  });
  render();
  say('Ordner wählen (am besten public/voice), dann Leertaste: aufnehmen – Leertaste: stopp.');
}

void main();
