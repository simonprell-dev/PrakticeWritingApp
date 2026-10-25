// End-to-end check in a real Chrome with a fake camera (Y4M from tools/make-fake-cam.ts).
// Usage: npm run build && node tools/make-fake-cam.ts && node tools/e2e.ts [saves|mobile]
// ("saves": only the Mal-Aquarium and saved games, "mobile": only phones and tablets)
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer, { type Page } from 'puppeteer-core';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUT = ROOT + 'tools/train/out/';
const PORT = 4173;
// Only the standalone test browser: managed Windows installs may force the real Chrome profile.
// Install with: npx @puppeteer/browsers install chrome-headless-shell@stable --path tools/.browsers
const SHELL_ROOT = ROOT + 'tools/.browsers/chrome-headless-shell/';
const CHROME = existsSync(SHELL_ROOT)
  ? readdirSync(SHELL_ROOT)
      .map((v) => `${SHELL_ROOT}${v}/chrome-headless-shell-win64/chrome-headless-shell.exe`)
      .find(existsSync)
  : undefined;
if (!CHROME) throw new Error('chrome-headless-shell not found, see comment above');

const server = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));

const errors: string[] = [];
const ONLY = process.argv[2];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function run(video: string, flow: (page: Page) => Promise<void>, name = 'main') {
  if (ONLY && ONLY !== name) return;
  // fresh profile, so every run is a real first start
  const profile = mkdtempSync(join(tmpdir(), 'bz-e2e-'));
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    userDataDir: profile,
    headless: 'shell',
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-video-capture=${OUT + video}`,
      '--autoplay-policy=no-user-gesture-required',
      '--window-size=1600,900',
    ],
    defaultViewport: { width: 1600, height: 900, hasTouch: true },
  });
  const page = await browser.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[console] ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${(e as Error).message}`));
  try {
    await flow(page);
  } finally {
    await browser.close();
    rmSync(profile, { recursive: true, force: true });
  }
}

const clickText = async (page: Page, sel: string, text: string) => {
  const ok = await page.evaluate(
    (s, t) => {
      const el = [...document.querySelectorAll<HTMLElement>(s)].find((e) => e.textContent?.includes(t));
      el?.click();
      return !!el;
    },
    sel,
    text,
  );
  if (!ok) throw new Error(`not found: ${sel} "${text}"`);
};

/** colour picker: tap (touch) the ink pixel that is most like `want` in the photo */
const tapColour = async (page: Page, want: 'red' | 'blue') => {
  const at = await page.evaluate((w) => {
    const cv = document.querySelector<HTMLCanvasElement>('.picker-photo canvas');
    if (!cv || !cv.width) return null;
    const d = cv.getContext('2d')!.getImageData(0, 0, cv.width, cv.height).data;
    let best = -1e9;
    let bi = 0;
    for (let i = 0; i < d.length; i += 4) {
      const v = w === 'red' ? d[i] - d[i + 1] - 0.5 * d[i + 2] : d[i + 2] - d[i] - 0.3 * d[i + 1];
      if (v > best) {
        best = v;
        bi = i / 4;
      }
    }
    const r = cv.getBoundingClientRect();
    return { x: r.left + ((bi % cv.width) / cv.width) * r.width, y: r.top + (Math.floor(bi / cv.width) / cv.height) * r.height };
  }, want);
  if (!at) throw new Error('no photo in the colour picker');
  await page.touchscreen.tap(at.x, at.y);
};

/** letter picker: clear the selection, tap the letters in order, done */
const pickLetters = async (page: Page, letters: string[]) => {
  await clickText(page, '.modal button', 'Leeren');
  for (const ch of letters) {
    const ok = await page.evaluate((c) => {
      const k = [...document.querySelectorAll<HTMLElement>('.picker-key')].find((e) => e.textContent === c);
      k?.click();
      return !!k;
    }, ch);
    if (!ok) throw new Error(`no key ${ch}`);
  }
  await page.screenshot({ path: OUT + 'e2e-picker.png' });
  await clickText(page, '.modal button', 'Fertig');
};

