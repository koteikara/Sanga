# GOAL.md

## 状態

進行中: 求・譲 投稿ツールの作り直し（2026-09-09〜）。

過去の目標は `docs/archive/ai/GOAL-2026-06-22_to_2026-07-09.md` に保管しています。

## 2026-09-09 求・譲 投稿ツールの作り直し

### 目的

`public/TradePost/index-v1.html` がほぼ使われていない原因を取り除く。原因は投稿が誰にも見つからない形で
出力されていたこと（実在しないタグ `#京都サンガ交換希望` の出力、譲・求が自由文1行）。
実在するタグと、実際の投稿の書き方（商品×背番号、受け渡しは試合）に合わせ、探す側も持たせる。

### 対象

- 新規: `docs/trade-post-design.md`、`experiments/trade-post/`
- 更新: `docs/production-inventory-audit.md`、`docs/roadmap.md`、`docs/project-structure.md`

### 変更しないもの

- `public/` 配下すべて（プロトタイプ段階のため。`docs/ui-prototype-workflow.md`）
- `public/data/players.json`、`matches.json`（プロトタイプはスナップショットを複製して読む）
- 他ページのLocalStorageキーと保存形式

### 完了条件

プロトタイプ段階: 設計文書とプロトタイプがあり、スマホ幅で操作でき、実在タグだけを出力する。
本番移植: 別PR。商品マスタの正式名称確認と実機確認のあと。

### 中止・確認条件

- 商品の正式名称が公式表記と食い違う場合は、`goods.json` を直してから移植する。
- チケットの求・譲は対象外（特定興行入場券。`docs/trade-post-design.md`「対象外」）。

## Durable Goal

京都サンガF.C.の非公式Webツールを、既存データ、LocalStorage互換性、スマートフォン表示、アクセシビリティを守りながら継続的に改善します。

プロジェクト共通の制約は `AGENTS.md`、文書の管理基準は `docs/documentation-policy.md` を正とします。

## タスク開始時に記載すること

- 作業目的
- 対象ファイル
- 変更しないもの
- 利用者への効果
- 完了条件
- 中止・確認が必要になる条件

## テンプレート

```markdown
## YYYY-MM-DD 作業目的

### 目的

### 対象

### 変更しないもの

### 完了条件

### 中止・確認条件
```

完了後はこのファイルから終了したタスクを外し、必要な記録を `docs/ai/WORKLOG.md` へ残します。
