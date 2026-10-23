// "Türme bauen": the 40 funny mishaps that sometimes happen while an alien delivers a block, and the
// idle mischief. Pure data + pose functions (no drawing), so the simulation and the tests can use them.
//
// A pose is a set of offsets and looks for one moment of the gag (t = 0..1). Offsets are relative to
// where the UFO / the block would be without the gag; the block hangs below the moved UFO.
import { clamp, ease, TAU } from '../math.ts';

export type Face =
  | 'happy'
  | 'grin'
  | 'surprised'
  | 'sleep'
  | 'dizzy'
  | 'love'
  | 'cool'
  | 'strain'
  | 'yuck'
  | 'wink'
  | 'sad'
  | 'scared'
  | 'confused'
  | 'focus';
export type Hat = 'sunglasses' | 'party';
export type Prop = 'camera' | 'map' | 'horn' | 'umbrella' | 'icecream' | 'sponge' | 'flag' | 'tape' | 'flower' | 'cloth' | 'wand' | 'wave' | 'flute';
export type Extra = 'cloud' | 'bird' | 'butterfly' | 'juggle' | 'flames' | 'tapeLine' | 'shootingStar' | 'dizzyStars' | 'gumBubble';
/** decorations a block keeps after a gag */
export type Deco = 'party' | 'flower' | 'shine';
export type SfxName =
  | 'sneeze'
  | 'boing'
  | 'whoosh'
  | 'honk'
  | 'beep'
  | 'zap'
  | 'tune'
  | 'hiccup'
  | 'chirp'
  | 'plopp'
  | 'thud'
  | 'sparkle'
  | 'shutter'
  | 'kiss'
  | 'yawn'
  | 'bonk'
  | 'backfire'
  | 'chomp'
  | 'beam';
export type FxName =
  | 'puff'
  | 'hearts'
  | 'notes'
  | 'sparkles'
  | 'confetti'
  | 'zzz'
  | 'sweat'
  | 'flash'
  | 'rain'
  | 'dust'
  | 'fireworks'
  | 'smoke'
  | 'bubbles'
  | 'speed'
  | 'teleport'
  | 'gum'
  | 'crumbs'
  | 'shake';

export interface GagPose {
  /** UFO offset, rotation, scale and opacity */
  ux?: number;
  uy?: number;
  ur?: number;
  us?: number;
  ua?: number;
  /** block offset (from where it hangs or rests), rotation, scale and opacity */
  bx?: number;
  by?: number;
  br?: number;
  bs?: number;
  ba?: number;
  /** tractor beam strength 0..1 (default 1 while carrying) */
  beam?: number;
  beamColor?: 'rainbow';
  face?: Face;
  hat?: Hat;
  prop?: Prop;
  /** prop animation parameter (e.g. map rotation, lick phase) */
  propP?: number;
  extra?: Extra;
  extraP?: number;
  /** decoration shown on the block (it keeps it when the gag has a deco) */
  bdeco?: Deco;
  say?: string;
}

/** what a gag may know about the delivery */
export interface GagKit {
  /** flight direction: 1 = to the right */
  dir: number;
  /** offset from the UFO to the drop point above another tower */
  wrongDx: number;
  wrongDy: number;
  stars: number;
  blockH: number;
  /** free space below the hanging block */
  room: number;
  /** drop gags: distance from the hanging position to the resting position */
  dropDist: number;
  /** distance from the UFO down to the ground */
  toGround: number;
  /** tower height before this block, and metres left to the finish line after it */
  metres: number;
  toGoal: number;
  teamName: string;
}

export interface GagCue {
  at: number;
  sfx?: SfxName;
  fx?: FxName;
}

export interface GagDef {
  id: string;
  /** carry: on the way to the tower; drop: while setting the block down */
  phase: 'carry' | 'drop';
  dur: number;
  /** the flight waits while the gag plays (default); otherwise it continues at `speed` */
  halt?: boolean;
  speed?: number;
  /** carry progress (0..1) at which the gag starts (default 0.62: in the middle of the screen) */
  at?: number;
  /** teleport: at gag time `at` the flight jumps to progress `to` */
  jump?: { at: number; to: number };
  /** drop gags: gag time when the block touches the tower */
  landAt?: number;
  minStars?: number;
  deco?: Deco;
  pose: (t: number, k: GagKit) => GagPose;
  cues?: GagCue[];
}

