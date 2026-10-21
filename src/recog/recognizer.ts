// Recognises glyphs (CNN + templates) and scores them.
import type { GlyphScore, Strictness, TemplateStyle } from '../vision/types.ts';
import { baseOf, CHARSET, expectedDots, groupOf, GROUPS, UMLAUTS } from './classes.ts';
import type { GlyphNet } from './cnn.ts';
import type { QualityFeatures } from './quality.ts';
import { combine, type ScoreInput } from './score.ts';
import { matchSkel, similarity, type MatchResult, type Skel, type TemplateBank } from './templates.ts';

export interface GlyphFeatures {
  cnn: Float32Array;
  /** horizontally mirrored CNN input (practice mode mirror check) */
  cnnMirror?: Float32Array;
  skel: Skel;
  quality: QualityFeatures;
  /** body box aspect w/h */
  aspect: number;
  dots: number;
  /** body height in detection px */
  bodyH: number;
  baselineDev?: number;
}

export interface ScoreOptions {
  target?: string;
  strictness: Strictness;
  style: 'beide' | TemplateStyle;
}

/** Characters whose mirror image is the same character, so a mirror check makes no sense. */
const SYMMETRIC = new Set('AHIMOTUVWXYilmnouvwx08');

interface Analysis {
  char: string;
  scoredAs: string;
  input: ScoreInput;
  /** x-height normalised body height for the size consistency term */
  normH: number;
  bodyH: number;
  top3?: { char: string; p: number }[];
}

/** Case pairs that look identical in isolation: the letter height decides. */
const CASE_PAIRS = new Map<string, [string, string]>();
for (const g of GROUPS) {
  const lo = [...g].find((c) => c >= 'a' && c <= 'z');
  const up = lo?.toUpperCase();
  if (lo && up && g.includes(up)) {
    CASE_PAIRS.set(lo, [lo, up]);
    CASE_PAIRS.set(up, [lo, up]);
  }
}
const UMLAUT_CASE: Record<string, [string, string]> = { 'ü': ['ü', 'Ü'], 'Ü': ['ü', 'Ü'], 'ö': ['ö', 'Ö'], 'Ö': ['ö', 'Ö'] };

export class Recognizer {
  readonly bank: TemplateBank;
  readonly net: GlyphNet | null;
  /** per-class median similarity on reference handwriting (tools/calibrate.ts) */
  readonly calib: Record<string, number>;
  /** median over all characters: the calibration only evens out differences between letters */
  private calibRef: number;

  constructor(bank: TemplateBank, net: GlyphNet | null, calib: Record<string, number> = {}) {
    this.bank = bank;
    this.net = net;
    this.calib = calib;
    const meds = Object.values(calib).sort((a, b) => a - b);
    this.calibRef = meds.length ? meds[meds.length >> 1] : 1;
  }

  private groupProbs(p: Float32Array): Map<string, number> {
    const m = new Map<string, number>();
    for (let i = 0; i < p.length; i++) {
      const g = groupOf(CHARSET[i]);
      m.set(g, (m.get(g) ?? 0) + p[i]);
    }
    return m;
  }

  /** Best template match over all characters of a group. */
  private bestMatch(skel: Skel, chars: string, style: ScoreOptions['style'], mirror = false): MatchResult | null {
    let best: MatchResult | null = null;
    for (const ch of chars) {
      for (const t of this.bank.forChar(ch, style)) {
        const r = matchSkel(skel, t, false, mirror);
        if (!best || r.D < best.D) best = r;
      }
    }
    return best;
  }

  private calibrated(T: number, ch: string): number {
    const med = this.calib[ch];
    if (!med) return T;
    return Math.min(1, (T * this.calibRef) / Math.max(0.45, med));
  }

