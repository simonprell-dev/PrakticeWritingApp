// Renders every animated template (stroke order, start numbers, arrows) to one PNG sheet.
// Usage: node tools/preview-strokes.ts [outDir] [kana for the animation sheet]
//        node tools/preview-strokes.ts outDir --script <id> [font size in bands]: one other script only
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { drawGuideLines, drawSchoolLines, drawWriting, writeDuration, writtenGlyph, type WrittenGlyph } from '../src/game/strokes.ts';
import { KANA_STROKES } from '../src/game/kanaStrokes.ts';

const out = process.argv[2] ?? fileURLToPath(new URL('../tools/train/out/', import.meta.url));
mkdirSync(out, { recursive: true });
GlobalFonts.registerFromPath(fileURLToPath(new URL('../tools/train/fonts/Fredoka.ttf', import.meta.url)), 'Fredoka');
const sets = ['ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ', 'abcdefghijklmnopqrstuvwxyzäöüß', '0123456789'];
const only = process.argv.includes('--script');
for (const grund of only ? [] : [false, true]) {
  const u = 46;
  const cols = 10;
  const cellW = 2.3 * u;
  const cellH = 4.4 * u;
  const chars = sets.join('');
  const rows = Math.ceil(chars.length / cols);
  const cv = createCanvas(cols * cellW, rows * cellH);
  const ctx = cv.getContext('2d') as unknown as CanvasRenderingContext2D;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, cv.width, cv.height);
  [...chars].forEach((ch, i) => {
    const g = writtenGlyph(ch, grund)!;
    const cx = (i % cols) * cellW;
    const cy = Math.floor(i / cols) * cellH + 0.7 * u;
    drawSchoolLines(ctx, cx + 4, cx + cellW - 4, cy, u, 4);
    // half written: shows numbers, arrows and the direction of the current stroke
    drawWriting(ctx, g, cx + (cellW - g.w * u) / 2, cy, writeDuration(g) * 0.999, { unit: u, ink: '#5b3bd6', guides: true, ghost: true });
  });
  writeFileSync(`${out}/strokes-${grund ? 'grund' : 'druck'}.png`, cv.toBuffer('image/png'));
  console.log('wrote strokes', grund ? 'grund' : 'druck');
}

// kana (KanjiVG): every character finished, in its square box
if (!only) {
  const u = 60;
  const cols = 10;
  const cell = 2.6 * u;
  const chars = Object.keys(KANA_STROKES);
  const rows = Math.ceil(chars.length / cols);
  const cv = createCanvas(cols * cell, rows * cell);
  const ctx = cv.getContext('2d') as unknown as CanvasRenderingContext2D;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, cv.width, cv.height);
  chars.forEach((ch, i) => {
    const g = writtenGlyph(ch, false)!;
    const cx = (i % cols) * cell + (cell - g.w * u) / 2;
    const cy = Math.floor(i / cols) * cell + 0.3 * u;
    drawGuideLines(ctx, g, cx, cx + g.w * u, cy, u, 4);
    drawWriting(ctx, g, cx, cy, writeDuration(g) * 0.999, { unit: u, ink: '#5b3bd6', guides: true, ghost: true });
  });
  writeFileSync(`${out}/strokes-kana.png`, cv.toBuffer('image/png'));
  console.log('wrote strokes kana');
}

// a few kana while they are written: one row per character, columns at 15 %, 35 %, 55 %, 75 % and 100 %
if (!only) {
  const u = 80;
  const cell = 2.5 * u;
  const chars = [...(process.argv[3] ?? 'あふをシツンぬね')];
  const steps = [0.15, 0.35, 0.55, 0.75, 0.999];
  const cv = createCanvas(steps.length * cell, chars.length * cell);
  const ctx = cv.getContext('2d') as unknown as CanvasRenderingContext2D;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, cv.width, cv.height);
  chars.forEach((ch, r) => {
    const g = writtenGlyph(ch, false) as WrittenGlyph;
    steps.forEach((f, c) => {
      const cx = c * cell + (cell - g.w * u) / 2;
      const cy = r * cell + 0.25 * u;
      drawGuideLines(ctx, g, cx, cx + g.w * u, cy, u, 4);
      drawWriting(ctx, g, cx, cy, writeDuration(g) * f, { unit: u, ink: '#5b3bd6', guides: true, ghost: true });
    });
  });
  writeFileSync(`${out}/strokes-kana-anim.png`, cv.toBuffer('image/png'));
  console.log('wrote strokes kana animation');
}

