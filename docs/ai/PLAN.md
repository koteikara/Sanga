# PLAN.md

## 現在の作業テーマ

京都サンガ日程表HTMLの安全な改善運用を確立する。

## 作業対象

- `public/sanga202627season.html`
- `docs/html-analysis.md`
- `docs/ai/GOAL.md`
- `docs/ai/PLAN.md`
- `docs/ai/CHECKLIST.md`
- `docs/ai/WORKLOG.md`

## 標準作業フロー

### 1. 事前確認

- `AGENTS.md` を確認する。
- `docs/html-analysis.md` を確認する。
- `docs/ai/GOAL.md` を確認する。
- 今回の依頼が、表示修正、機能修正、文言修正、データ修正のどれかを分類する。

### 2. 変更計画

以下を整理してから実装する。

- 変更対象ファイル
- 変更対象のHTML/CSS/JavaScript範囲
- 影響を受ける機能
- LocalStorageへの影響
- スマートフォン表示への影響
- アクセシビリティへの影響
- 確認方法

### 3. 実装

- 変更は最小単位で行う。
- 無関係な整形はしない。
- 既存仕様に影響する変更は、理由を記録する。
- 大規模分離や全面整理は、別タスクとして扱う。

### 4. 確認

`docs/ai/CHECKLIST.md` に沿って確認する。

最低限確認すること:

- 主要表示が崩れていない。
- スマートフォン幅で確認している。
- 表示列変更が動く。
- 使い方ダイアログが開閉する。
- LocalStorage削除ボタンが動く。
- キーボード操作できる。
- フォーカス表示が見える。
- ブラウザコンソールに明らかなエラーがない。

### 5. 記録

`docs/ai/WORKLOG.md` に以下を記録する。

- 日付
- 作業テーマ
- 変更ファイル
- 変更内容
- 確認結果
- 未確認項目
- 残課題
- 次にレビューしてほしい観点

## 今後の改善候補

- HTML内の日程データと表示ロジックの分離
- CSSの外部ファイル化
- JavaScriptの外部ファイル化
- 試合データのJSON化
- Googleスプレッドシート連携
- GitHub Actionsによる簡易チェック
- Playwrightによるスマートフォン表示確認
- アクセシビリティ確認チェックの半自動化

## 今回の作業計画: 試合カード高が大きい行の表示崩れ改善

### 作業テーマ

試合カード内の日付候補や注記などによりカードの縦幅が大きくなった場合でも、同じCSS Grid行に並ぶカードの内部表示が不自然に短く残らないよう、既存デザインを保ったまま最小限のCSSで改善する。

### 変更対象ファイル

- `docs/ai/PLAN.md`
- `docs/ai/GOAL.md`
- `docs/ai/WORKLOG.md`
- `public/assets/style.css`

### 変更対象になりそうなCSS/HTML範囲

- `.grid` の行内アイテム伸長設定
- `.match` / `.match-inner` の高さ継承
- `.ha` / `.date` など、カード内の縦帯・日付欄の伸長設定
- HTML構造は変更しない方針

### 表示崩れの原因候補

- CSS Gridの各セル自体は同じ行で伸びても、カード内部の `.match-inner` や縦帯・日付欄がカード全体の高さに追随しない可能性がある。
- `.ha` や `.date` に固定的な `min-height` が複数箇所で指定され、後段のレイアウト別CSSと競合している可能性がある。
- 特に注記付きカードや候補日レンジカードで縦幅が増えた際、隣のカードの背景・縦帯・日付欄だけが短く見える可能性がある。

### LocalStorageへの影響有無

- CSSのみの修正を予定するため、LocalStorageキー・保存値・復元処理への影響はなし。
- `sanga-schedule-button-states-v1`、`sanga-schedule-layout-v1` 等の既存キーは変更しない。

### スマートフォン表示への影響

- スマートフォン幅を優先し、2列表示で同じ行のカード高さと内部背景が自然にそろうことを確認する。
- 1列、3列、4列、コンパクト表示では既存の収まりを大きく変えず、カード内部の高さ追随だけを改善する。

### アクセシビリティへの影響

- CSSの高さ調整のみとし、button要素、フォーカス表示、`aria-pressed`、ダイアログ属性は変更しない。
- フォーカスインジケータを消さない。
- 色だけに依存した説明や文言は変更しない。

