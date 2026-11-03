// Stroke order and direction for schreib (Schulausgangsschrift, SAS) – see path.ts for the format.
//
// Convention: the letters trace the app's font Playwrite DE SAS (public/fonts/schreib.woff2), the
// SAS of 1968/1970 as isolated letters. Lowercase letters are one flowing stroke in the direction of
// the SAS movement (Bewegungsablauf), with the exit stroke (Endstrich); the entry stroke (Anstrich)
// from the base line is included where the isolated SAS letter has it (b e f h k l s t), m n p r start
// with their small hook at the middle line, and the oval letters (a c d g o q) start at the top right
// of the oval. Stems are retraced where the movement turns back up (m n p r, h k, the f descender). The
// i/j dots come afterwards; the t needs no extra bar, its exit stroke crosses the stem. Capitals: one
// stroke where the SAS writes them in one go (C E G I J L M N O S U V W Y Z, the A with its bar after),
// the stems of B D F P R T H K first as separate down strokes, then bowls and bars; the H bar comes last
// because SAS joins H (like A and F) to the next letter from mid-height. Digits are the Druckschrift
// digits of strokes.ts unchanged.
//
// Sources:
//   https://de.wikipedia.org/wiki/Schulausgangsschrift (1968 reform: capitals reduced to their
//     distinguishing features with single-stroke concessions; joins of A, F, H from mid-height)
//   Playwrite DE SAS (TypeTogether / Google Fonts), https://fonts.google.com/specimen/Playwrite+DE+SAS
//     – letter forms and the course of each stroke
//   Druckschrift stroke order of strokes.ts (Bavarian LehrplanPLUS Richtformen) for the order of
//     separate stems and bars, as is common in SAS worksheets with start points and arrows
//
// The letters are written in font units (1000 per em, x-height 500, base line 0, y up) and converted
// to bands by `sas`, so they sit exactly on the glyph: x-height = one band, capitals reach ~0.22.
import type { ScriptGlyph, StrokeTable } from './path.ts';
import { RING } from './path.ts';

/** font units per band */
const UNIT = 500;
const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** strokes in font units → glyph in bands, centred on the advance width like the font's glyph */
function sas(adv: number, ...strokes: string[]): ScriptGlyph {
  const xs = strokes.flatMap((s) => s.replace(/[A-Z]/g, ' ').trim().split(/\s+/).map(Number).filter((_, i) => i % 2 === 0));
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  const w = r3(Math.max(adv - 2 * lo, 2 * hi - adv) / UNIT + 0.1);
  const conv = strokes.map((s) =>
    s.replace(/(-?[\d.]+)\s+(-?[\d.]+)/g, (_, x: string, y: string) => `${r3((Number(x) - adv / 2) / UNIT + w / 2)} ${r3(2 - Number(y) / UNIT)}`),
  );
  return { w, strokes: conv };
}

// shared parts in font units
/** small a/d/g/q oval: from the top right over the top, down, round and up to the stem top */
const OVAL = 'M470 450 C420 480 370 485 320 480 C170 465 85 300 85 170 C85 80 130 25 195 25 C300 25 420 200 505 480';
/** b f h k l loop: entry stroke from the base line, up to the ascender and round */
const LOOP = 'M-160 30 C-40 40 80 180 200 360 C320 540 490 720 500 815 C507 875 465 900 425 885 C375 860 345 790 330 720';
/** exit stroke (Endstrich) from a stem foot near x */
const EXIT = (x: number) => `C${x - 15} 40 ${x + 10} 15 ${x + 45} 25 C${x + 85} 40 ${x + 125} 70 ${x + 155} 95`;

