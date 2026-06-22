# GOAL.md

## Durable Goal

京都サンガF.C. 2026-2027シーズン日程表HTMLを、既存データ・既存仕様・スマートフォン表示・アクセシビリティを壊さずに、安全に改善する。

## このプロジェクトで守ること

### データ保護

- 試合日程データを勝手に変更しない。
- 節番号、日付、曜日、時刻、対戦相手、会場、ホーム/アウェイ情報を勝手に変更しない。
- 表示用テキストの変更は、ユーザーから明示された場合に限定する。
- 修正対象がデータなのか、表示なのか、機能なのかを分けて扱う。

### LocalStorage保護

- 既存LocalStorageキーを勝手に変更しない。
- 既存ユーザーの保存状態が消える変更をしない。
- LocalStorage削除ボタンは、このページに関係する保存情報だけを削除する。
- LocalStorage説明文は、同じ端末でもブラウザが違えば保存状態が共有されないことが伝わる内容にする。

### 表示保護

- スマートフォン表示を優先する。
- 横スクロール、カード表示、表示列変更、フッター、使い方ダイアログの表示を壊さない。
- 1つの試合カードの縦幅が大きくなっても、同じ行の表示が不自然に崩れないようにする。
- 日程数字は、既存方針に従って読みやすさと収まりを両立する。

### アクセシビリティ保護

- キーボード操作を壊さない。
- フォーカス表示を消さない。
- ボタンはボタンとして認識できる見た目にする。
- ダイアログの開閉操作をわかりやすく保つ。
- 色だけに依存した状態表示にしない。
- 文字サイズ、行間、余白を過度に詰めない。

## 作業の進め方

1. `docs/html-analysis.md` を読む。
2. `docs/ai/PLAN.md` を読む。
3. 変更対象ファイルを特定する。
4. 変更前に影響範囲を整理する。
5. 小さく修正する。
6. `docs/ai/CHECKLIST.md` に沿って確認する。
7. `docs/ai/WORKLOG.md` に記録する。
8. 残課題があれば明記して止める。

## 完了条件

以下を満たしたら完了とする。

- 指示された修正が反映されている。
- 既存の日程データが変更されていない。
- 既存LocalStorageキーが変更されていない。
- 使い方ダイアログが開閉できる。
- 表示列変更が動作する。
- LocalStorage削除ボタンが動作する。
- スマートフォン幅で主要表示が崩れていない。
- キーボード操作とフォーカス表示が維持されている。
- ブラウザコンソールに明らかなJavaScriptエラーがない。
- 変更内容、確認結果、残課題が `docs/ai/WORKLOG.md` に記録されている。

## 止まるべき条件

以下の場合は、勝手に進めずに作業を止める。

- 試合データの正誤判断が必要な場合
- デザイン方針を大きく変える必要がある場合
- LocalStorageキー変更が必要になりそうな場合
- HTML構造を大きく組み替える必要がある場合
- 既存仕様と依頼内容が矛盾する場合

## 今回の作業目的: 試合カード高が大きい行の表示崩れ改善

`docs/ai/GOAL.md` と `docs/ai/PLAN.md` に従い、試合カードの縦幅が大きくなった場合でも同じ行の表示が不自然に崩れないように修正する。既存の日程データ、LocalStorageキー、表示列変更、使い方ダイアログ、LocalStorage削除ボタンは壊さない。`docs/ai/CHECKLIST.md` に沿って確認し、`docs/ai/WORKLOG.md` に変更内容、確認結果、未確認項目、残課題を記録できたら完了とする。

## 今回の作業目的: GitHub Actionsによる静的検証ワークフロー追加

`docs/ai/GOAL.md` と `docs/ai/PLAN.md` に従い、GitHub Actionsで日程データ、生成JSON、既存JavaScript構文、CSS括弧数、HTMLからのCSS/JS参照を自動確認できる静的検証ワークフローを追加する。HTML/CSS/JS/日程データ/LocalStorageキーは変更しない。`docs/ai/CHECKLIST.md` に沿って確認し、`docs/ai/WORKLOG.md` に変更内容、確認結果、未確認項目、残課題を記録できたら完了とする。

## 2026-06-22 低リスクCSSコメント見出し追加

