# WORKLOG.md

## 目的

現在および今後の作業記録の入口です。長期化を避けるため、一定期間ごとに `docs/archive/ai/` へ分割します。

過去の記録:

- `docs/archive/ai/WORKLOG-2026-06-22_to_2026-07-09.md`

## 記録する作業

- 将来の保守に必要な設計判断がある。
- 手動・実機確認の結果を残す必要がある。
- 未確認事項、残課題、互換性上の注意がある。
- PR本文だけでは後から探しにくい。

軽微な文書修正など、PR本文で十分に追跡できる作業は重複記録しません。

## 記録形式

```markdown
## YYYY-MM-DD 作業テーマ

### 変更ファイル

### 変更内容

### 確認結果

### 未確認項目

### 残課題

### 人間が確認すべき点
```

## 現在の記録

新しい記録はこの下へ追加します。

## 2026-09-08 「使い方」の折り返しを広い画面向けに直す

### 変更ファイル

- `public/calendar.html`、`public/assets/calendar.css`
- `experiments/dense-schedule-calendar/`（同じ変更を反映）
- `docs/dense-schedule-calendar.md`

### 変更内容

前の作業でシートを700pxに広げたとき、1行が長くなりすぎないよう本文に `max-width` を入れました。
これが逆効果でした。見出し・凡例・区切り線・閉じるボタンは668px幅いっぱいのまま、本文だけ約400pxで
折り返すので、右半分が縦長に空いて間の抜けた見た目になっていました（実機確認での指摘）。

`max-width` をやめ、本文を `column-width: 280px` の段組みにしました。`column-width` は段幅の
下限なので、入るだけ段を作り、2段になったあとは段が伸びて幅を使い切ります。メディアクエリが要らず、
狭い端末では1段のまま変わりません。

見出し・凡例・注記が段の切れ目でばらけないよう、まとまりごとに `.guide-block` で包んで
`break-inside: avoid` を掛けています。HTMLに包みの `<div>` を足したのはこのためです。

### 確認結果

`npm run check` は終了コード0。Chromium（Playwright）で幅320/390/430/640/768/1280/1920pxを測りました。

| 幅 | シート | 段 | 本文1行 | シート高さ |
| --- | --- | --- | --- | --- |
| 320px | 320px | 1段 | 288px | 743px |
| 390px | 390px | 1段 | 358px | 743px |
| 430px | 430px | 1段 | 398px | 760px |
| 640px | 640px | 2段 | 290px | 558px |
| 768px以上 | 700px | 2段 | 320px | 558px |

幅430px以下のシート高さ（743/743/760px）は変更前と同じで、スマートフォンの見え方は変わっていません。
広い画面ではシートが760px→558pxに縮み、シート内スクロールが消えました。JSエラーはありません。

ミニマップが追従しないという指摘もありましたが、再現しませんでした。Chromiumで幅390/1280px、
背の低い窓（1280×500）・背の高い窓（1280×1400）、「使い方」を開閉した後、月ジャンプの直後の
いずれでも `position: sticky` が効いて画面上端8pxに留まります。報告者が更新したところ追従したとの
ことで、HTMLの10分キャッシュ（GitHub Pagesの `max-age=600`）で古い版が出ていたものと見ています。

### 未確認項目

- 実機（iPhone Safari・Android Chrome）での段組みの見え方。狭い端末では1段のままなので、
  影響を受けるのはタブレットとPCだけです。

### 人間が確認すべき点

- 2段になったとき、左段が右段より少し長くなります。ブラウザの段揃えに任せているためで、
  気になるようならまとまりの並び順を変えると寄せられます。

## 2026-09-08 過密日程カレンダーを広い画面へ広げ、減速を感じられるようにする

### 変更ファイル

- `public/assets/calendar.css`、`public/assets/calendar.js`、`public/calendar.html`（版数）
- `experiments/dense-schedule-calendar/`（同じ変更を反映）
- `docs/dense-schedule-calendar.md`、`experiments/dense-schedule-calendar/README.md`

### 変更内容

実機確認で「イージングの変化を感じない」「PCが考慮できていない」という指摘を受けての2点です。

1. **幅の上限を430px→700pxにする。** `.screen` と `.guide` の `min(100vw, …)` の右側だけを
   変えました。430pxは年間スケジュール（`assets/style.css`）から引き継いだ数字ですが、あちらは
   画面そのものが共有画像の枠なので430pxである理由があり、画像化しないカレンダーには当てはまりません。
   `min()` のままなので幅430px以下の見え方は一切変わりません。
   「使い方」も同じ700pxにしたうえで、本文（`.guide-lead` / `.guide-note`）だけ `max-width` を
   入れました。700pxいっぱいに流すと1行が長すぎて、次の行の頭に目が戻れなくなるためです。
2. **速度カーブを easeOutCubic から easeInOutCubic に変え、上限を1300ms→2000msにする。**
   片側だけのカーブは最初のフレームが最速で、月ジャンプのような長距離だと出だしが一瞬で流れ、
   減速しているのかどうか読み取れませんでした。両側にすると加速と減速の対比が出ます。
   距離の係数も0.28→0.45にしています。

