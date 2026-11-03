"""Builds src/ui/worldMapData.ts from Natural Earth 1:110m admin-0 countries (public domain).

Usage: python tools/make-worldmap.py [path/to/ne_110m_admin_0_countries.geojson]

Without an argument the GeoJSON is downloaded from a pinned commit of the official Natural Earth
mirror and checked against a SHA-256. Pure Python (no shapely): Equal Earth projection, Antarctica
dropped, Douglas-Peucker simplification in pixel space, integer coordinates, relative path commands.
Re-runnable; the output is deterministic.
"""
import hashlib
import json
import math
import sys
import urllib.request
from pathlib import Path

URL = ('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/'
       '9380cca83db5f9aef52d5e762765100745f84b27/geojson/ne_110m_admin_0_countries.geojson')
SHA256 = '6866c877d39cba9c357620878839b336d569f8c662d3cfab4cb1dbe2d39c977f'
OUT = Path(__file__).resolve().parent.parent / 'src' / 'ui' / 'worldMapData.ts'

W = 1000            # viewBox width
LAT_N, LAT_S = 84.0, -57.0   # visible latitude band (Antarctica cropped)
PAD = 4             # px padding top/bottom
TOL = 0.5           # Douglas-Peucker tolerance in px (land)
TOL_REGION = 0.35   # finer for highlighted regions
MIN_AREA = 6.0      # drop rings smaller than this (px^2) ... unless they belong to a region

# script region -> ISO A3 (ADM0_A3) codes. Natural Earth 110m has no Bahrain.
REGIONS = {
    'latin': ['DEU', 'AUT', 'CHE'],
    'japan': ['JPN'],
    'kyrillisch': ['RUS', 'UKR', 'BLR', 'BGR', 'SRB', 'KAZ', 'KGZ', 'MNG', 'MKD'],
    'arabisch': ['MAR', 'DZA', 'TUN', 'LBY', 'EGY', 'SDN', 'MRT', 'SAU', 'YEM', 'OMN', 'ARE',
                 'QAT', 'KWT', 'BHR', 'IRQ', 'SYR', 'JOR', 'LBN', 'PSX', 'PSE'],
    'devanagari': ['IND', 'NPL'],
    'griechisch': ['GRC', 'CYP'],
    'hebraeisch': ['ISR'],
    'hangul': ['KOR', 'PRK'],
    'thai': ['THA'],
}
# hand-tuned label anchors (viewBox px) where the centroid of the largest part is not a good spot;
# filled in after looking at the preview. None = use the computed centroid.
ANCHOR_OVERRIDE: dict[str, tuple[int, int] | None] = {
    'kyrillisch': None,
    'arabisch': (592, 156),  # Egypt, between the Maghreb and the Arabian Peninsula
}

# --- Equal Earth -------------------------------------------------------------------------------
A1, A2, A3, A4 = 1.340264, -0.081106, 0.000893, 0.003796
M = math.sqrt(3) / 2


def ee(lon: float, lat: float) -> tuple[float, float]:
    lam, phi = math.radians(lon), math.radians(lat)
    t = math.asin(M * math.sin(phi))
    t2 = t * t
    t6 = t2 * t2 * t2
    x = 2 * math.sqrt(3) * lam * math.cos(t) / (3 * (9 * A4 * t6 * t2 + 7 * A3 * t6 + 3 * A2 * t2 + A1))
    y = t * (A4 * t6 * t2 + A3 * t6 + A2 * t2 + A1)
    return x, y


XMAX = ee(180, 0)[0]
SCALE = W / (2 * XMAX)
Y_TOP = ee(0, LAT_N)[1]
Y_BOT = ee(0, LAT_S)[1]
H = round((Y_TOP - Y_BOT) * SCALE + 2 * PAD)


def proj(lon: float, lat: float) -> tuple[float, float]:
    lat = max(LAT_S, min(LAT_N, lat))
    x, y = ee(lon, lat)
    return (x + XMAX) * SCALE, (Y_TOP - y) * SCALE + PAD


# --- geometry helpers ----------------------------------------------------------------------------
def dp(pts: list[tuple[float, float]], tol: float) -> list[tuple[float, float]]:
    """Douglas-Peucker for an open polyline (iterative)."""
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = pts[a]
        bx, by = pts[b]
        dx, dy = bx - ax, by - ay
        L = math.hypot(dx, dy)
        best, bi = -1.0, -1
        for i in range(a + 1, b):
            px, py = pts[i]
            d = abs(dx * (ay - py) - dy * (ax - px)) / L if L > 0 else math.hypot(px - ax, py - ay)
            if d > best:
                best, bi = d, i
        if best > tol:
            keep[bi] = True
            stack.append((a, bi))
            stack.append((bi, b))
    return [p for p, k in zip(pts, keep) if k]


def simplify_ring(ring: list[tuple[float, float]], tol: float) -> list[tuple[int, int]]:
    if ring[0] == ring[-1]:
        ring = ring[:-1]
    if len(ring) < 3:
        return []
    # split the closed ring at the point farthest from the first one so DP has two open halves
    far = max(range(len(ring)), key=lambda i: (ring[i][0] - ring[0][0]) ** 2 + (ring[i][1] - ring[0][1]) ** 2)
    half1 = dp(ring[:far + 1], tol)
    half2 = dp(ring[far:] + [ring[0]], tol)
    pts = half1[:-1] + half2[:-1]
    out: list[tuple[int, int]] = []
    for x, y in pts:
        p = (round(x), round(y))
        if not out or out[-1] != p:
            out.append(p)
    while len(out) > 1 and out[0] == out[-1]:
        out.pop()
    return out if len(out) >= 3 else []