### 確認方法

- `git diff -- public/sanga202627season.html public/data/matches.json` などで日程データを変更していないことを確認する。
- 静的ファイル確認またはブラウザ確認で、PC幅・スマートフォン幅・縦幅が大きいカードを含む行を確認する。
- 表示列変更、使い方ダイアログ開閉、LocalStorage削除ボタン、キーボードフォーカス、ブラウザコンソールエラー有無を確認する。
- ブラウザで確認できない項目がある場合は、`docs/ai/WORKLOG.md` に未確認項目として記録する。

### 変更しないもの

- 試合日程データ、節番号、日付、曜日、時刻、対戦相手、会場、ホーム/アウェイ情報
- LocalStorageキーと保存仕様
- 表示列変更、使い方ダイアログ、LocalStorage削除ボタンのJavaScript
- 免責事項、使い方、LocalStorage説明文
- HTMLの大きな構造変更や無関係な整形

## 今回の作業計画: GitHub Actionsによる静的検証ワークフロー追加

### 作業テーマ

Pull Requestと`main`ブランチへのpush時に、Codexがこれまで手動実行していた静的チェックをGitHub Actionsで自動実行できるようにする。今回の作業は静的検証CIの追加であり、HTML/CSS/JavaScript/日程データの修正は行わない。

### 追加するワークフローファイル

- `.github/workflows/static-checks.yml`

### 実行するチェック内容

- `git diff --check` で空白エラーなどを確認する。
- `node tools/validate-matches.js` で日程JSONを検証する。
- `node tools/validate-generated-matches.js public/data/matches.json --expected-count 38 --strict` で生成JSONを厳格検証する。
- `node --check public/assets/app.js` で既存JavaScriptの構文を検証する。
- `public/assets/style.css` の `{` と `}` の数が一致することを確認する。
- `public/sanga202627season.html` が `assets/style.css` を参照していることを確認する。
- `public/sanga202627season.html` が `assets/app.js` を参照していることを確認する。

### 実行タイミング

- Pull Request作成・更新時。
- `main`ブランチへのpush時。

### 変更しないファイル

- `public/sanga202627season.html`
- `public/assets/style.css`
- `public/assets/app.js`
- `public/data/matches.json`

### LocalStorageへの影響有無

- GitHub Actionsワークフローと作業記録のみの変更のため、LocalStorageキー・保存値・復元処理への影響はない。
- `sanga-schedule-button-states-v1`、`sanga-schedule-layout-v1` など既存キーは変更しない。

### 今回あえてPlaywrightを入れない理由

- PR #81でnpm registryの403によりPlaywright取得に失敗しており、まずは外部依存の少ない静的検証を安定させるため。
- 今回の目的は実ブラウザ確認ではなく、PRごとの基本的な静的チェックを確実に自動化することに限定するため。
- npmパッケージ追加や外部依存追加を避け、既存のNode.jsスクリプトと標準的なシェル/Pythonで確認できる範囲に絞るため。

### 確認方法

- 既存ワークフローを確認し、既存の本番デプロイ・Pagesワークフローを壊さないことを確認する。
- ローカルで `node tools/validate-matches.js` を実行する。
- ローカルで `node tools/validate-generated-matches.js public/data/matches.json --expected-count 38 --strict` を実行する。
- ローカルで `node --check public/assets/app.js` を実行する。
- 追加したYAMLに明らかなインデントミスがないか確認する。
- `git diff --check` を実行する。
- GitHub Actions上での実行結果は、PR作成後にGitHub上で確認する。

## 2026-06-22 低リスクCSSコメント見出し追加

### 作業テーマ

`docs/css-inventory.md` の棚卸し内容をもとに、`public/assets/style.css` へ低リスクなコメント見出しを追加し、CSSの大まかな章立てを追いやすくする。

### 変更対象ファイル

- `public/assets/style.css`
- `docs/css-inventory.md`
- `docs/ai/WORKLOG.md`
- `docs/ai/GOAL.md`

### 追加するコメント見出しの方針