await run('fakecam-sheet.y4m', async (page) => {
  await page.goto(`http://localhost:${PORT}/?e2e`, { waitUntil: 'networkidle0' });
  await sleep(2500);
  await page.screenshot({ path: OUT + 'e2e-1-first-run.png' });
  type CamApp = { __app?: { camera: { stream: unknown } } };
  console.log('first visit: welcome', await page.evaluate(() => !!document.querySelector('.welcome')), 'camera started', await page.evaluate(() => !!(window as unknown as CamApp).__app?.camera.stream));
  await clickText(page, '.welcome .seg-btn', 'Dokumentenkamera');
  await clickText(page, '.welcome .switch', 'merken');
  await clickText(page, '.modal button', 'Kamera einrichten');
  await sleep(2500);
  // the camera wizard: a document camera, make a test scan
  await clickText(page, '.cam-mode .seg-btn', 'Kamera steht fest');
  await sleep(1500);
  await clickText(page, '.modal button', 'Testscan');
  await sleep(2500);
  await page.screenshot({ path: OUT + 'e2e-2-camera-setup.png' });
  await clickText(page, '.modal button', 'Fertig');
  await sleep(600);
  await page.screenshot({ path: OUT + 'e2e-3-start.png' });
  await clickText(page, '.tile', 'Meer');
  await sleep(1500);
  await page.keyboard.press('Space');
  await sleep(1400);
  await page.screenshot({ path: OUT + 'e2e-4-scan-polaroid.png' });
  await sleep(5000);
  await page.screenshot({ path: OUT + 'e2e-5-aquarium.png' });
  // second scan of the unchanged sheet: nothing new
  await page.keyboard.press('Space');
  await sleep(3500);
  const toasts = await page.evaluate(() => [...document.querySelectorAll('.toast')].map((t) => t.textContent));
  console.log('toasts after rescan:', toasts);
  // tap a creature
  await page.mouse.click(800, 450);
  await sleep(600);
  // practice mode in space
  await page.screenshot({ path: OUT + 'e2e-5b-card.png' });
  // close the card (if a creature was hit) and go to the menu
  await page.keyboard.press('Escape');
  await sleep(400);
  await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.btn.icon')].find((b) => b.textContent === '⌂')?.click());
  await sleep(500);
  await clickText(page, '.seg-btn', 'Buchstaben üben');
  await sleep(500);
  await pickLetters(page, ['B']);
  await sleep(400);
  await clickText(page, '.tile', 'Weltraum');
  await sleep(1500);
  await page.keyboard.press('Enter');
  await sleep(7000);
  await page.screenshot({ path: OUT + 'e2e-6-space-practice.png' });
});

