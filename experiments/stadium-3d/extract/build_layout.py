"""サンガスタジアムの座席配置を、公式の座席図（PDF）から組み立てる。

使い方:
    python build_layout.py <PDFを置いたディレクトリ> <出力する layout.json>

PDF はリポジトリに含めない（スタジアム運営の公開物で、再配布しない）。
取得元と取得手順は README.md の「座席データの作り方」を参照。

必要なもの: Python 3.10 以上、PyMuPDF（pip install pymupdf）。
このリポジトリの依存ではない。生成物の layout.json だけをコミットする。

座標系（出力）:
    x: 東が正（m）。ピッチ中央（センタースポット）が原点。
    z: 南が正（m）。three.js で y を上にしたとき右手系になるよう、北を負にとる。
    h: フィールド面からの高さ（m）。
"""

import json
import math
import sys
from collections import Counter, defaultdict
from pathlib import Path

import pymupdf

sys.path.insert(0, str(Path(__file__).resolve().parent))
from seatpages import extract_page, find_front_arrow, front_wall_offset

# ---------------------------------------------------------------------------
# 公開資料の値（京都府「京都スタジアム（仮称）インフォメーションパッケージ」平成30年1月 p.15/p.18）
# ---------------------------------------------------------------------------
SEAT_PITCH = 0.47            # 一般席の席幅（m）。座席図の縮尺もこれで決める
FRONT_ROW_FLOOR = 1.2        # 最前列床面とフィールド面の高低差（m）
LOWER_RAKE = (21.0, 24.0)    # 下層の傾斜角（度）。前から後ろへ大きくなるものとして扱う
UPPER_RAKE = 32.0            # 上層の傾斜角（度）
ROOF_OVERHANG = 2.0          # 屋根は最前列より 2m 張り出す
# スタンド最前列からの距離（タッチライン／ゴールラインから）
FRONT_DIST = {"W": 8.5, "E": 7.5, "N": 10.5, "S": 10.5}
PITCH = (105.0, 68.0)        # 競技エリア（南北, 東西）

OFFICIAL_SEATS = {           # p.18「各階フロアの施設配置」の概数
    ("W", "lower"): 3440, ("E", "lower"): 4130,
    ("N", "lower"): 2450, ("S", "lower"): 2550,
    ("N", "upper"): 3010, ("S", "upper"): 2890, ("E", "upper"): 2470,
}

# ---------------------------------------------------------------------------
# モデル上の仮定（資料に数値がないもの）。README の表と一致させる
# ---------------------------------------------------------------------------
LOWER_DEPTH_FOR_RAKE = 17.0  # 傾斜角が 21°→24° に変わる奥行き（m）
UPPER_ABOVE_LOWER_BACK = 2.5 # 下層最後列の床から上層1列目の床までの高さ（断面図の比率から）
LOWER_BACK_DEPTH = 16.0      # 「下層最後列」とみなす奥行き（m）
DEFAULT_FRONT_OFFSET = 0.9   # 前面の線が見つからないときの、1列目座席中心から前面までの距離（m）

R2 = 1 / math.sqrt(2)
NORMAL = {  # スタンドの前（ピッチ側）を向く単位ベクトル（x, z）
    "W": (1.0, 0.0), "E": (-1.0, 0.0), "N": (0.0, 1.0), "S": (0.0, -1.0),
    "NW": (R2, R2), "NE": (-R2, R2), "SE": (-R2, -R2), "SW": (R2, -R2),
}


def tier_of(block_id):
    return "upper" if int(block_id[1:]) >= 21 else "lower"


def segment_of(block_id):
    """ブロックが八角形のどの辺にあるか（座席図全体図の配置から）。"""
    stand, num = block_id[0], int(block_id[1:])
    if stand == "W":
        return "NW" if num <= 2 else "SW" if num >= 16 else "W"
    if stand == "E":
        if num <= 17:
            return "SE" if num <= 2 else "NE" if num >= 16 else "E"
        return "SE" if num <= 22 else "NE" if num >= 38 else "E"
    if stand == "N":
        if num <= 13:
            return "NE" if num <= 2 else "NW" if num >= 12 else "N"
        # N34 は西側（メインスタンド上層の端）の小さなブロック
        return "NE" if num == 21 else "W" if num == 34 else "NW" if num >= 31 else "N"
    if num <= 13:
        return "SW" if num <= 2 else "SE" if num >= 12 else "S"
    # S21 は西側の小さなブロック
    return "W" if num == 21 else "SW" if num <= 24 else "SE" if num == 34 else "S"


def is_straight(seg):
    return len(seg) == 1


# ---------------------------------------------------------------------------
# 全体図（seat_map_202009.pdf）
# ---------------------------------------------------------------------------
STAND_FILL = {
    "W": (0.801, 0.431, 0.166), "E": (0.638, 0.171, 0.272),
    "S": (0.11, 0.24, 0.192), "N": (0.072, 0.306, 0.555),
}


def _area(pts):
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    return (max(xs) - min(xs)) * (max(ys) - min(ys))