多段組は入れていません（「未確定・保留事項」に残しました）。幅を広げても縦10,168pxは変わらず、
PCのスクロール量を減らすには月ブロックを横に並べるしかありませんが、ミニマップが縦1本の代理として
描かれているため噛み合いません。今回は「幅を広げるだけ」という判断です。

### 確認結果

`npm run check` は終了コード0。Chromium（Playwright）で実測しました。

- 幅320/390/430pxの `.screen` 幅・ページ高さ・横あふれ・相手名の省略件数が、変更前と同じ。
- 幅768/1280/1920pxで `.screen` が700px、横あふれ0px、相手名の省略0件。
  月ジャンプは「今日」＋11か月が横スクロール無しで収まる（幅430px以下では従来どおり横スクロール）。
- 「使い方」を幅1280pxで開くと、シート700px・本文408px、横あふれ0px。
- 減速の実測（幅390px、8,837pxの移動）: 500ms→6%、750ms→21%、1,000ms→50%、1,250ms→78%、
  1,500ms→94%、1,750ms→99%、約2,000msで停止。変更前は500msで65%まで進んでいました。

### 未確認項目

- 実機（iPhone Safari・Android Chrome）での減速の速さと長さ。2,000msが長すぎないかは
  実際に触ってみないと分かりません。数値（`0.45` と上限 `2000`）だけで調整できます。
- 幅700pxで試合ボックスの `vs 相手` と右端の大会バッジの間が約450px空きます。
  Chromiumでは整列した列に見えますが、好みの分かれるところです。

### 残課題

- 広い画面の多段組（`docs/dense-schedule-calendar.md` の「未確定・保留事項」2番）。

### 人間が確認すべき点

- PCで開いたときの幅700pxが狭すぎないか、広すぎないか。
- 月ジャンプを押したときの2秒が待たされる感じにならないか。

## 2026-09-08 過密日程カレンダーに「今日」を足し、移動に減速をつける

### 変更ファイル

- `public/assets/calendar.js`、`public/assets/calendar.css`、`public/calendar.html`
- `experiments/dense-schedule-calendar/`（同じ変更を反映。ずれると次の検証で使えなくなるため）
- `docs/dense-schedule-calendar.md`、`experiments/dense-schedule-calendar/README.md`

### 変更内容

3つです。

1. **今日を日本時間で決めて強調する。**
   `new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" })` で `YYYY-MM-DD` を得ます。
   端末のタイムゾーンではなく日本時間にするのは、日程がJSTで、遠征先の時計だと暦がずれるためです
   （実測でロサンゼルスの端末は1日前）。判定は毎回ブラウザ側で走るので、HTMLがキャッシュされていても
   今日は正しく出ます。
2. **操作バーの先頭に「今日」を置く。** 押したときだけその日へ移動します。開いたときの自動移動は
   しません。`<a href="#today">` なので、JavaScriptが動かない環境でも素のアンカーとして着地します。
   シーズンの外では印もボタンも出ません。
3. **移動に減速をつける。** ブラウザ標準の `behavior: "smooth"` は速度カーブを変えられず、
   「最後に余韻を残して止まる」ができません。`requestAnimationFrame` で easeOutCubic を回す形にし、
   月ジャンプ・「今日」・ミニマップのタップを同じ動きに揃えました。

今日の印は、左の太線と枠を `currentColor` で描いています。明るい帯でも中2日以下の濃い帯でも
自動で読める色になります。色だけに頼らないよう「今日」の文字も添えます。ミニマップにも、
白で縁取った黒い線で位置を入れました。

`html { scroll-behavior: smooth }` は外しました。残すとブラウザ側の曲線と自前のアニメーションが
二重になって競合します。JavaScriptが動かないときの素のアンカー移動に備えて
`scroll-padding-top` は36pxへ上げ、貼り付く月見出しに隠れないようにしています。

### 確認結果

`npm run check` 全項目成功。`npm run fix:asset-versions` で版数を更新済み。

Chromium（幅320px・390px、`Asia/Tokyo`）で確認しました。

- 今日（2026-09-08）の行に `is-today` と「今日」の印が1つずつ付き、`id="today"` が1つだけ付く
- 操作バーの先頭が「今日」になり、押すと今日の行が画面上端から36pxの位置に来る
- ミニマップに今日の線が出る
- コンソールエラーなし

減速カーブの実測（8,820pxの移動）。後半ほど進みが小さく、余韻が出ています。

| 経過 | 進捗 |
| --- | --- |
| 500ms | 65% |
| 700ms | 85% |
| 900ms | 95% |
| 約1,200ms | 停止 |

5乗（easeOutQuint）も試しましたが、半分の時間で97%進み、残りが「わずかに這う」だけで
余韻に見えなかったため3乗にしています。

### 未確認項目

