// フォーメーションのプリセット定義。
// 各プリセットは、ピッチ上の相対座標（%、x=左右 0-100 / y=上下 0-100、
// 0がゴール裏＝上辺、100が自陣ゴール前＝下辺に近い）と
// ポジション名（表示用の略号）の配列として持つ。
// 「自由配置」は4-4-2の座標を初期値として使うが、posLabelは選手のポジションに追従する。

export const FORMATIONS = {
  "4-4-2": {
    label: "4-4-2",
    slots: [
      { id: "gk", posGroup: "GK", posLabel: "GK", x: 50, y: 90 },
      { id: "df1", posGroup: "DF", posLabel: "LSB", x: 16, y: 68 },
      { id: "df2", posGroup: "DF", posLabel: "CB", x: 38, y: 70 },
      { id: "df3", posGroup: "DF", posLabel: "CB", x: 62, y: 70 },
      { id: "df4", posGroup: "DF", posLabel: "RSB", x: 84, y: 68 },
      { id: "mf1", posGroup: "MF", posLabel: "LMF", x: 16, y: 42 },
      { id: "mf2", posGroup: "MF", posLabel: "CMF", x: 38, y: 44 },
      { id: "mf3", posGroup: "MF", posLabel: "CMF", x: 62, y: 44 },
      { id: "mf4", posGroup: "MF", posLabel: "RMF", x: 84, y: 42 },
      { id: "fw1", posGroup: "FW", posLabel: "ST", x: 37, y: 16 },
      { id: "fw2", posGroup: "FW", posLabel: "ST", x: 63, y: 16 },
    ],
  },
  "4-2-3-1": {
    label: "4-2-3-1",
    slots: [
      { id: "gk", posGroup: "GK", posLabel: "GK", x: 50, y: 90 },
      { id: "df1", posGroup: "DF", posLabel: "LSB", x: 16, y: 68 },
      { id: "df2", posGroup: "DF", posLabel: "CB", x: 38, y: 70 },
      { id: "df3", posGroup: "DF", posLabel: "CB", x: 62, y: 70 },
      { id: "df4", posGroup: "DF", posLabel: "RSB", x: 84, y: 68 },
      { id: "dm1", posGroup: "MF", posLabel: "DMF", x: 37, y: 50 },
      { id: "dm2", posGroup: "MF", posLabel: "DMF", x: 63, y: 50 },
      { id: "am1", posGroup: "MF", posLabel: "LAM", x: 18, y: 28 },
      { id: "am2", posGroup: "MF", posLabel: "CAM", x: 50, y: 26 },
      { id: "am3", posGroup: "MF", posLabel: "RAM", x: 82, y: 28 },
      { id: "fw1", posGroup: "FW", posLabel: "CF", x: 50, y: 12 },
    ],
  },
  "4-3-3": {
    label: "4-3-3",
    slots: [
      { id: "gk", posGroup: "GK", posLabel: "GK", x: 50, y: 90 },
      { id: "df1", posGroup: "DF", posLabel: "LSB", x: 16, y: 68 },
      { id: "df2", posGroup: "DF", posLabel: "CB", x: 38, y: 70 },
      { id: "df3", posGroup: "DF", posLabel: "CB", x: 62, y: 70 },
      { id: "df4", posGroup: "DF", posLabel: "RSB", x: 84, y: 68 },
      { id: "mf1", posGroup: "MF", posLabel: "CMF", x: 28, y: 44 },
      { id: "mf2", posGroup: "MF", posLabel: "CMF", x: 50, y: 48 },
      { id: "mf3", posGroup: "MF", posLabel: "CMF", x: 72, y: 44 },
      { id: "fw1", posGroup: "FW", posLabel: "LWG", x: 16, y: 16 },
      { id: "fw2", posGroup: "FW", posLabel: "CF", x: 50, y: 12 },
      { id: "fw3", posGroup: "FW", posLabel: "RWG", x: 84, y: 16 },
    ],
  },
  "3-4-2-1": {
    label: "3-4-2-1",
    slots: [
      { id: "gk", posGroup: "GK", posLabel: "GK", x: 50, y: 90 },
      { id: "df1", posGroup: "DF", posLabel: "CB", x: 28, y: 68 },
      { id: "df2", posGroup: "DF", posLabel: "CB", x: 50, y: 70 },
      { id: "df3", posGroup: "DF", posLabel: "CB", x: 72, y: 68 },
      { id: "mf1", posGroup: "MF", posLabel: "LMF", x: 12, y: 44 },
      { id: "mf2", posGroup: "MF", posLabel: "CMF", x: 38, y: 46 },
      { id: "mf3", posGroup: "MF", posLabel: "CMF", x: 62, y: 46 },
      { id: "mf4", posGroup: "MF", posLabel: "RMF", x: 88, y: 44 },
      { id: "am1", posGroup: "MF", posLabel: "LAM", x: 34, y: 24 },
      { id: "am2", posGroup: "MF", posLabel: "RAM", x: 66, y: 24 },
      { id: "fw1", posGroup: "FW", posLabel: "CF", x: 50, y: 12 },
    ],
  },
  "3-5-2": {
    label: "3-5-2",
    slots: [
      { id: "gk", posGroup: "GK", posLabel: "GK", x: 50, y: 90 },
      { id: "df1", posGroup: "DF", posLabel: "CB", x: 28, y: 68 },
      { id: "df2", posGroup: "DF", posLabel: "CB", x: 50, y: 70 },
      { id: "df3", posGroup: "DF", posLabel: "CB", x: 72, y: 68 },
      { id: "mf1", posGroup: "MF", posLabel: "LWB", x: 10, y: 46 },
      { id: "mf2", posGroup: "MF", posLabel: "CMF", x: 33, y: 42 },
      { id: "mf3", posGroup: "MF", posLabel: "CMF", x: 50, y: 46 },
      { id: "mf4", posGroup: "MF", posLabel: "CMF", x: 67, y: 42 },
      { id: "mf5", posGroup: "MF", posLabel: "RWB", x: 90, y: 46 },
      { id: "fw1", posGroup: "FW", posLabel: "ST", x: 38, y: 16 },
      { id: "fw2", posGroup: "FW", posLabel: "ST", x: 62, y: 16 },
    ],
  },
  free: {
    label: "自由配置",
    free: true,
    // 初期値は4-4-2と同じ。posLabelは配置後に選手のポジションで上書きする。
    slots: [
      { id: "gk", posGroup: "", posLabel: "FP", x: 50, y: 90 },
      { id: "df1", posGroup: "", posLabel: "FP", x: 16, y: 68 },
      { id: "df2", posGroup: "", posLabel: "FP", x: 38, y: 70 },
      { id: "df3", posGroup: "", posLabel: "FP", x: 62, y: 70 },
      { id: "df4", posGroup: "", posLabel: "FP", x: 84, y: 68 },
      { id: "mf1", posGroup: "", posLabel: "FP", x: 16, y: 42 },
      { id: "mf2", posGroup: "", posLabel: "FP", x: 38, y: 44 },
      { id: "mf3", posGroup: "", posLabel: "FP", x: 62, y: 44 },
      { id: "mf4", posGroup: "", posLabel: "FP", x: 84, y: 42 },
      { id: "fw1", posGroup: "", posLabel: "FP", x: 37, y: 16 },
      { id: "fw2", posGroup: "", posLabel: "FP", x: 63, y: 16 },
    ],
  },
};

export const BENCH_SIZE = 7;
