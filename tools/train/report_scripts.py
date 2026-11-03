"""Prints the accuracy / size table of SCRIPTS.md from out/<id>/glyphnet.pt and public/model/<id>/.

Usage: python report_scripts.py
"""
import torch

from common import OUT_MODEL, ROOT
from scripts import SCRIPTS


def pct(v):
    return "–" if v is None or v != v else f"{100 * v:.1f} %"


def main():
    print("| id | classes | data | test top1 | test group | real top1 / group | held-out fonts top1 / group "
          "| weakest classes | model .bin | templates .bin |")
    print("|---|---|---|---|---|---|---|---|---|---|")
    for sid, s in SCRIPTS.items():
        f = ROOT / "out" / sid / "glyphnet.pt"
        if not f.exists():
            print(f"| {sid} | {len(s.classes)} | not trained |")
            continue
        ck = torch.load(f, map_location="cpu")
        a = ck.get("accuracy", {})
        per = ck.get("per_class", {})
        weak = ", ".join(f"{c} {100 * v:.0f}" for c, v in sorted(per.items(), key=lambda kv: kv[1])[:4])
        data = f"{s.real} + fonts" if s.real else "fonts only"
        mb = OUT_MODEL / sid / "glyphnet-v1.bin"
        tb = OUT_MODEL / sid / "templates-v1.bin"
        size = lambda p: f"{p.stat().st_size / 1024:.0f} KB" if p.exists() else "–"  # noqa: E731
        print(f"| {sid} | {len(s.classes)} | {data} | {pct(a.get('top1'))} | {pct(a.get('group'))} "
              f"| {pct(a.get('real_top1'))} / {pct(a.get('real_group'))} "
              f"| {pct(a.get('fonts_top1'))} / {pct(a.get('fonts_group'))} | {weak} | {size(mb)} | {size(tb)} |")


if __name__ == "__main__":
    main()