- CSS指定値、セレクタ、既存の並び順を変更せず、章の始まりが分かるコメント見出しだけを追加する。
- 既存コメントは削除せず、既存コメントの直前または自然な区切りに補助的な大見出しを追加する。
- `docs/css-inventory.md` で整理した、基本レイアウト、試合カード、日付・メタ情報、レスポンシブ・列モード、フッター操作、ダイアログ・設定、表示モード・フィルタ・共有画像モードの分類に沿って見出しを置く。
- 大きな移動や統合は行わず、後続の整理時に参照しやすい目印を増やすだけにする。

### 変更しないもの

- CSSの指定値、セレクタ、セレクタ名、ルールの統合・削除・大きな並び替え。
- `public/sanga202627season.html`。
- `public/assets/app.js`。
- `public/data/matches.json`。
- `.github/workflows/static-checks.yml`。
- LocalStorageキー、保存仕様、JavaScriptの挙動。
- 日程、節番号、対戦相手、会場、キックオフ時刻などの日程データ。

### 表示・LocalStorage・JavaScriptへの影響がない理由

- CSSコメントはブラウザのスタイル解釈結果に影響しないため、表示・レイアウト・状態表示は変わらない。
- セレクタ、プロパティ、値、CSSルールの順序を変更しないため、既存のカスケードと上書き関係は維持される。
- HTML、JavaScript、日程JSONを変更しないため、DOM参照、イベント処理、LocalStorageキー、保存・復元処理には影響しない。

### 確認方法

- `git diff --check` を実行する。
- `node tools/validate-matches.js` を実行する。
- `node tools/validate-generated-matches.js public/data/matches.json --expected-count 38 --strict` を実行する。
- `node --check public/assets/app.js` を実行する。
- Pythonで `public/assets/style.css` の `{` と `}` の数が一致することを確認する。
- Pythonで `public/sanga202627season.html` が `assets/style.css` と `assets/app.js` を参照していることを確認する。
- `git diff -- public/sanga202627season.html public/assets/app.js public/data/matches.json .github/workflows/static-checks.yml` で変更禁止ファイルに差分がないことを確認する。
- 可能であれば Static Checks 相当のローカル確認結果をWORKLOGへ記録する。

## 2026-06-22 CSS近接重複・上書き候補調査

### 作業テーマ

CSS整理の第2段階として、`public/assets/style.css` の近接重複・上書き候補を調査し、次のPRで安全に小さく整理できそうな候補と、注意・保留すべき候補を分類する。今回はCSS本体の実装修正ではなく、調査・分類・ドキュメント追記・WORKLOG記録のみを行う。

### 調査対象ファイル

- `public/assets/style.css`
- `docs/css-inventory.md`
- `docs/ai/WORKLOG.md`

### 調査方法

- `public/assets/style.css` を読み、同じセレクタの複数出現、近い位置での同一プロパティ再指定、コメント見出し追加後も役割が分かりにくい箇所を確認する。
- `rg` と一時的なPythonワンライナーで、同一セレクタの出現回数を確認する。調査用スクリプトはコミットしない。
- `.match`、`.match-inner`、`.ha`、`.date`、`.layout-*`、`.footer-tools`、`.layout-option`、`.share-save-link` など、棚卸しで注意対象になっている箇所を重点的に見る。
- 表示列、コンパクト表示、共有画像モード、ダイアログ、LocalStorage削除ボタン周辺に関わるものは、低リスクと断定しない。

### 変更しないもの

- `public/assets/style.css` の指定値、セレクタ、セレクタ名、並び順、統合、削除、移動。
- `public/sanga202627season.html`。
- `public/assets/app.js`。
- `public/data/matches.json`。
- `.github/workflows/static-checks.yml`。
- LocalStorageキー、保存仕様、JavaScriptの挙動。
- 試合日程、節番号、対戦相手、会場、キックオフ時刻などの日程データ。

### 調査結果の分類方針

- 低リスクで整理できそうな候補: 次のPRで本当に小さく、指定値を変えずに近接する重複コメントや同一目的の記述を整理できそうなものだけに限定する。
- 注意が必要な候補: 表示列、レスポンシブ、コンパクト表示、ダイアログ、操作ボタン、フォーカス表示に関係し、統合前に差分確認が必要なものにする。
- 現時点では触らない候補: `.match`、`.date`、`.ha`、`.layout-*`、共有画像モード、LocalStorage削除ボタン周辺など、表示・操作・保存説明への影響が大きいものにする。
- 実ブラウザ確認が必要な候補: 静的確認だけでは判断できないカード高さ、日付欄、フッター操作、共有画像生成状態などに関係するものにする。
- 確認できないものは「要確認」と記録し、推測で不要とは断定しない。

