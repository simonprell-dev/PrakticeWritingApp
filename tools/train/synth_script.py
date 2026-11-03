"""Synthetic training glyphs for any script: every font x weight instance x stroke variant.

Same EMNIST-style output as render_fonts.synth_bank (uint8 28x28, ink = 255), but fonts are loaded once
per weight instance (the CJK fonts are 4-10 MB), variable fonts are rendered at several weights and the
glyph is drawn centred on a large canvas so tall cursive / Thai / Devanagari glyphs never clip.

Per glyph and weight instance there are two kinds of variants:
- outline: the font outline widened by Script.strokes px (like render_fonts.synth_bank)
- monoline: the outline thinned to its skeleton (Zhang-Suen) and re-drawn with a round pen of
  MONO_WIDTHS px (in 28x28 space) - closer to a pencil line, removes the font's stroke contrast
Instead of rejecting variants by stroke width, the width is pulled into 1.7..3.3 px exactly like the
browser does with the camera glyph (src/vision/normalize.ts toCnnInput), then blurred by 0.6.
"""
import numpy as np
import torch
import torch.nn.functional as F
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFilter, ImageFont

from real_data import normalise_stroke
from render_fonts import stroke_width, to_emnist
from scripts import Script, font_file

HR = 120  # render size in px
MONO_WIDTHS = (1.8, 2.6, 3.3)


def zhang_suen(b: np.ndarray) -> np.ndarray:
    """Skeleton of a boolean image (Zhang-Suen thinning, vectorised)."""
    b = b.copy()
    while True:
        changed = False
        for step in (0, 1):
            P = np.pad(b, 1)
            p2, p3, p4, p5 = P[:-2, 1:-1], P[:-2, 2:], P[1:-1, 2:], P[2:, 2:]
            p6, p7, p8, p9 = P[2:, 1:-1], P[2:, :-2], P[1:-1, :-2], P[:-2, :-2]
            seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2]
            nb = sum(x.astype(np.uint8) for x in seq[:8])
            A = sum((~seq[i] & seq[i + 1]).astype(np.uint8) for i in range(8))
            if step == 0:
                c = ~(p2 & p4 & p6) & ~(p4 & p6 & p8)
            else:
                c = ~(p2 & p4 & p8) & ~(p2 & p6 & p8)
            m = b & (nb >= 2) & (nb <= 6) & (A == 1) & c
            if m.any():
                b &= ~m
                changed = True
        if not changed:
            return b


def components(b: np.ndarray) -> np.ndarray:
    """4-connected component labels (0 = background) via PIL flood fill (fast, C)."""
    im = Image.fromarray(b.astype(np.uint8) * 255).copy()  # own buffer, fromarray may share a read-only one
    lab = np.zeros(b.shape, np.int64)
    n = 0
    while True:
        arr = np.asarray(im)
        free = np.argwhere(arr == 255)
        if len(free) == 0 or n >= 250:
            return lab
        n += 1
        y, x = free[0]
        ImageDraw.floodfill(im, (int(x), int(y)), n)
        lab[(np.asarray(im) == n) & (lab == 0)] = n


def skeleton_keep_dots(b: np.ndarray) -> np.ndarray:
    """Zhang-Suen skeleton; ink components it deleted completely (small dots thin to a 2x2 square and
    vanish) get their pixel nearest to the component centroid back, so the pen re-draws the dot."""
    sk = zhang_suen(b)
    lab = components(b)
    for c in np.unique(lab[b]):
        comp = lab == c
        if sk[comp].any():
            continue
        ys, xs = np.nonzero(comp)
        k = np.argmin((ys - ys.mean()) ** 2 + (xs - xs.mean()) ** 2)
        sk[ys[k], xs[k]] = True
    return sk


def monoline(hr: np.ndarray, width28: float, sk: np.ndarray | None = None) -> np.ndarray:
    """Re-stroke the skeleton of a rendered glyph with a round pen of width28 px in 28x28 space."""
    if sk is None:
        sk = skeleton_keep_dots(hr > 0.5)
    h, w = hr.shape
    r = max(1.0, width28 * max(h, w) / 24 / 2)
    k = int(np.ceil(r))
    yy, xx = np.mgrid[-k : k + 1, -k : k + 1]
    disk = torch.from_numpy(((xx**2 + yy**2) <= r * r).astype(np.float32))[None, None]
    t = torch.from_numpy(sk.astype(np.float32))[None, None]
    out = (F.conv2d(F.pad(t, (k, k, k, k)), disk) > 0).float()[0, 0].numpy()
    ys, xs = np.nonzero(out)
    if len(xs) == 0:
        return out
    return np.pad(out[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1], 1)