await run('fakecam-duel.y4m', async (page) => {
  await page.goto(`http://localhost:${PORT}/?debug`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('buchstaben-zoo.settings') || '{}');
    s.firstRunDone = true;
    s.camera = { ...s.camera, mode: 'fest' };
    s.game = { ...s.game, autosave: true };
    localStorage.setItem('buchstaben-zoo.settings', JSON.stringify(s));
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(2000);
  await clickText(page, '.tile', 'Team-Duell');
  await sleep(600);
  await page.screenshot({ path: OUT + 'e2e-7-lobby.png' });
  await clickText(page, '.modal button', 'Stiftfarbe im Foto zeigen');
  await sleep(2500);
  await tapColour(page, 'red');
  await sleep(400);
  await page.screenshot({ path: OUT + 'e2e-7b-colour-picker.png' });
  console.log('colour picker:', await page.evaluate(() => document.querySelector('.picker-info')?.textContent));
  await clickText(page, '.modal button', 'Übernehmen');
  await sleep(400);
  console.log('team 1 pen calibrated:', await page.evaluate(() => !!JSON.parse(localStorage.getItem('buchstaben-zoo.settings') || '{}').duel?.teams?.[0]?.penCalib));
  await clickText(page, '.modal button', "Los geht's");
  await sleep(1500);
  await page.keyboard.press('Space');
  await sleep(6000);
  await page.screenshot({ path: OUT + 'e2e-8-duel.png' });
  await sleep(8000);
  await page.screenshot({ path: OUT + 'e2e-9-duel-later.png' });
  // key "2": a new photo where every letter belongs to team 2, whatever its colour
  type DuelApp = { scene: { sim: { stats: { A: { written: number }; B: { written: number } } } } };
  const written = () => page.evaluate(() => {
    const st = (window as unknown as { __app: DuelApp }).__app.scene.sim.stats;
    return [st.A.written, st.B.written];
  });
  const before = await written();
  await page.keyboard.press('n');
  await sleep(300);
  await page.keyboard.press('2');
  await sleep(4000);
  const after = await written();
  console.log('key 2: team 1 written', before[0], '->', after[0], ', team 2 written', before[1], '->', after[1]);
  // finish the duel: pop the right castle
  await page.evaluate(() => {
    type Castle = { pile: number[]; tank: number; flying: unknown[] };
    const app = (window as unknown as { __app: { scene: { sim: { castles: { B: Castle }; fighters: unknown[]; spawn: (t: string, s: number, id: number) => unknown } } } }).__app;
    // a clear field, so the last fighter reaches the castle
    app.scene.sim.fighters.length = 0;
    const b = app.scene.sim.castles.B;
    b.pile = b.pile.map((_, i) => (i === 0 ? 1 : 0));
    b.tank = 0;
    b.flying = [];
    app.scene.sim.spawn('A', 95, 999);
  });
  await sleep(26000);
  await page.screenshot({ path: OUT + 'e2e-10-victory.png' });
  await clickText(page, '.modal button', 'Menü');
  await sleep(600);
  await clickText(page, '.btn', 'Einstellungen');
  await sleep(500);
  await page.screenshot({ path: OUT + 'e2e-11-settings.png' });
});

