// サンガスタジアム 3D モデルの組み立て
//
// layout.json（公式の座席図から extract/build_layout.py で作ったもの）を受け取り、
// 段床・座席・上層の張り出し・屋根・建物・ピッチを three.js のオブジェクトにする。
//
// 座標: x 東が正、y 上、z 南が正（北は -z）。原点はセンタースポット。単位 m。

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// 資料に数値がない部分の見た目の値（README「モデルの根拠と仮定」と合わせる）
const LOOK = {
  aisleHalf: 0.55,          // ブロック間の通路の半幅（通路の階段の幅）
  upperSlab: 0.55,          // 上層の段床の厚み（下から見える段々の天井）
  roofFrontAboveTop: 5.0,   // 屋根の内側の端の下面が、上層最上列の床からどれだけ上か（断面図の比率）
  roofOuterAboveTop: 2.0,   // 屋根の外側の端の下面
  roofDepth: 1.8,           // 屋根トラスのせい
  eyeHeight: 1.15,          // 着席時の目の高さ（床から）
  screenWidth: 10.0,        // 大型映像装置（推定）
  screenHeight: 5.6
};

export const EYE_HEIGHT = LOOK.eyeHeight;

const STAND_NAME = {
  W: "メインスタンド（西）",
  E: "バックスタンド（東）",
  N: "北サイドスタンド",
  S: "南サイドスタンド"
};

export function standName(stand) {
  return STAND_NAME[stand];
}

// ---------------------------------------------------------------------------
// 共通の小物
// ---------------------------------------------------------------------------

// 向き付きの直方体を、頂点配列に積む（たくさん作って最後に1つのメッシュにする）
class BoxBatch {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.idx = [];
    this.col = [];
    this.uv = [];
  }

  // 面の向きに合わせて、世界座標から UV を作る（2m で1回り）
  pushUv(p, n) {
    if (Math.abs(n[1]) > 0.7) this.uv.push(p[0] / 2, p[2] / 2);
    else this.uv.push((p[0] * -n[2] + p[2] * n[0]) / 2, p[1] / 2);
  }

  // center: [x, z], along/front: 水平の単位ベクトル [x, z]
  // tone: 面ごとの色 { top, front, side, bottom }（[r, g, b]）。省略すると白（材質の色のまま）
  add(center, along, front, length, depth, y0, y1, tone = null) {
    if (y1 - y0 < 1e-3) return;
    const hx = length / 2;
    const hz = depth / 2;
    const a = [along[0] * hx, along[1] * hx];
    const f = [front[0] * hz, front[1] * hz];
    const c = center;
    const corner = (sa, sf, y) => [c[0] + a[0] * sa + f[0] * sf, y, c[1] + a[1] * sa + f[1] * sf];
    const faces = [
      // [法線, 4頂点（外から見て反時計回り）]
      [[0, 1, 0], [corner(-1, 1, y1), corner(1, 1, y1), corner(1, -1, y1), corner(-1, -1, y1)]],
      [[0, -1, 0], [corner(-1, -1, y0), corner(1, -1, y0), corner(1, 1, y0), corner(-1, 1, y0)]],
      [[front[0], 0, front[1]], [corner(-1, 1, y0), corner(1, 1, y0), corner(1, 1, y1), corner(-1, 1, y1)]],
      [[-front[0], 0, -front[1]], [corner(1, -1, y0), corner(-1, -1, y0), corner(-1, -1, y1), corner(1, -1, y1)]],
      [[along[0], 0, along[1]], [corner(1, 1, y0), corner(1, -1, y0), corner(1, -1, y1), corner(1, 1, y1)]],
      [[-along[0], 0, -along[1]], [corner(-1, -1, y0), corner(-1, 1, y0), corner(-1, 1, y1), corner(-1, -1, y1)]]
    ];
    const faceTone = tone
      ? [tone.top, tone.bottom || tone.side, tone.front, tone.back || tone.side, tone.side, tone.side]
      : null;
    faces.forEach(([n, quad], fi) => {
      // 面の向きは頂点の並びで決まるので、法線と合わない並びなら裏返す
      const e1 = sub(quad[1], quad[0]);
      const e2 = sub(quad[2], quad[0]);
      const cr = cross(e1, e2);
      const flip = cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0;
      const base = this.pos.length / 3;
      const col = faceTone ? faceTone[fi] : WHITE;
      for (const p of quad) {
        this.pos.push(p[0], p[1], p[2]);
        this.nor.push(n[0], n[1], n[2]);
        this.col.push(col[0], col[1], col[2]);
        this.pushUv(p, n);
      }
      if (flip) this.idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
      else this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    });
  }

  // 8頂点の六面体（下面 0-3、上面 4-7、どちらも同じ回り順）。斜めの梁に使う
  addHex(c) {
    const quads = [
      [c[4], c[5], c[6], c[7]], [c[3], c[2], c[1], c[0]],
      [c[0], c[1], c[5], c[4]], [c[1], c[2], c[6], c[5]],
      [c[2], c[3], c[7], c[6]], [c[3], c[0], c[4], c[7]]
    ];
    const mid = c.reduce((a, p) => [a[0] + p[0] / 8, a[1] + p[1] / 8, a[2] + p[2] / 8], [0, 0, 0]);
    for (const quad of quads) {
      let n = cross(sub(quad[1], quad[0]), sub(quad[2], quad[0]));
      const l = Math.hypot(n[0], n[1], n[2]) || 1;
      n = [n[0] / l, n[1] / l, n[2] / l];
      // 外向きにそろえる
      const out = sub(quad[0], mid);
      const flip = out[0] * n[0] + out[1] * n[1] + out[2] * n[2] < 0;
      if (flip) n = [-n[0], -n[1], -n[2]];
      const base = this.pos.length / 3;
      for (const p of quad) {
        this.pos.push(p[0], p[1], p[2]);
        this.nor.push(n[0], n[1], n[2]);
        this.col.push(1, 1, 1);
        this.pushUv(p, n);
      }
      if (flip) this.idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
      else this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    return g;
  }
}

const WHITE = [1, 1, 1];

function rgb(hex) {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
}