実機（iPhone Safari・Android Chrome）での今日の印と、移動の減速の体感。
とくにiOSの慣性スクロールと自前アニメーションがぶつからないか。

### 残課題

シーズン外（6月末〜7月）に開いたときの見え方。印もボタンも出ないだけですが、実際には未確認です。

### 人間が確認すべき点

減速の速さと長さ（`320ms + 距離 × 0.28`、上限1,300ms）。速すぎ・遅すぎがあれば数値だけで直せます。

## 2026-09-08 過密日程カレンダーを公開し、入口ページへ載せる

### 変更ファイル

- `public/calendar.html`、`public/assets/calendar.css`、`public/assets/calendar.js`（新規）
- `public/assets/thumbs/dense-calendar.webp`、`experiments/site-index/thumbs/dense-calendar.webp`（新規）
- `public/data/tools.json`（`dense-calendar` を予想スカッドの次に追加。現役4件・過去2件）
- `public/index.html`（noscript の一覧に1行追加）
- `tools/check-static-assets.mjs`（`calendar.css` / `topbar.css` の波括弧数と `calendar.html` の参照を検証）
- `docs/dense-schedule-calendar.md`、`docs/site-index.md`、`docs/project-structure.md`、
  `docs/roadmap.md`、`docs/production-inventory-audit.md`、
  `experiments/dense-schedule-calendar/README.md`

### 変更内容

`experiments/dense-schedule-calendar/` のプロトタイプを `public/` へ移しました。
`docs/dense-schedule-calendar.md` の「本番の置きどころ」で決めたとおり、
年間スケジュールの表示モードには足さず、別ページにしています。

プロトタイプからの差分は、外向けの体裁とデータの読み方だけです。

- データの読み先を `data/matches.json` の1本にした。プロトタイプは配信の根が
  GitHub Pagesと手元で違うため2つのURLを順に試していましたが、公開版では要りません。
- `title`・`description`・OGP・favicon をほかの公開ページと同じ形で入れた。
- 「使い方」の出典と免責を公開版の文面にし、年間スケジュールへのリンクを足した。
  検証用ページである旨の注意書きは外しています。
- トップバー・背景・「使い方」パネル・間隔の色分けの実装はプロトタイプのままです。

入口ページには `id: "dense-calendar"`、`accent: "#c8402e"`（中2日以下の赤）で、
**予想スカッドの次**に置きました。サムネイルは
`docs/ui-prototype-workflow.md` の手順どおり、430×880・画素密度2倍・`Asia/Tokyo` で
10〜11月（赤と橙が続くところ）を撮り、ブラウザの `canvas.toDataURL("image/webp", 0.82)` で
344×704のWebPにしています。

`tools/check-static-assets.mjs` に新ページの参照チェックを足しました。
`tools.json` と noscript の突き合わせ、版数の突き合わせは既存の仕組みがそのまま効きます。

`--topbar-gap` は、別セッションが `squad.css` の宣言を消したことでリポジトリから
完全に消えました。`topbar.css` 側の記述は固定をやめた時点（#256）で既に落ちています。
`docs/site-index.md` に残っていた「予想スカッド側でやること」を、完了した内容へ書き換えました。

### 確認結果

`npm run check` 全項目成功。内訳のうち今回に関係するものは次のとおりです。

- `ツール一覧の検証に成功しました。現役4件、過去のページ2件です。`
- `noscriptOK public/index.html: tools.json の live 4件と一致`
- `波括弧OK public/assets/calendar.css`、`波括弧OK public/assets/topbar.css`
- `参照OK public/calendar.html: assets/calendar.css, assets/topbar.css, assets/calendar.js, assets/index-nebula.js`
- `版数OK`

Chromium（幅320px・390px）で `calendar.html` を確認しました。

- 11か月・71ボックス（確定40＋候補31）を描き、候補日のHOMEバッジ15個が見える
- ネビュラが動く（`body.has-nebula`）、トップバーが上端、横スクロールなし
- コンソールエラーなし、読み込み失敗なし

入口ページでは、カードが年間スケジュール・予想スカッドの次に並び、サムネイルが表示され、
`calendar.html` へリンクすることを確認しました。

### 未確認項目

実機（iPhone Safari・Android Chrome）での公開版。プロトタイプでは確認済みですが、
公開版のURLでは未確認です。

### 残課題

- 幅320pxで12文字の対戦相手名2件が省略記号になる（大会名バッジを右端に固定する仕様のため）。
- DOM契約の検証（`validate-app-contract.js` 相当）は用意していません。
  このページが個人状態を持つようになったら検討します。
- SUPPORTER TIMELINE 側に残る `--topbar-h` の記述。動きとしては0に戻っているだけです。

### 人間が確認すべき点

入口ページでの並び順（予想スカッドの次）とサムネイルの見え方。
公開版の実機表示。

## 2026-09-08 トップバーの固定をやめ、カレンダーの画面をカレンダーに譲る

### 変更ファイル

