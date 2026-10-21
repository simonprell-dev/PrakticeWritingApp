"""Exports out/glyphnet.pt to public/model/glyphnet-v1.{json,bin} (BatchNorm folded, float16).

Also writes test/fixtures/cnn_vectors.json: inputs + logits computed in numpy from the f16-rounded
folded weights, so the TypeScript inference must reproduce them (|delta| < 1e-3).
"""
import json

import numpy as np
import torch

import emnist
from common import CHARSET, CNN_FIT, CNN_SIZE, NUM_CLASSES, OUT_FIXTURES, OUT_MODEL, ROOT
from model import GlyphNet

STROKE_PX = 2.3


def fold(conv: torch.nn.Conv2d, bn: torch.nn.BatchNorm2d):
    w = conv.weight.detach().double()
    s = bn.weight.detach().double() / torch.sqrt(bn.running_var.double() + bn.eps)
    w2 = w * s.view(-1, 1, 1, 1)
    b2 = bn.bias.detach().double() - bn.running_mean.double() * s
    return w2.float().numpy(), b2.float().numpy()


def main():
    ck = torch.load(ROOT / "out" / "glyphnet.pt", map_location="cpu")
    model = GlyphNet(NUM_CLASSES, ck["width"])
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
            bn = mods[i + 1]
            w, b = fold(m, bn)
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
    w = lin.weight.detach().numpy()
    b = lin.bias.detach().numpy()
    wo, bo = add(w), add(b)
    layers.append({"type": "dense", "in": lin.in_features, "out": lin.out_features, "w": wo, "b": bo})
    plain.append(("dense", w.astype(np.float16).astype(np.float32), b.astype(np.float16).astype(np.float32)))

    blob = np.concatenate(chunks).astype("<f2").tobytes()
    meta = {
        "version": "v1",
        "input": [CNN_SIZE, CNN_SIZE],
        "classes": CHARSET,
        "dtype": "f16",
        "temperature": round(float(ck.get("temperature", 1.0)), 4),
        "preprocess": {"size": CNN_SIZE, "fit": CNN_FIT, "strokePx": STROKE_PX, "blur": 0.6},
        "layers": layers,
        "accuracy": {"top1": round(float(ck.get("top1", 0)), 4), "group": round(float(ck.get("group", 0)), 4)},
    }
    OUT_MODEL.mkdir(parents=True, exist_ok=True)
    (OUT_MODEL / "glyphnet-v1.bin").write_bytes(blob)
    (OUT_MODEL / "glyphnet-v1.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"wrote glyphnet-v1.bin ({len(blob)} bytes), {len(layers)} layers")

    # reference implementation with the f16-rounded weights
    def forward(x: np.ndarray) -> np.ndarray:
        h = x.reshape(1, CNN_SIZE, CNN_SIZE).astype(np.float32)
        for spec in plain:
            if spec[0] == "conv":
                _, wt, bs, relu = spec
                c, H, W = h.shape
                p = np.pad(h, ((0, 0), (1, 1), (1, 1)))
                out = np.zeros((wt.shape[0], H, W), np.float32)
                for ky in range(3):
                    for kx in range(3):
                        out += np.einsum("oc,chw->ohw", wt[:, :, ky, kx], p[:, ky : ky + H, kx : kx + W])
                out += bs.reshape(-1, 1, 1)
                h = np.maximum(out, 0) if relu else out
            elif spec[0] == "pool":
                c, H, W = h.shape
                h = h[:, : H // 2 * 2, : W // 2 * 2].reshape(c, H // 2, 2, W // 2, 2).max(axis=(2, 4))
            else:
                _, wt, bs = spec
                h = wt @ h.reshape(-1) + bs
        return h

    xte, yte = emnist.load("test")
    rng = np.random.default_rng(7)
    idx = rng.choice(len(xte), 8, replace=False)
    vectors = []
    agree = 0
    for k in idx:
        x = xte[k].astype(np.float32) / 255.0
        logits = forward(x)
        with torch.no_grad():
            ref = model(torch.from_numpy(x).view(1, 1, 28, 28)).numpy()[0]
        agree += int(np.argmax(ref) == np.argmax(logits))
        vectors.append({"label": CHARSET[int(yte[k])], "input": xte[k].flatten().tolist(), "logits": [round(float(v), 5) for v in logits]})
    OUT_FIXTURES.mkdir(parents=True, exist_ok=True)
    (OUT_FIXTURES / "cnn_vectors.json").write_text(json.dumps(vectors, ensure_ascii=False), encoding="utf-8")
    print(f"test vectors written, f16 argmax agreement with torch: {agree}/8")


if __name__ == "__main__":
    main()