### 確認方法

- `docs/css-inventory.md` に調査結果が追記されていることを確認する。
- `docs/ai/WORKLOG.md` に今回の作業記録が追記されていることを確認する。
- `git diff -- public/assets/style.css public/sanga202627season.html public/assets/app.js public/data/matches.json .github/workflows/static-checks.yml` で変更禁止ファイルに差分がないことを確認する。
- `git diff --check` を実行する。

## 2026-06-22 CSS低リスク補足コメント追加

### 作業テーマ

- `docs/css-inventory.md` の近接重複・上書き候補調査に基づき、低リスク候補へ補足コメントだけを追加する。
- 今回は見た目や挙動を変更せず、将来のCSS整理時に意図的な上書き箇所を誤って統合・削除しないための記録に限定する。

### 補足コメントを追加する対象

- `.footer-tools .legend`
- `.footer-actions`
- `.help-button:active`
- `.storage-clear:active`

### コメント追加の方針

- 対象ルールの直前、または同じセクション内の近い位置に、短い説明コメントだけを追加する。
- 基本指定と後続調整、フッター用配置と設定パネル用配置、`prefers-reduced-motion` 内のアクセシビリティ目的が分かる表現にする。
- コメントは必要最小限にし、CSS指定値・セレクタ・ルール順序・表示挙動は変更しない。

### 変更しないもの

- CSSの指定値、セレクタ、セレクタ名、ルールの並び順、統合、削除。
- `public/sanga202627season.html`、`public/assets/app.js`、`public/data/matches.json`、`.github/workflows/static-checks.yml`。
- LocalStorageキー、保存仕様、JavaScript挙動、日程データ。
- `.match`、`.match-inner`、`.ha`、`.date`、`.layout-*`、共有画像モード、LocalStorage削除ボタン周辺の統合・整理。

### 表示・LocalStorage・JavaScriptへの影響がない理由

- 追加するのはCSSコメントのみで、ブラウザが解釈する指定値やセレクタには影響しない。
- HTML、JavaScript、日程JSON、LocalStorageキーを変更しないため、DOM構造、画面操作、保存・復元仕様には影響しない。
- CSSルールの並び順やカスケード結果を変えないため、PC幅・スマートフォン幅の表示モードにも影響しない。

### 確認方法

- `git diff --check`
- `node tools/validate-matches.js`
- `node tools/validate-generated-matches.js public/data/matches.json --expected-count 38 --strict`
- `node --check public/assets/app.js`
- Pythonワンライナーで `public/assets/style.css` の `{` と `}` の数が一致することを確認する。
- Pythonワンライナーで `public/sanga202627season.html` が `assets/style.css` と `assets/app.js` を参照していることを確認する。
- `git diff -- public/sanga202627season.html public/assets/app.js public/data/matches.json .github/workflows/static-checks.yml --exit-code` で変更禁止ファイルに差分がないことを確認する。

## 2026-06-22 JavaScript棚卸しドキュメント追加

### 今回の作業テーマ

`public/assets/app.js` の実装整理に入る前の棚卸しとして、JavaScript全体の構成、状態管理、DOM依存、CSSクラス依存、LocalStorage依存、次に小さく整理できそうな候補をドキュメント化する。今回の作業は JavaScript棚卸しドキュメント追加であり、JavaScript本体の修正ではない。

### 調査対象ファイル

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

### 調査方法

- `public/assets/app.js` を読み、主要な定数、LocalStorageキー、DOM取得、イベントリスナー、fetch、描画関数、表示列変更、表示モード変更、フィルタ、ダイアログ、設定パネル、共有画像関連、属性操作を確認する。
- `rg "localStorage|querySelector|getElementById|classList|dataset|aria-|addEventListener|fetch|hidden" public/assets/app.js` で、依存箇所を横断確認する。
- `public/sanga202627season.html`、`public/assets/style.css`、`public/data/matches.json` は参照関係の確認のみ行い、内容は変更しない。
- 確認できない仕様や、実ブラウザ操作が必要な挙動は断定せず「要確認」として記録する。

### 変更しないもの

