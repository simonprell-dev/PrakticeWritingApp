// End-to-end check in a real Chrome with a fake camera (Y4M from tools/make-fake-cam.ts).
// Usage: npm run build && node tools/make-fake-cam.ts && node tools/e2e.ts
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
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function run(video: string, flow: (page: Page) => Promise<void>) {
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
    defaultViewport: { width: 1600, height: 900 },
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

await run('fakecam-sheet.y4m', async (page) => {
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0' });
  await sleep(2500);
  await page.screenshot({ path: OUT + 'e2e-1-first-run.png' });
  // first run opens the camera wizard: make a test scan
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
  await clickText(page, '.picker-key', 'B');
  await clickText(page, '.modal button', 'Fertig');
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
    localStorage.setItem('buchstaben-zoo.settings', JSON.stringify(s));
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(2000);
  await clickText(page, '.tile', 'Team-Duell');
  await sleep(600);
  await page.screenshot({ path: OUT + 'e2e-7-lobby.png' });
  await clickText(page, '.modal button', "Los geht's");
  await sleep(1500);
  await page.keyboard.press('Space');
  await sleep(6000);
  await page.screenshot({ path: OUT + 'e2e-8-duel.png' });
  await sleep(8000);
  await page.screenshot({ path: OUT + 'e2e-9-duel-later.png' });
  // finish the duel: pop the right castle
  await page.evaluate(() => {
    const app = (window as unknown as { __app: { scene: { sim: { castles: { B: { hp: number } }; spawn: (t: string, s: number, id: number) => unknown } } } }).__app;
    app.scene.sim.castles.B.hp = 1;
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

server.kill();
console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no console errors');
