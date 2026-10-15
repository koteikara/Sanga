"""座席ビューの構造物に、陰影（アンビエントオクルージョン）を焼き付ける。

export-scene.mjs で書き出した GLB を Blender で読み、主な部品ごとに陰影用の UV
（2つ目の UV）を展開して、Cycles で AO（物の陰になる所ほど暗くなる陰影）を焼く。
焼いた画像は glTF の遮蔽テクスチャ（occlusionTexture）として付け、焼いた部品だけを
GLB に書き出す（Draco が使える Blender なら形を圧縮する）。three.js では aoMap になり、
空からの光（環境光）だけを暗くする。

段床だけは、書き出した箱の重なり（隠れた面が多い）を使わず、layout.json から
見える面だけで作り直す（build_stands.py）。

使い方（Blender 4.2 の Python。pip の bpy でも Blender 本体の --python でもよい）:
    python bake_ao.py <入力.glb> <layout.json> <出力.glb> [--quick]

--quick は解像度とサンプル数を下げた試し焼き。
このリポジトリの依存ではない。生成物の GLB だけをコミットする。
"""

import math
import os
import sys
import time

import bpy

args = [a for a in sys.argv[sys.argv.index("--") + 1:]] if "--" in sys.argv else sys.argv[1:]
QUICK = "--quick" in args
args = [a for a in args if not a.startswith("--")]
SRC, LAYOUT, DST = args[0], args[1], args[2]
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_stands  # noqa: E402
WORK = os.path.join(os.path.dirname(os.path.abspath(DST)), "bake-images")
os.makedirs(WORK, exist_ok=True)

# 焼く部品と画像の大きさ。名前は export-scene.mjs が付けた「グループ名-番号」と、
# build_stands.py が作る段床
#   stands-lower / stands-upper: 下層・上層の段床（作り直したもの）、terraces-2: 前面の壁
#   roof-0: 屋根（金属板）、building-0: 建物と外壁
#   field-1〜3: スタジアムの床・人工芝帯・天然芝（field-0 の周囲の平地は焼かない）
TARGETS = {
    "stands-lower": 4096, "stands-upper": 2048, "terraces-2": 1024,
    "roof-0": 2048, "building-0": 2048,
    "field-1": 2048, "field-2": 1024, "field-3": 1024,
}
SAMPLES = 64
AO_DISTANCE = 6.0   # m。これより遠くの物は陰に数えない