- `public/assets/app.js`
- `public/sanga202627season.html`
- `public/assets/style.css`
- `public/data/matches.json`
- `.github/workflows/static-checks.yml`
- LocalStorageキー、保存形式、復元順序、削除対象
- JavaScriptの関数名、変数名、処理順、イベント処理
- 試合日程データ、節番号、日付、時刻、対戦相手、会場、ホーム/アウェイ情報

### LocalStorageへの影響がない理由

- 今回はドキュメント追加と作業記録のみで、`public/assets/app.js` のLocalStorage読み書き処理を変更しないため。
- 既存キー名、保存値、復元処理、削除処理、試合IDに関わる実装やデータを変更しないため。
- `public/sanga202627season.html` のボタンや説明文、`public/data/matches.json` のID、`public/assets/style.css` の表示指定も変更しないため。

### 確認方法

- `docs/js-inventory.md` が作成され、JavaScript構成、LocalStorage、DOM依存、CSSクラス連動、次の整理候補が記録されていることを確認する。
- `docs/ai/WORKLOG.md` に今回の作業結果、未確認項目、残課題が記録されていることを確認する。
- `git diff -- public/assets/app.js public/sanga202627season.html public/assets/style.css public/data/matches.json .github/workflows/static-checks.yml --exit-code` で変更禁止ファイルに差分がないことを確認する。
- `git diff --check` を実行する。
- `node --check public/assets/app.js` を実行する。
- 可能な範囲でStatic Checks相当の既存ローカル検証を実行する。

## 2026-06-22 JavaScript低リスクセクションコメント追加

### 今回の作業テーマ

`docs/js-inventory.md` の棚卸し内容をもとに、`public/assets/app.js` の主要な責務が分かるように、低リスクなセクションコメントだけを追加する。今回の作業は JavaScript低リスクセクションコメント追加であり、挙動を変える修正ではない。

### コメントを追加する対象

- `public/assets/app.js` の import と即時関数初期化付近。
- LocalStorageキー、状態、読み書き補助関数付近。
- 試合カードの個人状態管理付近。
- 使い方ダイアログ、設定パネル、共有画像モード入口付近。
- 表示列、表示モード、フィルタ付近。
- LocalStorage削除処理付近。
- JSON読み込み、日程カード生成、描画付近。
- 共有画像生成処理付近。

### コメント追加の方針

- 処理の移動、統合、削除、リネームは行わず、既存コードの直前に短い大見出しコメントだけを追加する。
- 既存コメントは削除せず、`modern-screenshot`、LocalStorage、DOM依存、表示列・表示モード・フィルタ、共有画像関連の境界が分かる最小限の見出しにする。
- コメント数は必要最小限にし、冗長な関数単位コメントは追加しない。

### 変更しないもの

- JavaScriptの処理内容、関数名、変数名、処理順、イベントリスナー。
- LocalStorageキー、保存形式、復元順序、削除対象。
- DOMのid、class、data属性参照。
- CSSクラスの付与・削除処理。
- `public/sanga202627season.html`、`public/assets/style.css`、`public/data/matches.json`、`.github/workflows/static-checks.yml`。
- 試合日程データ、節番号、対戦相手、会場、キックオフ時刻。

### LocalStorage・DOM・CSSクラス連動への影響がない理由

- 追加するのはJavaScriptコメントのみで、実行される文、式、関数、イベント登録は変更しないため。
- LocalStorageキー文字列、読み書き関数、削除処理、保存値のJSON形式を変更しないため。
- DOM取得セレクタ、`dataset`、`classList`、`aria-*` 操作、CSSクラス名を変更しないため。
- HTML、CSS、日程JSONを変更しないため、既存DOM構造、表示指定、日程データとの連動は維持されるため。

### 確認方法

- `git diff --check`
- `node --check public/assets/app.js`
- `node tools/validate-matches.js`
- `node tools/validate-generated-matches.js public/data/matches.json --expected-count 38 --strict`
- Pythonワンライナーで `public/assets/style.css` の `{` と `}` の数が一致することを確認する。
- Pythonワンライナーで `public/sanga202627season.html` が `assets/style.css` と `assets/app.js` を参照していることを確認する。
- `git diff -- public/sanga202627season.html public/assets/style.css public/data/matches.json .github/workflows/static-checks.yml --exit-code` で変更禁止ファイルに差分がないことを確認する。