// 段床の色: 踏み面は明るく、蹴上げ（前の面）と横は暗く、上層の裏（軒裏）はさらに暗く
const TERRACE_TONE = {
  top: rgb("#b2afb4"), front: rgb("#77747b"), side: rgb("#8c8990"), bottom: rgb("#5f5c63")
};
const STEP_TONE = {
  top: rgb("#c6c3c8"), front: rgb("#8a878e"), side: rgb("#9a979e"), bottom: rgb("#5f5c63")
};
const NOSING_TONE = { top: rgb("#e0bd3c"), front: rgb("#c9a52c"), side: rgb("#c9a52c") };

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function norm2(v) {
  const l = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / l, v[1] / l];
}

// 2点を結ぶ鉛直の壁（厚み t）
function addWall(batch, p0, p1, y0, y1, t = 0.3) {
  const d = [p1[0] - p0[0], p1[1] - p0[1]];
  const len = Math.hypot(d[0], d[1]);
  if (len < 0.01) return;
  const along = [d[0] / len, d[1] / len];
  const front = [-along[1], along[0]];
  batch.add([(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2], along, front, len, t, y0, y1);
}

// 席番号 n の位置
export function seatPosition(row, n) {
  return [row.o[0] + (n - 1) * row.step[0], row.o[1] + (n - 1) * row.step[1]];
}

export function seatNumbers(row) {
  const out = [];
  for (const [a, b] of row.seats) for (let n = a; n <= b; n++) out.push(n);
  return out;
}

// ---------------------------------------------------------------------------
// 質感（その場で描く小さなテクスチャ。画像ファイルは使わない）
// ---------------------------------------------------------------------------

// 決まった並びの乱数（読み込むたびに模様が変わらないように）
function seeded(seed) {
  let x = seed >>> 0;
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

function canvasTexture(w, h, draw, repeat = null) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext("2d"), w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  return tex;
}

let concreteTex = null;

function concreteTexture() {
  if (concreteTex) return concreteTex;
  // 面の大きさに合わせた UV が無いので、ざらつきは細かい点の濃淡で出す
  concreteTex = canvasTexture(128, 128, (ctx, w, h) => {
    const rnd = seeded(7);
    ctx.fillStyle = "#e8e8e8";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2200; i++) {
      const v = 200 + Math.floor(rnd() * 55);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2);
    }
  });
  return concreteTex;
}

// ---------------------------------------------------------------------------
// ピッチ
// ---------------------------------------------------------------------------

function buildField(layout, group) {
  const fd = layout.field;

  // 地面は重ならない3枚に分ける（重なった板は、奥行きの精度が低い端末で前後が入れ替わる）:
  // 周囲の平地（外周の壁の外）、スタジアムの床（外周の壁〜スタンド前面）、
  // スタンド前面まで（126×84m）の人工芝帯（天然芝の外側）
  const flat = (outer, hole, mat, y = 0) => {
    // (x, z) の点列から、水平な面を作る（Shape の y は -z）
    const shape = new THREE.Shape(outer.map(([x, z]) => new THREE.Vector2(x, -z)));
    if (hole) shape.holes.push(new THREE.Path(hole.map(([x, z]) => new THREE.Vector2(x, -z))));
    const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = y;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };
  const box = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  const outerWall = layout.outline.outerUpper.map((p) => [p[0], p[1]]);
  flat(box(-4000, -4000, 4000, 4000), outerWall,
    new THREE.MeshStandardMaterial({ color: "#7f8a74", roughness: 1 }));
  flat(outerWall, box(fd.x_w, fd.z_n, fd.x_e, fd.z_s),
    new THREE.MeshStandardMaterial({ color: "#8f8c92", roughness: 1 }));
  flat(box(fd.x_w, fd.z_n, fd.x_e, fd.z_s), box(-38.5, -60, 38.5, 60),
    new THREE.MeshStandardMaterial({ color: "#2f6a3d", roughness: 1 }));

  // 天然芝 120×77m。刈り込みの縞はゴールラインと平行に 5m ごと。
  // 1m を 8px で描き、細かなムラとゴール前・センターの擦れを足す
  const tw = 77;
  const tl = 120;
  const turfTex = canvasTexture(tw * 8, tl * 8, (ctx, w, h) => {
    const rnd = seeded(11);
    const ppm = 8;
    for (let i = 0; i < tl / 5; i++) {
      ctx.fillStyle = i % 2 ? "#3c8448" : "#32773e";
      ctx.fillRect(0, i * 5 * ppm, w, 5 * ppm);
    }
    // 芝のムラ
    for (let i = 0; i < 26000; i++) {
      const v = rnd();
      ctx.fillStyle = v < 0.5 ? "rgba(15, 50, 20, 0.12)" : "rgba(150, 200, 120, 0.05)";
      ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1 + rnd() * 3);
    }
    // 擦れ: ゴールエリアの前とセンターサークル
    const wear = (cx, cy, r, a) => {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, `rgba(170, 160, 110, ${a})`);
      g.addColorStop(1, "rgba(170, 160, 110, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    };
    const mid = w / 2;
    wear(mid, (60 - 52.5 + 3) * ppm, 7 * ppm, 0.32);
    wear(mid, (60 + 52.5 - 3) * ppm, 7 * ppm, 0.32);
    wear(mid, 60 * ppm, 10 * ppm, 0.12);
  });
  const turf = new THREE.Mesh(
    new THREE.PlaneGeometry(tw, tl),
    new THREE.MeshStandardMaterial({ map: turfTex, roughness: 0.95 })
  );
  turf.rotation.x = -Math.PI / 2;
  turf.position.set(0, 0, 0);
  turf.receiveShadow = true;
  group.add(turf);

  // ライン（幅 12cm）。線は平たい板で描く（GL の線は細さが端末任せになる）
  // 白線は芝の上に重ねるので、奥行きを少し手前にずらして芝に負けないようにする
  const lineMat = new THREE.MeshBasicMaterial({
    color: "#f4f7f2", polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4
  });
  const lw = 0.12;
  const y = 0.02;
  const rect = (x0, z0, x1, z1) => {
    const parts = [
      [x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]
    ];
    for (const p of parts) segment(p[0], p[1], p[2], p[3]);
  };
  const segment = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len + lw, lw), lineMat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = -Math.atan2(z1 - z0, x1 - x0);
    m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    group.add(m);
  };
  const arc = (cx0, cz0, r, a0, a1) => {
    const g = new THREE.RingGeometry(r - lw / 2, r + lw / 2, 64, 1, a0, a1 - a0);
    const m = new THREE.Mesh(g, lineMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(cx0, y, cz0);
    group.add(m);
  };
  const spot = (x0, z0, r = 0.11) => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 20), lineMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x0, y, z0);
    group.add(m);
  };

  const hx = 34;
  const hz = 52.5;
  rect(-hx, -hz, hx, hz);
  segment(-hx, 0, hx, 0);
  arc(0, 0, 9.15, 0, Math.PI * 2);
  spot(0, 0, 0.15);
  for (const s of [-1, 1]) {
    const gz = s * hz;
    // ペナルティエリア 40.32 × 16.5、ゴールエリア 18.32 × 5.5
    rect(-20.16, gz, 20.16, gz - s * 16.5);
    rect(-9.16, gz, 9.16, gz - s * 5.5);
    const pz = gz - s * 11;
    spot(0, pz);
    // ペナルティアーク（エリアの外に出る部分だけ）
    const t = Math.acos(5.5 / 9.15);
    // RingGeometry の角度は x 軸から z へ（回転後）向かう。-z（北）側と +z（南）側で向きが逆
    if (s > 0) arc(0, pz, 9.15, Math.PI / 2 + t, Math.PI * 1.5 - t);
    else arc(0, pz, 9.15, -Math.PI / 2 + t, Math.PI / 2 - t);
    // コーナーアーク
    for (const c of [-1, 1]) {
      const a0 = s > 0 ? (c > 0 ? 0 : Math.PI / 2) : (c > 0 ? -Math.PI / 2 : Math.PI);
      arc(c * hx, gz, 1, a0, a0 + Math.PI / 2);
    }
    buildGoal(group, gz, s);
  }
}

