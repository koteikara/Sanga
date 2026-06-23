# WORKLOG.md

このファイルには、京都サンガ日程表HTMLプロジェクトにおけるAI支援作業の履歴を記録する。

## 記録ルール

各作業ごとに以下を記録する。

- 日付
- 作業テーマ
- 使用した流れ
- 変更ファイル
- 変更内容
- 確認結果
- 未確認項目
- 残課題
- 人間が確認すべき点
- reviewer / a11y-reviewer / docs に依頼したい観点

---

## YYYY-MM-DD 作業テーマ

### 使用した流れ

- `/plan`:
- `/goal`:
- agmsg:

### 変更ファイル

- 

### 変更内容

- 

### 確認結果

- 

### 未確認項目

- 

### 残課題

- 

### 人間が確認すべき点

- 

### 次にレビューしてほしい観点

- reviewer:
- a11y-reviewer:
- docs:

## 2026-06-22 試合カード高が大きい行の表示崩れ改善

### 使用した流れ

- `/plan`: `docs/ai/PLAN.md` に今回の作業テーマ、変更対象、原因候補、LocalStorage・スマートフォン表示・アクセシビリティへの影響、確認方法、変更しないものを追記した。
- `/goal`: `docs/ai/GOAL.md` に今回の目的と完了条件を追記した。
- CHECKLIST: `docs/ai/CHECKLIST.md` の観点に沿って、静的確認とデータ検証を実施した。
- WORKLOG: 本項目に変更内容、確認結果、未確認項目、残課題を記録した。

### 変更ファイル

- `docs/ai/PLAN.md`
- `docs/ai/GOAL.md`
- `docs/ai/WORKLOG.md`
- `public/assets/style.css`

### 変更内容

- 縦幅が大きい試合カードを含むCSS Grid行で、カード本体が行高に追随するよう `.match` をflexコンテナ化した。
- `.match-inner` がカード本体の幅・高さを満たすよう、`flex` と `width:100%` を追加した。
- `.ha` と `.date` は固定的な `min-height:100%` ではなく、グリッド内で `align-self:stretch` により自然に伸びるよう調整した。
- HTML構造、JavaScript、日程データ、LocalStorageキーは変更していない。

### 確認結果

- `node tools/validate-matches.js` により、`public/data/matches.json` の38件の日程データ検証に成功した。
- `node tools/validate-generated-matches.js public/data/matches.json --expected-count 38 --strict` により、生成JSONの件数・必須項目・日付形式などの検証に成功した。
- `node --check public/assets/app.js` により、既存JavaScriptに構文エラーがないことを確認した。
- Pythonスクリプトで `public/assets/style.css` の `{` と `}` の数が一致すること、`public/sanga202627season.html` が `assets/style.css` を参照していることを確認した。
- `git diff -- public/sanga202627season.html public/data/matches.json public/assets/app.js public/assets/style.css docs/ai/PLAN.md docs/ai/GOAL.md` により、HTML・JSON・JavaScriptの日程データやLocalStorage処理を変更していないことを確認した。

### 未確認項目

- この環境にブラウザ実行環境がなく、`npx playwright@latest --version` もnpm registryの403で失敗したため、実ブラウザでのPC幅・スマートフォン幅の表示確認、表示列変更、使い方ダイアログ開閉、LocalStorage削除ボタン、キーボードフォーカス、ブラウザコンソールエラー確認、スクリーンショット取得は未確認。

### 残課題

- 実ブラウザで2列表示の縦幅が大きいカード行、1列・3列・4列、コンパクト表示の見た目を確認する。
- 表示列変更、使い方ダイアログ、LocalStorage削除ボタンの操作確認を実ブラウザで行う。

### 人間が確認すべき点

- スマートフォン幅で、注記付き・候補日付きなど縦幅が大きい試合カードの同一行表示が自然にそろっているか。
- PC幅でも主要表示に大きな崩れがないか。
- フォーカス表示やボタン操作感が変更前より悪化していないか。

### 次にレビューしてほしい観点

- reviewer: CSS Grid行内でカード内部が自然に伸びる修正として過不足がないか。
- a11y-reviewer: button要素、フォーカス表示、ダイアログ操作、色以外の説明が維持されているか。
- docs: `/plan`、`/goal`、CHECKLIST、WORKLOG の流れと記録内容が今後の運用に使いやすいか。

## 2026-06-22 PR #80 マージ後のブラウザ確認

### 使用した流れ

- `/plan`: 既存の `docs/ai/PLAN.md` と今回の依頼内容を確認し、今回は新機能追加・実装修正ではなく、PR #80 マージ後の表示・操作確認とWORKLOG記録を行う作業として扱った。
- `/goal`: `docs/ai/GOAL.md` のデータ保護、LocalStorage保護、表示保護、アクセシビリティ保護の完了条件に沿って確認した。
- CHECKLIST: `docs/ai/CHECKLIST.md` の表示確認、機能確認、アクセシビリティ確認、JavaScript確認の観点に沿って確認した。
- ローカル確認: `python -m http.server 8000` でローカルHTTPサーバーを起動し、`http://localhost:8000/public/sanga202627season.html` を確認対象にした。
- WORKLOG: 本項目に確認対象、確認できたこと、確認できなかったこと、残課題、人間が確認すべき点を記録した。

### 確認対象

- `public/sanga202627season.html`
- `public/assets/style.css`
- `public/assets/app.js`
- `public/data/matches.json`
- `docs/ai/GOAL.md`
- `docs/ai/PLAN.md`
- `docs/ai/CHECKLIST.md`
- `docs/ai/WORKLOG.md`

### 確認した画面幅

- 390px前後: 実ブラウザ環境を用意できなかったため、目視確認は未確認。
- 768px前後: 実ブラウザ環境を用意できなかったため、目視確認は未確認。
- 1280px前後: 実ブラウザ環境を用意できなかったため、目視確認は未確認。

### 確認した機能

- ローカルHTTPサーバーで `public/sanga202627season.html` がHTTP 200で配信されることを確認した。
- `public/assets/app.js` の構文チェックを行い、明らかなJavaScript構文エラーがないことを確認した。
- `public/data/matches.json` の検証を行い、38件の日程データが検証に成功することを確認した。
- 生成JSONの厳格検証を行い、件数・必須項目・日付形式などの検証に成功することを確認した。
- `public/assets/style.css` の `{` と `}` の数が一致することを確認した。
- `public/sanga202627season.html` が `assets/style.css` と `assets/app.js` を参照していることを確認した。

### 確認結果

- 今回は確認結果の記録のみを行い、試合日程データ、節番号、日付、曜日、時刻、対戦相手、会場、ホーム/アウェイ情報は変更していない。
- 既存LocalStorageキーや保存仕様は変更していない。
- ローカルHTTPサーバーで対象HTMLを配信できることは確認できた。
- 静的検証では、日程データ、生成JSON、JavaScript構文、CSS波括弧数、HTMLからのCSS/JS参照に問題は見つからなかった。
- PR #80の主目的である「縦幅が大きい試合カードを含む行で、隣接カードの縦帯、日付欄、カード背景が不自然に短く見えないか」は、実ブラウザが利用できなかったため目視確認できなかった。

### 問題があった箇所

- コード・データ上の明らかな問題は見つからなかった。
- ただし、実ブラウザ確認に必要なブラウザ実行環境がなく、`npx --yes playwright@latest --version` も npm registry の 403 で失敗したため、指定画面幅での目視確認は未実施。

### 未確認項目

- 390px前後、768px前後、1280px前後での実ブラウザ目視確認。
- 注記付き・候補日付きなど縦幅が大きいカードを含む行で、隣接カードの縦帯、日付欄、カード背景が自然に伸びているかの目視確認。
- 1列、2列、3列・4列相当表示、コンパクト表示のブラウザ上での表示確認。
- 表示列変更のブラウザ操作確認。
- 使い方ボタン、使い方ダイアログ開閉のブラウザ操作確認。
- LocalStorage削除ボタンのブラウザ操作確認。
- 保存済み表示設定が意図せず消えていないかのブラウザ確認。
- ブラウザコンソール上のJavaScriptエラー有無の確認。
- キーボード操作、フォーカス表示、ダイアログ開閉のアクセシビリティ確認。
- フッターと免責事項の実ブラウザ表示確認。

### 残課題

- ブラウザ実行環境がある端末で、390px前後、768px前後、1280px前後の各幅を実際に開いて確認する。
- 縦幅が大きいカードを含む行を重点的に確認し、カード背景、縦帯、日付欄が同一行内で不自然に短く見えないか確認する。
- 表示列変更、使い方ダイアログ、LocalStorage削除ボタン、キーボード操作、フォーカス表示、コンソールエラー有無を実ブラウザで確認する。

### 人間が確認すべき点

- PR #80のCSS修正が、実際のスマートフォン幅・タブレット幅・PC幅で意図どおり見えているか。
- 注記付き・候補日付きカードを含む行で、隣接カードのカード背景、縦帯、日付欄の高さが自然にそろっているか。
- コンパクト表示で日程数字やカード内テキストが詰まりすぎていないか。
- ボタン操作、ダイアログ、LocalStorage削除、キーボードフォーカスが利用しやすい状態を保てているか。

### 次にレビューしてほしい観点

- reviewer: 実ブラウザでPR #80のカード高追随が意図どおりか、特に2列・3列・4列相当表示で確認してほしい。
- a11y-reviewer: キーボード操作、フォーカス表示、ダイアログ開閉、色だけに依存しない説明が維持されているか確認してほしい。
- docs: 実ブラウザ未確認項目と次回確認事項の記録が、後続作業に十分か確認してほしい。

## 2026-06-22 GitHub Actionsによる静的検証ワークフロー追加

### 使用した流れ

- `/plan`: `docs/ai/PLAN.md` に今回の作業テーマ、追加するワークフローファイル、実行するチェック内容、実行タイミング、変更しないファイル、LocalStorageへの影響有無、Playwrightを入れない理由、確認方法を追記した。
- `/goal`: `docs/ai/GOAL.md` に、GitHub Actionsで日程データ、生成JSON、既存JavaScript構文、CSS括弧数、HTMLからのCSS/JS参照を自動確認する目的と完了条件を追記した。
- CHECKLIST: `docs/ai/CHECKLIST.md` のデータ保護、LocalStorage保護、JavaScript確認、完了報告の観点に沿って確認した。
- WORKLOG: 本項目に変更内容、確認結果、未確認項目、残課題を記録した。

