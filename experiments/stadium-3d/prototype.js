// サンガスタジアム 座席ビュー（プロトタイプ）
//
// ブロックを選ぶと、その付近の着席視点へカメラを置く。
// 寸法・傾斜は公開資料の値、それ以外はモデル用の仮定値（DATA.assumed）。

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

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
    ? "ドラッグ：回転 ／ ピンチ：拡大 ／ ブロックをタップ：選択"
    : "ドラッグ：回転 ／ ホイール：拡大 ／ ブロッククリック：選択",

  seat: isTouch
    ? "ドラッグ：見回す ／ 「全体表示へ戻る」で戻る"
    : "ドラッグ：見回す ／ ホイール：画角変更 ／ Esc：全体表示"
};

// ============================================================
// 資料に基づく基本値
//
// 出典：
// 京都スタジアム（仮称）インフォメーションパッケージ p.15 / p.18
//
// ・フィールド：126m × 84m
// ・天然芝：120m × 77m
// ・最前列床面：フィールド面 + 1.2m
// ・最前列まで：
//    メイン 8.5m / バック 7.5m / サイド 10.5m
// ・下層傾斜：21〜24° → モデルでは中間の22.5°
// ・上層傾斜：32°
// ・一般席幅：47cm
// ・建物高さ：27.6m
// ============================================================

const DATA = {
  field: {
    eastWest: 84,
    northSouth: 126,
    turfEastWest: 77,
    turfNorthSouth: 120,
    playingEastWest: 68,
    playingNorthSouth: 105
  },

  firstRowFloorHeight: 1.2,

  firstRowDistance: {
    W: 8.5,
    E: 7.5,
    N: 10.5,
    S: 10.5
  },

  slopes: {
    lower: 22.5,
    upper: 32
  },

  assumed: {
    // 公開図面から未確定のため、モデル上の仮定値
    lowerRowDepth: 0.78,
    upperRowDepth: 0.84,
    lowerRows: 26,
    upperRows: 18,
    upperSetback: 3.8,
    upperBaseHeight: 10.0,
    seatSpacing: 0.52,
    eyeHeightAboveSeat: 1.15
  },

  colors: {
    W: "#d47a25",
    E: "#ab2548",
    S: "#174b38",
    N: "#14599b"
  }
};

// ============================================================
// ブロック定義
//
// 2025年館内図をベースにブロック名を登録。
// Wは W1〜W17
// Eは E1〜E17 および E21〜E39
// Sは S1〜S13 および S21〜S34
// Nは N1〜N13 および N21〜N34
//
// なお upper / lower は3Dモデル用の便宜的な区分。
// 実際の各ブロックの座席層とは完全には一致しない。
// ============================================================

const BLOCKS = [];

function addBlocks(stand, start, end, tier = "lower") {
  for (let i = start; i <= end; i++) {
    BLOCKS.push({
      id: `${stand}${i}`,
      stand,
      number: i,
      tier,
      label: `${stand}${i}`
    });
  }
}

addBlocks("W", 1, 17, "lower");
addBlocks("E", 1, 17, "lower");
addBlocks("S", 1, 13, "lower");
addBlocks("N", 1, 13, "lower");

addBlocks("E", 21, 39, "upper");
addBlocks("S", 21, 34, "upper");
addBlocks("N", 21, 34, "upper");

// ============================================================
// Three.js 初期化
// ============================================================

const scene = new THREE.Scene();
scene.background = new THREE.Color("#a9c0d2");
scene.fog = new THREE.Fog("#a9c0d2", 180, 390);

