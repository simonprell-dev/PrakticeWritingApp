"""Imports the app's "Schriftproben" packages (children's handwriting) into data/krakel/.

Package (ZIP from the admin page of the server):
  LIESMICH.txt
  samples.csv               UTF-8, header row: id,batch,seq,scan,created_at,label,label_source,recognized,
                            target,score,tier,mirrored,rejected,dots,box_x,box_y,box_w,box_h,script,style,
                            mode,lang,file
  images/<batch>/<seq>.png  RGBA, the glyph cut out of the paper; the ink strength is the ALPHA channel
                            (colour = pen colour), longest side <= 128 px, dots on top included

`label` is the best known character, `label_source` how sure it is: wort (a whole word of the Woerter-Zoo
was written correctly, every letter confirmed) > uebung (practice target and the recogniser agreed) >
erkannt (only the recogniser's guess, may be wrong).

Layout after the import (data/ is gitignored):
  data/krakel/index.csv                          every row ever imported (deduplicated by id), plus
                                                 `path` (where the import put the PNG) and `review` (empty)
  data/krakel/uebersicht.html                    review page, open it in the browser
  data/krakel/LIESMICH.txt                       the review guide below
  data/krakel/<script>/<labelfolder>/<batch>-<seq>.png
Label folders work on Windows' case-insensitive file system: A_gross, a_klein, Ae_gross (Ä), ae_klein (ä),
sz (ß), digits as they are, other scripts' letters as themselves (+ _gross / _klein if they have case),
anything else as code points (U0915). label_folder() / folder_label() map both ways.

Review, without an extra tool: in the Windows Explorer move a wrong PNG into the right label folder, or
into a folder `_falsch` next to the label folders (or delete it). The training loader
(real_data.load_krakel) takes the label from the FOLDER, not from the csv; folders starting with "_" are
skipped, and a PNG that is not where the import put it counts as reviewed (always used, whatever its
label_source). Re-importing a package never brings a sample back: rows are deduplicated by id.

Usage:
  python import_samples.py schriftproben-1.zip [schriftproben-2.zip ...]
  python import_samples.py        # no package: only rebuild the summary and uebersicht.html
"""
import argparse
import csv
import html
import io
import re
import sys
import zipfile
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import quote

from PIL import Image

from common import DATA

KRAKEL = DATA / "krakel"
INDEX = KRAKEL / "index.csv"
COLUMNS = ["id", "batch", "seq", "scan", "created_at", "label", "label_source", "recognized", "target", "score",
           "tier", "mirrored", "rejected", "dots", "box_x", "box_y", "box_w", "box_h", "script", "style", "mode",
           "lang", "file"]
SOURCES = ("wort", "uebung", "erkannt")

SPECIAL = {"Ä": "Ae_gross", "Ö": "Oe_gross", "Ü": "Ue_gross", "ä": "ae_klein", "ö": "oe_klein", "ü": "ue_klein",
           "ß": "sz"}
SPECIAL_BACK = {v: k for k, v in SPECIAL.items()}
NO_LABEL = "_ohne_label"
UNSAFE = set('<>:"/\\|?*. ')

GUIDE = """\
Schriftproben durchsehen (data/krakel/)
=======================================
Jede Probe liegt als PNG in  <schrift>/<buchstabenordner>/<stapel>-<nr>.png
(A_gross = A, a_klein = a, Ae_gross = Ä, ae_klein = ä, sz = ß, Ziffern wie sie sind).
uebersicht.html zeigt alle Proben: Rahmen gruen = wort (sicher), blau = uebung, grau = erkannt
(nur geraten), gestrichelt = von Hand verschoben, rot markiert = Spiegelschrift.

Falsche Proben im Windows-Explorer korrigieren:
  - falscher Buchstabe  -> PNG in den richtigen Buchstabenordner verschieben
  - unbrauchbar         -> PNG in einen Ordner _falsch (neben den Buchstabenordnern) verschieben
                           oder loeschen
Das Training nimmt den Buchstaben aus dem ORDNER, nicht aus index.csv. Ordner, die mit _ beginnen,
werden nie benutzt. Eine verschobene Probe gilt als geprueft und wird immer benutzt; sonst nur
"wort" und "uebung" ohne Spiegelschrift. Ein erneuter Import holt geloeschte oder verschobene
Proben nicht zurueck. Danach "python import_samples.py" (ohne ZIP) erneuert die Uebersicht.
"""


