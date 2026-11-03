"""Download everything the per-script models need: google/fonts files and the real handwriting datasets.

Usage: python tools/train/download_scripts.py          (EMNIST: python tools/train/download_data.py)

Datasets (SHA-256 pinned, no login needed):
- CoMNIST Cyrillic (Gregory Vial, CC BY-SA 4.0): github.com/GregVial/CoMNIST, images/Cyrillic.zip
- DHCD Devanagari Handwritten Character Dataset (Acharya, Pant, Gyawali; UCI ML Repository #389, CC BY 4.0)
"""
import sys

from common import DATA, FONTS
from download_data import fetch, sha256
from scripts import FONT_PATHS, all_families, font_file, font_url

GOOGLE_FONTS = "https://github.com/google/fonts/raw/main/"
RAW = DATA / "raw"
DATASETS = {
    "CoMNIST-Cyrillic.zip": (
        "https://github.com/GregVial/CoMNIST/raw/master/images/Cyrillic.zip",
        "f35b8584491c3b8991b25a82450b25868f1c2b3fe4f1e24ebad393acebd41238",
    ),
    "DHCD.zip": (
        "https://archive.ics.uci.edu/static/public/389/devanagari+handwritten+character+dataset.zip",
        "752e6a2e6b0d1b475375e6a9db937918bbbf7c6b7d137dbe234264029fd3b88d",
    ),
}


def main() -> int:
    RAW.mkdir(parents=True, exist_ok=True)
    FONTS.mkdir(parents=True, exist_ok=True)
    ok = True
    for name, (url, digest) in DATASETS.items():
        dest = RAW / name
        if dest.exists() and sha256(dest) == digest:
            print(f"ok   {name}")
            continue
        print(f"get  {name}")
        fetch(url, dest)
        if sha256(dest) != digest:
            print(f"SHA-256 mismatch for {name}")
            ok = False
    for fam in all_families():
        dest = font_file(fam)
        if dest.exists() and dest.stat().st_size > 1000:
            continue
        print(f"get  {fam}  ({FONT_PATHS[fam]})")
        try:
            fetch(GOOGLE_FONTS + font_url(fam), dest)
        except Exception as e:  # noqa: BLE001
            print(f"FAILED {fam}: {e}")
            ok = False
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