def _fill_polys(page, color, min_area=2500):
    out = []
    for d in page.get_drawings():
        f = d.get("fill")
        if f is None or tuple(round(v, 3) for v in f) != color:
            continue
        r = d["rect"]
        if r.width * r.height < min_area:
            continue
        pts = []
        for it in d["items"]:
            if it[0] == "l":
                for p in (it[1], it[2]):
                    q = (round(p.x, 2), round(p.y, 2))
                    if not pts or pts[-1] != q:
                        pts.append(q)
        if len(pts) > 2 and pts[0] == pts[-1]:
            pts.pop()
        out.append(pts)
    return out


def _separators(page, bbox, vertical):
    """全体図で、スタンドのブロックを区切る薄い灰色の太線の位置。"""
    xs = []
    x0, y0, x1, y1 = bbox
    for d in page.get_drawings():
        c = d.get("color")
        # 2F の図と 3・4F の図で色がわずかに違う
        if c is None or tuple(round(v, 2) for v in c) not in ((0.73, 0.75, 0.78), (0.75, 0.76, 0.78)):
            continue
        if (d.get("width") or 0) < 2.5:
            continue
        for it in d["items"]:
            if it[0] != "l":
                continue
            p, q = it[1], it[2]
            if vertical and abs(p.x - q.x) < 0.2 and abs(p.y - q.y) > 15:
                if x0 - 3 <= p.x <= x1 + 3 and y0 - 3 <= min(p.y, q.y) and max(p.y, q.y) <= y1 + 3:
                    xs.append(round(p.x, 2))
            if not vertical and abs(p.y - q.y) < 0.2 and abs(p.x - q.x) > 15:
                if y0 - 3 <= p.y <= y1 + 3 and x0 - 3 <= min(p.x, q.x) and max(p.x, q.x) <= x1 + 3:
                    xs.append(round(p.y, 2))
    return sorted(set(xs))


class MapFrame:
    """全体図の pt をスタジアム座標へ。図の右が北、下が東。"""

    def __init__(self, cx, cy, kx, ky, x_at_cy, z_at_cx=0.0):
        self.cx, self.cy, self.kx, self.ky = cx, cy, kx, ky
        self.x0, self.z0 = x_at_cy, z_at_cx

    def __call__(self, X, Y):
        return (self.x0 + (Y - self.cy) / self.ky, self.z0 - (X - self.cx) / self.kx)


