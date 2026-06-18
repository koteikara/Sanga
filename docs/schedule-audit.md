# 日程データ監査メモ

このドキュメントは、`public/data/matches.json` と `public/sanga202627season.html` の手書き日程カードを照合し、日程データの誤りを見つけやすくするための確認観点と記録欄をまとめるものです。

## 目的

* GitHub Pagesや本番反映前に、日程・対戦相手・会場などの入力誤りを早期に見つける。
* JSON化した日程データと、移行前の手書きHTMLカードの差分を確認しやすくする。
* 誤りを見つけた場合に、修正前の状態・確認元・対応状況を残せるようにする。

## 確認対象

* `public/data/matches.json`
* `public/sanga202627season.html` 内の既存手書き日程カード
* 必要に応じて、京都サンガF.C.公式サイト、Jリーグ公式サイト、各大会公式サイトなどの公開情報

## 基本確認コマンド

```bash
node tools/validate-matches.js
node tools/export-matches-review.js
```

`tools/export-matches-review.js` は、`matches.json` からMarkdown形式の確認用一覧を標準出力へ出します。ファイルに保存して確認する場合は、次のように実行します。

```bash
node tools/export-matches-review.js > /tmp/sanga-matches-review.md
```

## 日程データ確認の観点

### 1. JSON構造

* `matches` が配列になっているか。
* 件数がJ1リーグ38試合分になっているか。
* `id` が `sec01` から `sec38` まで重複なく並んでいるか。
* `round`、`opponent`、`home_away`、`venue`、`status` など、画面表示に必要な項目が空になっていないか。

### 2. 日付

* `match_date` がある場合、`YYYY-MM-DD` 形式になっているか。
* `date_candidates` がある場合、各値が `YYYY-MM-DD` 形式になっているか。
* `date_candidates` の日付が昇順になっているか。
* `match_date` と `date_candidates` が同時に入っていないか。
* 日付が対象期間 `2026-08-01` から `2027-06-30` の範囲に収まっているか。
* 未確定日程は、単一日付を確定扱いにしていないか。

### 3. 手書きHTMLカードとの照合

* `data-id` とJSONの `id` が一致しているか。
* `.sec` とJSONの `round` が一致しているか。
* `.team` とJSONの `opponent` が一致しているか。
* `home` / `away` クラスとJSONの `home_away` が一致しているか。
* `.place` とJSONの `venue` が一致しているか。
* `.note` とJSONの `note` 先頭の `※数字` が一致しているか。

### 4. 注記

* `note` がある場合、画面表示用の `※数字` が先頭から判別できるか。
* 同じ注記番号の意味が、HTML下部の凡例と矛盾していないか。
* 注記が必要な試合で、JSONまたはHTMLのどちらか片方だけに注記番号が入っていないか。

### 5. 公開情報との目視確認

* 対戦相手、ホーム/アウェイ、会場、開催日候補が公式情報と一致しているか。
* ACL Elite、ルヴァンカップ、天皇杯など他大会都合による注記が公式発表と矛盾していないか。
* 情報が未確定の場合、`status: "tentative"` や注記で未確定であることが分かるか。
* 出典URLを更新する場合は、公式サイト等のURLを `source_url` に残せるか。

## 誤りが見つかった場合の記録欄

| 記録日 | ID | 項目 | 現在の値 | 正しい可能性がある値 | 確認元URL・資料 | 状況 | メモ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| YYYY-MM-DD | secXX | 例: match_date | 例: 2026-08-08 | 例: 2026-08-09 | https://example.com/ | 未対応 / 確認中 / 修正済み | 例: GitHub Pages表示で違和感を確認 |

## 修正時の注意

* 誤りを修正する前に、確認元URLまたは確認資料を記録する。
* `public/data/matches.json` を修正する場合は、手書きHTMLカードとの差分が意図したものか確認する。
* 手書きHTMLカードを修正する場合は、スマートフォン幅で表示崩れがないか確認する。
* 本番サーバーへのアップロードは、明示的な指示がある場合のみ行う。
* 認証情報、Secrets、`.env`、サービスアカウントJSONなどは作成・保存しない。
