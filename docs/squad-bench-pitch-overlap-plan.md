# スタメン画像：ベンチ肥大によるピッチ圧縮／カード重なりの修正計画

対象ページ: `public/squad.html`
対象ファイル: `public/assets/squad-builder.js` / `public/assets/squad.css` / `public/assets/squad-formations.js`

作成日: 2026-08-20
状態: 設計確定（実装未着手）

---

## 1. 現象

生成した PNG で、ベンチ登録人数が多いときに下部帯（フッター）が縦に伸び、
ピッチ領域が薄くなり、**ピッチ上の選手カードどうしが重なる**。

再現しやすい条件:

- ベンチのチップが 4 行に折り返す（登録 9〜10 枠＋空き枠「＋」が並ぶ状態）
- 4-2-3-1 のように縦方向のスロット間隔が詰まっているフォーメーション

観測された崩れ:

- DF 列のカードが GK カードと重なる
- 中盤の隣接カードが左右に重なり、背番号が読めない

---

## 2. 原因（コード上の根拠）

3 つの要因が重なって発生している。**単独では発生しない。**

### 2-1. フッターの伸びがピッチ高さを一方的に削る

`public/assets/squad.css`

```
.squad-canvas{ aspect-ratio:9/16; display:flex; flex-direction:column; }   /* 44-51行 */
.pitch      { flex:1; min-height:0; ... }                                  /* 318行 */
.sq-footer  { flex:0 0 auto; ... }                                         /* 466行 */
```

キャンバスは 9:16 固定。フッターは `flex:0 0 auto` で内容量に応じて伸び、
ピッチは `flex:1; min-height:0` なので **削られる側**。ピッチ高さの下限がない。

### 2-2. ベンチチップだけ px 指定で、キャンバス幅に追随しない

`public/assets/squad.css:646-650`

```
.bench-slot{
  font-size:13px; ... padding:8px 12px; min-height:44px; ...
}
```

キャンバス内の他の要素は `cqw`（コンテナ幅基準）なのに、ベンチだけ px。
これは**編集時のタップ領域 44px を確保するための指定**で、
「編集 UI」と「出力画像」が同じ DOM を共有していることに由来する。
チップ 1 行あたり約 44px + gap のため、4 行で 190px 前後をフッターが占有する。

### 2-3. カード高さの下限がハードコードされ、重なり回避の計算を無効化している

`public/assets/squad-builder.js` の `fitCards()`。
384-395 行で「全スロット対の間隔から、重ならないカード高さの上限 `pairBound`」を
正しく計算し、398-399 行でピッチに収まる上限も掛けている。
ところが最後の 400 行で:

```js
cardH = Math.max(cardH, 75.1); // 全フォーメーション統一：最大サイズ75.1px
```

**上限計算の結果を無条件に上書き**している。
ピッチが薄くなっても 75.1px が強制されるため、ここで初めて重なりが顕在化する。

> 経緯: コミット `a808f1a`「全フォーメーションのカード高さを最大サイズ75.1pxに統一」。
> 「フォーメーション間でサイズを揃える」ことを優先した結果、重なり回避が壊れた。
> **本計画では「重ならないこと」を優先する方針に転換する。**

---

## 3. 方針（確定事項）

- カード高さは**下限 70px の可変**とする。フォーメーション間の完全統一はやめる。
- ピッチの取り分をレイアウト契約として先に確保し、フッター（ベンチ）を残りに詰める。
- ベンチ表示はキャンバス基準（cqw）にし、枚数に応じて段階的に縮める。
- 「メンバー登録」と「ピッチ配置」を状態として分離し、編集 UI をキャンバス外へ出す。
- LocalStorage は**読み取り互換のみ維持**。旧形式での書き戻しは不要。

---

## 4. 実装計画（4 段階）

各段階は独立してリリース可能。段階 1〜3 で今回の重なりは解消する。

### 段階 1: カード高さの下限を 70px の可変に変える

**目的**: 重なりを止める。最小の変更。

**変更**: `public/assets/squad-builder.js` `fitCards()`

- 400 行 `cardH = Math.max(cardH, 75.1);` を削除する。
- 代わりに下限定数を導入する。

```js
/** カード高さの下限。これを割るときはピッチ側ではなくベンチ側を縮める */
const CARD_H_MIN = 70;
...
cardH = Math.max(cardH, CARD_H_MIN);
```