def read_maps(path):
    doc = pymupdf.open(path)
    p1, p2 = doc[0], doc[1]

    # --- 2F（下層）。白い内側の長方形がスタンド前面＝フィールド 126×84m
    white = [pts for pts in _fill_polys(p1, (1.0, 1.0, 1.0)) if len(pts) == 8]
    field = max(white, key=lambda pts: (max(p[0] for p in pts) - min(p[0] for p in pts)))
    sx0 = min(p[0] for p in field); sx1 = max(p[0] for p in field)   # S前面, N前面
    wy0 = min(p[1] for p in field); ey1 = max(p[1] for p in field)   # W前面, E前面
    pw, ph = PITCH[1] / 2, PITCH[0] / 2
    x_w = -(pw + FRONT_DIST["W"]); x_e = pw + FRONT_DIST["E"]
    z_s = ph + FRONT_DIST["S"]; z_n = -(ph + FRONT_DIST["N"])
    f1 = MapFrame(
        cx=(sx0 + sx1) / 2, cy=(wy0 + ey1) / 2,
        kx=(sx1 - sx0) / (z_s - z_n), ky=(ey1 - wy0) / (x_e - x_w),
        x_at_cy=(x_w + x_e) / 2,
    )

    lower = {}
    for stand, col in STAND_FILL.items():
        polys = _fill_polys(p1, col)
        poly = max(polys, key=_area)
        lower[stand] = [f1(*p) for p in poly]

    # 下層のブロック境界（真っ直ぐな区間）。ブロック中心を下の並びで割り当てる
    lower_centers = {}
    order = {
        "W": ("vertical", list(range(14, 3, -1))),   # 図の左（南）から W14 … W4
        "E": ("vertical", list(range(4, 15))),       # 図の左（南）から E4 … E14
        "S": ("horizontal", list(range(4, 11))),     # 図の上（西）から S4 … S10
        "N": ("horizontal", list(range(10, 3, -1))), # 図の上（西）から N10 … N4
    }
    for stand, (kind, nums) in order.items():
        polys = _fill_polys(p1, STAND_FILL[stand])
        poly = max(polys, key=_area)
        xs = [p[0] for p in poly]; ys = [p[1] for p in poly]
        seps = _separators(p1, (min(xs), min(ys), max(xs), max(ys)), kind == "vertical")
        if len(seps) != len(nums) + 1:
            raise SystemExit(f"{stand}: 境界線 {len(seps)} 本（期待 {len(nums) + 1}）")
        for n, a, b in zip(nums, seps, seps[1:]):
            mid = (a + b) / 2
            if kind == "vertical":
                lower_centers[f"{stand}{n}"] = f1(mid, (wy0 + ey1) / 2)[1]   # z
            else:
                lower_centers[f"{stand}{n}"] = f1((sx0 + sx1) / 2, mid)[0]   # x

    # --- 3・4F（上層）。内側の白い八角形が上層の前面。
    # この図は略図で、縮尺が 2F と異なる。南北・東の前面が同じだけ下層から
    # 後退しているとして縮尺を決める（断面図の後退量 約10.5〜10.8m と照合する）。
    white2 = [pts for pts in _fill_polys(p2, (1.0, 1.0, 1.0)) if len(pts) == 8]
    inner = max(white2, key=lambda pts: max(p[0] for p in pts) - min(p[0] for p in pts))
    ix0 = min(p[0] for p in inner); ix1 = max(p[0] for p in inner)
    iy0 = min(p[1] for p in inner); iy1 = max(p[1] for p in inner)
    outer2 = max((pts for pts in _fill_polys(p2, (0.751, 0.762, 0.783)) if len(pts) == 8), key=_area)
    ocx = (min(p[0] for p in outer2) + max(p[0] for p in outer2)) / 2
    ocy = (min(p[1] for p in outer2) + max(p[1] for p in outer2)) / 2
    half_ns = (ix1 - ix0) / 2
    half_e = iy1 - ocy
    field_half_ns = (z_s - z_n) / 2
    field_half_e = x_e - (x_w + x_e) / 2
    s2 = (half_ns - half_e) / (field_half_ns - field_half_e)
    f2 = MapFrame(cx=ocx, cy=ocy, kx=s2, ky=s2, x_at_cy=(x_w + x_e) / 2)
    upper_front = [f2(*p) for p in inner]
    setback = half_ns / s2 - field_half_ns

    upper = {}
    for stand in ("E", "N", "S"):
        polys = _fill_polys(p2, STAND_FILL[stand])
        upper[stand] = [[f2(*p) for p in poly] for poly in polys]

    outer_2f = max(_fill_polys(p1, (0.751, 0.762, 0.783)), key=_area)
    deck_2f = max(_fill_polys(p1, (0.87, 0.878, 0.898)), key=_area)
    vip = [pts for pts in _fill_polys(p1, (0.285, 0.296, 0.335), min_area=500)]

    # 上層の直線区間のブロック中心（略図なので縮尺は後で座席図に合わせて補正する）
    upper_centers = {}
    order2 = {
        "E": ("vertical", list(range(24, 37))),
        # S25・S33・N22・N30 は角の斜めの線で区切られているので、直線区間は1つ内側から
        "S": ("horizontal", list(range(26, 33))),
        "N": ("horizontal", list(range(29, 22, -1))),
    }
    for stand, (kind, nums) in order2.items():
        polys = _fill_polys(p2, STAND_FILL[stand])
        xs = [p[0] for poly in polys for p in poly]; ys = [p[1] for poly in polys for p in poly]
        if stand == "E":
            bbox = (ix0 + 30, iy1, ix1 - 30, max(ys))
        elif stand == "S":
            bbox = (min(xs), iy0 + 40, ix0, iy1 - 40)
        else:
            bbox = (ix1, iy0 + 40, max(xs), iy1 - 40)
        seps = _separators(p2, bbox, kind == "vertical")
        if len(seps) != len(nums) + 1:
            raise SystemExit(f"上層 {stand}: 境界線 {len(seps)} 本（期待 {len(nums) + 1}）{seps}")
        for n, a, b in zip(nums, seps, seps[1:]):
            mid = (a + b) / 2
            if kind == "vertical":
                upper_centers[f"{stand}{n}"] = f2(mid, ocy)[1]
            else:
                upper_centers[f"{stand}{n}"] = f2(ocx, mid)[0]

    return {
        "field": {"x_w": x_w, "x_e": x_e, "z_n": z_n, "z_s": z_s},
        "lower": lower, "upper": upper, "upper_front": upper_front,
        "upper_setback": setback, "s2": s2, "s1": (f1.kx, f1.ky),
        "outer_2f": [f1(*p) for p in outer_2f], "deck_2f": [f1(*p) for p in deck_2f],
        "outer_upper": [f2(*p) for p in outer2],
        "vip": [[f1(*p) for p in poly] for poly in vip],
        "centers": {"lower": lower_centers, "upper": upper_centers},
    }


def front_lines(maps):
    """辺ごとの前面の線（n·X = c）。下層と上層。"""
    fd = maps["field"]
    corners = {
        "NW": (fd["x_w"], fd["z_n"]), "NE": (fd["x_e"], fd["z_n"]),
        "SE": (fd["x_e"], fd["z_s"]), "SW": (fd["x_w"], fd["z_s"]),
    }
    lower = {
        "W": fd["x_w"], "E": -fd["x_e"], "N": fd["z_n"], "S": -fd["z_s"],
    }
    for k, (x, z) in corners.items():
        n = NORMAL[k]
        lower[k] = n[0] * x + n[1] * z

    # 上層: 内側の八角形の各辺
    up = maps["upper_front"]
    upper = {}
    for k, n in NORMAL.items():
        # n はピッチ側を向く。その向きで最も外側（n·X が最小）の辺が、その辺の前面
        vals = [n[0] * x + n[1] * z for x, z in up]
        upper[k] = min(vals)
    return lower, upper