### 追加したワークフロー

- `.github/workflows/static-checks.yml`

### 実行するチェック

- `git diff --check`
- `node tools/validate-matches.js`
- `node tools/validate-generated-matches.js public/data/matches.json --expected-count 38 --strict`
- `node --check public/assets/app.js`
- Pythonインラインスクリプトによる `public/assets/style.css` の `{` と `}` の数の一致確認
- Pythonインラインスクリプトによる `public/sanga202627season.html` の `assets/style.css` / `assets/app.js` 参照確認

### 変更ファイル

- `.github/workflows/static-checks.yml`
- `docs/ai/PLAN.md`
- `docs/ai/GOAL.md`
- `docs/ai/WORKLOG.md`

### 変更しなかったファイル

- `public/sanga202627season.html`
- `public/assets/style.css`
- `public/assets/app.js`
- `public/data/matches.json`
- `tools/validate-matches.js`
- `tools/validate-generated-matches.js`

### 変更内容

- Pull Requestと`main`ブランチへのpush時に実行される `Static Checks` ワークフローを追加した。
- Node.js LTSとして `actions/setup-node@v4` の `node-version: '20'` を使用した。
- npmパッケージ追加やPlaywright導入は行わず、既存Node.jsスクリプトとPythonインラインスクリプトだけで静的確認する構成にした。
- 既存の `deploy-production.yml` と `pages.yml` は変更していない。

### 確認結果

- `git diff --check` が成功した。
- `node tools/validate-matches.js` が成功し、`matches.json` 38件の検証に成功した。
- `node tools/validate-generated-matches.js public/data/matches.json --expected-count 38 --strict` が成功し、件数38件、警告0、エラー0を確認した。
- `node --check public/assets/app.js` が成功した。
- Pythonインラインスクリプトで `public/assets/style.css` の `{` と `}` がどちらも509件で一致することを確認した。
- Pythonインラインスクリプトで `public/sanga202627season.html` が `assets/style.css` と `assets/app.js` を参照していることを確認した。
- `git diff -- public/sanga202627season.html public/assets/style.css public/assets/app.js public/data/matches.json` で、HTML/CSS/JavaScript/日程データに差分がないことを確認した。

### 未確認項目

- GitHub Actions上での実行結果は、PR作成後にGitHub上で確認が必要。
- この環境にはPyYAMLがなかったため、ローカルでYAMLパーサーによる構文確認は未実施。ただし、ファイルのインデントと構造は目視で確認した。
- 今回は実ブラウザ確認とPlaywright導入を対象外にしたため、PC幅・スマートフォン幅の目視確認、操作確認、スクリーンショット取得は未実施。

### 残課題

- PR作成後、GitHub Actionsの `Static Checks` がPull Request上で成功することを確認する。
- 静的CIが安定した後、必要に応じてPlaywrightやスクリーンショット確認を別タスクとして検討する。

### 人間が確認すべき点

- Pull Request上で `Static Checks` が意図どおり実行され、全チェックが成功すること。
- `main`ブランチpush時にも同じ静的検証が実行されること。
- 今回の静的チェック範囲がPRごとの基本チェックとして過不足ないこと。

### 次にレビューしてほしい観点

- reviewer: GitHub Actionsの実行タイミング、Node.jsバージョン、チェック分割が運用上わかりやすいか。
- a11y-reviewer: 今回は画面変更なしのため追加レビューなし。将来のブラウザ確認CI導入時に確認してほしい。
- docs: PLAN、GOAL、WORKLOGの記録内容が、静的CI追加の経緯として十分か確認してほしい。

## 2026-06-22 PR #82 Static Checks 実行結果確認

### 使用した流れ

- `/plan`: 既存の `docs/ai/PLAN.md` と今回の依頼内容を確認し、今回はHTML/CSS/JavaScript/日程データの実装修正ではなく、PR #82で追加したCI成功結果の記録と手動ブラウザ確認チェックリスト整備に限定した。
- `/goal`: `docs/ai/GOAL.md` のデータ保護、LocalStorage保護、表示保護、アクセシビリティ保護の方針に沿い、実装ファイルを変更しないことを今回の完了条件として扱った。
- CHECKLIST: `docs/ai/CHECKLIST.md` のデータ確認、JavaScript確認、完了報告の観点に加え、実ブラウザ確認の残課題を `docs/ai/BROWSER_CHECKLIST.md` へ分離して整理する方針にした。
- WORKLOG: 本項目にPR #82のGitHub Actions成功結果、変更していない範囲、残課題を記録した。

### 確認したCI結果

- PR #82で追加した GitHub Actions ワークフロー `Static Checks` がGitHub Actions上で成功した。
- Run ID: `27928145821`
- Job名: `静的検証`
- 結果: `success`
- PR #82は `main` へマージ済みである。

### 成功したステップ

- リポジトリをチェックアウト
- Node.jsを設定
- Git差分の空白エラーを確認
- 日程JSONを検証
- 生成JSONを厳格検証
- JavaScript構文を検証
- CSS波括弧数を検証
- HTMLのCSS/JS参照を検証

### 今回変更していないもの

- `public/sanga202627season.html` は変更していない。
- `public/assets/style.css` は変更していない。
- `public/assets/app.js` は変更していない。
- `public/data/matches.json` は変更していない。
- `.github/workflows/static-checks.yml` は、明確な問題がないため変更していない。
- 既存LocalStorageキー、保存値、復元処理、削除処理は変更していない。

### 変更内容

- PR #82で追加された `Static Checks` のGitHub Actions成功結果を記録した。
- PR #80以降で残っている実ブラウザでの目視・操作確認を、人間が実施しやすいよう `docs/ai/BROWSER_CHECKLIST.md` に整理することにした。
- 今回はコード本体、スタイル、JavaScript、日程データ、GitHub Actionsワークフローの実装修正は行っていない。

### 未確認項目

- 実ブラウザでの390px前後、768px前後、1280px前後の目視確認。
- 表示列変更、使い方ダイアログ、LocalStorage削除ボタンのブラウザ操作確認。
- キーボード操作、フォーカス表示、ブラウザコンソールエラー有無の確認。

### 残課題

- ブラウザ実行環境がある端末で、`docs/ai/BROWSER_CHECKLIST.md` に沿って目視・操作確認を行う。
- 縦幅が大きい試合カードを含む行で、隣接カードの背景・縦帯・日付欄が自然に伸びているかを重点的に確認する。
- 確認結果を `docs/ai/WORKLOG.md` または後続PRの作業記録に追記する。

### 人間が確認すべき点

- `Static Checks` 成功後も、実際のブラウザ表示・操作に問題がないか。
- PR #80で残っているカード高追随の目視確認が、スマートフォン幅・タブレット幅・PC幅で問題ないか。
- LocalStorageを使う表示設定の保存・復元・削除が、実ブラウザで意図どおり動くか。

### 次にレビューしてほしい観点

- reviewer: `Static Checks` 成功結果とRun IDの記録が、PR #82マージ後確認として十分か。
- a11y-reviewer: `docs/ai/BROWSER_CHECKLIST.md` のアクセシビリティ確認項目が、手動確認に必要な観点を含んでいるか。
- docs: WORKLOGとBROWSER_CHECKLISTの分担が、今後の確認作業に使いやすいか。

## 2026-06-22 実ブラウザ確認結果テンプレート追加

### 使用した流れ

- `/plan`: 今回の作業はHTML/CSS/JavaScript/日程データの実装修正ではなく、実ブラウザ確認結果を記録するためのテンプレート整備に限定すると整理した。
- `/goal`: 本体コード、LocalStorageキー、GitHub Actionsワークフローを変更せず、人間が確認結果を残しやすい記録ファイルを追加することを今回の完了条件として扱った。
- CHECKLIST: `docs/ai/CHECKLIST.md` と `docs/ai/BROWSER_CHECKLIST.md` の確認観点を、結果・問題点・次のCodex依頼内容を書ける形式に展開した。
- WORKLOG: 本項目にテンプレート追加内容、確認結果、残課題を記録した。

### 変更ファイル

- `docs/ai/browser-check-results/2026-06-22-browser-check-template.md`
- `docs/ai/WORKLOG.md`

### 変更内容

- `docs/ai/browser-check-results/` ディレクトリを追加した。
- `docs/ai/browser-check-results/2026-06-22-browser-check-template.md` を追加し、確認日、確認者、OS、ブラウザ、確認URL、確認方法、キャッシュ削除、LocalStorage初期化、390px前後、768px前後、1280px前後、表示確認、機能確認、アクセシビリティ確認、ブラウザコンソール確認、問題なし項目、問題あり項目、未確認項目、気づいた点、修正が必要な点、次にCodexへ依頼する内容を記録できるようにした。
- 各確認項目に「確認済み / 問題なし」「問題あり」「未確認」「メモ」を記入できる形を用意した。
- 本体コード、スタイル、JavaScript、日程データ、GitHub Actionsワークフローは変更していない。

### 確認結果

- `docs/ai/browser-check-results/2026-06-22-browser-check-template.md` が作成されていることを確認した。
- `docs/ai/WORKLOG.md` に今回のテンプレート追加記録が追記されていることを確認した。
- `public/sanga202627season.html` に差分がないことを確認した。
- `public/assets/style.css` に差分がないことを確認した。
- `public/assets/app.js` に差分がないことを確認した。
- `public/data/matches.json` に差分がないことを確認した。
- `.github/workflows/static-checks.yml` に差分がないことを確認した。

### 未確認項目

- 今回は記録テンプレート整備のみのため、実ブラウザでの390px前後、768px前後、1280px前後の目視確認は実施していない。
- 表示列変更、使い方ダイアログ、LocalStorage削除ボタン、キーボード操作、フォーカス表示、ブラウザコンソールエラー有無の実ブラウザ確認は実施していない。

