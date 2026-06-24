# js-inventory.md

## 目的

このドキュメントは、`public/assets/app.js` のJavaScript整理に入る前の棚卸しです。
今後のJavaScript整理、LocalStorage整理、JSON描画改善、自動更新対応を安全に進めるため、現時点で確認できる役割、状態管理、DOM依存、CSSクラス依存、変更時の注意点を記録します。

今回の作業では、`public/assets/app.js`、HTML、CSS、日程JSON、LocalStorageキーは変更しません。
確認できない挙動や、実ブラウザ操作が必要な内容は「要確認」として扱います。

## 対象ファイル

- `public/assets/app.js`
- `public/sanga202627season.html`
- `public/data/matches.json`
- `public/assets/style.css`
- `docs/project-structure.md`
- `docs/css-inventory.md`
- `docs/html-analysis.md`
- `docs/ai/GOAL.md`
- `docs/ai/PLAN.md`
- `docs/ai/CHECKLIST.md`
- `docs/ai/BROWSER_CHECKLIST.md`
- `docs/ai/WORKLOG.md`

## JavaScript全体の大まかな構成

`public/assets/app.js` は `type="module"` 前提で、冒頭で `modern-screenshot` の `domToPng` をCDNからimportし、即時実行関数内で画面初期化を行っています。
大まかな並びは次の通りです。

1. LocalStorageキー、状態変数、表示モード・フィルタ候補の定義。
2. LocalStorage読み書き、試合カード状態の正規化・反映。
3. `.match[data-id]` クリックによるカード状態切り替え。
4. 使い方ダイアログ、設定パネル、共有画像UIに関係するDOM取得。
5. 使い方ダイアログと設定パネルの開閉処理。
6. 共有画像生成モード、画像生成状態、保存リンク、プレビュー表示の処理。
7. 表示列変更、表示モード変更、フィルタの初期化・保存・適用。
8. LocalStorage削除ボタンの処理。
9. `matches.json` 由来の日程カードDOM生成処理。
10. `fetch` による `data/matches.json` 読み込みと画面描画。

## 主要な責務

### 日程JSON読み込み

- `fetchJsonPreviewData()` が `data/matches.json?v=20260619-1` を `fetch` し、HTTPエラー時は例外を投げます。
- `renderJsonPreview()` がJSONを読み込み、`data.matches` が配列の場合に描画対象として扱います。
- 読み込み成功時は `jsonPreviewList.replaceChildren(...createJsonPreviewItems(matches))` で描画内容を差し替えます。
- 描画後に `initializeMatchStates(jsonPreviewList)` と `applyScheduleFilter()` を実行し、保存済みカード状態と絞り込み状態を再反映します。
- 読み込み失敗時は `jsonPreviewList.replaceChildren()` で表示を空にし、`console.warn` を出します。利用者向けエラーメッセージの有無は要確認です。

### 試合カード描画

- `createJsonPreviewItems(matches)` が年見出しと試合カードを順番に作成します。
- `getMatchDateYear(match)` は `match_date`、`date_candidates`、`round` から年を推定・取得します。`round` 由来の年推定は、仕様として固定してよいか要確認です。
- `createYearHeading(year)` は `.year.json-preview-year` を作成し、`data-year` を設定します。
- `createJsonMatchCard(match)` は `button.match.json-preview-match` を作成し、HOME/AWAY、対戦相手コード、日付、節、対戦相手、会場、注記をDOMとして組み立てます。
- `createDateContent(match)` は単一日付、候補日、未定表示を扱い、候補日がある場合は `.range` を使います。
- `formatDateParts(value)` は日本時間相当の `T00:00:00+09:00` で日付をパースし、月日・曜日・土日クラスを返します。
- `createHaLabel(label)` は `HOME` / `AWAY` の縦帯用に1文字ずつ `span` を作成します。

### 表示列変更

- LocalStorageキーは `sanga-schedule-layout-v1` です。
- `.layout-option` の `data-layout` により `1`、`2`、`3`、`4` を選びます。
- `setScheduleLayout(mode)` は `.phone` から `layout-1`、`layout-3`、`layout-4` を外し、選択値に応じて付け直します。
- 2列は追加クラスなしの既定状態として扱われています。
- 選択状態は `.layout-option` の `aria-pressed` で更新されます。
- クリック時は `event.preventDefault()` と `event.stopPropagation()` を行い、保存後に表示へ反映します。

### 表示モード変更