一見同じに見えるが、意味が違う点に注意:

- 旧: 75.1 は「全フォーメーション統一の固定値」として**上限計算を常に上書き**していた。
- 新: 70 は「これ以上小さくしない床」。**床に到達したこと自体を検知して、
  段階 3 でベンチ側を縮めるトリガーにする**（`fitCards()` の戻り値で返す）。

```js
function fitCards() {
  ...
  const idealH = cardH;                    // 制約から求めた理想値
  cardH = Math.max(cardH, CARD_H_MIN);
  pitch.style.setProperty("--card-h", cardH + "px");
  return { cardH, idealH, clamped: idealH < CARD_H_MIN };  // clamped=true なら過密
}
```

段階 1 時点では `clamped` は使わなくてよい（段階 3 で使う）。

**あわせて**: 402 行の `console.log` は残してよいが、
段階 4 完了時に削除するか `DEBUG` フラグ配下に移す。

**期待結果**: ベンチが多い試合でカードが 70〜75px 程度に縮み、重なりは消える。
ただしフッターが極端に大きい場合、まだ 70px の床で重なる可能性が残る（→ 段階 2/3）。

### 段階 2: ピッチの取り分を先に確保する（CSS のみ）

**目的**: フッターの伸びがピッチを食い潰さないようにする。

**変更**: `public/assets/squad.css`

```css
.pitch{
  flex:1 1 auto;
  min-height:60%;      /* キャンバス高に対するピッチの最小取り分 */
  ...
}
.sq-footer{
  flex:0 1 auto;
  max-height:24%;      /* 残りの上限。溢れる分はベンチ側で縮める（段階3） */
  overflow:hidden;
  ...
}
```

- `min-height:60%` の 60 は「ヘッダー約 16% ＋ フッター 24% ＝ 100%」から導いた値。
  ヘッダーの高さは選択スタイルによって変わるため、実測して微調整すること。
- `overflow:hidden` は**暫定の安全弁**。段階 3 でベンチが必ず収まるようになれば
  実際には効かなくなる。段階 3 未実装のまま出すと「ベンチが切れる」ので、
  段階 2 と段階 3 は**同一リリースにまとめることを推奨**。

**注意**: `flex` の `%` による `min-height` は親（`.squad-canvas`）が
`aspect-ratio` で高さを持っているので有効。ここは実機で必ず確認する。

### 段階 3: ベンチをキャンバス基準にし、枚数連動で縮める

**目的**: フッター高さを 24% 以内に収め、段階 2 の `overflow:hidden` を発動させない。

**3-a. cqw 化**（`public/assets/squad.css:646-650`）

```css
.bench-slot{
  font-size:calc(2.2cqw * var(--bench-scale, 1));
  padding:calc(1.0cqw * var(--bench-scale, 1)) calc(2.2cqw * var(--bench-scale, 1));
  min-height:calc(5.2cqw * var(--bench-scale, 1));
  border-radius:99px;
  display:flex; align-items:center;
  ...
}
```

`min-height:44px` を外すため、**タップ領域が 44px を割る**。
段階 4 で編集 UI をキャンバス外に出すまでの間は、
`.bench-slot` に透明な擬似要素で当たり判定を広げる回避を入れる:

```css
.bench-slot{ position:relative; }
.bench-slot::after{
  content:""; position:absolute; left:0; right:0;
  top:50%; height:44px; transform:translateY(-50%);
}
```

（`gap` が 44px 未満だと隣と重なるので、`gap` は最低 `1cqw` を維持する）

**3-b. 枚数連動スケール**（`public/assets/squad-builder.js` `renderBench()` の末尾）

```js
// 表示されるチップ数（空き枠「＋」も 1 枠として数える）に応じて密度を落とす
const shown = state.bench.length;
const scale = shown <= 6 ? 1 : shown <= 9 ? 0.86 : 0.74;
benchEl.style.setProperty("--bench-scale", String(scale));
```

**3-c. 空き枠を画像に出さない**

現在 `renderBench()`（309-327 行）は `BENCH_SIZE = 9`（`squad-formations.js:109`）の
固定長を全部描画し、未選択は「＋」を出す。この「＋」がフッター面積を食っている。

暫定対応として、**編集中だけ「＋」を表示し、出力時は隠す**:

