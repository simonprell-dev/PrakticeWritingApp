"""Batch augmentation on [B,1,28,28] float tensors (ink=1), all on the main process."""
import math

import torch
import torch.nn.functional as F


def _gauss_kernel(sigma: float, device) -> torch.Tensor:
    r = max(1, int(math.ceil(2.5 * sigma)))
    x = torch.arange(-r, r + 1, device=device, dtype=torch.float32)
    k = torch.exp(-(x**2) / (2 * sigma**2))
    return k / k.sum()


def _blur(x: torch.Tensor, sigma: float) -> torch.Tensor:
    k = _gauss_kernel(sigma, x.device)
    c = x.shape[1]
    kx = k.view(1, 1, 1, -1).repeat(c, 1, 1, 1)
    ky = k.view(1, 1, -1, 1).repeat(c, 1, 1, 1)
    p = k.numel() // 2
    x = F.conv2d(F.pad(x, (p, p, 0, 0), mode="replicate"), kx, groups=c)
    return F.conv2d(F.pad(x, (0, 0, p, p), mode="replicate"), ky, groups=c)


def augment(x: torch.Tensor, strength: float = 1.0) -> torch.Tensor:
    b = x.shape[0]
    dev = x.device
    s = strength

    # random affine: rotation, shear, anisotropic scale, shift
    ang = (torch.rand(b, device=dev) * 2 - 1) * math.radians(12) * s
    shear = (torch.rand(b, device=dev) * 2 - 1) * 0.3 * s
    sc = 1 + (torch.rand(b, device=dev) * 0.25 - 0.15) * s
    asp = torch.exp((torch.rand(b, device=dev) * 2 - 1) * 0.18 * s)
    sx, sy = sc * asp.sqrt(), sc / asp.sqrt()
    tx = (torch.rand(b, device=dev) * 2 - 1) * (2 / 14) * s
    ty = (torch.rand(b, device=dev) * 2 - 1) * (2 / 14) * s
    cos, sin = torch.cos(ang), torch.sin(ang)
    # inverse mapping output->input, so divide by scale
    a11 = cos / sx
    a12 = (-sin + shear * cos) / sx
    a21 = sin / sy
    a22 = (cos + shear * sin) / sy
    theta = torch.stack([torch.stack([a11, a12, tx], 1), torch.stack([a21, a22, ty], 1)], 1)
    grid = F.affine_grid(theta, x.shape, align_corners=False)

    # elastic displacement (smooth random field)
    alpha = (1.5 + torch.rand(b, 1, 1, 1, device=dev) * 1.5) * s / 14.0
    field = torch.rand(b, 2, 28, 28, device=dev) * 2 - 1
    field = _blur(field, 4.0)
    field = field / (field.abs().amax(dim=(1, 2, 3), keepdim=True) + 1e-6) * alpha
    grid = grid + field.permute(0, 2, 3, 1)
    x = F.grid_sample(x, grid, mode="bilinear", padding_mode="zeros", align_corners=False)

    # stroke thickness: dilate 30%, erode 20% (soft morphology)
    r = torch.rand(b, device=dev)
    dil = F.max_pool2d(x, 3, 1, 1)
    ero = -F.max_pool2d(-x, 3, 1, 1)
    x = torch.where((r < 0.3).view(b, 1, 1, 1), 0.5 * x + 0.5 * dil, x)
    x = torch.where((r > 0.8).view(b, 1, 1, 1), 0.5 * x + 0.5 * ero, x)

    # residual ruled-line fragment (15%)
    m = torch.rand(b, device=dev) < 0.15 * s
    if m.any():
        rows = torch.randint(3, 25, (b,), device=dev)
        line = torch.zeros_like(x)
        idx = torch.nonzero(m).flatten()
        x0 = torch.randint(0, 10, (len(idx),), device=dev)
        x1 = torch.randint(18, 28, (len(idx),), device=dev)
        for k, i in enumerate(idx.tolist()):
            line[i, 0, rows[i], x0[k] : x1[k]] = 0.35 + 0.3 * torch.rand(1, device=dev).item()
        x = torch.maximum(x, line)

    # small gaps (pencil, 10%)
    m = (torch.rand(b, 1, 1, 1, device=dev) < 0.1 * s).float()
    holes = (F.max_pool2d((torch.rand(b, 1, 28, 28, device=dev) < 0.012).float(), 3, 1, 1) > 0).float()
    x = x * (1 - m * holes)

    # blur / contrast jitter
    x = torch.where((torch.rand(b, device=dev) < 0.3).view(b, 1, 1, 1), _blur(x, 0.7), x)
    gain = 0.7 + torch.rand(b, 1, 1, 1, device=dev) * 0.5
    x = (x * gain).clamp(0, 1)
    mx = x.amax(dim=(1, 2, 3), keepdim=True).clamp_min(1e-3)
    return x / mx
