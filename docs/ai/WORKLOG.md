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