### 残課題

- 次に人間が `docs/ai/browser-check-results/2026-06-22-browser-check-template.md` をコピーまたは直接編集し、ローカルブラウザでの確認結果を記録する。
- 問題が見つかった場合は、記録した結果をもとに次のCodex修正依頼を作る。

### 人間が確認すべき点

- ローカルブラウザで確認対象URLを開き、390px前後、768px前後、1280px前後で表示・操作・アクセシビリティ・コンソールを確認する。
- 問題あり項目には、再現手順、画面幅、ブラウザ、期待結果、実際の結果をできるだけ具体的に記録する。
- 修正が必要な点を「次にCodexへ依頼する内容」に整理する。

### 次にレビューしてほしい観点

- reviewer: テンプレートの確認項目が、PR #80以降の実ブラウザ確認に十分か。
- a11y-reviewer: キーボード操作、フォーカス表示、ダイアログ操作、色だけに依存しない情報伝達の記録欄が十分か。
- docs: WORKLOGと結果テンプレートの分担が、後続の人間確認とCodex修正依頼に使いやすいか。

## 2026-06-22 実ブラウザ確認チェックリストの軽量化

### 使用した流れ

- `/plan`: 今回の作業はHTML/CSS/JavaScript/日程データの実装修正ではなく、実ブラウザ確認運用のドキュメント整理に限定すると整理した。
- `/goal`: 人間が毎回使える5分以内のスモークチェックへ絞り、詳細確認は必要時だけ実施する方針を今回の完了条件として扱った。
- CHECKLIST: `docs/ai/BROWSER_CHECKLIST.md` と結果テンプレートを、毎回確認する7項目中心に軽量化した。
- WORKLOG: 本項目に方針変更、変更していない範囲、今後の運用を記録した。

### 変更ファイル

- `docs/ai/BROWSER_CHECKLIST.md`
- `docs/ai/browser-check-results/2026-06-22-browser-check-template.md`
- `docs/ai/WORKLOG.md`
- `docs/ai/CHECKLIST.md`

### 変更内容

- 人間が毎回行う実ブラウザ確認を、5分以内のスモークチェックに変更した。
- 毎回の確認項目を、スマホ幅、PC幅、縦幅が大きいカード行、表示列変更、使い方ダイアログ、LocalStorage削除ボタン、ブラウザコンソールエラーの7項目に絞った。
- 詳細チェックは、UIを大きく変更した時やLocalStorage・主要操作・アクセシビリティに影響する変更をした時だけ行う方針にした。
- 結果テンプレートを、確認日、確認者、確認URL、ブラウザ、7項目の結果、気づいた点、修正が必要な点、次にCodexへ依頼する内容だけに軽量化した。
- 今後は自動化できる確認をGitHub Actionsや将来のブラウザ自動確認に寄せ、人間チェックを重くしない方針を明確にした。
- 本体コードは変更していない。

### 確認結果

- `docs/ai/BROWSER_CHECKLIST.md` が、目的、5分以内の方針、通常確認7項目、詳細確認の条件、問題記録欄、次にCodexへ依頼する内容の構成になっていることを確認した。
- `docs/ai/browser-check-results/2026-06-22-browser-check-template.md` が、毎回使える軽量テンプレートになっていることを確認した。
- `docs/ai/CHECKLIST.md` から実ブラウザ確認は軽量版を参照する方針に更新した。
- `public/sanga202627season.html`、`public/assets/style.css`、`public/assets/app.js`、`public/data/matches.json`、`.github/workflows/static-checks.yml` に差分がないことを確認した。

### 未確認項目

- 今回はドキュメント整理のみのため、実ブラウザでの表示確認と操作確認は実施していない。

### 残課題

- 次回以降の人間確認では、軽量化した7項目を5分以内で実施し、問題があった場合だけ詳細を記録する。
- UIを大きく変更した場合は、必要な詳細確認項目を選んで追加確認する。
- 将来的には、GitHub Actionsやブラウザ自動確認で代替できる項目を増やす。

### 人間が確認すべき点

- 軽量化後の7項目が、毎回のスモークチェックとして無理なく運用できるか。
- 詳細確認に回した項目が、通常確認から外れても問題ないか。
- 問題発見時の記録欄とCodexへの依頼テンプレートが使いやすいか。

## 2026-06-22 プロジェクト構成整理ドキュメント追加

### 使用した流れ

- `/plan`: 今回の作業は、次の実装フェーズに進む前の構成整理ドキュメント追加であり、HTML/CSS/JavaScript/日程データ/CIの実装修正は行わない方針で進めた。
- `/goal`: 現在のファイル構成、データ構成、validate系ツール、Static Checks、変更しやすい範囲、変更に注意が必要な範囲、今後の改善候補、次に進むおすすめ順を明文化することを完了条件にした。
- CHECKLIST: 指定された変更禁止ファイルに差分が出ていないことを確認対象にした。
- WORKLOG: 本項目に変更内容、確認結果、未確認項目、残課題を記録した。

### 変更ファイル

- `docs/project-structure.md`
- `docs/ai/WORKLOG.md`

### 変更内容

- `docs/project-structure.md` を新規追加し、現在の公開HTML、CSS、JavaScript、日程JSON、validate系ツール、Static Checks、LocalStorage関連、現在の確認体制を整理した。
- 変更しやすい範囲と変更に注意が必要な範囲を整理した。
- 今後の改善候補として、CSS整理、JavaScript整理、HTML内に残っている構造の整理、日程データ更新フロー整理、Googleスプレッドシート連携、本番アップロード手順整理、実ブラウザ確認の自動化検討を記録した。
- 次に進むおすすめ順として、本体を壊さないドキュメント整理、小さなCSS整理、小さなJavaScript整理、データ更新フロー整理、自動更新・デプロイ検討の順に整理した。
- 本体コード、日程データ、CI設定は変更していない。

### 確認結果

- `docs/project-structure.md` が作成されていることを確認した。
- `docs/ai/WORKLOG.md` に今回の作業記録を追記した。
- `public/sanga202627season.html` に差分がないことを確認した。
- `public/assets/style.css` に差分がないことを確認した。
- `public/assets/app.js` に差分がないことを確認した。
- `public/data/matches.json` に差分がないことを確認した。
- `.github/workflows/static-checks.yml` に差分がないことを確認した。

### 未確認項目

- 今回はドキュメント追加のみのため、実ブラウザでのPC幅・スマートフォン幅の表示確認、表示列変更、使い方ダイアログ、LocalStorage削除ボタン、キーボード操作、ブラウザコンソール確認は実施していない。

### 残課題

- 次の実装フェーズへ進む前に、`docs/project-structure.md` の整理内容を人間が確認し、CSS整理・JavaScript整理・データ更新フロー整理のどれから着手するか決める。
- LocalStorageキーごとの保存形式、削除対象、復元順序は、JavaScript整理時に改めて詳細確認する。

### 人間が確認すべき点

- `docs/project-structure.md` の現状整理が、今後の作業判断に十分か。
- 「変更しやすい範囲」「変更に注意が必要な範囲」の分類が実運用に合っているか。
- 次に進むおすすめ順が、現在の運用優先度と合っているか。

### 次にレビューしてほしい観点

- reviewer: 現在の構成整理として不足しているファイルや観点がないか。
- a11y-reviewer: 今後のCSS/JavaScript整理前に注意すべきアクセシビリティ観点が記録されているか。
- docs: 次の作業者が安全に実装フェーズを選べるドキュメントになっているか。

## 2026-06-22 CSS棚卸しドキュメント追加

### 使用した流れ

- `/plan`: 今回の作業を「CSS棚卸しドキュメント追加」として扱い、CSS本体・HTML・JavaScript・日程JSON・GitHub Actionsワークフローは変更しない方針を確認した。
- `/goal`: CSS整理前に、現在のセレクタ構成、表示モード、重複・上書き候補、変更リスクを把握できるドキュメントを追加することを目的にした。
- CHECKLIST: ドキュメント追加のみのため、実ブラウザ確認は対象外とし、対象外ファイルに差分がないことと静的チェックを確認した。
- WORKLOG: 本項目に変更内容、確認結果、未確認項目、残課題を記録した。

### 変更ファイル

- `docs/css-inventory.md`
- `docs/ai/WORKLOG.md`

### 変更内容

- `docs/css-inventory.md` を追加し、`public/assets/style.css` の大まかな構成、主要セレクタ分類、重複・上書き候補、変更しやすい箇所、変更に注意が必要な箇所、次に小さく整理できそうな候補を整理した。
- 試合カード、日付・ホーム/アウェイ・会場表示、表示列・表示モード、スマートフォン表示、ダイアログ、フッター・免責事項、ボタン・操作部品、状態表示の観点でセレクタを分類した。
- 同じセレクタが複数回出てくる箇所は、不要と断定せず「要確認」として記録した。
- CSS本体、HTML、JavaScript、日程JSON、GitHub Actionsワークフロー、LocalStorageキーは変更していない。

### 確認結果

- `docs/css-inventory.md` が作成されていることを確認した。
- `docs/ai/WORKLOG.md` に今回の作業記録を追記した。
- `public/assets/style.css`、`public/sanga202627season.html`、`public/assets/app.js`、`public/data/matches.json`、`.github/workflows/static-checks.yml` に差分がないことを確認した。
- `git diff --check` により、差分内の空白エラーがないことを確認した。
- Static Checks相当として、日程JSON検証、生成JSON厳格検証、JavaScript構文確認、CSS波括弧数確認、HTMLのCSS/JavaScript参照確認を実行した。

### 未確認項目

- 今回はドキュメント追加のみのため、実ブラウザでのPC幅・スマートフォン幅の表示確認、表示列変更、使い方ダイアログ開閉、LocalStorage削除ボタン、キーボードフォーカス、ブラウザコンソールエラー確認は実施していない。
- 重複・上書き候補の各セレクタが統合可能かどうかは、表示確認を伴う次回以降の作業で要確認。

### 残課題