const camera = new THREE.PerspectiveCamera(
  58,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
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
controls.minDistance = 10;
controls.maxPolarAngle = Math.PI / 2 - 0.02;
controls.target.set(0, 7, 0);

// 全体表示の見下ろす向き。距離は画面の縦横比から決めるので、ここは向きだけ持つ。
const OVERVIEW_TARGET = new THREE.Vector3(0, 8, 0);
const OVERVIEW_DIRECTION =
  new THREE.Vector3(145, 117, 155).normalize();

// スタジアム外形（外壁の角）が収まる半径
const OVERVIEW_RADIUS = 132;

// 縦長の画面では横の画角が狭くなり、既定の距離だとスタジアムが入りきらない。
// 縦横のうち狭いほうの画角に合わせて距離を出す。
function overviewDistance() {
  const vertical = THREE.MathUtils.degToRad(camera.fov);
  const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * camera.aspect);
  const narrow = Math.max(0.2, Math.min(vertical, horizontal));

  return OVERVIEW_RADIUS / Math.sin(narrow / 2);
}

// 霧は距離に合わせて動かす。固定のままだと、引いたときに全体が霧へ沈む。
function applyOverviewRange(distance) {
  scene.fog.near = distance * 0.55;
  scene.fog.far = distance * 1.9;
  controls.maxDistance = distance * 1.3;
}

const hemi = new THREE.HemisphereLight("#eaf5ff", "#48534c", 2.1);
scene.add(hemi);

const sun = new THREE.DirectionalLight("#fff3de", 3.0);
sun.position.set(-75, 140, 80);
sun.castShadow = true;

// 影のカメラは既定だと10m四方しか映さず、スタジアムのほとんどが範囲外になる。
// 建物が収まる大きさに広げてから影を焼く。
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -180;
sun.shadow.camera.right = 180;
sun.shadow.camera.top = 180;
sun.shadow.camera.bottom = -180;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 420;
sun.shadow.bias = -0.0006;
scene.add(sun);

// ============================================================
// マテリアル
// ============================================================

const materials = {
  concrete: new THREE.MeshStandardMaterial({
    color: "#77727d",
    roughness: 0.92
  }),

  darkConcrete: new THREE.MeshStandardMaterial({
    color: "#403f48",
    roughness: 0.94
  }),

  metal: new THREE.MeshStandardMaterial({
    color: "#717886",
    metalness: 0.55,
    roughness: 0.45
  }),

  roof: new THREE.MeshStandardMaterial({
    color: "#d7d9de",
    metalness: 0.38,
    roughness: 0.55,
    side: THREE.DoubleSide
  }),

  glassRoof: new THREE.MeshStandardMaterial({
    color: "#9fc4ce",
    transparent: true,
    opacity: 0.46,
    metalness: 0.1,
    roughness: 0.25,
    side: THREE.DoubleSide
  }),

  pitchWhite: new THREE.LineBasicMaterial({
    color: "#ffffff"
  })
};

// ============================================================
// ユーティリティ
// ============================================================

function makeBox(w, h, d, material, x = 0, y = 0, z = 0, parent = scene) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    material
  );

  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);

  return mesh;
}

function createTextSprite(text, color = "#ffffff") {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 96;

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(15, 12, 22, .76)";

  // roundRect は古いSafariに無い。角丸が無くても読めればよいので四角で描く。
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(16, 15, 224, 66, 12);
    ctx.fill();
  } else {
    ctx.fillRect(16, 15, 224, 66);
  }

  ctx.fillStyle = color;
  ctx.font = "bold 36px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 128, 49);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false
    })
  );

  sprite.scale.set(8, 3, 1);
  return sprite;
}

function line(points) {
  const geometry = new THREE.BufferGeometry().setFromPoints(
    points.map(([x, y, z]) => new THREE.Vector3(x, y, z))
  );

  const object = new THREE.Line(geometry, materials.pitchWhite);
  scene.add(object);
  return object;
}

function rectLine(x1, z1, x2, z2) {
  line([
    [x1, 0.05, z1],
    [x2, 0.05, z1],
    [x2, 0.05, z2],
    [x1, 0.05, z2],
    [x1, 0.05, z1]
  ]);
}

// ============================================================
// フィールド
// ============================================================

const groups = {
  structure: new THREE.Group(),
  roof: new THREE.Group(),
  blocks: new THREE.Group(),
  labels: new THREE.Group(),
  seats: new THREE.Group(),
  screens: new THREE.Group()
};

