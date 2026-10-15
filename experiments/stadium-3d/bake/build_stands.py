"""layout.json から、焼き付け用の段床（踏み面と蹴上げだけの階段状の面）を Blender に作る。

ブラウザ版（stadium-model.js）は、列ごとに「床から列の高さまでの箱」を重ねて段床を作る。
箱は隠れた面が多く、陰影を焼くと画像のほとんどが見えない面に使われてしまう。
ここでは見える面だけ（踏み面・蹴上げ・ブロックの横・通路の階段・上層の軒裏）を作る。

座標は three.js と同じ（x 東、y 上、z 南）で作り、最後に glTF の向きに合わせる。
bake_ao.py から import して使う。
"""

import json
import math

import bpy

AISLE = 0.55        # 通路の階段の幅（stadium-model.js の LOOK.aisleHalf と同じ）
UPPER_SLAB = 0.55   # 上層の段床の厚み（LOOK.upperSlab と同じ）

TONE = {             # stadium-model.js の TERRACE_TONE / STEP_TONE / NOSING_TONE と同じ色
    "tread": "#b2afb4", "riser": "#77747b", "side": "#8c8990", "soffit": "#5f5c63",
    "step": "#c6c3c8", "step_riser": "#8a878e", "nosing": "#e0bd3c",
}


def _srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _rgba(hexstr):
    h = hexstr.lstrip("#")
    return tuple(_srgb_to_linear(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4)) + (1.0,)


def _seat_pos(row, n):
    return (row["o"][0] + (n - 1) * row["step"][0], row["o"][1] + (n - 1) * row["step"][1])


def _seat_numbers(row):
    out = []
    for a, b in row["seats"]:
        out.extend(range(a, b + 1))
    return out


class Builder:
    """three.js の座標 (x, y, z) で四角形を積み、Blender のメッシュにする。"""

    def __init__(self, name):
        self.name = name
        self.verts = []
        self.faces = []
        self.colors = []

    def quad(self, p0, p1, p2, p3, tone, normal):
        """normal: 面が向くべき向き（three.js の座標）。頂点の回り順が逆なら並べ替える。"""
        e1 = [p1[i] - p0[i] for i in range(3)]
        e2 = [p2[i] - p0[i] for i in range(3)]
        n = (e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0])
        pts = (p0, p1, p2, p3) if sum(n[i] * normal[i] for i in range(3)) >= 0 else (p3, p2, p1, p0)
        base = len(self.verts)
        # three.js（y 上、z 南）→ Blender（z 上、y 北）: (x, y, z) → (x, -z, y)。回転なので向きは保たれる
        for p in pts:
            self.verts.append((p[0], -p[2], p[1]))
        self.faces.append((base, base + 1, base + 2, base + 3))
        self.colors.append(_rgba(TONE[tone]))

    def box_faces(self, center, along, front, length, depth, y0, y1, tones, skip=()):
        """向き付きの箱の、見える面だけ（skip で省く面: top/bottom/front/back/left/right）。"""
        if y1 - y0 < 1e-3:
            return
        hx, hz = length / 2, depth / 2

        def c(sa, sf, y):
            return (center[0] + along[0] * hx * sa + front[0] * hz * sf, y,
                    center[1] + along[1] * hx * sa + front[1] * hz * sf)

        F = (front[0], 0, front[1])
        A = (along[0], 0, along[1])
        faces = {
            "top": ((c(-1, -1, y1), c(1, -1, y1), c(1, 1, y1), c(-1, 1, y1)), (0, 1, 0)),
            "bottom": ((c(-1, 1, y0), c(1, 1, y0), c(1, -1, y0), c(-1, -1, y0)), (0, -1, 0)),
            "front": ((c(-1, 1, y0), c(1, 1, y0), c(1, 1, y1), c(-1, 1, y1)), F),
            "back": ((c(1, -1, y0), c(-1, -1, y0), c(-1, -1, y1), c(1, -1, y1)), tuple(-v for v in F)),
            "right": ((c(1, 1, y0), c(1, -1, y0), c(1, -1, y1), c(1, 1, y1)), A),
            "left": ((c(-1, -1, y0), c(-1, 1, y0), c(-1, 1, y1), c(-1, -1, y1)), tuple(-v for v in A)),
        }
        for key, (pts, n) in faces.items():
            if key in skip:
                continue
            self.quad(*pts, tones.get(key, tones["side"]), n)

    def to_object(self, collection):
        me = bpy.data.meshes.new(self.name)
        me.from_pydata(self.verts, [], self.faces)
        me.update()
        attr = me.color_attributes.new("Color", "BYTE_COLOR", "CORNER")
        for poly in me.polygons:
            col = self.colors[poly.index]
            for li in poly.loop_indices:
                attr.data[li].color = col
        obj = bpy.data.objects.new(self.name, me)
        collection.objects.link(obj)
        return obj