function buildGoal(group, gz, s) {
  // ゴール 7.32 × 2.44m、奥行き約 2m のネット
  const postMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.4 });
  // 網目（12cm 角）を透かしで描く
  const netTex = canvasTexture(32, 32, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, w, h);
  }, [1, 1]);
  const netMat = new THREE.MeshStandardMaterial({
    color: "#f4f6f6", map: netTex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 1
  });
  const meshOf = (w, h) => {
    const g = new THREE.PlaneGeometry(w, h);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 0.12, uv.getY(i) * h / 0.12);
    return g;
  };
  const r = 0.06;
  const post = (x) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 2.44, 10), postMat);
    m.position.set(x, 1.22, gz);
    m.castShadow = true;
    group.add(m);
  };
  post(-3.66);
  post(3.66);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 7.32 + 2 * r, 10), postMat);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, 2.44, gz);
  bar.castShadow = true;
  group.add(bar);
  const depth = 2.0;
  const back = new THREE.Mesh(meshOf(7.32, 2.44), netMat);
  back.position.set(0, 1.22, gz + s * depth);
  group.add(back);
  const top = new THREE.Mesh(meshOf(7.32, depth), netMat);
  top.rotation.x = Math.PI / 2;
  top.position.set(0, 2.44, gz + s * depth / 2);
  group.add(top);
  for (const x of [-3.66, 3.66]) {
    const side = new THREE.Mesh(meshOf(depth, 2.44), netMat);
    side.rotation.y = Math.PI / 2;
    side.position.set(x, 1.22, gz + s * depth / 2);
    group.add(side);
  }
}

// ピッチの周りの LED 看板（高さ 0.9m）。タッチラインの外 4m、ゴールラインの外 4.5m に置く。
// 実際の看板の位置・内容は確かめていないので、図柄はクラブ名と模様だけにする
function buildBoards(group) {
  const face = canvasTexture(1024, 64, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, "#3a1466");
    g.addColorStop(0.5, "#6a2bb0");
    g.addColorStop(1, "#3a1466");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    ctx.font = "bold 34px sans-serif";
    ctx.textBaseline = "middle";
    for (let x = 30; x < w; x += 512) ctx.fillText("KYOTO SANGA F.C.", x, h / 2 + 2);
    ctx.fillStyle = "rgba(255, 209, 88, 0.9)";
    for (let x = 380; x < w; x += 512) ctx.fillRect(x, 14, 90, 36);
  }, [1, 1]);
  const frameMat = new THREE.MeshStandardMaterial({ color: "#1b1b22", roughness: 0.6 });
  const runs = [
    // [始点, 終点]（x, z）。面はピッチ側に向ける
    [[-38, -46], [-38, 46]], [[38, 46], [38, -46]],
    [[30, -57], [-30, -57]], [[-30, 57], [30, 57]]
  ];
  const H = 0.9;
  for (const [a, b] of runs) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const dir = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const yaw = Math.atan2(-dir[1], dir[0]);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(len, H, 0.25), frameMat);
    frame.position.set(mid[0], H / 2, mid[1]);
    frame.rotation.y = yaw;
    frame.castShadow = true;
    frame.receiveShadow = true;
    group.add(frame);
    const tex = face.clone();
    tex.needsUpdate = true;
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.set(len / 14, 1);
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(len, H * 0.82),
      new THREE.MeshStandardMaterial({ map: tex, emissive: "#ffffff", emissiveMap: tex, emissiveIntensity: 0.55, roughness: 0.4 })
    );
    // ピッチ側（中心側）の面に貼る
    const n = [-dir[1], dir[0]];
    const toCenter = -(mid[0] * n[0] + mid[1] * n[1]) > 0 ? 1 : -1;
    screen.position.set(mid[0] + n[0] * 0.13 * toCenter, H / 2, mid[1] + n[1] * 0.13 * toCenter);
    screen.rotation.y = yaw + (toCenter > 0 ? 0 : Math.PI);
    group.add(screen);
  }
}

function buildCornerFlags(group) {
  const pole = new THREE.MeshStandardMaterial({ color: "#f2f2f2", roughness: 0.5 });
  const flag = new THREE.MeshStandardMaterial({ color: "#7b3fc4", roughness: 0.8, side: THREE.DoubleSide });
  for (const x of [-34, 34]) {
    for (const z of [-52.5, 52.5]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 6), pole);
      p.position.set(x, 0.75, z);
      p.castShadow = true;
      group.add(p);
      const f = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.32), flag);
      f.position.set(x + Math.sign(x) * 0.21, 1.32, z);
      group.add(f);
    }
  }
}

