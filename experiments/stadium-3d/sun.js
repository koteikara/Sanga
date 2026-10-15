// 試合の日時の太陽の位置と、それに合わせた光
//
// 太陽の位置は、日付と時刻から天文の近似式（NOAA の簡易式）で計算する。誤差は 1° 程度。
// スタジアムの位置と向きは OpenStreetMap のピッチの形から測った値（README）。

import * as THREE from "three";

// サンガスタジアム by KYOCERA のピッチの中心と、ピッチの長辺の向き（北から時計回り）。
// モデルの -z（北）は、この方位を向いている
export const STADIUM = { lat: 35.01726, lon: 135.58478, northBearing: 356.2 };

const RAD = Math.PI / 180;

// 太陽の方位（北から時計回り、度）と高度（度）
export function sunPosition(date, lat = STADIUM.lat, lon = STADIUM.lon) {
  const n = date.getTime() / 86400000 + 2440587.5 - 2451545.0;   // J2000 からの日数
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * RAD;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const eps = (23.439 - 0.0000004 * n) * RAD;
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const gmst = (18.697374558 + 24.06570982441908 * n) % 24;
  const lmst = gmst + lon / 15;
  const H = (lmst * 15) * RAD - ra;                                   // 時角
  const phi = lat * RAD;
  const el = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  const az = Math.atan2(-Math.sin(H), Math.cos(phi) * Math.tan(dec) - Math.sin(phi) * Math.cos(H));
  return { azimuth: ((az / RAD) + 360) % 360, elevation: el / RAD };
}

// モデルの座標（x 東、y 上、z 南）での、太陽の向きの単位ベクトル
export function sunDirection({ azimuth, elevation }) {
  const a = (azimuth - STADIUM.northBearing) * RAD;
  const e = elevation * RAD;
  return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
}

// 日本時間の日付（YYYY-MM-DD）と時刻（HH:MM）から Date を作る
export function jstDate(day, time, plusMinutes = 0) {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh - 9, mm + plusMinutes));
}

// 方位の言い方（16方位）
const DIRS = ["北", "北北東", "北東", "東北東", "東", "東南東", "南東", "南南東",
  "南", "南南西", "南西", "西南西", "西", "西北西", "北西", "北北西"];

export function bearingName(deg) {
  return DIRS[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
}

// ---------------------------------------------------------------------------
// 光の切り替え
// ---------------------------------------------------------------------------

const SKY_DAY = new THREE.Color("#c9d8e4");
const SKY_DUSK = new THREE.Color("#c99a7a");
const SKY_NIGHT = new THREE.Color("#0d1424");

// scene と既存の光（hemi: 空の光、sun: 太陽）を受け取り、時刻に合わせて変える。
// 夜は光源を増やさず（スマホで重くなる）、太陽の光を屋根の照明の代わりに使う
const FLOOD_DIR = new THREE.Vector3(-0.35, 1, 0.25).normalize();   // 屋根の西の縁から斜めに

const TOP_DAY = new THREE.Color("#6f9ccc");
const TOP_NIGHT = new THREE.Color("#050914");

export function createLighting(scene, hemi, sun, roofLamps, skyDome = null) {
  const setSky = (horizon, top) => {
    scene.background = horizon.clone();
    if (scene.fog) scene.fog.color.copy(horizon);
    if (skyDome) {
      skyDome.material.uniforms.horizon.value.copy(horizon);
      skyDome.material.uniforms.top.value.copy(top);
    }
  };

  const defaults = {
    sunPos: sun.position.clone(),
    sunColor: sun.color.clone(),
    sunIntensity: sun.intensity,
    hemiIntensity: hemi.intensity,
    hemiSky: hemi.color.clone(),
    hemiGround: hemi.groundColor.clone()
  };

  function apply({ dir, elevation }) {
    // 夕方から夜は空の色と光の強さをなめらかに変える（高度 6° 〜 −6°）
    const t = THREE.MathUtils.clamp((elevation + 6) / 12, 0, 1);   // 0: 夜、1: 昼
    // 夕焼けの色は、太陽が地平線の少し上〜少し下のあいだだけ
    const warm = THREE.MathUtils.clamp(1 - Math.abs(elevation - 3) / 6, 0, 1);
    const sky = SKY_NIGHT.clone().lerp(SKY_DAY, t).lerp(SKY_DUSK, warm * 0.6);
    setSky(sky, TOP_NIGHT.clone().lerp(TOP_DAY, t));

    if (elevation > 0) {
      sun.position.copy(dir).multiplyScalar(220);
      sun.intensity = 2.8 * Math.min(1, elevation / 12 + 0.25);
      sun.color.set("#fff3de").lerp(new THREE.Color("#ffb070"), warm * 0.8);
      sun.castShadow = true;
    } else {
      // 照明: 屋根の縁から下向きの白い光。観客席は屋根の下でも照らされているので、
      // 屋根の影は落とさない
      sun.position.copy(FLOOD_DIR).multiplyScalar(220);
      sun.intensity = 1.7;
      sun.color.set("#f2f5ff");
      sun.castShadow = false;
    }
    // 夜でも観客席が見える明るさを残す（スタンドの照明の代わり）
    hemi.intensity = 1.05 + 0.85 * t;
    hemi.color.copy(defaults.hemiSky).lerp(new THREE.Color("#8d98b8"), 1 - t);
    hemi.groundColor.copy(defaults.hemiGround).lerp(new THREE.Color("#3a4038"), 1 - t);

    if (roofLamps) roofLamps.material.color.set(elevation < 4 ? "#ffffff" : "#d8d6cc");
  }

  function reset() {
    sun.castShadow = true;
    sun.position.copy(defaults.sunPos);
    sun.color.copy(defaults.sunColor);
    sun.intensity = defaults.sunIntensity;
    hemi.intensity = defaults.hemiIntensity;
    hemi.color.copy(defaults.hemiSky);
    hemi.groundColor.copy(defaults.hemiGround);
    setSky(SKY_DAY, TOP_DAY);
    if (roofLamps) roofLamps.material.color.set("#fffbe8");
  }

  return { apply, reset };
}
