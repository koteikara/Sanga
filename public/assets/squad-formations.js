// フォーメーションのプリセット定義。
//
// 座標はピッチ上の相対位置（%）で持つ。
//   x: 左右（0が左端、100が右端）
//   y: 上下（0が相手ゴール側＝上辺、100が自陣ゴール側＝下辺）
//
// ポジション表記は GK / DF / MF / FW の4種類だけにする。
// 細かい表記（LSB、CMFなど）は使わない。
//
// 「自由配置」は 4-4-2 の座標を初期値として使う。

/** 1列ぶんのスロットを作る。xs は左から順の位置 */
function line(group, y, xs) {
  return xs.map((x) => ({ posGroup: group, posLabel: group, x, y }));
}

/** 列をつなげて、通し番号のidを振る */
function build(...lines) {
  return lines.flat().map((slot, i) => ({ id: `s${i + 1}`, ...slot }));
}

/** 上下の基準位置。列の役割ごとにそろえる */
const Y = {
  gk: 90,
  df: 70,
  dm: 54,
  mf: 44,
  am: 29,
  fw: 14,
};

const FOUR_BACK = line("DF", Y.df, [16, 38, 62, 84]);
const THREE_BACK = line("DF", Y.df, [28, 50, 72]);
const FIVE_BACK = line("DF", Y.df, [10, 30, 50, 70, 90]);
const GK = line("GK", Y.gk, [50]);

export const FORMATIONS = {
  "4-4-2": {
    label: "4-4-2",
    slots: build(GK, FOUR_BACK, line("MF", Y.mf, [16, 38, 62, 84]), line("FW", Y.fw, [37, 63])),
  },
  "4-4-1-1": {
    label: "4-4-1-1",
    slots: build(GK, FOUR_BACK, line("MF", Y.mf, [16, 38, 62, 84]), line("MF", Y.am, [50]), line("FW", 12, [50])),
  },
  "4-2-3-1": {
    label: "4-2-3-1",
    slots: build(GK, FOUR_BACK, line("MF", Y.dm, [37, 63]), line("MF", Y.am, [18, 50, 82]), line("FW", 12, [50])),
  },
  "4-3-3": {
    label: "4-3-3",
    slots: build(GK, FOUR_BACK, line("MF", Y.mf, [28, 50, 72]), line("FW", 15, [16, 50, 84])),
  },
  "4-1-4-1": {
    label: "4-1-4-1",
    slots: build(GK, FOUR_BACK, line("MF", 56, [50]), line("MF", 38, [16, 38, 62, 84]), line("FW", 13, [50])),
  },
  "4-3-1-2": {
    label: "4-3-1-2",
    slots: build(GK, FOUR_BACK, line("MF", 50, [26, 50, 74]), line("MF", 30, [50]), line("FW", 13, [37, 63])),
  },
  "4-1-2-1-2": {
    label: "4-1-2-1-2",
    slots: build(GK, FOUR_BACK, line("MF", 56, [50]), line("MF", Y.mf, [24, 76]), line("MF", 30, [50]), line("FW", 13, [37, 63])),
  },
  "4-2-2-2": {
    label: "4-2-2-2",
    slots: build(GK, FOUR_BACK, line("MF", Y.dm, [37, 63]), line("MF", 32, [26, 74]), line("FW", 13, [37, 63])),
  },
  "4-5-1": {
    label: "4-5-1",
    slots: build(GK, FOUR_BACK, line("MF", 42, [12, 32, 50, 68, 88]), line("FW", 13, [50])),
  },
  "3-4-2-1": {
    label: "3-4-2-1",
    slots: build(GK, THREE_BACK, line("MF", 45, [12, 38, 62, 88]), line("MF", 27, [35, 65]), line("FW", 12, [50])),
  },
  "3-4-3": {
    label: "3-4-3",
    slots: build(GK, THREE_BACK, line("MF", 45, [12, 38, 62, 88]), line("FW", 15, [18, 50, 82])),
  },
  "3-5-2": {
    label: "3-5-2",
    slots: build(GK, THREE_BACK, line("MF", 45, [10, 32, 50, 68, 90]), line("FW", Y.fw, [37, 63])),
  },
  "3-6-1": {
    label: "3-6-1",
    slots: build(GK, THREE_BACK, line("MF", 50, [14, 38, 62, 86]), line("MF", 30, [37, 63]), line("FW", 12, [50])),
  },
  "5-3-2": {
    label: "5-3-2",
    slots: build(GK, FIVE_BACK, line("MF", 45, [28, 50, 72]), line("FW", Y.fw, [37, 63])),
  },
  "5-4-1": {
    label: "5-4-1",
    slots: build(GK, FIVE_BACK, line("MF", Y.mf, [16, 38, 62, 84]), line("FW", 13, [50])),
  },
  "5-2-3": {
    label: "5-2-3",
    slots: build(GK, FIVE_BACK, line("MF", 48, [37, 63]), line("FW", 18, [18, 50, 82])),
  },
  free: {
    label: "自由配置",
    slots: build(GK, FOUR_BACK, line("MF", Y.mf, [16, 38, 62, 84]), line("FW", Y.fw, [37, 63])),
  },
};

/** ベンチの枠数 */
export const BENCH_SIZE = 9;