```css
body:not(.exporting) .bench-slot.is-empty{ /* 従来どおり表示 */ }
body.exporting .bench-slot.is-empty{ display:none; }
```

`exportPng()`（`squad-builder.js:654`）の前後で `document.body.classList` を
`exporting` でトグルし、**クラス付与後に `fitCards()` / `layoutPitch()` を
再実行してから撮影する**こと（順序を誤ると寸法がズレる）。

**3-d. 再フィットのフィードバック**

`fitCards()` が `clamped:true` を返したら、`--bench-scale` をもう 1 段落として
再度 `fitCards()` を呼ぶ。**ループは最大 2 回まで**（無限ループ防止）。

```js
function layoutAll() {
  let r = fitCards();
  for (let i = 0; i < 2 && r.clamped; i++) {
    benchScale = Math.max(0.6, benchScale - 0.1);
    benchEl.style.setProperty("--bench-scale", String(benchScale));
    r = fitCards();
  }
  layoutPitch();
}
```

**3-e. ResizeObserver の監視対象にフッターを追加**

`squad-builder.js:874` 付近は現在 `pitchEl` のみ監視している。
フッター高さの変化を検知できないので、`.sq-footer` も監視対象に加える。

### 段階 4: メンバー登録とピッチ配置を分離する（構造改善）

**目的**: 「編集 UI」と「出力画像」の同居をやめる。
これが `min-height:44px` の根本原因であり、段階 3 の回避策を不要にする。

**4-a. 状態モデル**

```js
const state = {
  squad:     [],   // 登録メンバー（背番号の配列・人数自由）
  slots:     [],   // 11 スロット。各 slot.playerNumber は squad の要素を指す
  // bench は保持しない。導出する:
  // bench = squad.filter(n => !slots.some(s => s.playerNumber === n))
};
```

- `state.bench` と `BENCH_SIZE`（`squad-formations.js:109`）を廃止する。
- `bench` は `getBench()` の派生値にする。人数固定の制約が消える。

**4-b. UI 構成**

- 登録・並べ替え・削除の操作 UI は**キャンバスの外**（左カラム `.proto-panel` 側）に置く。
  ここは 44px のタップ領域を自由に確保できる。
- キャンバス内 `#bench` は**表示専用**にする。`<button>` をやめ、
  段階 3-a の cqw チップ（`.bench-chip` 相当、`squad.css:495` に既存定義あり）で描画する。
  → `::after` によるタップ領域拡張の回避策は不要になり、削除する。
- ピッチ上のカードは従来どおりタップで選手ピッカーを開く（変更なし）。

**4-c. LocalStorage 互換**

保存形式（`saveSquad()` 730 行）は新形式で書く:

```js
{ formationKey, slots:[...], squad:[番号...], title, matchInfo, poster, style, ... }
```

読み込み（`loadSquad()` 739 行）で旧形式を吸収する:

```js
// 旧形式は data.bench（長さ9・null 混じり）を持つ。squad へ畳み込む。
state.squad = Array.isArray(data.squad)
  ? data.squad
  : [
      ...data.slots.map((s) => s.playerNumber).filter(Boolean),
      ...(data.bench || []).filter(Boolean),
    ];
```

**旧形式での書き戻しは行わない**（合意済み）。
一度新形式で保存された保存データは、旧バージョンのページでは正しく読めなくなる。
リリース時にその旨をユーザー向け注記に含めるか判断すること。

---

## 5. 受け入れ条件

実装者は以下をすべて確認する。

| # | 条件 | 確認方法 |
|---|---|---|
| 1 | ベンチ 10 枠でもピッチ上のカードが 1 組も重ならない | 全フォーメーション × ベンチ 0/5/9/10 枠でPNG生成 |
| 2 | カード高さが 70px を下回らない | `fitCards()` のログ、または生成画像の実測 |
| 3 | ベンチチップがフッターから溢れて欠けない | 生成画像の目視 |
| 4 | 4-2-3-1（最も縦間隔が詰まる）で崩れない | 上記 1 に含む |
| 5 | 「自由配置」でドラッグ後も重ならない／はみ出さない | 手動ドラッグ後にPNG生成 |
| 6 | 旧形式の保存データが読み込めて表示が壊れない | 変更前のバージョンで保存 → 変更後に読み込み |
| 7 | ベンチの選手選択がキーボードで操作できる | Tab/Enter/Esc |
| 8 | フォーカスインジケータが消えていない | `squad.css:580` の指定が効いているか |
| 9 | スマホ幅（375px）で操作 UI が破綻しない | 実機またはDevTools |
| 10 | タップ領域が 44px 以上（段階4完了後は編集UI側で） | DevTools で実測 |

