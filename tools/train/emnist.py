"""EMNIST IDX loader (byclass). Images are stored transposed in the IDX files, we fix that here."""
import gzip
import struct

import numpy as np

from common import DATA


def _read_idx(path):
    with gzip.open(path, "rb") as f:
        data = f.read()
    magic = struct.unpack(">I", data[:4])[0]
    ndim = magic & 0xFF
    dims = struct.unpack(">" + "I" * ndim, data[4 : 4 + 4 * ndim])
    arr = np.frombuffer(data, dtype=np.uint8, offset=4 + 4 * ndim)
    return arr.reshape(dims)


def load(split: str):
    """Returns (images uint8 [N,28,28] upright, ink=255; labels int64 [N])."""
    x = _read_idx(DATA / f"emnist-byclass-{split}-images-idx3-ubyte.gz")
    y = _read_idx(DATA / f"emnist-byclass-{split}-labels-idx1-ubyte.gz")
    x = np.ascontiguousarray(x.transpose(0, 2, 1))
    return x, y.astype(np.int64)
