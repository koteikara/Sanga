# Third-party notices

確認基準日: 2026-08-21（three.js は2026-09-10、PyMuPDF は2026-10-07、焼き付けの道具は2026-10-09に追記）

この文書は、リポジトリで利用する第三者製ソフトウェアと、そのライセンス表示の所在を記録します。公式サイト由来の画像・データ等は `docs/source-and-license.md` を参照してください。

## modern-screenshot

| 項目 | 内容 |
| --- | --- |
| パッケージ | `modern-screenshot` |
| バージョン | 4.6.5 |
| 著作権表示 | Copyright (c) 2021-present wxm |
| ライセンス | MIT License |
| 上流 | https://github.com/qq15725/modern-screenshot |
| npm | https://www.npmjs.com/package/modern-screenshot/v/4.6.5 |

利用箇所:

- `public/assets/app.js`: `https://esm.sh/modern-screenshot@4.6.5` から固定バージョンを読み込む。
- `public/assets/squad-builder.js`: `./vendor/modern-screenshot/modern-screenshot.mjs` を読み込む。
- `public/experiments/image-generation/prototype.js`: `https://esm.sh/modern-screenshot@4.6.5` を読み込む。
- `experiments/image-generation/prototype.js`: `https://esm.sh/modern-screenshot@4.6.5` を読み込む。
- `public/assets/vendor/modern-screenshot/modern-screenshot.mjs`: npmパッケージの `dist/index.mjs` を静的配置する。
- `experiments/squad-builder/vendor/modern-screenshot/modern-screenshot.mjs`: プロトタイプ用に同じファイルを静的配置する。

ライセンス全文と取得記録:

- `public/assets/vendor/modern-screenshot/LICENSE`
- `public/assets/vendor/modern-screenshot/VENDOR.md`
- `experiments/squad-builder/vendor/modern-screenshot/LICENSE`
- `experiments/squad-builder/vendor/modern-screenshot/VENDOR.md`

静的配置ファイルを更新・再配布するときは、対応する `LICENSE` と `VENDOR.md` を同じPRで更新し、著作権表示とライセンス全文を保持します。

## html-to-image

| 項目 | 内容 |
| --- | --- |
| パッケージ | `html-to-image` |
| バージョン | 1.11.11 |
| 著作権表示 | Copyright (c) 2017-2023 W.Y. |
| ライセンス | MIT License |
| 上流 | https://github.com/bubkoo/html-to-image |
| バージョン情報 | https://github.com/bubkoo/html-to-image/releases/tag/v1.11.11 |

利用箇所:

- `experiments/image-generation/prototype.js`: `https://esm.sh/html-to-image@1.11.11` から固定バージョンを読み込む。
- `public/experiments/image-generation/prototype.js`: 同じ検証用コードを配置する。

パッケージ本体はリポジトリへ同梱していません。バージョンを変更するときは、上流のライセンスと配布内容を再確認します。

## three.js

| 項目 | 内容 |
| --- | --- |
| パッケージ | `three` |
| バージョン | 0.170.0 |
| 著作権表示 | Copyright © 2010-2024 three.js authors |
| ライセンス | MIT License |
| 上流 | https://github.com/mrdoob/three.js |
| npm | https://www.npmjs.com/package/three/v/0.170.0 |
| 確認日 | 2026-09-10（npmパッケージ同梱の `LICENSE` で確認） |

利用箇所:

- `experiments/stadium-3d/prototype.html`: importmapで `https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js` と `https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/` を固定バージョンで読み込む。
- `experiments/stadium-3d/prototype.js`: `three` と `three/addons/controls/OrbitControls.js` を読み込む。
- `experiments/stadium-3d/stadium-model.js`: `three` と `three/addons/utils/BufferGeometryUtils.js` を読み込む。
- `experiments/stadium-3d/sightlines.js`: `three` と `three/addons/utils/BufferGeometryUtils.js` を読み込む。
- `experiments/stadium-3d/prototype.js`（URL に `?baked` を付けたときだけ）: `three/addons/loaders/GLTFLoader.js` と、
  meshoptimizer のデコーダー `three/addons/libs/meshopt_decoder.module.js`（three.js のパッケージに同梱。
  MIT License、Copyright (C) 2016-2022 Arseny Kapoulkine）を読み込む。
