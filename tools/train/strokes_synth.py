"""Synthetic child-like school letters drawn from the app's stroke definitions (Druck- and Grundschrift).

The strokes are the animated templates of the app (src/game/strokes.ts, "Richtformen" of the Bavarian
LehrplanPLUS), exported by tools/export-strokes.ts to data/strokes.json: polylines in school line bands
(top line y = 0, middle 1, base 2, bottom 3), `dot` strokes are the i / j dots. Every variant is the
letter written again by a "child":
- whole glyph: slant (shear, +-12 deg), a little rotation, anisotropic scale
- per stroke: small offset / turn / scale, so strokes that should meet leave small gaps or overlap
- stroke ends: overshoot (extended along the tangent) or undershoot (cut short)
- wobble: smooth low frequency displacement along each stroke plus a little tremor; sometimes the
  curves are drawn as short straight pieces (slow, careful hand)
- pen: width from a thin pencil to a felt pen, pressure (width and ink) varies along the stroke
- dots: small blobs, sometimes a short dash or a tiny ring, placed loosely above the stem
Rendered at 2 x HR px with a round pen, reduced to HR px, then normalised exactly like the browser
(real_data.browser_normalise). Output: EMNIST-style uint8 28x28 (ink = 255), labels = CHARSET indices.

Usage:
  npx vite-node tools/export-strokes.ts                        # once (from the repo root)
  python strokes_synth.py --preview out/strokes_preview.png    # contact sheet: what the network sees
  python strokes_synth.py --preview out/strokes_hr.png --hr    # the same before normalisation
"""
import argparse
import hashlib
import json
import math

import numpy as np
from PIL import Image, ImageDraw

from common import CHARSET, DATA, ROOT
from real_data import CACHE, browser_normalise

STROKES_JSON = DATA / "strokes.json"
STYLES = ("druck", "grund")
HR = 96  # render size in px (longest side of the glyph incl. pen)
VERSION = 1  # bump when the rendering changes (cache key)

# pen width in bands (school line spacing): thin pencil .. felt pen
PEN_MIN, PEN_MAX = 0.07, 0.26


def load_strokes(path=STROKES_JSON) -> dict:
    if not path.exists():
        raise SystemExit(f"{path} is missing - run `npx vite-node tools/export-strokes.ts` in the repo root")
    return json.loads(path.read_text(encoding="utf-8"))


def _clean(p: np.ndarray) -> np.ndarray:
    """Drops repeated points (zero length segments)."""
    keep = np.concatenate([[True], np.hypot(*np.diff(p, axis=0).T) > 1e-6])
    return p[keep]


def _arclen(p: np.ndarray) -> np.ndarray:
    return np.concatenate([[0.0], np.cumsum(np.hypot(*np.diff(p, axis=0).T))])


def _resample(p: np.ndarray, step: float) -> np.ndarray:
    """Polyline [n,2] -> points every ~step along its length (first and last point kept)."""
    s = _arclen(p)
    if len(p) < 2 or s[-1] < 1e-6:
        return p[:1]
    t = np.linspace(0.0, s[-1], max(2, int(math.ceil(s[-1] / step)) + 1))
    return np.stack([np.interp(t, s, p[:, 0]), np.interp(t, s, p[:, 1])], 1)


def _noise(s: np.ndarray, rng, wl_min: float, wl_max: float, k: int = 3) -> np.ndarray:
    """Smooth random function of the arc length s, roughly in -1..1 (sum of k random sinusoids)."""
    out = np.zeros_like(s)
    for _ in range(k):
        f = 2 * math.pi / rng.uniform(wl_min, wl_max)
        out += rng.uniform(0.5, 1.0) * np.sin(f * s + rng.uniform(0, 2 * math.pi))
    return out / k * 1.4


def _ends(p: np.ndarray, rng) -> np.ndarray:
    """Overshoot (longer along the end tangent) or undershoot (cut short) at both ends of a stroke.
    p must be densely resampled (the cut drops points)."""
    for end in (0, 1):
        if rng.random() > 0.55 or len(p) < 3:
            continue
        d = rng.uniform(-0.09, 0.13)
        if end == 0:
            p = p[::-1]
        if d > 0:
            t = p[-1] - p[-3]
            t = t / max(np.hypot(*t), 1e-6)
            p = np.vstack([p, p[-1] + t * np.linspace(0.01, d, max(2, int(d / 0.01)))[:, None]])
        else:
            s = _arclen(p)
            keep = s <= max(s[-1] + d, 0.7 * s[-1])
            p = p[keep] if keep.sum() >= 2 else p
        if end == 0:
            p = p[::-1]
    return p