def to_input(hr: np.ndarray) -> np.ndarray:
    """High resolution glyph -> uint8 28x28 network input (fit 24, stroke normalised, blur 0.6)."""
    x = normalise_stroke(to_emnist(hr, blur=0.0))
    im = Image.fromarray((x * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))
    x = np.asarray(im, np.float32)
    return (x / max(x.max(), 1e-6) * 255).astype(np.uint8)


def coverage(family: str, classes: list[str]) -> list[str]:
    """Class strings the font can render (all code points in its cmap)."""
    cmap = TTFont(font_file(family), lazy=True).getBestCmap() or {}
    return [c for c in classes if all(ord(ch) in cmap for ch in c)]


def font_instances(family: str, size: int, weights: tuple[int, ...]):
    """[(label, ImageFont)] - one per wght instance for variable fonts, else just the font."""
    path = str(font_file(family))
    base = ImageFont.truetype(path, size)
    try:
        axes = base.get_variation_axes()
    except (OSError, AttributeError):
        axes = []
    wi = [i for i, a in enumerate(axes) if a.get("name") in (b"Weight", "Weight")]
    if not wi:
        return [("", base)]
    out = []
    a = axes[wi[0]]
    for w in sorted({min(max(w, a["minimum"]), a["maximum"]) for w in weights}):
        f = ImageFont.truetype(path, size)
        vals = [ax["default"] for ax in axes]
        vals[wi[0]] = w
        f.set_variation_by_axes(vals)
        out.append((f"w{w}", f))
    return out


def render(font: ImageFont.FreeTypeFont, text: str, stroke: int = 0, size: int = HR) -> np.ndarray:
    """High resolution float image in 0..1 (ink = 1), cropped to the ink box with 1 px margin."""
    W = size * 5
    img = Image.new("L", (W, W), 0)
    d = ImageDraw.Draw(img)
    d.text((W // 2, W // 2), text, font=font, fill=255, anchor="mm", stroke_width=stroke, stroke_fill=255)
    a = np.asarray(img, dtype=np.float32) / 255.0
    ys, xs = np.nonzero(a > 0.1)
    if len(xs) == 0:
        return np.zeros((1, 1), np.float32)
    a = a[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]
    return np.pad(a, 1)


def bank(script: Script, families: list[str], log=print):
    """Returns (images uint8 [N,28,28], labels int64 [N], font index int16 [N], per-font report)."""
    imgs, labels, fidx, report = [], [], [], []
    for fi, fam in enumerate(families):
        cov = coverage(fam, script.classes)
        if len(cov) < len(script.classes):
            missing = "".join(c for c in script.classes if c not in cov)
            log(f"  {fam}: missing {len(script.classes) - len(cov)} classes: {missing[:40]}")
        if len(cov) < 0.8 * len(script.classes):
            log(f"  {fam}: skipped (coverage {len(cov)}/{len(script.classes)})")
            report.append((fam, 0))
            continue
        n0 = len(labels)
        for _, font in font_instances(fam, HR, script.weights):
            for ch in cov:
                label = script.classes.index(ch)
                variants = [render(font, ch, stroke) for stroke in script.strokes]
                base = variants[0]
                if base.size >= 4:
                    sk = skeleton_keep_dots(base > 0.5)
                    variants += [monoline(base, w, sk) for w in MONO_WIDTHS]
                for hr in variants:
                    if hr.size < 4:
                        continue
                    x = to_input(hr)
                    if stroke_width(x.astype(np.float32) / 255.0) > 3.6:  # outline filled the counters
                        continue
                    imgs.append(x)
                    labels.append(label)
                    fidx.append(fi)
        report.append((fam, len(labels) - n0))
    if not imgs:
        return np.zeros((0, 28, 28), np.uint8), np.zeros(0, np.int64), np.zeros(0, np.int16), report
    return np.stack(imgs), np.array(labels, np.int64), np.array(fidx, np.int16), report