  private analyze(f: GlyphFeatures, opts: ScoreOptions): Analysis {
    const probs = this.net ? this.net.probs(f.cnn) : null;
    const gp = probs ? this.groupProbs(probs) : null;
    let top3: Analysis['top3'];
    if (probs) {
      top3 = [...probs]
        .map((p, i) => ({ char: CHARSET[i], p }))
        .sort((a, b) => b.p - a.p)
        .slice(0, 3);
    }

    let scoredBase: string;
    let match: MatchResult | null;
    let L: number | null = null;
    let margin = 0;
    let looksLike: string | undefined;
    let mirrored = false;
    let charOut: string;

    if (opts.target) {
      const target = opts.target;
      scoredBase = baseOf(target);
      const grp = groupOf(scoredBase);
      match = this.bestMatch(f.skel, grp, opts.style);
      if (gp) {
        L = gp.get(grp) ?? 0;
        const [topG, topP] = [...gp.entries()].sort((a, b) => b[1] - a[1])[0];
        if (topG !== grp && topP > 0.6 && L < 0.15) looksLike = topG[0];
        // an i without its dot looks like l/I/1: that is a missing dot, not a different letter
        if (scoredBase === 'i' && f.dots === 0) {
          L = Math.max(L, gp.get(groupOf('l')) ?? 0);
          looksLike = undefined;
        }
        if (!SYMMETRIC.has(scoredBase) && f.cnnMirror && this.net && L < 0.2) {
          const pm = this.groupProbs(this.net.probs(f.cnnMirror)).get(grp) ?? 0;
          if (pm > 0.5) {
            mirrored = true;
            looksLike = undefined;
          }
        }
      } else {
        // template-only legibility: margin to the best other character
        const others = this.coarseRank(f.skel, opts.style).filter((c) => groupOf(c) !== grp).slice(0, 5);
        const other = this.bestMatch(f.skel, others.join(''), opts.style);
        const dT = match?.D ?? 8;
        const dO = other?.D ?? 8;
        margin = (dO - dT) / Math.max(0.5, dT);
        if (margin < -0.35 && other) looksLike = other.template.char;
        if (!SYMMETRIC.has(scoredBase)) {
          const mm = this.bestMatch(f.skel, grp, opts.style, true);
          if (mm && match && mm.D < match.D - 1) mirrored = true;
        }
      }
      charOut = target;
    } else {
      // free writing: candidates from the CNN (or a coarse template ranking)
      let cands: string[];
      if (gp) cands = [...gp.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([g]) => g);
      else cands = [...new Set(this.coarseRank(f.skel, opts.style).slice(0, 8).map(groupOf))];
      let bestScore = -Infinity;
      let bestGroup = cands[0];
      let bestM: MatchResult | null = null;
      const ds: number[] = [];
      for (const g of cands) {
        const m = this.bestMatch(f.skel, g, opts.style);
        if (!m) continue;
        ds.push(m.D);
        const s = gp ? 0.55 * (gp.get(g) ?? 0) + 0.45 * similarity(m.D) : -m.D;
        if (s > bestScore) {
          bestScore = s;
          bestGroup = g;
          bestM = m;
        }
      }
      match = bestM;
      if (gp) L = gp.get(bestGroup) ?? 0;
      else {
        ds.sort((a, b) => a - b);
        margin = ds.length > 1 ? (ds[1] - ds[0]) / Math.max(0.5, ds[0]) : 0.3;
      }
      // pick the most probable member of the group
      let ch = bestGroup[0];
      if (probs) {
        let bp = -1;
        for (const c of bestGroup) {
          const p = probs[CHARSET.indexOf(c)] ?? 0;
          if (p > bp) {
            bp = p;
            ch = c;
          }
        }
      } else if (match) ch = match.template.char;
      scoredBase = ch;
      charOut = ch;
      if (f.dots >= 2 && UMLAUTS[ch]) charOut = UMLAUTS[ch];
      if (f.dots >= 2 && (ch === 'o' || ch === '0' || ch === 'O')) charOut = 'ö';
      if (f.dots === 1 && (ch === 'l' || ch === 'I' || ch === '1')) charOut = 'i';
    }

    const tpl = match?.template ?? this.bank.forChar(scoredBase)[0] ?? this.bank.templates[0];
    const T = match ? this.calibrated(similarity(match.D), tpl.char) : 0;
    const ts = tpl.skel;
    const heightUnits = Math.max(0.6, tpl.top + Math.max(0, tpl.bottom));
    const input: ScoreInput = {
      L,
      margin,
      T,
      shear: match?.shear ?? 0,
      jitter: f.quality.jitter,
      widthCV: f.quality.widthCV,
      holesG: f.skel.holes,
      holesT: ts.holes,
      endG: f.skel.endpoints,
      endT: ts.endpoints,
      juncG: f.skel.junctions,
      juncT: ts.junctions,
      aspectG: f.aspect,
      aspectT: tpl.aspect,
      dots: f.dots,
      expectedDots: expectedDots(opts.target ?? charOut),
      baselineDev: f.baselineDev,
      mirrored,
      looksLike,
      free: !opts.target,
    };
    return { char: charOut, scoredAs: opts.target ?? charOut, input, normH: f.bodyH / heightUnits, bodyH: f.bodyH, top3 };
  }

  /** Coarse ranking of all characters by unshifted chamfer distance (template-only mode). */
  private coarseRank(skel: Skel, style: ScoreOptions['style']): string[] {
    const best = new Map<string, number>();
    for (const t of this.bank.templates) {
      if (style !== 'beide' && t.style !== style) continue;
      const r = matchSkel(skel, t, true);
      const prev = best.get(t.char);
      if (prev === undefined || r.D < prev) best.set(t.char, r.D);
    }
    return [...best.entries()].sort((a, b) => a[1] - b[1]).map(([c]) => c);
  }

  /** Scores all glyphs of one scan (size consistency needs the whole scan). */
  scoreScan(feats: GlyphFeatures[], opts: ScoreOptions): GlyphScore[] {
    const an = feats.map((f) => this.analyze(f, opts));
    if (an.length >= 3) {
      const hs = an.map((a) => a.normH).sort((a, b) => a - b);
      const med = hs[hs.length >> 1];
      for (const a of an) a.input.sizeRel = a.normH / med;
    }
    // free writing: c/C, o/O, s/S, u/U ... are told apart by their height, measured in x-heights
    // of the unambiguous letters of the same scan (font metrics of the templates)
    if (!opts.target && an.length >= 2) {
      const units = (ch: string) => {
        const t = this.bank.forChar(baseOf(ch))[0];
        return t ? Math.max(0.6, t.top + Math.max(0, t.bottom)) : 1;
      };
      const ref = an.filter((a) => !CASE_PAIRS.has(a.char) && !UMLAUT_CASE[a.char]).map((a) => a.normH);
      if (ref.length) {
        ref.sort((x, y) => x - y);
        const xh = ref[ref.length >> 1];
        for (const a of an) {
          const pair = CASE_PAIRS.get(a.char) ?? UMLAUT_CASE[a.char];
          if (!pair) continue;
          const dLo = Math.abs(Math.log(a.bodyH / units(pair[0]) / xh));
          const dUp = Math.abs(Math.log(a.bodyH / units(pair[1]) / xh));
          a.char = dLo <= dUp ? pair[0] : pair[1];
          a.scoredAs = a.char;
        }
      }
    }
    return an.map((a) => {
      const c = combine(a.input, opts.strictness);
      return {
        score: c.score,
        tier: c.tier,
        parts: c.parts,
        char: a.char,
        scoredAs: a.scoredAs,
        tip: c.tip,
        looksLike: a.input.looksLike,
        top3: a.top3,
        raw: c.raw,
      };
    });
  }
}

