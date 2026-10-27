<!-- pending-since: 2030-07-01T13:00:00.000Z -->
## 概要

- チケット販売スケジュールの自動取り込みです（`.github/workflows/ticket-sales-sync.yml`）。手作業の編集は含みません。
- 内容を確認してからマージしてください。自動ではマージしません。
- 変わったデータ: ホーム戦の掲載（Jリーグチケット）、ホーム戦の販売日時（Jリーグチケット）
- **公開JSONは変わりません。** 取り込んだCSVから作り直した `public/data/calendar-events.json` は、いまの内容と同じでした。CSVだけを更新するPRです。
- 購読フィード（`public/timeline.ics` と `public/timeline-events.ics`）は変わりません。
- ホーム戦の販売日時は、公式の販売スケジュールが更新できないため、Jリーグチケットの試合ページから補っています（`docs/sheets/home-sales.current.csv`）。公式と日時が違う段階だけ、こちらで上書きします。日時が公式と同じなら公開JSONは変わりません。
- **公式の販売スケジュールの取得は一時停止しています。** 公式サイト（sanga-fc.jp）が戻るまで、取得も解析もしません。`ticket-sales.current.csv` は前回の値のままです。
- **公式の案内の取り込みは一時停止しています。** 公式サイト（sanga-fc.jp）が戻るまで取得しません。案内のCSVは前回の値のままです。
- 取得日時・確認日・画面表示（受付中・販売中）だけの違いでは更新しません。

## 変更内容

取得日時の列は毎回動くため、CSVの差分はそのぶん多く見えます。その列を除いて突き合わせた結果です。

### ホーム戦の掲載（Jリーグチケット）（`docs/sheets/home-tickets.current.csv`）

```text
追加: 2030-08-01 / 14:00 / 明治安田Ｊ１リーグ / サンプルFC / サンガスタジアム / 発売前 / https://www.jleague-ticket.jp/sales/perform/2000003/001
```

### ホーム戦の販売日時（Jリーグチケット）（`docs/sheets/home-sales.current.csv`）

```text
追加: 2030-08-01 / 一般販売 / 2030-07-20T12:00:00+09:00 / https://www.jleague-ticket.jp/sales/perform/2000003/001
```

公開ファイル（`public/`）の変更はありません。

## 確認内容

- 取り込み時に `npm run check:static`（`check:timeline` → `check:timeline:public` を含む）を実行し、合格しています。
- GitHub Actionsが作ったPRではワークフローが起動しないため、このPRにはCIの結果が付きません。

## 注意点

- ホーム戦の販売日時が、Jリーグチケットの試合ページの表示と一致しているか。
- 本番反映はマージと別に、手動のデプロイで行います。

実行: https://github.com/example/actions/runs/1
