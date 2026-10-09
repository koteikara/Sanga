"""座席図に印刷された数字（列番号・席番号）を読む。

座席図の数字は文字データではなく、CAD の線の文字（短い線分の集まり）として描かれている。
線分をつながりでまとめて1文字ずつ取り出し、縦横 7×11 のます目に描き直して、
下の型（0〜9）といちばん近いものを選ぶ。

型は、W7〜W11 のページで全席に番号が印刷されている列（W9 の8列など。右端が1番）から
作った平均の形。数字はすべて同じ書体なので、文字の大きさ（席番号と列番号）にかかわらず使える。
"""

import collections
import math

W, H = 7, 11

_TEMPLATES = {
    "0": ["..###..", ".#...#.", "##...##", "#.....#", "#.....#", "#.....#",
          "#.....#", "#.....#", "##...##", ".#...#.", "..###.."],
    "1": ["....#..", "...##..", "..###..", "....#..", "....#..", "....#..",
          "....#..", "....#..", "....#..", "....#..", "....#.."],
    "2": [".#####.", ".#...#.", "#.....#", ".....##", ".....#.", "....##.",
          "...##..", "..##...", ".##....", "##.....", "#######"],
    "3": [".######", ".....#.", "....##.", "...##..", "...###.", ".....##",
          "......#", "......#", "#.....#", "##...##", ".#####."],
    "4": ["....#..", "...##..", "..###..", "..#.#..", ".##.#..", "##..#..",
          "#...#..", "#######", "....#..", "....#..", "....#.."],
    "5": [".#####.", ".#.....", "##.....", "#####..", "###.##.", ".....##",
          "......#", "......#", "#.....#", "##...##", ".#####."],
    "6": ["..####.", ".##..#.", "##.....", "#......", "######.", "##...##",
          "#....##", "#.....#", "##...##", ".##.##.", "..###.."],
    "7": ["#######", "......#", ".....##", ".....#.", "....##.", "....#..",
          "...##..", "...#...", "..##...", "..#....", "..#...."],
    "8": [".#####.", "##...##", "#.....#", "##...##", ".#####.", ".##.###",
          "#.....#", "#.....#", "#.....#", "##...##", ".#####."],
    "9": ["..###..", ".##..##", "#.....#", "#.....#", "#.....#", ".#...##",
          ".######", "......#", ".....##", ".#...#.", ".####.."],
}
TEMPLATES = {d: [[c == "#" for c in row] for row in rows] for d, rows in _TEMPLATES.items()}

# 型との違い（ます目の数）がこれより大きい文字は読まない（記号・矢印など）
MAX_DIST = 14


def _strokes(page, max_size):
    """四角形以外の、小さな線の図形を線分に分けて返す。"""
    segs = []
    for d in page.get_drawings():
        items = d["items"]
        if any(it[0] in ("re", "qu") for it in items):
            continue
        r = d["rect"]
        if max(r.width, r.height) > max_size:
            continue
        for it in items:
            if it[0] == "l":
                segs.append(((it[1].x, it[1].y), (it[2].x, it[2].y)))
            elif it[0] == "c":
                pts = [(p.x, p.y) for p in it[1:5]]
                segs += list(zip(pts, pts[1:]))
    return segs


