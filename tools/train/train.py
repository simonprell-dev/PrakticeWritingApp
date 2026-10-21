"""Train GlyphNet on EMNIST byclass + synthetic font glyphs (CPU).

Usage:
  python train.py --quick            # 1 short epoch smoke test
  python train.py --epochs 15        # full run, writes out/glyphnet.pt
"""
import argparse
import math
import time

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

import emnist
from augment import augment
from common import CHARSET, GROUPS, NUM_CLASSES, ROOT
from model import GlyphNet
from render_fonts import synth_bank

SHARP_S = CHARSET.index("ß")


def group_ids() -> torch.Tensor:
    g = torch.arange(NUM_CLASSES)
    for grp in GROUPS:
        ids = [CHARSET.index(c) for c in grp]
        for i in ids:
            g[i] = ids[0]
    return g


def evaluate(model, x_u8: torch.Tensor, y: torch.Tensor, bs: int = 2048):
    model.eval()
    logits = []
    with torch.no_grad():
        for i in range(0, len(x_u8), bs):
            xb = x_u8[i : i + bs].float().unsqueeze(1) / 255.0
            logits.append(model(xb))
    logits = torch.cat(logits)
    gid = group_ids()
    pred = logits.argmax(1)
    top1 = (pred == y).float().mean().item()
    grp = (gid[pred] == gid[y]).float().mean().item()
    return top1, grp, logits


def fit_temperature(logits: torch.Tensor, y: torch.Tensor) -> float:
    t = torch.ones(1, requires_grad=True)
    opt = torch.optim.LBFGS([t], lr=0.05, max_iter=200)

    def closure():
        opt.zero_grad()
        loss = F.cross_entropy(logits / t.clamp_min(0.05), y)
        loss.backward()
        return loss

    opt.step(closure)
    return float(t.clamp_min(0.05).item())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--epochs", type=int, default=15)
    ap.add_argument("--per-class", type=int, default=2500)
    ap.add_argument("--width", type=float, default=1.0)
    ap.add_argument("--batch", type=int, default=256)
    ap.add_argument("--lr", type=float, default=2e-3)
    ap.add_argument("--synth-share", type=float, default=0.15)
    ap.add_argument("--threads", type=int, default=4)
    ap.add_argument("--quick", action="store_true")
    args = ap.parse_args()
    if args.quick:
        args.epochs, args.per_class = 1, 300
    torch.set_num_threads(args.threads)
    torch.manual_seed(0)
    rng = np.random.default_rng(0)

    t0 = time.time()
    xtr, ytr = emnist.load("train")
    xte, yte = emnist.load("test")
    xs, ys = synth_bank()
    print(f"data: train {len(xtr)}  test {len(xte)}  synth {len(xs)}  ({time.time() - t0:.0f}s)")

    xtr_t = torch.from_numpy(xtr)
    xs_t = torch.from_numpy(xs)
    by_class = [np.nonzero(ytr == c)[0] for c in range(NUM_CLASSES)]
    synth_by_class = [np.nonzero(ys == c)[0] for c in range(NUM_CLASSES)]

    # split EMNIST test: first half for temperature, second half for reporting
    perm = rng.permutation(len(xte))
    cal_idx, rep_idx = perm[: len(perm) // 2], perm[len(perm) // 2 :]
    xcal, ycal = torch.from_numpy(xte[cal_idx]), torch.from_numpy(yte[cal_idx])
    xrep, yrep = torch.from_numpy(xte[rep_idx]), torch.from_numpy(yte[rep_idx])
    if args.quick:
        xrep, yrep = xrep[:5000], yrep[:5000]

    model = GlyphNet(NUM_CLASSES, args.width)
    nparams = sum(p.numel() for p in model.parameters())
    print(f"GlyphNet width {args.width}: {nparams} params")

    steps_per_epoch = math.ceil(NUM_CLASSES * args.per_class / args.batch)
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.OneCycleLR(
        opt, max_lr=args.lr, total_steps=steps_per_epoch * args.epochs, pct_start=0.2
    )
    crit = nn.CrossEntropyLoss(label_smoothing=0.1)

    for epoch in range(args.epochs):
        # class-balanced epoch: per class per_class samples, synth_share from fonts (sharp s: fonts only)
        src, idx, lab = [], [], []
        for c in range(NUM_CLASSES):
            n = args.per_class
            n_syn = n if c == SHARP_S else int(round(n * args.synth_share))
            n_em = n - n_syn
            if n_em:
                idx.append(rng.choice(by_class[c], n_em, replace=len(by_class[c]) < n_em))
                src.append(np.zeros(n_em, np.int8))
                lab.append(np.full(n_em, c))
            idx.append(rng.choice(synth_by_class[c], n_syn, replace=True))
            src.append(np.ones(n_syn, np.int8))
            lab.append(np.full(n_syn, c))
        src, idx, lab = np.concatenate(src), np.concatenate(idx), np.concatenate(lab)
        order = rng.permutation(len(lab))
        src, idx, lab = src[order], idx[order], lab[order]

        model.train()
        te = time.time()
        tot, correct, loss_sum = 0, 0, 0.0
        for s in range(steps_per_epoch):
            sl = slice(s * args.batch, (s + 1) * args.batch)
            bsrc, bidx, blab = src[sl], idx[sl], lab[sl]
            if len(blab) == 0:
                break
            xb = torch.empty(len(blab), 28, 28, dtype=torch.uint8)
            em = bsrc == 0
            if em.any():
                xb[torch.from_numpy(np.nonzero(em)[0])] = xtr_t[torch.from_numpy(bidx[em])]
            if (~em).any():
                xb[torch.from_numpy(np.nonzero(~em)[0])] = xs_t[torch.from_numpy(bidx[~em])]
            xb = augment(xb.float().unsqueeze(1) / 255.0)
            yb = torch.from_numpy(blab)
            out = model(xb)
            loss = crit(out, yb)
            opt.zero_grad(set_to_none=True)
            loss.backward()
            opt.step()
            sched.step()
            tot += len(yb)
            correct += (out.argmax(1) == yb).sum().item()
            loss_sum += loss.item() * len(yb)
            if s % 100 == 0:
                print(f"  ep {epoch + 1} step {s}/{steps_per_epoch} loss {loss_sum / tot:.3f} acc {correct / tot:.3f}", flush=True)
        top1, grp, _ = evaluate(model, xrep[:20000], yrep[:20000])
        print(
            f"epoch {epoch + 1}/{args.epochs}  train loss {loss_sum / tot:.3f} acc {correct / tot:.3f}  "
            f"test top1 {top1:.4f} group {grp:.4f}  ({time.time() - te:.0f}s)",
            flush=True,
        )
        torch.save({"state": model.state_dict(), "width": args.width}, ROOT / "out" / "glyphnet.pt")

    _, _, cal_logits = evaluate(model, xcal, ycal)
    temp = fit_temperature(cal_logits, ycal)
    top1, grp, _ = evaluate(model, xrep, yrep)
    print(f"final: test top1 {top1:.4f} group {grp:.4f} temperature {temp:.3f}")
    torch.save({"state": model.state_dict(), "width": args.width, "temperature": temp, "top1": top1, "group": grp},
               ROOT / "out" / "glyphnet.pt")


if __name__ == "__main__":
    main()