await run('fakecam-sheet.y4m', async (page) => {
  await page.goto(`http://localhost:${PORT}/?e2e`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('buchstaben-zoo.settings') || '{}');
    s.firstRunDone = true;
    s.camera = { ...s.camera, mode: 'fest' };
    s.game = { ...s.game, autosave: true };
    localStorage.setItem('buchstaben-zoo.settings', JSON.stringify(s));
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(1500);
  // scan latency in the aquarium
  await clickText(page, '.tile', 'Meer');
  await sleep(2500);
  await page.evaluate(() => document.querySelector('.debug-panel')?.remove());
  const measure = (until: 'firstCreature' | 'result' = 'firstCreature') => page.evaluate(async (until) => {
    type FxState = { polaroid: { resultAt: number } | null };
    const app = (window as unknown as { __app: { scene: { fx: FxState; creatures: unknown[] } } }).__app;
    const t0 = performance.now();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    const marks: Record<string, number> = {};
    while (performance.now() - t0 < 8000) {
      const fx = app.scene.fx;
      if (!marks.photo && fx.polaroid) marks.photo = performance.now() - t0;
      if (!marks.result && fx.polaroid && fx.polaroid.resultAt >= 0) marks.result = performance.now() - t0;
      if (!marks.firstCreature && app.scene.creatures.length > 0) marks.firstCreature = performance.now() - t0;
      if (marks[until]) break;
      await new Promise((r) => setTimeout(r, 15));
    }
    return marks;
  }, until);
  const fmt = (m: Record<string, number>) => JSON.stringify(Object.fromEntries(Object.entries(m).map(([k, v]) => [k, Math.round(v)])));
  console.log('scan latency 1st scan (ms):', fmt(await measure()));
  await sleep(3000);
  await page.keyboard.press('n');
  await sleep(300);
  await page.evaluate(() => {
    const app = (window as unknown as { __app: { scene: { creatures: unknown[] } } }).__app;
    app.scene.creatures.length = 0;
  });
  console.log('scan latency 2nd scan (ms):', fmt(await measure()));
  await sleep(3000);
  // the same sheet again: every glyph is known, nothing needs the recognition (same scene load as before)
  await page.evaluate(() => {
    const app = (window as unknown as { __app: { scene: { creatures: unknown[] } } }).__app;
    app.scene.creatures.length = 0;
  });
  console.log('scan latency known sheet (ms):', fmt(await measure('result')));
  await sleep(300);
  await page.screenshot({ path: OUT + 'e2e-12-scan-photo.png' });
  await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.btn.icon')].find((b) => b.textContent === '⌂')?.click());
  await sleep(600);
  // practice "B" with a surprise bubble: the H on the sheet bursts it and frees a fish
  type WishApp = {
    settings: { practice: { count: number } };
    updateProgress: () => void;
    scene: { wishIn: number; wish: { char: string } | null; wishesFreed: number; practiceDone: number; practiceTarget?: string };
  };
  await clickText(page, '.seg-btn', 'Buchstaben üben');
  await sleep(500);
  await pickLetters(page, ['B', 'D', 'M']);
  await sleep(400);
  await clickText(page, '.tile', 'Meer');
  await sleep(2200);
  await page.evaluate(() => document.querySelector('.debug-panel')?.remove());
  await page.screenshot({ path: OUT + 'e2e-12a-demo.png' });
  await sleep(3500);
  await page.evaluate(() => {
    (window as unknown as { __app: WishApp }).__app.scene.wishIn = 0;
  });
  await sleep(1200);
  await page.evaluate(() => {
    const w = (window as unknown as { __app: WishApp }).__app.scene.wish;
    if (w) w.char = 'H';
  });
  await page.evaluate(() => document.querySelector('.debug-panel')?.remove());
  await page.screenshot({ path: OUT + 'e2e-12b-surprise.png' });
  await page.keyboard.press('Space');
  await sleep(4000);
  const wishState = await page.evaluate(() => {
    const s = (window as unknown as { __app: WishApp }).__app.scene;
    return { freed: s.wishesFreed, practiceDone: s.practiceDone };
  });
  console.log('surprise bubble:', JSON.stringify(wishState));
  await page.screenshot({ path: OUT + 'e2e-12c-surprise-freed.png' });
  // the B is done (pretend): the D comes next
  await page.evaluate(() => {
    const app = (window as unknown as { __app: WishApp }).__app;
    app.scene.practiceDone = app.settings.practice.count;
    app.updateProgress();
  });
  await sleep(2600);
  console.log('practice letter after the B:', await page.evaluate(() => (window as unknown as { __app: WishApp }).__app.scene.practiceTarget));
  await page.screenshot({ path: OUT + 'e2e-12d-next-letter.png' });
  await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.btn.icon')].find((b) => b.textContent === '⌂')?.click());
  await sleep(600);
  await clickText(page, '.seg-btn', 'Frei schreiben');
  await sleep(300);
  // Klasse gegen Riesenburg
  await clickText(page, '.tile', 'Riesenburg');
  await sleep(500);
  await page.screenshot({ path: OUT + 'e2e-13-siege-lobby.png' });
  await clickText(page, '.modal button', 'Angriff');
  await sleep(2000);
  await page.evaluate(() => document.querySelector('.debug-panel')?.remove());
  await page.screenshot({ path: OUT + 'e2e-14-siege-intro.png' });
  await sleep(6500);
  await page.keyboard.press('Space');
  await sleep(9000);
  await page.evaluate(() => document.querySelector('.debug-panel')?.remove());
  await page.screenshot({ path: OUT + 'e2e-15-siege-battle.png' });
});

