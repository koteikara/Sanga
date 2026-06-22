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
- LocalStorageが利用できない、または例外が発生した場合は `storageAvailable=false` になり、`.storage-clear-note` に保存できない旨の文言を出します。
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

- 試合カード状態は、`.match[data-id]` の `data-id` と `states` オブジェクトで紐づきます。
- カード状態は `0`、`1`、`2` に正規化され、`data-state` と `aria-pressed` に反映されます。
- フィルタと表示モードはJSON文字列として保存されています。
- 表示列は選択値の文字列を直接保存しています。

### 変更時の注意点

- LocalStorageキー名を変更すると、既存利用者の保存状態が復元されなくなります。
- `matches.json` の `id` を変更すると、カードごとの保存状態と紐づかなくなる可能性があります。
- 保存形式を変更する場合は、旧形式の読み取り互換または移行処理が必要です。
- 削除ボタンの削除対象を変える場合は、使い方文言と削除後メッセージの整合性確認が必要です。
- `storageAvailable` はLocalStorage全体の利用可否として扱われるため、一部キーだけの例外対応へ変更する場合は要確認です。

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
- `validDisplayModes`、`validFilters`、`filterLabels` の一覧をドキュメントと照合する作業。
- 表示列、表示モード、フィルタの既存挙動を変えずに、確認観点を追加する作業。

## 変更に注意が必要な箇所

- LocalStorageキー名、保存形式、復元順序、削除対象。
- `states` と `match.id` / `data-id` の紐づき。
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
- `storageAvailable=false` になった後の各設定復元・保存スキップ挙動が、利用者説明として十分か。
- 静的検証だけでは、表示列変更、表示モード、フィルタ、共有画像生成、ダイアログ開閉の実ブラウザ挙動は確認できない。

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
