# Hotels Operation Flow

`Sanga` 本体でホテル JSON を配布するまでの運用メモです。

## 基本方針

- API 調査は `jleague_hotel_` で継続する
- 本番掲載向けの整形と配置は `Sanga/tools/hotels` に寄せる
- フロントエンドは `public/data/` の静的 JSON を読む

## PR #122 時点の到達点

- `public/data/hotel-index.json` を空索引として追加した。
- PR #122 時点では公開ページにホテルデータ件数と更新情報を表示する小さなプレビュー枠を追加していたが、2026-07-09 の見直しで、スケジュールと直接関係しない情報を表示しない方針に戻した。
- `tools/hotels/` に、楽天 API 調査用 CLI、公開 JSON 生成 CLI、内部モデル、公開スキーマ変換の足場を追加した。
- 実データ取得・ホテル詳細表示・宿泊条件の本決定は未実装である。

## 生成ステップ

1. 試合情報から対象 `match_id` と宿泊条件を決める
2. Rakuten API から候補を取得する
3. 内部モデルでタグ付けや除外ロジックを適用する
4. `public/data/hotels/{match_id}.json` を出力する
5. `public/data/hotel-index.json` を更新する

PR #122 時点の `build_match_hotels.py` は、楽天 API の実取得ではなくダミー候補を出力する。実運用データを公開する前に、宿泊日ルール、スタジアム座標、料金表示、アフィリエイトリンク表記を確認する。

## 手動確認コマンド

```bash
python tools/hotels/build_match_hotels.py --match-id sec01
node tools/validate-hotels.js
python -m py_compile tools/hotels/*.py
node --check public/assets/app.js
```

`build_match_hotels.py` は `public/data/hotel-index.json` と `public/data/hotels/{match_id}.json` を更新するため、実行後は差分を確認し、ダミーデータを公開対象に含めない。

`node tools/validate-hotels.js` は、空の `hotel-index.json` を正常扱いしつつ、索引に試合が追加された場合は `matches.json` の `id` との対応、`data/hotels/{match_id}.json` の存在、件数、日付、ホテル候補の基本フィールドを確認する。


## 今後の実装ポイント

- スタジアム座標と検索半径の定義
- 人数パターン別の価格比較
- 更新日時と生成元のメタデータ付与
- フロントエンド側の読み込み導線追加

## アウェイ遠征ガイド（2026-10 実装）

ホテル候補は、日程ページではなく独立ページ `public/away.html`（`assets/away-guide.js`）で表示する。2026-07-09 の「スケジュールと直接関係しない情報を日程ページに出さない」方針に従い、`timeline.html` と `sanga202627season.html` にはホテル・交通の表示もリンクも足していない（入口の `tools.json` のカードからだけ辿れる）。

### データの流れ

| 入力 | 出力 |
| --- | --- |
| `public/data/stadiums.json`（会場の座標。matches.json の `venue` 略称で引く） | ホテル検索の中心点 |
| 楽天トラベル VacantHotelSearch | `public/data/hotels/{match_id}.json` と `hotel-index.json` |
| `docs/sheets/away-transport.csv`（最寄り駅・アクセス・任意の交通リンク） | `public/data/away-guide.json`（`tools/generate-away-guide.js`） |

- 対象は国内のアウェイ戦（ACL は除く）。宿泊は前泊（試合前日チェックイン・翌日チェックアウト、2名、半径3km）。日程未定の試合は候補日の早いほう。
- 取得条件・日時（`meta.updated_at`、JST）をページに表示する。広告表記（PR）はページ冒頭と各ホテル欄に出す。
- ホテルのリンクは、楽天がアフィリエイトIDつきで返した `hotelInformationUrl` だけを使う。IDをリポジトリに書かない。

### 認証情報

環境変数（または GitHub Secrets）`RAKUTEN_APP_ID` / `RAKUTEN_AFFILIATE_ID` / `RAKUTEN_ACCESS_KEY`。`openapi.rakuten.co.jp` のAPIは accessKey が必須。`tools/validate-stadiums.js` は公開JSONに認証情報らしい文字列が混ざっていないかも見る。

### 更新

- 自動: `hotels-sync.yml`（毎週月曜 10:00 JST。現在は `docs/workflows/` に置いてあり、`.github/workflows/` へ移すと有効になる）。差分があれば下書きPR。デプロイはしない。
- 手動: `python tools/hotels/build_match_hotels.py --all-away` → `node tools/generate-away-guide.js` → `npm run fix:asset-versions` → `npm run check:static`
- API を呼ばない検証: `--response-file tools/fixtures/hotels/vacant-hotel-search.sample.json`（出力は公開データに含めない）

### 会場・交通の追加

会場が増えたら `stadiums.json` に追加し、`away-transport.csv` に1行足す。交通のアフィリエイトリンクは `transport_label` と `transport_url`（https のみ）に手で入れる。
