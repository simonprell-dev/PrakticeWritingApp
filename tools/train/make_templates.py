"""Renders the beauty templates (Druckschrift = Andika, Grundschrift = Playwrite DE Grund).

Writes public/model/templates-v1.bin (1-bit packed 64x64, row-major, MSB first) and templates-v1.json.
"""
import json

import numpy as np
from PIL import Image, ImageFont

from common import CHARSET, FONTS, OUT_MODEL, TEMPLATE_FONTS, TPL_FIT, TPL_SIZE
from render_fonts import has_glyph, render_hr

STYLE = {"Andika-Regular.ttf": "druck", "PlaywriteDEGrund.ttf": "grund"}


def fit_mask(a: np.ndarray) -> np.ndarray:
    h, w = a.shape
    scale = TPL_FIT / max(h, w)
    nh, nw = max(1, round(h * scale)), max(1, round(w * scale))
    im = Image.fromarray((a * 255).astype(np.uint8)).resize((nw, nh), Image.BOX)
    out = np.zeros((TPL_SIZE, TPL_SIZE), np.uint8)
    y0, x0 = (TPL_SIZE - nh) // 2, (TPL_SIZE - nw) // 2
    out[y0 : y0 + nh, x0 : x0 + nw] = (np.asarray(im) >= 128).astype(np.uint8)
    return out


def metrics(font_path, ch: str, size: int = 200):
    font = ImageFont.truetype(str(font_path), size)
    xb = font.getbbox("x", anchor="ls")
    xh = xb[3] - xb[1]
    b = font.getbbox(ch, anchor="ls")
    return {"top": round(-b[1] / xh, 3), "bottom": round(b[3] / xh, 3), "aspect": round((b[2] - b[0]) / max(1, b[3] - b[1]), 3)}


def main():
    OUT_MODEL.mkdir(parents=True, exist_ok=True)
    entries, blobs = [], []
    for fname in TEMPLATE_FONTS:
        path = FONTS / fname
        for ch in CHARSET:
            if not has_glyph(path, ch):
                continue
            hr = render_hr(path, ch, 200, 0)
            m = fit_mask(hr)
            blobs.append(np.packbits(m.flatten()))
            entries.append({"char": ch, "style": STYLE[fname], **metrics(path, ch)})
    meta = {"version": "v1", "size": TPL_SIZE, "fit": TPL_FIT, "bytesPerTemplate": TPL_SIZE * TPL_SIZE // 8, "templates": entries}
    (OUT_MODEL / "templates-v1.bin").write_bytes(np.concatenate(blobs).tobytes())
    (OUT_MODEL / "templates-v1.json").write_text(json.dumps(meta, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {len(entries)} templates")

    # preview sheet
    from common import ROOT

    n = len(entries)
    cols = 21
    rows = (n + cols - 1) // cols
    sheet = Image.new("L", (cols * 66, rows * 66), 0)
    for i, blob in enumerate(blobs):
        m = np.unpackbits(blob)[: TPL_SIZE * TPL_SIZE].reshape(TPL_SIZE, TPL_SIZE) * 255
        sheet.paste(Image.fromarray(m.astype(np.uint8)), ((i % cols) * 66, (i // cols) * 66))
    (ROOT / "out").mkdir(exist_ok=True)
    sheet.save(ROOT / "out" / "templates.png")


if __name__ == "__main__":
    main()
