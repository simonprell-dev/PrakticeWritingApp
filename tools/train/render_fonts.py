"""Renders font glyphs into EMNIST-style 28x28 images (synthetic training data, adds sharp s).

Also used by make_templates.py for high resolution template masks.
"""
import numpy as np
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFilter, ImageFont

from common import CHARSET, CNN_FIT, CNN_SIZE, FONTS, SYNTH_FONTS


def has_glyph(font_path, ch: str) -> bool:
    cmap = TTFont(font_path, lazy=True).getBestCmap() or {}
    return ord(ch) in cmap


def render_hr(font_path, ch: str, size: int = 120, stroke: int = 0, variant: str = "") -> np.ndarray:
    """High resolution float image [H,W] in 0..1 with ink=1, cropped to the ink box (1px margin)."""
    font = ImageFont.truetype(str(font_path), size)
    pad = size
    img = Image.new("L", (size * 3, size * 3), 0)
    d = ImageDraw.Draw(img)
    d.text((pad, pad // 2), ch, font=font, fill=255, stroke_width=stroke, stroke_fill=255)
    a = np.asarray(img, dtype=np.float32) / 255.0
    ys, xs = np.nonzero(a > 0.1)
    if len(xs) == 0:
        return np.zeros((1, 1), np.float32)
    a = a[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]
    if variant == "seven_bar":  # continental 7 with a crossbar
        h, w = a.shape
        y = int(h * 0.55)
        t = max(2, int(round(size * 0.07 + stroke)))
        a[y - t // 2 : y - t // 2 + t, int(w * 0.2) : int(w * 0.85)] = 1.0
    return np.pad(a, 1)


def to_emnist(a: np.ndarray, fit: int = CNN_FIT, size: int = CNN_SIZE, blur: float = 0.0) -> np.ndarray:
    """Fit the longest side to `fit`, centre by box in a size x size frame. Returns float32 0..1."""
    h, w = a.shape
    scale = fit / max(h, w)
    nh, nw = max(1, round(h * scale)), max(1, round(w * scale))
    im = Image.fromarray((a * 255).astype(np.uint8)).resize((nw, nh), Image.BOX)
    if blur > 0:
        im = im.filter(ImageFilter.GaussianBlur(blur))
    out = np.zeros((size, size), np.float32)
    y0, x0 = (size - nh) // 2, (size - nw) // 2
    out[y0 : y0 + nh, x0 : x0 + nw] = np.asarray(im, dtype=np.float32) / 255.0
    m = out.max()
    return out / m if m > 0 else out


def stroke_width(img: np.ndarray, thr: float = 0.5) -> float:
    b = img >= thr
    area = b.sum()
    if area == 0:
        return 0.0
    p = np.pad(b, 1)
    c = p[1:-1, 1:-1]
    edges = (c & ~p[:-2, 1:-1]).sum() + (c & ~p[2:, 1:-1]).sum() + (c & ~p[1:-1, :-2]).sum() + (c & ~p[1:-1, 2:]).sum()
    return float(2 * area / max(edges, 1))


def synth_bank():
    """Returns (images uint8 [N,28,28], labels int64 [N]) from all synthesis fonts and stroke variants."""
    imgs, labels = [], []
    for fname in SYNTH_FONTS:
        path = FONTS / fname
        cmap = TTFont(path, lazy=True).getBestCmap() or {}
        for label, ch in enumerate(CHARSET):
            if ord(ch) not in cmap:
                continue
            variants = [""] + (["seven_bar"] if ch == "7" else [])
            for variant in variants:
                for stroke in (0, 3, 6, 9):
                    hr = render_hr(path, ch, 120, stroke, variant)
                    if hr.size < 4:
                        continue
                    em = to_emnist(hr, blur=0.6)
                    sw = stroke_width(em)
                    if not 1.5 <= sw <= 3.6:
                        continue
                    imgs.append((em * 255).astype(np.uint8))
                    labels.append(label)
    return np.stack(imgs), np.array(labels, dtype=np.int64)


if __name__ == "__main__":
    from common import ROOT

    x, y = synth_bank()
    print("synthetic glyphs:", len(x), "classes covered:", len(set(y.tolist())))
    counts = np.bincount(y, minlength=len(CHARSET))
    print("per class min/max:", counts.min(), counts.max(), " sharp s:", counts[-1])
    rng = np.random.default_rng(1)
    idx = rng.choice(len(x), 100, replace=False)
    grid = Image.new("L", (280, 280))
    for k, i in enumerate(idx):
        r, c = divmod(k, 10)
        grid.paste(Image.fromarray(x[i]), (c * 28, r * 28))
    (ROOT / "out").mkdir(exist_ok=True)
    grid.resize((560, 560), Image.NEAREST).save(ROOT / "out" / "synth_grid.png")