export const STROKES: StrokeTable = {
  // digits: the Druckschrift digits of strokes.ts
  '0': { w: 1.0, strokes: [RING(0.5, 1, 0.45, 1, -90, -450)] },
  '1': { w: 0.75, strokes: ['M0.1 0.6 L0.6 0', 'M0.6 0 L0.6 2'] },
  '2': { w: 1.05, strokes: ['M0.1 0.45 C0.15 0.05 0.5 0 0.55 0 C0.85 0 1.0 0.25 0.95 0.55 C0.9 0.85 0.55 1.2 0.1 2 L1.0 2'] },
  '3': {
    w: 1.05,
    strokes: ['M0.12 0.25 C0.3 0 0.5 0 0.55 0 C0.9 0 0.95 0.3 0.9 0.5 C0.85 0.75 0.6 0.92 0.4 0.95 C0.75 0.97 1.0 1.15 1.0 1.45 C1.0 1.85 0.7 2 0.5 2 C0.3 2 0.12 1.9 0.05 1.75'],
  },
  '4': { w: 1.05, strokes: ['M0.55 0 L0.05 1.35 L1.0 1.35', 'M0.78 0.1 L0.78 2'] },
  '5': { w: 1.0, strokes: ['M0.2 0 L0.15 0.92', 'M0.15 0.92 C0.4 0.8 0.95 0.8 0.95 1.4 C0.95 1.95 0.5 2.05 0.1 1.8', 'M0.2 0 L0.9 0'] },
  '6': { w: 1.0, strokes: ['M0.85 0.15 C0.6 -0.05 0.1 0 0.08 1.2 C0.05 1.8 0.3 2 0.5 2 C0.8 2 0.95 1.8 0.95 1.45 C0.95 1.1 0.7 0.9 0.5 0.9 C0.3 0.9 0.12 1.05 0.08 1.3'] },
  '7': { w: 1.0, strokes: ['M0.05 0 L0.95 0', 'M0.95 0 L0.35 2', 'M0.35 1 L0.95 1'] },
  '8': {
    w: 1.0,
    strokes: ['M0.85 0.35 C0.8 0.05 0.6 0 0.5 0 C0.25 0 0.12 0.2 0.12 0.45 C0.12 0.75 0.4 0.88 0.5 0.95 C0.75 1.08 0.95 1.25 0.95 1.5 C0.95 1.82 0.75 2 0.5 2 C0.25 2 0.05 1.82 0.05 1.5 C0.05 1.25 0.25 1.08 0.5 0.95 C0.6 0.88 0.88 0.72 0.85 0.35'],
  },
  '9': { w: 1.0, strokes: [RING(0.5, 0.5, 0.42, 0.5, -40, -400), 'M0.92 0.5 L0.92 2'] },

  A: sas(1066, 'M10 60 C60 0 140 0 200 50 C350 200 600 700 730 880 L750 100 C755 30 800 15 840 20 C920 30 990 140 1030 230', 'M490 325 L730 325'),
  B: sas(733, 'M325 870 L95 25', 'M300 865 C450 870 620 870 700 820 C780 770 760 640 680 570 C600 500 400 470 230 470 C450 470 690 400 700 260 C710 120 600 25 400 25 L95 25'),
  C: sas(785, 'M830 790 C770 860 690 875 590 870 C350 860 160 650 160 400 C160 160 290 25 460 25 C580 25 660 110 705 210'),
  D: sas(880, 'M328 870 L95 25', 'M310 865 C560 875 820 830 820 560 C820 260 620 25 330 25 L95 25'),
  E: sas(706, 'M690 760 C640 840 560 870 470 870 C330 870 210 800 210 690 C210 560 330 470 470 465 L570 465 L330 465 C170 440 75 330 75 210 C75 90 190 25 330 25 C460 25 560 110 630 200'),
  F: sas(632, 'M320 860 L95 25', 'M310 860 L760 860', 'M215 455 L585 450'),
  G: sas(950, 'M930 780 C860 850 760 875 650 870 C380 860 200 650 195 420 C190 200 280 40 400 40 C560 40 700 250 800 470 L640 -150 C600 -300 540 -385 480 -385 C400 -385 380 -320 400 -270 C450 -170 600 -50 690 0 L890 190'),
  H: sas(898, 'M275 880 L85 25', 'M890 880 L650 25', 'M130 455 L800 455'),
  I: sas(513, 'M180 750 C220 830 260 870 320 860 C380 850 420 830 470 840 C510 850 540 870 570 880 L380 160 C350 60 300 25 240 25 C150 25 90 80 45 145'),
  J: sas(628, 'M180 750 C220 830 260 870 320 860 C380 850 420 830 470 840 C510 850 540 870 580 880 L300 -150 C260 -300 200 -385 130 -385 C60 -385 30 -320 60 -260 C110 -170 250 -40 340 20 L570 190'),
  K: sas(696, 'M300 880 L105 25', 'M780 860 L270 500 L590 25'),
  L: sas(785, 'M810 740 C780 830 720 870 640 870 C540 870 470 780 440 680 L250 200 C220 120 170 40 90 35 C10 30 -30 80 -25 120 C-20 175 40 205 100 190 C160 175 210 110 260 70 C320 30 400 20 490 22 C580 25 650 120 700 230'),
  M: sas(1425, 'M120 290 C80 230 30 140 40 80 C50 30 90 15 130 25 C250 60 450 500 640 860 L650 30 C750 300 900 600 1130 870 L1060 140 C1050 50 1100 15 1160 25 C1250 50 1320 140 1370 240'),
  N: sas(1106, 'M120 290 C80 230 30 140 40 80 C50 30 90 15 130 25 C250 60 400 500 500 870 L740 30 C800 300 900 870 1100 880 C1170 880 1220 860 1260 830'),
  O: sas(936, 'M640 870 C380 870 140 600 140 330 C140 130 250 30 400 30 C640 30 850 300 850 590 C850 770 760 870 600 870'),
  P: sas(708, 'M320 870 L105 25', 'M305 870 C490 875 690 870 760 790 C810 720 770 560 650 450 C560 400 410 385 290 385'),
  Q: sas(965, 'M560 870 C320 870 140 600 140 330 C140 130 260 30 450 30 C700 30 870 330 870 600 C870 780 760 870 560 870', 'M420 250 C500 230 560 160 620 70 C660 -10 720 -60 760 -30 C820 0 870 40 900 60'),
  R: sas(702, 'M320 870 L100 25', 'M300 865 C450 870 620 870 700 820 C780 760 760 620 680 560 C600 500 450 480 300 480 L230 470 C350 300 500 120 600 25'),
  S: sas(696, 'M670 770 C620 840 540 870 450 870 C320 870 230 790 240 680 C250 560 400 490 480 430 C570 360 610 300 600 210 C590 90 500 30 380 30 C240 30 100 90 5 150'),
  T: sas(698, 'M510 840 L300 25', 'M170 840 L810 845'),
  U: sas(965, 'M150 720 C190 800 250 870 310 860 C370 850 380 780 360 700 L250 220 C220 90 260 30 380 30 C560 30 720 300 860 870 L690 120 C675 50 710 20 750 30 C800 45 850 100 885 150'),
  V: sas(922, 'M130 720 C170 800 250 870 310 860 C370 850 380 780 360 700 L250 220 C220 90 260 30 360 30 C560 30 750 400 810 870 L1020 795'),
  W: sas(1293, 'M150 720 C190 800 250 870 300 860 C360 850 370 780 350 700 L250 220 C220 90 260 30 360 30 C490 30 640 400 770 700 L690 140 C670 50 720 25 790 25 C960 25 1120 450 1190 880 L1400 800'),
  X: sas(838, 'M150 830 C190 880 250 890 290 860 C340 820 450 400 540 150 C580 60 620 25 680 25 C730 25 770 80 795 130', 'M800 880 L40 25'),
  Y: sas(929, 'M150 720 C190 800 260 880 320 870 C380 860 390 780 370 700 L270 260 C240 120 280 30 380 30 C560 30 720 300 860 870 L620 -100 C580 -250 520 -350 450 -350 C370 -350 340 -290 370 -240 C420 -150 560 -40 660 30 L880 200'),
  Z: sas(620, 'M210 840 L740 850 L0 35 L530 40'),

  a: sas(622, `${OVAL} L440 110 ${EXIT(440)}`),
  b: sas(614, `${LOOP} L170 160 C150 80 170 25 270 25 C420 25 520 180 525 330 C528 430 500 480 450 470`),
  c: sas(522, 'M480 420 C440 465 380 475 320 470 C170 460 85 330 85 190 C85 80 150 25 250 25 C330 25 400 80 450 140'),
  d: sas(640, `${OVAL.replace(/ C300 25 420 200 505 480$/, ' C300 25 400 180 490 420 C540 560 590 720 625 880')} L440 110 ${EXIT(440)}`),
  e: sas(444, 'M-160 30 C-60 35 100 100 220 200 C330 290 370 380 360 430 C350 470 300 475 270 470 C160 455 90 320 95 200 C100 80 150 25 230 25 C330 25 400 90 460 135'),
  f: sas(433, `${LOOP} L15 -375 L100 -10 C90 25 65 40 50 28 C150 70 270 120 360 175`),
  g: sas(622, `${OVAL} L380 -220 C340 -330 280 -385 210 -385 C120 -385 90 -320 120 -260 C170 -170 320 -60 400 -10 L575 85`),
  h: sas(676, `${LOOP} L95 30 L160 230 C220 380 330 470 430 470 C510 470 530 420 520 350 L460 110 ${EXIT(460)}`),
  i: sas(300, `M225 480 L140 110 ${EXIT(140)}`, 'D235 735'),
  j: sas(316, 'M250 480 L80 -200 C55 -300 10 -385 -70 -385 C-150 -385 -175 -320 -150 -270 C-100 -180 20 -60 90 -10 L265 85', 'D285 735'),
  k: sas(564, `${LOOP} L100 30 L165 260 C230 400 330 480 420 470 C500 460 510 380 470 330 C420 280 300 270 200 270 C250 200 300 60 380 25 C440 10 490 60 525 105`),
  l: sas(394, `${LOOP} L130 110 ${EXIT(130)}`),
  m: sas(989, `M15 380 C40 440 80 475 130 470 C155 468 168 455 163 430 L128 30 L155 220 C200 380 300 470 410 470 C500 470 550 420 540 350 L455 30 L480 220 C530 380 630 470 730 470 C820 470 860 420 848 360 L795 120 ${EXIT(795)}`),
  n: sas(671, `M15 380 C40 440 80 475 130 470 C155 468 168 455 163 430 L128 30 L155 220 C200 380 300 470 410 470 C500 470 555 420 545 350 L490 110 ${EXIT(490)}`),
  o: sas(588, 'M400 475 C280 490 130 400 95 230 C75 110 130 25 230 25 C380 25 505 200 505 340 C505 430 450 475 360 475'),
  p: sas(636, `M15 380 C40 440 90 475 140 470 C165 468 180 455 176 430 L0 -370 L135 250 C190 400 290 470 400 470 C490 470 560 420 550 350 L490 110 ${EXIT(490)}`),
  q: sas(647, `${OVAL} L290 -390`),
  r: sas(551, 'M15 380 C40 440 100 480 160 470 C180 465 190 450 185 430 L110 30 L150 210 C200 340 280 440 360 460 C410 470 400 420 410 390 C430 340 480 340 520 355 C560 370 600 410 625 445'),
  s: sas(550, 'M-170 30 C-60 40 80 200 190 420 C220 480 240 540 250 545 C260 540 270 470 300 400 C340 320 400 240 380 140 C360 50 300 25 240 25 C180 25 140 50 105 70'),
  t: sas(630, 'M-110 25 C0 40 150 160 300 380 C400 530 480 700 535 880 L320 40 C310 0 260 20 240 70 C225 110 230 140 270 135 C420 120 580 240 700 305'),
  u: sas(646, `M210 480 L120 160 C100 70 140 25 200 25 C300 25 420 200 545 480 L440 110 ${EXIT(440)}`),
  v: sas(571, 'M210 480 L120 160 C100 70 140 25 210 25 C340 25 500 180 500 350 C500 420 490 460 465 485'),
  w: sas(855, 'M210 480 L120 160 C100 70 140 25 200 25 C300 25 400 200 450 480 L420 160 C410 70 450 25 520 25 C650 25 760 180 760 350 C760 420 750 460 725 485'),
  x: sas(650, 'M150 440 C170 490 220 495 250 470 C290 430 380 150 420 70 C450 15 520 15 560 45 L635 100', 'M625 490 L95 20'),
  y: sas(640, 'M210 480 L120 160 C100 70 140 25 200 25 C300 25 420 200 520 480 L360 -220 C320 -330 260 -385 190 -385 C100 -385 70 -320 100 -260 C150 -170 300 -60 380 -10 L590 85'),
  z: sas(495, 'M120 455 L475 460 L20 30 L400 40'),
  ß: sas(700, 'M30 -380 L230 650 C260 800 340 880 460 880 C590 880 680 810 680 720 C680 590 550 500 380 470 C560 450 640 360 630 230 C620 90 520 25 400 25 C320 25 260 50 225 75'),
};