scene.add(
  groups.structure,
  groups.roof,
  groups.blocks,
  groups.labels,
  groups.seats,
  groups.screens
);

const turfMaterialA = new THREE.MeshStandardMaterial({
  color: "#2c7c46",
  roughness: 0.95
});

const turfMaterialB = new THREE.MeshStandardMaterial({
  color: "#388d51",
  roughness: 0.95
});

makeBox(
  220, 0.35, 250,
  new THREE.MeshStandardMaterial({ color: "#6e826c", roughness: 1 }),
  0, -0.48, 0,
  groups.structure
);

makeBox(
  DATA.field.eastWest,
  0.10,
  DATA.field.northSouth,
  new THREE.MeshStandardMaterial({ color: "#28703d", roughness: 1 }),
  0, -0.12, 0
);

const stripeCount = 16;
const stripeWidth = DATA.field.turfEastWest / stripeCount;

for (let i = 0; i < stripeCount; i++) {
  makeBox(
    stripeWidth,
    0.08,
    DATA.field.turfNorthSouth,
    i % 2 === 0 ? turfMaterialA : turfMaterialB,
    -DATA.field.turfEastWest / 2 + stripeWidth * (i + .5),
    -0.03,
    0
  );
}

// サッカーの競技エリア（105 × 68m）
const px = DATA.field.playingEastWest / 2;
const pz = DATA.field.playingNorthSouth / 2;

rectLine(-px, -pz, px, pz);
line([[0, 0.05, -pz], [0, 0.05, pz]]);

function circleLine(cx, cz, radius, start = 0, end = Math.PI * 2) {
  const points = [];
  for (let i = 0; i <= 80; i++) {
    const a = start + (end - start) * (i / 80);
    points.push([
      cx + Math.cos(a) * radius,
      0.05,
      cz + Math.sin(a) * radius
    ]);
  }
  line(points);
}

circleLine(0, 0, 9.15);

function dot(x, z) {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(0.13, 16),
    new THREE.MeshBasicMaterial({ color: "#ffffff" })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, 0.055, z);
  scene.add(mesh);
}

dot(0, 0);

for (const side of [-1, 1]) {
  const goalX = side * px;
  const penaltyX = side * 19.16;
  const sixX = side * 30.16;

  rectLine(
    Math.min(goalX, penaltyX),
    -20.16,
    Math.max(goalX, penaltyX),
    20.16
  );

  rectLine(
    Math.min(goalX, sixX),
    -9.16,
    Math.max(goalX, sixX),
    9.16
  );

  dot(side * 30.5, 0);
}

// ============================================================
// スタンド基礎
// ============================================================

const fieldHalfX = DATA.field.eastWest / 2;
const fieldHalfZ = DATA.field.northSouth / 2;

const standDefinitions = {
  W: {
    side: "west",
    color: DATA.colors.W,
    distance: DATA.firstRowDistance.W,
    blocks: 17
  },

  E: {
    side: "east",
    color: DATA.colors.E,
    distance: DATA.firstRowDistance.E,
    blocks: 17
  },

  S: {
    side: "south",
    color: DATA.colors.S,
    distance: DATA.firstRowDistance.S,
    blocks: 13
  },

  N: {
    side: "north",
    color: DATA.colors.N,
    distance: DATA.firstRowDistance.N,
    blocks: 13
  }
};

