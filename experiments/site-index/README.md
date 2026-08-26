# 入口ページ プロトタイプ

`docs/site-index.md` の設計を、本番へ入れる前に動く形で確かめるための場所です。ここは検証用で、本番サーバーへは配信されません（本番デプロイは `public/` だけを送ります）。

## 見る

GitHub Pages の確認環境で見られます。

```text
https://koteikara.github.io/Sanga/experiments/site-index/prototype.html
https://koteikara.github.io/Sanga/experiments/site-index/prototype.html?nebula=off
```

`?nebula=off` を付けると WebGL の背景を使わず、CSSのぼかしだけになります。実機で見比べるためのものです。

## 何を確かめたいか

1. 紫を基調にしたときの雰囲気
2. 背景アニメーションの速さと主張の強さ（導線を邪魔しないか）
3. キャラクターの間の取り方（ふわふわ、まばたき）
4. ポートフォリオ型のグリッドが、5件程度のツール数でも成立するか
5. スマホでの負荷（バッテリー、発熱）

## 構成

並べ方は https://sato-takaaki.work/ の構成を参考にしています。見た目のテイストは異なります。見出しで区切らず、等間隔のグリッドにツールを流し、分類はカード下のタグで示します。

| ファイル | 役割 |
| --- | --- |
| `prototype.html` | 骨組み。上部バー、見出し、グリッド、ABOUT |
| `prototype.css` | 配色、背景、キャラクター、グリッド |
| `prototype.js` | `tools.sample.json` からカードを組み立て、スクロールに合わせて出す |
| `nebula.js` | 生WebGLの背景。進行的強化として足す |
| `tools.sample.json` | `public/data/tools.json` の下書き |
| `thumbs/` | 各ツールのスクリーンショット（WebP） |

## サムネイルの撮り直し

ツールの見た目を変えたら撮り直します。手順は `docs/ui-prototype-workflow.md` を参照してください。

撮影時の注意が1点あります。`public/assets/app.js` は `https://esm.sh/modern-screenshot` をトップレベルで `import` しているため、CDNへ到達できない環境ではモジュール全体が評価されず、年間スケジュールの日程表が描画されません。撮影時はこのURLを差し替える必要があります。

## 壊れたときにどうなるか

* JavaScriptが無効 → `noscript` の素のリンク一覧が残る
* `tools.sample.json` を読めない → 同じ一覧に差し替わる
* `IntersectionObserver` が無い → 出現の演出をやめ、カードは最初から見えた状態にする
* WebGLが使えない／初期化に失敗 → CSSのぼかし背景に戻る
* `prefers-reduced-motion: reduce` → 背景・キャラクター・出現の演出をすべて止める

いずれの場合もツールへの導線は消えません。