- CSS整理を行う前に、今回の棚卸しをもとに低リスクの整理候補から作業範囲を小さく区切る。
- `.match`、`.match-inner`、`.ha`、`.date`、`.layout-*`、ダイアログ、LocalStorage削除ボタン、共有画像モード周辺は、変更前後の実ブラウザ確認手順を用意してから扱う。

### 人間が確認すべき点

- `docs/css-inventory.md` の分類が今後のCSS整理計画に使いやすい粒度になっているか。
- 重複・上書き候補として記録したセレクタに、追加で注視すべき箇所がないか。
- 次回のCSS整理で、低リスク候補から着手する方針で問題ないか。

### 次にレビューしてほしい観点

- reviewer: 重複・上書き候補の洗い出しが、次のCSS整理作業に十分か確認してほしい。
- a11y-reviewer: ダイアログ、ボタン、LocalStorage削除ボタン、フォーカス表示に関する注意点が抜けていないか確認してほしい。
- docs: `docs/css-inventory.md` の見出し構成と記録粒度が、継続運用しやすいか確認してほしい。

## 2026-06-22 低リスクCSSコメント見出し追加

### 使用した流れ

- `/plan`: 今回の作業は `docs/css-inventory.md` の棚卸しをもとにしたCSSコメント見出し追加に限定し、CSS指定値・セレクタ・HTML・JavaScript・日程データ・LocalStorageキーを変更しない方針を `docs/ai/PLAN.md` に追記した。
- `/goal`: `public/assets/style.css` に低リスクなコメント見出しと章立てを追加し、Static Checks相当の確認が成功し、WORKLOGへ記録できたら完了とする目的を `docs/ai/GOAL.md` に追記した。
- CHECKLIST: 変更禁止ファイルに差分がないこと、CSS波括弧数、HTMLのCSS/JavaScript参照、日程JSON検証、JavaScript構文確認を確認対象にした。
- WORKLOG: 本項目に変更内容、確認結果、未確認項目、残課題、次に整理できそうな候補を記録した。

### 変更ファイル

- `public/assets/style.css`
- `docs/css-inventory.md`
- `docs/ai/PLAN.md`
- `docs/ai/GOAL.md`
- `docs/ai/WORKLOG.md`

### 変更内容

- `public/assets/style.css` に、次の大見出しコメントを追加した。
  - `Base variables and page layout`
  - `Match card layout`
  - `Date, home/away, and match metadata`
  - `Responsive layout and column modes`
  - `Footer actions, disclaimer, and help UI`
  - `Dialogs and settings panels`
  - `Display modes, filters, and share image mode`
- `docs/css-inventory.md` に、今回の低リスク整理ではコメント見出しのみを追加し、CSS指定値・セレクタ・統合・削除・大きな並び替えを行っていないことを追記した。
- `docs/ai/PLAN.md` と `docs/ai/GOAL.md` に、今回の作業方針と完了条件を追記した。

### 変更していない内容

- CSS指定値、セレクタ、セレクタ名、CSSルールの統合・削除・大きな並び替えは変更していない。
- `public/sanga202627season.html` は変更していない。
- `public/assets/app.js` は変更していない。
- `public/data/matches.json` は変更していない。
- `.github/workflows/static-checks.yml` は変更していない。
- LocalStorageキー、保存仕様、JavaScript挙動、日程データは変更していない。

### 確認結果

- `git diff --check` が成功した。
- `node tools/validate-matches.js` が成功した。
- `node tools/validate-generated-matches.js public/data/matches.json --expected-count 38 --strict` が成功した。
- `node --check public/assets/app.js` が成功した。
- Python確認で `public/assets/style.css` の `{` と `}` がそれぞれ509個で一致した。
- Python確認で `public/sanga202627season.html` が `assets/style.css` と `assets/app.js` を参照していることを確認した。
- `git diff -- public/sanga202627season.html public/assets/app.js public/data/matches.json .github/workflows/static-checks.yml --exit-code` が成功し、変更禁止ファイルに差分がないことを確認した。

### 未確認項目

- 今回はCSSコメント追加のみのため、実ブラウザでのスマートフォン幅・PC幅の目視確認は実施していない。
- 表示列変更、使い方ダイアログ、設定パネル、LocalStorage削除ボタン、キーボード操作、ブラウザコンソールエラー有無の実ブラウザ確認は実施していない。
- GitHub Actions上のStatic Checks実行結果は、PR作成後にGitHub上で確認する必要がある。

### 残課題

- 次回以降、CSS指定値やセレクタ整理に進む場合は、今回追加した章立てを目印に作業範囲を小さく区切る。
- 重複・上書き候補の統合可否は、表示確認やスクリーンショット比較を用意してから判断する。

### 次に整理できそうな候補

- コメント見出し単位で、既存コメントの粒度が不足している箇所を追加で補足する。
- `docs/css-inventory.md` の重複・上書き候補を、実ブラウザ確認を前提に1件ずつ検証する。
- ダイアログ・設定パネル・フィルタ周辺のCSSを、見出し単位でさらに棚卸しする。

### 人間が確認すべき点

- 追加したコメント見出しの区切りが、今後のCSS整理に使いやすい粒度か。
- Static ChecksのGitHub Actions実行結果が成功しているか。
- 必要に応じて、実ブラウザで表示・操作に変化がないことを軽量チェックするか。

## 2026-06-22 CSS近接重複・上書き候補調査

### 使用した流れ

- `/plan`: `docs/ai/PLAN.md` に今回の作業テーマ、調査対象ファイル、調査方法、変更しないもの、調査結果の分類方針、確認方法を追記した。
- `/goal`: `docs/ai/GOAL.md` に今回の目的と完了条件を追記した。
- 調査: `public/assets/style.css` を読み、`rg` と一時的なPythonワンライナーで同一セレクタの出現回数と注意対象セレクタの出現箇所を確認した。
- WORKLOG: 本項目に変更内容、確認結果、未確認項目、残課題を記録した。

### 変更ファイル

- `docs/ai/PLAN.md`
- `docs/ai/GOAL.md`
- `docs/css-inventory.md`
- `docs/ai/WORKLOG.md`

### 変更内容

- `docs/css-inventory.md` に「近接重複・上書き候補の調査結果」を追記した。
- CSS本体は変更していない。
- 低リスク候補、注意候補、現時点では触らない候補、実ブラウザ確認が必要な候補を分類した。
- `.match`、`.date`、`.ha`、`.layout-*`、共有画像モード、LocalStorage削除ボタン周辺は、安易に低リスクへ分類せず、注意または触らない候補として扱った。

### 低リスク候補

- `.footer-tools .legend`: まずは役割説明の補足候補。指定値の統合は要確認。
- `.footer-actions`: フッター用配置と設定パネル用配置の役割説明補足候補。指定値の統合は要確認。
- `.help-button:active`: `prefers-reduced-motion` による動き抑制上書きの説明補足候補。
- `.storage-clear:active`: `prefers-reduced-motion` による動き抑制上書きの説明補足候補。

### 注意候補

- `.date:not(.tentative-date) .main.compact-date`: 画面幅別の日付可読性に関係する。
- `.note` / `.match:has(.note)` 系: 注記付きカード高さと同一行の揃いに関係する。
- `.meta::after` / `.logo-* .meta::after`: ロゴ背景とテキスト可読性に関係する。
- `.layout-group` / `.layout-label` / `.layout-option`: 表示列変更、設定パネル、フォーカス表示に関係する。
- `.help-button` / `.settings-button` / `.footer-action-button`: 主要操作ボタンの見た目と操作状態に関係する。
- `.phone.layout-4 ...`: 4列表示の詰まりやすい表示に関係する。

### 現時点では触らない候補

- `.match` / `.match-inner`
- `.ha`
- `.date` / `.date .main` / `.date .range`
- `.phone.layout-1` / `.phone.layout-3` / `.phone.layout-4` 系
- `.display-mode-compact` 系
- `.phone.is-screenshot-mode` 系
- `.screenshot-exit-button`
- `.share-save-link`
- `.storage-clear` / `.storage-clear-note`

### 次のPRで実施できそうな最小整理案

- CSS本体の指定値やセレクタ統合には踏み込まず、低リスク候補に限定して、近接上書きの意図を補足するコメント追加を検討する。
- `.match`、`.date`、`.ha`、`.layout-*`、共有画像モード、LocalStorage削除ボタン周辺は次の小整理PRの対象外にする。
- 実装整理へ進む前に、実ブラウザ確認手順を固定する。

### 確認結果

- `docs/css-inventory.md` に調査結果を追記した。
- `docs/ai/WORKLOG.md` に今回の作業を記録した。
- `public/assets/style.css` は変更していない。
- `public/sanga202627season.html` は変更していない。
- `public/assets/app.js` は変更していない。
- `public/data/matches.json` は変更していない。
- `.github/workflows/static-checks.yml` は変更していない。

### 未確認項目

- 実ブラウザでのPC幅・スマートフォン幅の目視確認は未実施。
- 表示列変更、コンパクト表示、共有画像モード、使い方・設定ダイアログ、LocalStorage削除ボタンの操作確認は未実施。
- 各重複・上書き候補が意図的な履歴上書きか、統合可能な重複かは、実装変更前に要確認。

### 残課題

- 次のPRで、低リスク候補に限定したコメント補足を行うか、実ブラウザ確認手順の固定を先に行うか判断する。
- CSS指定値の統合を行う場合は、対象セレクタをさらに絞り、実ブラウザ確認をセットで実施する。

### 人間が確認すべき点

- 低リスク候補として挙げた箇所が、次のPRでコメント補足に留める対象として妥当か。
- 注意候補・触らない候補の分類が、現在の運用上のリスク感に合っているか。
- 実ブラウザ確認が必要な表示モードや画面幅に不足がないか。

### 次にレビューしてほしい観点

- reviewer: 次のPRで扱える最小CSS整理候補の範囲が十分に小さいか。
- a11y-reviewer: 操作ボタン、フォーカス表示、動き抑制、LocalStorage削除ボタン周辺の分類が安全側になっているか。
- docs: `docs/css-inventory.md` の分類表が後続PRの判断材料として使いやすいか。

