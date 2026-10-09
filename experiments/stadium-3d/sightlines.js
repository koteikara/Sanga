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

const CROWD_RADIUS = 35;

// サポーターの服の色。紫が多め
const SHIRTS = ["#4d2a7d", "#5b2c86", "#3f2166", "#6a3a9a", "#2b2b33", "#e9e6ef", "#7a2f43", "#35506e"];

// 座った人: 胴（肩まで）、頭（肌）、髪。頭の中心は床から約 1.2m（目の高さ 1.15m の少し上）
function torsoGeometry() {
  const torso = new THREE.CylinderGeometry(0.17, 0.2, 0.56, 7, 1, true);
  torso.scale(1.15, 1, 0.72);
  torso.translate(0, 0.78, -0.04);
  const shoulders = new THREE.SphereGeometry(0.2, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2);
  shoulders.scale(1.15, 0.35, 0.72);
  shoulders.translate(0, 1.05, -0.04);
  const neck = new THREE.CylinderGeometry(0.05, 0.055, 0.1, 6, 1, true);
  neck.translate(0, 1.1, -0.01);
  return mergeGeometries([torso.toNonIndexed(), shoulders.toNonIndexed(), neck.toNonIndexed()]);
}

function headGeometry() {
  const head = new THREE.SphereGeometry(0.095, 9, 7);
  head.scale(0.92, 1.08, 1);
  head.translate(0, 1.21, 0.0);
  return head;
}

function hairGeometry() {
  // 頭の後ろと上を覆う（後ろの席から見えるのは主に髪）
  const hair = new THREE.SphereGeometry(0.102, 9, 5, 0, Math.PI * 2, 0, Math.PI * 0.62);
  hair.scale(0.94, 1.08, 1.02);
  hair.rotateX(-0.35);
  hair.translate(0, 1.225, -0.012);
  return hair;
}

const SKIN = ["#e0b48f", "#d1a27c", "#c18e69", "#e8c3a0"];
const HAIR = ["#1f1a17", "#2b211b", "#3d2c22", "#4a3a2c", "#6b5a4a", "#8b8378"];

export function buildSpectators(group, seats) {
  const torso = new THREE.InstancedMesh(
    torsoGeometry(), new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.85 }), seats.length
  );
  const heads = new THREE.InstancedMesh(
    headGeometry(), new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.75 }), seats.length
  );
  const hair = new THREE.InstancedMesh(
    hairGeometry(), new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.95 }), seats.length
  );
  for (const m of [torso, heads, hair]) {
    m.count = 0;
    m.frustumCulled = false;
    m.castShadow = false;
    m.receiveShadow = true;
    group.add(m);
  }

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  // 着席視点の近く（半径 35m）の席に人を置く。自分の席は空ける。重くなるので影は落とさない
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
      hair.setMatrixAt(n, dummy.matrix);
      torso.setColorAt(n, color.set(SHIRTS[(i * 7 + 3) % SHIRTS.length]));
      heads.setColorAt(n, color.set(SKIN[(i * 5 + 1) % SKIN.length]));
      hair.setColorAt(n, color.set(HAIR[(i * 11 + 2) % HAIR.length]));
      n++;
    }
    for (const m of [torso, heads, hair]) {
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  function clear() {
    torso.count = 0;
    heads.count = 0;
    hair.count = 0;
  }

  return { update, clear };
}
