# Shrinks + reframes the packed airline logos in logos.gen.js in place.
#
# The logos ship as base64 data URIs, drawn inside a 20-30px circle
# (.alogo img at 100% of a border-radius:50% tile). This pass, per logo:
#   1. trim the surrounding whitespace to the mark's true bounds
#   2. detect the logo's own background: if it sits on an opaque, non-white,
#      consistent tile (t'way/easyJet/United), use that brand colour as the
#      circle fill; marks on white/transparent keep a white circle (no change)
#   3. scale the mark up until its farthest ink pixel just meets the circle,
#      so round/diagonal marks fill edge-to-edge while wide wordmarks back off
#      only enough to stay whole (no clipping, no brand mangling)
#   4. flatten onto the fill colour (drops alpha) at 30x30
#   5. quantize to a 64-colour palette PNG
# Net effect ~204 KB -> ~45 KB *and* the marks actually fill the circle.
#
#   git checkout HEAD -- tools/logos.gen.js   # start from the 48px masters
#   python tools/optimize-logos.py            # rewrites tools/logos.gen.js
#   npm run build
#
# Idempotency: run once on freshly packed 48px masters. Re-running on its own
# 30x30 output re-trims already-tight marks and slightly softens them.
import re, io, json, base64, os, math
from collections import Counter
from PIL import Image

SIZE = 30            # shipped tile size (covers the 30px mobile row)
WORK = SIZE * 5      # supersample so trim/scale math stays smooth
COLORS = 64
MARGIN = 0.97        # farthest ink lands at 97% of the radius (a hair of breathing room)
HERE = os.path.dirname(__file__)
GEN = os.path.join(HERE, 'logos.gen.js')


def is_ink(r, g, b, a):
    return a > 16 and not (r > 244 and g > 244 and b > 244)


def detect_bg(im):
    """Return an (r,g,b) tile colour if the mark sits on a solid non-white
    background, else None. Reads the border ring (skipping the corners, which
    are transparent on rounded tiles) and requires it to be mostly opaque and
    dominated by one non-white colour."""
    px = im.load()
    w, h = im.size
    mx, my = int(w * 0.22), int(h * 0.22)
    hist = Counter()
    seen = 0

    def sample(x, y):
        nonlocal seen
        r, g, b, a = px[x, y]
        seen += 1
        if a > 200 and not (r > 238 and g > 238 and b > 238):
            hist[(r // 16 * 16, g // 16 * 16, b // 16 * 16)] += 1

    for x in range(mx, w - mx):
        for y in (0, 1, h - 2, h - 1):
            sample(x, y)
    for y in range(my, h - my):
        for x in (0, 1, w - 2, w - 1):
            sample(x, y)
    if not seen or not hist or sum(hist.values()) / seen < 0.6:
        return None
    return hist.most_common(1)[0][0]


def reframe(uri):
    raw = base64.b64decode(uri.split(',', 1)[1])
    im = Image.open(io.BytesIO(raw)).convert('RGBA')

    # 1. trim to the mark's ink bounds
    px = im.load()
    xs, ys = [], []
    for y in range(im.height):
        for x in range(im.width):
            if is_ink(*px[x, y]):
                xs.append(x); ys.append(y)
    if xs:
        im = im.crop((min(xs), min(ys), max(xs) + 1, max(ys) + 1))

    # 2. detect the fill colour (own tile colour, or white)
    fill = detect_bg(im) or (255, 255, 255)

    # 3. scale so the farthest ink pixel sits at MARGIN * radius of the WORK circle
    up = im.resize((max(1, im.width * 4), max(1, im.height * 4)), Image.LANCZOS)
    upx = up.load()
    cx, cy = up.width / 2, up.height / 2
    maxd = 1.0
    for y in range(up.height):
        for x in range(up.width):
            if is_ink(*upx[x, y]):
                maxd = max(maxd, math.hypot(x - cx, y - cy))
    scale = (WORK / 2 * MARGIN) / maxd
    nw, nh = max(1, round(up.width * scale)), max(1, round(up.height * scale))
    mark = up.resize((nw, nh), Image.LANCZOS)

    # 4. flatten onto a fill-coloured WORK canvas, centered, then downsize to SIZE
    canvas = Image.new('RGB', (WORK, WORK), fill)
    canvas.paste(mark, ((WORK - nw) // 2, (WORK - nh) // 2), mark)
    small = canvas.resize((SIZE, SIZE), Image.LANCZOS)

    # 5. quantize to a compact palette PNG
    pal = small.quantize(colors=COLORS, method=Image.FASTOCTREE)
    buf = io.BytesIO()
    pal.save(buf, 'PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()


src = open(GEN, encoding='utf-8').read()
logos = json.loads(re.search(r'const LOGO_URIS=(\{.*\});', src, re.S).group(1))
out = {}
before = after = 0
for icao, uri in logos.items():
    before += len(uri)
    out[icao] = reframe(uri)
    after += len(out[icao])

open(GEN, 'w', encoding='utf-8').write('const LOGO_URIS=' + json.dumps(out) + ';\n')
print('logos: %d  base64 %.1f KB -> %.1f KB (-%.0f%%)'
      % (len(out), before / 1024, after / 1024, 100 * (1 - after / before)))