def area(r) -> float:
    s = 0.0
    for i in range(len(r)):
        x1, y1 = r[i]
        x2, y2 = r[(i + 1) % len(r)]
        s += x1 * y2 - x2 * y1
    return s / 2


def centroid(r) -> tuple[float, float]:
    a = area(r)
    cx = cy = 0.0
    for i in range(len(r)):
        x1, y1 = r[i]
        x2, y2 = r[(i + 1) % len(r)]
        c = x1 * y2 - x2 * y1
        cx += (x1 + x2) * c
        cy += (y1 + y2) * c
    return cx / (6 * a), cy / (6 * a)


def ring_to_path(r: list[tuple[int, int]]) -> str:
    def num(v: int, first: bool) -> str:
        s = str(v)
        return s if (first or v < 0) else ' ' + s
    x0, y0 = r[0]
    s = f'M{x0}{num(y0, False)}l'
    px, py = x0, y0
    parts = []
    for x, y in r[1:]:
        dx, dy = x - px, y - py
        parts.append(num(dx, not parts) + num(dy, False))
        px, py = x, y
    return s + ''.join(parts) + 'z'


def polygons(geom) -> list[list[list[list[float]]]]:
    if geom['type'] == 'Polygon':
        return [geom['coordinates']]
    if geom['type'] == 'MultiPolygon':
        return geom['coordinates']
    return []


# --- main ----------------------------------------------------------------------------------------
def load(argv: list[str]) -> dict:
    if len(argv) > 1:
        raw = Path(argv[1]).read_bytes()
    else:
        print('downloading', URL)
        with urllib.request.urlopen(URL) as r:
            raw = r.read()
    got = hashlib.sha256(raw).hexdigest()
    if got != SHA256:
        sys.exit(f'SHA-256 mismatch: {got} (expected {SHA256})')
    return json.loads(raw.decode('utf-8'))


def main() -> None:
    data = load(sys.argv)
    code_region = {c: reg for reg, cs in REGIONS.items() for c in cs}
    land: list[str] = []
    region_paths: dict[str, list[str]] = {r: [] for r in REGIONS}
    region_rings: dict[str, list] = {r: [] for r in REGIONS}
    found: set[str] = set()
    for f in data['features']:
        p = f['properties']
        code = p['ADM0_A3']
        if code in ('ATA', 'ATF'):
            continue
        reg = code_region.get(code)
        if reg:
            found.add(code)
        for poly in polygons(f['geometry']):
            outer = poly[0]  # holes are negligible at 1:110m (only Lesotho in South Africa)
            pts = [proj(lon, lat) for lon, lat in outer]
            r_land = simplify_ring(pts, TOL)
            if r_land and (abs(area(r_land)) >= MIN_AREA or reg):
                land.append(ring_to_path(r_land))
            if reg:
                r = simplify_ring(pts, TOL_REGION)
                if r:
                    region_paths[reg].append(ring_to_path(r))
                    region_rings[reg].append(r)
        # Lesotho is its own feature, drawn over South Africa, so holes need no special treatment.
    missing = sorted(set(code_region) - found - {'BHR', 'PSE'})
    if missing:
        print('warning: not in data:', missing)

    anchors: dict[str, tuple[int, int]] = {}
    for reg, rings in region_rings.items():
        main_ring = max(rings, key=lambda r: abs(area(r)))
        cx, cy = centroid(main_ring)
        anchors[reg] = ANCHOR_OVERRIDE.get(reg) or (round(cx), round(cy))

    lines = [
        '// GENERATED by tools/make-worldmap.py from Natural Earth 1:110m admin-0 countries',
        '// (public domain, https://www.naturalearthdata.com/). Equal Earth projection, Antarctica cropped.',
        '// Do not edit by hand; re-run the script.',
        '',
        f'export const MAP_W = {W};',
        f'export const MAP_H = {H};',
        '',
        '/** All countries (outer rings), for the base land layer. */',
        f"export const LAND = '{''.join(land)}';",
        '',
        'export type MapRegion = ' + ' | '.join(f"'{r}'" for r in REGIONS) + ';',
        '',
        '/** Countries belonging to each script region. */',
        'export const REGION_PATHS: Record<MapRegion, string> = {',
    ]
    for reg, ps in region_paths.items():
        lines.append(f"  {reg}: '{''.join(ps)}',")
    lines += [
        '};',
        '',
        '/** Visual centre of the main landmass of each region (viewBox px). */',
        'export const REGION_ANCHORS: Record<MapRegion, readonly [number, number]> = {',
    ]
    for reg, (x, y) in anchors.items():
        lines.append(f'  {reg}: [{x}, {y}],')
    lines += ['};', '']
    OUT.write_text('\n'.join(lines), encoding='utf-8', newline='\n')
    total = sum(len(s) for s in land) + sum(len(s) for ps in region_paths.values() for s in ps)
    print(f'wrote {OUT} ({OUT.stat().st_size} bytes; path data {total} chars; land rings {len(land)}; H={H})')
    for reg, a in anchors.items():
        print(f'  {reg}: {a}')


if __name__ == '__main__':
    main()