# ---------------------------------------------------------------------------
# ページの解析と位置合わせ
# ---------------------------------------------------------------------------

def _infer_labels(groups, main_idx):
    """ラベルの印刷されていない帯（E22, E24 など）に、隣のブロック番号から名前を付ける。"""
    from seatpages import assign_page

    assigned = assign_page(groups)
    main = groups[main_idx]
    main_blocks = assigned[main_idx]
    # 番号が u とともに増えるか減るか（ページ内の向き）
    pairs = []
    for name, b in main_blocks.items():
        pairs.append(((b["band"][0] + b["band"][1]) / 2, int(name[1:])))
    pairs.sort()
    inc = sum(1 if b[1] > a[1] else -1 for a, b in zip(pairs, pairs[1:])) if len(pairs) > 1 else 1
    ma = math.radians(main["axis"])
    num_dir = (math.cos(ma) * (1 if inc >= 0 else -1), math.sin(ma) * (1 if inc >= 0 else -1))

    result = []
    for gi, g in enumerate(groups):
        blocks = dict(assigned[gi])
        a = math.radians(g["axis"])
        sign = 1 if num_dir[0] * math.cos(a) + num_dir[1] * math.sin(a) >= 0 else -1
        named = {}
        for name, b in blocks.items():
            named[b["band"]] = name
        bands = g["bands"]
        for i, band in enumerate(bands):
            if band in named:
                continue
            # 最も近いラベル付きの帯から数える
            best = None
            for j, other in enumerate(bands):
                if other in named and (best is None or abs(j - i) < abs(best - i)):
                    best = j
            if best is None:
                continue
            ref = named[bands[best]]
            num = int(ref[1:]) + sign * (i - best)
            if num <= 0:
                continue
            rows = []
            for v, seats in g["rows"]:
                sel = [s for s in seats if band[0] <= s[0] <= band[1]]
                if sel:
                    rows.append((v, sel))
            if rows:
                blocks[f"{ref[0]}{num}"] = {"band": band, "rows": rows, "label_v": None, "inferred": True}
        result.append(blocks)
    return result


def _rot2(v, deg):
    t = math.radians(deg)
    return (v[0] * math.cos(t) - v[1] * math.sin(t), v[0] * math.sin(t) + v[1] * math.cos(t))


def _lattice(blocks, front_sign):
    """グループ内で列の多いブロックの列位置を、その向きの列番号の基準にする。"""
    ref = max(blocks.values(), key=lambda b: len(b["rows"]))
    vs = sorted((v for v, _ in ref["rows"]), key=lambda v: -front_sign * v)
    return vs  # 前から順


