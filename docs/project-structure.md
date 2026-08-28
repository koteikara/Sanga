# プロジェクト構成

確認基準日: 2026-08-26

## 公開ページ

| ページ | HTML | 実装 | データ |
| --- | --- | --- | --- |
| 年間スケジュール | `public/sanga202627season.html` | `public/assets/style.css`、`public/assets/app.js` | `public/data/matches.json`（57件） |
| 予想スカッド | `public/squad.html` | `public/assets/squad.css`、`public/assets/squad-builder.js`、`public/assets/squad-formations.js`、`public/assets/squad-tile-offsets.js` | `public/data/players.json`（39件）、`matches.json` |
| 入口ページ | `public/index.html` | `public/assets/index.css`、`index-page.js`、`index-nebula.js`、`index-motion.js` | `public/data/tools.json`（5件） |

## ディレクトリ

### `public/`

本番公開物の正本です。日程・選手・ホテル索引JSON、CSS、JavaScript、ロゴ、背番号タイル、静的配置した `modern-screenshot` を含みます。`hotel-index.json` は現在0件で画面表示は未実装です。

現行2ページのほかに、2025シーズンの日程ページ、スライドページ、求譲ツールなど過去に公開したページも含みます。全体像と各ページの位置づけは `docs/production-inventory-audit.md` を参照してください。`public/experiments/` は本番アップロードの対象外で、GitHub Pagesでのみ参照できます。

### `tools/`

- 日程生成・検証: `generate-matches-from-csv.js`、`validate-matches.js`、`validate-generated-matches.js`、`validate-app-contract.js`
- 選手生成・検証: `generate-players-from-csv.js`、`validate-players.js`
- スカッド: `check-squad-layout.mjs`、背番号画像加工ツール
- 公開アセット: `check-static-assets.mjs`（CSS波括弧数、HTMLのCSS/JS参照、版数の突き合わせ）、`asset-versions.mjs`（CSS/JSの `?v=` を内容ハッシュで生成・検証。`--check` で検出、引数なしで書き換え）
- 文書生成: `generate-dom-inventory.mjs`（`docs/dom-inventory.md` を実装から生成、`--check` で差分検出）
- ホテル: `tools/hotels/`、`validate-hotels.js`
- 本番からの取り込み: `fetch-production-files.mjs`、`ftp-client.mjs`（読み取り専用。手順は `docs/production-import.md`）、`check-import-tools.mjs`（検証用FTPサーバーを立てて動作確認）

### ルート直下 `package.json`

検証コマンドの集約先です。依存パッケージは持たず、`tools/` 配下のスクリプトを `npm run check` 系にまとめています。手元とGitHub Actionsが同じスクリプトを実行します。

### `experiments/`

公開前のデザインと操作検証です。画像生成、スカッド、入口ページ、ベンチ強調、SUPPORTER TIMELINE（`experiments/supporter-timeline/`）が入っています。公開物の正本ではありません。`public/` には置かないため、GitHub Pagesにも本番サーバーにも公開されません。以前は `public/experiments/` に複製がありましたが、内容がずれていたうえ本番で公開されていたため削除しました。経緯は `docs/production-inventory-audit.md` を参照してください。

### `docs/`

仕様、運用、チェックリスト、調査、作業記録です。`docs/dom-inventory.md` は実装から自動生成する一覧で、手で編集しません。必読順と更新条件は `docs/documentation-policy.md` を参照してください。出典と権利状態は `docs/source-and-license.md`、第三者製ソフトウェアは `THIRD_PARTY_NOTICES.md` を正とします。完了済み計画と過去の作業記録は `docs/archive/` に置き、通常の必読対象から外します。

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

Static Checksと本番デプロイは、再利用可能な `squad-checks.yml` を通して、スカッド用JavaScript構文、選手JSON、静的契約、Chromiumレイアウトを共通検証します。レイアウト検証は幅320px・375px・420px、控え0人・5人・9人・12人、17フォーメーション、8スタイルを対象にします。

## 現在の検証

検証コマンドは `package.json` に集約し、GitHub Actionsからも同じスクリプトを呼びます。

```bash
npm run check
```

個別に実行する場合は `npm run check:static`（日程ページ）と `npm run check:squad`（予想スカッド）を使います。
実体は `tools/` 配下の検証スクリプトで、追加の依存はありません。

Playwrightを利用できる環境では、ローカルサーバーを起動して次も実行します。

```bash
npm run check:squad:browser
```

GitHub Actionsでは `npm run check:squad:browser` まで自動実行します。iPhone Safariを含むUI確認は対象別ブラウザチェックリストで確認します。

## 特に注意する範囲

- 日程・選手の事実情報とID。
- LocalStorageキー・保存形式。
- 年間スケジュールのDOMフックとCSS上書き。
- スカッドの保存形式、配置計算、iOS Safariの画像生成制約。
- 公開HTML・JavaScriptのキャッシュ用バージョンクエリ（`tools/asset-versions.mjs` が内容ハッシュから生成）。
- `public/` 全体をアップロードする本番デプロイ。

## 次の構成改善

1. 公開中のロゴと背番号加工物について、利用許諾の確認または独自表現への差し替え方針を決める。
2. スカッド検証の実行時間と失敗傾向を運用後に確認し、必要なら対象の分割やキャッシュを検討する。
