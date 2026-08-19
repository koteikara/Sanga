# modern-screenshot（静的配置）

* バージョン: 4.6.5
* 取得元: npm registry（`npm pack modern-screenshot@4.6.5`）
* 配置ファイル: `modern-screenshot.mjs`（npmパッケージ内 `dist/index.mjs` をそのままコピー。外部importなしの単一ESMファイル）
* ライセンス: MIT License（`LICENSE` ファイル参照）
* 取得日: 2026-08-18
* 備考: `public/assets/app.js`（年間スケジュールページ）では同バージョンをesm.sh CDN経由で読み込んでいるが、
  本ディレクトリでは `docs/image-generation-research.md` の方針に沿い、CDNに依存しない静的配置とする。
