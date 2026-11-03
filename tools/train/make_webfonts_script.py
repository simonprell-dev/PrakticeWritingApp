"""Display web fonts per script: public/fonts/<id>.woff2 + public/fonts/OFL-<id>-<Family>.txt

Each woff2 is a subset of the script's display font (Script.display, the same font as its templates)
containing exactly the class characters plus the space (schreib: the Latin/German set of
make_webfonts.py). Latin grund reuses PlaywriteDEGrund.woff2, druck uses Druckvorlage.woff2.

Licence (SIL OFL 1.1): a subset is a "Modified Version". If the font's OFL.txt declares Reserved Font
Names (Andika: "Andika", "SIL"; Varela Round: "Varela", "Varela Round"), the subset is renamed to
"Vorlage <Script>" in all name records; the OFL text is written next to the font with a note.

Usage: python make_webfonts_script.py [ids ...]
"""
import re
import sys
import urllib.request

from fontTools import subset

from common import REPO
from make_webfonts import TEXT as LATIN_TEXT
from scripts import FONT_PATHS, SCRIPTS, font_file, licence_dir

GOOGLE_FONTS = "https://github.com/google/fonts/raw/main/"
OUT = REPO / "public" / "fonts"


def rename(font, family: str, original: str) -> None:
    ps = family.replace(" ", "") + "-Regular"
    values = {1: family, 3: f"{ps};krakel-und-krone-subset", 4: f"{family} Regular", 6: ps, 16: family,
              17: "Regular", 21: family, 22: "Regular", 25: family.replace(" ", "")}
    table = font["name"]
    for rec in list(table.names):
        if rec.nameID in values:
            table.setName(values[rec.nameID], rec.nameID, rec.platformID, rec.platEncID, rec.langID)
    table.setName(f"Modified Version (subset) of {original}, renamed according to the SIL Open Font License 1.1.",
                  10, 3, 1, 0x409)


def family_name(path) -> str:
    from fontTools.ttLib import TTFont

    n = TTFont(path, lazy=True)["name"]
    return str(n.getDebugName(16) or n.getDebugName(1))


def make(sid: str) -> None:
    s = SCRIPTS[sid]
    if not s.display:
        print(f"{sid}: no display font (reuses the Latin fonts)")
        return
    fam = s.display
    src = font_file(fam)
    original = family_name(src)
    text = LATIN_TEXT if s.metrics == "xheight" else "".join(s.classes) + " "
    with urllib.request.urlopen(GOOGLE_FONTS + licence_dir(fam) + "/OFL.txt", timeout=60) as r:
        ofl = r.read().decode("utf-8-sig")
    rfn = re.search(r"Reserved Font Names?", ofl[:600], re.I) is not None
    new_family = f"Vorlage {sid.capitalize()}" if rfn else None

    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["*"]
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    font = subset.load_font(str(src), opts)
    sub = subset.Subsetter(opts)
    sub.populate(text=text)
    sub.subset(font)
    missing = [c for c in text if ord(c) not in font.getBestCmap()]
    assert not [c for c in missing if c in s.classes], (sid, missing)
    if missing:
        print(f"{sid}: font has no {''.join(missing)} (not a class, left out)")
    if new_family:
        rename(font, new_family, original)
    OUT.mkdir(parents=True, exist_ok=True)
    dst = OUT / f"{sid}.woff2"
    subset.save_font(font, str(dst), opts)
    lic_name = f"OFL-{sid}-{original.replace(' ', '')}.txt"
    head = f"{dst.name}: subset of \"{original}\" ({FONT_PATHS[fam]} in github.com/google/fonts)"
    if new_family:
        head += (f",\nrenamed to \"{new_family}\" because the original declares Reserved Font Names"
                 f" (the subset is a Modified Version and does not use them).")
    (OUT / lic_name).write_text(head + "\n\n" + ofl, encoding="utf-8")
    print(f"{sid}: wrote {dst.name} ({dst.stat().st_size} bytes, family \"{new_family or original}\") + {lic_name}")


if __name__ == "__main__":
    for sid in sys.argv[1:] or list(SCRIPTS):
        make(sid)
