// Recognises glyphs (CNN + templates) and scores them.
import type { GlyphScore, Strictness, TemplateStyle } from '../vision/types.ts';
import { baseOf, CHARSET, expectedDots, groupOf, GROUPS, UMLAUTS, zoneDeviation, type Zone } from './classes.ts';
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
  /** position in the school lines */
  zone?: Zone;
}

export interface ScoreOptions {
  target?: string;
  /** practice mode: surprise letters that may be written instead of the target */
  bonus?: string[];
  strictness: Strictness;
  style: 'beide' | TemplateStyle;
  /** mirror writing is not a letter (setting): the glyph is marked as rejected */
  noMirror?: boolean;
}

/** Characters whose mirror image is the same character, so a mirror check makes no sense. */
const SYMMETRIC = new Set('AHIMOTUVWXYilmnouvwx08');
/** Letters whose mirror image is another letter: written that way they are that letter. */
const MIRROR_TWIN: Record<string, string> = { b: 'd', d: 'b', p: 'q', q: 'p' };
/** free writing: how much better the mirror image has to be to call it mirror writing (score, template distance) */
const MIRROR_MARGIN = 0.1;
const MIRROR_FIT = 0.8;
const MIRROR_FIT_STRONG = 0.6;

/** Result of the per-glyph analysis (serialisable, can come from another worker). */
export interface Analysis {
  char: string;
  scoredAs: string;
  input: ScoreInput;
  /** x-height normalised body height for the size consistency term */
  normH: number;
  bodyH: number;
  top3?: { char: string; p: number }[];
  /** position in the school lines */
  zone?: Zone;
  /** CNN input (debug view only) */
  cnn?: Float32Array;
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

  analyze(f: GlyphFeatures, opts: ScoreOptions): Analysis {
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
      const target = this.chooseTarget(f, gp, opts);
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
      // mirror writing: the mirror image is a clearly better character than the glyph itself (CNN and
      // template together, as above) and its template fits clearly closer. The CNN alone is not enough:
      // it also reads a mirrored S as a 2 and a mirrored 3 as an E. A mirrored b is a d, a real letter:
      // b/d and p/q stay what they look like.
      if (gp && f.cnnMirror && this.net) {
        const pm = this.net.probs(f.cnnMirror);
        const [mg, mp] = [...this.groupProbs(pm).entries()].sort((a, b) => b[1] - a[1])[0];
        let mch = mg[0];
        for (const c of mg) if ((pm[CHARSET.indexOf(c)] ?? 0) > (pm[CHARSET.indexOf(mch)] ?? 0)) mch = c;
        const twin = MIRROR_TWIN[mch];
        if (mp > 0.5 && mg !== bestGroup && !SYMMETRIC.has(mch) && !(twin && bestGroup.includes(twin))) {
          const mm = this.bestMatch(f.skel, mg, opts.style, true);
          const sm = 0.55 * mp + 0.45 * similarity(mm?.D ?? Infinity);
          // clearly better overall – or as good, and the mirrored template fits much closer
          const better = sm > bestScore + MIRROR_MARGIN || (sm >= bestScore - 0.02 && !!mm && !!bestM && mm.D < bestM.D * MIRROR_FIT_STRONG);
          if (mm && bestM && mm.D < bestM.D * MIRROR_FIT && better) {
            mirrored = true;
            scoredBase = mch;
            charOut = mch;
            L = mp;
            match = mm;
          }
        }
      }
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
      expectedDots: expectedDots(charOut),
      baselineDev: f.baselineDev,
      zoneDev: f.zone ? zoneDeviation(charOut, f.zone) : undefined,
      mirrored,
      looksLike,
      free: !opts.target,
    };
    return { char: charOut, scoredAs: charOut, input, normH: f.bodyH / heightUnits, bodyH: f.bodyH, top3, zone: f.zone };
  }

  /**
   * Practice mode: the glyph is scored against the practice letter – or against a surprise letter when it
   * clearly is that one (more probable than the practice letter), so it gets a fair score.
   */
  private chooseTarget(f: GlyphFeatures, gp: Map<string, number> | null, opts: ScoreOptions): string {
    const target = opts.target!;
    if (!opts.bonus?.length) return target;
    const tg = groupOf(baseOf(target));
    let best = target;
    if (gp) {
      let bestP = gp.get(tg) ?? 0;
      for (const b of opts.bonus) {
        const p = gp.get(groupOf(baseOf(b))) ?? 0;
        if (p > bestP && p > 0.35) {
          best = b;
          bestP = p;
        }
      }
      return best;
    }
    // template-only: the clearly closer skeleton decides
    let bestD = this.bestMatch(f.skel, tg, opts.style)?.D ?? Infinity;
    for (const b of opts.bonus) {
      const d = this.bestMatch(f.skel, groupOf(baseOf(b)), opts.style)?.D ?? Infinity;
      if (d < bestD * 0.8) {
        best = b;
        bestD = d;
      }
    }
    return best;
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
    return this.finalize(
      feats.map((f) => this.analyze(f, opts)),
      opts,
    );
  }

  /** Scan-wide part of the scoring: size consistency and upper/lower case need all glyphs. */
  finalize(an: Analysis[], opts: ScoreOptions): GlyphScore[] {
    if (an.length >= 3) {
      const hs = an.map((a) => a.normH).sort((a, b) => a - b);
      const med = hs[hs.length >> 1];
      for (const a of an) a.input.sizeRel = a.normH / med;
    }
    // free writing: c/C, o/O, s/S, u/U ... are told apart by their height, measured in x-heights
    // of the unambiguous letters of the same scan (font metrics of the templates)
    // with school lines the band a letter reaches decides: c/C, o/O, s/S ... (also for a single letter)
    if (!opts.target) {
      for (const a of an) {
        const pair = CASE_PAIRS.get(a.char) ?? UMLAUT_CASE[a.char];
        if (!pair || !a.zone) continue;
        a.char = zoneDeviation(pair[0], a.zone) <= zoneDeviation(pair[1], a.zone) ? pair[0] : pair[1];
        a.scoredAs = a.char;
      }
    }
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
          if (!pair || a.zone) continue;
          const dLo = Math.abs(Math.log(a.bodyH / units(pair[0]) / xh));
          const dUp = Math.abs(Math.log(a.bodyH / units(pair[1]) / xh));
          a.char = dLo <= dUp ? pair[0] : pair[1];
          a.scoredAs = a.char;
        }
      }
    }
    for (const a of an) if (a.zone) a.input.zoneDev = zoneDeviation(a.scoredAs, a.zone);
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
        mirrored: a.input.mirrored || undefined,
        rejected: (opts.noMirror && a.input.mirrored) || undefined,
        top3: a.top3,
        raw: c.raw,
      };
    });
  }
}

