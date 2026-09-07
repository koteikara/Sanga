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
| 省略名 | `nameShort` | 文字列 | 必須 | ベンチのタイル表示で背番号の下に出す短い名前。全選手で一意。決め方は下記 |
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
      "nameShort": "マルコ",
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
- `nameShort` が空でなく、全選手で重複せず、全角6文字ぶん以内である
- `image` が指すファイルが存在する（省略時は背番号から解決したパスを確認する）

## 省略名（`nameShort`）の決め方

ベンチのタイル表示は枠が狭く、入るのは全角4文字前後です。表示側で機械的に短くすると
外国籍の選手や同姓の選手が分かりにくくなるため、選手ごとに決めてデータで持ちます。

1. 原則は姓（日本語として自然なため）
2. 姓が重複する場合は、ユニフォーム表記に合わせて区別する
   （例: 23 加藤拓己＝`加藤` / 26 加藤蓮＝`加藤蓮`。クラブのユニフォームも `KATO` と `REN` で区別している）
3. 外国籍の選手と、姓が長い選手は個別に決める
   （例: 6 ジョアン ペドロ＝`JP`、9 ラファエル エリアス＝`ラファエル`、36 ファンティーニ 燦＝`ファンティ`）

全角6文字を超える名前は表示時に横方向へ圧縮されます。読みやすさのため、4文字前後に収めてください。
重複と長さは `tools/validate-players.js` が機械的に確認するので、記入漏れや重複はCIで止まります。

## 生成の手順

```bash
node tools/generate-players-from-csv.js docs/sheets/players.csv
node tools/validate-players.js
```

CSVの列は上の「項目」の表と同じ並びで、`省略名` も列として持ちます。ここが欠けていると、
再生成でJSON側の `nameShort` が消えます（2026-09-07に実際に列が無い状態でした）。
列の欠落は生成ツールが必須列として止めます。

背番号タイルの画像を追加・差し替えたときは、中央寄せの補正値も作り直します。

```bash
python3 -m http.server 8123 --directory public &
PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/measure-tile-offsets.mjs
```

公開ファイルのキャッシュ用バージョンは内容ハッシュで決まるため、`players.json` を
更新したら `node tools/asset-versions.mjs` で参照側を書き換えます。

## 注意

- 選手データは公式サイトを参照して手入力します。スクレイピングによる自動取得は行いません。
- 移籍や新加入があった場合は、スプレッドシートを更新してJSONを再生成します。
- 選手が抜けても `public/assets/players/<背番号>.webp` は消しません。`tools/compose-player-number.js` が
  既存タイルから数字の字形を borrow するため（`DIGIT_SOURCES` に `1` `2` `5` `6` `7` `8` `9` `10` `40` を指定）、
  消すと背番号一覧画像に無い選手のタイルを作れなくなります。選手一覧に出るかどうかは
  `players.json` に載っているかで決まり、画像ファイルの有無とは関係しません。
- 個人のスカッド作成内容はこのJSONに含めません。LocalStorageで扱います。