## 2026-06-22 JavaScript契約チェック追加

### 今回の作業テーマ

`docs/ai/JS_CHANGE_CHECKLIST.md` のうち機械的に確認できる項目を、Node.js標準機能だけで実行できる JavaScript契約チェックとして追加する。今回の作業は JavaScript契約チェックの自動化であり、`public/assets/app.js` 本体の整理・実装修正ではない。

### 追加する検証スクリプト

- `tools/validate-app-contract.js` を新規作成する。
- `public/assets/app.js` と `public/sanga202627season.html` を読み込み、LocalStorageキー、JSON読み込みパス、HTMLからのCSS/JS参照、主要DOMフック、主要CSS連動クラス名が残っているかを静的に確認する。
- 外部 npm パッケージは追加せず、`node:fs`、`node:path` などNode.js標準機能のみを使う。

### Static Checksへ追加する内容

- `.github/workflows/static-checks.yml` に `node tools/validate-app-contract.js` を追加する。
- 追加位置は既存の `node --check public/assets/app.js` の直後を基本とし、既存チェックの順序を大きく変えない。

### 検証対象

- LocalStorageキー:
  - `sanga-schedule-button-states-v1`
  - `sanga-schedule-filter-settings-v1`
  - `sanga-schedule-display-mode-v1`
  - `sanga-schedule-layout-v1`
- JSON読み込みパス:
  - `data/matches.json`
- HTML参照:
  - `assets/app.js`
  - `assets/style.css`
- 主要DOM・CSS連動フック:
  - `.help-button`、`.help-panel`、`.help-overlay`、`.help-close`
  - `.settings-button`、`.settings-panel`、`.settings-close`
  - `.storage-clear`、`.storage-clear-note`
  - `.layout-option`、`.display-mode-option`、`.filter-option`、`.filter-result`、`.empty-filter-message`
  - `json-preview-match`、`json-preview-year`
  - `is-screenshot-mode`、`is-share-loading`、`is-share-success`、`is-share-error`

### 変更しないもの

- `public/assets/app.js`
- `public/sanga202627season.html`
- `public/assets/style.css`
- `public/data/matches.json`
- LocalStorageキー、保存形式、復元処理、削除処理
- JavaScriptの関数名、変数名、処理順、イベント処理
- npm依存、Playwright、実ブラウザ自動化

### LocalStorageへの影響がない理由

- 今回追加するスクリプトはファイル内容を読み取るだけで、ブラウザのLocalStorageへアクセスしないため。
- `public/assets/app.js` のLocalStorageキー文字列、読み書き処理、削除処理を変更しないため。
- HTML、CSS、日程JSONを変更しないため、既存利用者の保存済み表示設定やカード状態の紐づきに影響しないため。

### 確認方法

- `node tools/validate-app-contract.js`
- `git diff --check`
- `node --check public/assets/app.js`
- `node tools/validate-matches.js`
- `node tools/validate-generated-matches.js public/data/matches.json --expected-count 38 --strict`
- Pythonワンライナーで `public/assets/style.css` の `{` と `}` の数が一致することを確認する。
- Pythonワンライナーで `public/sanga202627season.html` が `assets/style.css` と `assets/app.js` を参照していることを確認する。
- Static Checks相当のコマンドをローカルで実行する。
- `git diff -- public/assets/app.js public/sanga202627season.html public/assets/style.css public/data/matches.json --exit-code` で変更禁止ファイルに差分がないことを確認する。

## 2026-06-22 JavaScript契約チェックの有効値検証強化

### 作業テーマ

JavaScript本体の整理に進む前の安全策として、`tools/validate-app-contract.js` の静的契約チェックを強化し、表示列・表示モード・フィルタ・カード状態の有効値が不用意に欠落した場合に検知できるようにする。

### 強化する検証内容

- 表示列: `1`、`2`、`3`、`4` と、CSS連動クラス `layout-1`、`layout-3`、`layout-4` が `public/assets/app.js` に残っていることを確認する。
- 表示モード: `card`、`compact` と、CSS連動クラス `mode-card`、`mode-compact`、`display-mode-card`、`display-mode-compact` が残っていることを確認する。
- フィルタ: `all`、`home`、`away`、`year-2026`、`year-2027`、`tentative`、`marked`、`state-1`、`state-2` が残っていることを確認する。
- カード状態: 誤検知を避けるため、`data-state` や状態正規化処理の周辺で `0`、`1`、`2` の扱いが残っていることを確認する。