---

## 6. リリース単位の推奨

| リリース | 含む段階 | 効果 |
|---|---|---|
| R1 | 段階 1 | 重なりの大半が解消 |
| R2 | 段階 2 ＋ 段階 3 | 重なり完全解消・ベンチ欠けなし（この2つは分割しない） |
| R3 | 段階 4 | 構造改善・回避策の除去・ベンチ人数自由化 |

`public/squad.html` の CSS/JS 読み込みにはキャッシュバスティング用の
バージョンクエリが付いている（コミット `7f88748`）。**変更時に必ず更新すること。**

---

## 7. オーケストレーション向け担当分割

複数の実装者（またはエージェント）で並行実装する場合の分割案。
**編集ファイルが重ならないこと**を第一の基準に切っている。

### 7-0. 先に入れる「契約コミット」C0（必須・並行作業の前提）

並行作業の前に、**担当者間のインターフェースだけを先に確定してmainに入れる**。
これをやらないと `--card-h` / `--bench-scale` / `fitCards()` の戻り値で必ず衝突する。

C0 で確定・commit する内容（実装は空でよい）:

| 契約 | 定義 | 所有者 |
|---|---|---|
| `--card-h` | ピッチ要素に付くカード高さ(px)。既存 | A |
| `--bench-scale` | `#bench` に付く 0.6〜1.0 の倍率。CSSはこれを掛けるだけ | B（CSS）/ C（値の決定） |
| `CARD_H_MIN` | `squad-builder.js` の定数。値 70 | A |
| `fitCards()` の戻り値 | `{ cardH, idealH, clamped }` | A |
| `layoutAll()` | `fitCards()` → 再フィット → `layoutPitch()` を束ねる新関数 | A |
| `getBench()` | `state.squad` から控えの背番号配列を返す。段階4まではダミーで `state.bench.filter(Boolean)` を返す | D |
| `body.exporting` | 出力中を示すクラス。付与・解除は `exportPng()` 周辺 | C |

C0 は「定数・空関数・CSS変数のデフォルト値」だけの小さなコミット。
レビューは軽くてよいが、**A〜Dの着手前に必ずmainへ入れる**。

### 7-1. 担当（4並列＋検証1）

| 担当 | 役割 | 編集ファイル | 依存 |
|---|---|---|---|
| **A** | カード高さ計算 | `squad-builder.js` の `fitCards()` / `layoutAll()` のみ | C0 |
| **B** | キャンバスのレイアウト契約 | `squad.css` の `.pitch` / `.sq-footer` | C0 |
| **C** | ベンチ表示 | `squad.css` の `.bench-slot` 系、`squad-builder.js` の `renderBench()` / `exportPng()` 周辺 | C0、Bと同一リリース |
| **D** | 状態分離（段階4） | `squad-builder.js` の state / `saveSquad()` / `loadSquad()` / `openPicker()`、`squad.html` の左パネル、`squad-formations.js` の `BENCH_SIZE` 削除 | A・B・Cのマージ後 |
| **E** | 検証・記録 | `docs/ai/WORKLOG.md`、検証結果の記録 | 各リリース後 |

### 7-2. 作業範囲の境界（衝突しないための取り決め）

- **A は `squad.css` を触らない。** カード高さは `--card-h` の設定のみで表現する。
- **B は `squad-builder.js` を触らない。** 高さ配分はCSSだけで完結させる。
- **C は `.pitch` / `.sq-footer` を触らない。** ベンチが収まらない場合は
  `--bench-scale` を下げる方向でのみ解決し、フッターの `max-height` を緩めない。
- **A と C は `squad-builder.js` の別関数のみを編集する。**
  同一ファイルだが編集行が離れているため、gitのマージは通常成立する。
  それでも心配なら A → C の順に直列化してよい（Aは最小変更なので短時間で終わる）。
- **D は A/B/C がmainにマージされるまで着手しない。**
  `renderBench()` を作り直すため、Cと必ず衝突する。

### 7-3. 進行順序