// 周りの山並み。亀岡は四方を山に囲まれた盆地なので、遠景に低い山を回す。
// 形は実際の山を写したものではない（雰囲気のための遠景）
export function buildSurroundings(scene) {
  const rnd = seeded(23);
  const waves = Array.from({ length: 6 }, (_, i) => ({
    k: i + 2 + Math.floor(rnd() * 3), phase: rnd() * Math.PI * 2, amp: 0.25 + rnd() * 0.5
  }));
  const seg = 256;
  const rings = [1300, 1700, 2300, 3000, 3800];
  const pos = [];
  const col = [];
  const idx = [];
  const near = new THREE.Color("#55684f");
  const far = new THREE.Color("#8796a6");
  for (let ri = 0; ri < rings.length; ri++) {
    const r = rings[ri];
    const lift = [0, 0.75, 1, 0.85, 0.55][ri];
    for (let i = 0; i <= seg; i++) {
      const t = (i / seg) * Math.PI * 2;
      let h = 0;
      for (const w of waves) h += Math.sin(t * w.k + w.phase) * w.amp;
      h = (190 + h * 90) * lift;
      pos.push(Math.cos(t) * r, Math.max(h, 0) - 2, Math.sin(t) * r);
      const c = near.clone().lerp(far, ri / (rings.length - 1));
      col.push(c.r, c.g, c.b);
    }
  }
  for (let ri = 0; ri < rings.length - 1; ri++) {
    for (let i = 0; i < seg; i++) {
      const a = ri * (seg + 1) + i;
      const b = a + seg + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const hills = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  scene.add(hills);

  // 空: 上が濃く、地平線が淡いドーム。色は sun.js の光の切り替えで変える
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(5000, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color("#6f9ccc") },
        horizon: { value: new THREE.Color("#c9d8e4") }
      },
      vertexShader: `
        varying float vH;
        void main() {
          vH = normalize(position).y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 top;
        uniform vec3 horizon;
        varying float vH;
        void main() {
          float t = pow(clamp(vH, 0.0, 1.0), 0.55);
          gl_FragColor = vec4(mix(horizon, top, t), 1.0);
          #include <colorspace_fragment>
        }`
    })
  );
  sky.renderOrder = -1;
  scene.add(sky);
  return { hills, sky };
}

// 大きさの目安としての選手（4-4-2 同士、キックオフ前の並び）
function buildPlayers(group) {
  const home = new THREE.MeshStandardMaterial({ color: "#5a2a8a", roughness: 0.7 });
  const away = new THREE.MeshStandardMaterial({ color: "#f2f2f2", roughness: 0.7 });
  const skin = new THREE.MeshStandardMaterial({ color: "#c79a78", roughness: 0.8 });
  const body = new THREE.CylinderGeometry(0.2, 0.17, 1.1, 10);
  const legs = new THREE.CylinderGeometry(0.16, 0.12, 0.8, 8);
  const head = new THREE.SphereGeometry(0.12, 12, 10);
  const shape = [
    [0, 50], [-24, 38], [-8, 40], [8, 40], [24, 38],
    [-26, 22], [-9, 24], [9, 24], [26, 22], [-6, 6], [6, 8]
  ];
  for (const [team, mat, sign] of [["home", home, 1], ["away", away, -1]]) {
    for (const [x, z] of shape) {
      const g = new THREE.Group();
      const l = new THREE.Mesh(legs, mat === home ? away : home);
      l.position.y = 0.4;
      const b = new THREE.Mesh(body, mat);
      b.position.y = 1.35;
      const h = new THREE.Mesh(head, skin);
      h.position.y = 1.98;
      for (const m of [l, b, h]) {
        m.castShadow = true;
        g.add(m);
      }
      g.position.set(x * sign * 0.95, 0, z * sign);
      g.userData.team = team;
      group.add(g);
    }
  }
}

// ---------------------------------------------------------------------------
// スタンド（段床と座席）
// ---------------------------------------------------------------------------

function seatGeometry() {
  // 座面の高さ 42cm、背もたれ付きの樹脂座席。幅は席幅 47cm より少し狭く
  const w = 0.42;
  const pan = new THREE.BoxGeometry(w, 0.06, 0.38);
  pan.translate(0, 0.42, 0.02);
  const back = new THREE.BoxGeometry(w, 0.4, 0.05);
  back.rotateX(-0.12);
  back.translate(0, 0.66, -0.18);
  // 脚は省く（2万席あるので、三角形を減らす）
  return mergeGeometries([pan, back]);
}

