// サンガスタジアム 座席ビュー（プロトタイプ）
//
// layout.json（公式の座席図から extract/build_layout.py で作った全席の位置）を読み、
// stadium-model.js で組み立てた3Dの中で、選んだ席の目の高さへカメラを置く。

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  EYE_HEIGHT,
  buildStadium,
  seatNumbers,
  standName
} from "./stadium-model.js";

const $ = id => document.getElementById(id);

function showBootError(text) {
  const message = $("bootMessage");
  if (message) message.textContent = text;
}

// 起動できたので、読み込み失敗の受け皿は片づける
function clearBoot() {
  clearTimeout(window.__stadiumBootTimer);
  const boot = $("boot");
  if (boot) boot.remove();
}

const prefersReducedMotion =
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const isTouch = window.matchMedia("(pointer: coarse)").matches;

const isNarrow = () => window.matchMedia("(max-width: 700px)").matches;

// 画面の案内は入力機器で変える。指で触る画面に「ホイール」「Esc」は無い。
const HELP = {
  overview: isTouch
    ? "ドラッグ：回転 ／ ピンチ：拡大 ／ 座席をタップ：選択"
    : "ドラッグ：回転 ／ ホイール：拡大 ／ 座席をクリック：選択",

  seat: isTouch
    ? "ドラッグ：見回す ／ 「全体表示へ戻る」で戻る"
    : "ドラッグ・矢印キー：見回す ／ ホイール：画角 ／ Esc：全体表示"
};

const TIER_NAME = { lower: "下層", upper: "上層" };

// 選択の色。座席の紫と見分けられる明るさにする（色だけに頼らず、情報欄にも文字で出す）
const BLOCK_COLOR = new THREE.Color("#c7a6ff");
const SEAT_COLOR = new THREE.Color("#ffd158");

// ============================================================
// 画面の土台
// ============================================================

const scene = new THREE.Scene();
scene.background = new THREE.Color("#a9c0d2");
scene.fog = new THREE.Fog("#a9c0d2", 200, 420);

const camera = new THREE.PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  0.08,
  1200
);

let renderer;

try {
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance"
  });
} catch (error) {
  showBootError(
    "この環境ではWebGLを使えないため、3Dを表示できません。" +
    "別のブラウザか、ハードウェアアクセラレーションを有効にした状態で開いてください。"
  );
  throw error;
}

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

$("app").appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = !prefersReducedMotion;
controls.dampingFactor = 0.08;
controls.minDistance = 8;
controls.maxPolarAngle = Math.PI / 2 - 0.02;

const hemi = new THREE.HemisphereLight("#eaf5ff", "#4a524c", 1.9);
scene.add(hemi);

// 太陽は南西寄りの午後の光。影のカメラはスタジアム全体（外形およそ150m）が入る大きさにする
const sun = new THREE.DirectionalLight("#fff3de", 2.8);
sun.position.set(-90, 150, 70);
sun.castShadow = true;
sun.shadow.mapSize.set(isTouch ? 2048 : 4096, isTouch ? 2048 : 4096);
sun.shadow.camera.left = -110;
sun.shadow.camera.right = 110;
sun.shadow.camera.top = 110;
sun.shadow.camera.bottom = -110;
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 420;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.04;
scene.add(sun);

// ============================================================
// 状態
// ============================================================

let model = null;
let blocksById = new Map();
let mode = "overview";
let selectedBlock = null;
let selectedRow = null;
let selectedSeatIndex = -1;
let baseColors = null;

// 着席視点の向き
let yaw = 0;
let pitch = 0;

// 全体表示の見下ろす向き。距離は画面の縦横比から決めるので、ここは向きだけ持つ。
const OVERVIEW_TARGET = new THREE.Vector3(0, 6, 0);
const OVERVIEW_DIRECTION = new THREE.Vector3(150, 125, 160).normalize();
let overviewRadius = 110;