```
      ┌─ A（段階1）─┐
C0 ───┤             ├─→ R1/R2 マージ ─→ D（段階4）─→ R3 ─→ E 最終検証
      ├─ B（段階2）─┤
      └─ C（段階3）─┘
        （B と C は同一リリースとして一緒に検証する）
```

- A は単独でリリース可能（R1）。先にマージしてよい。
- B と C は片方だけ入れるとベンチが欠けるため、**2つ揃ってから**マージする（R2）。
- E は R1 / R2 / R3 のそれぞれの後に §5 の受け入れ条件を確認する。

### 7-4. 各担当への指示テンプレート

そのまま渡せる粒度に落としたもの。§4 の該当段落と併せて読ませる。

**A への指示**
> `public/assets/squad-builder.js` の `fitCards()` だけを変更する。
> 400行の `Math.max(cardH, 75.1)` を定数 `CARD_H_MIN = 70` に置き換え、
> `{ cardH, idealH, clamped }` を返すようにする。`layoutAll()` を新設し、
> 既存の `fitCards()` + `layoutPitch()` の呼び出し箇所（343-345行、825行、830行、
> 836行、872行、876行付近）を `layoutAll()` に集約する。
> CSSファイルとその他の関数は触らないこと。詳細は計画書 §4 段階1。

**B への指示**
> `public/assets/squad.css` の `.pitch`（318行）と `.sq-footer`（466行）だけを変更する。
> ピッチに最小取り分、フッターに上限を与える。比率はヘッダー高さを実機で実測して決め、
> 決めた根拠をコメントで残すこと。JSは触らないこと。詳細は計画書 §4 段階2。

**C への指示**
> ベンチ表示をキャンバス基準にする。`squad.css` の `.bench-slot`（646-652行）を
> `--bench-scale` を掛けた `cqw` 指定にし、`squad-builder.js` の `renderBench()`
> （309-327行）で枚数に応じた `--bench-scale` を設定する。出力時は空き枠「＋」を
> 隠す（`body.exporting`）。`exportPng()`（654行）でクラス付与後に `layoutAll()` を
> 再実行してから撮影すること。`.pitch` / `.sq-footer` と `fitCards()` は触らないこと。
> 詳細は計画書 §4 段階3。

**D への指示**
> `state.bench` と `BENCH_SIZE` を廃止し、`state.squad`（人数自由）＋ `slots` から
> 控えを導出する構造に変える。ベンチ編集UIはキャンバス外の左パネルへ移し、
> キャンバス内 `#bench` は表示専用にする。`loadSquad()` で旧形式（`data.bench`）を
> 読めるようにする。**旧形式での書き戻しは不要。**
> Cが入れた `::after` によるタップ領域拡張の回避策は、このタイミングで削除する。
> 詳細は計画書 §4 段階4。

**E への指示**
> 各リリース後に計画書 §5 の受け入れ条件10項目を確認し、結果を
> `docs/ai/WORKLOG.md` に記録する。特に全フォーメーション × ベンチ 0/5/9/10枠での
> PNG生成を実施し、重なりの有無を目視確認すること。

### 7-5. 共通の注意（全担当）

- `public/squad.html` のバージョンクエリ（`?v=20260820-4`）を、CSS/JSを変更したら必ず更新する。
  **複数担当が同時に触ると衝突する**ため、**更新はリリース担当（E）が
  マージ後にまとめて1回だけ行う**。各担当は触らないこと。
- `docs/ai/WORKLOG.md` への記録は E に集約する（各担当が書くと衝突する）。
- 迷ったら §8「触ってはいけないもの」を確認する。

---

## 8. 触ってはいけないもの

- 試合日程データ、節番号、対戦相手、会場、キックオフ時刻（`AGENTS.md` の最重要ルール）
- 免責文言「非公式のファン作成コンテンツです。…」（`public/squad.html:167`）
- 選手カードのデザイン・配色・`aspect-ratio:47/64`（`squad.css:346-348`）
  — 今回の修正は「高さの決め方」だけを変え、見た目の比率は変えない
- `LOCALSTORAGE` の既存キー名（`STORAGE_INDEX_KEY` / `STORAGE_PREFIX`）

---

## 9. 参照

- 検討の経緯: 本ドキュメント §2（コミット `a808f1a` / `0119f51` / `24721ec` の意図と、その副作用）
- 既存の関連ドキュメント: `docs/squad-builder.md` / `docs/image-generation-research.md`
