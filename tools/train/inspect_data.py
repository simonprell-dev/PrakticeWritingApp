"""Sanity checks: writes a labelled sample grid and measures glyph box size and stroke width.

The numbers printed here go into common.py (CNN_FIT) and the exported model meta (strokePx).
"""
import numpy as np
from PIL import Image, ImageDraw

from common import CHARSET, ROOT
import emnist


def stroke_width(img: np.ndarray, thr: int = 128) -> float:
    """2 * area / perimeter of the binarised glyph, a cheap mean stroke width estimate."""
    b = img >= thr
    area = b.sum()
    if area == 0:
        return 0.0
    p = np.pad(b, 1)
    edges = (p[1:-1, 1:-1] & ~p[:-2, 1:-1]).sum() + (p[1:-1, 1:-1] & ~p[2:, 1:-1]).sum()
    edges += (p[1:-1, 1:-1] & ~p[1:-1, :-2]).sum() + (p[1:-1, 1:-1] & ~p[1:-1, 2:]).sum()
    return float(2 * area / max(edges, 1))


def box_side(img: np.ndarray, thr: int = 30) -> int:
    ys, xs = np.nonzero(img >= thr)
    if len(xs) == 0:
        return 0
    return int(max(xs.max() - xs.min() + 1, ys.max() - ys.min() + 1))


def main():
    x, y = emnist.load("test")
    print("test samples", len(x), "classes", y.max() + 1)
    rng = np.random.default_rng(0)
    idx = rng.choice(len(x), 4000, replace=False)
    sw = np.array([stroke_width(x[i]) for i in idx])
    bs = np.array([box_side(x[i]) for i in idx])
    print(f"stroke width median {np.median(sw):.2f}  p10 {np.percentile(sw, 10):.2f}  p90 {np.percentile(sw, 90):.2f}")
    print(f"box longest side median {np.median(bs):.1f}  p10 {np.percentile(bs, 10):.1f}  p90 {np.percentile(bs, 90):.1f}")

    cell = 34
    grid = Image.new("L", (cell * 10, cell * 10), 0)
    draw = ImageDraw.Draw(grid)
    for k in range(100):
        i = int(idx[k])
        r, c = divmod(k, 10)
        grid.paste(Image.fromarray(x[i]), (c * cell, r * cell))
        draw.text((c * cell + 1, r * cell + 26), CHARSET[y[i]], fill=255)
    out = ROOT / "out"
    out.mkdir(exist_ok=True)
    grid.resize((cell * 20, cell * 20), Image.NEAREST).save(out / "emnist_grid.png")
    print("wrote", out / "emnist_grid.png")


if __name__ == "__main__":
    main()
