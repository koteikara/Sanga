# 本番公開物の棚卸し

確認基準日: 2026-08-26

## 索引

| 知りたいこと | 節 |
| --- | --- |
| 何を公開しているか | 公開ページ一覧 |
| どのファイルが使われているか | 参照されていないファイル |
| このとき決めたこと | 棚卸しで決めたこと |
| 残っている課題 | 未解決の課題 |
| 同じ調査をやり直す方法 | 調査方法 |

この文書は、本番サーバー上のファイルをリポジトリへ取り込んだ時点（2026-08-26）で、公開物の全体像を整理した記録です。取り込みの手順は `docs/production-import.md`、本番反映は `docs/deploy-policy.md` を参照してください。

## 経緯

本番サーバーにはリポジトリ外で直接置いたファイルがあり、FTP同期の管理外のまま取り残されていました。取り込みワークフローで88件を `public/` へ取り込み、正本をリポジトリに一本化した直後に、公開物全体を棚卸ししたものです。

取り込み時点の内訳は、管理済み83件 / 取り込み88件 / 除外1件（`.ftp-deploy-sync-state.json`）でした。

## 公開ページ一覧

`public/` 配下のHTMLは9件です。「導線」は、リポジトリ内の他ページからリンクされているかを示します。被リンクがないページも、URLを知っていれば到達できます。

| ページ | 内容 | 導線 | 扱い |
| --- | --- | --- | --- |
| `sanga202627season.html` | 年間スケジュール（現行） | `index.html` | 現行 |
| `squad.html` | 予想スカッド作成（現行） | `index.html` | 現行 |
| `index.html` | 確認用トップ。現行2ページへの導線 | 直URL | 現行 |
| `sanga2025season.html` | 2025シーズンの日程 | `sanga2025.html` | 維持 |
| `sanga2025.html` | `sanga2025season.html` への3秒リダイレクト | 被リンクなし | 維持 |
| `sanga_slides.html` | 「選手が思う"サンガのみりょく"」 | 被リンクなし | 維持 |
| `TradePost/index-v1.html` | 求・譲 投稿フォーマット生成ツール | 被リンクなし | 維持 |
| `experiments/bench-emphasis/prototype.html` | ベンチ強調オプションの検証 | 被リンクなし | 本番公開から除外 |
| `experiments/image-generation/prototype.html` | 画像生成ライブラリの検証 | 被リンクなし | 本番公開から除外 |

被リンクのない旧ページは、SNSなどで直接URLが共有されている可能性があるため維持します。リンク切れを避けるためであり、現行機能として保守する対象ではありません。

## 旧ページが使うアセット

現行2ページとは別系統です。

| ファイル | 用途 |
| --- | --- |
| `public/img/`（40件） | 背番号画像 318×74（2倍解像度）、`back.png`、`header.png`。`sanga2025season.html` と `public/style.css` が参照 |
| `public/style.css` | 旧ページ用のスタイル。`img/back.png` を背景に使う |
| `public/script.js` | 旧ページ用のスクリプト |
| `public/TradePost/style.css`、`script.js` | 求・譲ツール用 |

## 参照されていないファイル

`public/` 配下の全ファイルについて、HTML・CSS・JavaScript からの参照を機械的に追跡した結果です。テンプレートリテラルで組み立てる `assets/players/<背番号>.webp` は動的参照として参照済みに数えています。

| ファイル | 判定 |
| --- | --- |
| `public/images/`（39件） | **削除済み。** 等倍版（159×37）の旧背番号画像。参照元なし |
| `public/default_page.png` | 780×577。レンタルサーバーの初期ページ用と見られる。参照元なし |
| `public/data/matches.sample.json` | 検証・フォールバック用のサンプル |
| `public/data/hotel-index.json` | 0件。ホテル機能は画面未実装 |
| `public/data/hotels/.gitkeep` | 空ディレクトリ保持用 |
| `public/assets/vendor/modern-screenshot/LICENSE`、`VENDOR.md` | 第三者ソフトウェアの権利表示。配信不要だが削除しない |
| `public/.htaccess` | `.mjs` のMIME type設定。サーバー設定として必要 |
| `public/.nojekyll` | GitHub Pages用 |

`public/images/` は、同名39件すべてが `public/img/` と内容の異なる等倍版で、参照元がリポジトリ内に存在しませんでした。棚卸しの判断として削除しています。復元が必要な場合はこのコミットの親から取得できます。

## 棚卸しで決めたこと

### 1. `public/images/` を削除する

未参照の等倍版アセット39件（528KB）。次回の本番デプロイでサーバーからも削除されます。

### 2. `experiments/` を本番公開から外す

`public/experiments/` は本番サーバーで誰でもアクセスできる状態でしたが、`docs/project-structure.md` は `experiments/` を「公開前の検証用。公開物の正本ではない」としており、方針と実態が食い違っていました。

`.github/workflows/deploy-production.yml` のFTPアップロードで `experiments/**` を除外します。GitHub Pagesは `public` をそのまま配信するため、確認環境では引き続き参照できます。

FTP同期はサーバー上の状態ファイルを基準に差分を反映するため、除外したファイルは次回デプロイで削除される見込みです。反映後にサーバー上を確認し、残っている場合は手動で削除します。

### 3. 被リンクのない旧ページは維持する

`sanga2025.html`、`sanga2025season.html`、`sanga_slides.html`、`TradePost/index-v1.html` は、直URLで共有されている可能性を考慮して残します。現行機能ではないため、仕様変更や改修の対象にはしません。

## 未解決の課題

### `public/experiments/` がルートの `experiments/` と食い違っている

`public/experiments/` はルート `experiments/` の部分コピーで、内容がずれています。

| 対象 | 状態 |
| --- | --- |
| `bench-emphasis` | 両者の内容は一致 |
| `image-generation` | `prototype.html`、`prototype.css`、`prototype.js` が相違。`README.md` は `public/` 側にない |
| `squad-builder` | ルートのみに存在 |

どちらが新しいかは未確認です。本番公開から外したことで公開範囲の問題は解消しましたが、二重管理は残っています。プロトタイプを触るときに、どちらを正本にするか決めてください。

### `TradePost/` に `index.html` がない

ファイル名が `index-v1.html` のみのため、`/TradePost/` でアクセスしても目的のページに到達しません。`v2` は存在しません。維持の判断をしたページなので、到達性を直すかどうかは別途検討します。

### `default_page.png` の出所

レンタルサーバーの初期ファイルと見られますが確証がありません。参照元がないため、サーバー側の既定ページが使っている可能性を確認してから削除を判断します。

## 調査方法

参照関係は、`public/` 配下のHTML・CSS・JavaScriptから次を抽出して追跡しました。

- `src=` / `href=` 属性
- CSSの `url()`
- ES Moduleの `from "..."`
- 文字列リテラル中の資材パス（`.png`、`.css`、`.js`、`.json` など）

いずれもバージョンクエリ（`?v=...`）を取り除いてから解決します。テンプレートリテラルで組み立てるパスは機械的に追えないため、`assets/players/` のように基点ディレクトリ単位で参照済みとして扱いました。同じ調査をやり直す場合は、この前提を引き継いでください。