function buildStands(layout, groups) {
  const lowerTerrace = new BoxBatch();
  const upperTerrace = new BoxBatch();
  const seatPositions = [];
  const blocks = [];
  let maxUpperH = 0;

  for (const b of layout.blocks) {
    const front = b.front;
    const depth = b.rowDepth;
    const info = {
      id: b.id, stand: b.stand, tier: b.tier, segment: b.segment, front,
      rows: b.rows, seatStart: seatPositions.length, seatCount: 0,
      rowDepth: depth, labelInferred: !!b.labelInferred, mirroredFrom: b.mirroredFrom,
      rowNumbers: b.rowNumbers, seatNumbers: b.seatNumbers
    };
    let prevH = null;
    const rowsSorted = [...b.rows].sort((a, c) => a.n - c.n);
    let minA = Infinity, maxA = -Infinity, minF = Infinity, maxF = -Infinity, maxH = 0;
    for (const r of rowsSorted) {
      const nums = seatNumbers(r);
      const stepLen = Math.hypot(r.step[0], r.step[1]);
      const along = norm2(r.step);
      const first = seatPosition(r, nums[0]);
      const last = seatPosition(r, nums[nums.length - 1]);
      const len = Math.hypot(last[0] - first[0], last[1] - first[1]) + stepLen;
      const mid = [(first[0] + last[0]) / 2, (first[1] + last[1]) / 2];
      const y1 = r.h;
      const batch = b.tier === "lower" ? lowerTerrace : upperTerrace;
      const bottom = (top) => (b.tier === "lower" ? 0 : top - LOOK.upperSlab);
      batch.add(mid, along, front, len, depth, bottom(y1), y1, TERRACE_TONE);
      if (b.tier === "upper") maxUpperH = Math.max(maxUpperH, y1);

      // 通路の階段: 列の両端の外側（通路の半分）を、奥半分は列と同じ高さ、
      // 手前半分は前の列との中間の高さにして、1列を2段で上る形にする。段の縁は黄色
      const half = (prevH === null ? y1 - 0.3 : prevH) * 0.5 + y1 * 0.5;
      const w = LOOK.aisleHalf;
      for (const [end, sgn] of [[first, -1], [last, 1]]) {
        const o = stepLen / 2 + w / 2;
        const c = [end[0] + along[0] * sgn * o, end[1] + along[1] * sgn * o];
        const back = [c[0] - front[0] * depth / 4, c[1] - front[1] * depth / 4];
        const fore = [c[0] + front[0] * depth / 4, c[1] + front[1] * depth / 4];
        batch.add(back, along, front, w, depth / 2, bottom(y1), y1, STEP_TONE);
        batch.add(fore, along, front, w, depth / 2, bottom(half), half, STEP_TONE);
        const edge = [c[0] + front[0] * (depth / 2 - 0.03), c[1] + front[1] * (depth / 2 - 0.03)];
        batch.add(edge, along, front, w, 0.06, half - 0.03, half + 0.004, NOSING_TONE);
      }
      prevH = y1;
      for (const n of nums) {
        const p = seatPosition(r, n);
        seatPositions.push({ x: p[0], z: p[1], y: r.h, front, block: info, row: r.n, seat: n });
        info.seatCount++;
        const a = p[0] * along[0] + p[1] * along[1];
        const f = p[0] * front[0] + p[1] * front[1];
        minA = Math.min(minA, a); maxA = Math.max(maxA, a);
        minF = Math.min(minF, f); maxF = Math.max(maxF, f);
        maxH = Math.max(maxH, r.h);
      }
      info.along = along;
    }
    // ブロックを選ぶための当たり判定（見えない箱）
    const al = info.along;
    const ca = (minA + maxA) / 2;
    const cf = (minF + maxF) / 2;
    const center = [al[0] * ca + front[0] * cf, al[1] * ca + front[1] * cf];
    info.center = center;
    info.top = maxH;
    info.hit = {
      center, along: al, length: maxA - minA + 0.8, depth: maxF - minF + depth,
      y0: b.tier === "lower" ? 0 : Math.min(...b.rows.map((r) => r.h)) - 1, y1: maxH + 1.2
    };
    blocks.push(info);
  }

  const concrete = new THREE.MeshStandardMaterial({
    color: "#ffffff", vertexColors: true, roughness: 0.92, map: concreteTexture()
  });
  const concreteUpper = concrete;
  const lower = new THREE.Mesh(lowerTerrace.geometry(), concrete);
  lower.castShadow = true;
  lower.receiveShadow = true;
  groups.terraces.add(lower);
  const upper = new THREE.Mesh(upperTerrace.geometry(), concreteUpper);
  upper.castShadow = true;
  upper.receiveShadow = true;
  groups.terraces.add(upper);

  // 座席（全席をインスタンスで）
  const seatMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.6 });
  const seats = new THREE.InstancedMesh(seatGeometry(), seatMat, seatPositions.length);
  const dummy = new THREE.Object3D();
  const base = new THREE.Color("#5b2c86");
  const c = new THREE.Color();
  seatPositions.forEach((s, i) => {
    dummy.position.set(s.x, s.y, s.z);
    dummy.rotation.set(0, Math.atan2(s.front[0], s.front[1]), 0);
    dummy.updateMatrix();
    seats.setMatrixAt(i, dummy.matrix);
    // 同じ紫でも少しだけ揺らぎを入れて、のっぺりさせない
    c.copy(base).offsetHSL(0, 0, ((i * 9301 + 49297) % 233280) / 233280 * 0.05 - 0.025);
    seats.setColorAt(i, c);
  });
  seats.instanceMatrix.needsUpdate = true;
  seats.instanceColor.needsUpdate = true;
  seats.receiveShadow = true;
  groups.seats.add(seats);

  return { blocks, seatPositions, seatMesh: seats, baseSeatColor: base, maxUpperH };
}

// 前面の手すり壁・上層の鼻先・コンコース側の壁
function buildFronts(layout, groups, maxUpperH) {
  const fd = layout.field;
  const batch = new BoxBatch();
  const glass = new BoxBatch();
  // 下層の前面（フィールド面から 1.2m の床 + 手すり）
  const corners = [[fd.x_w, fd.z_n], [fd.x_e, fd.z_n], [fd.x_e, fd.z_s], [fd.x_w, fd.z_s]];
  for (let i = 0; i < 4; i++) {
    const p0 = corners[i];
    const p1 = corners[(i + 1) % 4];
    addWall(batch, p0, p1, 0, 1.2, 0.35);
    addWall(glass, p0, p1, 1.2, 2.2, 0.06);
  }

  // 上層の前面（3・4F図の内側の八角形）。西側は建物の面なので別に作る
  const uf = layout.outline.upperFront;
  const upperH = Math.min(...layout.blocks.filter((b) => b.tier === "upper").flatMap((b) => b.rows.map((r) => r.h)));
  for (let i = 0; i < uf.length; i++) {
    const p0 = uf[i];
    const p1 = uf[(i + 1) % uf.length];
    const mx = (p0[0] + p1[0]) / 2;
    const isWest = Math.abs(p0[0] - p1[0]) < 0.5 && mx < 0;
    if (isWest) continue;
    addWall(batch, p0, p1, upperH - 2.2, upperH + 1.0, 0.35);
  }

  const concrete = new THREE.MeshStandardMaterial({ color: "#77737c", roughness: 0.9 });
  const front = new THREE.Mesh(batch.geometry(), concrete);
  front.castShadow = true;
  front.receiveShadow = true;
  groups.terraces.add(front);
  const glassMat = new THREE.MeshStandardMaterial({
    color: "#c8dde3", transparent: true, opacity: 0.35, roughness: 0.1, metalness: 0.1, depthWrite: false
  });
  groups.terraces.add(new THREE.Mesh(glass.geometry(), glassMat));
  return upperH;
}

