"""Real handwriting datasets as EMNIST-style uint8 28x28 arrays (ink = 255), cached in data/cache/.

The images are normalised like the browser does it (src/vision/normalize.ts toCnnInput): ink box,
longest side fitted to 24 px in a 28x28 frame, stroke width pulled into 1.7..3.3 px by soft
dilation / erosion, Gaussian blur 0.6.

- emnist  : EMNIST byclass (see emnist.py), used as is (it already is in that format)
- comnist : CoMNIST Cyrillic (CC BY-SA 4.0). Ink is the alpha channel of 278x278 PNGs. Folder names
            are the upper case letters; contributors wrote upper or lower case (often cursive), so
            the label is the letter, not the case. Folder "I" (not Russian) is dropped.
- dhcd    : Devanagari Handwritten Character Dataset (CC BY 4.0), 32x32 PNGs, white ink on black.
            Only the consonants character_1_ka .. character_33_ha are used (same order as क..ह);
            the conjuncts क्ष त्र ज्ञ and the digits are not classes here.
"""
import io
import zipfile

import numpy as np
from PIL import Image, ImageFilter

from common import DATA
from render_fonts import stroke_width, to_emnist

RAW = DATA / "raw"
CACHE = DATA / "cache"


def _filt(a: np.ndarray, fn) -> np.ndarray:
    p = np.pad(a, 1)
    h, w = a.shape
    stack = [p[dy : dy + h, dx : dx + w] for dy in range(3) for dx in range(3)]
    return fn(np.stack(stack), axis=0)


def normalise_stroke(x: np.ndarray) -> np.ndarray:
    """28x28 float (ink = 1): stroke width into 1.7..3.3 px like toCnnInput (before its final blur)."""
    for _ in range(3):
        if stroke_width(x) >= 1.7:
            break
        x = 0.5 * x + 0.5 * _filt(x, np.max)
        x = x / max(x.max(), 1e-6)
    for _ in range(2):
        if stroke_width(x) <= 3.3:
            break
        x = 0.5 * x + 0.5 * _filt(x, np.min)
        x = x / max(x.max(), 1e-6)
    return x


def browser_normalise(a: np.ndarray) -> np.ndarray | None:
    """a: float ink image 0..1 of any size -> uint8 28x28, or None if empty."""
    ys, xs = np.nonzero(a > 0.5)
    if len(xs) < 4:
        return None
    a = a[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]
    x = normalise_stroke(to_emnist(np.pad(a, 1), blur=0.0))
    im = Image.fromarray((x * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))
    x = np.asarray(im, np.float32)
    return (x / max(x.max(), 1e-6) * 255).astype(np.uint8)


def _cached(name: str, build):
    CACHE.mkdir(parents=True, exist_ok=True)
    f = CACHE / f"{name}.npz"
    if f.exists():
        d = np.load(f, allow_pickle=False)
        return {k: d[k] for k in d.files}
    d = build()
    np.savez_compressed(f, **d)
    return d


def _comnist():
    from scripts import CYR_UP

    z = zipfile.ZipFile(RAW / "CoMNIST-Cyrillic.zip")
    xs, ys, keys = [], [], []
    for n in sorted(z.namelist()):
        if not n.endswith(".png"):
            continue
        letter = n.split("/")[1]
        if letter not in CYR_UP:
            continue
        im = Image.open(io.BytesIO(z.read(n))).convert("RGBA")
        a = np.asarray(im, np.float32)
        ink = a[..., 3] / 255.0 * (1 - a[..., :3].mean(-1) / 255.0)  # dark, opaque pixels
        x = browser_normalise(ink)
        if x is None:
            continue
        xs.append(x)
        ys.append(CYR_UP.index(letter))
        keys.append(n.rsplit("/", 1)[1])
    # stable 85/15 split by file name hash
    test = np.array([int.from_bytes(k.encode(), "little") % 100 < 15 for k in keys])
    return {"x": np.stack(xs), "y": np.array(ys, np.int64), "test": test}


def _dhcd():
    from scripts import DEVA_CONS, DEVA_VOWELS

    z = zipfile.ZipFile(RAW / "DHCD.zip")
    xs, ys, test = [], [], []
    for n in sorted(z.namelist()):
        if not n.endswith(".png") or "/character_" not in n:
            continue
        k = int(n.split("/character_")[1].split("_")[0])
        if k > 33:
            continue
        a = np.asarray(Image.open(io.BytesIO(z.read(n))).convert("L"), np.float32) / 255.0
        x = browser_normalise(a)
        if x is None:
            continue
        xs.append(x)
        ys.append(len(DEVA_VOWELS) + k - 1)
        test.append("/Test/" in n)
    assert len(DEVA_CONS) == 33
    return {"x": np.stack(xs), "y": np.array(ys, np.int64), "test": np.array(test)}


def load(name: str):
    """Returns (x_train, y_train, x_test, y_test) with labels as indices into the script's classes."""
    if name == "emnist":
        import emnist

        xtr, ytr = emnist.load("train")
        xte, yte = emnist.load("test")
        return xtr, ytr, xte, yte
    d = _cached(name, {"comnist": _comnist, "dhcd": _dhcd}[name])
    t = d["test"].astype(bool)
    return d["x"][~t], d["y"][~t], d["x"][t], d["y"][t]
