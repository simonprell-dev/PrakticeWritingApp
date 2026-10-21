"""Subsets the OFL fonts to Latin + German characters and writes woff2 files to public/fonts/.

Licence notes (SIL Open Font License 1.1):
- A subset is a "Modified Version". Andika has the Reserved Font Names "Andika" and "SIL", so its
  subset is renamed to "Druckvorlage" (internal names and file name). Fredoka and Playwrite DE Grund
  have no Reserved Font Names.
- The OFL text with each font's copyright line is written next to the fonts (OFL-*.txt).
"""
import urllib.request

from fontTools import subset

from common import FONTS, GOOGLE_FONTS, REPO

OUT = REPO / "public" / "fonts"
TEXT = (
    "".join(chr(c) for c in range(0x20, 0x7F))
    + "ÄÖÜäöüß€„“‚‘»«–—…·•×÷°²³½"
    + " "
)
# (source ttf, output woff2, new family name or None, OFL file in google/fonts, licence file name)
JOBS = [
    ("Andika-Regular.ttf", "Druckvorlage.woff2", "Druckvorlage", "ofl/andika/OFL.txt", "OFL-Druckvorlage-Andika.txt"),
    ("PlaywriteDEGrund.ttf", "PlaywriteDEGrund.woff2", None, "ofl/playwritedegrund/OFL.txt", "OFL-PlaywriteDEGrund.txt"),
    ("Fredoka.ttf", "Fredoka.woff2", None, "ofl/fredoka/OFL.txt", "OFL-Fredoka.txt"),
]


def rename(font, family: str) -> None:
    """Replaces all name records that identify the font (family, full name, PostScript name, ...)."""
    ps = family.replace(" ", "") + "-Regular"
    values = {
        1: family,
        3: f"{ps};buchstaben-zoo-subset",
        4: f"{family} Regular",
        6: ps,
        16: family,
        17: "Regular",
        21: family,
        22: "Regular",
    }
    table = font["name"]
    for rec in list(table.names):
        if rec.nameID in values:
            table.setName(values[rec.nameID], rec.nameID, rec.platformID, rec.platEncID, rec.langID)
    # description of the modification (nameID 10)
    table.setName(
        "Modified Version (Latin/German subset) of Andika by SIL International, renamed according to the SIL Open Font License 1.1.",
        10, 3, 1, 0x409,
    )


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for src, dst, new_family, ofl_path, ofl_out in JOBS:
        opts = subset.Options()
        opts.flavor = "woff2"
        opts.layout_features = ["kern", "liga", "calt"]
        opts.name_IDs = ["*"]
        opts.notdef_outline = True
        font = subset.load_font(str(FONTS / src), opts)
        sub = subset.Subsetter(opts)
        sub.populate(text=TEXT)
        sub.subset(font)
        if new_family:
            rename(font, new_family)
        subset.save_font(font, str(OUT / dst), opts)
        print("wrote", dst, (OUT / dst).stat().st_size, "bytes")
        with urllib.request.urlopen(GOOGLE_FONTS + ofl_path, timeout=60) as r:
            text = r.read().decode("utf-8")
        if new_family:
            text = (
                f"The font \"{new_family}\" ({dst}) is a Modified Version (subset) of Andika.\n"
                "It does not use the Reserved Font Names \"Andika\" and \"SIL\".\n\n" + text
            )
        (OUT / ofl_out).write_text(text, encoding="utf-8")
        print("wrote", ofl_out)


if __name__ == "__main__":
    main()
