# Hotels Operation Flow

`Sanga` 本体でホテル JSON を配布するまでの運用メモです。

## 基本方針

- API 調査は `jleague_hotel_` で継続する
- 本番掲載向けの整形と配置は `Sanga/tools/hotels` に寄せる
- フロントエンドは `public/data/` の静的 JSON を読む

## PR #122 時点の到達点

- `public/data/hotel-index.json` を空索引として追加した。
- 公開ページに、ホテルデータ件数と更新情報を表示する小さなプレビュー枠を追加した。
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
python -m py_compile tools/hotels/*.py
node --check public/assets/app.js
```

`build_match_hotels.py` は `public/data/hotel-index.json` と `public/data/hotels/{match_id}.json` を更新するため、実行後は差分を確認し、ダミーデータを公開対象に含めない。

## 今後の実装ポイント

- スタジアム座標と検索半径の定義
- 人数パターン別の価格比較
- 更新日時と生成元のメタデータ付与
- フロントエンド側の読み込み導線追加