def analyse_page(page, tag):
    groups, _ = extract_page(page)
    arrow = find_front_arrow(page)
    if arrow is None:
        raise SystemExit(f"{tag}: 「前」の矢印が見つからない")
    fpage = arrow[1]
    main_idx = max(range(len(groups)), key=lambda i: sum(len(s) for _, s in groups[i]["rows"]))
    named = _infer_labels(groups, main_idx)

    out = []
    for g, blocks in zip(groups, named):
        if not blocks:
            continue
        a = math.radians(g["axis"])
        u_axis = (math.cos(a), math.sin(a))
        v_axis = (-math.sin(a), math.cos(a))
        # このグループの前方向（列に垂直で、ページの矢印と同じ側）
        fs = 1 if v_axis[0] * fpage[0] + v_axis[1] * fpage[1] > 0 else -1
        f_dir = (v_axis[0] * fs, v_axis[1] * fs)
        left = (f_dir[1], -f_dir[0])               # 前を向いたときの左（ページ座標、y 下向き）
        lsign = 1 if left[0] * u_axis[0] + left[1] * u_axis[1] > 0 else -1

        lattice = _lattice(blocks, fs)
        spacing = sorted(abs(b - a2) for a2, b in zip(lattice, lattice[1:]))
        row_gap = spacing[len(spacing) // 2] if spacing else g["long"] * 1.5
        wall = front_wall_offset(page, g, fs)

        for name, b in blocks.items():
            rows = []
            dropped = 0
            for v, seats in b["rows"]:
                k = min(range(len(lattice)), key=lambda i: abs(lattice[i] - v))
                if abs(lattice[k] - v) > row_gap * 0.3:
                    dropped += len(seats)
                    continue
                rows.append((k + 1, v, seats))
            if not rows:
                continue
            us = [u for _, _, seats in rows for u, _ in seats]
            u_left = max(us) if lsign > 0 else min(us)
            out_rows = []
            for n, v, seats in rows:
                nums = []
                for u, _ in seats:
                    nums.append(int(round(abs(u_left - u) / g["pitch"])) + 1)
                out_rows.append({"n": n, "v": v, "seats": [(u, num) for (u, _), num in zip(seats, nums)]})
            out.append({
                "id": name, "axis": g["axis"], "pitch": g["pitch"], "u_axis": u_axis, "v_axis": v_axis,
                "front": f_dir, "fs": fs, "rows": out_rows, "dropped": dropped,
                "row_gap": row_gap, "wall": wall, "inferred": b.get("inferred", False),
                "main": g is groups[main_idx], "tag": tag,
            })
    return out, fpage, groups[main_idx]["pitch"]


def page_point(blk, u, v):
    a = math.radians(blk["axis"])
    # u, v はページ座標を -axis 回したもの。元に戻す
    return (u * math.cos(a) - v * math.sin(a), u * math.sin(a) + v * math.cos(a))


def register(pages, maps):
    """ページごとに、ページ座標→スタジアム座標の変換（回転・縮尺・平行移動）を決める。"""
    lower_front, upper_front = front_lines(maps)
    centers = maps["centers"]

    # 回転と縮尺。座席の最も多いグループの「前」（列に垂直）を、その辺の法線に合わせる。
    # 矢印はページの主な向きを指すだけで、45度回して描かれたブロックもある。
    for pg in pages:
        by_axis = defaultdict(list)
        for b in pg["blocks"]:
            if b["use"]:
                by_axis[b["axis"]].append(b)
        axis = max(by_axis, key=lambda a: sum(x["seats_n"] for x in by_axis[a]))
        grp = by_axis[axis]
        seg = Counter(segment_of(b["id"]) for b in grp).most_common(1)[0][0]
        n = NORMAL[seg]
        f = grp[0]["front"]
        th = math.degrees(math.atan2(n[1], n[0]) - math.atan2(f[1], f[0]))
        pg["theta"] = (th + 180) % 360 - 180
        pg["k"] = SEAT_PITCH / pg["pitch"]
        # ほかのグループと矛盾しないか（45度単位で一致するはず）
        for a, bs in by_axis.items():
            seg2 = Counter(segment_of(b["id"]) for b in bs).most_common(1)[0][0]
            n2 = NORMAL[seg2]
            f2 = bs[0]["front"]
            th2 = math.degrees(math.atan2(n2[1], n2[0]) - math.atan2(f2[1], f2[0]))
            diff = (th2 - pg["theta"] + 180) % 360 - 180
            if abs(diff) > 1:
                print(f"  注意 {pg['tag']}: グループ {a}° の向きが {diff:+.0f}° ずれる {[b['id'] for b in bs]}")

    def to_stadium_lin(pg, p):
        r = _rot2(p, pg["theta"])
        return (r[0] * pg["k"], r[1] * pg["k"])

    # 前面の制約: n·(R k p + t) = c
    for pg in pages:
        eqs = []
        for b in pg["blocks"]:
            if not b["use"]:
                continue
            seg = segment_of(b["id"])
            tier = tier_of(b["id"])
            # 下層の角の斜めのブロックは、角の前面の線から離れた後方にあるので使わない。
            # 上層の角は前面（3・4F図の八角形の斜めの辺）に接している。
            # 上層の西側の小ブロック（S21, N34）は前面の線がない
            if tier == "lower" and not is_straight(seg):
                continue
            if tier == "upper" and seg == "W":
                continue
            row1 = [r for r in b["rows"] if r["n"] == 1]
            if not row1:
                continue
            wall = b["wall"] if b["wall"] is not None else DEFAULT_FRONT_OFFSET / pg["k"]
            pts = [page_point(b, u, row1[0]["v"]) for u, _ in row1[0]["seats"]]
            px = sum(p[0] for p in pts) / len(pts) + b["front"][0] * wall
            py = sum(p[1] for p in pts) / len(pts) + b["front"][1] * wall
            q = to_stadium_lin(pg, (px, py))
            n = NORMAL[seg]
            c = (lower_front if tier == "lower" else upper_front)[seg]
            eqs.append((n, c - (n[0] * q[0] + n[1] * q[1]), seg, b["id"]))
        pg["front_eqs"] = eqs

    # 沿い方向: 直線区間のブロック中心を全体図に合わせる。
    # 上層の全体図は略図なので、スタンドごとに縮尺 a を同時に求める（下層は a≒1 の確認になる）
    groups = defaultdict(list)
    for pi, pg in enumerate(pages):
        for b in pg["blocks"]:
            if not b["use"]:
                continue
            seg = segment_of(b["id"])
            tier = tier_of(b["id"])
            if not is_straight(seg) or b["id"] not in centers[tier]:
                continue
            # 通路やトンネルで欠けた席に引っぱられないよう、席の並ぶ範囲の中央をとる
            us = [u for r in b["rows"] for u, _ in r["seats"]]
            vs = [r["v"] for r in b["rows"]]
            cx, cy = page_point(b, (min(us) + max(us)) / 2, (min(vs) + max(vs)) / 2)
            q = to_stadium_lin(pg, (cx, cy))
            seats = us
            along = (0.0, 1.0) if seg in ("W", "E") else (1.0, 0.0)
            groups[(tier, seg)].append((pi, b["id"], along, along[0] * q[0] + along[1] * q[1],
                                        centers[tier][b["id"]], len(seats)))

    along_fit = {}
    for key, obs in groups.items():
        page_ids = sorted({o[0] for o in obs})
        idx = {p: i for i, p in enumerate(page_ids)}
        # 未知数: a（全体図の縮尺補正）, t_p（ページごとの平行移動の沿い成分）
        # a * m_b - t_p = q_b
        nvar = 1 + len(page_ids)
        ata = [[0.0] * nvar for _ in range(nvar)]
        atb = [0.0] * nvar
        for pi, bid, along, q, m, w in obs:
            row = [0.0] * nvar
            row[0] = m
            row[1 + idx[pi]] = -1.0
            for i in range(nvar):
                atb[i] += row[i] * q
                for j in range(nvar):
                    ata[i][j] += row[i] * row[j]
        if key[0] == "lower":
            # 下層の全体図は縮尺が確かなので a = 1 に固定して残差を見る
            ata[0] = [1.0] + [0.0] * (nvar - 1)
            atb[0] = 1.0
        sol = _solve(ata, atb)
        a = sol[0]
        resid = []
        for pi, bid, along, q, m, w in obs:
            t = sol[1 + idx[pi]]
            resid.append((bid, round(a * m - t - q, 2)))
            pages[pi].setdefault("along_eqs", []).append((along, a * m - q, key[1], bid))
        along_fit[f"{key[0]}-{key[1]}"] = {"scale": round(a, 4), "residuals": resid}

    # 平行移動を最小二乗で
    for pg in pages:
        eqs = pg["front_eqs"] + pg.get("along_eqs", [])
        ata = [[0.0, 0.0], [0.0, 0.0]]
        atb = [0.0, 0.0]
        for n, c, _, _ in eqs:
            for i in range(2):
                atb[i] += n[i] * c
                for j in range(2):
                    ata[i][j] += n[i] * n[j]
        det = ata[0][0] * ata[1][1] - ata[0][1] * ata[1][0]
        if abs(det) < 1e-6:
            raise SystemExit(f"{pg['tag']}: 位置を決める手がかりが足りない {[(e[2], e[3]) for e in eqs]}")
        pg["t"] = _solve(ata, atb)
        pg["resid"] = [(e[3], e[2], round(e[1] - (e[0][0] * pg["t"][0] + e[0][1] * pg["t"][1]), 2)) for e in eqs]

    return along_fit


def _solve(a, b):
    n = len(b)
    m = [row[:] + [b[i]] for i, row in enumerate(a)]
    for c in range(n):
        p = max(range(c, n), key=lambda r: abs(m[r][c]))
        m[c], m[p] = m[p], m[c]
        if abs(m[c][c]) < 1e-12:
            raise SystemExit("連立方程式が解けない")
        for r in range(n):
            if r != c:
                f = m[r][c] / m[c][c]
                for k in range(c, n + 1):
                    m[r][k] -= f * m[c][k]
    return [m[i][n] / m[i][i] for i in range(n)]


def to_stadium(pg, p):
    r = _rot2(p, pg["theta"])
    return (r[0] * pg["k"] + pg["t"][0], r[1] * pg["k"] + pg["t"][1])


# ---------------------------------------------------------------------------
# 高さ
# ---------------------------------------------------------------------------

def lower_height(d):
    """下層: 前面からの奥行き d（m）での床の高さ。傾斜角は 21°→24° に増える。"""
    d = max(d, 0.0)
    a0, a1 = map(math.radians, LOWER_RAKE)
    D = LOWER_DEPTH_FOR_RAKE
    if d <= D:
        # ∫ tan(a0 + (a1-a0) s/D) ds
        k = (a1 - a0) / D
        return FRONT_ROW_FLOOR + (-math.log(math.cos(a0 + k * d)) + math.log(math.cos(a0))) / k
    return lower_height(D) + (d - D) * math.tan(a1)


def upper_height(d_from_row1_front):
    base = lower_height(LOWER_BACK_DEPTH) + UPPER_ABOVE_LOWER_BACK
    return base + max(d_from_row1_front, 0.0) * math.tan(math.radians(UPPER_RAKE))


# ---------------------------------------------------------------------------
# 本体
# ---------------------------------------------------------------------------

PAGE_FILES = ["w1_w17", "e1_e17", "n1_n13", "s1_s13", "e21_e39", "n21_n34", "s21_s34"]


def main(src, dst):
    src = Path(src)
    maps = read_maps(src / "seat_map_202009.pdf")
    lower_front, upper_front = front_lines(maps)

    pages = []
    for f in PAGE_FILES:
        doc = pymupdf.open(src / f"{f}.pdf")
        for pi, page in enumerate(doc):
            tag = f"{f}#{pi + 1}"
            blocks, fpage, pitch = analyse_page(page, tag)
            pages.append({"tag": tag, "blocks": blocks, "front": fpage, "pitch": pitch})

    # ブロックを集め、複数ページに出るものは席の多い方を採る（ページ端の見切れを捨てる）。
    # 位置合わせにも採用する方だけを使う
    chosen = {}
    valid = {"W": (1, 17), "E": (1, 39), "N": (1, 34), "S": (1, 34)}
    for pg in pages:
        # 隣の番号から推定した名前が、存在しない番号（E40 など）になったものは捨てる
        pg["blocks"] = [b for b in pg["blocks"]
                        if valid[b["id"][0]][0] <= int(b["id"][1:]) <= valid[b["id"][0]][1]
                        and not 18 <= int(b["id"][1:]) <= 20]
        for b in pg["blocks"]:
            n = sum(len(r["seats"]) for r in b["rows"])
            b["seats_n"] = n
            b["use"] = False
            if b["id"] not in chosen or n > chosen[b["id"]][0]:
                chosen[b["id"]] = (n, pg, b)
    for n, pg, b in chosen.values():
        b["use"] = True

    along_fit = register(pages, maps)

    # 上層の各辺で、1列目の前端の奥行き（上層の高さの基準）
    blocks_out = []
    report = defaultdict(int)
    for bid in sorted(chosen, key=lambda s: (s[0], int(s[1:]))):
        n_seats, pg, b = chosen[bid]
        seg = segment_of(bid)
        tier = tier_of(bid)
        nrm = NORMAL[seg]
        c = (lower_front if tier == "lower" else upper_front)[seg]
        f_st = _rot2(b["front"], pg["theta"])
        row_depth = b["row_gap"] * pg["k"]
        rows_out = []
        for r in sorted(b["rows"], key=lambda r: r["n"]):
            pts = [(to_stadium(pg, page_point(b, u, r["v"])), num) for u, num in r["seats"]]
            # 席番号 num の位置 = o + (num-1) * step
            nums = [num for _, num in pts]
            if len(pts) >= 2:
                lo = min(pts, key=lambda p: p[1]); hi = max(pts, key=lambda p: p[1])
                step = ((hi[0][0] - lo[0][0]) / (hi[1] - lo[1]), (hi[0][1] - lo[0][1]) / (hi[1] - lo[1]))
            else:
                ua = _rot2(b["u_axis"], pg["theta"])
                step = (ua[0] * SEAT_PITCH, ua[1] * SEAT_PITCH)
            ox = sum(p[0][0] - (p[1] - 1) * step[0] for p in pts) / len(pts)
            oz = sum(p[0][1] - (p[1] - 1) * step[1] for p in pts) / len(pts)
            # 床の高さ（列の前端で評価）
            mx = sum(p[0][0] for p in pts) / len(pts)
            mz = sum(p[0][1] for p in pts) / len(pts)
            d_center = c - (nrm[0] * mx + nrm[1] * mz)
            d_front = d_center - row_depth / 2
            rows_out.append({
                "n": r["n"], "d": d_front, "o": (ox, oz), "step": step,
                "seats": sorted(nums),
            })
        # 高さ
        if tier == "lower":
            for r in rows_out:
                r["h"] = lower_height(r["d"])
        else:
            d1 = min(r["d"] for r in rows_out if r["n"] == min(x["n"] for x in rows_out))
            for r in rows_out:
                r["h"] = upper_height(r["d"] - d1)
        report[(bid[0], tier)] += n_seats
        blocks_out.append({
            "id": bid, "stand": bid[0], "tier": tier, "segment": seg,
            "front": [round(f_st[0], 4), round(f_st[1], 4)],
            "rowDepth": round(row_depth, 3),
            "rows": [{
                "n": r["n"], "h": round(r["h"], 2),
                "o": [round(r["o"][0], 2), round(r["o"][1], 2)],
                "step": [round(r["step"][0], 4), round(r["step"][1], 4)],
                "seats": _ranges(r["seats"]),
            } for r in rows_out],
            "seatCount": n_seats,
            "source": pg["tag"],
            **({"labelInferred": True} if b["inferred"] else {}),
        })

    # S8 は座席図（s1_s13.pdf の2ページ目）で 9〜16番の8席しか描かれていない。
    # 2F の全体図では S6 と同じ幅のブロックで、北側の N6 と N8 も同じ形なので、
    # S7 の中心線について S6 を折り返して補う。
    by_id = {b["id"]: b for b in blocks_out}
    if "S6" in by_id and "S7" in by_id and by_id.get("S8", {}).get("seatCount", 0) < by_id["S6"]["seatCount"]:
        s6, s7 = by_id["S6"], by_id["S7"]
        xs = []
        for r in s7["rows"]:
            lo = r["seats"][0][0]; hi = r["seats"][-1][1]
            xs.append(r["o"][0] + ((lo + hi) / 2 - 1) * r["step"][0])
        xc = sum(xs) / len(xs)
        rows = []
        for r in s6["rows"]:
            last = r["seats"][-1][1]
            ex = r["o"][0] + (last - 1) * r["step"][0]
            ez = r["o"][1] + (last - 1) * r["step"][1]
            rows.append({
                "n": r["n"], "h": r["h"],
                "o": [round(2 * xc - ex, 2), round(ez, 2)],
                "step": [r["step"][0], -r["step"][1]],
                "seats": [[last + 1 - b, last + 1 - a] for a, b in reversed(r["seats"])],
            })
        n6 = s6["seatCount"]
        report[("S", "lower")] += n6 - by_id.get("S8", {}).get("seatCount", 0)
        by_id["S8"] = {**s6, "id": "S8", "rows": rows, "seatCount": n6,
                       "front": [-s6["front"][0], s6["front"][1]], "source": "mirror:S6", "mirroredFrom": "S6"}
        blocks_out = [by_id[k] for k in sorted(by_id, key=lambda s: (s[0], int(s[1:])))]

    # --- 検証の表示
    print("== 席数（座席図から数えた数 / 公開資料の概数）")
    for key, official in OFFICIAL_SEATS.items():
        got = report.get(key, 0)
        print(f"  {key[0]} {key[1]:5s}: {got:5d} / {official:5d}  ({(got - official) / official * 100:+.1f}%)")
    print(f"  合計: {sum(report.values())}")
    print(f"== 上層の縮尺 s2={maps['s2']:.3f} pt/m、上層前面の後退 {maps['upper_setback']:.2f} m")
    for k, v in along_fit.items():
        worst = max(abs(r[1]) for r in v["residuals"])
        print(f"  沿い方向 {k}: 全体図の縮尺補正 {v['scale']}, 残差の最大 {worst} m")
    worst_pages = sorted(((max(abs(r[2]) for r in pg["resid"]) if pg["resid"] else 0, pg["tag"]) for pg in pages), reverse=True)
    print("  ページの位置合わせ残差（最大）:", worst_pages[:5])
    dropped = [(b["id"], b["dropped"]) for pg in pages for b in pg["blocks"] if b["dropped"]]
    print("  列の位置が合わず除いた席（ブロック, 席数）:", dropped)

    out = {
        "meta": {
            "generatedBy": "experiments/stadium-3d/extract/build_layout.py",
            "sources": [
                "サンガスタジアム by KYOCERA 座席案内の座席図（seat_map_202009.pdf、各ブロックのPDF 2026.8.1 更新版）",
                "京都府「京都スタジアム（仮称）インフォメーションパッケージ」平成30年1月 p.15, p.18",
            ],
            "coordinates": "x: 東が正、z: 南が正、h: フィールド面からの高さ（m）。原点はセンタースポット",
            "upperScaleS2": round(maps["s2"], 4),
            "upperSetback": round(maps["upper_setback"], 2),
            "alongFit": {k: v["scale"] for k, v in along_fit.items()},
        },
        "constants": {
            "seatPitch": SEAT_PITCH, "frontRowFloor": FRONT_ROW_FLOOR,
            "lowerRake": LOWER_RAKE, "upperRake": UPPER_RAKE, "roofOverhang": ROOF_OVERHANG,
            "pitch": PITCH, "frontDistance": FRONT_DIST,
        },
        "assumptions": {
            "lowerDepthForRake": LOWER_DEPTH_FOR_RAKE,
            "upperAboveLowerBack": UPPER_ABOVE_LOWER_BACK,
            "lowerBackDepth": LOWER_BACK_DEPTH,
            "defaultFrontOffset": DEFAULT_FRONT_OFFSET,
        },
        "field": maps["field"],
        "frontLines": {
            "lower": {k: round(v, 3) for k, v in lower_front.items()},
            "upper": {k: round(v, 3) for k, v in upper_front.items()},
        },
        "outline": {
            "lower": {k: [[round(x, 2), round(z, 2)] for x, z in v] for k, v in maps["lower"].items()},
            "upper": {k: [[[round(x, 2), round(z, 2)] for x, z in poly] for poly in v] for k, v in maps["upper"].items()},
            "upperFront": [[round(x, 2), round(z, 2)] for x, z in maps["upper_front"]],
            "concourse2F": [[round(x, 2), round(z, 2)] for x, z in maps["outer_2f"]],
            "deck2F": [[round(x, 2), round(z, 2)] for x, z in maps["deck_2f"]],
            "outerUpper": [[round(x, 2), round(z, 2)] for x, z in maps["outer_upper"]],
            "westBuilding": [[[round(x, 2), round(z, 2)] for x, z in poly] for poly in maps["vip"]],
        },
        "blocks": blocks_out,
    }
    Path(dst).write_text(_dump(out), encoding="utf-8")
    print(f"→ {dst}（{Path(dst).stat().st_size // 1024} KB、ブロック {len(blocks_out)}）")


def _dump(out):
    # 差分を読めるように、上位の項目とブロックを1行ずつにする
    compact = lambda v: json.dumps(v, ensure_ascii=False, separators=(",", ":"))
    lines = []
    for key, value in out.items():
        if key == "blocks":
            body = ",\n".join("    " + compact(b) for b in value)
            lines.append(f'  "{key}": [\n{body}\n  ]')
        else:
            lines.append(f'  "{key}": {compact(value)}')
    return "{\n" + ",\n".join(lines) + "\n}\n"


def _ranges(nums):
    nums = sorted(set(nums))
    out = []
    for n in nums:
        if out and out[-1][1] == n - 1:
            out[-1][1] = n
        else:
            out.append([n, n])
    return out


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    main(sys.argv[1], sys.argv[2])