// another script (src/game/scriptStrokes/): every character finished, over its glyph in the app's font,
// so the strokes can be checked against the real letter. Usage: node tools/preview-strokes.ts outDir --script kyrillisch [size]
{
  const at = process.argv.indexOf('--script');
  if (at > 0) {
    const id = process.argv[at + 1];
    const size = Number(process.argv[at + 2] ?? 0) || 0;
    // the characters of src/recog/scripts.ts (that module needs Vite for its translations)
    const SCRIPTS: Record<string, { chars: string; dir: 'ltr' | 'rtl' }> = {
      schreib: { chars: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzß', dir: 'ltr' },
      kyrillisch: { chars: 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя', dir: 'ltr' },
      arabisch: { chars: 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي', dir: 'rtl' },
      devanagari: { chars: 'अआइईउऊऋएऐओऔकखगघङचछजझञटठडढणतथदधनपफबभमयरलवशषसह', dir: 'ltr' },
      griechisch: { chars: 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩαβγδεζηθικλμνξοπρσςτυφχψω', dir: 'ltr' },
      hebraeisch: { chars: 'אבגדהוזחטיכלמנסעפצקרשתךםןףץ', dir: 'rtl' },
      hangul: { chars: 'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎㅏㅑㅓㅕㅗㅛㅜㅠㅡㅣ가나다라마바사아자차카타파하', dir: 'ltr' },
      thai: { chars: 'กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ', dir: 'ltr' },
    };
    const def = SCRIPTS[id];
    const font = `KK-${id}`;
    GlobalFonts.registerFromPath(fileURLToPath(new URL(`../public/fonts/${id}.woff2`, import.meta.url)), font);
    const u = 60;
    const cols = 8;
    const cell = 3 * u;
    const chars = [...def.chars];
    const rows = Math.ceil(chars.length / cols);
    const cv = createCanvas(cols * cell, rows * (cell + 0.4 * u));
    const ctx = cv.getContext('2d') as unknown as CanvasRenderingContext2D;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, cv.width, cv.height);
    chars.forEach((ch, i) => {
      const g = writtenGlyph(ch, id);
      const box = g?.box ?? false;
      const w = g?.w ?? 1.2;
      const x0 = (i % cols) * cell;
      const cx = x0 + (cell - w * u) / 2;
      const cy = Math.floor(i / cols) * (cell + 0.4 * u) + 0.5 * u;
      // the real glyph, light: sits on the base line (school lines) or in the middle of the box
      ctx.save();
      ctx.fillStyle = 'rgba(255,120,80,0.28)';
      ctx.font = `${(size || (box ? 1.75 : 2.8)) * u}px '${font}'`;
      ctx.textAlign = 'center';
      ctx.textBaseline = box ? 'middle' : 'alphabetic';
      ctx.direction = def.dir;
      ctx.fillText(ch, x0 + cell / 2, box ? cy + u : cy + 2 * u);
      ctx.restore();
      if (!g) {
        drawSchoolLines(ctx, x0 + 4, x0 + cell - 4, cy, u, 4);
        ctx.fillStyle = '#e0304f';
        ctx.font = `bold ${0.5 * u}px sans-serif`;
        ctx.fillText('?', x0 + 8, cy + 0.5 * u);
        return;
      }
      drawGuideLines(ctx, g, x0 + 4, x0 + cell - 4, cy, u, 4, false);
      drawWriting(ctx, g, cx, cy, writeDuration(g) * 0.999, { unit: u, ink: '#5b3bd6', guides: true });
    });
    writeFileSync(`${out}/strokes-${id}.png`, cv.toBuffer('image/png'));
    console.log('wrote strokes', id);
  }
}