await run('fakecam-duel.y4m', async (page) => {
  await page.goto(`http://localhost:${PORT}/?e2e`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('buchstaben-zoo.settings') || '{}');
    s.firstRunDone = true;
    s.camera = { ...s.camera, mode: 'fest' };
    s.game = { ...s.game, autosave: true };
    localStorage.setItem('buchstaben-zoo.settings', JSON.stringify(s));
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(1500);
  await page.screenshot({ path: OUT + 'e2e-16-start-tiles.png' });
  await clickText(page, '.btn', 'Für Lehrer und Eltern');
  await sleep(500);
  await page.screenshot({ path: OUT + 'e2e-16b-guide.png' });
  await clickText(page, '.seg-btn', 'Tasten & Touch');
  await sleep(300);
  await page.screenshot({ path: OUT + 'e2e-16c-guide-keys.png' });
  await clickText(page, '.modal button', 'Alles klar');
  await sleep(400);
  // Türme bauen: red and blue pens build two towers
  await clickText(page, '.tile', 'Türme bauen');
  await sleep(600);
  await page.screenshot({ path: OUT + 'e2e-17-tower-lobby.png' });
  await clickText(page, '.modal button', "Los geht's");
  await sleep(2600);
  await page.screenshot({ path: OUT + 'e2e-18-tower-intro.png' });
  await sleep(3800);
  await page.keyboard.press('Space');
  await sleep(4500);
  await page.screenshot({ path: OUT + 'e2e-19-tower-delivery.png' });
  await sleep(6000);
  type TowerSimApp = { scene: { sim: { stats: { written: number }[] } } };
  const towerWritten = () => page.evaluate(() => (window as unknown as { __app: TowerSimApp }).__app.scene.sim.stats.map((s) => s.written));
  const t0 = await towerWritten();
  await page.keyboard.press('n');
  await sleep(300);
  const btn = await page.evaluate(() => {
    const b = document.querySelector<HTMLElement>('.team-btn');
    const r = b?.getBoundingClientRect();
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
  });
  if (!btn) throw new Error('no team button');
  await page.touchscreen.tap(btn.x, btn.y);
  await sleep(4500);
  console.log('team button 1 (touch): written per tower', JSON.stringify(t0), '->', JSON.stringify(await towerWritten()));
  await page.screenshot({ path: OUT + 'e2e-19b-tower-team-button.png' });
  await sleep(10000);
  type TowerApp = { scene: { sim: { towers: { metres: number }[]; aliens: unknown[]; clones: number; addBlock: (p: number, s: number, id: number) => unknown } } };
  const state = await page.evaluate(() => {
    const sim = (window as unknown as { __app: TowerApp }).__app.scene.sim;
    return { metres: sim.towers.map((t) => t.metres), aliens: sim.aliens.length, clones: sim.clones };
  });
  console.log('towers after one scan:', JSON.stringify(state));
  await page.screenshot({ path: OUT + 'e2e-20-tower-built.png' });
  // finish: enough beautiful blocks for the red tower
  await page.evaluate(() => {
    const sim = (window as unknown as { __app: TowerApp }).__app.scene.sim;
    for (let i = 0; i < 6; i++) sim.addBlock(0, 95, 900 + i);
  });
  await sleep(9000);
  await page.screenshot({ path: OUT + 'e2e-21-tower-victory.png' });
  await sleep(9000);
  const ranking = await page.evaluate(() => document.querySelectorAll('.tower-ranking .tower-row').length);
  console.log('tower result rows:', ranking);
  await page.screenshot({ path: OUT + 'e2e-22-tower-result.png' });
  await clickText(page, '.modal button', 'Menü');
});

// the mirror-writing switch, then eight towers: key 8 gives the photo to the eighth team
await run('fakecam-sheet.y4m', async (page) => {
  await page.goto(`http://localhost:${PORT}/?e2e`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('buchstaben-zoo.settings') || '{}');
    s.firstRunDone = true;
    s.camera = { ...s.camera, mode: 'fest' };
    s.game = { ...s.game, autosave: true };
    localStorage.setItem('buchstaben-zoo.settings', JSON.stringify(s));
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(1500);
  await clickText(page, '.btn', 'Einstellungen');
  await sleep(500);
  await clickText(page, '.switch', 'Spiegelschrift');
  await sleep(200);
  const noMirror = await page.evaluate(() => JSON.parse(localStorage.getItem('buchstaben-zoo.settings') || '{}').recog?.noMirror);
  console.log('mirror switch on:', noMirror, await page.evaluate(() => document.querySelector('.switch')?.getAttribute('aria-checked')));
  await page.evaluate(() => document.querySelector('.switch')?.scrollIntoView({ block: 'center' }));
  await page.screenshot({ path: OUT + 'e2e-23-mirror-switch.png' });
  await page.keyboard.press('Escape');
  await sleep(400);
  await clickText(page, '.tile', 'Türme bauen');
  await sleep(600);
  await clickText(page, '.modal .seg-btn', '8');
  await sleep(300);
  console.log('tower lobby cards:', await page.evaluate(() => document.querySelectorAll('.teams .team-col').length));
  await page.screenshot({ path: OUT + 'e2e-24-tower-lobby-8.png' });
  await clickText(page, '.modal button', "Los geht's");
  await sleep(6500);
  type EightApp = { scene: { sim: { towers: unknown[]; stats: { written: number }[] } } };
  const written = () => page.evaluate(() => (window as unknown as { __app: EightApp }).__app.scene.sim.stats.map((s) => s.written));
  console.log('towers:', await page.evaluate(() => (window as unknown as { __app: EightApp }).__app.scene.sim.towers.length), 'team buttons:', await page.evaluate(() => document.querySelectorAll('.team-btns.compact .team-btn').length));
  const w0 = await written();
  await page.keyboard.press('8');
  await sleep(5000);
  console.log('key 8: written per tower', JSON.stringify(w0), '->', JSON.stringify(await written()));
  await sleep(8000);
  await page.screenshot({ path: OUT + 'e2e-25-tower-8.png' });
});

