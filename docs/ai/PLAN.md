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
