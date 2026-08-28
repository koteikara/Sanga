# AGENTS.md

## プロジェクト概要

京都サンガF.C.に関する次の非公式Webツールを管理します。

- 年間スケジュール: `public/sanga202627season.html`
- 予想スカッド作成: `public/squad.html`
- 将来機能のプロトタイプ・生成・検証ツール

本番公開先はスターレンタルサーバーです。GitHub Pagesは確認環境、本番反映はGitHub Actionsの手動ワークフローです。

## 最重要ルール

- 日程、節番号、対戦相手、会場、時刻、選手データを明示的な依頼なしに変更しない。
- LocalStorageの既存キー・保存形式を移行方針なしに変更しない。
- 既存利用者の表示設定、カード状態、スカッド保存データを壊さない。
- スマートフォン表示とアクセシビリティを悪化させない。
- 変更は小さく分け、無関係な整形や全面書き換えを避ける。
- 本番デプロイは明示的な指示がある場合だけ実行する。
- 認証情報、`.env`、秘密鍵、サービスアカウントJSONを保存・公開しない。

## 文書の引き方

無条件で読むのは次の3つだけです。

1. `AGENTS.md`
2. `docs/documentation-policy.md`
3. `docs/project-structure.md`

それ以外は**全文を読まず、必要な節を引きます。** 主要な文書は冒頭に索引を置いてあります。
変更対象別の引き先は次のとおりです。

| 変更対象 | 引く文書 |
| --- | --- |
| 全般・PR | `README.md`、`docs/codex-workflow.md`、`docs/parallel-work-policy.md` |
| 年間スケジュールUI | `docs/dom-inventory.md`、`docs/display-modes.md`、`docs/filtering.md`、`docs/ai/JS_CHANGE_CHECKLIST.md`、`docs/ai/BROWSER_CHECKLIST.md` |
| 日程データ・CSV | `docs/data-schema.md`、`docs/sheets/schedule-columns.md`、`docs/operation-flow.md`、`docs/schedule-audit.md` |
| 予想スカッド | `docs/squad-builder.md`、`docs/players-data-schema.md`、`docs/ai/SQUAD_BROWSER_CHECKLIST.md` |
| LocalStorage | `docs/personalization.md`、`docs/dom-inventory.md`、対象機能の仕様書 |
| Actions・本番反映 | `docs/deploy-policy.md`、`docs/operation-flow.md` |
| 本番サーバーからの取り込み | `docs/production-import.md`、`docs/deploy-policy.md` |
| 公開物の全体像・過去の公開ページ | `docs/production-inventory-audit.md` |
| 入口ページ・ツール一覧 | `docs/site-index.md`、`docs/ui-prototype-workflow.md` |
| 新機能・大きなUI変更 | `docs/roadmap.md`、`docs/ui-prototype-workflow.md` |
| SUPPORTER TIMELINE | `docs/supporter-timeline-design.md`（「現在地と次の一手」から読む）、`experiments/supporter-timeline/README.md` |
| 公式サイトからの情報取得 | `docs/news-extraction-research.md`、`docs/supporter-timeline-design.md` の「公式サイトの利用条件」 |

`docs/dom-inventory.md` は `tools/generate-dom-inventory.mjs` が実装から生成します。
class名、id名、data属性の参照箇所は、文書を読むよりこの一覧と `grep` で確認するほうが確実です。

`docs/archive/` は当時の記録であり、現行仕様ではありません。仕様や現状を調べるときの検索対象から
外し、参照する場合も「過去の経緯」としてのみ扱います。現行の答えは必ず現行文書か実装で確認します。

## ドキュメント更新ルール

- 実装や運用を変更した場合は、同じPRで対応する現行文書を更新する。
- 数値、ファイル名、コマンド、状態は実装と自動検証を確認して記載する。
- 過去のWORKLOGや完了済み計画は、当時の記録として書き換えない。
- 古い仕様を残す場合は「履歴」「廃止」「置き換え済み」を冒頭で明示する。
- 現在仕様を末尾への追記だけで表現せず、冒頭の概要・状態も更新する。
- 新規文書の前に既存文書へ統合できないか確認する。
- PR完了時に、文書更新の有無と理由を報告する。

- 自動生成される文書（`docs/dom-inventory.md`）は手で編集せず、生成コマンドを実行して結果をコミットする。

詳細は `docs/documentation-policy.md` を正とします。

## 現在の正本

- 日程: `public/data/matches.json`（57件）
- 選手: `public/data/players.json`（39件）
- `docs/sheets/schedule.initial.csv` は2026年6月22日時点の49件スナップショットであり、現在値ではない。
- 公開情報更新時は可能な限り出典URLと確認日を残す。
- 不確定情報は `tentative`、候補日、注記で明示する。
- 公開JSONへ個人メモ、運用者メモ、認証情報を含めない。

## 実装上の保護事項

- class名、id名、data属性は参照箇所を確認してから変更する。
- CSSの統合・並べ替えは既存上書きの意図を確認する。
- JavaScript変更は既存LocalStorageデータとの互換性を保つ。
- 公開CSS/JS変更時は `npm run fix:asset-versions` で内容ハッシュ版数を揃える。
- スカッドの画像化対象 `#canvas` 内では、iOS Safari対策として `box-shadow` と `filter: drop-shadow` を追加しない。
- 意味のあるHTML要素を使い、キーボード操作とフォーカス表示を保つ。
- 色だけに依存せず、操作対象は原則44px程度を確保する。
- ダイアログはフォーカス、Esc、背景操作、背面スクロールを確認する。

## 基本検証

検証コマンドは `package.json` に集約しています。GitHub Actionsも同じスクリプトを呼ぶため、
手元とCIで検証内容がずれません。追加の依存はなく、Node.js 20があれば実行できます。

| コマンド | 対象 |
| --- | --- |
| `npm run check` | 下記すべて |
| `npm run check:static` | 日程ページ（データ・JS契約・公開アセット）と本番取り込みスクリプト |
| `npm run check:squad` | 予想スカッド（JS構文・選手データ・静的契約） |
| `npm run check:squad:browser` | スカッドの実ブラウザレイアウト（Playwright必須） |
| `npm run check:tools` | 本番取り込みスクリプト（JS構文と、検証用FTPサーバーを使った動作確認）。`check:static` から呼ぶ |

`npm run check:squad:browser` はPlaywrightを利用できる環境でのみ実行します。GitHub ActionsはPR時と
本番デプロイ前に、3画面幅・4種類の控え人数・17フォーメーション・8スタイルの組み合わせをChromiumで
検証します。iPhone Safari等の実機確認は `docs/ai/SQUAD_BROWSER_CHECKLIST.md` に従います。

検証内容を増減する場合は `package.json` のスクリプトを変更します。ワークフローYAMLへ検証コマンドを
直接書き足さないでください。

## 作業とPR

1. 必読文書を確認する。
2. 変更対象、影響範囲、変更しないものを整理する。
3. 必要に応じて `docs/ai/GOAL.md` と `docs/ai/PLAN.md` を更新する。
4. 小さな単位で変更し、対象別検証を行う。
5. 実装と現行文書を同期する。
6. 必要に応じて `docs/ai/WORKLOG.md` に記録する。
7. 変更ファイル、確認結果、未確認事項、残課題、人間が確認すべき点を報告する。

PRタイトル、本文、Summary、Testing、作業後の報告は日本語で記載します。ドキュメントのみのPRでは `public/` を変更しません。本番反映はPRマージと分けます。