function getStandGeometry(stand, tier = "lower") {
  const def = standDefinitions[stand];

  const isWestEast = stand === "W" || stand === "E";
  const sign = stand === "W" || stand === "S" ? -1 : 1;

  const rowDepth =
    tier === "lower"
      ? DATA.assumed.lowerRowDepth
      : DATA.assumed.upperRowDepth;

  const rows =
    tier === "lower"
      ? DATA.assumed.lowerRows
      : DATA.assumed.upperRows;

  const slope =
    tier === "lower"
      ? DATA.slopes.lower
      : DATA.slopes.upper;

  const rise = rowDepth * Math.tan(
    THREE.MathUtils.degToRad(slope)
  );

  const depth = rowDepth * rows;

  const front =
    def.distance +
    (tier === "upper"
      ? DATA.assumed.upperSetback + DATA.assumed.lowerRows * DATA.assumed.lowerRowDepth
      : 0);

  const baseHeight =
    tier === "lower"
      ? DATA.firstRowFloorHeight
      : DATA.assumed.upperBaseHeight;

  return {
    isWestEast,
    sign,
    rowDepth,
    rows,
    slope,
    rise,
    depth,
    front,
    baseHeight
  };
}

function standPosition(stand, tier, along, rowRatio) {
  const g = getStandGeometry(stand, tier);
  const rowIndex = rowRatio * (g.rows - 1);
  const outward = g.front + rowIndex * g.rowDepth;
  const floorHeight = g.baseHeight + rowIndex * g.rise;

  if (stand === "W") {
    return new THREE.Vector3(
      -(fieldHalfX + outward),
      floorHeight,
      along
    );
  }

  if (stand === "E") {
    return new THREE.Vector3(
      fieldHalfX + outward,
      floorHeight,
      along
    );
  }

  if (stand === "S") {
    return new THREE.Vector3(
      along,
      floorHeight,
      -(fieldHalfZ + outward)
    );
  }

  return new THREE.Vector3(
    along,
    floorHeight,
    fieldHalfZ + outward
  );
}

// ============================================================
// 下層・上層スタンドの段床
// ============================================================

function createTerraces(stand, tier, span) {
  const g = getStandGeometry(stand, tier);

  for (let row = 0; row < g.rows; row++) {
    const outer = g.front + row * g.rowDepth;
    const h = g.baseHeight + row * g.rise;

    if (g.isWestEast) {
      const standX =
        stand === "W"
          ? -(fieldHalfX + outer)
          : fieldHalfX + outer;

      makeBox(
        g.rowDepth,
        h,
        span,
        materials.concrete,
        standX,
        h / 2,
        0,
        groups.structure
      );
    } else {
      const standZ =
        stand === "S"
          ? -(fieldHalfZ + outer)
          : fieldHalfZ + outer;

      makeBox(
        span,
        h,
        g.rowDepth,
        materials.concrete,
        0,
        h / 2,
        standZ,
        groups.structure
      );
    }
  }
}

createTerraces("W", "lower", 134);
createTerraces("E", "lower", 134);
createTerraces("S", "lower", 90);
createTerraces("N", "lower", 90);

createTerraces("E", "upper", 134);
createTerraces("S", "upper", 90);
createTerraces("N", "upper", 90);

// ============================================================
// ブロック形状
// ============================================================

const blockMeshes = [];
const selectedMaterial = new THREE.MeshStandardMaterial({
  color: "#ffd158",
  emissive: "#8a5b00",
  emissiveIntensity: 0.35,
  roughness: 0.58
});

function getBlockLayout(block) {
  const stand = block.stand;
  const tier = block.tier;
  const g = getStandGeometry(stand, tier);

  let count = 1;
  let index = 0;

  if (stand === "W") {
    count = 17;
    index = block.number - 1;
  }

  if (stand === "E") {
    count = tier === "upper" ? 19 : 17;
    index = tier === "upper" ? block.number - 21 : block.number - 1;
  }

  if (stand === "S" || stand === "N") {
    count = tier === "upper" ? 14 : 13;
    index = tier === "upper" ? block.number - 21 : block.number - 1;
  }

  const span = (stand === "W" || stand === "E") ? 134 : 90;
  const segment = span / count;

  const along = -span / 2 + segment * (index + .5);

  return {
    span,
    segment,
    along,
    rowDepth: g.rowDepth,
    depth: g.depth,
    baseHeight: g.baseHeight,
    rise: g.rise,
    slope: g.slope
  };
}

