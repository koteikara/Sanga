# プロジェクト構成

確認基準日: 2026-08-21

## 公開ページ

| ページ | HTML | 実装 | データ |
| --- | --- | --- | --- |
| 年間スケジュール | `public/sanga202627season.html` | `public/assets/style.css`、`public/assets/app.js` | `public/data/matches.json`（57件） |
| 予想スカッド | `public/squad.html` | `public/assets/squad.css`、`public/assets/squad-builder.js`、`public/assets/squad-formations.js` | `public/data/players.json`（39件）、`matches.json` |
| 確認用トップ | `public/index.html` | 公開2ページへの導線 | なし |

## ディレクトリ

### `public/`

本番公開物の正本です。日程・選手・ホテル索引JSON、CSS、JavaScript、ロゴ、背番号タイル、静的配置した `modern-screenshot` を含みます。`hotel-index.json` は現在0件で画面表示は未実装です。

### `tools/`

- 日程生成・検証: `generate-matches-from-csv.js`、`validate-matches.js`、`validate-generated-matches.js`、`validate-app-contract.js`
- 選手生成・検証: `generate-players-from-csv.js`、`validate-players.js`
- スカッド: `check-squad-layout.mjs`、背番号画像加工ツール
- ホテル: `tools/hotels/`、`validate-hotels.js`

### `experiments/`

公開前の画像生成・スカッドのデザインと操作検証です。公開物の正本ではありません。

### `docs/`

仕様、運用、チェックリスト、調査、作業記録です。必読順と更新条件は `docs/documentation-policy.md` を参照してください。完了済み計画と過去の作業記録は `docs/archive/` に置き、通常の必読対象から外します。

## データと保存

| 対象 | 正本・保存先 | 注意 |
| --- | --- | --- |
| 日程 | `public/data/matches.json` | 57件。IDはLocalStorage状態と関係する |
| 選手 | `public/data/players.json` | 39件 |
| 初期CSV | `docs/sheets/schedule.initial.csv` | 2026-06-22時点の49件スナップショット |
| 日程個人状態 | LocalStorage | 既存キー・保存形式を維持する |
| スカッド保存 | LocalStorage | 新`squad`形式を保存し、旧`bench`形式を読み込む |
| ホテル索引 | `public/data/hotel-index.json` | 現在0件 |

## GitHub Actions

| ワークフロー | 目的 | 実行 |
| --- | --- | --- |
| `static-checks.yml` | 日程、ホテル、選手、年間スケジュールJS等の静的検証 | PR、`main` push |
| `pages.yml` | `public/` をGitHub Pagesへ配置 | `main` push、手動 |
| `deploy-production.yml` | `public/` を本番へ配置 | `DEPLOY`確認付き手動 |

Static Checksは現在、スカッド用JavaScriptの構文確認と `check-squad-layout.mjs` を自動実行していません。本番デプロイ前検証の強化は別PRで検討します。

## 現在の検証

```bash
node tools/validate-matches.js
node tools/validate-generated-matches.js public/data/matches.json --expected-count 57 --strict
node tools/validate-hotels.js
node tools/validate-players.js
node --check public/assets/app.js
node tools/validate-app-contract.js
node --check public/assets/squad-builder.js
node --check public/assets/squad-formations.js
node --check public/assets/squad-sample-players.js
```

実行可能な環境では `node tools/check-squad-layout.mjs` も実行します。UI変更は対象別ブラウザチェックリストで確認します。

## 特に注意する範囲

- 日程・選手の事実情報とID。
- LocalStorageキー・保存形式。
- 年間スケジュールのDOMフックとCSS上書き。
- スカッドの保存形式、配置計算、iOS Safariの画像生成制約。
- 公開HTMLのキャッシュ用バージョンクエリ。
- `public/` 全体をアップロードする本番デプロイ。

## 次の構成改善

1. 本番デプロイ前のスカッド検証をGitHub Actionsへ追加する。
2. 公式由来素材と外部ライブラリの出典・ライセンスを整理する。
