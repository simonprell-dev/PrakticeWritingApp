"""Beauty templates for one script: public/model/<id>/templates-v1.{json,bin}

Same format as make_templates.py (1-bit packed 64x64, row-major, MSB first, glyph fitted to 56 px).
JSON additions: "script": "<id>", "styles": [...], "metrics": "xheight" | "em".

Per template entry {char, style, top, bottom, aspect}:
- metrics "xheight" (Latin scripts grund / schreib, same as druck): top = height above the baseline and
  bottom = depth below the baseline, both in x-heights of the font.
- metrics "em" (all other scripts, which have no x-height): top / bottom above / below the baseline in
  units of the font size (em). aspect = ink box width / height in both cases.
Styles: the script id, except schreib: "sas" (Schulausgangsschrift), "va" (Vereinfachte
Ausgangsschrift), "la" (Lateinische Ausgangsschrift), from Playwrite DE SAS / VA / LA.

Usage: python make_templates_script.py hiragana [more ids ...]   (no ids: all scripts)
"""
import json
import sys

import numpy as np
from PIL import Image

from common import OUT_MODEL, ROOT, TPL_SIZE, TPL_FIT
from make_templates import fit_mask
from scripts import SCRIPTS, font_file
from synth_script import coverage, font_instances, render

SIZE = 200


def metrics(font, ch: str, mode: str):
    b = font.getbbox(ch, anchor="ls")
    if mode == "xheight":
        xb = font.getbbox("x", anchor="ls")
        unit = xb[3] - xb[1]
    else:
        unit = SIZE
    return {"top": round(-b[1] / unit, 3), "bottom": round(b[3] / unit, 3),
            "aspect": round((b[2] - b[0]) / max(1, b[3] - b[1]), 3)}


def make(sid: str) -> None:
    s = SCRIPTS[sid]
    entries, blobs = [], []
    for fam, style in s.templates:
        assert font_file(fam).exists(), fam
        cov = coverage(fam, s.classes)
        assert len(cov) == len(s.classes), (fam, [c for c in s.classes if c not in cov])
        _, font = font_instances(fam, SIZE, (400,))[0]
        for ch in s.classes:
            hr = render(font, ch, 0, SIZE)
            blobs.append(np.packbits(fit_mask(hr).flatten()))
            entries.append({"char": ch, "style": style, **metrics(font, ch, s.metrics)})
    meta = {"version": "v1", "script": sid, "styles": [st for _, st in s.templates], "metrics": s.metrics,
            "size": TPL_SIZE, "fit": TPL_FIT, "bytesPerTemplate": TPL_SIZE * TPL_SIZE // 8, "templates": entries}
    out = OUT_MODEL / sid
    out.mkdir(parents=True, exist_ok=True)
    (out / "templates-v1.bin").write_bytes(np.concatenate(blobs).tobytes())
    (out / "templates-v1.json").write_text(json.dumps(meta, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{sid}: wrote {len(entries)} templates")

    cols = min(22, len(s.classes))
    rows = (len(blobs) + cols - 1) // cols
    sheet = Image.new("L", (cols * 66, rows * 66), 0)
    for i, blob in enumerate(blobs):
        m = np.unpackbits(blob)[: TPL_SIZE * TPL_SIZE].reshape(TPL_SIZE, TPL_SIZE) * 255
        sheet.paste(Image.fromarray(m.astype(np.uint8)), ((i % cols) * 66, (i // cols) * 66))
    (ROOT / "out" / sid).mkdir(parents=True, exist_ok=True)
    sheet.save(ROOT / "out" / sid / "templates.png")


if __name__ == "__main__":
    for sid in sys.argv[1:] or list(SCRIPTS):
        make(sid)