function createBlock(block) {
  const layout = getBlockLayout(block);
  const stand = block.stand;
  const g = getStandGeometry(stand, block.tier);

  const color = new THREE.Color(DATA.colors[stand]);
  color.multiplyScalar(block.tier === "upper" ? 0.82 : 1.0);

  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.72,
    transparent: true,
    opacity: 0.92
  });

  const blockHeight = g.baseHeight + g.rise * (g.rows - 1);
  const outer = g.front + g.depth / 2;

  let mesh;

  if (stand === "W" || stand === "E") {
    const x =
      stand === "W"
        ? -(fieldHalfX + outer)
        : fieldHalfX + outer;

    mesh = makeBox(
      g.depth,
      blockHeight,
      layout.segment - 0.18,
      material,
      x,
      blockHeight / 2,
      layout.along,
      groups.blocks
    );
  } else {
    const z =
      stand === "S"
        ? -(fieldHalfZ + outer)
        : fieldHalfZ + outer;

    mesh = makeBox(
      layout.segment - 0.18,
      blockHeight,
      g.depth,
      material,
      layout.along,
      blockHeight / 2,
      z,
      groups.blocks
    );
  }

  mesh.userData.block = block;
  mesh.userData.baseMaterial = material;
  blockMeshes.push(mesh);

  const labelPosition = standPosition(
    stand,
    block.tier,
    layout.along,
    .55
  );

  labelPosition.y += 6;

  const label = createTextSprite(block.id, "#ffffff");
  label.position.copy(labelPosition);
  label.userData.block = block;

  groups.labels.add(label);
}

BLOCKS.forEach(createBlock);

// ============================================================
// 屋根・外壁の概略モデル
// ============================================================

function makeRoofPanel(w, d, x, z, material) {
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.7, d),
    material
  );

  roof.position.set(x, 24.5, z);
  roof.castShadow = true;
  roof.receiveShadow = true;
  groups.roof.add(roof);
}

// 西メイン屋根
makeRoofPanel(36, 148, -61, 0, materials.roof);

// 東バック屋根
makeRoofPanel(34, 148, 61, 0, materials.roof);

// 北スタンド屋根
makeRoofPanel(104, 35, 0, 84, materials.roof);

// 南スタンド屋根：資料にあるガラストップライトを概略表現
makeRoofPanel(104, 35, 0, -84, materials.glassRoof);

// 外壁概略
makeBox(8, 18, 150, materials.darkConcrete, -77, 9, 0, groups.structure);
makeBox(8, 18, 150, materials.darkConcrete, 77, 9, 0, groups.structure);
makeBox(150, 18, 8, materials.darkConcrete, 0, 9, -100, groups.structure);
makeBox(150, 18, 8, materials.darkConcrete, 0, 9, 100, groups.structure);

// 大型映像装置の概略
const screenMaterial = new THREE.MeshStandardMaterial({
  color: "#171924",
  emissive: "#13172b",
  emissiveIntensity: 0.5
});

// 位置は未確認。いまの値だとメイン・バックの上層から見て正面に入るため、
// 単独で消せるように外壁とは別のグループへ置く。
makeBox(0.5, 8, 16, screenMaterial, -58, 14, 0, groups.screens);
makeBox(0.5, 8, 16, screenMaterial, 58, 14, 0, groups.screens);

// ============================================================
// 簡易座席表現
// 実際の全席を厳密に作るのではなく、
// 各スタンドに視認用の座席グリッドを生成する。
// ============================================================

