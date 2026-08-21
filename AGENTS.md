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

## 作業前の必読文書

すべての実装者は最初に次を読みます。

1. `AGENTS.md`
2. `docs/documentation-policy.md`
3. `docs/project-structure.md`
4. 下表の変更対象に対応する文書

| 変更対象 | 必読文書 |
| --- | --- |
| 全般・PR | `README.md`、`docs/codex-workflow.md` |
| 年間スケジュールUI | `docs/html-analysis.md`、`docs/css-inventory.md`、`docs/js-inventory.md`、`docs/ai/CHECKLIST.md`、`docs/ai/BROWSER_CHECKLIST.md` |
| 日程データ・CSV | `docs/data-schema.md`、`docs/sheets/schedule-columns.md`、`docs/operation-flow.md`、`docs/schedule-audit.md` |
| 予想スカッド | `docs/squad-builder.md`、`docs/players-data-schema.md`、`docs/ai/SQUAD_BROWSER_CHECKLIST.md` |
| LocalStorage | 対象機能の仕様書、`docs/personalization.md`、関連チェックリスト |
| Actions・本番反映 | `docs/deploy-policy.md`、`docs/operation-flow.md` |
| 新機能・大きなUI変更 | `docs/roadmap.md`、`docs/ui-prototype-workflow.md` |

## ドキュメント更新ルール

- 実装や運用を変更した場合は、同じPRで対応する現行文書を更新する。
- 数値、ファイル名、コマンド、状態は実装と自動検証を確認して記載する。
- 過去のWORKLOGや完了済み計画は、当時の記録として書き換えない。
- 古い仕様を残す場合は「履歴」「廃止」「置き換え済み」を冒頭で明示する。
- 現在仕様を末尾への追記だけで表現せず、冒頭の概要・状態も更新する。
- 新規文書の前に既存文書へ統合できないか確認する。
- PR完了時に、文書更新の有無と理由を報告する。

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
- 公開CSS/JS変更時は対象HTMLのバージョンクエリを確認する。
- スカッドの画像化対象 `#canvas` 内では、iOS Safari対策として `box-shadow` と `filter: drop-shadow` を追加しない。
- 意味のあるHTML要素を使い、キーボード操作とフォーカス表示を保つ。
- 色だけに依存せず、操作対象は原則44px程度を確保する。
- ダイアログはフォーカス、Esc、背景操作、背面スクロールを確認する。

## 基本検証

日程ページ:

```bash
node tools/validate-matches.js
node tools/validate-generated-matches.js public/data/matches.json --expected-count 57 --strict
node --check public/assets/app.js
node tools/validate-app-contract.js
```

予想スカッド:

```bash
node --check public/assets/squad-builder.js
node --check public/assets/squad-formations.js
node --check public/assets/squad-sample-players.js
node tools/validate-players.js
node tools/validate-squad-contract.mjs
```

Playwrightを利用できる環境では `node tools/check-squad-layout.mjs` も実行します。GitHub ActionsはPR時と本番デプロイ前に、3画面幅・4種類の控え人数・17フォーメーション・8スタイルの組み合わせをChromiumで検証します。iPhone Safari等の実機確認は `docs/ai/SQUAD_BROWSER_CHECKLIST.md` に従います。

## 作業とPR

1. 必読文書を確認する。
2. 変更対象、影響範囲、変更しないものを整理する。
3. 必要に応じて `docs/ai/GOAL.md` と `docs/ai/PLAN.md` を更新する。
4. 小さな単位で変更し、対象別検証を行う。
5. 実装と現行文書を同期する。
6. 必要に応じて `docs/ai/WORKLOG.md` に記録する。
7. 変更ファイル、確認結果、未確認事項、残課題、人間が確認すべき点を報告する。

PRタイトル、本文、Summary、Testing、作業後の報告は日本語で記載します。ドキュメントのみのPRでは `public/` を変更しません。本番反映はPRマージと分けます。
