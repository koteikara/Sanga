# Hotels Tooling

Rakuten Travel API を使ったホテル候補データの生成基盤です。

このディレクトリは `Sanga` 本体に同居する生成ツール置き場です。検証用の実験や API 仕様確認は `jleague_hotel_` リポジトリに残し、ここでは `public/data/` に載せるための整形と運用に寄せていきます。

## 想定フロー

1. `.env` に楽天 API 用の認証情報を配置する
2. `investigate.py` で外部 API の疎通やレスポンス傾向を確認する
3. `build_match_hotels.py` で試合単位の公開 JSON を生成する
4. `public/data/hotels/` と `public/data/hotel-index.json` を更新する

## ファイル役割

- `rakuten_client.py`: Rakuten Travel API 呼び出し
- `models.py`: 内部データ構造
- `public_schema.py`: `public/data` 向け JSON 変換
- `investigate.py`: 調査・疎通確認用 CLI
- `build_match_hotels.py`: 公開データ生成エントリポイント

## メモ

- 認証情報は Git に含めない
- `jleague_hotel_` は当面、API 調査と仕様検証の母艦として残す