function createSeatGrid(stand, tier, span, colorHex) {
  const g = getStandGeometry(stand, tier);
  const countAcross = Math.floor(span / 1.2);
  const countRows = Math.min(g.rows, 16);

  const seatGeometry = new THREE.BoxGeometry(.34, .28, .36);
  const material = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: .75
  });

  const mesh = new THREE.InstancedMesh(
    seatGeometry,
    material,
    countAcross * countRows
  );

  const dummy = new THREE.Object3D();
  let index = 0;

  for (let row = 0; row < countRows; row++) {
    const rowRatio = row / Math.max(1, countRows - 1);

    for (let col = 0; col < countAcross; col++) {
      const along = -span / 2 + span * ((col + .5) / countAcross);
      const pos = standPosition(stand, tier, along, rowRatio);

      pos.y += .25;

      dummy.position.copy(pos);

      if (stand === "W") dummy.rotation.y = Math.PI / 2;
      if (stand === "E") dummy.rotation.y = -Math.PI / 2;
      if (stand === "S") dummy.rotation.y = 0;
      if (stand === "N") dummy.rotation.y = Math.PI;

      dummy.updateMatrix();
      mesh.setMatrixAt(index++, dummy.matrix);
    }
  }

  groups.seats.add(mesh);
}

createSeatGrid("W", "lower", 134, "#dc7a30");
createSeatGrid("E", "lower", 134, "#b72a54");
createSeatGrid("S", "lower", 90, "#245f4a");
createSeatGrid("N", "lower", 90, "#2267ad");

createSeatGrid("E", "upper", 134, "#7f1f3d");
createSeatGrid("S", "upper", 90, "#174533");
createSeatGrid("N", "upper", 90, "#164b82");

// ============================================================
// UI
// ============================================================

let selectedBlock = null;
let selectedMesh = null;
let mode = "overview";
let yaw = 0;
let pitch = 0;

function standName(stand) {
  return {
    W: "メインスタンド（西）",
    E: "バックスタンド（東）",
    S: "南サイドスタンド",
    N: "北サイドスタンド"
  }[stand];
}

function blocksOf(stand, tier) {
  return BLOCKS.filter(block =>
    block.stand === stand &&
    block.tier === tier
  );
}

// Wには上層ブロックを登録していない。選べる層だけを選べるようにする。
function syncTierOptions() {
  const stand = $("stand").value;
  const tierSelect = $("tier");

  let available = null;

  for (const option of tierSelect.options) {
    const usable = blocksOf(stand, option.value).length > 0;
    option.disabled = !usable;
    if (usable && !available) available = option.value;
  }

  if (tierSelect.selectedOptions[0]?.disabled && available) {
    tierSelect.value = available;
  }
}

function updateBlockOptions() {
  const stand = $("stand").value;
  const tier = $("tier").value;
  const select = $("block");

  const filtered = blocksOf(stand, tier);

  select.innerHTML = "";

  if (!filtered.length) {
    const option = document.createElement("option");
    option.textContent = "この層には登録ブロックがありません";
    option.disabled = true;
    option.selected = true;
    select.appendChild(option);
    return;
  }

  filtered.forEach(block => {
    const option = document.createElement("option");
    option.value = block.id;
    option.textContent = block.id;
    select.appendChild(option);
  });
}

function findBlock(id) {
  return BLOCKS.find(block => block.id === id);
}

function updateSliderLabels() {
  const row = Number($("row").value);
  const seat = Number($("seat").value);

  $("rowValue").textContent =
    row < 25 ? "前方" :
    row > 75 ? "後方" :
    "中央";

  $("seatValue").textContent =
    seat < 25 ? "左寄り" :
    seat > 75 ? "右寄り" :
    "中央";
}

function updateInfo(block, position) {
  if (!position) return;

  const tierName =
    block.tier === "lower"
      ? "下層スタンド"
      : "上層スタンド";

  const g = getStandGeometry(block.stand, block.tier);

  const center = new THREE.Vector3(0, 0, 0);
  const distance = position.distanceTo(center).toFixed(1);

  $("info").innerHTML = `
    <strong>${standName(block.stand)} / ${block.id}</strong><br>
    層：${tierName}<br>
    ピッチ中央まで：約${distance}m<br>
    視点床面高：約${position.y.toFixed(1)}m<br>
    スタンド傾斜：約${g.slope}°<br>
    <small>※列・席番号ではなくブロック内の概算位置です。</small>
  `;
}

