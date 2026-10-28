"""Generates the photographic assets used by the site from the couple's monogram.

    python3 scripts/make_assets.py <monogram.png> <agency-logo.png>

Outputs (assets/):
  mono.webp        – trimmed monogram with transparency
  seal.webp        – wax seal pressed with the A/D letterforms, lit and shaded
  paper.jpg        – tileable cotton-paper texture for the envelope and card
  agency.webp      – event agency logo with the white background removed
"""
import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as nd

OUT = 'assets/'
rng = np.random.default_rng(11)


def trim(im, thresh=40, pad=10):
    a = np.asarray(im)[..., 3]
    ys, xs = np.where(a > thresh)
    return im.crop((xs.min() - pad, ys.min() - pad, xs.max() + pad, ys.max() + pad))


def letters_mask(mono):
    """The A (with its infinity loop) and D strokes: pastel watercolour in the centre of the
    monogram. Drop the saturated reds, greens, browns and yellows of the roses, leaves,
    coffee beans, tennis ball and palette, and stay inside the letters' region."""
    W, Hh = mono.size
    hsv = np.asarray(mono.convert('RGB').convert('HSV')).astype(float) / 255
    H, S, V = hsv[..., 0] * 360, hsv[..., 1], hsv[..., 2]
    A = np.asarray(mono)[..., 3] / 255
    red = ((H < 20) | (H > 330)) & (S > .45) & (V < .85)
    green = (H > 60) & (H < 140) & (S > .2)
    brown = V < .55
    yellow = (H > 45) & (H < 70) & (S > .35)
    xx = np.arange(W)[None, :] / W
    yy = np.arange(Hh)[:, None] / Hh
    zone = (xx > .2) & (xx < .815) & ~((xx < .34) & (yy > .6))
    m = (A > .45) & ~red & ~green & ~brown & ~yellow & zone
    m = nd.binary_closing(m, iterations=3)
    m = nd.binary_opening(m, iterations=2)
    lab, n = nd.label(m)
    sizes = nd.sum(m, lab, range(1, n + 1))
    return np.isin(lab, np.where(sizes > .05 * sizes.max())[0] + 1)


def smooth_noise(shape, scale, wrap=False):
    n = rng.standard_normal(shape)
    n = nd.gaussian_filter(n, scale, mode='wrap' if wrap else 'reflect')
    return n / (n.std() + 1e-9)


def make_seal(mask, size=520):
    S = size
    yy, xx = np.mgrid[0:S, 0:S].astype(float)
    cx = cy = S / 2
    dx, dy = xx - cx, yy - cy
    r = np.hypot(dx, dy)
    th = np.arctan2(dy, dx)
    R = S * 0.43
    # irregular, poured-wax outline
    wob = sum(a * np.sin(k * th + p) for a, k, p in [(.035, 3, .4), (.03, 5, 1.7), (.02, 7, 2.9), (.012, 11, .9), (.008, 17, 2.2)])
    edge = R * (1 + wob)
    inside = edge - r                                   # >0 inside the blob (px)
    alpha = np.clip(inside / 1.6 + .5, 0, 1)
    # height: rounded pooled edge, a pressed well, raised rim of the stamp
    h = np.clip(inside / (S * .07), 0, 1) ** .6 * 1.0
    Rin = S * 0.305
    well = np.clip((Rin - r) / 3.0, 0, 1)
    h -= .45 * well
    rim = np.exp(-((r - Rin - S * .012) / (S * .018)) ** 2)
    h += .28 * rim * (inside > 0)
    # stamp design: letterforms raised inside the well
    m = Image.fromarray((mask * 255).astype(np.uint8))
    m = m.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.MaxFilter(5))  # thicker strokes read better in wax
    bw = int(Rin * 1.78)
    mw, mh = m.size
    sc = bw / max(mw, mh)
    m = m.resize((max(1, int(mw * sc)), max(1, int(mh * sc))), Image.LANCZOS)
    L = np.zeros((S, S))
    ox, oy = int(cx - m.size[0] / 2), int(cy - m.size[1] / 2 + S * .01)
    L[oy:oy + m.size[1], ox:ox + m.size[0]] = np.asarray(m) / 255
    L = nd.gaussian_filter(L, 1.8) * well
    h += .42 * L
    # a fine decorative ring of dots inside the rim
    ring_r = Rin - S * .035
    dots = np.zeros((S, S))
    for t in np.linspace(0, 2 * np.pi, 56, endpoint=False):
        px, py = cx + ring_r * np.cos(t), cy + ring_r * np.sin(t)
        dots += np.exp(-((xx - px) ** 2 + (yy - py) ** 2) / (2 * 2.2 ** 2))
    h += .12 * np.clip(dots, 0, 1)
    # wax surface: tiny bubbles and ripples
    h += .004 * smooth_noise((S, S), 2.5) + .012 * smooth_noise((S, S), 14)
    h = nd.gaussian_filter(h, 1.1)
    # lighting
    gy, gx = np.gradient(h * S * .09)
    nx, ny, nz = -gx, -gy, np.ones_like(h)
    nn = np.sqrt(nx ** 2 + ny ** 2 + nz ** 2)
    nx, ny, nz = nx / nn, ny / nn, nz / nn
    lx, ly, lz = -.55, -.62, .56
    ll = np.sqrt(lx * lx + ly * ly + lz * lz)
    lx, ly, lz = lx / ll, ly / ll, lz / ll
    diff = np.clip(nx * lx + ny * ly + nz * lz, 0, 1)
    hx, hy, hz = lx, ly, lz + 1
    hl = np.sqrt(hx * hx + hy * hy + hz * hz)
    spec = np.clip((nx * hx + ny * hy + nz * hz) / hl, 0, 1) ** 60
    # antique gold wax: deeper in the well, brighter on the crests
    base = np.array([178, 128, 66], float) / 255
    deep = np.array([118, 76, 34], float) / 255
    t = np.clip(h * .9 + .2, 0, 1)[..., None]
    col = deep * (1 - t) + base * t
    shade = (.32 + .9 * diff)[..., None]
    col = col * shade + spec[..., None] * np.array([1, .93, .78]) * .75
    col *= (1 + .012 * smooth_noise((S, S), 1.2))[..., None]
    col = np.clip(col, 0, 1)
    rgba = np.dstack([col * 255, alpha * 255]).astype(np.uint8)
    return Image.fromarray(rgba, 'RGBA')


