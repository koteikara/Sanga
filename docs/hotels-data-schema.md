# ホテルデータスキーマ

この文書は、`Sanga` 内で「試合ごとのホテル候補データ」を共存させるための公開用 JSON スキーマを定義する。

目的は次の 2 つ。

- 公開サイト側では静的 JSON を読むだけでホテル候補を表示できるようにする
- 取得ロジックや楽天 API 調査ロジックは `tools/` 側に閉じ込める

この方針により、API キーや外部 API 制約をフロントエンドへ持ち込まずに、既存の `public/data/` ベース運用と整合させる。


## 0. PR #122 時点の実装状況

PR #122 では、ホテル候補データ連携の初期スキャフォールドとして次の構成が追加された。

- 公開ページには `public/data/hotel-index.json` の件数と更新情報を表示するプレビュー枠だけを追加している。
- `public/data/hotel-index.json` は空の索引として配置されており、初期状態ではホテル詳細 JSON は公開されていない。
- `tools/hotels/build_match_hotels.py` は、指定した `match_id` に対してダミーの `Sample Hotel Kyoto` を出力する決定的な足場である。
- 楽天 API から取得した実データを公開 JSON に変換する処理は、今後の実装対象である。
- フロントエンドから楽天 API を直接呼ぶ処理は追加していない。

このため、この文書のうち `stadium_id`、`checkin_date`、`checkout_date`、`search_conditions` などを含む詳細な例は最終形に近い設計メモであり、PR #122 時点の空索引や足場出力とは一部差がある。実データ公開前に、生成ツールの出力と本スキーマの必須項目を再確認する。

## 1. 設計方針

ホテルデータは次の 2 層に分ける。

1. `hotel-index.json`
2. `hotels/{match_id}.json`

`hotel-index.json` は「どの試合にホテルデータがあるか」を示す軽量な一覧であり、画面初期表示や存在確認に使う。PR #122 時点では空の `matches` 配列を持つ索引として公開し、サイト上では件数と更新情報だけを表示する。

`hotels/{match_id}.json` は、各試合に紐づくホテル候補の詳細データである。必要になった試合だけを遅延読み込みする前提とする。PR #122 時点では詳細ファイルのフロントエンド遅延読み込みは未実装で、生成ツールの足場だけがある。

## 2. 配置場所

```text
public/
  data/
    matches.json
    hotel-index.json
    hotels/
      sec01.json
      sec02.json
```

`matches.json` は既存の試合データ。

`hotel-index.json` はホテルデータの索引。

`hotels/` 配下は試合 ID ごとの詳細ファイル。

## 3. 試合 ID との関係

ホテルデータは `matches.json` の `id` と 1 対 1 または 1 対 0 で紐づける。

例:

- `sec01`
- `sec02`
- `sec39`

公開ページ側は試合カードの `id` を使って `data/hotels/{match_id}.json` を引く。

## 4. 公開用スキーマ

### 4.1 hotel-index.json

```json
{
  "meta": {
    "updated_at": "2026-07-02 14:30",
    "source": "Rakuten Travel API",
    "season": "2026-27"
  },
  "matches": [
    {
      "match_id": "sec01",
      "stadium_id": "sanga_stadium",
      "checkin_date": "2026-08-08",
      "checkout_date": "2026-08-09",
      "hotel_count": 12,
      "data_path": "data/hotels/sec01.json"
    }
  ]
}
```

#### フィールド定義

| フィールド | 型 | 必須 | 用途 |
| --- | --- | --- | --- |
| `meta.updated_at` | string | 必須 | 索引 JSON の更新日時 |
| `meta.source` | string | 必須 | 生成元データの名称 |
| `meta.season` | string | 必須 | 対象シーズン |
| `matches[].match_id` | string | 必須 | `matches.json` の `id` と一致する試合 ID |
| `matches[].stadium_id` | string | 必須 | スタジアム識別子 |
| `matches[].checkin_date` | string | 必須 | 宿泊対象のチェックイン日 |
| `matches[].checkout_date` | string | 必須 | 宿泊対象のチェックアウト日 |
| `matches[].hotel_count` | number | 必須 | 詳細ファイルに含まれるホテル件数 |
| `matches[].data_path` | string | 必須 | 詳細 JSON への相対パス |

### 4.2 hotels/{match_id}.json

```json
{
  "meta": {
    "match_id": "sec01",
    "stadium_id": "sanga_stadium",
    "match_date": "2026-08-09",
    "checkin_date": "2026-08-08",
    "checkout_date": "2026-08-09",
    "updated_at": "2026-07-02 14:30",
    "source": "Rakuten Travel API",
    "search_conditions": {
      "adult_num": 2,
      "up_class_num": 0,
      "low_class_num": 0,
      "search_radius": 3
    }
  },
  "hotels": [
    {
      "hotel_no": 12345,
      "hotel_name": "Sample Hotel Kyoto",
      "distance_km_from_stadium": 2.4,
      "min_charge": 9800,
      "max_charge": 15600,
      "price_tier": "standard",
      "parking_tag": "available_paid",
      "parking_raw_text": "駐車場あり 1泊1000円",
      "accommodation_type_tag": "hotel",
      "hotel_class_code_raw": "business",
      "affiliate_url": "https://example.com/hotel/12345",
      "stadium_proximity": true,
      "sightseeing_friendly": null,
      "gourmet_area_note": null
    }
  ]
}
```

