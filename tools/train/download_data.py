"""Download EMNIST byclass (Hugging Face mirror, SHA-256 pinned) and the OFL fonts.

Usage: python tools/train/download_data.py
"""
import hashlib
import sys
import urllib.request
from pathlib import Path

from common import DATA, FONTS, FONT_LIST, GOOGLE_FONTS

HF = "https://huggingface.co/datasets/Heliosoph/EMNIST/resolve/main/"
NIST_ZIP = "https://biometrics.nist.gov/cs_links/EMNIST/gzip.zip"  # fallback, ~535 MB

EMNIST_FILES = {
    "emnist-byclass-train-images-idx3-ubyte.gz": "9e21987f03a6eb8b870187e785883ddad96947299587908f1a7ec2ca0f4be5f0",
    "emnist-byclass-train-labels-idx1-ubyte.gz": "f7ef403d48dc18a89dae0d83d11ee69cecb6e1c12c3a961d03712e495c02a8fa",
    "emnist-byclass-test-images-idx3-ubyte.gz": "5ec835bd5d5b1a66378a132e727fef20fe994b3cc666899befcca5ac766f50cd",
    "emnist-byclass-test-labels-idx1-ubyte.gz": "501e305eeeacb093b162592d80e8a2632040872360fa6d85cfcb2200d91ca92a",
}


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def fetch(url: str, dest: Path) -> None:
    tmp = dest.with_suffix(dest.suffix + ".part")
    req = urllib.request.Request(url, headers={"User-Agent": "krakel-und-krone-train"})
    with urllib.request.urlopen(req, timeout=60) as r, open(tmp, "wb") as f:
        total = int(r.headers.get("Content-Length") or 0)
        done = 0
        while True:
            chunk = r.read(1 << 20)
            if not chunk:
                break
            f.write(chunk)
            done += len(chunk)
            if total:
                print(f"\r  {dest.name}: {done * 100 // total:3d}%", end="", flush=True)
    print()
    tmp.replace(dest)


def main() -> int:
    DATA.mkdir(parents=True, exist_ok=True)
    FONTS.mkdir(parents=True, exist_ok=True)
    ok = True
    for name, digest in EMNIST_FILES.items():
        dest = DATA / name
        if dest.exists() and sha256(dest) == digest:
            print(f"ok   {name}")
            continue
        print(f"get  {name}")
        fetch(HF + name, dest)
        if sha256(dest) != digest:
            print(f"SHA-256 mismatch for {name}. Fallback: download {NIST_ZIP} and unpack the gzip/ folder into {DATA}")
            ok = False
    for fname, path, _role in FONT_LIST:
        dest = FONTS / fname
        if dest.exists() and dest.stat().st_size > 1000:
            print(f"ok   {fname}")
            continue
        print(f"get  {fname}")
        fetch(GOOGLE_FONTS + path, dest)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