def make_paper(size=360):
    S = size
    base = np.array([248, 242, 233], float)
    n = 1.6 * smooth_noise((S, S), .8, True) + 1.1 * smooth_noise((S, S), 5, True) + .7 * smooth_noise((S, S), 30, True)
    img = np.ones((S, S, 3)) * base + n[..., None] * np.array([1, 1, 1.1])
    # cotton fibres: short soft curves, mostly a touch lighter or darker
    fib = np.zeros((S, S))
    for _ in range(260):
        x, y = rng.uniform(0, S, 2)
        ang = rng.uniform(0, np.pi)
        ln = rng.uniform(6, 22)
        sgn = rng.choice([-1, 1], p=[.6, .4])
        for s in np.linspace(0, ln, int(ln * 2)):
            ang += rng.normal(0, .06)
            px, py = int(x + s * np.cos(ang)) % S, int(y + s * np.sin(ang)) % S
            fib[py, px] += sgn
    fib = nd.gaussian_filter(fib, .7, mode='wrap')
    img += fib[..., None] * 6
    img = np.clip(img, 0, 255).astype(np.uint8)
    return Image.fromarray(img, 'RGB')


def agency(path):
    im = Image.open(path).convert('RGB')
    a = np.asarray(im).astype(float)
    dark = 255 - a.min(axis=2)
    alpha = np.clip((dark - 18) / 150, 0, 1)
    navy = np.array([31, 46, 120], float)
    rgba = np.dstack([np.ones(a.shape[:2] + (3,)) * navy, alpha * 255]).astype(np.uint8)
    o = Image.fromarray(rgba, 'RGBA')
    return trim(o, 30, 4)


if __name__ == '__main__':
    mono = trim(Image.open(sys.argv[1]).convert('RGBA'))
    mono.resize((900, int(900 * mono.size[1] / mono.size[0])), Image.LANCZOS).save(OUT + 'mono.webp', quality=88)
    seal = make_seal(letters_mask(mono))
    seal.resize((300, 300), Image.LANCZOS).save(OUT + 'seal.webp', quality=90)
    make_paper().save(OUT + 'paper.jpg', quality=86)
    if len(sys.argv) > 2:
        ag = agency(sys.argv[2])
        ag.resize((700, int(700 * ag.size[1] / ag.size[0])), Image.LANCZOS).save(OUT + 'agency.webp', quality=92)
    print('assets written')
