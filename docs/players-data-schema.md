# 選手データのスキーマ

## この文書の目的

予想スカッド作成ページで使う選手データ `public/data/players.json` の項目と、スプレッドシートからの生成手順を定義します。

日程データ（`docs/data-schema.md`）と同じく、スプレッドシートで管理してCSVを書き出し、そこからJSONを生成する運用にします。

## 項目

| 列 | キー | 型 | 必須 | 内容 |
| --- | --- | --- | --- | --- |
| 背番号 | `number` | 文字列 | 必須 | 公式の背番号。`1`、`83`、`510` のように表記どおり。一意 |
| ローマ字名 | `nameEn` | 文字列 | 必須 | 公式の背番号一覧に入っている表記。例 `M.TÚLIO`、`JOÃO PEDRO` |
| 日本語名 | `nameJa` | 文字列 | 任意 | 漢字またはカタカナ。カード上での併記に使う |
| かな | `nameKana` | 文字列 | 任意 | 並べ替えと検索に使う |
| ポジション | `position` | 文字列 | 必須 | `GK` / `DF` / `MF` / `FW` のいずれか |
| 国籍 | `nationality` | 文字列 | 必須 | 小文字の国コード。`jp` / `br` / `kr` など。CSSクラス `.flag-<code>` に対応する |
| 画像 | `image` | 文字列 | 任意 | `assets/players/` からの相対パス。省略時は背番号から解決する |
| マスコット | `isMascot` | 真偽値 | 任意 | マスコットのとき `true`。既定では選手一覧に出さない |

## JSONの形

```json
{
  "updatedAt": "2026-08-18",
  "source": "京都サンガF.C. 公式サイト",
  "players": [
    {
      "number": "11",
      "nameEn": "M.TÚLIO",
      "nameJa": "マルコ・トゥーリオ",
      "nameKana": "まるこ とぅーりお",
      "position": "FW",
      "nationality": "br",
      "image": "assets/players/11.webp",
      "isMascot": false
    }
  ]
}
```

## 検証で確認すること

`tools/validate-players.js` で次を確認します。

- `number` が重複していない
- `position` が `GK` / `DF` / `MF` / `FW` のいずれか
- `nationality` に対応する国旗の定義がCSSに存在する
- `nameEn` が空でない
- `image` が指すファイルが存在する（省略時は背番号から解決したパスを確認する）

## 生成の手順

```bash
node tools/generate-players-from-csv.js docs/sheets/players.csv
node tools/validate-players.js
```

## 注意

- 選手データは公式サイトを参照して手入力します。スクレイピングによる自動取得は行いません。
- 移籍や新加入があった場合は、スプレッドシートを更新してJSONを再生成します。
- 個人のスカッド作成内容はこのJSONに含めません。LocalStorageで扱います。
