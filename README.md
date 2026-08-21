# Sanga

京都サンガF.C.に関する非公式ファン向けWebツールを管理するリポジトリです。

## 公開サイト

- 年間スケジュール: https://sangasanga.stars.ne.jp/sanga202627season.html
- 予想スカッド作成: https://sangasanga.stars.ne.jp/squad.html

いずれも非公式ページです。正確な日程・選手情報は公式情報を確認してください。

## 現在の状態

確認基準日: 2026-08-21

- 年間スケジュールは `public/data/matches.json` の57試合を表示します。
- 予想スカッドは `public/data/players.json` の39件を使い、9:16のPNGをブラウザ内で生成します。
- `public/data/hotel-index.json` と `tools/hotels/` はホテル候補連携の基盤ですが、実データ公開と画面表示は未実装です。
- `experiments/` は公開前の検証用、`public/` は本番公開物の正本です。
- GitHub Pagesは本番反映前の確認環境です。
- 本番反映はGitHub Actionsの手動ワークフローから行い、自動デプロイはしません。

## 主な構成

```text
/
├─ .github/workflows/      静的検証、Pages、手動本番デプロイ
├─ docs/                   仕様、運用、チェックリスト、調査・履歴
├─ experiments/            公開前のプロトタイプ
├─ public/                 本番公開するHTML、CSS、JS、JSON、画像
└─ tools/                  生成・検証・画像加工スクリプト
```

詳細は `docs/project-structure.md` を参照してください。

## 実装前の必読文書

実装者は最初に次を読みます。

1. `AGENTS.md`
2. `docs/documentation-policy.md`
3. `docs/project-structure.md`
4. `AGENTS.md` が変更対象別に指定する仕様書・手順書・チェックリスト

実装や運用を変更した場合は、同じPRで現行文書も更新します。

## 日程データ更新

標準手順は `docs/operation-flow.md`、列定義は `docs/sheets/schedule-columns.md` を参照してください。

```bash
node tools/validate-matches.js
node tools/validate-generated-matches.js public/data/matches.json --expected-count 57 --strict
```

`docs/sheets/schedule.initial.csv` は2026年6月22日時点の49件スナップショットです。現在データとしてそのまま使わず、`public/data/matches.json` から再生成してください。

## 予想スカッド

現在仕様は `docs/squad-builder.md`、選手データは `docs/players-data-schema.md`、ブラウザ確認は `docs/ai/SQUAD_BROWSER_CHECKLIST.md` を参照してください。

```bash
node --check public/assets/squad-builder.js
node --check public/assets/squad-formations.js
node --check public/assets/squad-sample-players.js
node tools/validate-players.js
```

実行可能な環境では `node tools/check-squad-layout.mjs` も実行します。本番デプロイ前のスカッド検証をGitHub Actionsへ追加する作業は別PRで検討します。

## 本番反映

`docs/deploy-policy.md` に従います。本番デプロイは明示的な指示がある場合だけ実行し、`public/` 配下だけをアップロードします。認証情報はGitHub Secretsで管理し、リポジトリやログへ書きません。

## 主要文書

- プロジェクト構成: `docs/project-structure.md`
- 開発ロードマップ: `docs/roadmap.md`
- ドキュメント管理方針: `docs/documentation-policy.md`
- 実装共通ルール: `docs/codex-workflow.md`
- 日程データ定義: `docs/data-schema.md`
- 日程更新手順: `docs/operation-flow.md`
- 本番反映手順: `docs/deploy-policy.md`
- 予想スカッド仕様: `docs/squad-builder.md`

## 基本方針

- スマートフォンでの使いやすさとアクセシビリティを重視します。
- 個人状態はLocalStorageに保存し、公開JSONへ含めません。
- 公開情報には可能な限り出典URLと確認日を残します。
- 認証情報、秘密鍵、`.env`、サービスアカウントJSONをコミットしません。
- 公式サイト等の文章や画像を必要以上に転載しません。