// 建物（メインスタンドの諸室とガラス面、外周の壁）
function buildBuilding(layout, groups, roof) {
  const batch = new BoxBatch();
  const glass = new BoxBatch();
  const uf = layout.outline.upperFront;
  // メインスタンド側の 3・4F の面（ビジネスシート・記者席）。x 一定の辺
  const west = [];
  for (let i = 0; i < uf.length; i++) {
    const p0 = uf[i];
    const p1 = uf[(i + 1) % uf.length];
    if (Math.abs(p0[0] - p1[0]) < 0.5 && p0[0] < 0) west.push([p0, p1]);
  }
  const outer = layout.outline.outerUpper;
  const outerW = Math.min(...outer.map((p) => p[0]));
  const lowerW = layout.blocks.filter((b) => b.stand === "W" && b.tier === "lower");
  const wBackH = Math.max(...lowerW.flatMap((b) => b.rows.map((r) => r.h)));
  const floor3 = wBackH + 2.8;
  for (const [p0, p1] of west) {
    const x = p0[0];
    const z0 = Math.min(p0[1], p1[1]);
    const z1 = Math.max(p0[1], p1[1]);
    // ガラスの帯（3F・4F）と、その下の梁
    addWall(glass, [x, z0], [x, z1], floor3 + 0.9, roof.innerUnder - 0.3, 0.1);
    addWall(batch, [x, z0], [x, z1], floor3 - 0.6, floor3 + 0.9, 0.5);
    // 床（張り出しの下面）と建物の箱
    batch.add([(x + outerW) / 2, (z0 + z1) / 2], [0, 1], [1, 0], z1 - z0, x - outerW, floor3 - 0.6, floor3 - 0.2);
    // 中ほどの床（4F）
    addWall(batch, [x - 0.2, z0], [x - 0.2, z1], floor3 + 4.0, floor3 + 4.3, 0.4);
  }

  // 2F の VIP 区画（W7〜W11 の後ろ）。前面はガラス
  for (const poly of layout.outline.westBuilding) {
    const xs = poly.map((p) => p[0]);
    const zs = poly.map((p) => p[1]);
    const x1 = Math.max(...xs);
    const z0 = Math.min(...zs);
    const z1 = Math.max(...zs);
    if (z1 - z0 < 20) continue;
    const vipFloor = 5.4;
    addWall(glass, [x1, z0], [x1, z1], vipFloor + 0.4, floor3 - 0.6, 0.08);
  }

  // 下層の後ろのコンコース側の壁（2F 図のスタンド外形の後ろ側）
  const lowerOutline = layout.outline.lower;
  for (const [stand, poly] of Object.entries(lowerOutline)) {
    for (let i = 0; i < poly.length; i++) {
      const p0 = poly[i];
      const p1 = poly[(i + 1) % poly.length];
      const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      if (len < 3) continue;
      const mx = (p0[0] + p1[0]) / 2;
      const mz = (p0[1] + p1[1]) / 2;
      // スタンド前面（フィールドの縁）にある辺は除く
      const fd = layout.field;
      const onFront =
        (Math.abs(p0[0] - fd.x_w) < 0.6 && Math.abs(p1[0] - fd.x_w) < 0.6) ||
        (Math.abs(p0[0] - fd.x_e) < 0.6 && Math.abs(p1[0] - fd.x_e) < 0.6) ||
        (Math.abs(p0[1] - fd.z_n) < 0.6 && Math.abs(p1[1] - fd.z_n) < 0.6) ||
        (Math.abs(p0[1] - fd.z_s) < 0.6 && Math.abs(p1[1] - fd.z_s) < 0.6);
      if (onFront) continue;
      const dist = Math.hypot(mx + 0.5, mz);
      if (dist < 55) continue;
      const top = stand === "W" ? floor3 - 0.6 : 13.5;
      addWall(batch, p0, p1, 0, top, 0.4);
    }
  }

  // 外周の壁（3・4F図の外形）。屋根の外端まで
  for (let i = 0; i < outer.length; i++) {
    addWall(batch, outer[i], outer[(i + 1) % outer.length], 0, roof.outerUnder, 0.6);
  }

  // 外壁: 縦のルーバー（0.5m おき）と、階ごとの帯。2m × 8m で1回り
  const facade = canvasTexture(64, 256, (ctx, w, h) => {
    ctx.fillStyle = "#d4d6db";
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) {
      ctx.fillStyle = "#b9bcc3";
      ctx.fillRect(x, 0, 5, h);
      ctx.fillStyle = "#eef0f3";
      ctx.fillRect(x + 5, 0, 2, h);
    }
    ctx.fillStyle = "#8e9198";
    ctx.fillRect(0, 0, w, 10);
    ctx.fillStyle = "rgba(60, 70, 84, 0.55)";
    ctx.fillRect(0, 150, w, 40);
  }, [1, 0.25]);
  const mat = new THREE.MeshStandardMaterial({ color: "#ffffff", map: facade, roughness: 0.75 });
  const mesh = new THREE.Mesh(batch.geometry(), mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  groups.building.add(mesh);
  const glassMat = new THREE.MeshStandardMaterial({
    color: "#4a5a6a", metalness: 0.3, roughness: 0.2, transparent: true, opacity: 0.85
  });
  groups.building.add(new THREE.Mesh(glass.geometry(), glassMat));
}

// ---------------------------------------------------------------------------
// 屋根
// ---------------------------------------------------------------------------