/** the start screen without the first-run camera wizard */
const startPage = async (page: Page, mode: 'fest' | 'hand' = 'fest') => {
  await page.goto(`http://localhost:${PORT}/?e2e`, { waitUntil: 'networkidle0' });
  await page.evaluate((mode) => {
    const s = JSON.parse(localStorage.getItem('buchstaben-zoo.settings') || '{}');
    s.firstRunDone = true;
    s.camera = { ...s.camera, mode };
    s.game = { ...s.game, autosave: true };
    localStorage.setItem('buchstaben-zoo.settings', JSON.stringify(s));
  }, mode);
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(1500);
};
const toMenu = async (page: Page) => {
  await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.btn.icon')].find((b) => b.textContent === '⌂')?.click());
  await sleep(1200);
};
const toastTexts = (page: Page) => page.evaluate(() => [...document.querySelectorAll('.toast')].map((t) => t.textContent));
type SceneApp = {
  scene: { creatures: { painted?: unknown; leaving: boolean; x: number; y: number }[]; sim?: { towers: { metres: number }[] } };
  stage: { toCss: (x: number, y: number) => { x: number; y: number } };
};
const living = (page: Page) => page.evaluate(() => (window as unknown as { __app: SceneApp }).__app.scene.creatures.filter((c) => !c.leaving).length);

// Mal-Aquarium: coloured cards become fish; saving, reloading and continuing
await run(
  'fakecam-paint.y4m',
  async (page) => {
    await startPage(page);
    await page.screenshot({ path: OUT + 'e2e-26-start-paint-tile.png' });
    await clickText(page, '.tile', 'Mal-Aquarium');
    await sleep(700);
    await page.screenshot({ path: OUT + 'e2e-27-paint-lobby.png' });
    // the copy template, as the printer gets it
    await page.evaluate(() => {
      window.print = () => undefined;
    });
    await clickText(page, '.modal button', 'Vorlage drucken');
    await sleep(500);
    await page.pdf({ path: OUT + 'e2e-paint-vorlage.pdf', printBackground: true, preferCSSPageSize: true });
    await page.evaluate(() => document.querySelector('.print-sheet')?.remove());
    await clickText(page, '.modal button', "Los geht's");
    await sleep(1500);
    await page.keyboard.press('Enter');
    await sleep(1300);
    await page.screenshot({ path: OUT + 'e2e-28-paint-polaroid.png' });
    await sleep(3500);
    console.log('painted fish after the first photo:', await living(page), await toastTexts(page));
    await page.screenshot({ path: OUT + 'e2e-29-paint-aquarium.png' });
    await page.keyboard.press('Enter');
    await sleep(3500);
    console.log('painted fish after the same photo again:', await living(page), await toastTexts(page));
    // tap a fish: it is shown big with its name
    const at = await page.evaluate(() => {
      const app = (window as unknown as { __app: SceneApp }).__app;
      const c = app.scene.creatures.find((k) => !k.leaving);
      return c ? app.stage.toCss(c.x, c.y) : null;
    });
    if (at) {
      await page.mouse.click(at.x, at.y);
      await sleep(700);
      await page.screenshot({ path: OUT + 'e2e-30-paint-fish-card.png' });
      await page.keyboard.press('Escape');
      await sleep(400);
    }
    // save under a name
    await page.keyboard.press('s');
    await sleep(500);
    await page.screenshot({ path: OUT + 'e2e-31-save-dialog.png' });
    await clickText(page, '.modal button', 'Speichern');
    await sleep(1200);
    console.log('after saving:', await toastTexts(page));
    // to the menu: the game is kept by itself
    await toMenu(page);
    await sleep(800);
    await page.screenshot({ path: OUT + 'e2e-32-start-continue.png' });
    console.log('continue banner:', await page.evaluate(() => document.querySelector('.continue-banner')?.textContent));
    await page.reload({ waitUntil: 'networkidle0' });
    await sleep(1500);
    await clickText(page, '.tile', 'Mal-Aquarium');
    await sleep(700);
    await page.screenshot({ path: OUT + 'e2e-33-continue-dialog.png' });
    await clickText(page, '.modal button', 'Weiterspielen');
    await sleep(3000);
    console.log('painted fish after continuing:', await living(page));
    await page.screenshot({ path: OUT + 'e2e-34-paint-continued.png' });
    // the cards are still known after the reload
    await page.keyboard.press('Enter');
    await sleep(3500);
    console.log('painted fish after a photo of the known cards:', await living(page), await toastTexts(page));
    await toMenu(page);
    await clickText(page, '.btn', 'Spielstände');
    await sleep(900);
    console.log('saved games:', await page.evaluate(() => [...document.querySelectorAll('.save-row b')].map((b) => b.textContent)));
    await page.screenshot({ path: OUT + 'e2e-35-saves.png' });
    await page.keyboard.press('Escape');
  },
  'saves',
);

