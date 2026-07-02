# ホテルデータスキーマ

この文書は、`Sanga` 内で「試合ごとのホテル候補データ」を共存させるための公開用 JSON スキーマを定義する。

目的は次の 2 つ。

- 公開サイト側では静的 JSON を読むだけでホテル候補を表示できるようにする
- 取得ロジックや楽天 API 調査ロジックは `tools/` 側に閉じ込める

この方針により、API キーや外部 API 制約をフロントエンドへ持ち込まずに、既存の `public/data/` ベース運用と整合させる。

## 1. 設計方針

ホテルデータは次の 2 層に分ける。

1. `hotel-index.json`
2. `hotels/{match_id}.json`

`hotel-index.json` は「どの試合にホテルデータがあるか」を示す軽量な一覧であり、画面初期表示や存在確認に使う。

`hotels/{match_id}.json` は、各試合に紐づくホテル候補の詳細データである。必要になった試合だけを遅延読み込みする前提とする。

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

1. `tools/hotels/` に楽天取得ロジックを移植する
2. 内部モデルから公開用 JSON へ変換する関数を作る
3. `public/data/hotel-index.json` と `public/data/hotels/{match_id}.json` を生成する
4. `public/assets/app.js` から必要な試合のホテル詳細を遅延読み込みする