- LocalStorageキーは `sanga-schedule-display-mode-v1` です。
- 有効値は `card` と `compact` です。
- `readDisplayModeSettings()` はJSON文字列から `{mode}` を読み取り、不正値やパース失敗時は `card` に戻します。
- `applyDisplayMode(mode)` は `.phone` に `mode-card` / `mode-compact`、`[data-json-preview-list]` に `display-mode-card` / `display-mode-compact` を付けます。
- `.display-mode-option` の `data-display-mode` と `aria-pressed` が連動します。

### フィルタ

- LocalStorageキーは `sanga-schedule-filter-settings-v1` です。
- 有効値は `all`、`home`、`away`、`year-2026`、`year-2027`、`tentative`、`marked`、`state-1`、`state-2` です。
- `doesCardMatchFilter(card)` はカードの `data-home-away`、`data-year`、`data-status`、`data-has-candidates`、保存済みカード状態を見て表示対象を判定します。
- `applyScheduleFilter()` は `.json-preview-match` の `hidden` を切り替え、年見出し、フィルタボタンの `aria-pressed`、件数表示、空メッセージを更新します。
- フィルタはカード状態変更後にも再適用されます。

### LocalStorage保存・復元・削除

- カード状態は `sanga-schedule-button-states-v1` に、試合IDをキーにした状態値として保存されます。
- 表示列、表示モード、フィルタはそれぞれ専用キーに保存されます。
- LocalStorageが利用できない、または例外が発生した場合は `isStorageAvailable=false` になり、`.storage-clear-note` に保存できない旨の文言を出します。
- 削除ボタンはカード状態、表示列、フィルタ、表示モードの4キーを削除し、画面状態を初期値へ戻します。
- 削除後の初期値は、カード状態なし、2列、通常カード、フィルタ `all` です。

### 使い方ダイアログ

- `.help-button`、`.help-panel`、`.help-overlay`、`.help-close` を参照します。
- `openHelp()` は設定パネルを閉じ、オーバーレイとヘルプパネルを表示し、`.is-open` を付与します。
- `closeHelp()` は `.is-open` を外し、`PANEL_CLOSE_DELAY_MS`（従来どおり240ms）後に `hidden` を戻します。
- `aria-expanded` とフォーカス移動を更新します。
- Escapeキー、オーバーレイクリック、閉じるボタンで閉じる処理があります。

### 設定パネル

- `.settings-button`、`.settings-panel`、`.settings-close`、`#settings-title` を参照します。
- `openSettings()` は使い方パネルを閉じ、オーバーレイと設定パネルを表示し、`.is-open` を付与します。
- `closeSettings()` は `.is-open` を外し、`PANEL_CLOSE_DELAY_MS`（従来どおり240ms）後に `hidden` を戻します。
- `aria-expanded` とフォーカス移動を更新します。
- 設定パネル内には表示列、表示モード、フィルタ、共有画像生成入口があります。


### ダイアログ/設定パネルの閉じる待機時間

- 使い方ダイアログと設定パネルの閉じる待機時間は `PANEL_CLOSE_DELAY_MS` で管理します。
- 値は従来どおり `240ms` です。
- 数値の意味を明確にするための定数化のみで、挙動変更は行っていません。

### 共有画像関連

- `modern-screenshot` の `domToPng` を利用して、`[data-share-capture-target]` のDOMをPNG化します。
- `.share-generate-button` は複数箇所にあり、すべて同じ `generateShareImage()` を呼びます。
- `enterScreenshotMode()` は `.phone` に `is-screenshot-mode` を付け、共有画像生成用UIを表示します。
- `exitScreenshotMode()` はスクリーンショット関連クラスとUI表示を通常状態に戻します。
- `setShareGenerationState(state)` は `idle`、`loading`、`success`、`error` を管理し、`.phone` の `data-share-generation-state` と `is-share-*` クラス、ボタンの `aria-busy`、保存リンク、プレビュー、進捗表示を更新します。
- `generateShareImage()` はレイアウト待機、フォント読み込み待機、`domToPng` 実行、保存リンク・プレビュー設定、成功/失敗表示を担当します。
- CDN依存と実ブラウザ描画結果はローカル静的検証だけでは確認できないため要確認です。

## LocalStorage関連

### 使用しているキー