// 広い画面では操作パネルが左に常に出ている。3Dの中心をパネルの右の空きへずらし、
// スタジアムがパネルの裏に隠れないようにする。狭い画面ではパネルは下にあり、畳めるのでずらさない。
function panelInset() {
  if (isNarrow()) return 0;
  const rect = $("panel").getBoundingClientRect();
  return Math.max(0, Math.min(rect.right + 8, window.innerWidth * 0.45));
}

function applyViewOffset() {
  const inset = mode === "overview" ? panelInset() : 0;
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (inset > 0) camera.setViewOffset(w, h, -inset / 2, 0, w, h);
  else camera.clearViewOffset();
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

// 縦長の画面では横の画角が狭くなり、既定の距離だとスタジアムが入りきらない。
// 縦横のうち狭いほうの画角に合わせて距離を出す。パネルで隠れる幅は除いて考える。
function overviewDistance() {
  const vertical = THREE.MathUtils.degToRad(camera.fov);
  const visibleAspect = (window.innerWidth - panelInset()) / window.innerHeight;
  const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * visibleAspect);
  const narrow = Math.max(0.2, Math.min(vertical, horizontal));

  return overviewRadius / Math.sin(narrow / 2);
}

// 霧は距離に合わせて動かす。固定のままだと、引いたときに全体が霧へ沈む。
function applyOverviewRange(distance) {
  scene.fog.near = distance * 0.7;
  scene.fog.far = distance * 2.2;
  controls.maxDistance = distance * 1.4;
}

// ============================================================
// 座席の検索
// ============================================================

function seatIndexOf(block, rowN, seatN) {
  const seats = model.seatPositions;
  for (let i = block.seatStart; i < block.seatStart + block.seatCount; i++) {
    if (seats[i].row === rowN && seats[i].seat === seatN) return i;
  }
  return -1;
}

function rowOf(block, rowN) {
  return block.rows.find(r => r.n === rowN) || null;
}

// 画面の点から、いちばん手前でレイの近くにある座席を探す
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const tmp = new THREE.Vector3();

function pickSeat(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const hits = raycaster.intersectObjects(model.groups.hits.children, false);
  if (!hits.length) return -1;

  const ray = raycaster.ray;
  const seats = model.seatPositions;
  const seen = new Set();
  let best = -1;
  let bestT = Infinity;
  let fallback = -1;
  let fallbackD = Infinity;

  for (const hit of hits) {
    const block = hit.object.userData.block;
    if (seen.has(block)) continue;
    seen.add(block);

    for (let i = block.seatStart; i < block.seatStart + block.seatCount; i++) {
      const s = seats[i];
      tmp.set(s.x, s.y + 0.5, s.z);
      const d = ray.distanceToPoint(tmp);
      const t = tmp.sub(ray.origin).dot(ray.direction);
      if (d < 0.6 && t < bestT) {
        best = i;
        bestT = t;
      }
      if (d < fallbackD) {
        fallback = i;
        fallbackD = d;
      }
    }
  }

  if (best >= 0) return best;
  return fallbackD < 3 ? fallback : -1;
}

// ============================================================
// 選択の表示
// ============================================================

function paintSelection() {
  const mesh = model.seatMesh;
  const colors = mesh.instanceColor.array;
  colors.set(baseColors);

  // ブロックの塗り分けは全体表示で場所を探すためのもの。座ったら本来の色に戻す
  if (selectedBlock && mode === "overview") {
    for (let i = selectedBlock.seatStart; i < selectedBlock.seatStart + selectedBlock.seatCount; i++) {
      BLOCK_COLOR.toArray(colors, i * 3);
    }
  }
  if (selectedSeatIndex >= 0 && mode === "overview") SEAT_COLOR.toArray(colors, selectedSeatIndex * 3);

  mesh.instanceColor.needsUpdate = true;
  updateMarker();
}

// 全体表示で選んだ席の場所が分かるように、席の上に目印を立てる
const marker = new THREE.Mesh(
  new THREE.ConeGeometry(0.9, 2.4, 16),
  new THREE.MeshBasicMaterial({ color: SEAT_COLOR, depthTest: false, transparent: true, opacity: 0.95 })
);
marker.rotation.x = Math.PI;
marker.renderOrder = 20;
marker.visible = false;
scene.add(marker);