### 変更対象ファイル

- `tools/validate-app-contract.js`
- `docs/ai/PLAN.md`
- `docs/ai/GOAL.md`
- `docs/ai/JS_CHANGE_CHECKLIST.md`
- `docs/js-inventory.md`
- `docs/ai/WORKLOG.md`

### 変更しないもの

- `public/assets/app.js`
- `public/sanga202627season.html`
- `public/assets/style.css`
- `public/data/matches.json`
- LocalStorageキー
- npmパッケージ追加
- Playwrightなどの実ブラウザ自動化

### app.js本体へ影響がない理由

- 今回は `tools/validate-app-contract.js` が既存の `public/assets/app.js` を読み取り、必要な文字列や状態処理の断片が残っているかを静的に確認するだけにする。
- `public/assets/app.js` の処理、関数、変数、LocalStorageキー、DOM操作、CSSクラス付与処理は変更しない。
- 表示列切替、表示モード切替、フィルタ操作、カード状態切替の実挙動は、今回の静的チェック強化では変更されない。

### 確認方法

- `node tools/validate-app-contract.js` を実行し、追加した契約チェックが成功することを確認する。
- `.github/workflows/static-checks.yml` に同チェックが既に含まれているか確認し、含まれていれば変更しない。
- `git diff --check`、`node --check public/assets/app.js`、日程JSON検証、CSS波括弧数検証、HTMLのCSS/JS参照検証を実行する。
- `git diff -- public/assets/app.js public/sanga202627season.html public/assets/style.css public/data/matches.json` で、変更禁止ファイルに差分がないことを確認する。

## 2026-06-22 ダイアログ閉じる待機時間の定数化

### 今回の作業テーマ

JavaScript低リスク実装整理として、使い方ダイアログと設定パネルの閉じるアニメーション後に `hidden` を戻す待機時間を定数化する。機能追加や挙動変更ではなく、既存の `240ms` の意味を明確にするための小さな整理に限定する。

### 変更対象

- `public/assets/app.js`
- `docs/js-inventory.md`
- `docs/ai/PLAN.md`
- `docs/ai/GOAL.md`
- `docs/ai/WORKLOG.md`

### 定数化する値

- `closeHelp()` と `closeSettings()` の `setTimeout(..., 240)` で使われている `240` を、既存定数定義付近に追加する `PANEL_CLOSE_DELAY_MS` へ置き換える。
- 定数値は従来どおり `240` のままにする。

### 変更しないもの

- `closeHelp()` と `closeSettings()` の処理順。
- `openHelp()` と `openSettings()` の処理。
- 関数名、既存変数名、イベントリスナー。
- LocalStorageキー、保存形式、読み書き・削除処理。
- DOMのid/class/data属性参照。
- CSSクラスの付与・削除処理。
- `public/sanga202627season.html`、`public/assets/style.css`、`public/data/matches.json`、`.github/workflows/static-checks.yml`。

### LocalStorage・DOM・CSSクラス連動への影響がない理由

- 今回は待機時間の数値リテラルを同じ値の定数参照に置き換えるだけで、LocalStorageキーや保存処理を変更しないため。
- DOM参照文字列、イベントリスナー、関数の呼び出し関係を変更しないため。
- `.is-open` の付与・削除や `hidden` の戻し順序を変更せず、CSSクラス連動のタイミングも `240ms` のまま維持するため。

### 確認方法

- `git diff --check`
- `node --check public/assets/app.js`
- `node tools/validate-app-contract.js`
- `node tools/validate-matches.js`
- `node tools/validate-generated-matches.js public/data/matches.json --expected-count 38 --strict`
- Pythonワンライナーで `public/assets/style.css` の `{` と `}` の数が一致することを確認する。
- Pythonワンライナーで `public/sanga202627season.html` が `assets/style.css` と `assets/app.js` を参照していることを確認する。
- Static Checks相当として、ローカルで上記の静的チェックを実行する。
- `git diff -- public/sanga202627season.html public/assets/style.css public/data/matches.json .github/workflows/static-checks.yml --exit-code` で変更禁止ファイルに差分がないことを確認する。
