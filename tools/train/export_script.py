"""Exports out/<id>/glyphnet.pt to public/model/<id>/glyphnet-v1.{json,bin} (BatchNorm folded, float16).

Same binary layout and layer list as export.py (druck); the JSON differs only in:
  "script": "<id>", "classes": [..strings..], "groups": [..strings..], richer "accuracy".
Reference vectors (inputs + logits from the f16-rounded weights, numpy) go to out/<id>/cnn_vectors.json
(not into test/fixtures, which belongs to the druck model).

Usage: python export_script.py hiragana [more ids ...]
"""
import json
import sys

import numpy as np
import torch

from common import CNN_FIT, CNN_SIZE, OUT_MODEL, ROOT
from export import STROKE_PX, fold
from model import GlyphNet
from scripts import SCRIPTS
from synth_script import HR, font_instances, render, to_input


def export(sid: str) -> None:
    s = SCRIPTS[sid]
    ck = torch.load(ROOT / "out" / sid / "glyphnet.pt", map_location="cpu")
    assert ck.get("script") == sid, ck.get("script")
    model = GlyphNet(len(s.classes), ck["width"])
    model.load_state_dict(ck["state"])
    model.eval()

    layers, chunks, plain = [], [], []
    offset = 0

    def add(arr: np.ndarray) -> int:
        nonlocal offset
        a16 = arr.astype(np.float16).flatten()
        chunks.append(a16)
        start = offset
        offset += a16.size
        return start

    mods = list(model.features)
    i = 0
    while i < len(mods):
        m = mods[i]
        if isinstance(m, torch.nn.Conv2d):
            w, b = fold(m, mods[i + 1])
            relu = i + 2 < len(mods) and isinstance(mods[i + 2], torch.nn.ReLU)
            wo, bo = add(w), add(b)
            layers.append({"type": "conv", "in": m.in_channels, "out": m.out_channels, "k": 3, "relu": relu, "w": wo, "b": bo})
            plain.append(("conv", w.astype(np.float16).astype(np.float32), b.astype(np.float16).astype(np.float32), relu))
            i += 3 if relu else 2
        elif isinstance(m, torch.nn.MaxPool2d):
            layers.append({"type": "maxpool", "k": 2})
            plain.append(("pool",))
            i += 1
        else:
            i += 1
    lin = model.head[2]
    w, b = lin.weight.detach().numpy(), lin.bias.detach().numpy()
    wo, bo = add(w), add(b)
    layers.append({"type": "dense", "in": lin.in_features, "out": lin.out_features, "w": wo, "b": bo})
    plain.append(("dense", w.astype(np.float16).astype(np.float32), b.astype(np.float16).astype(np.float32)))

    blob = np.concatenate(chunks).astype("<f2").tobytes()
    acc = {k: (round(float(v), 4) if isinstance(v, float) else v) for k, v in ck.get("accuracy", {}).items()}
    meta = {
        "version": "v1",
        "script": sid,
        "input": [CNN_SIZE, CNN_SIZE],
        "classes": s.classes,
        "groups": s.groups,
        "dtype": "f16",
        "temperature": round(float(ck.get("temperature", 1.0)), 4),
        "preprocess": {"size": CNN_SIZE, "fit": CNN_FIT, "strokePx": STROKE_PX, "blur": 0.6},
        "layers": layers,
        "accuracy": acc,
    }
    out = OUT_MODEL / sid
    out.mkdir(parents=True, exist_ok=True)
    (out / "glyphnet-v1.bin").write_bytes(blob)
    (out / "glyphnet-v1.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{sid}: wrote glyphnet-v1.bin ({len(blob)} bytes), {len(layers)} layers, {len(s.classes)} classes")

    def forward(x: np.ndarray) -> np.ndarray:
        h = x.reshape(1, CNN_SIZE, CNN_SIZE).astype(np.float32)
        for spec in plain:
            if spec[0] == "conv":
                _, wt, bs, relu = spec
                _, H, W = h.shape
                p = np.pad(h, ((0, 0), (1, 1), (1, 1)))
                o = np.zeros((wt.shape[0], H, W), np.float32)
                for ky in range(3):
                    for kx in range(3):
                        o += np.einsum("oc,chw->ohw", wt[:, :, ky, kx], p[:, ky : ky + H, kx : kx + W])
                o += bs.reshape(-1, 1, 1)
                h = np.maximum(o, 0) if relu else o
            elif spec[0] == "pool":
                c, H, W = h.shape
                h = h[:, : H // 2 * 2, : W // 2 * 2].reshape(c, H // 2, 2, W // 2, 2).max(axis=(2, 4))
            else:
                _, wt, bs = spec
                h = wt @ h.reshape(-1) + bs
        return h

    # reference vectors: template-font glyphs of 8 classes
    _, font = font_instances(s.templates[0][0], HR, (400,))[0]
    rng = np.random.default_rng(7)
    vectors, agree, right = [], 0, 0
    for k in rng.choice(len(s.classes), min(8, len(s.classes)), replace=False):
        ch = s.classes[int(k)]
        x8 = to_input(render(font, ch))
        x = x8.astype(np.float32) / 255.0
        logits = forward(x)
        with torch.no_grad():
            ref = model(torch.from_numpy(x).view(1, 1, 28, 28)).numpy()[0]
        agree += int(np.argmax(ref) == np.argmax(logits))
        right += int(np.argmax(logits) == k)
        vectors.append({"label": ch, "input": x8.flatten().tolist(), "logits": [round(float(v), 5) for v in logits]})
    (ROOT / "out" / sid / "cnn_vectors.json").write_text(json.dumps(vectors, ensure_ascii=False), encoding="utf-8")
    print(f"{sid}: f16 argmax agreement with torch {agree}/{len(vectors)}, template glyphs correct {right}/{len(vectors)}")


if __name__ == "__main__":
    for sid in sys.argv[1:]:
        export(sid)