| キー | 用途 | 主な保存内容 |
| --- | --- | --- |
| `sanga-schedule-button-states-v1` | 試合カードごとのタップ状態 | `{ [matchId]: 0 | 1 | 2 }` 相当 |
| `sanga-schedule-filter-settings-v1` | フィルタ設定 | `{"activeFilter":"all"}` など |
| `sanga-schedule-display-mode-v1` | 表示モード設定 | `{"mode":"card"}` または `{"mode":"compact"}` |
| `sanga-schedule-layout-v1` | 表示列設定 | `"1"`、`"2"`、`"3"`、`"4"` |

### 保存している内容

- 試合カード状態は、`.match[data-id]` の `data-id` と `matchStates` オブジェクトで紐づきます。
- カード状態は `0`、`1`、`2` に正規化され、`data-state` と `aria-pressed` に反映されます。
- フィルタと表示モードはJSON文字列として保存されています。
- 表示列は選択値の文字列を直接保存しています。

### 変更時の注意点

- LocalStorageキー名を変更すると、既存利用者の保存状態が復元されなくなります。
- `matches.json` の `id` を変更すると、カードごとの保存状態と紐づかなくなる可能性があります。
- 保存形式を変更する場合は、旧形式の読み取り互換または移行処理が必要です。
- 削除ボタンの削除対象を変える場合は、使い方文言と削除後メッセージの整合性確認が必要です。
- `isStorageAvailable` はLocalStorage全体の利用可否として扱われるため、一部キーだけの例外対応へ変更する場合は要確認です。

### カード状態保持変数名

- カード状態保持変数名は `matchStates` です。
- 旧変数名 `states` からの改名のみで、LocalStorageキー文字列と保存形式は変更していません。
- 既存利用者の保存状態には影響しない想定です。

### LocalStorage利用可否フラグ名

- LocalStorage利用可否フラグ名は `isStorageAvailable` です。
- 旧変数名 `storageAvailable` からの改名のみで、LocalStorageキー文字列と保存形式は変更していません。
- 既存利用者の保存状態には影響しない想定です。

### 表示モード・フィルタ関連の内部定数名

- 表示モード・フィルタ関連の内部定数名は `VALID_DISPLAY_MODES`、`VALID_FILTERS`、`FILTER_LABELS` です。
- 旧定数名 `validDisplayModes`、`validFilters`、`filterLabels` からの改名のみで、表示モード値、フィルタ値、ラベル文言は変更していません。
- LocalStorageキー文字列と保存形式は変更していないため、既存利用者の保存状態には影響しない想定です。

## DOM依存

### 参照しているid

- `#settings-title`

### 参照しているclass

- `.storage-clear-note`
- `.match`
- `.help-button`
- `.help-panel`
- `.help-overlay`
- `.help-close`
- `.settings-button`
- `.settings-panel`
- `.settings-close`
- `.screenshot-exit-button`
- `.screenshot-share-note`
- `.screenshot-mode-live`
- `.share-image-actions`
- `.share-generate-button`
- `.share-save-link`
- `.share-save-help`
- `.share-status`
- `.share-progress`
- `.share-preview`
- `.share-preview-image`
- `.settings-button`
- `.phone`
- `.layout-option`
- `.display-mode-option`
- `.filter-option`
- `.filter-result`
- `.empty-filter-message`
- `.json-preview-match`
- `.json-preview-year`
- `.storage-clear`

### 操作しているdata属性

- `data-id`
- `data-state`
- `data-layout`
- `data-json-preview-list`
- `data-display-mode`
- `data-filter`
- `data-home-away`
- `data-year`
- `data-status`
- `data-has-candidates`
- `data-json-id`
- `data-share-capture-target`
- `data-share-generation-state`

### 操作しているaria属性

- `aria-pressed`
- `aria-expanded`
- `aria-busy`
- `aria-hidden`
- `aria-label`

## CSSクラス連動

JavaScriptが付与・削除する、または生成する主なCSSクラスは次の通りです。

- パネル開閉: `is-open`
- 表示列: `layout-1`、`layout-3`、`layout-4`
- 表示モード: `mode-card`、`mode-compact`、`display-mode-card`、`display-mode-compact`
- 共有画像: `is-screenshot-mode`、`is-share-loading`、`is-share-success`、`is-share-error`
- 年見出し: `year`、`json-preview-year`
- 試合カード: `match`、`json-preview-match`、`home`、`away`、`logo-${opponent_code}`
- カード内部: `match-inner`、`ha`、`meta`、`sec`、`team`、`place`、`date`、`main`、`sub`、`range`、`note`
- 日付状態: `tentative-date`、`compact-date`、`small`、`sun`、`sat`

`style.css` には、これらのクラスや `[hidden]`、`[aria-pressed="true"]`、`.match[data-state="1"]`、`.match[data-state="2"]` と連動するスタイルがあります。