function buildRoof(layout, groups, maxUpperH) {
  const fd = layout.field;
  const over = layout.constants.roofOverhang;
  // 内側の開口: スタンド前面（＝最前列のすぐ前）から 2m 張り出す
  const inner = {
    x0: fd.x_w + over, x1: fd.x_e - over, z0: fd.z_n + over, z1: fd.z_s - over
  };
  const innerUnder = maxUpperH + LOOK.roofFrontAboveTop;
  const outerUnder = maxUpperH + LOOK.roofOuterAboveTop;
  const depth = LOOK.roofDepth;

  // 外形（八角形）を、内側の長方形の辺と角ごとの扇形に分ける
  const outer = layout.outline.outerUpper.map((p) => [p[0], p[1]]);
  const cx = (inner.x0 + inner.x1) / 2;
  const ic = {
    NW: [inner.x0, inner.z0], NE: [inner.x1, inner.z0], SE: [inner.x1, inner.z1], SW: [inner.x0, inner.z1]
  };
  // 外形の各辺を向きで分類
  const sectors = [];
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i];
    const b = outer[(i + 1) % outer.length];
    const mx = (a[0] + b[0]) / 2;
    const mz = (a[1] + b[1]) / 2;
    const dx = Math.abs(b[0] - a[0]);
    const dz = Math.abs(b[1] - a[1]);
    let key;
    if (dx < 0.5) key = mx < cx ? "W" : "E";
    else if (dz < 0.5) key = mz < 0 ? "N" : "S";
    else key = (mz < 0 ? "N" : "S") + (mx < cx ? "W" : "E");
    sectors.push({ key, a, b });
  }
  const innerEdge = {
    W: [ic.SW, ic.NW], E: [ic.NE, ic.SE], N: [ic.NW, ic.NE], S: [ic.SE, ic.SW]
  };

  const metal = new BoxBatch();
  const top = [];
  const glassTop = [];
  const pushTri = (arr, p, q, r, yp, yq, yr) => {
    arr.push(p[0], yp, p[1], q[0], yq, q[1], r[0], yr, r[1]);
  };
  for (const s of sectors) {
    const target = s.key === "S" ? glassTop : top;
    if (s.key.length === 1) {
      const [i0, i1] = innerEdge[s.key];
      // 外形の辺の向きと内側の辺の向きを揃える
      const d0 = Math.hypot(s.a[0] - i0[0], s.a[1] - i0[1]) + Math.hypot(s.b[0] - i1[0], s.b[1] - i1[1]);
      const d1 = Math.hypot(s.a[0] - i1[0], s.a[1] - i1[1]) + Math.hypot(s.b[0] - i0[0], s.b[1] - i0[1]);
      const [o0, o1] = d0 < d1 ? [s.a, s.b] : [s.b, s.a];
      pushTri(target, i0, i1, o1, innerUnder + depth, innerUnder + depth, outerUnder + depth);
      pushTri(target, i0, o1, o0, innerUnder + depth, outerUnder + depth, outerUnder + depth);
      // 内側の端の梁（鼻先）
      addWall(metal, i0, i1, innerUnder, innerUnder + depth, 0.6);
      // トラス（4.5m ごとに内→外の梁）
      const n = Math.max(2, Math.round(Math.hypot(i1[0] - i0[0], i1[1] - i0[1]) / 4.5));
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const pi = [i0[0] + (i1[0] - i0[0]) * t, i0[1] + (i1[1] - i0[1]) * t];
        const po = [o0[0] + (o1[0] - o0[0]) * t, o0[1] + (o1[1] - o0[1]) * t];
        addTruss(metal, pi, po, innerUnder, outerUnder, depth);
      }
    } else {
      const corner = ic[s.key];
      pushTri(target, corner, s.a, s.b, innerUnder + depth, outerUnder + depth, outerUnder + depth);
      for (let k = 0; k <= 4; k++) {
        const t = k / 4;
        const po = [s.a[0] + (s.b[0] - s.a[0]) * t, s.a[1] + (s.b[1] - s.a[1]) * t];
        addTruss(metal, corner, po, innerUnder, outerUnder, depth);
      }
    }
  }

  const sheetGeom = (arr) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
    g.computeVertexNormals();
    return g;
  };
  const roofMat = new THREE.MeshStandardMaterial({
    color: "#d9dce1", metalness: 0.35, roughness: 0.6, side: THREE.DoubleSide
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: "#b5d4dd", transparent: true, opacity: 0.4, roughness: 0.15, side: THREE.DoubleSide, depthWrite: false
  });
  const sheet = new THREE.Mesh(sheetGeom(top), roofMat);
  sheet.castShadow = true;
  sheet.receiveShadow = true;
  groups.roof.add(sheet);
  const glass = new THREE.Mesh(sheetGeom(glassTop), glassMat);
  glass.userData.glass = true;   // 日なた・日陰の判定では光を通すものとして扱う
  glass.castShadow = true;
  groups.roof.add(glass);
  // ガラス屋根は光を通すが、骨組みの影は落ちる。影は骨組みだけで出す

  const steel = new THREE.MeshStandardMaterial({ color: "#c3c8cf", metalness: 0.4, roughness: 0.5 });
  const beams = new THREE.Mesh(metal.geometry(), steel);
  beams.castShadow = true;
  beams.receiveShadow = true;
  groups.roof.add(beams);

  // 照明（内側の鼻先に並ぶ LED）
  const lampMat = new THREE.MeshBasicMaterial({ color: "#fffbe8" });
  const lampGeom = new THREE.BoxGeometry(0.6, 0.18, 0.35);
  const lamps = [];
  for (const k of ["W", "E", "N", "S"]) {
    const [i0, i1] = innerEdge[k];
    const len = Math.hypot(i1[0] - i0[0], i1[1] - i0[1]);
    const n = Math.round(len / 3.2);
    for (let j = 1; j < n; j++) {
      const t = j / n;
      lamps.push([i0[0] + (i1[0] - i0[0]) * t, i0[1] + (i1[1] - i0[1]) * t]);
    }
  }
  const lampMesh = new THREE.InstancedMesh(lampGeom, lampMat, lamps.length);
  const dummy = new THREE.Object3D();
  lamps.forEach((p, i) => {
    dummy.position.set(p[0], innerUnder - 0.2, p[1]);
    dummy.lookAt(0, 0, 0);
    dummy.updateMatrix();
    lampMesh.setMatrixAt(i, dummy.matrix);
  });
  groups.roof.add(lampMesh);

  return { innerUnder, outerUnder, inner, lamps: lampMesh };
}

// 屋根のトラス: 上弦・下弦と、約4mごとの束と斜材
function addTruss(batch, p0, p1, y0, y1, depth) {
  const chord = 0.32;
  addSlopedBeam(batch, p0, p1, y0, y1, chord, chord);
  addSlopedBeam(batch, p0, p1, y0 + depth - chord, y1 + depth - chord, chord, chord);
  const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  const n = Math.max(2, Math.round(len / 4));
  const at = (t) => [p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t];
  const yb = (t) => y0 + (y1 - y0) * t;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = at(t);
    batch.add(p, norm2([p1[0] - p0[0], p1[1] - p0[1]]), norm2([p0[1] - p1[1], p1[0] - p0[0]]), 0.18, 0.18, yb(t), yb(t) + depth);
    if (i < n) {
      const t1 = (i + 1) / n;
      // 斜材は内側の下から外側の上へ
      addSlopedBeam(batch, p, at(t1), yb(t) + chord, yb(t1) + depth - chord * 2, 0.14, 0.16);
    }
  }
}