function selectBlock(block) {
  if (selectedMesh) {
    selectedMesh.material = selectedMesh.userData.baseMaterial;
  }

  selectedBlock = block;

  selectedMesh = blockMeshes.find(mesh =>
    mesh.userData.block.id === block.id
  );

  if (selectedMesh) {
    selectedMesh.material = selectedMaterial;
  }

  $("stand").value = block.stand;
  syncTierOptions();
  $("tier").value = block.tier;
  updateBlockOptions();
  $("block").value = block.id;
}

function getSelectedPosition() {
  const block = selectedBlock || findBlock($("block").value);

  if (!block) return null;

  const layout = getBlockLayout(block);
  const rowRatio = Number($("row").value) / 100;
  const seatRatio = Number($("seat").value) / 100;

  const along =
    layout.along +
    layout.segment * (seatRatio - .5) * .78;

  const position = standPosition(
    block.stand,
    block.tier,
    along,
    rowRatio
  );

  position.y += DATA.assumed.eyeHeightAboveSeat;

  return position;
}

function lookAtPitchCenter() {
  if (mode !== "seat") return;

  const target = new THREE.Vector3(0, 0.4, 0);
  const direction = target.clone().sub(camera.position).normalize();

  yaw = Math.atan2(direction.x, -direction.z);
  pitch = Math.asin(direction.y);

  updateSeatCameraDirection();
}

function updateSeatCameraDirection() {
  const direction = new THREE.Vector3(
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    -Math.cos(yaw) * Math.cos(pitch)
  );

  camera.lookAt(camera.position.clone().add(direction));
}

function viewFromSelectedSeat() {
  const block = selectedBlock || findBlock($("block").value);
  const position = getSelectedPosition();

  if (!block || !position) {
    $("status").textContent = "この層には登録ブロックがありません";
    return;
  }

  selectBlock(block);

  controls.enabled = false;
  controls.enableDamping = false;
  controls.update();

  mode = "seat";

  // ブロックの色板はスタンド全体を覆う1枚の箱で、選ぶための目印。
  // 着席視点では段床と座席をふさいでしまうので、座ったら消す。
  groups.blocks.visible = false;

  camera.position.copy(position);
  camera.fov = 66;
  camera.updateProjectionMatrix();

  lookAtPitchCenter();
  updateInfo(block, position);

  $("status").textContent =
    `${standName(block.stand)} / ${block.id}｜着席視点（概算）`;

  $("help").textContent = HELP.seat;

  if (isNarrow()) setPanelCollapsed(true);
}

function overview() {
  mode = "overview";
  groups.blocks.visible = true;
  controls.enabled = true;
  controls.enableDamping = false;

  camera.fov = 58;
  camera.updateProjectionMatrix();

  const distance = overviewDistance();
  applyOverviewRange(distance);

  camera.position
    .copy(OVERVIEW_DIRECTION)
    .multiplyScalar(distance)
    .add(OVERVIEW_TARGET);

  controls.target.copy(OVERVIEW_TARGET);
  controls.update();
  controls.enableDamping = !prefersReducedMotion;

  $("status").textContent =
    selectedBlock
      ? `全体表示｜選択中：${selectedBlock.id}`
      : "全体表示｜ブロックを選択してください";

  $("help").textContent = HELP.overview;
}

$("stand").addEventListener("change", () => {
  syncTierOptions();
  updateBlockOptions();
  selectedBlock = null;
});

$("tier").addEventListener("change", () => {
  updateBlockOptions();
  selectedBlock = null;
});

$("block").addEventListener("change", () => {
  const block = findBlock($("block").value);
  if (block) selectBlock(block);
});

$("row").addEventListener("input", updateSliderLabels);
$("seat").addEventListener("input", updateSliderLabels);

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

$("viewButton").addEventListener("click", viewFromSelectedSeat);
$("overviewButton").addEventListener("click", overview);
$("centerButton").addEventListener("click", lookAtPitchCenter);