## 変更しやすい箇所

- LocalStorageキー一覧、DOM参照一覧、CSSクラス連動一覧など、実装を変えないドキュメント整備。
- 関数の責務を説明するコメント追加。ただしコメント追加でも差分範囲を小さくする必要があります。
- `VALID_DISPLAY_MODES`、`VALID_FILTERS`、`FILTER_LABELS` の一覧をドキュメントと照合する作業。
- 表示列、表示モード、フィルタの既存挙動を変えずに、確認観点を追加する作業。

## 変更に注意が必要な箇所

- LocalStorageキー名、保存形式、復元順序、削除対象。
- `matchStates` と `match.id` / `data-id` の紐づき。
- `.match[data-id]` のクリック委譲。生成済みカードと今後追加されるカードの両方に影響します。
- `applyScheduleFilter()` はカード状態、フィルタボタン、年見出し、件数表示、空メッセージをまとめて更新するため、分割時は順序に注意が必要です。
- 使い方ダイアログと設定パネルは同じ `.help-overlay` を共有しているため、片方だけの変更でも相互影響があります。
- 共有画像関連は表示モード、フィルタ結果、フォント読み込み、CDNモジュール、DOM描画結果に依存するため高リスクです。
- `fetchJsonPreviewData()` のパスやクエリ文字列を変更すると、公開環境のキャッシュ更新方針に影響する可能性があります。
- `getMatchDateYear()` の `round` 由来推定は日程データ構造と結びつくため、仕様確認なしに変更しない方が安全です。

## 次に小さく整理できそうな候補

### 低リスク

- 関数の役割をコメントで補足する。
- LocalStorageキー一覧をドキュメント化し、変更禁止対象として明示する。
- DOM参照一覧をドキュメント化する。
- CSSクラス連動一覧をドキュメント化する。
- 共有画像関連を触らず、表示列・表示モード・フィルタの確認観点だけを整理する。
- `rg` で確認した依存箇所を、後続PRのチェックリストに追加する。

### 中リスク

- 近接する小さな補助関数の順序整理。ただし処理順と巻き上げへの依存を確認する必要があります。
- 表示列変更まわりの処理を小さく分ける。
- 表示モード変更まわりの処理を小さく分ける。
- フィルタの表示件数更新、年見出し更新、ボタン状態更新を、既存挙動を保ったまま小さな関数へ分ける。
- ダイアログ初期化処理のコメント整理。

### 高リスク

- LocalStorageキーや保存形式の変更。
- 試合カード描画構造の変更。
- 表示列・表示モード・フィルタの状態管理変更。
- 共有画像生成処理の整理。
- `matches.json` のID、日付、候補日、対戦相手コードと描画ロジックの同時変更。
- `fetch` パス、キャッシュバスター、エラー表示方針の変更。

## 今回は変更しないもの

- `public/assets/app.js`
- `public/sanga202627season.html`
- `public/assets/style.css`
- `public/data/matches.json`
- `.github/workflows/static-checks.yml`
- LocalStorageキー、保存形式、復元処理、削除処理
- JavaScriptの関数名、変数名、処理順、イベント処理
- HTMLのid、class、data属性
- CSSセレクタ、指定値、表示モード定義
- 試合日程データ、節番号、対戦相手、会場、キックオフ時刻

## 要確認事項

- `fetchJsonPreviewData()` のクエリ文字列 `v=20260619-1` の更新ルール。
- JSON読み込み失敗時に、利用者向けメッセージを追加するかどうか。
- `getMatchDateYear()` の `round` 由来年推定を今後も仕様として維持するか。
- 共有画像生成時のCDN依存、フォント待機、スマートフォン保存導線の実ブラウザ挙動。
- 設定パネルと使い方ダイアログのフォーカス移動が、すべての対象ブラウザで意図通りか。
- `isStorageAvailable=false` になった後の各設定復元・保存スキップ挙動が、利用者説明として十分か。
- 静的検証だけでは、表示列変更、表示モード、フィルタ、共有画像生成、ダイアログ開閉の実ブラウザ挙動は確認できない。

## JavaScript整理の実施計画

今回の大会フィルタ追加は、JavaScript整理そのものではなく、今後の整理時に守るべき「フィルタ関連処理の拡張」として扱います。大規模な関数分割やDOM構造変更は別PRで小さく進めます。

### 段階的な整理順

