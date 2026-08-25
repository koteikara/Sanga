/*
 * iframe（本番ページ）の中へ差し込むベンチのCSS。
 * 本番へ移植するときは、この文字列の中身をそのまま public/assets/squad.css の
 * ベンチのブロックへ移す。ここに置いているのは、プロトタイプ側から
 * 差し替えて比べられるようにするため。
 *
 * 設計の要点:
 *   - 見せ方はキャンバスの data-bench-format で分岐する（chip / tile）。
 *     :has() は iOS Safari 15系に無いため使わない。
 *   - 大きさは --bench-emphasis の「倍率」で持ち、人数に応じた既存の
 *     自動縮小 --bench-scale と掛け算する。こうすると見せ方が増えても
 *     はみ出しを防ぐ仕組みは1本のままで済む。
 *   - 倍率は見せ方ごとに変える（チップ 1.35 / タイル 1.9）。本番の
 *     layoutPitch() はカードが下限に近づくとベンチを最大0.2ぶん縮めて
 *     ピッチを優先するため、控えめな倍率だとタイルでは打ち消される。
 *     タイルの倍率を上げると、そのぶんスタメンのカードが小さくなる。
 *   - フッターの上限だけは見せ方ごとに変える（chip 24% / tile 32%）。
 *     ピッチの min-height:60% は触らないので、取り合いの上限は既存のまま。
 */
export const BENCH_OVERLAY_CSS = `
/* ---- 共通：倍率を1本にまとめる ---- */
[data-bench-format] .bench{
  --bench-emphasis:1;
  --bench-size:calc(var(--bench-scale, 1) * var(--bench-emphasis));
}
[data-bench-format="chip"][data-bench-emphasis="large"] .bench{--bench-emphasis:1.35}
[data-bench-format="tile"][data-bench-emphasis="large"] .bench{--bench-emphasis:1.9}

/* ---- チップ（現行の見せ方）---- */
[data-bench-format="chip"] .bench{gap:calc(.7cqw * var(--bench-size)) calc(1cqw * var(--bench-size))}
[data-bench-format="chip"] .bench-slot{
  font-size:calc(2.2cqw * var(--bench-size));
  padding:calc(.9cqw * var(--bench-size)) calc(2.2cqw * var(--bench-size));
  min-height:calc(5.2cqw * var(--bench-size));
}

/* ---- 背番号タイル（追加する見せ方）---- */
[data-bench-format="tile"] .bench{
  gap:calc(1cqw * var(--bench-size)) calc(1.2cqw * var(--bench-size));
  justify-content:center;
}
[data-bench-format="tile"] .bench-slot{
  background:none;border:none;border-radius:0;padding:0;min-height:0;
  flex-direction:column;align-items:center;
  width:calc(8.2cqw * var(--bench-size));
}
[data-bench-format="tile"] .bench-face{
  /* 角を少し丸めた四角。スタメンの盾型とも、シンプルの円とも見分けがつく。
     タイル画像がもともと正方形なので、円より画像を大きく見せられる。 */
  width:100%;aspect-ratio:1/1;border-radius:14%;overflow:hidden;
  /* 背番号タイル画像の地色。枠と画像の境目を出さない */
  background:#750069;position:relative;display:block;
}
[data-bench-format="tile"] .bench-face img{
  /* スタメンのカードと同じ考え方。画像ごとの焼き込み位置のずれを打ち消す */
  position:absolute;left:50%;top:0;height:100%;width:auto;max-width:none;
  transform:translate(
    calc(-50% + var(--tile-dx, 0) * 1%),
    calc(var(--tile-dy, 0) * 1%)
  );
}
[data-bench-format="tile"] .bench-name{
  display:inline-block;white-space:nowrap;transform-origin:center;
  font-size:calc(1.9cqw * var(--bench-size));
  font-weight:800;margin-top:calc(.4cqw * var(--bench-size));
  color:#e6d7f0;
}
/* 名前が読めない大きさになるくらい縮むなら、名前を出さず円だけにする */
[data-bench-format="tile"][data-bench-name="off"] .bench-name{display:none}

/* 見せ方ごとのフッター上限。ピッチの取り分（min-height:60%）は変えない */
[data-bench-format="tile"] .sq-footer{max-height:32%}

/* 明るい地色のスタイルでは、名前も暗い側へ寄せる */
[data-style="scrap"][data-bench-format="tile"] .bench-name{color:#2b0a3d}
`;
