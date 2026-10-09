// 見やすさ（C値）と、前の列の観客
//
// C値は、観客席の設計で使われる「前の人の頭越しに見えるか」の目安。
// 自分の目からピッチの手前の端（タッチライン・ゴールライン）への視線が、
// 前の列の人の目の高さよりどれだけ上を通るかを表す。
//   C = 視線が前の列の真上を通る高さ − 前の列の人の目の高さ
// 頭の上端は目より 10cm ほど上なので、90〜120mm あれば頭越しに見える。

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { EYE_HEIGHT } from "./stadium-model.js";

const PITCH_HALF_X = 34;
const PITCH_HALF_Z = 52.5;

// 区分。色だけに頼らないよう、情報欄と凡例には言葉で出す
export const C_LEVELS = [
  { min: 0.12, key: "great", label: "とても見やすい", range: "120mm以上", color: "#1f8a70" },
  { min: 0.09, key: "good", label: "見やすい", range: "90〜120mm", color: "#7cc35a" },
  { min: 0.06, key: "fair", label: "前の人の頭の間から見る", range: "60〜90mm", color: "#f2c94c" },
  { min: -Infinity, key: "poor", label: "前の人で隠れやすい", range: "60mm未満", color: "#e8603c" }
];

export function cLevel(c) {
  return C_LEVELS.find((l) => c >= l.min);
}

// 座席の真上にいる人から見た、ピッチの手前の端（いちばん近いライン上の点）
function focalPoint(x, z) {
  return [
    Math.max(-PITCH_HALF_X, Math.min(PITCH_HALF_X, x)),
    Math.max(-PITCH_HALF_Z, Math.min(PITCH_HALF_Z, z))
  ];
}

// 全席の C値（m）を計算して seatPositions[i].c に入れる。
// 最前列は、前に人がいない代わりに前の壁（下層はフィールド面からの壁の上端、
// 上層はスタンド前面の壁の上端）を越えて見るものとして計算する。
export function computeSightlines(layout, model) {
  const lowerWallTop = layout.constants.frontRowFloor;
  const upperParapetTop = model.upperParapetTop;
  const seats = model.seatPositions;

  for (const b of model.blocks) {
    const f = b.front;
    const line = layout.frontLines[b.tier][b.segment];
    // スタンド前面の線からの奥行き
    const depthOf = (x, z) => line - (f[0] * x + f[1] * z);

    // 列を前から順に並べる
    const rowDepth = new Map();
    for (let i = b.seatStart; i < b.seatStart + b.seatCount; i++) {
      const s = seats[i];
      const d = depthOf(s.x, s.z);
      const cur = rowDepth.get(s.row);
      if (!cur) rowDepth.set(s.row, { sum: d, n: 1, h: s.y });
      else { cur.sum += d; cur.n += 1; }
    }
    const order = [...rowDepth.entries()]
      .map(([n, v]) => ({ n, depth: v.sum / v.n, h: v.h }))
      .sort((a, c) => a.depth - c.depth);
    const ahead = new Map(order.map((r, i) => [r.n, i > 0 ? order[i - 1] : null]));
    const self = new Map(order.map((r) => [r.n, r]));

    for (let i = b.seatStart; i < b.seatStart + b.seatCount; i++) {
      const s = seats[i];
      const eye = s.y + EYE_HEIGHT;
      const [px, pz] = focalPoint(s.x, s.z);
      const D = Math.hypot(px - s.x, pz - s.z);
      const front = ahead.get(s.row);
      let T, obstacle;
      if (front) {
        T = self.get(s.row).depth - front.depth;
        obstacle = front.h + EYE_HEIGHT;
        s.cRef = "row";
      } else {
        T = Math.max(depthOf(s.x, s.z), 0.3);
        obstacle = b.tier === "lower" ? lowerWallTop : upperParapetTop;
        s.cRef = "wall";
      }
      // 視線がスタンドに斜めに向かうときは、前の列（壁）までの距離が延びる
      const cos = Math.max(0.35, ((px - s.x) * f[0] + (pz - s.z) * f[1]) / Math.max(D, 1e-6));
      const t = T / cos;
      s.c = D > t ? eye * (D - t) / D - obstacle : -1;
    }
  }
}

// ---------------------------------------------------------------------------
// 観客（着席視点で、近くの席に座らせる）
// ---------------------------------------------------------------------------

const CROWD_RADIUS = 45;

// サポーターの服の色。紫が多め
const SHIRTS = ["#4d2a7d", "#5b2c86", "#3f2166", "#6a3a9a", "#2b2b33", "#e9e6ef", "#7a2f43", "#35506e"];

// 座った人: 胴（肩まで）と頭。頭の中心は床から約 1.2m（目の高さ 1.15m の少し上）
function torsoGeometry() {
  const torso = new THREE.BoxGeometry(0.4, 0.55, 0.26);
  torso.translate(0, 0.78, -0.04);
  const arms = new THREE.BoxGeometry(0.52, 0.12, 0.3);
  arms.translate(0, 0.62, 0.06);
  return mergeGeometries([torso, arms]);
}

function headGeometry() {
  const head = new THREE.SphereGeometry(0.105, 10, 8);
  head.translate(0, 1.2, 0.0);
  return head;
}

export function buildSpectators(group, seats) {
  const torso = new THREE.InstancedMesh(
    torsoGeometry(), new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.85 }), seats.length
  );
  const heads = new THREE.InstancedMesh(
    headGeometry(), new THREE.MeshStandardMaterial({ color: "#3a2c24", roughness: 0.9 }), seats.length
  );
  for (const m of [torso, heads]) {
    m.count = 0;
    m.frustumCulled = false;
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  // 着席視点の近く（半径 45m）の席に人を置く。自分の席は空ける
  function update(camera, ownIndex) {
    let n = 0;
    const p = camera.position;
    for (let i = 0; i < seats.length; i++) {
      if (i === ownIndex) continue;
      const s = seats[i];
      if (Math.abs(s.x - p.x) > CROWD_RADIUS || Math.abs(s.z - p.z) > CROWD_RADIUS) continue;
      if (Math.hypot(s.x - p.x, s.y - p.y, s.z - p.z) > CROWD_RADIUS) continue;
      dummy.position.set(s.x, s.y, s.z);
      dummy.rotation.set(0, Math.atan2(s.front[0], s.front[1]), 0);
      dummy.updateMatrix();
      torso.setMatrixAt(n, dummy.matrix);
      heads.setMatrixAt(n, dummy.matrix);
      color.set(SHIRTS[(i * 7 + 3) % SHIRTS.length]);
      torso.setColorAt(n, color);
      n++;
    }
    torso.count = n;
    heads.count = n;
    torso.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
    if (torso.instanceColor) torso.instanceColor.needsUpdate = true;
  }

  function clear() {
    torso.count = 0;
    heads.count = 0;
  }

  return { update, clear };
}