function updateMarker() {
  if (selectedSeatIndex < 0) {
    marker.visible = false;
    return;
  }
  const s = model.seatPositions[selectedSeatIndex];
  marker.position.set(s.x, s.y + 3.2, s.z);
  marker.visible = mode === "overview";
}

// ============================================================
// 操作パネル
// ============================================================

function sortBlocks(a, b) {
  return Number(a.id.slice(1)) - Number(b.id.slice(1));
}

function fillBlockOptions() {
  const select = $("block");
  select.textContent = "";

  const order = [
    ["W", "lower"], ["E", "lower"], ["E", "upper"],
    ["N", "lower"], ["N", "upper"], ["S", "lower"], ["S", "upper"]
  ];

  for (const [stand, tier] of order) {
    const list = model.blocks
      .filter(b => b.stand === stand && b.tier === tier)
      .sort(sortBlocks);
    if (!list.length) continue;

    const group = document.createElement("optgroup");
    group.label = `${standName(stand)} ${TIER_NAME[tier]}`;
    for (const b of list) {
      const option = document.createElement("option");
      option.value = b.id;
      option.textContent = `${b.id}（${TIER_NAME[tier]}）`;
      group.appendChild(option);
    }
    select.appendChild(group);
  }
}

function fillRowOptions(block) {
  const select = $("row");
  select.textContent = "";
  const rows = [...block.rows].sort((a, b) => a.n - b.n);
  for (const r of rows) {
    const option = document.createElement("option");
    option.value = String(r.n);
    option.textContent = `${r.n}列`;
    select.appendChild(option);
  }
}

function fillSeatOptions(row) {
  const select = $("seat");
  select.textContent = "";
  for (const n of seatNumbers(row)) {
    const option = document.createElement("option");
    option.value = String(n);
    option.textContent = `${n}番`;
    select.appendChild(option);
  }
}

// 列・席を指定しないときは、ブロックの中ほど（中央の列の中央の席）にする
function middleSeat(block) {
  const rows = [...block.rows].sort((a, b) => a.n - b.n);
  const row = rows[Math.floor((rows.length - 1) / 2)];
  const nums = seatNumbers(row);
  return { row, seat: nums[Math.floor((nums.length - 1) / 2)] };
}

function select(block, rowN, seatN) {
  selectedBlock = block;

  if (rowN === undefined) {
    const mid = middleSeat(block);
    rowN = mid.row.n;
    seatN = mid.seat;
  }

  selectedRow = rowOf(block, rowN) || middleSeat(block).row;
  const nums = seatNumbers(selectedRow);
  if (!nums.includes(seatN)) seatN = nums[Math.floor((nums.length - 1) / 2)];

  $("block").value = block.id;
  fillRowOptions(block);
  $("row").value = String(selectedRow.n);
  fillSeatOptions(selectedRow);
  $("seat").value = String(seatN);

  selectedSeatIndex = seatIndexOf(block, selectedRow.n, seatN);
  paintSelection();
  updateInfo();
}

// 着席視点のまま選び直したときは、その席へ座り直す
function reseatIfSeated() {
  // 選択欄を操作している最中なので、狭い画面でもパネルは畳まない（フォーカスが消える）
  if (mode === "seat") viewFromSelectedSeat({ collapsePanel: false });
}

function currentSeat() {
  return selectedSeatIndex >= 0 ? model.seatPositions[selectedSeatIndex] : null;
}

// 座席からピッチ（タッチライン・ゴールラインの内側）までの水平距離
function distanceToPitch(x, z) {
  const dx = Math.max(0, Math.abs(x) - 34);
  const dz = Math.max(0, Math.abs(z) - 52.5);
  return Math.hypot(dx, dz);
}

function seatLabel(s) {
  return `${s.block.id} ${s.row}列 ${s.seat}番`;
}

