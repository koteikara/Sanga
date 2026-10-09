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
  aisleHalf: 0.55,          // ブロック間の通路の半幅（段床をつなげるため）
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
  }

  // center: [x, z], along/front: 水平の単位ベクトル [x, z]
  add(center, along, front, length, depth, y0, y1) {
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
    for (const [n, quad] of faces) {
      // 面の向きは頂点の並びで決まるので、法線と合わない並びなら裏返す
      const e1 = sub(quad[1], quad[0]);
      const e2 = sub(quad[2], quad[0]);
      const cr = cross(e1, e2);
      const flip = cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0;
      const base = this.pos.length / 3;
      for (const p of quad) {
        this.pos.push(p[0], p[1], p[2]);
        this.nor.push(n[0], n[1], n[2]);
      }
      if (flip) this.idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
      else this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
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
      }
      if (flip) this.idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
      else this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nor, 3));
    g.setIndex(this.idx);
    return g;
  }
}

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
// ピッチ
// ---------------------------------------------------------------------------

function buildField(layout, group) {
  const fd = layout.field;
  const W = fd.x_e - fd.x_w;
  const L = fd.z_s - fd.z_n;
  const cx = (fd.x_w + fd.x_e) / 2;

  // 周囲の地面と、スタンド前面まで（126×84m）の人工芝帯
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(420, 420),
    new THREE.MeshStandardMaterial({ color: "#7d8873", roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  group.add(ground);

  const surround = new THREE.Mesh(
    new THREE.PlaneGeometry(W, L),
    new THREE.MeshStandardMaterial({ color: "#2f6a3d", roughness: 1 })
  );
  surround.rotation.x = -Math.PI / 2;
  surround.position.set(cx, 0, 0);
  surround.receiveShadow = true;
  group.add(surround);

  // 天然芝 120×77m。刈り込みの縞はゴールラインと平行に 5m ごと
  const tw = 77;
  const tl = 120;
  const stripes = 24;
  const sl = tl / stripes;
  const light = new THREE.MeshStandardMaterial({ color: "#3d8a4e", roughness: 0.95 });
  const dark = new THREE.MeshStandardMaterial({ color: "#337b44", roughness: 0.95 });
  for (let i = 0; i < stripes; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(tw, sl), i % 2 ? light : dark);
    m.rotation.x = -Math.PI / 2;
    m.position.set(0, 0.01, -tl / 2 + sl * (i + 0.5));
    m.receiveShadow = true;
    group.add(m);
  }

  // ライン（幅 12cm）。線は平たい板で描く（GL の線は細さが端末任せになる）
  const lineMat = new THREE.MeshBasicMaterial({ color: "#f4f7f2" });
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
  const netMat = new THREE.MeshStandardMaterial({
    color: "#eef2f2", transparent: true, opacity: 0.28, side: THREE.DoubleSide, roughness: 1, depthWrite: false
  });
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
  const back = new THREE.Mesh(new THREE.PlaneGeometry(7.32, 2.44), netMat);
  back.position.set(0, 1.22, gz + s * depth);
  group.add(back);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(7.32, depth), netMat);
  top.rotation.x = Math.PI / 2;
  top.position.set(0, 2.44, gz + s * depth / 2);
  group.add(top);
  for (const x of [-3.66, 3.66]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(depth, 2.44), netMat);
    side.rotation.y = Math.PI / 2;
    side.position.set(x, 1.22, gz + s * depth / 2);
    group.add(side);
  }
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
  const leg = new THREE.BoxGeometry(0.06, 0.4, 0.3);
  leg.translate(0, 0.2, -0.05);
  return mergeGeometries([pan, back, leg]);
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
      const len = Math.hypot(last[0] - first[0], last[1] - first[1]) + stepLen + LOOK.aisleHalf * 2;
      const mid = [(first[0] + last[0]) / 2, (first[1] + last[1]) / 2];
      const y1 = r.h;
      if (b.tier === "lower") {
        lowerTerrace.add(mid, along, front, len, depth, 0, y1);
      } else {
        upperTerrace.add(mid, along, front, len, depth, y1 - LOOK.upperSlab, y1);
        maxUpperH = Math.max(maxUpperH, y1);
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

  const concrete = new THREE.MeshStandardMaterial({ color: "#8d8a90", roughness: 0.92 });
  const concreteUpper = new THREE.MeshStandardMaterial({ color: "#8a8790", roughness: 0.92 });
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

  const mat = new THREE.MeshStandardMaterial({ color: "#a3a5ab", roughness: 0.8 });
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
