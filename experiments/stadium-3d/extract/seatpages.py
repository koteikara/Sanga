"""ブロック別座席図（PDF）から、ブロックごとの列と座席を取り出す。

座席図は CAD 由来のベクターで、1席が小さな四角形（斜めのブロックは回転した四角形）
として描かれている。ここでは四角形を拾い、向きごとに分けてから、
「列」（行方向のまとまり）と「ブロック」（通路で区切られたまとまり）に分ける。

座標はページの pt のまま返す。スタジアム座標への変換は build_layout.py で行う。
"""

import math
import re
from collections import Counter, defaultdict

import pymupdf

LABEL_RE = re.compile(r"[WENS]\d+")


def _seat_size(page):
    """そのページで最も多い座席の大きさ（短辺, 長辺）を推定する。"""
    sizes = Counter()
    for d in page.get_drawings():
        items = d["items"]
        if len(items) != 1 or items[0][0] != "re":
            continue
        r = items[0][1]
        a, b = sorted((round(r.width, 1), round(r.height, 1)))
        if 6 <= a <= 14 and 1.05 <= b / a <= 1.5:
            sizes[(a, b)] += 1
    (a, b), _ = sizes.most_common(1)[0]
    return a, b


def extract_seats(page):
    """座席を (cx, cy, angle_deg) で返す。angle は座席の幅方向（列の方向）の角度。"""
    short, long_ = _seat_size(page)
    tol = 0.12
    out = []
    for d in page.get_drawings():
        items = d["items"]
        if len(items) != 1:
            continue
        kind = items[0][0]
        if kind == "re":
            r = items[0][1]
            w, h = r.width, r.height
            if abs(w - short) / short < tol and abs(h - long_) / long_ < tol:
                out.append(((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, 0.0))
            elif abs(h - short) / short < tol and abs(w - long_) / long_ < tol:
                out.append(((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, 90.0))
        elif kind == "qu":
            q = items[0][1]
            w = math.dist((q.ul.x, q.ul.y), (q.ur.x, q.ur.y))
            h = math.dist((q.ul.x, q.ul.y), (q.ll.x, q.ll.y))
            if abs(w - short) / short < tol and abs(h - long_) / long_ < tol:
                ang = math.degrees(math.atan2(q.ur.y - q.ul.y, q.ur.x - q.ul.x))
            elif abs(h - short) / short < tol and abs(w - long_) / long_ < tol:
                ang = math.degrees(math.atan2(q.ll.y - q.ul.y, q.ll.x - q.ul.x))
            else:
                continue
            cx = (q.ul.x + q.lr.x) / 2
            cy = (q.ul.y + q.lr.y) / 2
            out.append((cx, cy, ang))
    return out, (short, long_)


def _axis(angle):
    """列方向の角度を 0〜180 未満に正規化し、45 度刻みに丸める。"""
    a = angle % 180.0
    return round(a / 45.0) * 45 % 180


def _rot(x, y, deg):
    t = math.radians(-deg)
    c, s = math.cos(t), math.sin(t)
    return x * c - y * s, x * s + y * c


def _cluster_1d(values, gap):
    """ソートした値を gap より大きい隙間で区切る。"""
    order = sorted(range(len(values)), key=lambda i: values[i])
    groups, cur = [], [order[0]]
    for a, b in zip(order, order[1:]):
        if values[b] - values[a] > gap:
            groups.append(cur)
            cur = []
        cur.append(b)
    groups.append(cur)
    return groups


def extract_page(page):
    seats, (short, long_) = extract_seats(page)
    words = page.get_text("words")
    labels = {
        w[4]: ((w[0] + w[2]) / 2, (w[1] + w[3]) / 2)
        for w in words if LABEL_RE.fullmatch(w[4])
    }

    by_axis = defaultdict(list)
    for x, y, a in seats:
        by_axis[_axis(a)].append((x, y))

    groups = []
    for axis, pts in by_axis.items():
        local = [_rot(x, y, axis) for x, y in pts]
        us = [p[0] for p in local]
        vs = [p[1] for p in local]

        # 列: v 方向の隙間で区切る。ベンチ（W8・W10 の前）は一般席の列と数 pt しか
        # ずれていないので、区切りは座席の奥行きの 3 割と細かめにとる
        row_groups = _cluster_1d(vs, long_ * 0.3)
        rows = []
        for g in row_groups:
            v = sum(vs[i] for i in g) / len(g)
            rows.append((v, sorted(g, key=lambda i: us[i])))
        rows.sort()

        # 席の間隔（同じ列の隣り合う席の距離の最頻値）
        diffs = Counter()
        for _, g in rows:
            for a, b in zip(g, g[1:]):
                d = us[b] - us[a]
                if d < short * 2.2:
                    diffs[round(d, 1)] += 1
        pitch = diffs.most_common(1)[0][0] if diffs else short * 1.1

        # 一般席と間隔の違う並び（チームベンチなど）を除く。
        # 3席以上続く並びで、間隔の中央値が一般席から 18% 以上ずれていれば外す。
        # ベンチは +23%。角の三角形のブロックは席の間隔が少し広く +6〜13% ある。
        kept_rows = []
        for v, g in rows:
            runs, cur = [], [g[0]]
            for a, b in zip(g, g[1:]):
                if us[b] - us[a] < pitch * 1.6:
                    cur.append(b)
                else:
                    runs.append(cur)
                    cur = [b]
            runs.append(cur)
            keep = []
            for run in runs:
                if len(run) >= 3:
                    gaps = sorted(us[b] - us[a] for a, b in zip(run, run[1:]))
                    med = gaps[len(gaps) // 2]
                    if abs(med - pitch) / pitch > 0.18:
                        continue
                keep.extend(run)
            if keep:
                kept_rows.append((sum(vs[i] for i in keep) / len(keep), keep))
        rows = kept_rows
        used = {i for _, g in rows for i in g}
        us_all = us
        us = [u if i in used else None for i, u in enumerate(us_all)]

        # ブロック: すべての列にわたって空いている u の帯（通路）で区切る
        valid = [u for u in us if u is not None]
        lo = min(valid) - pitch
        hi = max(valid) + pitch
        step = pitch / 8
        n = int((hi - lo) / step) + 1
        cover = [0] * n
        for u in valid:
            a = int((u - pitch * 0.55 - lo) / step)
            b = int((u + pitch * 0.55 - lo) / step)
            for k in range(max(a, 0), min(b + 1, n)):
                cover[k] += 1
        bands, start = [], None
        for k, c in enumerate(cover + [0]):
            if c and start is None:
                start = k
            elif not c and start is not None:
                bands.append((lo + start * step, lo + k * step))
                start = None

        # 1〜2席分の欠け（車いす席・カメラ位置など）は通路ではない。
        # ブロック間の通路は席の間隔の2倍を超えるので、それより狭い隙間はつなぐ。
        merged = [bands[0]]
        for a, b in bands[1:]:
            if a - merged[-1][1] < pitch * 1.7:
                merged[-1] = (merged[-1][0], b)
            else:
                merged.append((a, b))
        bands = merged

        groups.append({
            "axis": axis,
            "pitch": pitch,
            "short": short,
            "long": long_,
            "rows": [(v, [(us[i], vs[i]) for i in g]) for v, g in rows],
            "bands": bands,
            "labels": {k: _rot(x, y, axis) for k, (x, y) in labels.items()},
        })
    return groups, labels


def assign_blocks(group, taken=None):
    """帯（通路で区切ったまとまり）にラベルを割り当て、ブロックの列と席を返す。

    ラベルは帯の前（または後ろ）に置かれている。u 方向の距離に、v 方向（列から
    どれだけ離れているか）を少し足した値が小さい組から順に、1対1で割り当てる。
    三角形のブロック（W3 など）は斜めのブロックのラベルとも u が重なるので、
    v も見ないと取り違える。

    taken を渡すと、ページの別のグループですでに使ったラベルは使わない。
    ラベルの付かない帯は呼び出し側で隣の番号から推定する。
    """
    return {name: b for name, b, _ in candidate_blocks(group) if taken is None or name not in taken}


def candidate_pairs(group):
    """（得点, 帯の番号, ラベル）の候補をすべて返す。得点が小さいほど確か。"""
    bands = group["bands"]
    labels = group["labels"]
    band_rows = []
    for a, b in bands:
        rows = []
        for v, seats in group["rows"]:
            sel = [s for s in seats if a <= s[0] <= b]
            if sel:
                rows.append((v, sel))
        band_rows.append(rows)
    pairs = []
    for i, (a, b) in enumerate(bands):
        if not band_rows[i]:
            continue
        vs = [v for v, _ in band_rows[i]]
        for name, (lu, lv) in labels.items():
            du = 0.0 if a <= lu <= b else min(abs(lu - a), abs(lu - b))
            if du > (b - a) * 0.6:
                continue
            dv = 0.0 if min(vs) <= lv <= max(vs) else min(abs(lv - min(vs)), abs(lv - max(vs)))
            pairs.append((du + 0.3 * dv, i, name))
    return pairs, band_rows


def candidate_blocks(group):
    pairs, band_rows = candidate_pairs(group)
    pairs.sort()
    tb, tl, out = set(), set(), []
    for score, i, name in pairs:
        if i in tb or name in tl:
            continue
        tb.add(i); tl.add(name)
        out.append((name, {"band": group["bands"][i], "rows": band_rows[i], "label_v": None}, score))
    return out


def assign_page(groups):
    """ページのすべてのグループをまとめて、ラベルを1対1で割り当てる。"""
    allp = []
    rows_by_group = []
    for gi, g in enumerate(groups):
        pairs, band_rows = candidate_pairs(g)
        rows_by_group.append(band_rows)
        allp += [(score, gi, i, name) for score, i, name in pairs]
    allp.sort()
    tb, tl = set(), set()
    result = [dict() for _ in groups]
    for score, gi, i, name in allp:
        if (gi, i) in tb or name in tl:
            continue
        tb.add((gi, i)); tl.add(name)
        result[gi][name] = {"band": groups[gi]["bands"][i], "rows": rows_by_group[gi][i], "label_v": None}
    return result


def find_front_arrow(page):
    """「前」の矢印（単線の矢印形）を探し、先端の位置と向き（単位ベクトル）を返す。

    矢印は線分7本で描かれている。長さの等しい2本の斜線が先端で交わり、
    その先端角が 60〜130 度になる組を矢印とみなす。
    """
    segs = []
    for d in page.get_drawings():
        if d["type"] != "s":
            continue
        for it in d["items"]:
            if it[0] == "l":
                segs.append(((it[1].x, it[1].y), (it[2].x, it[2].y)))
    found = None
    for i, (a1, b1) in enumerate(segs):
        l1 = math.dist(a1, b1)
        if not 25 < l1 < 40:
            continue
        for a2, b2 in segs[i + 1:]:
            l2 = math.dist(a2, b2)
            if abs(l1 - l2) > 0.5:
                continue
            for p, o1 in ((a1, b1), (b1, a1)):
                for q, o2 in ((a2, b2), (b2, a2)):
                    if math.dist(p, q) > 0.3:
                        continue
                    v1 = (o1[0] - p[0], o1[1] - p[1])
                    v2 = (o2[0] - p[0], o2[1] - p[1])
                    cos = (v1[0] * v2[0] + v1[1] * v2[1]) / (l1 * l2)
                    ang = math.degrees(math.acos(max(-1.0, min(1.0, cos))))
                    if 60 < ang < 130 and math.dist(o1, o2) > 20:
                        mid = ((o1[0] + o2[0]) / 2, (o1[1] + o2[1]) / 2)
                        dx, dy = p[0] - mid[0], p[1] - mid[1]
                        n = math.hypot(dx, dy)
                        found = (p, (dx / n, dy / n))
    return found


def front_wall_offset(page, group, front_sign):
    """1列目の座席中心から、スタンド前面の線までの距離（pt）。

    列と平行で、ブロック幅より長い線のうち、1列目の前方3列分以内で最も近いもの。
    見つからなければ None。
    """
    axis = group["axis"]
    rows = group["rows"]
    if not rows:
        return None
    v1 = rows[-1][0] if front_sign > 0 else rows[0][0]
    us = [u for _, seats in rows for u, _ in seats]
    span = max(us) - min(us)
    best = None
    for d in page.get_drawings():
        for it in d["items"]:
            if it[0] == "l":
                a = _rot(it[1].x, it[1].y, axis)
                b = _rot(it[2].x, it[2].y, axis)
            elif it[0] == "re":
                r = it[1]
                if min(r.width, r.height) > 1.5:
                    continue
                a = _rot(r.x0, (r.y0 + r.y1) / 2, axis) if r.width > r.height else None
                b = _rot(r.x1, (r.y0 + r.y1) / 2, axis) if r.width > r.height else None
                if a is None:
                    continue
            else:
                continue
            if abs(a[1] - b[1]) > 0.5 or abs(a[0] - b[0]) < span * 0.3:
                continue
            dv = (a[1] - v1) * front_sign
            if 0.5 < dv < group["long"] * 4 and (best is None or dv < best):
                best = dv
    return best