## 2026-06-22 CSS低リスク補足コメント追加

### 使用した流れ

- `/plan`: `docs/ai/PLAN.md` に今回の作業テーマ、補足コメント対象、コメント追加方針、変更しないもの、表示・LocalStorage・JavaScriptへの影響がない理由、確認方法を追記した。
- `/goal`: `docs/ai/GOAL.md` に、低リスク候補へ補足コメントだけを追加し、Static Checks相当の確認とWORKLOG記録までを完了条件にする目的を追記した。
- 実装: `docs/css-inventory.md` の「次のPRで実施できそうな最小整理案」に従い、CSS指定値を変えずにコメントのみ追加した。
- WORKLOG: 本項目に変更内容、確認結果、未確認項目、残課題、次に整理できそうな候補を記録した。

### 変更ファイル

- `public/assets/style.css`
- `docs/css-inventory.md`
- `docs/ai/PLAN.md`
- `docs/ai/GOAL.md`
- `docs/ai/WORKLOG.md`

### 変更内容

- `public/assets/style.css` に、低リスク候補の意図を残す補足コメントを追加した。
- 追加対象は `.footer-tools .legend`、`.footer-actions`、`.help-button:active`、`.storage-clear:active` に限定した。
- `.footer-tools .legend` は、基本指定と後続のテキスト可読性調整を混同しないためのコメントを追加した。
- `.footer-actions` は、フッター用配置・視覚調整・共有フッターボタン幅と、設定パネル用配置を混同しないためのコメントを追加した。
- `.help-button:active` と `.storage-clear:active` は、`prefers-reduced-motion` 内の再指定がアクセシビリティ目的で動きを抑制するためのものだと分かるコメントを追加した。
- `docs/css-inventory.md` に、今回の低リスク補足コメント追加では指定値・セレクタ・並び順を変更していないことと、次の整理候補は未実施であることを追記した。

### 変更していない内容

- CSS指定値、セレクタ、ルールの並び順、統合、削除は変更していない。
- `public/sanga202627season.html` は変更していない。
- `public/assets/app.js` は変更していない。
- `public/data/matches.json` は変更していない。
- `.github/workflows/static-checks.yml` は変更していない。
- LocalStorageキー、保存仕様、JavaScript挙動、日程データは変更していない。
- `.match`、`.match-inner`、`.ha`、`.date`、`.layout-*`、共有画像モード、LocalStorage削除ボタン周辺の統合・整理は行っていない。

### 確認結果

- `git diff --check` が成功した。
- `node tools/validate-matches.js` が成功した。
- `node tools/validate-generated-matches.js public/data/matches.json --expected-count 38 --strict` が成功した。
- `node --check public/assets/app.js` が成功した。
- Python確認で `public/assets/style.css` の `{` と `}` がそれぞれ509個で一致した。
- Python確認で `public/sanga202627season.html` が `assets/style.css` と `assets/app.js` を参照していることを確認した。
- `git diff -- public/sanga202627season.html public/assets/app.js public/data/matches.json .github/workflows/static-checks.yml --exit-code` が成功し、変更禁止ファイルに差分がないことを確認した。

### 未確認項目

- 今回はCSSコメント追加のみのため、実ブラウザでのスマートフォン幅・PC幅の目視確認は実施していない。
- 表示列変更、使い方ダイアログ、設定パネル、LocalStorage削除ボタン、キーボード操作、ブラウザコンソールエラー有無の実ブラウザ確認は実施していない。
- GitHub Actions上のStatic Checks実行結果は、PR作成後にGitHub上で確認する必要がある。

### 残課題

- CSS指定値やセレクタ整理へ進む場合は、今回コメントを追加した箇所でも統合可否を改めて表示確認込みで判断する。
- `.match`、`.date`、`.ha`、`.layout-*`、共有画像モード、LocalStorage削除ボタン周辺は、引き続き別PRで慎重に扱う。

### 次に整理できそうな候補

- `docs/css-inventory.md` の注意候補について、実ブラウザ確認手順を先に固定する。
- フッター操作ボタン周辺を扱う場合は、表示列変更、使い方、設定、フォーカス、動き抑制をセットで確認する。
- CSS指定値の統合ではなく、必要なら追加の補足コメントや確認観点の整理から進める。

### 人間が確認すべき点

- 追加した補足コメントが、今後のCSS整理時に意図を誤解しない粒度になっているか。
- GitHub Actions上のStatic Checksが成功しているか。
- 必要に応じて、実ブラウザで表示・操作に変化がないことを軽量チェックするか。

## 2026-06-22 JavaScript棚卸しドキュメント追加

### 作業テーマ

`public/assets/app.js` の実装修正に入る前に、JavaScript全体の構成、LocalStorage、DOM依存、CSSクラス連動、次に小さく整理できそうな候補を棚卸しする。

### 変更ファイル

- `docs/js-inventory.md`
- `docs/ai/JS_CHANGE_CHECKLIST.md`
- `docs/ai/PLAN.md`
- `docs/ai/GOAL.md`
- `docs/ai/WORKLOG.md`

### 変更内容

- `docs/js-inventory.md` を新規追加した。
- `public/assets/app.js` の大まかな構成、`matches.json` 読み込み、試合カード描画、表示列変更、表示モード変更、フィルタ、LocalStorage保存・復元・削除、使い方ダイアログ、設定パネル、共有画像関連を整理した。
- LocalStorageキーと保存内容、変更時の注意点を整理した。
- DOMで参照しているid、class、data属性、aria属性を整理した。
- JavaScriptが付与・削除・生成するCSSクラス連動を整理した。
- 次に小さく整理できそうな候補を、低リスク・中リスク・高リスクに分けて記録した。

### 変更していない内容

- `public/assets/app.js` は変更していない。
- `public/sanga202627season.html` は変更していない。
- `public/assets/style.css` は変更していない。
- `public/data/matches.json` は変更していない。
- `.github/workflows/static-checks.yml` は変更していない。
- LocalStorageキー、保存形式、復元処理、削除処理は変更していない。
- JavaScriptの関数名、変数名、処理順、イベント処理は変更していない。

### 確認結果

- `docs/js-inventory.md` が作成されていることを確認した。
- `docs/ai/WORKLOG.md` に今回の作業を記録した。
- `rg "localStorage|querySelector|getElementById|classList|dataset|aria-|addEventListener|fetch|hidden" public/assets/app.js` で依存箇所を確認した。
- `git diff -- public/assets/app.js public/sanga202627season.html public/assets/style.css public/data/matches.json .github/workflows/static-checks.yml --exit-code` で変更禁止ファイルに差分がないことを確認した。
- `git diff --check` が成功した。
- `node --check public/assets/app.js` が成功した。
- `node tools/validate-matches.js` が成功した。
- `node tools/validate-generated-matches.js public/data/matches.json --expected-count 38 --strict` が成功した。
- Python確認でCSSの波括弧数一致とHTMLのCSS/JavaScript参照を確認した。

### 未確認項目

- 実ブラウザでのPC幅・スマートフォン幅の表示確認は未実施。
- 表示列変更、表示モード変更、フィルタ、使い方ダイアログ、設定パネル、LocalStorage削除、共有画像生成の実ブラウザ操作確認は未実施。
- 共有画像生成に使うCDNモジュールの実ブラウザ読み込みと保存導線は未確認。
- JSON読み込み失敗時の利用者向け表示方針は要確認。

### 残課題

- 次のPRでは、実装変更前に `docs/js-inventory.md` の低リスク候補から扱う範囲を選ぶ。
- LocalStorageキーや保存形式、試合カード描画構造、共有画像生成処理は高リスクとして別途方針を決める。
- 実ブラウザ確認が必要な操作は、`docs/ai/BROWSER_CHECKLIST.md` に沿って人間またはブラウザ環境で確認する。

### 人間が確認すべき点

- `docs/js-inventory.md` の分類が、今後のJavaScript整理の判断材料として十分か。
- 低リスク・中リスク・高リスクの分類が、現在の運用上のリスク感に合っているか。
- 次に着手する最小整理候補を、コメント補足、DOM参照一覧整備、表示列変更まわりの小分割のどれにするか。

## 2026-06-22 JavaScript低リスクセクションコメント追加

### 使用した流れ

- `/plan`: `docs/ai/PLAN.md` に今回の作業テーマ、コメント追加対象、コメント追加方針、変更しないもの、LocalStorage・DOM・CSSクラス連動への影響がない理由、確認方法を追記した。
- `/goal`: `docs/ai/GOAL.md` に、`public/assets/app.js` へ低リスクなセクションコメントだけを追加し、JavaScriptの処理内容・関数名・変数名・処理順・LocalStorageキー・DOM参照・CSSクラス連動・HTML・CSS・日程データを変更しない目的と完了条件を追記した。
- CHECKLIST: `docs/ai/CHECKLIST.md` のデータ保護、LocalStorage保護、JavaScript確認、完了報告の観点に沿って確認した。
- WORKLOG: 本項目に変更内容、確認結果、未確認項目、残課題を記録した。

### 変更ファイル

- `public/assets/app.js`
- `docs/js-inventory.md`
- `docs/ai/PLAN.md`
- `docs/ai/GOAL.md`
- `docs/ai/WORKLOG.md`

### 変更内容

- `public/assets/app.js` に、Imports and initialization、LocalStorage keys and state、LocalStorage helpers、Match card state handling、Help dialog/settings/share controls、Share image mode、Layout/display mode/filters、LocalStorage reset、JSON loading and match card rendering のセクションコメントを追加した。
- JavaScriptの処理内容、関数名、変数名、処理順、イベントリスナーは変更していない。
- LocalStorageキー、保存形式、復元処理、削除処理は変更していない。
- DOM参照、`data-*` 属性、`aria-*` 属性、CSSクラス連動は変更していない。
- `docs/js-inventory.md` に、低リスク整理としてセクションコメントを追加したことと、次の整理候補は未実施であることを追記した。

### 確認結果