$("roofToggle").addEventListener("change", event => {
  groups.roof.visible = event.target.checked;
});

$("seatToggle").addEventListener("change", event => {
  groups.seats.visible = event.target.checked;
});

$("labelToggle").addEventListener("change", event => {
  groups.labels.visible = event.target.checked;
});

$("structureToggle").addEventListener("change", event => {
  groups.structure.visible = event.target.checked;
});

$("screenToggle").addEventListener("change", event => {
  groups.screens.visible = event.target.checked;
});

// ============================================================
// ブロック選択・マウス操作
// ============================================================

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const tooltip = $("tooltip");

function getBlockHit(event) {
  const rect = renderer.domElement.getBoundingClientRect();

  pointer.x =
    ((event.clientX - rect.left) / rect.width) * 2 - 1;

  pointer.y =
    -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);

  return raycaster.intersectObjects(blockMeshes, false)[0];
}

let drag = null;

renderer.domElement.addEventListener("pointerdown", event => {
  if (event.button !== 0) return;

  drag = {
    id: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    lastX: event.clientX,
    lastY: event.clientY,
    moved: false
  };

  renderer.domElement.setPointerCapture(event.pointerId);
});

renderer.domElement.addEventListener("pointermove", event => {
  if (drag && drag.id === event.pointerId) {
    const dx = event.clientX - drag.lastX;
    const dy = event.clientY - drag.lastY;

    if (
      Math.hypot(
        event.clientX - drag.startX,
        event.clientY - drag.startY
      ) > 5
    ) {
      drag.moved = true;
    }

    if (mode === "seat") {
      yaw -= dx * 0.004;
      pitch = THREE.MathUtils.clamp(
        pitch + dy * 0.004,
        -Math.PI * .46,
        Math.PI * .46
      );

      updateSeatCameraDirection();
    }

    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    tooltip.style.display = "none";
    return;
  }

  if (mode !== "overview") return;

  const hit = getBlockHit(event);

  if (hit) {
    const block = hit.object.userData.block;
    renderer.domElement.style.cursor = "pointer";

    tooltip.style.display = "block";
    tooltip.textContent =
      `${block.id} / ${standName(block.stand)}`;

    tooltip.style.left =
      Math.min(event.clientX + 12, window.innerWidth - 220) + "px";

    tooltip.style.top = event.clientY + 12 + "px";
  } else {
    renderer.domElement.style.cursor = "default";
    tooltip.style.display = "none";
  }
});

renderer.domElement.addEventListener("pointerup", event => {
  if (!drag || drag.id !== event.pointerId) return;

  const shouldSelect =
    !drag.moved &&
    mode === "overview";

  drag = null;

  if (!shouldSelect) return;

  const hit = getBlockHit(event);

  if (hit) {
    const block = hit.object.userData.block;
    selectBlock(block);

    const pos = getSelectedPosition();
    updateInfo(block, pos);

    $("status").textContent =
      `${standName(block.stand)} / ${block.id} を選択`;
  }
});

renderer.domElement.addEventListener("pointerleave", () => {
  tooltip.style.display = "none";
});

renderer.domElement.addEventListener("wheel", event => {
  if (mode !== "seat") return;

  event.preventDefault();

  camera.fov = THREE.MathUtils.clamp(
    camera.fov + event.deltaY * .035,
    35,
    90
  );

  camera.updateProjectionMatrix();
}, { passive: false });

window.addEventListener("keydown", event => {
  if (event.key === "Escape") overview();
});

window.addEventListener("resize", () => {
  camera.aspect =
    window.innerWidth / window.innerHeight;

  camera.updateProjectionMatrix();

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );

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

syncTierOptions();
updateBlockOptions();
updateSliderLabels();
setPanelCollapsed(isNarrow());
overview();
clearBoot();

renderer.setAnimationLoop(() => {
  if (mode === "overview") {
    controls.update();
  }

  renderer.render(scene, camera);
});