// ---------------------------------------------------------------- helpers

const ramp = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const bell = (t: number) => Math.sin(Math.PI * clamp(t));
const inside = (t: number, a: number, b: number) => t >= a && t < b;
const say = (t: number, ...parts: [number, number, string][]) => parts.find(([a, b]) => inside(t, a, b))?.[2];
/** drop gags: block offset while it is lowered between gag times a and b */
const lower = (t: number, a: number, b: number, k: GagKit) => -k.dropDist * (1 - ease.inOutCubic(ramp(t, a, b)));
/** a quick hop up and back */
const hop = (t: number, at: number, len = 0.14) => bell(ramp(t, at, at + len));

// ---------------------------------------------------------------- the 40 gags

export const GAGS: GagDef[] = [
  {
    id: 'hatschi',
    phase: 'carry',
    dur: 2.4,
    pose: (t, k) => {
      const fall = Math.min(240, Math.max(60, k.room));
      const down = t < 0.3 ? 0 : t < 0.58 ? fall * ramp(t, 0.3, 0.58) ** 2 : fall * (1 - ease.outCubic(ramp(t, 0.58, 0.95)));
      return {
        ur: t < 0.3 ? -0.14 * ramp(t, 0, 0.3) : 0.12 * bell(ramp(t, 0.3, 0.45)),
        ux: 34 * bell(ramp(t, 0.3, 0.42)) * k.dir,
        by: down,
        beam: inside(t, 0.3, 0.58) ? 0 : 1,
        face: t < 0.3 ? 'strain' : t < 0.6 ? 'surprised' : 'grin',
        say: say(t, [0.04, 0.3, 'Ha … ha …'], [0.3, 0.58, 'HATSCHI!'], [0.66, 1, 'Gerettet!']),
      };
    },
    cues: [
      { at: 0.3, sfx: 'sneeze', fx: 'puff' },
      { at: 0.58, sfx: 'beam' },
    ],
  },
  {
    id: 'looping',
    phase: 'carry',
    dur: 1.7,
    pose: (t, k) => {
      const a = TAU * ease.inOutCubic(t);
      return { ux: 110 * Math.sin(a) * k.dir, uy: -110 * (1 - Math.cos(a)), ur: a * k.dir, face: 'grin', say: say(t, [0.1, 0.95, 'Juhuuu!']) };
    },
    cues: [{ at: 0.05, sfx: 'whoosh' }],
  },
  {
    id: 'pizza',
    phase: 'carry',
    dur: 1.9,
    pose: (t) => ({ br: TAU * 2 * ease.inOutCubic(t), bs: 1 + 0.12 * bell(t), face: 'grin', say: say(t, [0.1, 0.9, 'Pizza-Drehung!']) }),
    cues: [{ at: 0.1, sfx: 'whoosh' }],
  },
  {
    id: 'schwer',
    phase: 'carry',
    dur: 2.6,
    minStars: 4,
    pose: (t) => ({
      uy: 48 * bell(t) + 4 * Math.sin(t * 46) * bell(t),
      ur: 0.07 * Math.sin(t * 31) * bell(t),
      face: 'strain',
      say: say(t, [0.08, 0.92, 'Uff! So viel Schönheit ist schwer!']),
    }),
    cues: [
      { at: 0.2, fx: 'sweat' },
      { at: 0.55, fx: 'sweat' },
    ],
  },
  {
    id: 'jojo',
    phase: 'carry',
    dur: 2.1,
    pose: (t, k) => ({ by: Math.min(120, Math.max(40, k.room)) * (0.5 - 0.5 * Math.cos(ramp(t, 0.05, 0.95) * TAU * 2)), face: 'grin', say: say(t, [0.1, 0.9, 'Jo-jo!']) }),
    cues: [
      { at: 0.28, sfx: 'boing' },
      { at: 0.73, sfx: 'boing' },
    ],
  },
  {
    id: 'falscherTurm',
    phase: 'carry',
    dur: 3.8,
    at: 0.55,
    pose: (t, k) => {
      const go = t < 0.7 ? ease.inOutCubic(ramp(t, 0, 0.32)) : 1 - ease.inOutCubic(ramp(t, 0.7, 1));
      return {
        ux: k.wrongDx * go,
        uy: k.wrongDy * go,
        face: inside(t, 0.32, 0.55) ? 'confused' : inside(t, 0.55, 0.72) ? 'surprised' : 'happy',
        say: say(t, [0.34, 0.55, 'Hmm … ist das der richtige Turm?'], [0.55, 0.75, 'Ups! Falscher Turm!']),
      };
    },
    cues: [{ at: 0.56, sfx: 'beep' }],
  },
  {
    id: 'nickerchen',
    phase: 'carry',
    dur: 3.4,
    pose: (t) => ({
      uy: t < 0.76 ? 70 * ramp(t, 0.18, 0.76) : 70 * (1 - ease.outCubic(ramp(t, 0.76, 0.92))),
      ur: t < 0.76 ? 0.12 * ramp(t, 0.18, 0.5) : 0,
      face: t < 0.18 ? 'sleep' : t < 0.76 ? 'sleep' : 'surprised',
      say: say(t, [0.0, 0.18, 'Uaaah …'], [0.76, 1, 'Huch! Ich bin wach!']),
    }),
    cues: [
      { at: 0.02, sfx: 'yawn' },
      { at: 0.3, fx: 'zzz' },
      { at: 0.45, fx: 'zzz' },
      { at: 0.6, fx: 'zzz' },
      { at: 0.76, sfx: 'boing' },
    ],
  },
  {
    id: 'selfie',
    phase: 'carry',
    dur: 2.3,
    pose: (t) => ({ prop: 'camera', face: t < 0.45 ? 'grin' : 'wink', say: say(t, [0.12, 0.45, 'Cheese!'], [0.55, 0.98, 'Schönes Foto!']) }),
    cues: [{ at: 0.45, sfx: 'shutter', fx: 'flash' }],
  },
  {
    id: 'sonnenbrille',
    phase: 'carry',
    dur: 2.4,
    pose: (t, k) => ({ hat: 'sunglasses', face: 'cool', ux: 18 * Math.sin(t * TAU) * k.dir, ur: -0.1 * bell(t) * k.dir, say: say(t, [0.1, 0.92, 'Ganz cool bleiben.']) }),
  },
  {
    id: 'musik',
    phase: 'carry',
    dur: 2.6,
    pose: (t) => ({
      prop: 'flute',
      propP: t,
      br: 0.18 * Math.sin(t * TAU * 4),
      uy: 8 * Math.sin(t * TAU * 4),
      face: 'happy',
      say: say(t, [0.1, 0.85, 'La-la-laaa!']),
    }),
    cues: [
      { at: 0.02, sfx: 'tune' },
      { at: 0.1, fx: 'notes' },
      { at: 0.35, fx: 'notes' },
      { at: 0.6, fx: 'notes' },
    ],
  },
  {
    id: 'schluckauf',
    phase: 'carry',
    dur: 2.3,
    pose: (t) => {
      const h = hop(t, 0.15) + hop(t, 0.45) + hop(t, 0.75);
      return { uy: -32 * h, by: 10 * h, face: h > 0.1 ? 'surprised' : 'confused', say: say(t, [0.15, 0.32, 'Hick!'], [0.45, 0.62, 'Hick!'], [0.75, 0.92, 'Hick!']) };
    },
    cues: [
      { at: 0.15, sfx: 'hiccup' },
      { at: 0.45, sfx: 'hiccup' },
      { at: 0.75, sfx: 'hiccup' },
    ],
  },
  {
    id: 'zickzack',
    phase: 'carry',
    dur: 2.4,
    pose: (t) => ({
      ux: 95 * Math.sin(t * TAU * 2.5) * bell(t),
      ur: 0.22 * Math.cos(t * TAU * 2.5) * bell(t),
      face: 'confused',
      say: say(t, [0.08, 0.9, 'Links? Rechts? Links!']),
    }),
    cues: [{ at: 0.05, sfx: 'whoosh' }],
  },
  {
    id: 'hupe',
    phase: 'carry',
    dur: 1.7,
    pose: (t) => ({ prop: 'horn', us: 1 + 0.08 * (hop(t, 0.22, 0.12) + hop(t, 0.56, 0.12)), face: 'grin', say: say(t, [0.2, 0.95, 'Tröt! Platz da!']) }),
    cues: [
      { at: 0.22, sfx: 'honk' },
      { at: 0.56, sfx: 'honk' },
    ],
  },
  {
    id: 'regenwolke',
    phase: 'carry',
    dur: 3.1,
    pose: (t) => ({
      extra: 'cloud',
      extraP: t,
      prop: t > 0.45 ? 'umbrella' : undefined,
      face: t < 0.45 ? 'sad' : 'grin',
      say: say(t, [0.12, 0.45, 'Och nö, Regen!'], [0.52, 0.96, 'Gut, dass ich einen Schirm habe!']),
    }),
    cues: [
      { at: 0.15, fx: 'rain' },
      { at: 0.35, fx: 'rain' },
      { at: 0.55, fx: 'rain' },
      { at: 0.75, fx: 'rain' },
    ],
  },
  {
    id: 'vogel',
    phase: 'carry',
    dur: 3.1,
    pose: (t) => ({ extra: 'bird', extraP: t, face: t < 0.3 ? 'surprised' : 'love', say: say(t, [0.28, 0.72, 'Oh, ein Vögelchen!']) }),
    cues: [
      { at: 0.3, sfx: 'chirp' },
      { at: 0.55, sfx: 'chirp' },
    ],
  },
  {
    id: 'schmetterling',
    phase: 'carry',
    dur: 2.7,
    pose: (t) => ({ extra: 'butterfly', extraP: t, face: 'love', say: say(t, [0.12, 0.9, 'Ooh, wie hübsch!']) }),
    cues: [{ at: 0.5, fx: 'hearts' }],
  },
  {
    id: 'kuss',
    phase: 'carry',
    dur: 2.1,
    minStars: 4,
    pose: (t) => ({ face: 'love', br: 0.06 * Math.sin(t * 20) * bell(t), say: say(t, [0.08, 0.96, 'Was für ein schöner Buchstabe!']) }),
    cues: [
      { at: 0.25, sfx: 'kiss', fx: 'hearts' },
      { at: 0.55, fx: 'hearts' },
    ],
  },
  {
    id: 'regenbogen',
    phase: 'carry',
    dur: 2.4,
    halt: false,
    speed: 0.6,
    at: 0.2,
    pose: (t) => ({ beamColor: 'rainbow', face: 'grin', say: say(t, [0.08, 0.9, 'Regenbogen-Strahl!']) }),
    cues: [
      { at: 0.1, sfx: 'sparkle', fx: 'sparkles' },
      { at: 0.6, fx: 'sparkles' },
    ],
  },
  {
    id: 'wackelkontakt',
    phase: 'carry',
    dur: 2.8,
    pose: (t, k) => {
      const off = inside(t, 0.08, 0.55) && Math.floor(t * 34) % 3 === 0;
      const slip = Math.min(60, Math.max(20, k.room)) * ramp(t, 0.08, 0.55) * (t < 0.72 ? 1 : 1 - ramp(t, 0.72, 0.95));
      return {
        beam: off ? 0.1 : 1,
        by: slip,
        ux: inside(t, 0.56, 0.7) ? 7 * Math.sin(t * 140) : 0,
        face: t < 0.72 ? 'scared' : 'grin',
        say: say(t, [0.08, 0.55, 'Batterie leer?!'], [0.56, 0.72, 'Klopf, klopf!'], [0.74, 1, 'Läuft wieder!']),
      };
    },
    cues: [
      { at: 0.58, sfx: 'bonk' },
      { at: 0.64, sfx: 'bonk' },
      { at: 0.72, sfx: 'beam' },
    ],
  },
  {
    id: 'partyhut',
    phase: 'carry',
    dur: 2.2,
    deco: 'party',
    pose: (t) => ({ bdeco: t > 0.35 ? 'party' : undefined, face: 'grin', say: say(t, [0.36, 0.95, 'Party-Hut für dich!']) }),
    cues: [{ at: 0.35, sfx: 'plopp', fx: 'confetti' }],
  },
  {
    id: 'jonglieren',
    phase: 'carry',
    dur: 2.5,
    pose: (t) => ({ extra: 'juggle', extraP: t, face: t < 0.5 ? 'focus' : 'grin', say: say(t, [0.5, 0.96, 'Kann ich auch!']) }),
  },
  {
    id: 'turbo',
    phase: 'carry',
    dur: 1.5,
    halt: false,
    speed: 2.6,
    at: 0.15,
    pose: (t, k) => ({ extra: 'flames', extraP: t, ur: -0.16 * k.dir * bell(t), face: 'grin', say: say(t, [0.05, 0.8, 'Turbo!']) }),
    cues: [
      { at: 0.02, sfx: 'whoosh', fx: 'speed' },
      { at: 0.4, fx: 'speed' },
    ],
  },
  {
    id: 'teleport',
    phase: 'carry',
    dur: 1.5,
    at: 0.2,
    jump: { at: 0.5, to: 0.94 },
    pose: (t) => {
      const a = t < 0.5 ? 1 - ramp(t, 0.22, 0.5) : ramp(t, 0.5, 0.8);
      return { ua: a, ba: a, us: 0.6 + 0.4 * a, face: 'grin', say: say(t, [0.0, 0.25, 'Teleport!'], [0.7, 1, 'Tadaa!']) };
    },
    cues: [
      { at: 0.25, sfx: 'zap', fx: 'teleport' },
      { at: 0.52, fx: 'teleport' },
    ],
  },
  {
    id: 'kopfstand',
    phase: 'carry',
    dur: 2.5,
    pose: (t) => ({
      br: Math.PI * (t < 0.6 ? ease.inOutCubic(ramp(t, 0.08, 0.32)) : 1 - ease.inOutCubic(ramp(t, 0.6, 0.85))),
      face: 'surprised',
      say: say(t, [0.32, 0.6, 'Hoppla, andersrum!'], [0.86, 1, 'So!']),
    }),
    cues: [{ at: 0.6, sfx: 'whoosh' }],
  },
  {
    id: 'landkarte',
    phase: 'carry',
    dur: 2.9,
    pose: (t) => ({
      prop: 'map',
      propP: t < 0.55 ? Math.PI : Math.PI * (1 - ease.outCubic(ramp(t, 0.55, 0.68))),
      face: t < 0.55 ? 'confused' : 'happy',
      say: say(t, [0.08, 0.52, 'Wo ist denn bloß …?'], [0.62, 0.98, 'Ah, da lang!']),
    }),
  },
  {
    id: 'kaugummi',
    phase: 'carry',
    dur: 2.6,
    pose: (t) => ({
      extra: t < 0.7 ? 'gumBubble' : undefined,
      extraP: ramp(t, 0.05, 0.7),
      face: t < 0.7 ? 'focus' : 'surprised',
      say: say(t, [0.74, 1, 'Ups, Kaugummi!']),
    }),
    cues: [{ at: 0.7, sfx: 'plopp', fx: 'gum' }],
  },
  {
    id: 'schwindelig',
    phase: 'carry',
    dur: 2.7,
    pose: (t) => ({
      ur: Math.sin(t * TAU * 3) * 0.55 * bell(ramp(t, 0, 0.6)),
      extra: t > 0.4 ? 'dizzyStars' : undefined,
      extraP: t,
      face: t > 0.35 ? 'dizzy' : 'grin',
      say: say(t, [0.45, 0.96, 'Mir ist schwindelig …']),
    }),
    cues: [{ at: 0.05, sfx: 'whoosh' }],
  },
  {
    id: 'naschen',
    phase: 'carry',
    dur: 2.5,
    pose: (t) => ({
      bs: 1 - 0.06 * hop(t, 0.36, 0.08),
      face: t < 0.42 ? 'grin' : 'yuck',
      say: say(t, [0.06, 0.36, 'Mmmh, sieht lecker aus …'], [0.46, 0.98, 'Bäh! Schmeckt nach Tinte!']),
    }),
    cues: [{ at: 0.38, sfx: 'chomp', fx: 'crumbs' }],
  },
  {
    id: 'fahne',
    phase: 'carry',
    dur: 2.1,
    pose: (t, k) => ({ prop: 'flag', propP: t, face: 'happy', say: say(t, [0.08, 0.95, `Los, ${k.teamName}!`]) }),
  },
  {
    id: 'schrumpfstrahl',
    phase: 'carry',
    dur: 2.7,
    pose: (t) => ({
      prop: 'wand',
      bs: t < 0.6 ? 1 - 0.65 * ease.outCubic(ramp(t, 0.08, 0.3)) : 0.35 + 0.65 * ease.outBack(ramp(t, 0.6, 0.8)),
      face: inside(t, 0.3, 0.6) ? 'surprised' : 'grin',
      say: say(t, [0.32, 0.6, 'Ups, zu klein!'], [0.8, 1, 'Schon besser.']),
    }),
    cues: [
      { at: 0.08, sfx: 'zap' },
      { at: 0.6, sfx: 'zap' },
    ],
  },
  {
    id: 'sternschnuppe',
    phase: 'carry',
    dur: 3.1,
    pose: (t) => ({
      extra: 'shootingStar',
      extraP: ramp(t, 0.05, 0.45),
      face: t < 0.5 ? 'surprised' : 'love',
      say: say(t, [0.15, 0.5, 'Eine Sternschnuppe!'], [0.52, 0.98, 'Ich wünsch mir … noch mehr schöne Buchstaben!']),
    }),
    cues: [{ at: 0.2, sfx: 'sparkle' }],
  },
  {
    id: 'fehlzuendung',
    phase: 'carry',
    dur: 2.3,
    pose: (t, k) => {
      const kick = hop(t, 0.2, 0.18) + hop(t, 0.45, 0.18) + hop(t, 0.7, 0.18);
      return { ux: 22 * kick * k.dir, ur: 0.1 * kick * k.dir, face: 'surprised', say: say(t, [0.2, 0.95, 'Puff! Hust, hust!']) };
    },
    cues: [
      { at: 0.2, sfx: 'backfire', fx: 'smoke' },
      { at: 0.45, sfx: 'backfire', fx: 'smoke' },
      { at: 0.7, sfx: 'backfire', fx: 'smoke' },
    ],
  },
  {
    id: 'verbeugung',
    phase: 'carry',
    dur: 2.0,
    minStars: 5,
    pose: (t) => ({ ur: 0.38 * bell(ramp(t, 0.1, 0.7)), uy: 14 * bell(ramp(t, 0.1, 0.7)), face: 'happy', say: say(t, [0.1, 0.96, 'Bitte sehr, Majestät!']) }),
    cues: [{ at: 0.3, fx: 'sparkles' }],
  },
  // ---- while setting the block down
  {
    id: 'bumm',
    phase: 'drop',
    dur: 1.7,
    landAt: 0.42,
    pose: (t, k) => ({
      by: t < 0.25 ? -k.dropDist : -k.dropDist * (1 - ramp(t, 0.25, 0.42) ** 2),
      beam: t < 0.25 ? 1 : 0,
      face: t < 0.45 ? 'scared' : 'grin',
      say: say(t, [0.12, 0.42, 'Ups!'], [0.5, 1, 'Hält bombenfest!']),
    }),
    cues: [{ at: 0.42, sfx: 'thud', fx: 'shake' }],
  },
  {
    id: 'flummi',
    phase: 'drop',
    dur: 1.9,
    landAt: 0.3,
    pose: (t, k) => ({
      by: t < 0.3 ? lower(t, 0, 0.3, k) : -60 * Math.abs(Math.sin(ramp(t, 0.3, 0.92) * Math.PI * 3)) * (1 - ramp(t, 0.3, 0.92)),
      face: 'grin',
      say: say(t, [0.3, 0.96, 'Boing, boing!']),
    }),
    cues: [
      { at: 0.3, sfx: 'boing' },
      { at: 0.5, sfx: 'boing' },
      { at: 0.7, sfx: 'boing' },
    ],
  },
  {
    id: 'wackeln',
    phase: 'drop',
    dur: 2.3,
    landAt: 0.25,
    pose: (t, k) => ({
      by: lower(t, 0, 0.25, k),
      br: 0.22 * Math.sin(ramp(t, 0.25, 1) * TAU * 3) * (1 - ramp(t, 0.25, 0.85)),
      face: t < 0.75 ? 'scared' : 'happy',
      say: say(t, [0.28, 0.72, 'Wackel, wackel …'], [0.76, 1, 'Puh, hält!']),
    }),
  },
  {
    id: 'polieren',
    phase: 'drop',
    dur: 2.5,
    landAt: 0.86,
    deco: 'shine',
    pose: (t, k) => ({
      by: t < 0.6 ? -k.dropDist : lower(t, 0.6, 0.86, k),
      prop: t < 0.6 ? 'cloth' : undefined,
      propP: t,
      bdeco: t > 0.55 ? 'shine' : undefined,
      face: 'focus',
      say: say(t, [0.04, 0.56, 'Erst noch polieren …'], [0.62, 0.9, 'Blitzblank!']),
    }),
    cues: [
      { at: 0.2, fx: 'sparkles' },
      { at: 0.4, fx: 'sparkles' },
      { at: 0.57, sfx: 'sparkle', fx: 'sparkles' },
    ],
  },
  {
    id: 'massband',
    phase: 'drop',
    dur: 2.8,
    landAt: 0.82,
    pose: (t, k) => ({
      by: t < 0.58 ? -k.dropDist : lower(t, 0.58, 0.82, k),
      prop: 'tape',
      extra: t < 0.6 ? 'tapeLine' : undefined,
      extraP: ramp(t, 0.02, 0.25) * (t < 0.5 ? 1 : 1 - ramp(t, 0.5, 0.6)),
      face: 'focus',
      say: say(t, [0.22, 0.55, `${k.metres} m hoch!`], [0.84, 1, k.toGoal > 0 ? `Noch ${k.toGoal} m bis zum Ziel!` : 'Ziel erreicht!']),
    }),
  },
  {
    id: 'feuerwerk',
    phase: 'drop',
    dur: 1.9,
    landAt: 0.3,
    pose: (t, k) => ({ by: lower(t, 0, 0.3, k), face: 'grin', say: say(t, [0.34, 0.94, 'Tadaa!']) }),
    cues: [
      { at: 0.34, sfx: 'sparkle', fx: 'fireworks' },
      { at: 0.55, fx: 'fireworks' },
      { at: 0.75, sfx: 'sparkle', fx: 'fireworks' },
    ],
  },
  {
    id: 'bluemchen',
    phase: 'drop',
    dur: 2.3,
    landAt: 0.3,
    deco: 'flower',
    pose: (t, k) => ({
      by: lower(t, 0, 0.3, k),
      prop: inside(t, 0.3, 0.6) ? 'flower' : undefined,
      bdeco: t > 0.6 ? 'flower' : undefined,
      face: 'love',
      say: say(t, [0.34, 0.96, 'Ein Blümchen für dich!']),
    }),
    cues: [{ at: 0.6, sfx: 'plopp', fx: 'hearts' }],
  },
];