- `git diff --check` に成功した。
- `node --check public/assets/app.js` に成功した。
- `node tools/validate-matches.js` に成功し、`matches.json` が38件であること、日付形式・日付範囲・候補日の昇順・注記番号を確認した。
- `node tools/validate-generated-matches.js public/data/matches.json --expected-count 38 --strict` に成功し、件数38件、警告0、エラー0を確認した。
- Pythonワンライナーで `public/assets/style.css` の `{` と `}` がそれぞれ509件で一致することを確認した。
- Pythonワンライナーで `public/sanga202627season.html` が `assets/style.css` と `assets/app.js` を参照していることを確認した。
- `git diff -- public/sanga202627season.html public/assets/style.css public/data/matches.json .github/workflows/static-checks.yml --exit-code` に成功し、変更禁止ファイルに差分がないことを確認した。

### 未確認項目

- コメント追加のみのため、実ブラウザでのPC幅・スマートフォン幅の目視確認、表示列変更、表示モード、フィルタ、使い方ダイアログ、LocalStorage削除、共有画像生成の操作確認は未実施。
- GitHub Actions上のStatic Checks結果は、PR作成後にGitHub上で確認が必要。

### 残課題

- 表示列、表示モード、フィルタ、共有画像関連の次の整理候補は未実施。
- 実ブラウザでのスモークチェックは、必要に応じて `docs/ai/BROWSER_CHECKLIST.md` に沿って別途実施する。

### 人間が確認すべき点

- 追加したセクションコメントの粒度が、次のJavaScript整理に使いやすいか。
- コメント見出しが、LocalStorage、DOM依存、表示列・表示モード・フィルタ、共有画像関連を誤って混同しない助けになっているか。

### 次にレビューしてほしい観点

- reviewer: コメント追加のみで処理差分がないこと、セクション境界が妥当かを確認してほしい。
- a11y-reviewer: 今回は挙動変更なしのため、次にUI挙動へ触る作業時にキーボード操作・フォーカス表示・ダイアログ操作を確認してほしい。
- docs: `PLAN`、`GOAL`、`js-inventory`、`WORKLOG` の記録が後続のJavaScript整理に十分か確認してほしい。

## 2026-06-22 JavaScript変更チェックリスト追加

### 作業テーマ

`public/assets/app.js` を今後変更する前に使う、JavaScript変更専用の軽量チェックリストを追加する。

### 変更ファイル

- `docs/ai/JS_CHANGE_CHECKLIST.md`
- `docs/ai/CHECKLIST.md`
- `docs/ai/WORKLOG.md`

### 変更内容

- `docs/ai/JS_CHANGE_CHECKLIST.md` を新規追加した。
- `docs/js-inventory.md` の棚卸し内容をもとに、LocalStorage、DOM参照、CSSクラス連動、表示列、表示モード、フィルタ、使い方ダイアログ、設定パネル、JSON読み込み・カード描画、共有画像関連の確認観点を整理した。
- 自動確認、人間が軽く確認する項目、変更内容別の追加確認を分け、毎回の確認が重くなりすぎない構成にした。
- `docs/ai/CHECKLIST.md` から、JavaScript変更時に `docs/ai/JS_CHANGE_CHECKLIST.md` を参照できるようにした。

### 変更していない内容

- `public/assets/app.js` は変更していない。
- `public/sanga202627season.html` は変更していない。
- `public/assets/style.css` は変更していない。
- `public/data/matches.json` は変更していない。
- `.github/workflows/static-checks.yml` は変更していない。
- LocalStorageキー、保存形式、復元処理、削除処理は変更していない。

### 確認結果

- `docs/ai/JS_CHANGE_CHECKLIST.md` が作成されていることを確認した。
- `docs/ai/CHECKLIST.md` にJavaScript変更チェックリストへの参照が追加されていることを確認した。
- `docs/ai/WORKLOG.md` に今回の作業を記録した。
- JavaScript本体は変更していないため、次にJavaScript整理、関数分割、LocalStorage整理、JSON描画改善へ進む前の安全確認がしやすくなった。

### 未確認項目

- ドキュメント追加のみのため、実ブラウザでのPC幅・スマートフォン幅の目視確認、表示列変更、表示モード、フィルタ、使い方ダイアログ、LocalStorage削除、共有画像生成の操作確認は未実施。
- GitHub Actions上のStatic Checks結果は、PR作成後にGitHub上で確認が必要。

### 残課題

- 次に `public/assets/app.js` を変更するPRでは、`docs/ai/JS_CHANGE_CHECKLIST.md` に沿って自動確認、軽量ブラウザ確認、変更内容別の追加確認を記録する。
- 共有画像関連やLocalStorage保存形式に触る場合は、静的検証だけで完了扱いにせず、実ブラウザで対象操作を確認する。

### 人間が確認すべき点

- 毎回必ず確認する項目が、運用上重すぎない粒度になっているか。
- 変更内容別の追加確認が、今後のJavaScript整理前の安全確認として十分か。

## 2026-06-22 JavaScript契約チェック追加

### 作業テーマ

`docs/ai/JS_CHANGE_CHECKLIST.md` のうち機械的に確認できる項目を Static Checks に追加し、今後のJavaScript整理時にLocalStorageキー、JSON読み込みパス、主要DOMフック、CSS連動クラスの破壊を検知しやすくする。

### 変更ファイル

- `tools/validate-app-contract.js`
- `.github/workflows/static-checks.yml`
- `docs/ai/JS_CHANGE_CHECKLIST.md`
- `docs/ai/PLAN.md`
- `docs/ai/GOAL.md`
- `docs/ai/WORKLOG.md`

### 変更内容

- `tools/validate-app-contract.js` を追加し、Node.js標準機能だけで `public/assets/app.js` と `public/sanga202627season.html` の契約文字列を静的に検証できるようにした。
- `.github/workflows/static-checks.yml` に `node tools/validate-app-contract.js` を追加し、Static Checksで自動実行されるようにした。
- `docs/ai/JS_CHANGE_CHECKLIST.md` に、JavaScript契約チェックの実行、Static Checksでの自動実行、実ブラウザ確認の代替ではないことを追記した。
- `/plan` と `/goal` として、`docs/ai/PLAN.md` と `docs/ai/GOAL.md` に今回の作業計画と完了条件を追記した。

### 変更していない内容

- `public/assets/app.js` は変更していない。
- `public/sanga202627season.html` は変更していない。
- `public/assets/style.css` は変更していない。
- `public/data/matches.json` は変更していない。
- LocalStorageキー、保存形式、復元処理、削除処理は変更していない。
- JavaScriptの関数名、変数名、処理順、イベント処理は変更していない。

### 自動検証できるようになった項目

- 既存LocalStorageキー4件が `public/assets/app.js` に残っていること。
- `data/matches.json` の読み込みパスが `public/assets/app.js` に残っていること。
- `public/sanga202627season.html` が `assets/app.js` と `assets/style.css` を参照していること。
- 使い方、設定、LocalStorage削除、表示列、表示モード、フィルタ、JSONプレビューに関係する主要DOMフックがHTMLまたはJS内に存在すること。
- `json-preview-match`、`json-preview-year`、共有画像生成状態に関係する主要CSS連動クラスが `public/assets/app.js` に残っていること。

### 確認結果

- `node tools/validate-app-contract.js` に成功した。
- `git diff --check` に成功した。
- `node --check public/assets/app.js` に成功した。
- `node tools/validate-matches.js` に成功した。
- `node tools/validate-generated-matches.js public/data/matches.json --expected-count 38 --strict` に成功した。
- Pythonワンライナーで `public/assets/style.css` の `{` と `}` がそれぞれ509件で一致することを確認した。
- Pythonワンライナーで `public/sanga202627season.html` が `assets/style.css` と `assets/app.js` を参照していることを確認した。
- Static Checks相当として、ワークフローに定義されている各ローカルコマンドを実行し成功した。
- `git diff -- public/assets/app.js public/sanga202627season.html public/assets/style.css public/data/matches.json --exit-code` に成功し、変更禁止ファイルに差分がないことを確認した。

### 未確認項目

- GitHub Actions上のStatic Checks結果は、PR作成後にGitHub上で確認が必要。
- 実ブラウザでのPC幅・スマートフォン幅の目視確認、表示列変更、表示モード、フィルタ、使い方ダイアログ、LocalStorage削除、共有画像生成の操作確認は未実施。

### 残課題

- 今回の契約チェックは文字列ベースの静的検証であり、DOM構造の意味的な正しさやイベント処理の動作までは保証しない。
- JavaScript整理を行うPRでは、引き続き `docs/ai/JS_CHANGE_CHECKLIST.md` と `docs/ai/BROWSER_CHECKLIST.md` に沿った確認が必要。

### 人間が確認すべき点

- 契約チェック対象の文字列が、今後のJavaScript整理で守りたい最小契約として十分か。
- 追加したStatic Checksの粒度が、運用上重すぎず壊れやすい箇所を検知できるものになっているか。

## 2026-06-22 JavaScript契約チェックの有効値検証強化

### 使用した流れ

- `/plan`: `docs/ai/PLAN.md` に今回の作業テーマ、強化する検証内容、変更対象ファイル、変更しないもの、app.js本体へ影響がない理由、確認方法を追記した。
- `/goal`: `docs/ai/GOAL.md` に今回の目的と完了条件を追記した。
- CHECKLIST: `docs/ai/JS_CHANGE_CHECKLIST.md` と `docs/ai/CHECKLIST.md` の観点に沿って、静的契約チェック強化と変更禁止ファイルの差分確認を行った。
- WORKLOG: 本項目に変更内容、確認結果、未確認項目、残課題を記録した。

### 変更ファイル

- `tools/validate-app-contract.js`
- `docs/ai/PLAN.md`
- `docs/ai/GOAL.md`
- `docs/ai/JS_CHANGE_CHECKLIST.md`
- `docs/js-inventory.md`
- `docs/ai/WORKLOG.md`

### 変更内容