// the sea and the towers: write, leave, reload, continue
await run(
  'fakecam-sheet.y4m',
  async (page) => {
    await startPage(page);
    await clickText(page, '.tile', 'Meer');
    await sleep(1500);
    await page.keyboard.press('Enter');
    await sleep(6000);
    const n1 = await living(page);
    await toMenu(page);
    await page.reload({ waitUntil: 'networkidle0' });
    await sleep(1500);
    await clickText(page, '.tile', 'Meer');
    await sleep(700);
    await clickText(page, '.modal button', 'Weiterspielen');
    await sleep(3000);
    const n2 = await living(page);
    await page.screenshot({ path: OUT + 'e2e-36-sea-continued.png' });
    await page.keyboard.press('Enter');
    await sleep(5000);
    console.log('sea: creatures', n1, '-> continued', n2, '-> same sheet again', await living(page), await toastTexts(page));
    await toMenu(page);
    await clickText(page, '.tile', 'Türme bauen');
    await sleep(700);
    await clickText(page, '.modal button', "Los geht's");
    await sleep(6500);
    await page.keyboard.press('2');
    await sleep(14000);
    const towers = () => page.evaluate(() => (window as unknown as { __app: SceneApp }).__app.scene.sim!.towers.map((t) => t.metres));
    const m1 = await towers();
    await toMenu(page);
    await page.reload({ waitUntil: 'networkidle0' });
    await sleep(1500);
    await clickText(page, '.tile', 'Türme bauen');
    await sleep(700);
    await clickText(page, '.modal button', 'Weiterspielen');
    await sleep(2500);
    console.log('towers:', JSON.stringify(m1), '-> continued', JSON.stringify(await towers()));
    await page.screenshot({ path: OUT + 'e2e-37-tower-continued.png' });
  },
  'saves',
);