function addSlopedBeam(batch, p0, p1, y0, y1, w, h) {
  // 内側 p0（下面の高さ y0）から外側 p1（y1）へ下る梁。幅 w、せい h
  const d = [p1[0] - p0[0], p1[1] - p0[1]];
  const len = Math.hypot(d[0], d[1]);
  if (len < 0.01) return;
  const s = [-d[1] / len * w / 2, d[0] / len * w / 2];
  const at = (p, y, k) => [p[0] + s[0] * k, y, p[1] + s[1] * k];
  batch.addHex([
    at(p0, y0, -1), at(p1, y1, -1), at(p1, y1, 1), at(p0, y0, 1),
    at(p0, y0 + h, -1), at(p1, y1 + h, -1), at(p1, y1 + h, 1), at(p0, y0 + h, 1)
  ]);
}

// ---------------------------------------------------------------------------
// 大型映像装置（推定位置）
// ---------------------------------------------------------------------------

// 座席図では、上層の南西（S22・S23）と北東（E38・E39）の角だけ 3列で、その後ろに
// 座席が描かれていない。大型映像装置 2基（資料 p.15）はこの2か所と推定する。
function buildScreens(layout, groups) {
  const want = [["S22", "S23"], ["E38", "E39"]];
  const byId = new Map(layout.blocks.map((b) => [b.id, b]));
  const frame = new THREE.MeshStandardMaterial({ color: "#1d1f26", roughness: 0.6 });
  const face = new THREE.MeshStandardMaterial({
    color: "#0e1424", emissive: "#1b2850", emissiveIntensity: 0.9, roughness: 0.4
  });
  const out = [];
  for (const ids of want) {
    const bs = ids.map((id) => byId.get(id)).filter(Boolean);
    if (!bs.length) continue;
    let sx = 0, sz = 0, n = 0, topH = 0, back = Infinity;
    const f = bs[0].front;
    for (const b of bs) {
      for (const r of b.rows) {
        for (const num of seatNumbers(r)) {
          const p = seatPosition(r, num);
          sx += p[0]; sz += p[1]; n++;
          back = Math.min(back, p[0] * f[0] + p[1] * f[1]);
          topH = Math.max(topH, r.h);
        }
      }
    }
    const c = [sx / n, sz / n];
    // 最後列の 2m 後ろ、座席の上に画面の下端
    const along = [-f[1], f[0]];
    const cf = c[0] * f[0] + c[1] * f[1];
    const shift = back - cf - 2.5;
    const pos = [c[0] + f[0] * shift, c[1] + f[1] * shift];
    const y = topH + 1.8 + LOOK.screenHeight / 2;
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(LOOK.screenWidth + 0.6, LOOK.screenHeight + 0.6, 0.6), frame);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(LOOK.screenWidth, LOOK.screenHeight), face);
    scr.position.z = 0.31;
    g.add(box, scr);
    g.position.set(pos[0], y, pos[1]);
    g.rotation.y = Math.atan2(f[0], f[1]);
    box.castShadow = true;
    groups.screens.add(g);
    out.push(g);
  }
  return out;
}

// ---------------------------------------------------------------------------
// ブロック名の札
// ---------------------------------------------------------------------------

function textSprite(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 192;
  canvas.height = 80;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "rgba(15, 12, 22, .72)";
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(8, 10, 176, 60, 12);
    ctx.fill();
  } else {
    ctx.fillRect(8, 10, 176, 60);
  }
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 38px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 96, 42);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  // 屋根や手前のスタンドに隠れる札は隠す（常に手前へ描くと、屋根の上やピッチの上に散らばる）
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  sp.scale.set(4.8, 2, 1);
  sp.renderOrder = 10;
  return sp;
}

// ---------------------------------------------------------------------------
// まとめ
// ---------------------------------------------------------------------------

export function buildStadium(scene, layout) {
  const groups = {
    field: new THREE.Group(),
    players: new THREE.Group(),
    terraces: new THREE.Group(),
    seats: new THREE.Group(),
    roof: new THREE.Group(),
    building: new THREE.Group(),
    screens: new THREE.Group(),
    labels: new THREE.Group(),
    hits: new THREE.Group()
  };
  Object.values(groups).forEach((g) => scene.add(g));

  buildField(layout, groups.field);
  buildBoards(groups.field);
  buildCornerFlags(groups.field);
  buildPlayers(groups.players);
  const stands = buildStands(layout, groups);
  const upperFrontFloor = buildFronts(layout, groups, stands.maxUpperH);
  const roof = buildRoof(layout, groups, stands.maxUpperH);
  buildBuilding(layout, groups, roof);
  buildScreens(layout, groups);

  // ブロック名の札と当たり判定
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  for (const b of stands.blocks) {
    // 札は最前列の中ほど、手すりの上に浮かべる。ピッチ側から読める位置
    const first = b.rows.reduce((a, r) => (r.n < a.n ? r : a));
    const nums = seatNumbers(first);
    const mid = seatPosition(first, nums[Math.floor(nums.length / 2)]);
    const sp = textSprite(b.id);
    sp.position.set(mid[0] + b.front[0] * 1.2, first.h + 2.6, mid[1] + b.front[1] * 1.2);
    sp.userData.block = b;
    groups.labels.add(sp);
    b.label = sp;

    const h = b.hit;
    const box = new THREE.Mesh(new THREE.BoxGeometry(h.length, h.y1 - h.y0, h.depth), hitMat);
    box.position.set(h.center[0], (h.y0 + h.y1) / 2, h.center[1]);
    box.rotation.y = Math.atan2(-h.along[1], h.along[0]);
    box.userData.block = b;
    groups.hits.add(box);
  }

  // 上層の前面の壁の上端（buildFronts と同じ高さ）。見やすさの計算に使う
  return { groups, ...stands, roof, upperParapetTop: upperFrontFloor + 1.0 };
}