- `public/assets/topbar.css`（固定をやめ、リンクを1本に）
- `public/sanga202627season.html`、`public/squad.html`、`public/timeline.html`、
  `public/sanga2025season.html`、`public/sanga_slides.html`、`public/TradePost/index-v1.html`
  （バーのマークアップ差し替え。年間スケジュールは `<body class="topbar-row">` も付ける）
- `experiments/dense-schedule-calendar/`（題を1行に、操作バー、「見かた」パネル）
- `docs/site-index.md`、`docs/project-structure.md`、`docs/dense-schedule-calendar.md`、
  `docs/roadmap.md`、`docs/ai/BROWSER_CHECKLIST.md`

**`public/assets/squad.css`、`public/assets/timeline.css`、`public/assets/timeline.js` は
今回いっさい触っていません。** 別セッションが予想スカッドとSUPPORTER TIMELINEを編集中のためです。
`squad.html` と `timeline.html` はバーのマークアップとキャッシュ用の版数で衝突する可能性があります。
`docs/parallel-work-policy.md` に従い、先にマージされたほうへ寄せて
`npm run fix:asset-versions` を掛け直してください。

### 変更内容

利用者の実機確認で、画像生成画面でバーが消えること、生成画像に写り込まないこと、
SUPPORTER TIMELINEの下部メニューと重ならないことを確認できました。そのうえでの指摘に対応しています。

1. **トップバーを画面に固定しない。** 「邪魔になる場面が出てきそう」という判断で、
   通常のフローに戻しました。固定をやめたことで、高さぶんの `body` の `padding-top`、
   その計算に使っていた `--topbar-h` の宣言、ダイアログと重ね順を取り合わないための指定が
   まとめて不要になりました。
2. **リンクを `SANGA TOOLBOX` 1本にし、アイコンは入口ページと同じくXへ向けた。**
3. **カレンダーの説明・凡例・注記を「見かた」パネル（`<dialog>`）へ移した。**
   月ジャンプは枠で囲った操作バーに収め、その中に「見かた」ボタンを並べています。

`--topbar-h` を宣言しなくなったことで、`timeline.css` の `top: var(--topbar-h, 0px)` と
`timeline.js` の監視位置は0に戻り、貼り付き見出しは元どおり画面上端で止まります。
`squad.css` の `--topbar-gap: 16px` は参照されなくなりました。どちらも上記の理由で残しています。

固定をやめたぶん、帯を画面幅いっぱいに見せる指定が要りました。

- `margin-inline: calc(50% - 50vw)`: `body` に左右の余白があるページ（予想スカッド、スライド）
- `align-self: stretch`: 縦並びflexで中央寄せの `body`（予想スカッド、2025シーズン日程）。
  無いと帯が中身の幅（実測220px）に縮む
- `body.topbar-row` の折り返し: 横並びflexの `body`（年間スケジュールだけ）。
  無いと帯が本文の隣に並び、実測で幅220px・高さ2850pxの縦帯になる

### 確認結果

`npm run check` 全項目成功。`npm run fix:asset-versions` で版数を更新済み。
`docs/dom-inventory.md` は差分なし。

Chromium（幅320px・390px・430px・768px・1280px）で確認しました。

- 公開6ページすべてでバーが `position: static`、高さ65px、幅が画面いっぱい。
  600pxスクロールすると画面外へ流れる（`top` が負になる）
- アイコンが `https://x.com/kou_osakacity`、`SANGA TOOLBOX` が `index.html`
  （`TradePost` は `../index.html`）
- 横スクロールが出ない（`TradePost` の1pxは変更前からある既存のもの）
- `--topbar-h` は未宣言。SUPPORTER TIMELINEの貼り付き見出しが `top: 0` に戻る
- プロトタイプ: 画面上部の飾りが313px→155px。「見かた」がEscで閉じ、
  背面のスクロール止めが戻る

あわせて同日中に、次の3件を追加で直しています。

- **スライドのバーが20px下がって始まっていたのを直した。** `sanga_slides.html` の
  `body { margin: 20px }` を `margin: 0; padding: 0 20px 20px` にし、`table` に
  `margin-top: 10px` を足して `caption` の10pxと合わせました。見た目の余白は変わりません。
  更新の終わったページで担当が重ならないため、こちらのPRで直しています。
- **「見かた」を「使い方」に統一した。** 年間スケジュールのパネルと同じ言い方に揃えました。
- **「使い方」ボタンを月ジャンプの囲みの外、一番左へ出した。** 囲みに入れるのは月ジャンプだけにします。

予想スカッドにも同じ16pxのずれが残っていますが、`squad.css` は別セッションが編集中のため
触っていません。直し方は `docs/site-index.md` の
「予想スカッドだけ、バーが16px下がって始まる」に書いてあります。

### 未確認項目

実機（iPhone Safari・Android Chrome）でのバーの見え方と「使い方」パネル。
`margin-inline: calc(50% - 50vw)` は、クラシックなスクロールバーを出すデスクトップブラウザで
スクロールバーの幅ぶん横に溢れる可能性があります。スマートフォン最優先のためそのままにしています。