docs/css-inventory.md と docs/ai/PLAN.md に従い、public/assets/style.css に低リスクなコメント見出しと章立てを追加する。CSSの指定値、セレクタ、HTML、JavaScript、日程データ、LocalStorageキーは変更しない。Static Checksが成功し、docs/ai/WORKLOG.md に変更内容と確認結果を記録できたら完了とする。

## 2026-06-22 CSS近接重複・上書き候補調査

`docs/css-inventory.md` と `docs/ai/PLAN.md` に従い、`public/assets/style.css` の近接重複・上書き候補を調査し、低リスク候補、注意候補、触らない候補、実ブラウザ確認が必要な候補に分類する。CSS本体、HTML、JavaScript、日程データ、LocalStorageキーは変更しない。`docs/css-inventory.md` と `docs/ai/WORKLOG.md` に結果を記録できたら完了とする。

## 2026-06-22 CSS低リスク補足コメント追加

### 目的

- docs/css-inventory.md と docs/ai/PLAN.md に従い、public/assets/style.css の低リスク候補に補足コメントだけを追加する。
- CSS指定値、セレクタ、並び順、HTML、JavaScript、日程データ、LocalStorageキーは変更しない。

### 完了条件

- `.footer-tools .legend`、`.footer-actions`、`.help-button:active`、`.storage-clear:active` の意図が、最小限のコメントで分かる状態になっている。
- Static Checks相当の確認が成功している。
- `docs/ai/WORKLOG.md` に変更内容、確認結果、未確認項目、残課題を記録している。

## 2026-06-22 JavaScript棚卸しドキュメント追加

`docs/ai/GOAL.md` と `docs/ai/PLAN.md` に従い、`public/assets/app.js` の棚卸しを行い、JavaScript全体の構成、LocalStorage、DOM依存、CSSクラス依存、次に整理できそうな候補を `docs/js-inventory.md` に記録する。`app.js`、HTML、CSS、日程データ、LocalStorageキーは変更しない。`docs/ai/WORKLOG.md` に結果を記録できたら完了とする。

## 2026-06-22 JavaScript低リスクセクションコメント追加

`docs/js-inventory.md` と `docs/ai/PLAN.md` に従い、`public/assets/app.js` に低リスクなセクションコメントだけを追加する。JavaScriptの処理内容、関数名、変数名、処理順、LocalStorageキー、DOM参照、CSSクラス連動、HTML、CSS、日程データは変更しない。Static Checksが成功し、`docs/ai/WORKLOG.md` に変更内容と確認結果を記録できたら完了とする。

## 2026-06-22 JavaScript契約チェック追加

`docs/ai/JS_CHANGE_CHECKLIST.md` と `docs/ai/PLAN.md` に従い、JavaScript変更時に壊してはいけないLocalStorageキー、JSON読み込みパス、主要DOMフック、CSS連動クラスを静的に検証するスクリプトを追加し、Static Checksで実行する。app.js、HTML、CSS、日程データ、LocalStorageキーは変更しない。Static Checksが成功し、docs/ai/WORKLOG.md に変更内容と確認結果を記録できたら完了とする。

## 2026-06-22 JavaScript契約チェックの有効値検証強化

`docs/ai/JS_CHANGE_CHECKLIST.md` と `docs/ai/PLAN.md` に従い、`tools/validate-app-contract.js` に表示列・表示モード・フィルタ・カード状態に関する静的契約チェックを追加する。`app.js`、HTML、CSS、日程データ、LocalStorageキーは変更しない。Static Checksが成功し、`docs/ai/WORKLOG.md` に変更内容と確認結果を記録できたら完了とする。

## 2026-06-22 ダイアログ閉じる待機時間の定数化

`docs/js-inventory.md` と `docs/ai/JS_CHANGE_CHECKLIST.md` と `docs/ai/PLAN.md` に従い、`public/assets/app.js` の使い方ダイアログと設定パネルの閉じる待機時間 `240ms` を `PANEL_CLOSE_DELAY_MS` として定数化する。処理順、関数名、イベント処理、LocalStorageキー、DOM参照、CSSクラス連動、HTML、CSS、日程データは変更しない。Static Checksが成功し、`docs/ai/WORKLOG.md` に変更内容と確認結果を記録できたら完了とする。