def label_folder(label: str) -> str:
    """Folder name for a label that is unique on a case-insensitive file system."""
    if label in SPECIAL:
        return SPECIAL[label]
    if not label:
        return NO_LABEL
    if len(label) == 1 and label.isprintable() and label not in UNSAFE:
        lo, up = label.lower(), label.upper()
        if lo == up:
            return label
        # only letters whose case round-trips (Greek final sigma would collide with sigma on NTFS, the
        # Kelvin sign with K)
        if label == up and len(lo) == 1 and lo.upper() == label:
            return label + "_gross"
        if label == lo and len(up) == 1 and up.lower() == label:
            return label + "_klein"
    return "U" + "_".join(f"{ord(c):04X}" for c in label)


def folder_label(name: str) -> str | None:
    """Label of a folder name (inverse of label_folder), None for "_..." folders and unknown names."""
    if name.startswith("_"):
        return None
    if name in SPECIAL_BACK:
        return SPECIAL_BACK[name]
    if name.endswith(("_gross", "_klein")) and len(name) == 7:
        return name[0]
    if re.fullmatch(r"U[0-9A-F]{4,6}(_[0-9A-F]{4,6})*", name):
        return "".join(chr(int(h, 16)) for h in name[1:].split("_"))
    if len(name) == 1:
        return name
    return None


def _safe(s: str, fallback: str) -> str:
    s = re.sub(r"[^0-9A-Za-z_-]", "_", s.strip())
    return s or fallback


def _natural(v: str):
    return (0, int(v), "") if v.strip().isdigit() else (1, 0, v)


def read_index() -> list[dict]:
    if not INDEX.exists():
        return []
    with INDEX.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def write_index(rows: list[dict]):
    extra = sorted({k for r in rows for k in r} - set(COLUMNS) - {"path", "review"})
    tmp = INDEX.with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8-sig", newline="") as f:  # BOM: Excel shows the umlauts right
        w = csv.DictWriter(f, COLUMNS + extra + ["path", "review"], extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)
    tmp.replace(INDEX)


def scan() -> list[tuple[str, str, Path]]:
    """Every PNG below data/krakel/<script>/<folder>/ as (script, folder, path), sorted."""
    out = []
    if not KRAKEL.exists():
        return out
    for sdir in sorted(p for p in KRAKEL.iterdir() if p.is_dir()):
        for fdir in sorted(p for p in sdir.iterdir() if p.is_dir()):
            for f in sorted(fdir.glob("*.png")):
                out.append((sdir.name, fdir.name, f))
    return out


def rel(p: Path) -> str:
    return p.relative_to(KRAKEL).as_posix()


def import_zip(zpath: Path, rows: list[dict], known: set[str], names: set[str]) -> tuple[int, int, int]:
    """Adds the new samples of one package to rows / data/krakel. Returns (rows in package, new, errors)."""
    z = zipfile.ZipFile(zpath)
    csvs = sorted((n for n in z.namelist() if n.endswith("samples.csv")), key=len)
    if not csvs:
        print(f"{zpath.name}: no samples.csv - not a Schriftproben package?")
        return 0, 0, 1
    base = csvs[0][: -len("samples.csv")]
    members = set(z.namelist())
    with z.open(csvs[0]) as f:
        reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig", newline=""))
        missing = [c for c in ("id", "batch", "seq", "label", "label_source", "script") if c not in (reader.fieldnames or [])]
        if missing:
            print(f"{zpath.name}: samples.csv lacks the columns {missing}")
            return 0, 0, 1
        pkg = list(reader)
    new = err = 0
    for r in pkg:
        sid = (r.get("id") or "").strip()
        if not sid:
            err += 1
            continue
        if sid in known:
            continue
        batch, seq = r.get("batch", ""), r.get("seq", "")
        member = base + (r.get("file") or f"images/{batch}/{seq}.png").lstrip("/")
        if member not in members:
            print(f"  {zpath.name}: id {sid}: image {member} missing")
            err += 1
            continue
        data = z.read(member)
        try:
            Image.open(io.BytesIO(data)).verify()
        except Exception as e:  # noqa: BLE001 - any broken image is just skipped
            print(f"  {zpath.name}: id {sid}: broken image ({e})")
            err += 1
            continue
        script = _safe(r.get("script", ""), "_ohne_schrift").lower()
        name = f"{_safe(batch, 'x')}-{_safe(seq, 'x')}"
        if name + ".png" in names:  # same lesson / position from another id: keep both
            name += f"-{_safe(sid, 'x')}"
        dst = KRAKEL / script / label_folder(r.get("label", "")) / f"{name}.png"
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_bytes(data)  # the PNG as it came, no re-encoding
        r = {k: (v if v is not None else "") for k, v in r.items() if k is not None}
        r["path"], r["review"] = rel(dst), ""
        rows.append(r)
        known.add(sid)
        names.add(dst.name)
        new += 1
    return len(pkg), new, err