### 残課題

- 予想スカッド側の2点（`--topbar-gap` の削除と、バーを画面上端から始める上余白の移し替え）。
  手順は `docs/site-index.md` の「予想スカッドだけ、バーが16px下がって始まる」。
- `timeline.css` / `timeline.js` の `--topbar-h` まわりを外す（動きとしては既に0へ戻っている）。
- 過密日程カレンダーの本番移植（別ページ）。

### 人間が確認すべき点

トップバーの位置。予想スカッドだけ、ページ自身の上余白ぶん（16px）バーが下がって始まります。
ほかの5ページは画面上端です。

## 2026-09-08 公開ページ共通トップバーと、過密日程カレンダーの実機指摘対応

### 変更ファイル

- `public/assets/topbar.css`（新規。共通トップバー）
- `public/sanga202627season.html`、`public/squad.html`、`public/timeline.html`、
  `public/sanga2025season.html`、`public/sanga_slides.html`、`public/TradePost/index-v1.html`
  （トップバーの読み込みとマークアップを追加）
- `public/assets/squad.css`（`--topbar-gap: 16px` の宣言だけ）
- `experiments/dense-schedule-calendar/`（HOMEバッジの修正、ネビュラの地、トップバー、文言）
- `docs/site-index.md`、`docs/project-structure.md`、`docs/dense-schedule-calendar.md`、
  `docs/roadmap.md`、`docs/ai/BROWSER_CHECKLIST.md`

`public/index.html` と `assets/index.css` は変更していません。入口ページのバーは自前のままです。

### 変更内容

利用者の実機確認（iPhone Safari）で、月見出しの貼り付き、ミニマップの操作、色の読み取り、
斜線の量はいずれも問題なしと確認できました。そのうえで出た指摘4件に対応しています。

1. **候補日のHOMEバッジが見えない。** プロトタイプのCSSの不具合でした。
   `.is-candidate .ha-h` が同じルールで `background:currentColor` と `color:var(--paper)` を
   指定していたため、`currentColor` が `--paper` に解決されて白地に白文字になっていました。
   大会色を `--comp` というカスタムプロパティに逃がして直しています。
   該当は候補日だけを持つHOMEの8試合（sec21/23/24/26/28/32/35/37）。
   `matches.json` 側でHOME/AWAYが空なのは、勝ち上がり前提で対戦相手も会場も未定の
   カップ戦8件（天皇杯6・ルヴァン2）だけで、こちらはデータどおりです。日程データは変更していません。
2. **地を入口ページと同じネビュラにする。** `index-nebula.js` を進行的強化として読み、
   WebGLが使えなければCSSのぼかしが残るようにしました（SUPPORTER TIMELINEと同じ作り）。
3. **文言の作り直し。** 説明を1文に縮め、11項目あった凡例を `間隔` `大会` `未確定` の3群に分けました。
4. **全ページへ共通トップバー。** `public/assets/topbar.css` を新設し、入口ページ以外の
   公開6ページへ置きました。

トップバーの実装で判断したことは3つです。

- **`position: fixed` にした。** 公開ページの `body` は「横並びflexで中央寄せ」（年間スケジュール）、
  「縦並びflexで中央寄せ」（予想スカッド・2025シーズン日程）、「`margin: 20px`」（スライド）と
  まちまちで、`sticky` では幅と位置が揃いませんでした。
- **高さぶんは `body` の `padding-top` で空けた。** 空の要素を1つ置く方法を先に試しましたが、
  年間スケジュールの `body` が横並びflexのため、その要素が本文の隣に並んでページを右へ169px
  押し出しました。ページ側が上余白を持つ場合は `--topbar-gap` で足します（現在は `squad.css` の16pxだけ）。
- **地を不透明にした。** 入口ページのバーは下端を透明にして背景を透かしますが、共通バーの下には
  白い紙の面や白い表が流れるため、白い文字が読めなくなります。

### 確認結果

`npm run check` が全項目成功。`npm run fix:asset-versions` で版数を更新済み。
`docs/dom-inventory.md` は差分なし（生成対象がJavaScriptだけで、トップバーはJavaScriptを持たないため）。

Chromium（幅390px、一部320px）で公開6ページ＋入口ページを確認しました。

- 6ページすべてでバーが上端に貼り付き、高さ65px、幅いっぱい、アイコンが表示され、
  リンクが `index.html`（`TradePost` は `../index.html`）へ向くこと。
- 横スクロールが発生しないこと（`TradePost` の1pxは変更前からある既存のもの）。
- 入口ページのバーは変わっていないこと（高さ64px、アイコンはXへ）。
- プロトタイプで候補日のHOMEバッジが見えること（`background: rgb(123,0,100)` / `color: rgb(251,250,252)`）。

バーを置いたあとに見つけて直したものが2つあります。

- **ダイアログがバーに覆われる。** バーの `z-index` は100で、年間スケジュールの暗幕（20）と
  パネル（21）より前に出ていました。重ね順を入れ替えると通常表示でカードがバーの上に乗るページが
  出るため、開いている間だけ隠す形にしています（画像生成画面・設定・使い方・スカッドの選手ピッカー）。
