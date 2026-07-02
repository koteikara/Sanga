# Hotels Tooling

Rakuten Travel API を使ったホテル候補データの生成基盤です。

このディレクトリは `Sanga` 本体に同居する生成ツール置き場です。検証用の実験や API 仕様確認は `jleague_hotel_` リポジトリに残し、ここでは `public/data/` に載せるための整形と運用に寄せていきます。

## PR #122 時点の注意

このディレクトリは初期スキャフォールドです。`build_match_hotels.py` は楽天 API の実レスポンスではなく、固定のサンプルホテルを出力します。実データ公開前に、楽天取得結果の変換、宿泊日ルール、スタジアム座標、公開 JSON の必須項目を確定してください。

## 想定フロー

1. `.env` に楽天 API 用の認証情報を配置する
2. `investigate.py` で外部 API の疎通やレスポンス傾向を確認する
3. `build_match_hotels.py` で試合単位の公開 JSON を生成する
4. `public/data/hotels/` と `public/data/hotel-index.json` を更新する

`.env` は Git に含めないでください。設定例は `.env.example` のみ管理します。

## ファイル役割

- `rakuten_client.py`: Rakuten Travel API 呼び出し
- `models.py`: 内部データ構造
- `public_schema.py`: `public/data` 向け JSON 変換
- `investigate.py`: 調査・疎通確認用 CLI
- `build_match_hotels.py`: 公開データ生成エントリポイント

## メモ

- 認証情報は Git に含めない
- `jleague_hotel_` は当面、API 調査と仕様検証の母艦として残す

## 実行例

```bash
python tools/hotels/investigate.py --latitude 35.016 --longitude 135.768 --checkin-date 2026-08-08 --checkout-date 2026-08-09
python tools/hotels/build_match_hotels.py --match-id sec01
```

`build_match_hotels.py` は現状サンプルデータを出力します。実行後は `git diff public/data/hotel-index.json public/data/hotels/` で、公開してよい内容か確認してください。