def summary(index: dict[str, dict]):
    """Counts per script from the folders as they are now (after any review), label_source from the index."""
    per = defaultdict(lambda: {"src": Counter(), "label": Counter(), "skip": Counter()})
    for script, folder, f in scan():
        row = index.get(f.name)
        lab = folder_label(folder)
        d = per[script]
        if lab is None:
            d["skip"][folder] += 1
            continue
        moved = row is None or row.get("path") != rel(f)
        d["src"]["von Hand" if moved else row.get("label_source") or "?"] += 1
        d["label"][lab] += 1
    for script, d in sorted(per.items()):
        n = sum(d["label"].values())
        print(f"\n{script}: {n} samples  (" + ", ".join(f"{k} {v}" for k, v in d["src"].most_common()) + ")")
        labs = sorted(d["label"].items())
        for i in range(0, len(labs), 12):
            print("   " + "  ".join(f"{k} {v:>3}" for k, v in labs[i : i + 12]))
        if d["skip"]:
            print("   not used: " + ", ".join(f"{k} {v}" for k, v in sorted(d["skip"].items())))


def overview(index: dict[str, dict]) -> Path:
    """Writes data/krakel/uebersicht.html: per script and label a row of thumbnails (relative paths)."""
    groups = defaultdict(list)
    for script, folder, f in scan():
        groups[(script, folder)].append(f)
    css = """
body{font:14px system-ui,sans-serif;background:#f3f3f0;color:#222;margin:16px}
h1{font-size:20px} h2{margin:28px 0 6px;border-bottom:1px solid #ccc} h3{font-size:15px;margin:12px 0 4px}
h3 small{font-weight:normal;color:#666} pre{background:#fff;padding:8px 12px;border:1px solid #ddd;white-space:pre-wrap}
.row{display:flex;flex-wrap:wrap;gap:4px}
.row img{width:56px;height:56px;object-fit:contain;background:#fff;border:3px solid #999;border-radius:5px;padding:2px}
img.wort{border-color:#2e9d4a} img.uebung{border-color:#2f6fd6} img.erkannt{border-color:#b5b5b5}
img.hand{border-style:dashed;border-color:#333} img.gesp{box-shadow:0 0 0 2px #e03030}
#ink:checked ~ main .row img{filter:brightness(0)}
.legend span{display:inline-block;padding:1px 8px;margin-right:6px;border:3px solid;border-radius:5px;background:#fff}
"""
    out = ['<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Schriftproben</title>',
           f"<style>{css}</style></head><body><h1>Schriftproben (data/krakel)</h1>",
           '<p class="legend"><span style="border-color:#2e9d4a">wort</span><span style="border-color:#2f6fd6">'
           'uebung</span><span style="border-color:#b5b5b5">erkannt</span><span style="border:3px dashed #333">'
           'von Hand verschoben</span><span style="box-shadow:0 0 0 2px #e03030">Spiegelschrift</span></p>',
           f"<details><summary>So wird durchgesehen</summary><pre>{html.escape(GUIDE)}</pre></details>",
           '<input type="checkbox" id="ink"> <label for="ink">als Tinte zeigen (schwarz, so sieht es das Netz)</label>',
           "<main>"]
    last = None
    keyed = sorted(groups.items(), key=lambda kv: (kv[0][0], kv[0][1].startswith("_"), folder_label(kv[0][1]) or kv[0][1]))
    for (script, folder), files in keyed:
        if script != last:
            n = sum(len(v) for (s, _), v in groups.items() if s == script)
            out.append(f"<h2>{html.escape(script)} <small>({n})</small></h2>")
            last = script
        lab = folder_label(folder)
        rows = [(f, index.get(f.name)) for f in files]
        rows.sort(key=lambda fr: (_natural(fr[1]["batch"]), _natural(fr[1]["seq"])) if fr[1] else ((2, 0, ""), (2, 0, fr[0].name)))
        src = Counter("von Hand" if r is None or r.get("path") != rel(f) else r.get("label_source") or "?" for f, r in rows)
        head = html.escape(lab) if lab is not None else "nicht benutzt"
        out.append(f"<h3>{head} <small>{html.escape(script)}/{html.escape(folder)} · {len(files)} · "
                   + " · ".join(f"{k} {v}" for k, v in src.most_common()) + "</small></h3><div class=row>")
        for f, r in rows:
            cls = []
            if r is None or r.get("path") != rel(f):
                cls.append("hand")
            if r is not None:
                cls.append(r.get("label_source", ""))
                if r.get("mirrored") == "1" or r.get("rejected") == "1":
                    cls.append("gesp")
                tip = (f"{r.get('label')} · {r.get('label_source')} · erkannt {r.get('recognized') or '-'} · "
                       f"Ziel {r.get('target') or '-'} · score {r.get('score') or '-'} · Stapel {r.get('batch')} "
                       f"Nr {r.get('seq')} · {r.get('mode') or ''}"
                       + (" · gespiegelt" if r.get("mirrored") == "1" else "")
                       + (" · abgelehnt" if r.get("rejected") == "1" else "")
                       + (f" · Punkte {r.get('dots')}" if r.get("dots") not in ("", "0", None) else ""))
            else:
                tip = f"{f.name} (nicht im Index)"
            src_attr = quote(rel(f))
            out.append(f'<img loading="lazy" class="{" ".join(cls)}" src="{src_attr}" title="{html.escape(tip)}">')
        out.append("</div>")
    if not groups:
        out.append("<p>Noch keine Proben importiert.</p>")
    out.append("</main></body></html>")
    page = KRAKEL / "uebersicht.html"
    page.write_text("\n".join(out), encoding="utf-8")
    return page


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("zips", nargs="*", type=Path, help="Schriftproben packages (.zip)")
    args = ap.parse_args()
    # labels of other scripts must not crash a redirected (cp1252) stdout
    sys.stdout.reconfigure(errors="backslashreplace")
    KRAKEL.mkdir(parents=True, exist_ok=True)
    rows = read_index()
    known = {r["id"] for r in rows}
    names = {Path(r["path"]).name for r in rows if r.get("path")} | {f.name for _, _, f in scan()}
    total = new = err = 0
    for zp in args.zips:
        if not zp.exists():
            print(f"{zp}: not found")
            err += 1
            continue
        t, n, e = import_zip(zp, rows, known, names)
        print(f"{zp.name}: {t} rows, {n} new, {t - n - e} already known, {e} errors")
        total, new, err = total + t, new + n, err + e
    if new:
        write_index(rows)
    index = {Path(r["path"]).name: r for r in rows if r.get("path")}
    summary(index)
    page = overview(index)
    (KRAKEL / "LIESMICH.txt").write_text(GUIDE, encoding="utf-8")
    print(f"\nnew rows: {new} (of {total} in {len(args.zips)} package(s)), index: {len(rows)} rows, errors: {err}")
    print(f"overview: {page}\n")
    print(GUIDE)
    return 1 if err else 0


if __name__ == "__main__":
    sys.exit(main())