- **SUPPORTER TIMELINEの見出しがバーの裏に入る。** 自前の貼り付き見出しが `top: 0` だったため、
  バーの下に潜っていました。`top: var(--topbar-h, 0px)` にし、帯へ縮む判定
  （IntersectionObserver）の上端も同じだけ下げています。下げないと、貼り付いてから縮むまでが
  バーの高さぶん遅れます。

### 未確認項目

実機（iPhone Safari・Android Chrome）でのトップバー。特に次の3つ。

- 年間スケジュールの画像生成画面・設定・使い方でバーが隠れること（`:has()` を使っている）。
- 予想スカッドのPNG生成にバーが写り込まないこと。
- SUPPORTER TIMELINEの貼り付き見出しと下部メニューがバーと重ならないこと。

### 残課題

過密日程カレンダーの本番移植（別ページ）。手順は `docs/dense-schedule-calendar.md` の
「本番移植前にやること」に6項目。

### 人間が確認すべき点

トップバーを6ページすべてに置いてよいか（アーカイブ扱いの2025シーズン日程・スライドを含む）。
`TOOLS` / `ABOUT` の2項目でよいか。入口ページのバーと違い、地を不透明にした判断。

## 2026-09-08 過密日程カレンダーの設計とプロトタイプ

### 変更ファイル

- `docs/dense-schedule-calendar.md`（新規）
- `experiments/dense-schedule-calendar/`（新規。README・prototype.html/css/js）
- `AGENTS.md`（変更対象別の引き先に1行追加）
- `docs/roadmap.md`（進行中・確認中に1行追加）
- `docs/source-and-license.md`（祝日データの出典を追加）

`public/` は変更していません。

### 変更内容

試合と試合の間隔（中n日）で全日を色分けする縦1本のカレンダーを、`experiments/` に作りました。
`public/data/matches.json` の正本をそのまま読み、2026年8月1日〜2027年6月30日の334日を描きます。

設計上の判断は次の4点です。

1. **本番の置きどころは別ページを推奨**。年間スケジュールの表示モードへ足す案と比較し、
   表示列・絞り込み・色枠状態・共有画像生成をまとめて無効化する必要があるため見送りました。
   比較表は `docs/dense-schedule-calendar.md` の「本番の置きどころ」にあります。決定は未了です。
2. **間隔は「試合が無い日の連続」の長さで数える**。指示の
   `中n日 = 次の試合日 − 前の試合日 − 1` と同じ値になり、描いた試合日と必ず一致します。
3. **未確定日程は候補日すべてに点線の箱を置き、前後の区間に斜線を掛ける**。候補日も
   間隔の計算に入れるため、結果としていちばん詰まった読み方になります。
4. **色は既存サイトの系統へ寄せ、コントラスト比で濃さを決めた**。指示のACL色 `#0E8E86` は
   白文字で4.0:1と不足するため `#116b66` にしています。根拠は設計文書の配色表にあります。

### 確認結果

`npm run check` が全項目成功（`public/` 未変更のため既存検証への影響なし）。

Chromium（幅320px・390px・430px）で次を確認しました。

- 334日・71ボックス（確定40＋候補31）を描き、横スクロールが出ないこと。
- 月見出しが画面上端に貼り付き、次の月で入れ替わること。
- ミニマップの表示範囲枠がスクロールに追従し、タップとドラッグで移動できること。
- 幅320pxで省略記号になる対戦相手名は12文字の2件だけであること。

### 未確認項目

実機（iPhone Safari・Android Chrome）での貼り付き見出しとミニマップのドラッグ。
GitHub Pagesでの表示（`main` へマージするか `workflow_dispatch` の実行が必要）。

### 依頼者の判断（2026-09-08）

- **中断期間の色**: 6段目として `中14日以上` を中立（グレー）にする。中6日と同じ緑では
  「安全」の意味が薄れるため。中n日の文字が付くのでシーズン前後の中立とは読み分けられる。
- **斜線の量**: 薄く細かくする。白ではなく薄い墨（`rgba(28,25,34,.12)`、2px幅・6px間隔）に
  したのは、中立の帯の上で白が見えなくなり、中2日以下の赤の上では白文字のコントラストを
  下げるため。区間を絞る案と、確定分だけを描く切り替えを置く案は採らない。
- **本番の置きどころ**: 別ページとして追加する。年間スケジュールの表示モードには足さない。
  表示列・絞り込み・色枠状態・共有画像生成をそのモードでだけ無効化する条件分岐が必要になり、
  既存のDOM契約とLocalStorageに対するリスクが、ページを増やさない利点を上回るため。

### 残課題

本番移植は別PRです。手順は `docs/dense-schedule-calendar.md` の「本番移植前にやること」に6項目。
移植前にiPhone SafariとAndroid Chromeでの実機確認が必要です。
その他の保留は同文書の「未確定・保留事項」に5件。