#### meta フィールド定義

| フィールド | 型 | 必須 | 用途 |
| --- | --- | --- | --- |
| `meta.match_id` | string | 必須 | `matches.json` と結び付ける試合 ID |
| `meta.stadium_id` | string | 必須 | スタジアム識別子 |
| `meta.match_date` | string | 任意 | 試合日 |
| `meta.checkin_date` | string | 必須 | ホテル検索のチェックイン日 |
| `meta.checkout_date` | string | 必須 | ホテル検索のチェックアウト日 |
| `meta.updated_at` | string | 必須 | 詳細 JSON の更新日時 |
| `meta.source` | string | 必須 | 生成元データの名称 |
| `meta.search_conditions.adult_num` | number | 必須 | 成人人数 |
| `meta.search_conditions.up_class_num` | number | 必須 | 上位クラス人数 |
| `meta.search_conditions.low_class_num` | number | 必須 | 下位クラス人数 |
| `meta.search_conditions.search_radius` | number | 必須 | 検索半径 |

#### hotels[] フィールド定義

| フィールド | 型 | 必須 | 用途 |
| --- | --- | --- | --- |
| `hotel_no` | number | 必須 | 楽天ホテル番号 |
| `hotel_name` | string | 必須 | ホテル名 |
| `distance_km_from_stadium` | number | 必須 | スタジアムからの距離 |
| `min_charge` | number or null | 必須 | 最低料金 |
| `max_charge` | number or null | 任意 | 最高料金 |
| `price_tier` | string | 必須 | `budget` / `standard` / `premium` |
| `parking_tag` | string | 必須 | `available_free` / `available_paid` / `none` / `unknown` |
| `parking_raw_text` | string or null | 任意 | 駐車場情報の原文 |
| `accommodation_type_tag` | string | 必須 | `hotel` / `ryokan` / `unknown` |
| `hotel_class_code_raw` | string or null | 任意 | 宿タイプ判定の元データ |
| `affiliate_url` | string | 必須 | 楽天アフィリエイト URL |
| `stadium_proximity` | boolean or null | 任意 | 近さ重視の補助判定 |
| `sightseeing_friendly` | boolean or null | 任意 | 観光向き補助判定 |
| `gourmet_area_note` | string or null | 任意 | 補助メモ |

## 5. 公開用に最小限必要な項目

最初の公開段階では、`hotels[]` にすべての内部項目を出さなくてもよい。

最低限の公開用項目は次を想定する。

- `hotel_no`
- `hotel_name`
- `distance_km_from_stadium`
- `min_charge`
- `price_tier`
- `parking_tag`
- `affiliate_url`

内部生成ロジックではより多くの項目を保持し、公開 JSON では UI に必要な項目だけを出力する。

## 6. 内部モデルとの分離

生成系の Python ロジックでは、公開用 JSON とは別によりリッチな内部モデルを持ってよい。

想定する責務分離は次のとおり。

- 内部モデル
  - 楽天レスポンスの生値や判定補助項目を保持する
- 公開用 JSON
  - フロントエンド表示に必要な項目だけを含む

この分離により、判定ロジックの見直しや元 API の仕様差分があっても、公開スキーマを安定させやすくする。

## 7. 将来の拡張候補

将来的に必要になった場合は次を追加できる。

- `recommended_rank`
- `recommended_reason`
- `booking_status`
- `nearest_station`
- `walking_minutes_to_station`
- `walking_minutes_to_stadium`
- `review_score`
- `review_count`
- `images`

ただし初期段階では追加せず、公開ページ上の必要性が明確になってから検討する。

## 8. 非推奨

次の構成は避ける。

- `matches.json` にホテル候補を直接埋め込む
- 楽天 API の生レスポンスをそのまま `public/data/` に置く
- API キーや `.env` 情報を `public/` 近くへ置く
- フロントエンドから楽天 API を直接叩く前提で設計する

## 9. 次の実装ステップ

このスキーマを採用する場合、次の順で進める。

1. スタジアム識別子、座標、検索半径、宿泊日ルールを定義する
2. `tools/hotels/` のダミーデータ出力を楽天取得結果に置き換える
3. 内部モデルから公開用 JSON へ変換する関数を、必須項目の不足が分かる形に強化する
4. `public/data/hotel-index.json` と `public/data/hotels/{match_id}.json` を生成する
5. 実データ公開前に、ホテル名・料金・駐車場情報・アフィリエイト URL の表示方針と免責文を確認する
6. `public/assets/app.js` から必要な試合のホテル詳細を遅延読み込みする

## 10. PR #122 時点で確認が必要な差分

- `build_match_hotels.py` の `checkin_date` / `checkout_date` は、現状どちらも `match_date` を仮設定している。実運用前に「前泊」「当日泊」「連泊」のどれを採用するか決める。
- `stadium_id` は現状 `matches.json` の `venue` を仮流用している。公開スキーマ上は安定した識別子を想定するため、会場名とは別のスタジアムマスタが必要になる。
- `public_schema.py` は `affiliate_url` が空の場合に項目を落とすが、本スキーマでは必須としている。実データ公開前に必須扱いを維持するか、任意扱いに変えるか決める。
- 現在の公開ページは `hotel-index.json` の件数表示だけを行い、ホテル詳細カードや予約リンクは表示しない。詳細表示を追加する場合は、広告・アフィリエイト表記、外部リンク文言、アクセシビリティを別途確認する。