function updateInfo() {
  const s = currentSeat();
  const info = $("info");

  if (!s) {
    info.innerHTML = "<strong>ブロックを選択してください</strong>";
    return;
  }

  const b = s.block;
  const eye = s.y + EYE_HEIGHT;
  const center = Math.hypot(s.x, s.z);
  const pitchDist = distanceToPitch(s.x, s.z);
  // ピッチ中央を見下ろす角度（目の高さから）
  const down = THREE.MathUtils.radToDeg(Math.atan2(eye, center));

  const notes = [];
  if (b.labelInferred) notes.push("ブロック名は座席図の並びから補っています。");
  if (b.mirroredFrom) notes.push(`座席図に半分しか描かれていないため、${b.mirroredFrom} を左右反転して作っています。`);
  if (b.rowNumbers === "count") notes.push("このブロックは座席図に列番号が読める形で印刷されていないため、列番号は前から数えたものです。");
  if (b.seatNumbers === "count") notes.push("このブロックの席番号は、座席図の印刷ではなく端から数えたものです。");

  info.innerHTML = `
    <strong>${standName(b.stand)} ${TIER_NAME[b.tier]} / ${seatLabel(s)}</strong>
    <dl>
      <dt>ピッチ中央まで</dt><dd>約${center.toFixed(0)}m（水平）</dd>
      <dt>いちばん近いラインまで</dt><dd>約${pitchDist.toFixed(0)}m</dd>
      <dt>床の高さ</dt><dd>フィールド面から約${s.y.toFixed(1)}m</dd>
      <dt>目の高さ</dt><dd>約${eye.toFixed(1)}m（着席）</dd>
      <dt>ピッチ中央を見下ろす角度</dt><dd>約${down.toFixed(0)}°</dd>
      <dt>このブロック</dt><dd>${b.rows.length}列・${b.seatCount}席</dd>
    </dl>
    ${notes.length ? `<p class="note">${notes.join("<br>")}</p>` : ""}
  `;
}

// ============================================================
// 視点
// ============================================================

// ブロック名は遠くのスタンドを見分けるためのもの。着席視点で近くの札が出ると
// 目の前をふさぐので、近い札だけ隠す
const LABEL_HIDE_NEAR = 32;

function updateLabelVisibility() {
  for (const b of model.blocks) {
    b.label.visible =
      mode !== "seat" ||
      b.label.position.distanceTo(camera.position) > LABEL_HIDE_NEAR;
  }
}

function updateSeatCameraDirection() {
  const direction = new THREE.Vector3(
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    -Math.cos(yaw) * Math.cos(pitch)
  );

  camera.lookAt(camera.position.clone().add(direction));
}

function lookAtPitchCenter() {
  if (mode !== "seat") return;

  const target = new THREE.Vector3(0, 0, 0);
  const direction = target.sub(camera.position).normalize();

  yaw = Math.atan2(direction.x, -direction.z);
  pitch = Math.asin(direction.y);

  updateSeatCameraDirection();
}

function viewFromSelectedSeat({ collapsePanel = true } = {}) {
  const s = currentSeat();
  if (!s) {
    $("status").textContent = "席を選んでください";
    return;
  }

  controls.enabled = false;
  controls.enableDamping = false;
  mode = "seat";
  marker.visible = false;

  // 目は座面の少し前、床から EYE_HEIGHT の高さ
  camera.position.set(
    s.x + s.front[0] * 0.08,
    s.y + EYE_HEIGHT,
    s.z + s.front[1] * 0.08
  );
  camera.fov = 62;
  applyViewOffset();
  scene.fog.near = 260;
  scene.fog.far = 900;

  lookAtPitchCenter();
  updateLabelVisibility();
  paintSelection();

  $("status").textContent = `${standName(s.block.stand)} / ${seatLabel(s)}｜着席視点`;
  $("help").textContent = HELP.seat;

  if (collapsePanel && isNarrow()) setPanelCollapsed(true);
}

