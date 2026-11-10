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
- numbers : github.com/kensanata/numbers "Set 1" (CC0 1.0), digits of 29 mostly Swiss / European writers
            (1 with the up-stroke, 7 with the bar), folders <writer id>_<country><age><sex>/<digit>/.
            Dark or coloured (ballpoint blue) ink on white paper; the split is by writer (id % 5 == 0 is
            test), so no writer is in both.
- krakel  : children's handwriting from the app's Schriftproben packages (import_samples.py), ink is
            the alpha channel. Not cached (small, and the labels change whenever a PNG is moved by hand).
"""
import io
import zipfile
import zlib

import numpy as np
from PIL import Image, ImageFilter

from common import CHARSET, DATA
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


def _numbers():
    xs, ys, test = [], [], []
    for wdir in sorted(p for p in (RAW / "numbers").glob("0*_*") if p.is_dir()):
        writer = int(wdir.name.split("_")[0])
        for digit in range(10):
            for f in sorted((wdir / str(digit)).glob("*.png")):
                # files are 1-bit, L, P, RGB or RGBA, all opaque: ink = dark or coloured, scaled between the
                # paper (median) and the ink core (99.5th percentile); the lowest 15 % is paper texture
                a = np.asarray(Image.open(f).convert("RGB"), np.float32)
                ink = 1 - a.min(-1) / 255.0
                bg, hi = np.median(ink), np.percentile(ink, 99.5)
                ink = np.clip((ink - bg) / max(hi - bg, 0.15) * 1.15 - 0.15, 0, 1)
                for k in (0, 1, 2, -1, -2, -3):  # remnants of the form's box lines along the crop edge
                    if (ink[k] > 0.5).mean() > 0.5:
                        ink[k] = 0
                    if (ink[:, k] > 0.5).mean() > 0.5:
                        ink[:, k] = 0
                x = browser_normalise(ink)
                if x is None:
                    continue
                xs.append(x)
                ys.append(digit)  # digits are the first ten classes (CHARSET, EMNIST)
                test.append(writer % 5 == 0)
    if not xs:
        raise SystemExit(f"{RAW / 'numbers'} has no digits - run download_data.py")
    return {"x": np.stack(xs), "y": np.array(ys, np.int64), "test": np.array(test)}


def load_krakel(script: str = "druck", sources=("wort", "uebung"), classes: str | list[str] = CHARSET, log=print):
    """Children's handwriting of one script from data/krakel/<script>/<labelfolder>/*.png.

    The label is the FOLDER the PNG lies in (review by moving files, see import_samples.py), not the csv:
    - folders starting with "_" (_falsch, _ohne_label ...) are skipped
    - a PNG that is not where the import put it (moved by hand, or added by hand) counts as reviewed and
      is always taken; otherwise its label_source must be in `sources` (None = all) and it must not be
      mirror writing (mirrored / rejected)
    - labels outside `classes` are skipped. The browser strips umlaut dots before the CNN but the PNGs
      keep them, so umlauts (and any sample with 2+ dots on top) are dropped for now and only counted;
      i / j keep their one dot exactly like in the browser
    Returns (x uint8 [N,28,28], y int64 [N] class indices, batch str [N] for a split by lesson)."""
    from import_samples import KRAKEL, folder_label, read_index, rel, scan

    classes = list(classes)
    index = {r["path"].rsplit("/", 1)[-1]: r for r in read_index() if r.get("path")}
    xs, ys, batches = [], [], []
    n = {"used": 0, "reviewed": 0, "_folders": 0, "unknown folder": 0, "umlaut / 2 dots": 0, "not a class": 0,
         "source": 0, "mirrored": 0, "empty": 0}
    for s, folder, f in scan():
        if s != script:
            continue
        lab = folder_label(folder)
        if lab is None:
            n["_folders" if folder.startswith("_") else "unknown folder"] += 1
            continue
        row = index.get(f.name)
        dots = row.get("dots", "").strip() if row else ""
        if lab in "ÄÖÜäöü" or (dots.isdigit() and int(dots) >= 2):
            n["umlaut / 2 dots"] += 1
            continue
        if lab not in classes:
            n["not a class"] += 1
            continue
        reviewed = row is None or row.get("path") != rel(f)
        if not reviewed:
            if sources is not None and row.get("label_source") not in sources:
                n["source"] += 1
                continue
            if row.get("mirrored") == "1" or row.get("rejected") == "1":
                n["mirrored"] += 1
                continue
        a = np.asarray(Image.open(f).convert("RGBA"), np.float32)[..., 3] / 255.0
        x = browser_normalise(a)
        if x is None:
            n["empty"] += 1
            continue
        xs.append(x)
        ys.append(classes.index(lab))
        batches.append(row["batch"] if row else "_hand")
        n["used"] += 1
        n["reviewed"] += reviewed
    if not KRAKEL.exists():
        log(f"krakel: no data ({KRAKEL} does not exist, see import_samples.py)")
    else:
        log(f"krakel {script}: " + ", ".join(f"{k} {v}" for k, v in n.items() if v or k == "used"))
    if not xs:
        return np.zeros((0, 28, 28), np.uint8), np.zeros(0, np.int64), np.zeros(0, str)
    return np.stack(xs), np.array(ys, np.int64), np.array(batches)


def krakel_test_mask(batch: np.ndarray, share: float = 0.2) -> np.ndarray:
    """Held-out lessons: ~share of the batches, chosen by a hash of the batch id (stable while more data
    arrives), so one lesson is never in train and test. With 2+ batches at least one is held out."""
    ids = sorted(set(batch.tolist()))
    h = {b: zlib.crc32(b.encode()) / 2**32 for b in ids}
    test = {b for b in ids if h[b] < share}
    if not test and len(ids) >= 2:
        test = {min(ids, key=h.get)}
    return np.array([b in test for b in batch.tolist()], bool)


def load(name: str):
    """Returns (x_train, y_train, x_test, y_test) with labels as indices into the script's classes."""
    if name == "emnist":
        import emnist

        xtr, ytr = emnist.load("train")
        xte, yte = emnist.load("test")
        return xtr, ytr, xte, yte
    d = _cached(name, {"comnist": _comnist, "dhcd": _dhcd, "numbers": _numbers}[name])
    t = d["test"].astype(bool)
    return d["x"][~t], d["y"][~t], d["x"][t], d["y"][t]
