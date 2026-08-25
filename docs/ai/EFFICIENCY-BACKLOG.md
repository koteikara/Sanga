# AI作業効率の改善バックログ

状態: 起票分はすべて対応済み（2026-08-25 起票 / 2026-08-25 完了）

AIエージェントがこのリポジトリで作業するときの、読み込みトークン量と手戻りを減らすための課題一覧です。
「毎回必ず発生するコスト」を減らすことを目的とし、機能追加は扱いません。

## 前提として測った規模

| 対象 | 規模 |
| --- | --- |
| 実装コード（HTML・JS・CSS） | 約5,900行 |
| `docs/*.md`（現行文書のみ、直下） | 約5,900行 |
| `docs/ai/` | 約520行 |
| `docs/` 全体 | 約1.4MB |

実装量と現行文書量がほぼ同じです。文書が増えるほど、変更1件あたりの読み込みコストが上がります。

## 対応済み

### 1. 検証コマンドを1コマンドへ集約（完了）

`package.json` に `npm run check` 系を用意し、`AGENTS.md`、`README.md`、`docs/project-structure.md`、
`docs/codex-workflow.md`、3つのワークフローYAMLがすべて同じスクリプトを参照するようにしました。
CIのステップ内に直書きしていたCSS波括弧数チェックとHTML参照チェックは
`tools/check-static-assets.mjs` へ移し、手元でも同じ検証が動きます。

効果: 必読文書からコマンド羅列が消える、実行漏れが起きない、CIと手元の定義が一本化される。

### 2. `docs/archive/` を調査対象から外す明示（完了）

`AGENTS.md` の必読文書節に、`docs/archive/` は現行仕様ではなく検索対象から外す旨を明記しました。
`docs/archive/ai/WORKLOG-2026-06-22_to_2026-07-09.md` は単体で2,178行あり、全文検索すると
現行仕様と過去記録が区別なくヒットします。

### 3. `docs/ai/JS_CHANGE_CHECKLIST.md` の圧縮とスクリプト移管（完了）

199行から121行へ縮小しました。判断基準は「スクリプトで検証できる項目は文書に残さない」です。

`tools/validate-app-contract.js` が既に検証していた項目（LocalStorageキー、JSON読み込みパス、
表示列・表示モード・フィルタの値とラベルとCSSクラス、カード状態、共有画像の状態クラス）は
文書から削り、「自動検証で確認済み。目視で再確認しない」と1か所にまとめました。
唯一自動化されていなかった `PANEL_CLOSE_DELAY_MS=240` は契約チェックへ追加しました。

残したのは、実際に操作しないと分からない項目と、人間の判断が必要な項目だけです。

### 4. `*-inventory.md` の自動生成化または廃止（完了）

`tools/generate-dom-inventory.mjs` を追加し、`public/assets/app.js` と `squad-builder.js` から
参照しているid・class・data属性・aria属性・LocalStorageキーを抽出して
`docs/dom-inventory.md` を生成するようにしました。`npm run check:static` が `--check` で
実装との差分を検出するため、ずれたまま放置されません。

手書きの棚卸し3本は、内容の大半が整理作業前の調査と日付つきの作業メモだったため、
冒頭に履歴である旨を明記して `docs/archive/implementation/` へ移しました。

- `docs/js-inventory.md`（431行）
- `docs/css-inventory.md`（348行）
- `docs/html-analysis.md`（265行）

LocalStorageの保存形式と既定値は `docs/personalization.md` が既に正本だったため、
移動によって失われた現行情報はありません。

### 5. `AGENTS.md` の必読表を索引方式へ（完了）

「作業前の必読文書」を「文書の引き方」へ変更し、無条件で読むのは3文書だけと明示しました。
残りは全文を読まず必要な節を引く形にし、主要7文書の冒頭へ「索引」表を追加しました。

- `docs/data-schema.md`、`docs/filtering.md`、`docs/squad-builder.md`、`docs/display-modes.md`、
  `docs/operation-flow.md`、`docs/deploy-policy.md`、`docs/personalization.md`

UI変更時の引き先からは、廃止した棚卸し3本を外し、`docs/dom-inventory.md` を入れました。

### 6. ブランチとPRの1対1化（完了）

`docs/parallel-work-policy.md` へ「3. 1PR = 1ブランチにする」を追加しました。
マージ済みブランチへ追加コミットを積まず、続きは最新 `main` から新しいブランチで始めます。

## 今後の課題

現時点で未対応の課題はありません。新しい課題が出たらこの節へ追記します。

判断基準として、次の2点を残しておきます。

- 自動検証に落とせる項目を文書へ書かない。二重管理は必ずずれ、ずれた文書は無い文書より害が大きい。
- 実装から機械的に導ける一覧は生成物にする。手書きの一覧は放置コストが高い。