1. 定数・設定値の整理
   - `VALID_DISPLAY_MODES`、`VALID_FILTERS`、`FILTER_LABELS`、LocalStorageキー、既定値を確認し、HTMLやドキュメントとずれないようにする。
   - 大会フィルタ値 `competition-j1`、`competition-emp`、`competition-lev` は、HTMLの `data-filter`、`app.js` の判定、契約チェック、説明ドキュメントを揃える対象として扱う。
2. DOM参照の整理
   - `.filter-option`、`.filter-result`、`.empty-filter-message` など、設定パネルと結果表示に関わる参照を役割別に確認する。
   - 参照名の変更は、CSS・HTML・契約チェックと同時に確認する。
3. フィルタ関連処理の整理
   - `normalizeFilter()`、`readFilterSettings()`、`writeFilterSettings()`、`doesCardMatchFilter()`、`applyScheduleFilter()` の責務を保ったまま整理する。
   - HOME/AWAY、年、未確定、枠線あり、赤色枠、水色枠、大会フィルタを同じ契約として扱い、未知の保存値は既定値 `all` に戻す挙動を維持する。
   - 大会フィルタは `match.competition` 由来の `data-competition` を使うため、今後のフィルタ処理整理時に重要な契約になる。
4. 表示列・表示モード関連処理の整理
   - 表示列、通常カード/コンパクト表示の状態更新と保存処理を、フィルタ処理と混ぜずに確認する。
5. LocalStorage関連処理の整理
   - 既存キー `sanga-schedule-button-states-v1`、`sanga-schedule-layout-v1`、`sanga-schedule-filter-settings-v1`、`sanga-schedule-display-mode-v1` は変更しない。
   - 大会フィルタも既存のフィルタ保存キーに保存し、新しいキーは追加しない。
6. 試合カード描画処理の整理
   - `createJsonMatchCard()` が設定する `data-home-away`、`data-year`、`data-status`、`data-has-candidates`、`data-competition` をフィルタの入力契約として扱う。
   - DOM構造変更は共有画像やCSSへの影響が大きいため、別PRで慎重に行う。
7. 共有画像生成処理の整理
   - 共有画像生成は現在表示されているDOMを対象にするため、フィルタ適用後の `hidden` 状態と年見出し非表示が反映される前提を維持する。
8. ダイアログ・設定パネル操作の整理
   - 使い方パネルと設定パネルは同じオーバーレイを共有しているため、開閉制御やフォーカス移動はフィルタ追加とは分けて扱う。

### リスク別の整理対象

#### 低リスク

- 定数配列やラベル定義の確認・コメント整理。
- フィルタ値の定義整理と、HTML / app.js / `validate-app-contract.js` / `docs/filtering.md` の照合。
- エラーメッセージ、状態名、確認観点のドキュメント追記。
- 大会フィルタのように既存の単一フィルタ方式へ値を追加する小変更。

#### 中リスク

- DOM参照のまとめ直し。
- `doesCardMatchFilter()` の分岐整理や、フィルタ条件の補助関数化。
- 表示列 / 表示モードの適用処理整理。
- フィルタ件数、年見出し、空メッセージ、`aria-pressed` 更新順序の整理。

#### 高リスク

- 試合カード生成DOM構造の大幅変更。
- LocalStorageキーや保存形式の変更。
- 共有画像生成処理の大幅変更。
- 設定パネルや使い方パネルの開閉制御変更。
- `matches.json` の日程データや `id` とカード状態保存の紐づきを同時に変更する作業。

### 大会フィルタ実装との関係

- 大会フィルタは、今後のフィルタ処理整理時に重要な契約になるため、HTMLの `data-filter` 値、`app.js` の `VALID_FILTERS` / `FILTER_LABELS` / `doesCardMatchFilter()`、`validate-app-contract.js` の静的チェック、`docs/filtering.md` の説明を揃える。
- 内部値は既存JSONの `competition` 値に合わせ、`competition-j1` は `J1`、`competition-emp` は `EMP`、`competition-lev` は `LEV` を対象にする。
- 共有画像生成は現在の絞り込み後DOMを使うため、大会フィルタ追加後も `applyScheduleFilter()` によるカード非表示と年見出し非表示を維持する。

## 2026-06-22 低リスクセクションコメント追加

`public/assets/app.js` に、JavaScriptの主要な責務を把握しやすくするためのセクションコメントを追加しました。