function overview() {
  mode = "overview";
  controls.enabled = true;
  controls.enableDamping = false;

  camera.fov = 55;
  applyViewOffset();

  const distance = overviewDistance();
  applyOverviewRange(distance);

  camera.position
    .copy(OVERVIEW_DIRECTION)
    .multiplyScalar(distance)
    .add(OVERVIEW_TARGET);

  controls.target.copy(OVERVIEW_TARGET);
  controls.update();
  controls.enableDamping = !prefersReducedMotion;

  updateLabelVisibility();
  paintSelection();

  const s = currentSeat();
  $("status").textContent = s
    ? `全体表示｜選択中：${seatLabel(s)}`
    : "全体表示｜ブロックを選択してください";

  $("help").textContent = HELP.overview;
}

// ============================================================
// 入力
// ============================================================

const panel = $("panel");
const panelToggle = $("panelToggle");

function setPanelCollapsed(collapsed) {
  panel.classList.toggle("is-collapsed", collapsed);
  panelToggle.setAttribute("aria-expanded", String(!collapsed));
  panelToggle.textContent = collapsed ? "開く" : "閉じる";
}

panelToggle.addEventListener("click", () => {
  setPanelCollapsed(!panel.classList.contains("is-collapsed"));
});

$("block").addEventListener("change", () => {
  const block = blocksById.get($("block").value);
  if (!block) return;
  select(block);
  reseatIfSeated();
});

$("row").addEventListener("change", () => {
  const row = rowOf(selectedBlock, Number($("row").value));
  if (!row) return;
  // 同じ席番号が新しい列にもあれば保つ。無ければ列の中央へ
  select(selectedBlock, row.n, Number($("seat").value));
  reseatIfSeated();
});

$("seat").addEventListener("change", () => {
  select(selectedBlock, selectedRow.n, Number($("seat").value));
  reseatIfSeated();
});

$("viewButton").addEventListener("click", () => viewFromSelectedSeat());
$("overviewButton").addEventListener("click", overview);
$("centerButton").addEventListener("click", lookAtPitchCenter);

function bindToggle(id, apply) {
  const input = $(id);
  input.addEventListener("change", () => apply(input.checked));
  apply(input.checked);
}

function bindToggles() {
  const g = model.groups;
  bindToggle("roofToggle", on => { g.roof.visible = on; });
  bindToggle("seatToggle", on => { g.seats.visible = on; });
  bindToggle("labelToggle", on => { g.labels.visible = on; });
  bindToggle("buildingToggle", on => { g.building.visible = on; });
  bindToggle("screenToggle", on => { g.screens.visible = on; });
  bindToggle("playerToggle", on => { g.players.visible = on; });
}

const tooltip = $("tooltip");
let drag = null;

function bindPointer() {
  const el = renderer.domElement;

  el.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;
    drag = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      moved: false
    };
    el.setPointerCapture(event.pointerId);
  });

  el.addEventListener("pointermove", event => {
    if (drag && drag.id === event.pointerId) {
      const dx = event.clientX - drag.lastX;
      const dy = event.clientY - drag.lastY;
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 5) {
        drag.moved = true;
      }
      if (mode === "seat") {
        yaw -= dx * 0.004;
        pitch = THREE.MathUtils.clamp(pitch + dy * 0.004, -Math.PI * 0.46, Math.PI * 0.46);
        updateSeatCameraDirection();
      }
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      tooltip.style.display = "none";
      return;
    }

    if (mode !== "overview" || isTouch) return;

    const index = pickSeat(event);
    if (index >= 0) {
      el.style.cursor = "pointer";
      tooltip.style.display = "block";
      tooltip.textContent = `${seatLabel(model.seatPositions[index])}（${standName(model.seatPositions[index].block.stand)}）`;
      tooltip.style.left = Math.min(event.clientX + 12, window.innerWidth - 240) + "px";
      tooltip.style.top = event.clientY + 12 + "px";
    } else {
      el.style.cursor = "default";
      tooltip.style.display = "none";
    }
  });

  el.addEventListener("pointerup", event => {
    if (!drag || drag.id !== event.pointerId) return;
    const shouldSelect = !drag.moved && mode === "overview";
    drag = null;
    if (!shouldSelect) return;

    const index = pickSeat(event);
    if (index < 0) return;
    const s = model.seatPositions[index];
    select(s.block, s.row, s.seat);
    $("status").textContent = `${seatLabel(s)} を選択（「この席から見る」で着席視点へ）`;
  });

  el.addEventListener("pointerleave", () => {
    tooltip.style.display = "none";
  });

  el.addEventListener("wheel", event => {
    if (mode !== "seat") return;
    event.preventDefault();
    camera.fov = THREE.MathUtils.clamp(camera.fov + event.deltaY * 0.035, 30, 90);
    camera.updateProjectionMatrix();
  }, { passive: false });
}

