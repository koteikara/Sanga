# PLAN.md

## 状態

進行中: 求・譲 投稿ツールの作り直し。プロトタイプまで完了、本番移植は未着手。

## 2026-09-09 作業計画 — 求・譲 投稿ツールの作り直し

### 作業テーマ

見つけてもらえない投稿を出力していたツールを、実在するタグと実際の書き方に合わせて作り直す。

### 変更対象

`docs/trade-post-design.md`（新規）、`experiments/trade-post/`（新規）、
`docs/production-inventory-audit.md`、`docs/roadmap.md`、`docs/project-structure.md`、
`docs/ai/GOAL.md`、`docs/ai/PLAN.md`

### 影響範囲

このPRでは公開ページに影響なし。`public/` を変更しない。

### 実装手順

1. 現行ツールの調査と、他ジャンルの成功例の調査 — 完了
2. Xでの交換の実態調査（実在タグと投稿の書き方の確認） — 完了
3. 設計文書 `docs/trade-post-design.md` — 完了
4. プロトタイプ `experiments/trade-post/` — 完了
5. 商品マスタの正式名称確認 — **未完了。人の目で確認が必要**
6. iPhone Safariでの実機確認 — **未完了**
7. 本番移植 — 別PR

### 検証方法

- Chromium 390pxでの操作確認（横スクロール、タップ対象、出力文、検索リンク）— 完了
- `node --check experiments/trade-post/prototype.js` — 完了
- `npm run check` — 公開物を変更していないため差分なしを確認

### 更新する文書

上記「変更対象」のとおり。

### 変更しないもの

`public/` 配下すべて。プロトタイプ段階のため（`docs/ui-prototype-workflow.md`）。

### 別PRへ分けるもの

- 本番移植（`public/TradePost/`）
- `public/data/goods.json` の追加
- `TradePost/` に `index.html` がない問題（`docs/production-inventory-audit.md` の未解決課題）

AI作業効率（読み込みトークン量と手戻り）の未対応課題は `docs/ai/EFFICIENCY-BACKLOG.md` に保管しています。

過去の計画は `docs/archive/ai/PLAN-2026-06-22_to_2026-07-09.md` に保管しています。

## 計画作成ルール

1. `AGENTS.md` と変更対象別の必読文書を読む。
2. `docs/ai/GOAL.md` で目的と完了条件を固定する。
3. 変更対象、影響範囲、検証、文書更新を小さな手順へ分ける。
4. 実装しない事項と別PRへ分ける事項を明示する。
5. 完了後は結果を `docs/ai/WORKLOG.md` に記録し、このファイルを次の作業に備えて整理する。

## テンプレート

```markdown
## YYYY-MM-DD 作業計画

### 作業テーマ

### 変更対象

### 影響範囲

### 実装手順

1.
2.
3.

### 検証方法

### 更新する文書

### 変更しないもの

### 別PRへ分けるもの
```
