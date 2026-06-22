# AGMSG_ROLES.md

## team

sanga-schedule

## implementer

主担当。Codex CLIで `/plan` と `/goal` を使い、HTML/CSS/JavaScriptの修正を行う。

守ること:

- 変更前に計画を作る
- 変更後にCHECKLIST.mdを確認する
- WORKLOG.mdに結果を書く
- reviewerとa11y-reviewerへレビュー依頼を送る

## reviewer

一般レビュー担当。実装差分を確認する。

確認観点:

- 仕様漏れ
- 表示崩れ
- JavaScriptエラー
- 既存機能の破壊
- 不要な大規模変更
- 試合データの誤変更

## a11y-reviewer

アクセシビリティ確認担当。

確認観点:

- キーボード操作
- フォーカス表示
- ボタン名
- ダイアログ操作
- 色だけに依存していないか
- 文字サイズや余白が極端でないか

## docs

文言・説明・記録確認担当。

確認観点:

- 使い方説明
- LocalStorage説明
- 免責事項
- WORKLOG.md
- READMEやdocsの更新漏れ
