# 過ぎた締切の再抽出（22070 型）の再現用フィクスチャ

`tools/check-past-news-times.js`（`npm run check:ics-feed` から呼ぶ）が使う入力です。
ネットワークは使いません。**本番のCSVやJSONではありません。** 書き換えても公開物には影響しません。

| ファイル | 出どころ |
| --- | --- |
| `previous.timeline-events.ics` | main の `public/timeline-events.ics`（#407 マージ後、#410 時点）をそのまま写したもの。`news-22070-sec19-entry-1200` が `STATUS:CANCELLED`・`SEQUENCE:1` |
| `previous.calendar-events.json` | 同じ時点の main の `public/data/calendar-events.json` から、記事由来（`derived_from` あり）の行と `meta` だけを抜いたもの。22070 は無い |
| `news-times.csv` | PR #409（2026-11-23 の取り込み）の `docs/sheets/news-times.current.csv` をそのまま写したもの。締切 2026-11-12 12:00 の 22070 が再抽出されている |
| `news-times.manual.empty.csv` | 手直しなし（見出しだけ） |

テストの中で、前回フィードの `news-22105-acl-md6-flow-1715` だけを `CANCELLED`・`SEQUENCE:1` に書き換えた
**作り物の場合**も作ります（未来の予定が一度墓標になってから戻ったとき、版が下がらないことを見るため。実際には起きていない状態）。

`news-22058-sec17-happening-1100`（種類「場内の催し」）は、生成側の種類表に無いため取り込まれず警告になります。#409 の入力をそのまま残すため、消していません。