if QUICK:
    TARGETS = {k: max(256, v // 4) for k, v in TARGETS.items()}
    SAMPLES = 8


def log(msg):
    print(f"[bake {time.strftime('%H:%M:%S')}] {msg}", flush=True)


def ensure_output_group():
    """glTF の書き出しが遮蔽テクスチャとして読む「glTF Material Output」ノードグループ。"""
    name = "glTF Material Output"
    if name in bpy.data.node_groups:
        return bpy.data.node_groups[name]
    g = bpy.data.node_groups.new(name, "ShaderNodeTree")
    g.interface.new_socket("Occlusion", in_out="INPUT", socket_type="NodeSocketFloat")
    g.nodes.new("NodeGroupInput")
    return g


def unwrap(obj):
    me = obj.data
    if "lightmap" not in me.uv_layers:
        me.uv_layers.new(name="lightmap")
    me.uv_layers.active = me.uv_layers["lightmap"]
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    # 面ごとに画像の区画を割り当てるライトマップ用の詰め方（段床は小さな面が多いので無駄が少ない）
    bpy.ops.uv.lightmap_pack(PREF_CONTEXT="ALL_FACES", PREF_PACK_IN_ONE=True, PREF_NEW_UVLAYER=False,
                             PREF_BOX_DIV=12, PREF_MARGIN_DIV=0.3)
    bpy.ops.object.mode_set(mode="OBJECT")
    # 元の UV（模様用）を1つ目に戻す。glTF では 1つ目が TEXCOORD_0、2つ目が TEXCOORD_1
    me.uv_layers.active = me.uv_layers[0]
    me.uv_layers[0].active_render = True


def bake(obj, size):
    # 材質は部品ごとに別にする（同じ材質を共有していると、焼いた画像がぶつかる）
    for slot in obj.material_slots:
        if slot.material and slot.material.users > 1:
            slot.material = slot.material.copy()
    img = bpy.data.images.new(f"ao-{obj.name}", size, size, alpha=False, float_buffer=False)
    img.colorspace_settings.name = "Non-Color"
    nodes_made = []
    for slot in obj.material_slots:
        mat = slot.material
        mat.use_nodes = True
        nt = mat.node_tree
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = img
        uvn = nt.nodes.new("ShaderNodeUVMap")
        uvn.uv_map = "lightmap"
        nt.links.new(uvn.outputs["UV"], tex.inputs["Vector"])
        nt.nodes.active = tex
        nodes_made.append((mat, tex))
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    # 焼き付けは「選択中の UV」に書くので、焼く間だけ陰影用の UV にする
    me = obj.data
    me.uv_layers.active = me.uv_layers["lightmap"]
    t0 = time.time()
    bpy.ops.object.bake(type="AO", margin=4, use_clear=True)
    me.uv_layers.active = me.uv_layers[0]
    log(f"{obj.name}: {size}px を {time.time() - t0:.0f} 秒で焼いた")
    path = os.path.join(WORK, f"ao-{obj.name}.jpg")
    img.filepath_raw = path
    img.file_format = "JPEG"
    img.save()
    # 遮蔽テクスチャとしてつなぐ
    group = ensure_output_group()
    for mat, tex in nodes_made:
        nt = mat.node_tree
        sep = nt.nodes.new("ShaderNodeSeparateColor")
        nt.links.new(tex.outputs["Color"], sep.inputs["Color"])
        out = nt.nodes.new("ShaderNodeGroup")
        out.node_tree = group
        nt.links.new(sep.outputs["Red"], out.inputs["Occlusion"])


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=SRC)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = SAMPLES
    if scene.world is None:
        scene.world = bpy.data.worlds.new("World")
    scene.world.light_settings.distance = AO_DISTANCE

    # 書き出した箱の段床（terraces-0: 下層、terraces-1: 上層）を、見える面だけの段床に置き換える
    parent = bpy.data.objects.get("terraces")
    for name in ("terraces-0", "terraces-1"):
        if name in bpy.data.objects:
            bpy.data.objects.remove(bpy.data.objects[name], do_unlink=True)
    stands = build_stands.build(LAYOUT, bpy.context.scene.collection)
    mat = bpy.data.materials.new("stands")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.92
    col = nt.nodes.new("ShaderNodeVertexColor")
    col.layer_name = "Color"
    nt.links.new(col.outputs["Color"], bsdf.inputs["Base Color"])
    for obj in stands:
        obj.data.materials.append(mat)
        if parent is not None:
            obj.parent = parent
            obj.matrix_parent_inverse = parent.matrix_world.inverted()
        # 模様用の1つ目の UV も用意しておく（glTF で TEXCOORD_0 を空けないため）
        obj.data.uv_layers.new(name="UVMap")
        log(f"{obj.name}: 面 {len(obj.data.polygons)} を作った")

    objs = {o.name: o for o in bpy.data.objects if o.type == "MESH"}
    for name, size in TARGETS.items():
        obj = objs.get(name)
        if obj is None:
            log(f"{name} が見つからない（飛ばす）")
            continue
        log(f"{name}: 面 {len(obj.data.polygons)}、UV を展開")
        unwrap(obj)
        bake(obj, size)

    # 書き出すのは焼いた部品だけ（ほかはブラウザ版のものをそのまま使う）
    for o in list(bpy.data.objects):
        if o.type == "MESH" and o.name not in TARGETS:
            bpy.data.objects.remove(o, do_unlink=True)

    log("書き出し")
    bpy.ops.export_scene.gltf(
        filepath=DST,
        export_format="GLB",
        export_image_format="AUTO",
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_vertex_color="ACTIVE",
        export_cameras=False,
        export_lights=False,
    )
    log(f"→ {DST}（{os.path.getsize(DST) // 1024} KB）")


main()