def build(layout_path, collection):
    layout = json.load(open(layout_path, encoding="utf-8"))
    lower = Builder("stands-lower")
    upper = Builder("stands-upper")
    slab = {"top": "tread", "front": "riser", "back": "riser", "side": "side", "bottom": "soffit"}
    nosing = {"top": "nosing", "front": "nosing", "side": "nosing"}

    for b in layout["blocks"]:
        f = b["front"]
        depth = b["rowDepth"]
        is_lower = b["tier"] == "lower"
        out = lower if is_lower else upper
        rows = sorted(b["rows"], key=lambda r: r["n"])
        prev_h = None
        for ri, r in enumerate(rows):
            nums = _seat_numbers(r)
            step_len = math.hypot(*r["step"])
            al = (r["step"][0] / step_len, r["step"][1] / step_len)
            first = _seat_pos(r, nums[0])
            last = _seat_pos(r, nums[-1])
            length = math.dist(first, last) + step_len
            mid = ((first[0] + last[0]) / 2, (first[1] + last[1]) / 2)
            h = r["h"]
            below = prev_h if prev_h is not None else (0.0 if is_lower else h - UPPER_SLAB)

            def p(center, sa, sf, y, half_len, half_dep):
                return (center[0] + al[0] * half_len * sa + f[0] * half_dep * sf, y,
                        center[1] + al[1] * half_len * sa + f[1] * half_dep * sf)

            L, D = length / 2, depth / 2
            UP, DOWN = (0, 1, 0), (0, -1, 0)
            FWD, BACK = (f[0], 0, f[1]), (-f[0], 0, -f[1])
            if is_lower:
                # 踏み面と、前の列からの蹴上げ。横は通路の階段に、下は前の列に隠れる
                out.quad(p(mid, -1, -1, h, L, D), p(mid, 1, -1, h, L, D), p(mid, 1, 1, h, L, D), p(mid, -1, 1, h, L, D), "tread", UP)
                out.quad(p(mid, -1, 1, below, L, D), p(mid, 1, 1, below, L, D), p(mid, 1, 1, h, L, D), p(mid, -1, 1, h, L, D), "riser", FWD)
                if ri == len(rows) - 1:
                    out.quad(p(mid, 1, -1, 0, L, D), p(mid, -1, -1, 0, L, D), p(mid, -1, -1, h, L, D), p(mid, 1, -1, h, L, D), "riser", BACK)
            else:
                # 上層は厚み 0.55m の板。軒裏（下の面）も見える
                out.box_faces(mid, al, f, length, depth, h - UPPER_SLAB, h, slab, skip=("left", "right"))

            # 通路の階段: 奥半分は列の高さ、手前半分は前の列との中間の高さ。段の縁は黄色
            half = ((prev_h if prev_h is not None else h - 0.3) + h) / 2
            for end, sgn in ((first, -1), (last, 1)):
                o = step_len / 2 + AISLE / 2
                c = (end[0] + al[0] * sgn * o, end[1] + al[1] * sgn * o)
                w = AISLE / 2
                back = (c[0] - f[0] * depth / 4, c[1] - f[1] * depth / 4)
                fore = (c[0] + f[0] * depth / 4, c[1] + f[1] * depth / 4)
                q = depth / 4
                base_b = 0.0 if is_lower else h - UPPER_SLAB
                base_f = 0.0 if is_lower else half - UPPER_SLAB
                # 奥半分の上面と、手前半分との段差
                out.quad(p(back, -1, -1, h, w, q), p(back, 1, -1, h, w, q), p(back, 1, 1, h, w, q), p(back, -1, 1, h, w, q), "step", UP)
                out.quad(p(back, -1, 1, half, w, q), p(back, 1, 1, half, w, q), p(back, 1, 1, h, w, q), p(back, -1, 1, h, w, q), "step_riser", FWD)
                # 手前半分の上面と、前の列からの段差
                out.quad(p(fore, -1, -1, half, w, q), p(fore, 1, -1, half, w, q), p(fore, 1, 1, half, w, q), p(fore, -1, 1, half, w, q), "step", UP)
                out.quad(p(fore, -1, 1, below, w, q), p(fore, 1, 1, below, w, q), p(fore, 1, 1, half, w, q), p(fore, -1, 1, half, w, q), "step_riser", FWD)
                # 通路側の横の面（隣のブロックと接しないところでは見える）
                sa = sgn
                SIDE = (al[0] * sgn, 0, al[1] * sgn)
                out.quad(p(back, sa, 1, base_b, w, q), p(back, sa, -1, base_b, w, q), p(back, sa, -1, h, w, q), p(back, sa, 1, h, w, q), "side", SIDE)
                out.quad(p(fore, sa, 1, base_f, w, q), p(fore, sa, -1, base_f, w, q), p(fore, sa, -1, half, w, q), p(fore, sa, 1, half, w, q), "side", SIDE)
                if not is_lower:
                    out.quad(p(back, -1, 1, base_b, w, q), p(back, 1, 1, base_b, w, q), p(back, 1, -1, base_b, w, q), p(back, -1, -1, base_b, w, q), "soffit", DOWN)
                    out.quad(p(fore, -1, 1, base_f, w, q), p(fore, 1, 1, base_f, w, q), p(fore, 1, -1, base_f, w, q), p(fore, -1, -1, base_f, w, q), "soffit", DOWN)
                edge = (c[0] + f[0] * (depth / 2 - 0.03), c[1] + f[1] * (depth / 2 - 0.03))
                out.box_faces(edge, al, f, AISLE, 0.06, half - 0.03, half + 0.004, nosing, skip=("bottom", "back"))
            prev_h = h
    return lower.to_object(collection), upper.to_object(collection)