- `tools/validate-app-contract.js` に、表示列の有効値 `1`、`2`、`3`、`4` と関連クラス `layout-1`、`layout-3`、`layout-4` の確認を追加した。
- 表示モードの有効値 `card`、`compact` と関連クラス `mode-card`、`mode-compact`、`display-mode-card`、`display-mode-compact` の確認を追加した。
- フィルタの有効値 `all`、`home`、`away`、`year-2026`、`year-2027`、`tentative`、`marked`、`state-1`、`state-2` の確認を追加した。
- カード状態について、`normalizeMatchState()` 周辺の `0`、`1`、`2` と、`data-state` 反映、状態別フィルタ判定が残っていることを確認する静的チェックを追加した。
- `docs/ai/JS_CHANGE_CHECKLIST.md` と `docs/js-inventory.md` に、契約チェックの対象追加と、実ブラウザ確認の代替ではないことを追記した。
- `.github/workflows/static-checks.yml` は既に `node tools/validate-app-contract.js` を実行していたため変更していない。
- `public/assets/app.js`、`public/sanga202627season.html`、`public/assets/style.css`、`public/data/matches.json` は変更していない。

### 確認結果

- `node tools/validate-app-contract.js` に成功した。
- Static Checks相当として、契約チェック、日程JSON検証、生成JSON厳格検証、JavaScript構文検証、CSS波括弧数検証、HTMLのCSS/JS参照検証を実行した。
- `public/assets/app.js`、`public/sanga202627season.html`、`public/assets/style.css`、`public/data/matches.json` に差分がないことを確認した。

### 未確認項目

- 今回は静的契約チェック強化のみのため、実ブラウザでの表示列切替、表示モード切替、フィルタ操作、カード状態切替は未確認。
- GitHub Actions上のStatic Checks実行結果はPR作成後に確認する。

### 残課題

- 今後 `public/assets/app.js` を整理する際は、今回追加した契約チェックに加えて、`docs/ai/BROWSER_CHECKLIST.md` に沿った実ブラウザ確認を行う。

### 人間が確認すべき点

- 契約チェックの粒度が、今後のJavaScript整理の安全策として過不足ないか。
- 実ブラウザでの表示列・表示モード・フィルタ操作確認を、次回JavaScript変更時に実施すること。

### 次にレビューしてほしい観点

- reviewer: 追加した静的チェックが誤検知を抑えつつ、有効値欠落を検知できる内容になっているか。
- a11y-reviewer: 今回は実装本体に触れていないため、次回JavaScript変更時の実操作確認観点に不足がないか。
- docs: PLAN、GOAL、JS_CHANGE_CHECKLIST、js-inventory、WORKLOG の追記が運用上分かりやすいか。

## 2026-06-22 ダイアログ閉じる待機時間の定数化

### 作業テーマ

使い方ダイアログと設定パネルの閉じるアニメーション後に `hidden` を戻す待機時間 `240ms` を、意味が分かる `PANEL_CLOSE_DELAY_MS` として定数化する。今回の作業はJavaScript低リスク実装整理であり、機能追加や挙動変更ではない。

### 変更ファイル

- `public/assets/app.js`
- `docs/js-inventory.md`
- `docs/ai/PLAN.md`
- `docs/ai/GOAL.md`
- `docs/ai/WORKLOG.md`

### 変更内容

- `public/assets/app.js` の既存定数・状態定義付近に `PANEL_CLOSE_DELAY_MS` を追加した。
- `closeHelp()` と `closeSettings()` の `setTimeout(..., 240)` を `PANEL_CLOSE_DELAY_MS` 参照へ置き換えた。
- 待機時間の値は従来どおり `240ms` から変更していない。
- `docs/js-inventory.md` に、ダイアログ/設定パネルの閉じる待機時間は `PANEL_CLOSE_DELAY_MS` で管理し、挙動変更は行っていないことを追記した。
- `docs/ai/JS_CHANGE_CHECKLIST.md` に、閉じる待機時間を整理する場合は `PANEL_CLOSE_DELAY_MS` が従来どおり `240ms` を表していることを確認する項目を追記した。
- `/plan` と `/goal` として、`docs/ai/PLAN.md` と `docs/ai/GOAL.md` に今回の作業計画と完了条件を追記した。

### 変更していない内容

- `closeHelp()` と `closeSettings()` の処理順は変更していない。
- `openHelp()` と `openSettings()` は変更していない。
- 関数名、イベント処理、既存変数名は変更していない。
- LocalStorageキー、保存形式、読み書き・削除処理は変更していない。
- DOM参照、CSSクラスの付与・削除処理、CSSクラス連動は変更していない。
- `public/sanga202627season.html`、`public/assets/style.css`、`public/data/matches.json`、`.github/workflows/static-checks.yml` は変更していない。

### 確認結果

- `git diff --check` に成功した。
- `node --check public/assets/app.js` に成功した。
- `node tools/validate-app-contract.js` に成功した。
- `node tools/validate-matches.js` に成功した。
- `node tools/validate-generated-matches.js public/data/matches.json --expected-count 38 --strict` に成功した。
- Pythonワンライナーで `public/assets/style.css` の `{` と `}` がそれぞれ509件で一致することを確認した。
- Pythonワンライナーで `public/sanga202627season.html` が `assets/style.css` と `assets/app.js` を参照していることを確認した。
- Static Checks相当として、ワークフローに定義されている各ローカルコマンドを実行し成功した。
- `git diff -- public/sanga202627season.html public/assets/style.css public/data/matches.json .github/workflows/static-checks.yml --exit-code` に成功し、変更禁止ファイルに差分がないことを確認した。

### 未確認項目

- 実ブラウザでのPC幅・スマートフォン幅の目視確認は未実施。
- 使い方ダイアログ、設定パネル、表示列変更、LocalStorage削除、共有画像生成の実ブラウザ操作確認は未実施。
- GitHub Actions上のStatic Checks結果は、PR作成後にGitHub上で確認が必要。

### 残課題

- 今回は低リスクな定数化のみのため、ダイアログ周辺の関数分割や構造整理は後続作業に分ける。

### 人間が確認すべき点

- 実ブラウザで使い方ダイアログと設定パネルの開閉が従来どおりに見えること。
- `PANEL_CLOSE_DELAY_MS` の配置と命名が今後の整理に適していること。

## 2026-06-22 LocalStorageキー定数名の明確化

### 使用した流れ

- `/plan`: `docs/ai/PLAN.md` に今回の作業テーマ、変更対象の定数名、変更しないLocalStorageキー文字列、保存形式・復元処理・削除処理に影響がない理由、確認方法を追記した。
- `/goal`: `docs/ai/GOAL.md` に今回の目的と完了条件を追記した。
- CHECKLIST: `docs/ai/JS_CHANGE_CHECKLIST.md` と `docs/ai/CHECKLIST.md` の観点に沿って静的確認を行う。
- WORKLOG: 本項目に変更内容、確認結果、未確認項目、残課題を記録する。

### 変更ファイル

- `public/assets/app.js`
- `docs/js-inventory.md`
- `docs/ai/JS_CHANGE_CHECKLIST.md`
- `docs/ai/PLAN.md`
- `docs/ai/GOAL.md`
- `docs/ai/WORKLOG.md`

### 変更内容

- `public/assets/app.js` のLocalStorageキー定数名を、`key` から `CARD_STATE_STORAGE_KEY`、`filterKey` から `FILTER_SETTINGS_STORAGE_KEY`、`displayModeKey` から `DISPLAY_MODE_STORAGE_KEY`、`layoutKey` から `LAYOUT_STORAGE_KEY` へ変更した。
- LocalStorageキー文字列は変更していない。
- 保存形式、復元処理、削除処理は変更していない。
- HTML、CSS、日程データ、GitHub Actionsワークフローは変更していない。

### 確認結果

- `git diff --check` に成功した。
- `node --check public/assets/app.js` に成功した。
- `node tools/validate-app-contract.js` により、4つのLocalStorageキー文字列を含むJavaScript契約検証に成功した。
- `node tools/validate-matches.js` により、38件の日程データ検証に成功した。
- `node tools/validate-generated-matches.js public/data/matches.json --expected-count 38 --strict` により、生成JSONの厳格検証に成功した。
- Pythonワンライナーで `public/assets/style.css` の `{` と `}` の数が一致することを確認した。
- Pythonワンライナーで `public/sanga202627season.html` が `assets/style.css` と `assets/app.js` を参照していることを確認した。
- `git diff -- public/sanga202627season.html public/assets/style.css public/data/matches.json .github/workflows/static-checks.yml --exit-code` により、変更禁止ファイルに差分がないことを確認した。
- `rg` により、4つのLocalStorageキー文字列が `public/assets/app.js` に残っており、内部参照が新しい定数名へ置き換わっていることを確認した。

### 未確認項目

- 実ブラウザでの表示・操作確認は未実施。今回の変更はJavaScript内部の定数名のみで、HTML/CSS/表示仕様は変更していない。

### 残課題

- 現時点ではなし。

### 人間が確認すべき点

- LocalStorageキー文字列、保存形式、復元処理、削除処理が意図せず変更されていないことを差分で確認する。

### 次にレビューしてほしい観点

- reviewer: 定数名の置換が用途に沿っており、処理内容に差分がないか。
- a11y-reviewer: UIやDOM操作の変更がないため、追加レビューは任意。
- docs: PLAN、GOAL、JS_CHANGE_CHECKLIST、WORKLOGの記録が簡潔で後続作業に使いやすいか。

## 2026-06-22 LocalStorage利用可否フラグ名の明確化

### 作業テーマ

LocalStorage仕様変更ではなく、JavaScript内部のLocalStorage利用可否フラグ名を分かりやすくする小さな整理を行った。

### 変更ファイル

- `public/assets/app.js`
- `docs/js-inventory.md`
- `docs/ai/JS_CHANGE_CHECKLIST.md`
- `docs/ai/PLAN.md`
- `docs/ai/GOAL.md`
- `docs/ai/WORKLOG.md`

### 変更内容

- `public/assets/app.js` の `storageAvailable` を `isStorageAvailable` に改名した。
- LocalStorageキー文字列は変更していない。
- 保存形式、復元処理、削除処理は変更していない。
- `true` / `false` の代入タイミング、例外処理、`showStorageUnavailableMessage()` の呼び出しタイミングは変更していない。
- HTML、CSS、日程データ、Static Checksワークフローは変更していない。
- `docs/js-inventory.md` と `docs/ai/JS_CHANGE_CHECKLIST.md` に、今回の変数名整理がLocalStorage仕様変更ではないことを短く追記した。
- `/plan` と `/goal` として、`docs/ai/PLAN.md` と `docs/ai/GOAL.md` に今回の作業計画と完了条件を追記した。