### 人間が確認すべき点

GitHub Pagesと実機でのプロトタイプ確認。
祝日データの利用条件（内閣府サイトの利用条件ページの所在を確認できていない）。

## 2026-08-28 SUPPORTER TIMELINE の企画設計とPhase 1プロトタイプ

### 変更ファイル

- `docs/supporter-timeline-design.md`（新規）
- `docs/news-extraction-research.md`（新規）
- `docs/fan-tools-research.md`（新規）
- `docs/concept/`（新規。元資料HTML2件と構成図）
- `experiments/supporter-timeline/`（新規。Phase 1プロトタイプ）
- `docs/service-scope.md`、`docs/roadmap.md`、`docs/personalization.md`、`docs/project-structure.md`、`AGENTS.md`

### 変更内容

公式情報をサポーター本人の時間軸に統合する非公式ツールの企画設計と、Phase 1の検証用プロトタイプを追加しました。
`docs/service-scope.md` の「ニュース連動カレンダー」構想の後継にあたります。

### 将来の保守に必要な設計判断

**AIによる日時抽出を使わない。** 当初はニュース記事をLLMで解析する設計でしたが、誤抽出を人間が確認する
運用負荷が現実的でないと判断しました。調査の結果、公式記事には `応募期限` `販売開始日時` などの意味ラベルがあり、
**意味ラベルの直下だけを allow-list で解析すれば決定的なパーサで足りる**ことが分かりました。
そのうえで、確実に読めない記事は**日時を抽出せずURLだけ残します**（画像のみ、変更履歴あり、複数イベント、
ラベルなし、日付継承が必要の5条件）。「誤りを人間が直す」のではなく「取れないものは取らない」設計です。

**確定していない日時をICSに出さない。** `matches.json` は57試合中28試合が未確定、18試合が候補日複数です。
`date_precision`（`datetime` / `date` / `candidates` / `unknown`）で画面表示とICS出力を別々に分岐させ、
候補日と日程未定は画面には出してもカレンダーには流しません。購読カレンダーに入った予定は確定情報として
届くためです。

**変更検知はメールを起点にする。** 記事側は日時変更が既存記事の上書きとして反映され、変更前の値が
取り消し線で残ります。素朴に拾うと古い日時を掴むため対象外条件に入れました。代わりに公式メールでは
変更が独立した1通として届くため、そちらを起点にします。

**プロフィールは端末から出さない。** イベント側は `audience`（誰向けかという事実）だけを公開データに持ち、
利用者の属性はLocalStorageに置いて照合も端末内で行います。静的ファイルの配信だけでパーソナライズが成立します。

**シーズンパスは会員種別と独立した軸。** SANGA CREW の等級（`platinum` / `gold` / `regular` / `kids`）と
シーズンパス保有は別で、「ゴールドクルーでシーズンパス保持者」が成立します。`has_season_ticket` を
別キーで持ちます。1試合のチケット販売は5段階に分かれ、同じ試合に販売開始が5件並びます。

**収益化しない。** 公式サイトの利用規約が営利目的の行為を禁止しているため、アフィリエイトは採用しません。
ホテル提案（`tools/hotels/`、中断中）にも同じ判断が及びます。

**出典は記事URLへ直接リンクする。** 規約はトップページへのリンクを求めていますが、記述は「お願い」であり、
日時という誤ると実害が出る情報を扱う以上、利用者がその場で一次情報を確認できることを優先しました。

### 確認結果

ヘッドレスChromium（幅430px、`Asia/Tokyo`）:

- 「次にやること」が直近のACTION 1件を出し、過ぎた段階を飛ばす
- MY予定が公式イベントと同じ日の時系列に混ざる（17:00配布 → 18:10座席へ移動 → 19:00キックオフ）
- チケット絞り込みで販売5段階が並ぶ
- ICS書き出しで日時が確定していないものを除外。時刻はUTC変換、時刻未定は `DTSTART;VALUE=DATE`
- 横スクロールなし、JavaScriptエラーなし

実機:

- **Android** — `.ics` のダウンロードとカレンダーアプリへの受け渡しに成功
- **iOS Safari** — 成功。取り込み前に件数と全件リストのプレビューが出る。`DTEND` も反映される

### 未確認項目

- ニュース記事の実件数（調査で月40件と月96件の開きがある。ニュース一覧の最終ページで確定する）
- 公式サイトのJSON-LDの有無、`sitemap.xml` の内容、CORS
- 公式サイトからの取得可否そのもの（取得できるまでは手入力運用）
- メールのHTML本文に日時があったのか、画像主体で本文が薄いのか

### 残課題

- Phase 2（プロフィール照合）が次の一手の第一候補。詳細は `docs/supporter-timeline-design.md` の「現在地と次の一手」
- ICSは1回きりの取り込みで、日時変更に追随するには購読フィード（`webcal:`）が要る
- MY予定がICSに含まれる。iOSは取り込み前に外せるがAndroidにはその画面がない
- 同時刻イベントの並び順はカレンダーアプリ側に依存し制御できない
- 過去のイベントがタイムラインに残り続ける