window.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    overview();
    return;
  }

  // 着席視点では矢印キーで見回せるようにする（選択欄を操作中は選択欄に任せる）
  if (mode !== "seat") return;
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === "SELECT" || tag === "INPUT") return;

  const step = 0.06;
  if (event.key === "ArrowLeft") yaw -= step;
  else if (event.key === "ArrowRight") yaw += step;
  else if (event.key === "ArrowUp") pitch = Math.min(pitch + step, Math.PI * 0.46);
  else if (event.key === "ArrowDown") pitch = Math.max(pitch - step, -Math.PI * 0.46);
  else return;

  event.preventDefault();
  updateSeatCameraDirection();
});

window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  applyViewOffset();

  if (mode !== "overview") return;

  // 画面の向きが変わると入る範囲も変わる。回した角度は残して距離だけ直す。
  const distance = overviewDistance();
  applyOverviewRange(distance);

  camera.position
    .sub(controls.target)
    .setLength(distance)
    .add(controls.target);

  controls.update();
});

// ============================================================
// 起動
// ============================================================

// URLの #E30-12-5 で、その席を選んだ状態から始める（共有・確認用）
function seatFromHash() {
  const m = /^#([WENS]\d{1,2})(?:-(\d{1,2})(?:-(\d{1,3}))?)?$/.exec(location.hash);
  if (!m) return null;
  const block = blocksById.get(m[1]);
  if (!block) return null;
  return {
    block,
    row: m[2] === undefined ? undefined : Number(m[2]),
    seat: m[3] === undefined ? undefined : Number(m[3])
  };
}

async function start() {
  let layout;
  try {
    const response = await fetch("layout.json");
    if (!response.ok) throw new Error(String(response.status));
    layout = await response.json();
  } catch (error) {
    showBootError(
      "座席データ（layout.json）を読み込めませんでした。" +
      "ファイルを直接開いた場合は、HTTPサーバー経由で開いてください。"
    );
    throw error;
  }

  model = buildStadium(scene, layout);
  blocksById = new Map(model.blocks.map(b => [b.id, b]));
  baseColors = model.seatMesh.instanceColor.array.slice();

  // 全体表示で入れる半径（外周の壁の角まで）
  overviewRadius = Math.max(
    ...layout.outline.outerUpper.map(p => Math.hypot(p[0], p[1]))
  ) + 6;

  fillBlockOptions();
  bindToggles();
  bindPointer();

  const fromHash = seatFromHash();
  if (fromHash) {
    select(fromHash.block, fromHash.row, fromHash.seat);
  } else {
    select(blocksById.get("E30") || model.blocks[0]);
  }

  setPanelCollapsed(isNarrow());
  overview();
  if (fromHash && fromHash.seat !== undefined) viewFromSelectedSeat();
  clearBoot();

  window.addEventListener("hashchange", () => {
    const next = seatFromHash();
    if (!next) return;
    select(next.block, next.row, next.seat);
    if (next.seat !== undefined) viewFromSelectedSeat();
    else overview();
  });

  renderer.setAnimationLoop(() => {
    if (mode === "overview") controls.update();
    renderer.render(scene, camera);
  });
}

start();