- 追加したのはコメント見出しのみで、処理内容・関数名・変数名・処理順・イベントリスナーは変更していません。
- LocalStorageキー、保存形式、復元処理、削除処理は変更していません。
- DOM参照、`data-*` 属性、`aria-*` 属性、CSSクラス連動は変更していません。
- 表示列、表示モード、フィルタ、共有画像関連の次の整理候補は未実施です。

## JavaScript契約チェック対象の追加

- `tools/validate-app-contract.js` では、LocalStorageキー、JSON読み込みパス、主要DOM/CSSフックに加えて、表示列、表示モード、フィルタの有効値も静的契約チェック対象にする。
- 表示列切替、表示モード切替、フィルタ操作、カード状態切替の実際の操作確認は、この静的チェックだけで完了扱いにせず、`docs/ai/BROWSER_CHECKLIST.md` と変更内容別の確認観点に沿って行う。

## 2026-06-22 LocalStorageキー定数名の明確化

- `public/assets/app.js` のLocalStorageキー用の内部定数名を、用途が分かる名前へ変更した。
- LocalStorageキー文字列と保存形式は変更していない。
- 既存利用者の保存済みカード状態、フィルタ、表示モード、表示列設定には影響しない想定である。

### 表示モード・フィルタ・表示列の既定値定数

- 表示モード・フィルタ・表示列の既定値は `DEFAULT_DISPLAY_MODE`、`DEFAULT_FILTER`、`DEFAULT_LAYOUT` で管理します。
- 既定値は従来どおり `card`、`all`、`2` です。
- LocalStorageキー文字列と保存形式は変更していません。
- 復元時のフォールバック値を同じ値の定数参照にしただけのため、既存利用者の保存状態には影響しない想定です。

## 2026-06-24 フィルタ関連処理の整理

- `public/assets/app.js` では、フィルタ値・表示ラベル・判定種別を `FILTER_DEFINITIONS` にまとめ、互換用の `VALID_FILTERS` と `FILTER_LABELS` は定義から生成する構造に整理しました。
- 大会フィルタは他のフィルタと同じ定義内で扱い、`competition-j1` は JSON の `competition: "J1"`、`competition-emp` は `"EMP"`、`competition-lev` は `"LEV"` に対応します。
- 既存契約として `VALID_FILTERS`、`FILTER_LABELS`、`DEFAULT_FILTER`、`activeFilter`、`normalizeFilter()`、`doesCardMatchFilter()`、`applyScheduleFilter()` は維持します。
- `doesCardMatchFilter()` は現在の `activeFilter` に対応する定義を取得し、実際の判定は `doesCardMatchDefinition()` に委譲します。
- `applyScheduleFilter()` は、カード取得、表示/非表示更新、年見出し更新、フィルタボタンの `aria-pressed` 更新、件数・0件表示更新の順で補助関数を呼ぶ司令塔として整理しました。
- 今回は複数フィルタ化、フィルタUIの追加・削除、LocalStorageキー追加、保存形式変更、共有画像生成処理の変更は行っていません。

## 2026-06-24 表示列・表示モード関連処理の整理

- `public/assets/app.js` では、表示列値・ラベル・`.phone` へ付与するCSSクラスを `LAYOUT_DEFINITIONS` にまとめました。
- 表示列は `1 / 2 / 3 / 4` の単一選択で、`1` は `layout-1`、`3` は `layout-3`、`4` は `layout-4` を使います。`2` は追加クラスなしの既定状態で、`layout-2` は新設していません。
- 表示列は既存キー `LAYOUT_STORAGE_KEY`（`sanga-schedule-layout-v1`）に、従来どおり文字列 `"1" / "2" / "3" / "4"` として保存します。
- 表示モード値・ラベル・`.phone` と `[data-json-preview-list]` へ付与するCSSクラスは `DISPLAY_MODE_DEFINITIONS` にまとめました。
- 表示モードは `card / compact` の単一選択で、`card` は `mode-card` / `display-mode-card`、`compact` は `mode-compact` / `display-mode-compact` を使います。
- 表示モードは既存キー `DISPLAY_MODE_STORAGE_KEY`（`sanga-schedule-display-mode-v1`）に、従来どおり `{ "mode": "card" }` または `{ "mode": "compact" }` 形式で保存します。
- 契約として `setScheduleLayout()`、`applyDisplayMode()`、`normalizeDisplayMode()` は維持し、内部で正規化、CSSクラス更新、ボタンの `aria-pressed` 更新を補助関数へ分けました。
- 今回は表示列や表示モードの追加、LocalStorageキー追加、保存形式変更、CSS変更、共有画像生成処理の変更は行っていません。