def _cluster(segs, eps=0.12):
    """端点が eps 以内で接する線分をまとめる（1文字 = 1まとまり）。"""
    parent = list(range(len(segs)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    grid = collections.defaultdict(list)
    for i, (a, b) in enumerate(segs):
        for p in (a, b):
            grid[(round(p[0] / eps), round(p[1] / eps))].append(i)
    for (gx, gy), ids in grid.items():
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for j in grid.get((gx + dx, gy + dy), []):
                    ri, rj = find(ids[0]), find(j)
                    if ri != rj:
                        parent[ri] = rj
    out = collections.defaultdict(list)
    for i in range(len(segs)):
        out[find(i)].append(segs[i])
    return list(out.values())


def _rotate(p, deg):
    """seatpages._rot と同じ向き（-deg 回す）。"""
    t = math.radians(-deg)
    c, s = math.cos(t), math.sin(t)
    return (p[0] * c - p[1] * s, p[0] * s + p[1] * c)


def _bbox(segs):
    xs = [p[0] for s in segs for p in s]
    ys = [p[1] for s in segs for p in s]
    return min(xs), min(ys), max(xs), max(ys)


def _raster(segs):
    x0, y0, x1, y1 = _bbox(segs)
    h = max(y1 - y0, 1e-6)
    cells = [[False] * W for _ in range(H)]
    for a, b in segs:
        n = max(2, int(math.dist(a, b) / (h / 40)) + 1)
        for k in range(n + 1):
            t = k / n
            x = a[0] + (b[0] - a[0]) * t
            y = a[1] + (b[1] - a[1]) * t
            cx = int((x - (x0 + x1) / 2) / h * (H - 1) + W / 2)
            cy = int((y - y0) / h * (H - 1) + 0.5)
            if 0 <= cx < W and 0 <= cy < H:
                cells[cy][cx] = True
    return cells


# 数字の穴（線で囲まれたすき間）の数。8 は2つ、0・4・6・9 は1つ
HOLES = {"0": 1, "4": 1, "6": 1, "8": 2, "9": 1}


def _holes(segs):
    """細かいます目に描き直して、外とつながらない空白（穴）の中心の高さ（0〜1）を返す。"""
    x0, y0, x1, y1 = _bbox(segs)
    h = max(y1 - y0, 1e-6)
    w2, h2 = 15, 23
    cells = [[False] * w2 for _ in range(h2)]
    for a, b in segs:
        n = max(2, int(math.dist(a, b) / (h / 80)) + 1)
        for k in range(n + 1):
            t = k / n
            x = a[0] + (b[0] - a[0]) * t
            y = a[1] + (b[1] - a[1]) * t
            cx = int((x - (x0 + x1) / 2) / h * (h2 - 3) + w2 / 2)
            cy = int((y - y0) / h * (h2 - 3) + 1.5)
            if 0 <= cx < w2 and 0 <= cy < h2:
                cells[cy][cx] = True
    seen = [[False] * w2 for _ in range(h2)]
    stack = [(r, c) for r in range(h2) for c in (0, w2 - 1)] + [(r, c) for c in range(w2) for r in (0, h2 - 1)]
    while stack:
        r, c = stack.pop()
        if not (0 <= r < h2 and 0 <= c < w2) or seen[r][c] or cells[r][c]:
            continue
        seen[r][c] = True
        stack += [(r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)]
    holes = []
    for r in range(h2):
        for c in range(w2):
            if cells[r][c] or seen[r][c]:
                continue
            # 新しい穴を塗りつぶして大きさと中心を測る
            area, sy, todo = 0, 0, [(r, c)]
            while todo:
                rr, cc = todo.pop()
                if not (0 <= rr < h2 and 0 <= cc < w2) or seen[rr][cc] or cells[rr][cc]:
                    continue
                seen[rr][cc] = True
                area += 1
                sy += rr
                todo += [(rr + 1, cc), (rr - 1, cc), (rr, cc + 1), (rr, cc - 1)]
            if area >= 3:
                holes.append((sy / area - 1.5) / (h2 - 3))
    return holes


def _classify(cells, holes=None):
    """型との違い（ます目の数）が最も小さい数字を返す。穴の数が合わない数字は大きく減点する。"""
    best = None
    for d, t in TEMPLATES.items():
        dist = sum(cells[r][c] != t[r][c] for r in range(H) for c in range(W))
        if holes is not None:
            dist += 8 * abs(len(holes) - HOLES.get(d, 0))
            if len(holes) == 1 and d in ("6", "9"):
                # 6 は穴が下、9 は穴が上
                if (d == "6") != (holes[0] > 0.5):
                    dist += 8
        if best is None or dist < best[1]:
            best = (d, dist)
    return best


def read_numbers(page, axis, seat_long, seats=None, seat_short=None):
    """ページの数字を、座席グループの座標（axis 回した u, v）で返す。

    返り値: [{"u", "v", "h", "text"}]。u, v は数字のまとまりの中心、h は文字の高さ。
    文字の向き（0/90/180/270 度）は、型に最もよく合う向きを選ぶ。seats（このグループの
    座席の u, v）を渡すと、その座席の四角の中の文字だけで向きを決める（同じページの
    別の向きのブロックの文字に引っ張られない）。
    """
    segs = _strokes(page, seat_long * 1.2)
    glyphs = []
    for g in _cluster(segs):
        local = [(_rotate(a, axis), _rotate(b, axis)) for a, b in g]
        glyphs.append(local)

    def oriented(g, rot):
        return [(_rotate(a, rot), _rotate(b, rot)) for a, b in g]

    def candidates(rot):
        out = []
        for g in glyphs:
            og = oriented(g, rot)
            x0, y0, x1, y1 = _bbox(og)
            h, w = y1 - y0, x1 - x0
            if not (seat_long * 0.25 < h < seat_long * 0.95 and h * 0.12 < w < h * 0.85):
                continue
            d, dist = _classify(_raster(og), _holes(og))
            out.append({"x0": x0, "x1": x1, "y0": y0, "y1": y1, "h": h, "d": d, "dist": dist, "rot": rot})
        return out

    boxes = None
    if seats:
        cell = seat_long
        boxes = collections.defaultdict(list)
        for u, v in seats:
            boxes[(round(u / cell), round(v / cell))].append((u, v))

    def in_box(c, rot):
        cu, cv = _rotate(((c["x0"] + c["x1"]) / 2, (c["y0"] + c["y1"]) / 2), -rot)
        key = (round(cu / seat_long), round(cv / seat_long))
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for u, v in boxes.get((key[0] + dx, key[1] + dy), []):
                    if abs(cu - u) < seat_short * 0.5 and abs(cv - v) < seat_long * 0.5:
                        return True
        return False

    # 向きを決める: 型との違いが小さい文字が多い向き
    best_rot, best_score, best_cands = 0, None, []
    for rot in (0, 90, 180, 270):
        cands = candidates(rot)
        good = [c for c in cands if c["dist"] <= MAX_DIST]
        judge = [c for c in good if in_box(c, rot)] if boxes else good
        score = (len(judge), -sum(c["dist"] for c in judge))
        if best_score is None or score > best_score:
            best_rot, best_score, best_cands = rot, score, good
    cands = sorted(best_cands, key=lambda c: (round((c["y0"] + c["y1"]) / 2), c["x0"]))

    # 同じ高さに並ぶ近い文字を1つの数にまとめる（文字の間は高さの 0.6 倍まで）
    cands.sort(key=lambda c: c["x0"])
    used = [False] * len(cands)
    numbers = []
    for i, c in enumerate(cands):
        if used[i]:
            continue
        group = [c]
        used[i] = True
        last = c
        for j in range(i + 1, len(cands)):
            o = cands[j]
            if used[j]:
                continue
            if o["x0"] - last["x1"] > last["h"] * 0.6:
                if o["x0"] - last["x1"] > last["h"] * 3:
                    break
                continue
            same_line = abs((o["y0"] + o["y1"]) / 2 - (last["y0"] + last["y1"]) / 2) < last["h"] * 0.3
            same_size = 0.8 < o["h"] / last["h"] < 1.25
            if same_line and same_size:
                group.append(o)
                used[j] = True
                last = o
        x0 = min(o["x0"] for o in group)
        x1 = max(o["x1"] for o in group)
        y0 = min(o["y0"] for o in group)
        y1 = max(o["y1"] for o in group)
        # 文字の向きの座標から、グループの座標（u, v）へ戻す
        cx, cy = _rotate(((x0 + x1) / 2, (y0 + y1) / 2), -best_rot)
        numbers.append({
            "u": cx, "v": cy, "h": y1 - y0,
            "text": "".join(o["d"] for o in group),
        })
    return numbers, best_rot


# ---------------------------------------------------------------------------
# 列番号（小さな白黒画像で1文字ずつ置かれている）
# ---------------------------------------------------------------------------

def _bitmap_ink(pix):
    """画像マスクの数字の線の点と、穴（外とつながらない空白）の中心を返す（画像の座標）。"""
    w, h, n = pix.width, pix.height, pix.n
    s = pix.samples
    vals = [[s[(y * w + x) * n] for x in range(w)] for y in range(h)]
    # 塗る側は少ないほう（数字の線は画像の半分より少ない）
    bright = sum(v >= 128 for row in vals for v in row)
    ink_is_bright = bright < w * h / 2
    ink = [[(v >= 128) == ink_is_bright for v in row] for row in vals]
    pts = [(x + 0.5, y + 0.5) for y in range(h) for x in range(w) if ink[y][x]]
    seen = [[False] * w for _ in range(h)]
    stack = [(y, x) for y in range(h) for x in (0, w - 1)] + [(y, x) for x in range(w) for y in (0, h - 1)]
    while stack:
        y, x = stack.pop()
        if not (0 <= y < h and 0 <= x < w) or seen[y][x] or ink[y][x]:
            continue
        seen[y][x] = True
        stack += [(y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)]
    holes = []
    for y in range(h):
        for x in range(w):
            if ink[y][x] or seen[y][x]:
                continue
            area, sx, sy, todo = 0, 0, 0, [(y, x)]
            while todo:
                yy, xx = todo.pop()
                if not (0 <= yy < h and 0 <= xx < w) or seen[yy][xx] or ink[yy][xx]:
                    continue
                seen[yy][xx] = True
                area += 1
                sx += xx + 0.5
                sy += yy + 0.5
                todo += [(yy + 1, xx), (yy - 1, xx), (yy, xx + 1), (yy, xx - 1)]
            if area >= 2:
                holes.append((sx / area, sy / area))
    return pts, holes


def _bitmap_cells(pts, holes, angle):
    """線の点を angle 度回して、7×11 のます目と穴の高さ（0〜1）にする。"""
    rp = [_rotate(p, angle) for p in pts]
    x0 = min(p[0] for p in rp)
    x1 = max(p[0] for p in rp)
    y0 = min(p[1] for p in rp)
    y1 = max(p[1] for p in rp)
    hh = max(y1 - y0, 1e-6)
    cells = [[False] * W for _ in range(H)]
    for x, y in rp:
        cx = int((x - (x0 + x1) / 2) / hh * (H - 1) + W / 2)
        cy = int((y - y0) / hh * (H - 1) + 0.5)
        if 0 <= cx < W and 0 <= cy < H:
            cells[cy][cx] = True
    hs = [(_rotate(c, angle)[1] - y0) / hh for c in holes]
    return cells, hs


def _classify_bitmap(pix):
    """数字の画像を読む。

    まっすぐな列の番号は縦長の画像にそのまま描かれている。斜めの列の番号は、
    数字ごと 45 度傾けた正方形に近い画像になっているので、斜めの4つの向きにも
    回してみて、型に最も合う向きを選ぶ。
    """
    pts, holes = _bitmap_ink(pix)
    if not pts:
        return None
    # 縦長の画像は傾けない読みを、正方形に近い画像は斜めの読みを優先する
    tall = pix.height > pix.width * 1.05
    best = None
    for angle in (0, 45, -45, 135, -135):
        cells, hs = _bitmap_cells(pts, holes, angle)
        d, dist = _classify(cells, hs)
        if (angle == 0) != tall:
            dist += 6
        if best is None or dist < best[1]:
            best = (d, dist, angle, pts, holes)
    return best


def _turned(pts, holes, angle):
    cells, hs = _bitmap_cells(pts, holes, angle)
    return _classify(cells, hs)[0]


def read_row_images(page, axis):
    """列番号の画像を読み、数ごとにまとめて u, v（グループの座標）で返す。

    返り値: ([{"u", "v", "h", "text"}], {xref: 数字})
    """
    import pymupdf

    infos = page.get_image_info(xrefs=True)
    read = {}
    for info in infos:
        xref = info["xref"]
        if xref in read or not xref:
            continue
        pix = pymupdf.Pixmap(page.parent, xref)
        read[xref] = None if pix.width > 40 or pix.height > 40 else _classify_bitmap(pix)
    digits = {x: (r[0] if r else None) for x, r in read.items()}
    angles = {x: (r[2] if r else 0) for x, r in read.items()}

    # 傾いた 6 と 9 は、180 度回すと互いに入れ替わり見分けられない。
    # いちばん近くに置かれた、向きの分かる傾いた数字（回しても形の変わる 2・3・4・5・7）と同じ向きで読み直す
    def center(info):
        x0, y0, x1, y1 = info["bbox"]
        return ((x0 + x1) / 2, (y0 + y1) / 2)

    sure = [(center(i), read[i["xref"]][2]) for i in infos
            if read.get(i["xref"]) and read[i["xref"]][2] != 0 and read[i["xref"]][0] in "23457"]
    for xref, r in read.items():
        if not r or r[2] == 0 or r[0] not in "69" or not sure:
            continue
        here = [center(i) for i in infos if i["xref"] == xref]
        _, angle = min(sure, key=lambda t: min(math.dist(t[0], h) for h in here))
        digits[xref] = _turned(r[3], r[4], angle)
        angles[xref] = angle

    placed = []
    for info in page.get_image_info(xrefs=True):
        d = digits.get(info["xref"])
        if d is None:
            continue
        x0, y0, x1, y1 = info["bbox"]
        # 数の並ぶ向き（ページ上）。傾いた数字は、画像を回して読んだ角度だけ傾いて並ぶ
        t = math.radians(angles.get(info["xref"], 0))
        c = _rotate(((x0 + x1) / 2, (y0 + y1) / 2), axis)
        dirv = _rotate((math.cos(t), math.sin(t)), axis)
        size = max(math.hypot(info["transform"][2], info["transform"][3]), 1e-6)  # 文字の高さ
        placed.append({"u": c[0], "v": c[1], "h": size, "dir": dirv, "d": d})

    # 隣り合う数字（同じ行で、中心の間が文字の高さの 1.3 倍まで）を1つの数にまとめる
    used = [False] * len(placed)
    numbers = []
    for i, p in enumerate(placed):
        if used[i]:
            continue
        group, todo = [], [i]
        used[i] = True
        while todo:
            k = todo.pop()
            group.append(placed[k])
            for j, q in enumerate(placed):
                pk = placed[k]
                near = math.dist((pk["u"], pk["v"]), (q["u"], q["v"])) < pk["h"] * 1.3
                # 同じ行: 文字の横方向に垂直な向きのずれが小さい
                off = abs((q["u"] - pk["u"]) * -pk["dir"][1] + (q["v"] - pk["v"]) * pk["dir"][0]) / math.hypot(*pk["dir"])
                if not used[j] and near and off < pk["h"] * 0.3:
                    used[j] = True
                    todo.append(j)
        dx, dy = group[0]["dir"]
        group.sort(key=lambda q: q["u"] * dx + q["v"] * dy)
        numbers.append({
            "u": sum(q["u"] for q in group) / len(group),
            "v": sum(q["v"] for q in group) / len(group),
            "h": group[0]["h"],
            "dir": group[0]["dir"],
            "text": "".join(q["d"] for q in group),
        })
    return numbers, digits