- `experiments/stadium-3d/bake/export-scene.mjs`（開発用）: ページの中で `three/addons/exporters/GLTFExporter.js` を読み込む。

パッケージ本体はリポジトリへ同梱していません。検証用プロトタイプでのみ使い、公開物（`public/`）からは読み込みません。バージョンを変更するときは、上流のライセンスと配布内容を再確認します。

## PyMuPDF（同梱しない開発用ツール）

| 項目 | 内容 |
| --- | --- |
| パッケージ | `pymupdf`（PyPI） |
| 確認したバージョン | 1.28.2 |
| ライセンス | GNU AGPL v3.0、またはArtifexの商用ライセンス |
| 上流 | https://github.com/pymupdf/PyMuPDF |
| 確認日 | 2026-10-07 |

利用箇所:

- `experiments/stadium-3d/extract/build_layout.py`、`experiments/stadium-3d/extract/seatpages.py`: 座席図のPDFから
  図形を読むために `import pymupdf` する。座席データ `experiments/stadium-3d/layout.json` を作り直すときだけ、
  作業者が手元の仮想環境に入れて実行する。

リポジトリには同梱せず、`package.json` の依存にもしていません。画面（`prototype.html`）や検証コマンドからは
使いません。生成物の `layout.json` はPyMuPDFのコードを含みません。AGPLの条件が関わるのは、PyMuPDFを組み込んだ
ものを配布・提供する場合です。このスクリプトをPyMuPDFと一緒に配布したり、サーバーで提供したりする場合は、
その時点で条件を確認します。

## 3D モデルの焼き付けに使う道具（同梱しない開発用ツール）

座席ビューの焼き付け版（`experiments/stadium-3d/baked/stadium-baked.glb`）を作るときだけ、作業者が手元に入れて使います。
リポジトリには同梱せず、`package.json` の依存にもしていません。画面や検証コマンドからは使いません。
生成物の GLB には、これらの道具のコードは含まれません。

| 道具 | 確認したバージョン | ライセンス | 上流 | 使うところ |
| --- | --- | --- | --- | --- |
| Blender（Python モジュール `bpy`） | 4.2.0 | GNU GPL v3.0 | https://www.blender.org/ | `experiments/stadium-3d/bake/bake_ao.py`、`build_stands.py`（形の読み込み、陰影の焼き付け、glTF の書き出し） |
| glTF Transform（`@gltf-transform/cli`） | 4.5.1 | MIT License | https://gltf-transform.dev/ | 焼き付けた GLB の形を meshopt で圧縮する |
| Playwright | リポジトリの検証と同じもの | Apache License 2.0 | https://playwright.dev/ | `experiments/stadium-3d/bake/export-scene.mjs`（ブラウザでモデルを組み立てて書き出す） |

確認日: 2026-10-09（各パッケージの記載で確認）。

## フォント

年間スケジュールと予想スカッドのCSS、画像生成元HTMLは、利用環境のシステムフォントを候補として指定しています。同梱しているフォントは次の1件です。

| 項目 | 内容 |
| --- | --- |
| フォント | DM Serif Display（latinサブセット） |
| 著作権表示 | Copyright 2014-2018 Adobe（Reserved Font Name 'Source'）、Copyright 2019 Google LLC |
| ライセンス | SIL Open Font License 1.1 |
| 上流 | https://fonts.google.com/specimen/DM+Serif+Display |

利用箇所:

- `public/assets/timeline.css`: `public/assets/dm-serif-display-latin.woff2` を `@font-face` で読み込む（SUPPORTER TIMELINE の題）。
- `experiments/supporter-timeline/prototype.css`: 検証用プロトタイプで同じファイルを読み込む。

ライセンス全文:

- `public/assets/dm-serif-display-OFL.txt`
- `experiments/supporter-timeline/assets/dm-serif-display-OFL.txt`

フォントファイルを追加する場合は、配布可能なライセンスかを確認し、ライセンス文書と取得元を同じPRで追加します。

## リポジトリ自体のライセンス

確認基準日時点で、リポジトリ直下にプロジェクト全体へ適用する `LICENSE` はありません。この文書は、プロジェクト独自のコード・文書・画像について利用許諾を付与するものではありません。

プロジェクト全体へオープンソースライセンスを設定する場合は、権利者と対象範囲を確認した上で別PRにします。第三者素材には、その素材固有の権利条件が引き続き適用されます。
