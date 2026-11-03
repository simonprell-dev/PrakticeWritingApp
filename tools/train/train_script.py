"""Train one GlyphNet for one script (CPU). The Latin "druck" model keeps using train.py.

Usage:
  python train_script.py hiragana                 # full run -> out/hiragana/glyphnet.pt
  python train_script.py hiragana --quick         # smoke test
  python train_script.py thai --epochs 10 --threads 10

Test split ("held out"):
- real handwriting: the dataset's own test split (EMNIST test, DHCD Test/, 15 % of CoMNIST by file hash)
- synthetic: whole fonts that are never used for training (Script.test_fonts), each glyph rendered with
  all weight / stroke variants and augmented 3x with a fixed seed. Accuracy on it means "unseen style".
Half of the test set is used to fit the softmax temperature, the other half is reported.
"""
import argparse
import json
import math
import time

import numpy as np
import torch
import torch.nn as nn

import real_data
from augment import augment
from common import ROOT
from model import GlyphNet
from scripts import CYR_LO, CYR_UP, SCRIPTS, Script
from synth_script import bank
from train import fit_temperature


def group_ids(s: Script) -> torch.Tensor:
    g = torch.arange(len(s.classes))
    for grp in s.groups:
        ids = [s.classes.index(c) for c in grp]
        for i in ids:
            g[i] = ids[0]
    return g


def evaluate(model, x_u8: torch.Tensor, y: torch.Tensor, gid: torch.Tensor, bs: int = 2048):
    model.eval()
    logits = []
    with torch.no_grad():
        for i in range(0, len(x_u8), bs):
            logits.append(model(x_u8[i : i + bs].float().unsqueeze(1) / 255.0))
    logits = torch.cat(logits) if logits else torch.zeros(0, len(gid))
    if len(y) == 0:
        return float("nan"), float("nan"), logits
    pred = logits.argmax(1)
    return (pred == y).float().mean().item(), (gid[pred] == gid[y]).float().mean().item(), logits


def real_pools(s: Script, rng):
    """Real data mapped to class indices: (x_tr, by_class list, x_te, y_te)."""
    if not s.real:
        return None, [np.zeros(0, np.int64)] * len(s.classes), np.zeros((0, 28, 28), np.uint8), np.zeros(0, np.int64)
    xtr, ytr, xte, yte = real_data.load(s.real)
    by_class = [np.nonzero(ytr == c)[0] for c in range(len(s.classes))]
    if s.real == "comnist":
        # contributors wrote either case: lower case letters that are a small copy of the capital
        # (same group) share the capital's samples
        grouped = {g[0]: g[1] for g in s.groups}
        for u, lo in zip(CYR_UP, CYR_LO):
            if grouped.get(u) == lo:
                by_class[s.classes.index(lo)] = by_class[s.classes.index(u)]
    if s.real == "emnist" and len(yte) > 30000:
        keep = rng.permutation(len(yte))[:30000]
        xte, yte = xte[keep], yte[keep]
    return xtr, by_class, xte, yte


