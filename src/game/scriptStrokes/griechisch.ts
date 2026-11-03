// Stroke order and direction for griechisch – see path.ts for the format.
//
// Convention: Greek letters as children learn them in Greek primary school (print / handwriting forms).
// Capitals that look like Latin ones (Α Β Ε Ζ Η Ι Κ Μ Ν Ο Ρ Τ Υ Χ) copy the Latin Druckschrift glyphs of
// strokes.ts, so the app stays consistent. The other capitals go top to bottom, left to right. Most
// lowercase letters are one continuous stroke as in Greek handwriting (α like a with a tail, ε as two
// arcs, σ starting at the bowl, ω as two joined bowls); bars come first where they open the letter
// (ζ ξ π τ).
//
// Sources:
//   https://www.foundalis.com/lan/hw/grkhandw.htm (Greek handwriting; its text notes, e.g. Δ like Α with
//     the base as stroke 3, Λ like Α without the bar, the two forms of β)
//   https://en.wikipedia.org/wiki/Greek_alphabet (letter forms)
// No school chart with numbered strokes was found; open questions: α (tail or loop), β, ρ, π/τ (bar first?).
import { RING, type StrokeTable } from './path.ts';

/** small round bowl in the x-height, counter-clockwise from the top */
const SMALL_O = RING(0.45, 1.5, 0.4, 0.5, -90, -450);