// phones and tablets: the camera is held in the hand, every photo goes through the viewfinder
const PHONE_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
await run(
  'fakecam-sheet.y4m',
  async (page) => {
    await page.setUserAgent(PHONE_UA);
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await page.goto(`http://localhost:${PORT}/?e2e`, { waitUntil: 'networkidle0' });
    await sleep(2000);
    await page.screenshot({ path: OUT + 'e2e-37b-phone-welcome.png' });
    // first visit on a phone: the welcome window has "Handy oder Tablet" chosen, the camera is still off
    console.log('phone welcome:', await page.evaluate(() => document.querySelector('.welcome .seg-btn.on')?.textContent));
    await clickText(page, '.modal button', 'Kamera einrichten');
    await sleep(2000);
    console.log('phone first run:', await page.evaluate(() => document.querySelector('.cam-mode .seg-btn.on')?.textContent));
    await page.screenshot({ path: OUT + 'e2e-38-phone-wizard.png' });
    await clickText(page, '.modal button', 'Fertig');
    await sleep(800);
    await page.screenshot({ path: OUT + 'e2e-39-phone-start.png' });
    await page.evaluate(() => document.querySelector('.howto')?.scrollIntoView());
    await sleep(300);
    await page.screenshot({ path: OUT + 'e2e-40-phone-howto.png' });
    await page.evaluate(() => document.querySelector('.tiles')?.scrollIntoView());
    await clickText(page, '.tile', 'Meer');
    await sleep(1500);
    await page.screenshot({ path: OUT + 'e2e-41-phone-sea.png' });
    console.log('camera off before the photo:', await page.evaluate(() => !(window as unknown as { __app?: { camera: { stream: unknown } } }).__app?.camera.stream));
    await page.evaluate(() => (document.querySelector('.go-btn') as HTMLElement).click());
    await sleep(2000);
    await page.screenshot({ path: OUT + 'e2e-42-phone-viewfinder.png' });
    console.log('viewfinder open:', await page.evaluate(() => !!document.querySelector('.viewfinder')));
    await page.evaluate(() => (document.querySelector('.vf-shutter') as HTMLElement).click());
    await sleep(6500);
    console.log('phone: creatures after one photo', await living(page), 'viewfinder closed:', await page.evaluate(() => !document.querySelector('.viewfinder')));
    await page.screenshot({ path: OUT + 'e2e-43-phone-creatures.png' });
    // turned sideways
    await page.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await sleep(900);
    await page.screenshot({ path: OUT + 'e2e-44-phone-landscape.png' });
    await page.evaluate(() => (document.querySelector('.go-btn') as HTMLElement).click());
    await sleep(1500);
    await page.screenshot({ path: OUT + 'e2e-45-phone-landscape-viewfinder.png' });
    await page.keyboard.press('Escape');
    await sleep(600);
    console.log('viewfinder cancelled:', await page.evaluate(() => !document.querySelector('.viewfinder')), 'creatures', await living(page));
    // a tablet: the Mal-Aquarium through the viewfinder
    await page.setViewport({ width: 1180, height: 820, isMobile: true, hasTouch: true, deviceScaleFactor: 1.5 });
    await toMenu(page);
    await sleep(500);
    await page.screenshot({ path: OUT + 'e2e-45b-keep-question.png' });
    console.log('keep question:', await page.evaluate(() => document.querySelector('.modal h2')?.textContent));
    await clickText(page, '.modal button', 'Ja, merken');
    await sleep(1500);
    console.log('kept after the question:', await page.evaluate(() => document.querySelector('.continue-banner')?.textContent));
    await page.screenshot({ path: OUT + 'e2e-46-tablet-start.png' });
  },
  'mobile',
);
await run(
  'fakecam-paint.y4m',
  async (page) => {
    await page.setUserAgent(PHONE_UA.replace('Pixel 8', 'SM-X710').replace(' Mobile', ''));
    await page.setViewport({ width: 1180, height: 820, isMobile: true, hasTouch: true, deviceScaleFactor: 1.5 });
    await startPage(page, 'hand');
    await clickText(page, '.tile', 'Mal-Aquarium');
    await sleep(700);
    await clickText(page, '.modal button', "Los geht's");
    await sleep(1500);
    await page.evaluate(() => (document.querySelector('.go-btn') as HTMLElement).click());
    await sleep(2000);
    await page.screenshot({ path: OUT + 'e2e-47-tablet-paint-viewfinder.png' });
    await page.evaluate(() => (document.querySelector('.vf-shutter') as HTMLElement).click());
    await sleep(5000);
    console.log('tablet: painted fish', await living(page));
    await page.screenshot({ path: OUT + 'e2e-48-tablet-paint.png' });
  },
  'mobile',
);

server.kill();
console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no console errors');
