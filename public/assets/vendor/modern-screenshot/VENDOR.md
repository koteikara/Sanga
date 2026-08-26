# modern-screenshot（静的配置）

* バージョン: 4.6.5
* 取得元: npm registry（`npm pack modern-screenshot@4.6.5`）
* 配置ファイル: `modern-screenshot.mjs`（npmパッケージ内 `dist/index.mjs` をそのままコピー。外部importなしの単一ESMファイル）
* ライセンス: MIT License（`LICENSE` ファイル参照）
* 取得日: 2026-08-18
* 備考: 年間スケジュール（`public/assets/app.js`）と予想スカッド（`public/assets/squad-builder.js`）の
  両方が、このファイルを読み込む。`docs/image-generation-research.md` の方針に沿い、CDNに依存しない。
* 経緯: 以前は年間スケジュールだけがesm.sh CDNから読んでいた。**トップレベルの静的importだったため、
  CDNへ到達できない環境ではモジュール全体が評価されず、画像共有どころか日程表が一切描画されなかった。**
  ヘッドレスブラウザでの撮影中に判明し、静的配置へ切り替えた。
  CDNへ戻すと `tools/validate-app-contract.js` が落ちる。