export const STROKES: StrokeTable = {
  // ---- capitals ----
  Α: { w: 1.4, strokes: ['M0.05 2 L0.7 0', 'M0.7 0 L1.35 2', 'M0.32 1.25 L1.08 1.25'] },
  Β: { w: 1.15, strokes: ['M0.1 0 L0.1 2', 'M0.1 0 L0.5 0 C0.98 0 0.98 0.95 0.5 0.95 L0.1 0.95 L0.58 0.95 C1.12 0.95 1.12 2 0.58 2 L0.1 2'] },
  Γ: { w: 0.95, strokes: ['M0.1 0 L0.1 2', 'M0.1 0 L0.9 0'] },
  // like Α, the base line drawn last
  Δ: { w: 1.4, strokes: ['M0.05 2 L0.7 0', 'M0.7 0 L1.35 2', 'M0.05 2 L1.35 2'] },
  Ε: { w: 1.0, strokes: ['M0.1 0 L0.1 2', 'M0.1 0 L0.95 0', 'M0.1 1 L0.8 1', 'M0.1 2 L0.95 2'] },
  Ζ: { w: 1.1, strokes: ['M0.1 0 L1.0 0', 'M1.0 0 L0.1 2', 'M0.1 2 L1.05 2'] },
  Η: { w: 1.2, strokes: ['M0.1 0 L0.1 2', 'M1.1 0 L1.1 2', 'M0.1 1 L1.1 1'] },
  // like Ο with the bar through the middle
  Θ: { w: 1.4, strokes: [RING(0.7, 1, 0.62, 1, -90, -450), 'M0.35 1 L1.05 1'] },
  Ι: { w: 0.3, strokes: ['M0.15 0 L0.15 2'] },
  Κ: { w: 1.1, strokes: ['M0.1 0 L0.1 2', 'M0.12 1.1 L1.0 0', 'M0.38 0.78 L1.05 2'] },
  // like Α without the bar
  Λ: { w: 1.3, strokes: ['M0.05 2 L0.65 0', 'M0.65 0 L1.25 2'] },
  Μ: { w: 1.5, strokes: ['M0.1 2 L0.1 0', 'M0.1 0 L0.75 1.35', 'M0.75 1.35 L1.4 0', 'M1.4 0 L1.4 2'] },
  Ν: { w: 1.2, strokes: ['M0.1 2 L0.1 0', 'M0.1 0 L1.1 2', 'M1.1 2 L1.1 0'] },
  Ξ: { w: 1.1, strokes: ['M0.1 0 L1.0 0', 'M0.25 1 L0.85 1', 'M0.1 2 L1.0 2'] },
  Ο: { w: 1.4, strokes: [RING(0.7, 1, 0.62, 1, -90, -450)] },
  Π: { w: 1.2, strokes: ['M0.1 0 L0.1 2', 'M0.1 0 L1.1 0', 'M1.1 0 L1.1 2'] },
  Ρ: { w: 1.05, strokes: ['M0.1 0 L0.1 2', 'M0.1 0 L0.5 0 C1.02 0 1.02 1.05 0.5 1.05 L0.1 1.05'] },
  // one stroke, from the top right
  Σ: { w: 1.1, strokes: ['M1.0 0 L0.1 0 L0.6 1 L0.1 2 L1.0 2'] },
  Τ: { w: 1.2, strokes: ['M0.6 0 L0.6 2', 'M0.05 0 L1.15 0'] },
  Υ: { w: 1.2, strokes: ['M0.1 0 L0.6 1', 'M0.6 1 L1.1 0', 'M0.6 1 L0.6 2'] },
  // the oval first, then the line from top to bottom
  Φ: { w: 1.4, strokes: [RING(0.7, 1, 0.62, 0.58, -90, -450), 'M0.7 0 L0.7 2'] },
  Χ: { w: 1.2, strokes: ['M0.1 0 L1.1 2', 'M1.1 0 L0.1 2'] },
  // the cup first, then the line from top to bottom
  Ψ: { w: 1.3, strokes: ['M0.08 0.15 C0.08 1.0 0.35 1.3 0.65 1.3 C0.95 1.3 1.22 1.0 1.22 0.15', 'M0.65 0 L0.65 2'] },
  // one stroke from the left foot over the arch to the right foot
  Ω: {
    w: 1.4,
    strokes: ['M0.08 2 L0.45 2 C0.15 1.75 0.05 1.4 0.05 1.0 C0.05 0.4 0.38 0 0.7 0 C1.02 0 1.35 0.4 1.35 1.0 C1.35 1.4 1.25 1.75 0.95 2 L1.32 2'],
  },

  // ---- lowercase ----
  // a round bowl counter-clockwise from the top right, then down to the base line with a little tail
  α: { w: 1.1, strokes: ['M0.88 1.12 C0.66 0.95 0.08 0.98 0.08 1.5 C0.08 2.05 0.7 2.05 0.9 1.1 L0.92 1.75 C0.94 1.98 1.02 2.02 1.1 1.95'] },
  // the stem from top to bottom, then the two bumps
  β: {
    w: 0.95,
    strokes: ['M0.1 0.45 L0.1 2.85', 'M0.1 0.45 C0.1 0.0 0.75 -0.05 0.75 0.42 C0.75 0.72 0.48 0.9 0.35 0.95 C0.78 0.98 0.9 1.25 0.9 1.5 C0.9 1.95 0.5 2.05 0.1 1.85'],
  },
  // one stroke: the left arm down into the loop below the line, then up to the right
  γ: { w: 0.95, strokes: ['M0.02 1.1 C0.2 0.95 0.4 1.5 0.5 2.1 C0.6 2.6 0.62 2.88 0.46 2.88 C0.3 2.88 0.32 2.55 0.44 2.1 C0.57 1.6 0.75 1.15 0.92 1.0'] },
  // one stroke: from the top right over the neck down into the round bowl
  δ: {
    w: 0.95,
    strokes: ['M0.8 0.12 C0.62 -0.03 0.22 0.0 0.22 0.3 C0.22 0.62 0.88 0.8 0.88 1.45 C0.88 1.85 0.68 2 0.47 2 C0.22 2 0.06 1.8 0.06 1.5 C0.06 1.2 0.3 1.0 0.58 0.95'],
  },
  // two arcs in one stroke, from the top right
  ε: { w: 0.85, strokes: ['M0.75 1.15 C0.6 0.98 0.15 0.98 0.15 1.25 C0.15 1.45 0.35 1.5 0.52 1.5 C0.3 1.5 0.05 1.55 0.05 1.76 C0.05 2.06 0.6 2.05 0.8 1.85'] },
  // the short bar, then the body down to the hook below the line
  ζ: {
    w: 0.85,
    strokes: ['M0.15 0.05 L0.75 0.05', 'M0.75 0.05 C0.3 0.4 0.05 1.0 0.05 1.55 C0.05 1.95 0.35 2.05 0.55 2.15 C0.78 2.27 0.75 2.65 0.5 2.75'],
  },
  // like n with the right leg reaching below the line
  η: { w: 0.95, strokes: ['M0.1 1 L0.1 2', 'M0.1 1.4 C0.2 1.05 0.85 0.95 0.85 1.4 L0.85 2.85'] },
  // the tall oval, then the bar
  θ: { w: 0.9, strokes: [RING(0.45, 1, 0.4, 1, -90, -450), 'M0.08 1 L0.82 1'] },
  ι: { w: 0.5, strokes: ['M0.15 1 L0.15 1.78 C0.15 2.02 0.32 2.03 0.45 1.92'] },
  κ: { w: 0.9, strokes: ['M0.1 1 L0.1 2', 'M0.8 1 L0.12 1.55', 'M0.3 1.4 L0.85 2'] },
  // the long stroke from the top left down to the right, then the short leg
  λ: { w: 1.0, strokes: ['M0.05 0.05 C0.3 0.0 0.4 0.3 0.5 0.6 L0.95 2', 'M0.52 0.95 L0.05 2'] },
  // the long stem, then the bowl like u
  μ: { w: 1.0, strokes: ['M0.1 1 L0.1 2.85', 'M0.1 1.55 C0.1 2.1 0.8 2.1 0.8 1.55 L0.8 1', 'M0.8 1 L0.8 1.8 C0.8 2.0 0.9 2.02 0.98 1.95'] },
  ν: { w: 0.95, strokes: ['M0.05 1 C0.2 1.3 0.32 1.7 0.42 2 C0.72 1.72 0.9 1.4 0.9 1.0'] },
  // the short bar, then the body with its two bulges down to the hook below the line
  ξ: {
    w: 0.85,
    strokes: ['M0.15 0.05 L0.75 0.05', 'M0.75 0.05 C0.25 0.1 0.2 0.62 0.62 0.68 C0.12 0.75 0.05 1.2 0.05 1.52 C0.05 1.95 0.35 2.05 0.55 2.15 C0.78 2.27 0.75 2.65 0.5 2.75'],
  },
  ο: { w: 0.9, strokes: [SMALL_O] },
  // the bar first, then the two legs
  π: { w: 1.05, strokes: ['M0.05 1.05 L1.0 1.05', 'M0.3 1.05 L0.3 2', 'M0.75 1.05 L0.75 1.8 C0.75 2.0 0.88 2.03 1.0 1.95'] },
  // one stroke from below the line up and round the bowl
  ρ: { w: 0.95, strokes: ['M0.1 2.85 L0.1 1.5 C0.1 1.15 0.25 1 0.47 1 C0.72 1 0.87 1.25 0.87 1.5 C0.87 1.8 0.67 2 0.47 2 C0.27 2 0.13 1.88 0.1 1.72'] },
  // the bowl counter-clockwise from the top, then the bar to the right
  σ: { w: 1.05, strokes: ['M0.5 1.0 C0.22 1.0 0.05 1.25 0.05 1.5 C0.05 1.8 0.25 2 0.45 2 C0.7 2 0.86 1.8 0.86 1.5 C0.86 1.22 0.68 1.02 0.5 1.02 L1.0 1.0'] },
  // final sigma: like c, curling down below the line
  ς: { w: 0.85, strokes: ['M0.8 1.12 C0.6 0.95 0.05 1.0 0.05 1.5 C0.05 1.85 0.3 1.95 0.5 2.05 C0.72 2.17 0.7 2.55 0.45 2.62'] },
  τ: { w: 0.9, strokes: ['M0.05 1 L0.85 1', 'M0.45 1 L0.45 1.8 C0.45 2.0 0.6 2.03 0.72 1.95'] },
  υ: { w: 0.95, strokes: ['M0.03 1.08 C0.13 0.98 0.15 1.25 0.15 1.5 C0.15 1.88 0.35 2 0.5 2 C0.72 2 0.9 1.75 0.85 1.0'] },
  // the round bowl, then the long line from above down below the line
  φ: { w: 1.1, strokes: [RING(0.55, 1.5, 0.5, 0.5, -90, -450), 'M0.55 0.4 L0.55 2.9'] },
  χ: { w: 0.95, strokes: ['M0.05 1 L0.9 2.9', 'M0.9 1 L0.05 2.9'] },
  // the cup, then the long line from above down below the line
  ψ: { w: 1.05, strokes: ['M0.05 1.0 C0.05 1.8 0.3 2.0 0.52 2.0 C0.75 2.0 1.0 1.8 1.0 1.0', 'M0.52 0.4 L0.52 2.9'] },
  // two joined bowls in one stroke
  ω: { w: 1.4, strokes: ['M0.3 1.05 C0.05 1.3 0.05 2 0.38 2 C0.6 2 0.7 1.8 0.7 1.5 C0.7 1.8 0.8 2 1.02 2 C1.35 2 1.35 1.3 1.1 1.05'] },
};
