# Hotels Operation Flow

`Sanga` 本体でホテル JSON を配布するまでの運用メモです。

## 基本方針

- API 調査は `jleague_hotel_` で継続する
- 本番掲載向けの整形と配置は `Sanga/tools/hotels` に寄せる
- フロントエンドは `public/data/` の静的 JSON を読む

## 生成ステップ

1. 試合情報から対象 `match_id` と宿泊条件を決める
2. Rakuten API から候補を取得する
3. 内部モデルでタグ付けや除外ロジックを適用する
4. `public/data/hotels/{match_id}.json` を出力する
5. `public/data/hotel-index.json` を更新する

## 今後の実装ポイント

- スタジアム座標と検索半径の定義
- 人数パターン別の価格比較
- 更新日時と生成元のメタデータ付与
- フロントエンド側の読み込み導線追加