def _dot(c: np.ndarray, pen: float, rng) -> tuple[np.ndarray, float]:
    """A dot as a short dense polyline (blob, dash or tiny ring) and its pen radius factor."""
    c = c + rng.normal(0, [0.05, 0.07])
    kind = rng.random()
    if kind < 0.18:  # short dash
        a = rng.uniform(-0.5, 0.9)
        l = rng.uniform(0.08, 0.2)
        d = np.array([math.cos(a), math.sin(a)]) * l / 2
        return np.stack([c - d, c + d]), 1.0
    if kind < 0.28 and pen < 0.16:  # tiny ring (thin pens only, else it is a blob anyway)
        r = rng.uniform(0.05, 0.09)
        a = np.linspace(0, 2 * math.pi * rng.uniform(0.9, 1.1), 16)
        return c + np.stack([np.cos(a) * r, np.sin(a) * r], 1), 1.0
    # blob: a tiny scribble, at least ~0.1 bands across so thin pencils still make a visible dot
    r = max(0.0, rng.uniform(0.02, 0.06) - pen / 4)
    a = rng.uniform(0, 2 * math.pi) + np.linspace(0, 4 * math.pi, 10)
    return c + np.stack([np.cos(a) * r, np.sin(a) * r], 1), rng.uniform(1.1, 1.6)


def render_hr(glyph: dict, rng, clean: bool = False) -> np.ndarray:
    """One rendering of a strokes.json glyph -> float ink image (ink = 1), longest side HR px.
    clean: the template itself (no variation, medium pen) for comparison."""
    pen = 0.12 if clean else math.exp(rng.uniform(math.log(PEN_MIN), math.log(PEN_MAX)))
    pencil = pen < 0.13  # thin pens are pencils: lighter, uneven ink
    strokes = []  # (points [n,2] in bands, pen radius factor [n], ink [n])
    for st in glyph["strokes"]:
        p = _clean(np.asarray(st["pts"], np.float64))
        if st["dot"]:
            for c in p:  # one dot stroke can hold both umlaut dots
                q, f = (c[None], 1.3) if clean else _dot(c, pen, rng)
                q = _resample(q, 0.01) if len(q) > 1 else q
                strokes.append((q, np.full(len(q), f), np.ones(len(q))))
            continue
        if clean:
            q = _resample(p, 0.01)
            strokes.append((q, np.ones(len(q)), np.ones(len(q))))
            continue
        if rng.random() < 0.2:  # careful hand: curves become short straight pieces
            p = _resample(p, rng.uniform(0.12, 0.25))
        p = _ends(_resample(p, 0.01), rng)
        s = _arclen(p)
        # wobble: slow drift (unsteady hand) + tremor
        amp, trem = rng.uniform(0.015, 0.06), rng.uniform(0.0, 0.012)
        p = p + np.stack([amp * _noise(s, rng, 0.5, 2.0) + trem * _noise(s, rng, 0.06, 0.15),
                          amp * _noise(s, rng, 0.5, 2.0) + trem * _noise(s, rng, 0.06, 0.15)], 1)
        # long open strokes bow a little (stems and bars are rarely straight)
        chord = p[-1] - p[0]
        cl = np.hypot(*chord)
        if cl > 0.5 * s[-1] and cl > 0.6:
            nrm = np.array([-chord[1], chord[0]]) / cl
            p = p + rng.normal(0, 0.025 * cl) * np.sin(math.pi * s / s[-1])[:, None] * nrm
        # this stroke a little off: offset, turn, scale around its centre (short strokes move more)
        short = s[-1] < 0.8
        m = p.mean(0)
        a = rng.normal(0, math.radians(6 if short else 3))
        k = math.exp(rng.normal(0, 0.12 if short else 0.06))
        R = np.array([[math.cos(a), -math.sin(a)], [math.sin(a), math.cos(a)]]) * k
        p = (p - m) @ R.T + m + rng.normal(0, 0.07 if short else 0.04, 2)
        width = np.clip(1 + 0.2 * _noise(s, rng, 0.5, 2.0), 0.7, 1.3)
        ink = np.ones(len(s))
        if pencil:
            ink = np.clip(rng.uniform(0.75, 1.0) + 0.15 * _noise(s, rng, 0.4, 1.5), 0.5, 1.0)
        strokes.append((p, width, ink))

    # whole glyph: smooth distortion (parts too big / too small, bowls egg-shaped), then anisotropic
    # scale, slant, rotation (y points down)
    if clean:
        M = np.eye(2)
    else:
        waves = [(rng.normal(0, 1, 2), rng.uniform(0, 2 * math.pi), rng.uniform(1.5, 3.5)) for _ in range(4)]
        amp = rng.uniform(0.03, 0.09)

        def warp(p):
            d = np.zeros_like(p)
            for i, (v, ph, wl) in enumerate(waves):
                v = v / max(np.hypot(*v), 1e-6)
                d[:, i % 2] += amp * np.sin(2 * math.pi / wl * (p @ v) + ph)
            return p + d

        strokes = [(warp(p), w, ink) for p, w, ink in strokes]
        sx = math.exp(rng.uniform(-0.2, 0.2))
        sl = math.tan(math.radians(rng.uniform(-12, 12)))
        a = math.radians(rng.uniform(-5, 5))
        M = np.array([[math.cos(a), -math.sin(a)], [math.sin(a), math.cos(a)]]) @ np.array([[1, -sl], [0, 1]]) @ np.diag([sx, 1])
    strokes = [(p @ M.T, w, ink) for p, w, ink in strokes]

    # fit into the canvas (pen included), draw with a round pen at 2x, reduce to HR
    allp = np.vstack([p for p, _, _ in strokes])
    lo, hi = allp.min(0), allp.max(0)
    ext = max(hi - lo)
    S = 2 * HR
    u = (S - 8) / (ext + 1.7 * pen)  # px per band (1.7: pen radius factor of the dots, both sides)
    canvas = np.zeros((S, S), np.float32)
    off = (S - (hi - lo) * u) / 2
    for p, w, ink in strokes:
        layer = Image.new("L", (S, S), 0)
        d = ImageDraw.Draw(layer)
        q = (p - lo) * u + off
        r = pen * u / 2 * w
        for (x, y), ri, v in zip(q, r, ink):
            d.ellipse((x - ri, y - ri, x + ri, y + ri), fill=int(255 * v))
        canvas = np.maximum(canvas, np.asarray(layer, np.float32))
    im = Image.fromarray(canvas.astype(np.uint8)).resize((HR, HR), Image.BOX)
    return np.asarray(im, np.float32) / 255.0


