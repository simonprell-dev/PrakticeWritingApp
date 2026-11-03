"""Preview sheets of training data for one script: out/<id>/samples.png

Rows: random synthetic glyphs (clean) | the same augmented like in training | real handwriting
(augmented, if the script has a dataset) | held-out test-font glyphs (augmented, as tested).

Usage: python preview_script.py hiragana [more ids ...]
"""
import sys
import time

import numpy as np
import torch
from PIL import Image, ImageDraw

import real_data
from augment import augment
from common import ROOT
from scripts import SCRIPTS
from synth_script import bank

COLS = 24


def strip(imgs: np.ndarray) -> Image.Image:
    im = Image.new("L", (COLS * 30, 30), 40)
    for i, a in enumerate(imgs[:COLS]):
        im.paste(Image.fromarray(a), (i * 30 + 1, 1))
    return im


def aug(x: np.ndarray, s: float) -> np.ndarray:
    t = torch.from_numpy(x).float().unsqueeze(1) / 255.0
    return (augment(t, s).squeeze(1) * 255).byte().numpy()


def main(ids):
    torch.manual_seed(1)
    for sid in ids:
        s = SCRIPTS[sid]
        t0 = time.time()
        x, y, _, rep = bank(s, s.synth, print)
        print(f"{sid}: synth bank {len(x)} glyphs in {time.time() - t0:.0f}s, per font {rep}")
        rng = np.random.default_rng(1)
        rows = []
        for _ in range(3):
            k = rng.choice(len(x), COLS, replace=False)
            rows += [("fonts", x[k]), ("augmented", aug(x[k], s.synth_aug))]
        if s.real:
            xr, yr, _, _ = real_data.load(s.real)
            k = rng.choice(len(xr), COLS * 2, replace=False)
            rows += [("real", aug(xr[k[:COLS]], 1.0)), ("real", aug(xr[k[COLS:]], 1.0))]
        if s.test_fonts:
            xt, _, _, _ = bank(s, s.test_fonts, print)
            k = rng.choice(len(xt), COLS * 2, replace=False)
            rows += [("test font", aug(xt[k[:COLS]], 1.0)), ("test font", aug(xt[k[COLS:]], 1.0))]
        sheet = Image.new("L", (90 + COLS * 30, 30 * len(rows)), 0)
        d = ImageDraw.Draw(sheet)
        for r, (name, imgs) in enumerate(rows):
            d.text((4, r * 30 + 10), name, fill=200)
            sheet.paste(strip(imgs), (90, r * 30))
        out = ROOT / "out" / sid
        out.mkdir(parents=True, exist_ok=True)
        sheet.resize((sheet.width * 2, sheet.height * 2), Image.NEAREST).save(out / "samples.png")
        print("wrote", out / "samples.png")


if __name__ == "__main__":
    main(sys.argv[1:] or list(SCRIPTS))