export const GAG_BY_ID = new Map(GAGS.map((g) => [g.id, g]));

// ---------------------------------------------------------------- idle mischief ("Schabernack")

export type MischiefKind = 'push' | 'icecream' | 'fly' | 'clean' | 'nap' | 'wave' | 'music';

export interface MischiefInfo {
  /** push: 0 = flying there, 1 = pushing, 2 = bounced off */
  phase: number;
  /** 0..1 within the phase (or the whole mischief) */
  t: number;
  /** icecream: the scoop fell down */
  scoopGone: boolean;
}

/** how an alien looks while it is up to mischief */
export function mischiefPose(kind: MischiefKind, m: MischiefInfo): GagPose {
  const t = m.t;
  switch (kind) {
    case 'push':
      if (m.phase === 0) return { face: 'wink', say: say(t, [0.4, 1, 'Hihi …']) };
      if (m.phase === 1) return { face: 'strain', ur: 0.05 * Math.sin(t * 50), say: say(t, [0.05, 0.6, 'Hau ruck!'], [0.6, 1, 'Grrr …!']) };
      return { face: 'dizzy', extra: 'dizzyStars', extraP: t, ur: TAU * ease.outCubic(t), say: say(t, [0.1, 1, 'Boing! Der Turm hält!']) };
    case 'icecream':
      return m.scoopGone
        ? { prop: 'icecream', propP: -1, face: 'sad', say: say(t, [0, 0.75, 'Neeein, mein Eis!']) }
        : { prop: 'icecream', propP: t, face: Math.sin(t * 20) > 0.6 ? 'love' : 'happy', say: say(t, [0.05, 0.35, 'Mmmh, Eis!']) };
    case 'fly':
      return { face: 'grin', say: say(t, [0.0, 0.25, 'Wiii!']) };
    case 'clean':
      return { prop: 'sponge', propP: t, face: 'happy', say: say(t, [0.0, 0.3, 'Putz, putz …'], [0.82, 1, 'Blitzblank!']) };
    case 'nap':
      return { face: 'sleep', uy: 10 * Math.sin(t * 9), ur: 0.05 * Math.sin(t * 9) };
    case 'wave':
      return m.phase === 0 ? { face: 'happy' } : { prop: 'wave', propP: t, face: 'happy', say: say(t, [0.05, 0.95, 'Hallo, Klasse!']) };
    case 'music':
      return { prop: 'flute', propP: t, face: 'happy', uy: 6 * Math.sin(t * 25) };
  }
}