### 確認結果

- `git diff --check` に成功した。
- `node --check public/assets/app.js` に成功した。
- `node tools/validate-app-contract.js` に成功し、4つのLocalStorageキー文字列が残っていることを確認した。
- `node tools/validate-matches.js` に成功した。
- `node tools/validate-generated-matches.js public/data/matches.json --expected-count 38 --strict` に成功した。
- Pythonワンライナーで `public/assets/style.css` の `{` と `}` の数がそれぞれ509件で一致することを確認した。
- Pythonワンライナーで `public/sanga202627season.html` が `assets/style.css` と `assets/app.js` を参照していることを確認した。
- Static Checks相当として、ワークフローに定義されている各ローカルコマンドを実行し成功した。
- `git diff -- public/sanga202627season.html public/assets/style.css public/data/matches.json .github/workflows/static-checks.yml --exit-code` に成功し、変更禁止ファイルに差分がないことを確認した。
- Pythonワンライナーで4つのLocalStorageキー文字列が `public/assets/app.js` に各1件ずつ残っていることを確認した。

### 未確認項目

- 実ブラウザでのPC幅・スマートフォン幅の目視確認は未実施。
- 表示列変更、表示モード変更、フィルタ操作、カード状態保存・復元・削除の実ブラウザ操作確認は未実施。
- GitHub Actions上のStatic Checks結果は、PR作成後にGitHub上で確認が必要。

### 残課題

- 現時点ではなし。

### 人間が確認すべき点

- 差分上、LocalStorageキー文字列、保存形式、復元処理、削除処理に変更がないこと。
- 実ブラウザで既存の保存・復元・削除挙動が従来どおりであること。

### 次に進める候補

- LocalStorage周辺の関数名や責務整理を行う場合は、保存形式・キー文字列・削除対象を維持したまま別作業として進める。

## 2026-06-22 表示モード・フィルタ関連定数名の明確化

### 使用した流れ

- `/plan`: `docs/ai/PLAN.md` に今回の作業テーマ、変更対象の定数名、変更しない表示モード値・フィルタ値、保存形式・復元処理・フィルタ処理に影響がない理由、確認方法を追記した。
- `/goal`: `docs/ai/GOAL.md` に今回の目的と完了条件を追記した。
- CHECKLIST: `docs/ai/JS_CHANGE_CHECKLIST.md` と `docs/ai/CHECKLIST.md` の観点に沿って、静的確認と差分確認を実施した。
- WORKLOG: 本項目に変更内容、確認結果、未確認項目、残課題を記録した。

### 変更ファイル

- `public/assets/app.js`
- `docs/js-inventory.md`
- `docs/ai/JS_CHANGE_CHECKLIST.md`
- `docs/ai/PLAN.md`
- `docs/ai/GOAL.md`
- `docs/ai/WORKLOG.md`

### 変更内容

- `public/assets/app.js` の `validDisplayModes`、`validFilters`、`filterLabels` を、それぞれ `VALID_DISPLAY_MODES`、`VALID_FILTERS`、`FILTER_LABELS` へ改名した。
- 表示モード値 `card`、`compact` は変更していない。
- フィルタ値 `all`、`home`、`away`、`year-2026`、`year-2027`、`tentative`、`marked`、`state-1`、`state-2` は変更していない。
- フィルタラベル文言は変更していない。
- LocalStorageキー文字列、保存形式、復元処理、削除処理は変更していない。
- HTML、CSS、日程データ、Static Checksワークフローは変更していない。

### 確認結果

- `git diff --check` に成功した。
- `node --check public/assets/app.js` に成功した。
- `node tools/validate-app-contract.js` に成功し、表示モード値・フィルタ値・LocalStorageキー文字列が残っていることを確認した。
- `node tools/validate-matches.js` に成功した。
- `node tools/validate-generated-matches.js public/data/matches.json --expected-count 38 --strict` に成功した。
- Pythonスクリプトで `public/assets/style.css` の `{` と `}` の数が一致することを確認した。
- Pythonスクリプトで `public/sanga202627season.html` が `assets/style.css` と `assets/app.js` を参照していることを確認した。
- `git diff -- public/sanga202627season.html public/assets/style.css public/data/matches.json .github/workflows/static-checks.yml` で変更禁止ファイルに差分がないことを確認した。

### 未確認項目

- 今回はJavaScript内部定数名のみの変更であり、ブラウザ実行環境での表示モード切替・フィルタ操作・LocalStorage保存復元の手動確認は未実施。

### 残課題

- 後続で表示モード・フィルタ処理をさらに整理する場合は、実ブラウザで表示モード切替、フィルタ切替、件数表示、再読み込み後の復元を確認する。

### 人間が確認すべき点

- 実ブラウザで表示モード切替と各フィルタが従来どおり動くこと。
- 既存の保存済み表示モード・フィルタ設定が従来どおり復元されること。

### 次にレビューしてほしい観点

- reviewer: 定数名変更が参照漏れなく行われ、値・処理順・保存仕様に差分がないか。
- a11y-reviewer: 今回はアクセシビリティに直接影響する変更がない認識でよいか。
- docs: `docs/js-inventory.md` と `docs/ai/JS_CHANGE_CHECKLIST.md` の追記が今後のJS整理に役立つか。

## 2026-06-22 カード状態保持変数名の明確化

### 変更ファイル

- `public/assets/app.js`
- `docs/js-inventory.md`
- `docs/ai/JS_CHANGE_CHECKLIST.md`
- `docs/ai/PLAN.md`
- `docs/ai/GOAL.md`
- `docs/ai/WORKLOG.md`

### 変更内容

- `public/assets/app.js` のカード状態保持変数 `states` を `matchStates` に改名した。
- LocalStorageキー文字列 `sanga-schedule-button-states-v1` は変更していない。
- 保存形式、復元処理、削除処理、状態値 `0` / `1` / `2`、フィルタ処理は変更していない。
- `docs/js-inventory.md` と `docs/ai/JS_CHANGE_CHECKLIST.md` に、変数名変更時もLocalStorageキー文字列・保存形式・状態値を維持する確認観点を追記した。

### 確認結果

- `git diff --check` は成功。
- `node --check public/assets/app.js` は成功。
- `node tools/validate-app-contract.js` は成功し、LocalStorageキー文字列とカード状態値の契約が維持されていることを確認。
- `node tools/validate-matches.js` は成功。
- `node tools/validate-generated-matches.js public/data/matches.json --expected-count 38 --strict` は、現行データが49件のため件数不一致で失敗。日程データは今回変更していない。
- 現行Static Checksと同じ `node tools/validate-generated-matches.js public/data/matches.json --expected-count 49 --strict` は成功。
- CSS波括弧数は `{` / `}` ともに509件で一致。
- `public/sanga202627season.html` が `assets/style.css` と `assets/app.js` を参照していることを確認。
- `public/sanga202627season.html`、`public/assets/style.css`、`public/data/matches.json`、`.github/workflows/static-checks.yml` に差分がないことを確認。

### 未確認項目

- 実ブラウザでのPC表示、スマートフォン幅表示、クリック操作、LocalStorage保存・復元・削除操作は未確認。

### 残課題

- 次回以降、必要に応じて実ブラウザでカード状態変更、再読み込み後の復元、LocalStorage削除、フィルタ `state-1` / `state-2` の動作確認を行う。

## 2026-06-23 大会リボンとカード内タイトル調整

### 変更ファイル

- `public/assets/app.js`
- `public/assets/style.css`
- `public/sanga202627season.html`

### 変更内容

- J1を含む大会表示をカード右上のリボン風表示に変更した。
- 大会コードごとにリボン色を分けた。
- カード内タイトルから `天皇杯 ` / `ルヴァン杯 ` などの大会名接頭辞を除き、リボン表示と重複しないようにした。
- HOME/AWAY空欄カードの左帯を白背景・文字なし表示にした。
- 既存の未定カードロゴ非表示と `FC町田ゼルビア` のカード表示短縮は維持した。
- CSS/JS変更に合わせて `public/sanga202627season.html` のキャッシュクエリとバージョン表記を更新した。
- `public/data/matches.json` とCSVは変更していない。

### 確認結果

- `git diff --check` に成功した。
- `node tools/validate-matches.js` に成功した。
- `node tools/validate-generated-matches.js public/data/matches.json --expected-count 49 --strict` に成功した。
- `node --check public/assets/app.js` に成功した。
- `node --check tools/generate-matches-from-csv.js` に成功した。
- `node --check tools/validate-generated-matches.js` に成功した。
- `node --check tools/export-matches-to-sheet-csv.js` に成功した。
- `python3 -m http.server 4173 --bind 127.0.0.1` を起動し、`curl -I http://127.0.0.1:4173/public/sanga202627season.html` でHTTP 200を確認した。
- Node.jsの確認スクリプトで `sec01`、`sec39`、`sec40`、`sec41`、`sec45`、`sec46`、`sec47`、`sec48`、`sec49` のリボン文言とカード内タイトル変換結果を確認した。

### 未確認項目

- 実ブラウザでのPC幅・スマートフォン幅の目視確認、表示列切替、使い方ダイアログ、LocalStorage削除ボタン、画像生成時の見た目は未確認。
- この環境ではChromium/Google Chrome/Playwright等のブラウザ実行コマンドが見つからなかったため、スクリーンショット取得は未実施。

### 残課題

- 人間の実ブラウザ確認で、2列表示時にリボンが日付やタイトルに重ならないこと、画像生成時にも自然に表示されることを確認する。

### 人間が確認すべき点

- J1・天皇杯・ルヴァン杯の各リボン表示、色分け、カード内タイトルの重複解消が意図どおりに見えること。
- HOME/AWAY空欄カードの左帯が白背景で、候補日カードの黄色背景が維持されていること。