### 人間が確認すべき点

- ニュース一覧の最終ページを見て、月あたりの記事数を確定する
- チケット販売スケジュールの常設ページで、先行販売5段階の順序を確認する
- プロトタイプを継続して触り、実データが入る前に表示の過不足を判断する

## 2026-08-25 検証コマンドの集約とアーカイブ検索除外

### 変更ファイル

`package.json`（新規）、`tools/check-static-assets.mjs`（新規）、`docs/ai/EFFICIENCY-BACKLOG.md`（新規）、
`AGENTS.md`、`README.md`、`docs/project-structure.md`、`docs/codex-workflow.md`、`docs/ai/PLAN.md`、
`.gitignore`、`.github/workflows/static-checks.yml`、`.github/workflows/squad-checks.yml`、
`.github/workflows/deploy-production.yml`

### 変更内容

検証コマンドを `package.json` の `npm run check` 系へ集約し、文書とワークフローYAMLの双方から
同じスクリプトを呼ぶようにした。CIのステップ内にPythonで直書きしていたCSS波括弧数チェックと
HTML参照チェックは `tools/check-static-assets.mjs` へ移し、手元でも同一の検証を実行できるようにした。
あわせて `AGENTS.md` に `docs/archive/` を調査時の検索対象から外す旨を明記した。

公開物（`public/` 配下）の変更はない。検証の内容と対象は移設前と同じで、squad.cssの波括弧数と
squad.htmlの参照チェックのみ新規に追加している。

### 確認結果

`npm run check` が全項目成功。matches 57件、players 39件、フォーメーション17件、スタイル8件を確認。
`npm run check:squad:browser`（Playwright）はこの環境では未実行。

### 未確認項目

GitHub Actions上での実行結果。3ワークフローすべてでステップを差し替えているため、PR上のCI結果で確認が必要。

### 残課題

`docs/ai/EFFICIENCY-BACKLOG.md` の課題3〜6（チェックリストのスクリプト移管、インベントリ文書の自動生成化、
必読表の索引方式化、1PR=1ブランチの明文化）。

### 人間が確認すべき点

`--expected-count 57` の定義箇所が `package.json` へ移った点。日程件数を変える際はここを更新する。

## 2026-08-25 文書構成の整理（インベントリ自動生成・索引方式・チェックリスト圧縮）

### 変更ファイル

`tools/generate-dom-inventory.mjs`（新規）、`docs/dom-inventory.md`（新規・自動生成）、
`tools/validate-app-contract.js`、`package.json`、`AGENTS.md`、`docs/project-structure.md`、
`docs/ai/JS_CHANGE_CHECKLIST.md`、`docs/parallel-work-policy.md`、`docs/roadmap.md`、
`docs/ai/EFFICIENCY-BACKLOG.md`、索引を追加した7文書（`data-schema` / `filtering` / `squad-builder` /
`display-modes` / `operation-flow` / `deploy-policy` / `personalization`）、
`docs/archive/implementation/` へ移動した3文書（`js-inventory` / `css-inventory` / `html-analysis`）

### 変更内容

`docs/ai/EFFICIENCY-BACKLOG.md` の課題3〜6を実施した。

DOM識別子の一覧を手書きから自動生成へ変えた。`tools/generate-dom-inventory.mjs` が
`app.js` と `squad-builder.js` からid・class・data属性・aria属性・LocalStorageキーを抽出し、
`npm run check:static` が `--check` で実装との差分を検出する。

`JS_CHANGE_CHECKLIST.md` は199行から121行へ縮小した。`validate-app-contract.js` が既に
検証している項目を文書から削り、自動化されていなかった `PANEL_CLOSE_DELAY_MS=240` は
契約チェックへ追加した。残したのは実ブラウザ確認と人間の判断が必要な項目だけ。

`AGENTS.md` の「作業前の必読文書」を「文書の引き方」へ変更し、主要7文書の冒頭へ索引表を置いた。
整理作業前の棚卸し3本は履歴として `docs/archive/implementation/` へ移した。

公開物（`public/` 配下）の変更はない。

### 確認結果

`npm run check` が全項目成功。`generate-dom-inventory.mjs --check` の差分検出は、
生成結果を意図的に書き換えて失敗することを確認済み。

### 未確認項目

GitHub Actions上での実行結果。`check:static` に生成物の差分検出を追加したため、PR上のCIで確認が必要。
実ブラウザでの表示・操作（今回はJavaScriptの挙動を変更していないため影響しない想定）。

### 残課題

なし。新しい効率改善の課題は `docs/ai/EFFICIENCY-BACKLOG.md` の「今後の課題」へ追記する。

### 人間が確認すべき点

棚卸し3本をアーカイブへ移した判断。現行情報として必要なものは `docs/dom-inventory.md` と
`docs/personalization.md` が持っているが、当時の調査内容を現行文書として残したい場合は差し戻す。