def _cache_name(n_per_char: int, seed: int) -> str:
    h = hashlib.sha1(STROKES_JSON.read_bytes()).hexdigest()[:10] if STROKES_JSON.exists() else "none"
    return f"strokes_v{VERSION}_{n_per_char}_{seed}_{h}.npz"


def stroke_bank(n_per_char: int = 150, seed: int = 0):
    """Returns (images uint8 [N,28,28], labels int64 [N] as CHARSET indices): n_per_char variants per
    character and style (druck, grund), so 2 * n_per_char per character. Cached in data/cache/."""
    f = CACHE / _cache_name(n_per_char, seed)
    if f.exists():
        d = np.load(f)
        return d["x"], d["y"]
    table = load_strokes()
    xs, ys = [], []
    for si, style in enumerate(STYLES):
        for label, ch in enumerate(CHARSET):
            g = table.get(style, {}).get(ch)
            if g is None:
                continue
            rng = np.random.default_rng([seed, si, ord(ch)])  # independent of the other characters
            for _ in range(n_per_char):
                x = browser_normalise(render_hr(g, rng))
                if x is not None:
                    xs.append(x)
                    ys.append(label)
    x, y = np.stack(xs), np.array(ys, np.int64)
    CACHE.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(f, x=x, y=y)
    return x, y


def preview(out, n: int = 6, hr: bool = False, chars: str = CHARSET, seed: int = 1):
    """Contact sheet, dark ink on white: per style blocks of 21 characters, first row the clean template,
    then n variants. hr: the HR rendering (before normalisation) instead of the 28x28 network input."""
    table = load_strokes()
    cell, cols = (48 if hr else 56), 21
    blocks = [chars[i : i + cols] for i in range(0, len(chars), cols)]
    rows = len(STYLES) * len(blocks) * (n + 1)
    sheet = Image.new("L", (cols * cell, rows * cell + len(STYLES) * len(blocks) * 6), 255)
    y0 = 0
    for si, style in enumerate(STYLES):
        for blk in blocks:
            for c, ch in enumerate(blk):
                g = table[style].get(ch)
                if g is None:
                    continue
                rng = np.random.default_rng([seed, si, ord(ch)])
                for r in range(n + 1):
                    a = render_hr(g, rng, clean=r == 0)
                    if not hr:
                        a = browser_normalise(a)
                        a = np.zeros((28, 28), np.uint8) if a is None else a
                    else:
                        a = (a * 255).astype(np.uint8)
                    im = Image.fromarray(255 - a).resize((cell - 2, cell - 2), Image.NEAREST if not hr else Image.BOX)
                    sheet.paste(im, (c * cell + 1, y0 + r * cell + 1))
            y0 += (n + 1) * cell + 6
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out)
    print(f"wrote {out} ({sheet.width}x{sheet.height})")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview", help="write a contact sheet PNG (path relative to tools/train)")
    ap.add_argument("--hr", action="store_true", help="preview the HR rendering instead of the 28x28 input")
    ap.add_argument("--chars", default=CHARSET)
    ap.add_argument("-n", type=int, default=6, help="variants per character in the preview")
    ap.add_argument("--bank", type=int, default=0, help="build stroke_bank(N) and print its size")
    args = ap.parse_args()
    if args.preview:
        from pathlib import Path

        out = Path(args.preview)
        preview(out if out.is_absolute() else ROOT / out, args.n, args.hr, args.chars)
    if args.bank:
        import time

        t0 = time.time()
        x, y = stroke_bank(args.bank)
        counts = np.bincount(y, minlength=len(CHARSET))
        print(f"stroke bank: {len(x)} images, {np.count_nonzero(counts)} classes, per class {counts.min()}..{counts.max()}"
              f" ({time.time() - t0:.0f}s)")