def synth_test(s: Script, log):
    if not s.test_fonts:
        return np.zeros((0, 28, 28), np.uint8), np.zeros(0, np.int64)
    x, y, _, rep = bank(s, s.test_fonts, log)
    log(f"test fonts: {rep}")
    torch.manual_seed(123)
    xs, ys = [], []
    xt = torch.from_numpy(x).float().unsqueeze(1) / 255.0
    for _ in range(3):
        xa = augment(xt, 1.0)
        xs.append((xa.squeeze(1) * 255).round().byte().numpy())
        ys.append(y)
    return np.concatenate(xs), np.concatenate(ys)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("script", choices=[k for k in SCRIPTS])
    ap.add_argument("--epochs", type=int)
    ap.add_argument("--per-class", type=int)
    ap.add_argument("--width", type=float, default=1.0)
    ap.add_argument("--batch", type=int, default=256)
    ap.add_argument("--lr", type=float, default=2e-3)
    ap.add_argument("--threads", type=int, default=10)
    ap.add_argument("--quick", action="store_true")
    args = ap.parse_args()
    s = SCRIPTS[args.script]
    epochs = args.epochs or s.epochs
    per_class = args.per_class or s.per_class
    if args.quick:
        epochs, per_class = 1, 200
    torch.set_num_threads(args.threads)
    torch.manual_seed(0)
    rng = np.random.default_rng(0)
    out = ROOT / "out" / s.id
    out.mkdir(parents=True, exist_ok=True)
    logf = open(out / "train.log", "a", encoding="utf-8")

    def log(msg):
        print(msg, flush=True)
        logf.write(msg + "\n")
        logf.flush()

    K = len(s.classes)
    t0 = time.time()
    log(f"== {s.id}: {K} classes, epochs {epochs}, per class {per_class}")
    xr, real_by_class, xrt, yrt = real_pools(s, rng)
    xs, ys, _, rep = bank(s, s.synth, log)
    log(f"synth fonts: {rep}")
    xst, yst = synth_test(s, log)
    syn_by_class = [np.nonzero(ys == c)[0] for c in range(K)]
    counts = [len(i) for i in syn_by_class]
    log(f"data: real train {0 if xr is None else len(xr)}  real test {len(xrt)}  synth {len(xs)} "
        f"(per class min {min(counts)} max {max(counts)})  synth test {len(xst)}  ({time.time() - t0:.0f}s)")
    empty = [s.classes[c] for c in range(K) if counts[c] == 0 and len(real_by_class[c]) == 0]
    assert not empty, f"classes without data: {empty}"

    xr_t = torch.from_numpy(xr) if xr is not None else None
    xs_t = torch.from_numpy(xs)
    gid = group_ids(s)

    # test: real + held-out fonts; first half of each for temperature, second half reported
    def halves(x, y):
        p = rng.permutation(len(y))
        a, b = p[: len(p) // 2], p[len(p) // 2 :]
        return (x[a], y[a]), (x[b], y[b])

    (xrc, yrc), (xrr, yrr) = halves(xrt, yrt)
    (xsc, ysc), (xsr, ysr) = halves(xst, yst)
    t = lambda a: torch.from_numpy(np.ascontiguousarray(a))  # noqa: E731
    xcal, ycal = t(np.concatenate([xrc, xsc])), t(np.concatenate([yrc, ysc]))
    rep_sets = {"real": (t(xrr), t(yrr)), "fonts": (t(xsr), t(ysr))}
    if args.quick:
        rep_sets = {k: (v[0][:3000], v[1][:3000]) for k, v in rep_sets.items()}

    model = GlyphNet(K, args.width)
    log(f"GlyphNet width {args.width}: {sum(p.numel() for p in model.parameters())} params")
    steps = math.ceil(K * per_class / args.batch)
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=args.lr, total_steps=steps * epochs, pct_start=0.2)
    crit = nn.CrossEntropyLoss(label_smoothing=0.1)

    def report():
        res = {}
        for name, (x, y) in rep_sets.items():
            if len(y):
                res[name] = evaluate(model, x, y, gid)[:2]
        return res

    for epoch in range(epochs):
        src, idx, lab = [], [], []
        for c in range(K):
            has_real = len(real_by_class[c]) > 0
            n_syn = int(round(per_class * s.synth_share)) if has_real else per_class
            if counts[c] == 0:
                n_syn = 0
            n_real = per_class - n_syn
            if n_real:
                idx.append(rng.choice(real_by_class[c], n_real, replace=len(real_by_class[c]) < n_real))
                src.append(np.zeros(n_real, np.int8))
                lab.append(np.full(n_real, c))
            if n_syn:
                idx.append(rng.choice(syn_by_class[c], n_syn, replace=True))
                src.append(np.ones(n_syn, np.int8))
                lab.append(np.full(n_syn, c))
        src, idx, lab = np.concatenate(src), np.concatenate(idx), np.concatenate(lab)
        order = rng.permutation(len(lab))
        src, idx, lab = src[order], idx[order], lab[order]

        model.train()
        te = time.time()
        tot, correct, loss_sum = 0, 0, 0.0
        for st in range(steps):
            sl = slice(st * args.batch, (st + 1) * args.batch)
            bsrc, bidx, blab = src[sl], idx[sl], lab[sl]
            if len(blab) == 0:
                break
            parts_x, parts_y = [], []
            rm = bsrc == 0
            if rm.any():
                xb = xr_t[torch.from_numpy(bidx[rm])].float().unsqueeze(1) / 255.0
                parts_x.append(augment(xb, 1.0))
                parts_y.append(blab[rm])
            if (~rm).any():
                xb = xs_t[torch.from_numpy(bidx[~rm])].float().unsqueeze(1) / 255.0
                parts_x.append(augment(xb, s.synth_aug))
                parts_y.append(blab[~rm])
            xb = torch.cat(parts_x)
            yb = torch.from_numpy(np.concatenate(parts_y))
            o = model(xb)
            loss = crit(o, yb)
            opt.zero_grad(set_to_none=True)
            loss.backward()
            opt.step()
            sched.step()
            tot += len(yb)
            correct += (o.argmax(1) == yb).sum().item()
            loss_sum += loss.item() * len(yb)
        res = report()
        log(f"epoch {epoch + 1}/{epochs}  train loss {loss_sum / tot:.3f} acc {correct / tot:.3f}  "
            + "  ".join(f"{k} top1 {v[0]:.4f} group {v[1]:.4f}" for k, v in res.items())
            + f"  ({time.time() - te:.0f}s)")
        torch.save({"state": model.state_dict(), "width": args.width, "script": s.id}, out / "glyphnet.pt")

    _, _, cal_logits = evaluate(model, xcal, ycal, gid)
    temp = fit_temperature(cal_logits, ycal)
    res = report()
    allx = torch.cat([v[0] for v in rep_sets.values()])
    ally = torch.cat([v[1] for v in rep_sets.values()])
    top1, grp, _ = evaluate(model, allx, ally, gid)
    acc = {"top1": top1, "group": grp, **{f"{k}_top1": v[0] for k, v in res.items()},
           **{f"{k}_group": v[1] for k, v in res.items()}, "n_real": len(rep_sets["real"][1]),
           "n_fonts": len(rep_sets["fonts"][1])}
    log(f"final: {json.dumps({k: (round(v, 4) if isinstance(v, float) else v) for k, v in acc.items()})} "
        f"temperature {temp:.3f}  total {time.time() - t0:.0f}s")
    # per-class accuracy on the reported test set (for SCRIPTS.md / weak spots)
    _, _, lg = evaluate(model, allx, ally, gid)
    pred = lg.argmax(1)
    per = {}
    for c in range(K):
        m = ally == c
        if m.any():
            per[s.classes[c]] = round((pred[m] == c).float().mean().item(), 3)
    worst = sorted(per.items(), key=lambda kv: kv[1])[:8]
    log(f"weakest classes: {worst}")
    torch.save({"state": model.state_dict(), "width": args.width, "script": s.id, "temperature": temp,
                "accuracy": acc, "per_class": per}, out / "glyphnet.pt")


if __name__ == "__main__":
    main()
