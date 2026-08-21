# Third-party notices

確認基準日: 2026-08-21

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

## フォント

リポジトリ内にフォントファイルやWebフォントの同梱はありません。CSSと画像生成元HTMLは利用環境のシステムフォントを候補として指定しています。フォントファイルを追加する場合は、配布可能なライセンスかを確認し、ライセンス文書と取得元を同じPRで追加します。

## リポジトリ自体のライセンス

確認基準日時点で、リポジトリ直下にプロジェクト全体へ適用する `LICENSE` はありません。この文書は、プロジェクト独自のコード・文書・画像について利用許諾を付与するものではありません。

プロジェクト全体へオープンソースライセンスを設定する場合は、権利者と対象範囲を確認した上で別PRにします。第三者素材には、その素材固有の権利条件が引き続き適用されます。
