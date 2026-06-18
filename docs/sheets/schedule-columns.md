# Googleスプレッドシート列定義

この文書は、Googleスプレッドシートで管理する日程データの列と、公開用JSON `public/data/matches.json` の項目対応を整理するものです。現段階ではGoogle Sheets API連携は行わず、スプレッドシートからCSVを書き出し、`tools/generate-matches-from-csv.js` で検証用JSONを生成する前提です。

## 基本方針

* 列名は日本語を基本にし、運用者が入力しやすい表現にします。
* JSON生成時に、日本語列名を `matches.json` の英語キーへ変換します。
* 生成先はまず `tmp/matches.generated.json` などの確認用ファイルにし、本番用 `public/data/matches.json` は直接上書きしません。
* 公式情報に基づく日程は、根拠URLを必ず残します。
* 未確定情報は、確定日と区別して `状態`、`候補日`、`注記` で扱います。

## 列定義

| CSV列名 | JSONキー | 必須 | 内容 | 入力例 |
| --- | --- | --- | --- | --- |
| ID | id | 必須 | 試合を一意に識別するID | sec01 |
| 節 | round | 必須 | 節または回戦 | 第1節 |
| 開催年 | season / 表示順補助 | 必須 | シーズン内の表示年。JSONの `season` は原則 `2026-27` を使います | 2026 |
| 開催日 | match_date | 任意 | 確定済みの開催日。未定の場合は空欄 | 2026-09-02 |
| 候補日 | date_candidates | 任意 | 複数候補日は `|` 区切り。確定日がある場合は空欄 | 2026-12-16\|2027-04-14 |
| 状態 | status / status_label | 必須 | 確定、未確定など | 確定 |
| ホームアウェイ | home_away | 必須 | `H` または `A` | H |
| ホームアウェイ表示 | home_away_label | 任意 | 画面表示用ラベル | ホーム |
| 対戦相手 | opponent | 必須 | 対戦相手の表示名 | 神戸 |
| 対戦相手コード | opponent_code | 任意 | CSSロゴ用コード | vissel |
| 会場 | venue | 必須 | 会場名。未定の場合は `未定` | サンガスタジアム |
| 注記 | note | 任意 | 表示してよい補足。注記番号は `※1:` の形式 | ※1: 開催候補日あり |
| 根拠URL | source_url | 任意 | 公式情報などの根拠URL | https://www.sanga-fc.jp/ |
| 表示順 | sort_order | 任意 | 並び順。未入力時はCSVの行順 | 16 |

## 生成時に補完するJSON項目

CSVに列を持たない項目は、生成スクリプト側で次のように補完します。

| JSONキー | 補完方針 |
| --- | --- |
| season | 既定値 `2026-27` |
| competition | 既定値 `J1` |
| competition_label | 既定値 `明治安田J1リーグ` |
| kickoff_time | 空文字 |
| result | 空文字 |
| ticket_url | 空文字 |
| broadcast | 空文字 |
| source_checked_at | 生成日時 |
| updated_at | 生成日時 |
| meta | `season`、`team`、`updated_at`、`source` を出力 |

## 日程状態の扱い

### 日付確定

* `開催日` に `YYYY-MM-DD` を入力します。
* `候補日` は空欄にします。
* `状態` は `確定` にします。
* JSONでは `match_date` に日付を入れ、`date_candidates` は空配列にします。

### 日付未定

* `開催日` と `候補日` を空欄にします。
* `状態` は `未確定` にします。
* 必要に応じて `注記` に「開催日未定」などを入力します。
* JSONでは `match_date` を空文字、`date_candidates` を空配列にします。

### 候補日がある日程

* `開催日` は空欄にします。
* `候補日` に候補日を `|` 区切りで入力します。
* `状態` は原則 `未確定` にします。
* JSONでは `date_candidates` に候補日配列を出力します。

### 注記付き日程

* 画面に表示してよい補足のみ `注記` に入力します。
* 注記番号を出す場合は `※1:` のように、番号を判別できる形式にします。
* 内部メモや非公開情報は `注記` に入れません。

## ステータス変換

| CSV入力 | JSON status | JSON status_label |
| --- | --- | --- |
| 確定 | confirmed | 確定 |
| 未確定 | tentative | 未確定 |
| confirmed | confirmed | 確定 |
| tentative | tentative | 未確定 |

## 生成後の検証手順

スプレッドシートからCSVを書き出した後は、生成結果をすぐに本番用JSONへ反映せず、次の順序で確認します。

1. GoogleスプレッドシートからCSVを出力します。
2. CSVから確認用JSON `tmp/matches.generated.json` を生成します。

   ```bash
   node tools/generate-matches-from-csv.js docs/sheets/schedule.sample.csv tmp/matches.generated.json
   ```

3. 生成したJSONを `tools/validate-generated-matches.js` で検証します。

   ```bash
   node tools/validate-generated-matches.js tmp/matches.generated.json
   ```

4. 本番用38件として運用するデータでは、件数チェックも指定します。

   ```bash
   node tools/validate-generated-matches.js tmp/matches.generated.json --expected-count 38
   ```

5. エラーがなく、内容を確認して問題がなければ `public/data/matches.json` へ反映します。
6. 反映後に、公開用JSON向けの従来検証を実行します。

   ```bash
   node tools/validate-matches.js
   ```

7. GitHub Pagesの確認環境で表示と操作に問題がないことを確認します。
8. 本番サーバーへのデプロイは、明示的に反映する段階で実行します。

## 注意事項

* サービスアカウントJSON、APIキー、`.env` などの認証情報は作成しません。
* CSVは確認用JSON生成の入力であり、生成結果を確認してから `public/data/matches.json` へ反映します。
* `根拠URL` には可能な限り公式サイト、Jリーグ公式サイトなどの公開URLを記録します。
