# 出典・ライセンス管理

確認基準日: 2026-08-21

## 目的

公開データ、画像素材、加工物、第三者製ソフトウェアについて、出典、生成経路、権利確認の状態を区別して記録します。

この文書はリポジトリ内の事実関係を整理する運用記録であり、法的な利用許諾を示すものではありません。不明な素材を「非営利だから利用可能」「出典を書けば利用可能」と判断しません。

## 現在の棚卸し

| 区分 | 対象 | 現在の状態 |
| --- | --- | --- |
| 日程データ | `public/data/matches.json` | 各試合に `source_url` と `source_checked_at` を保持。Jリーグ・京都サンガF.C.等の公開情報を参照 |
| チケット販売スケジュール | `docs/sheets/ticket-sales.2026-08-28.csv` | 公式のチケット販売スケジュールを2026-08-28に確認したスナップショット。全行に `source_url` と `retrieved_at_jst` を保持。保持するのは日時・対象・試合との対応という事実のみで、記事本文・画像は含まない。`experiments/supporter-timeline/` のプロトタイプが参照し、公開物には未反映 |
| 特典チケットの条件 | `experiments/supporter-timeline/benefit-tickets.json` | SANGA CREWの各コースの特典チケット枚数と有効期間を2026-08-28に確認したもの。`sources` に公式ページのURLを保持。プロトタイプが枚数の初期値と利用条件の表示に使う |
| 祝日データ | `public/assets/calendar.js` の `HOLIDAYS`（35件） | 内閣府「国民の祝日について」令和8年（2026年）・令和9年（2027年）を2026-09-08に確認して書き写したもの。出典 https://www8.cao.go.jp/chosei/shukujitsu/gaiyou.html 、機械可読版 https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv 。取り込んだのは祝日法（昭和23年法律第178号）が定める日付そのもので、ページの文章・画像は含まない。内閣府サイトの利用条件ページは確認基準日時点で所在を確認できておらず、利用条件は未確認 |
| 選手データ | `public/data/players.json`、`docs/sheets/players.csv` | 公式サイトを参照して手入力。公式ページの具体的URLと確認日が未記録 |
| 対戦相手ロゴ | `public/assets/logos/` 10件 | `docs/sources/` の画像を複製して配置。元ページURLと利用許諾が未確認 |
| 背番号タイル | `public/assets/players/` 39件 | `docs/sources/players-numbers.jpeg` から切り出した加工物。元ページURLと利用許諾が未確認 |
| スカッド見出し | `public/assets/squad/` 7件 | リポジトリ内のHTML/CSSから生成。生成元は `experiments/squad-builder/assets/*-source.html`。8番目の「シンプル」は画像を使わず文字で表示 |
| スタジアムの座席配置 | `experiments/stadium-3d/layout.json` | サンガスタジアム by KYOCERA「座席案内」の座席図PDF（https://sangastadium-by-kyocera.jp/seat-guide ）と、京都府「京都スタジアム（仮称）インフォメーションパッケージ」平成30年1月 p.15・p.18（https://www.pref.kyoto.jp/sposei/news/documents/11ms.pdf ）を2026-10-07に確認し、`experiments/stadium-3d/extract/build_layout.py` で計算した座標。保持するのは席の位置・列・番号（2026-10-09 から座席図に印刷された番号を読み取ったもの）・ブロック名と資料の寸法という事実で、PDF・図面・画像・文章は含まない。サンガスタジアム by KYOCERA のサイトは、2026-10-07時点でサイトマップに利用規約のページが無く、プライバシーポリシー（https://sangastadium-by-kyocera.jp/privacy-policy ）にも著作物の扱いの記載がないため、利用条件は未確認。検証用プロトタイプでのみ使い、公開物には未反映 |
| スタジアムの位置と向き | `experiments/stadium-3d/sun.js` の `STADIUM` | OpenStreetMap のピッチの形（https://www.openstreetmap.org/way/733921520 、2026-10-09確認）から測った中心の緯度経度と長辺の向きの3つの数値。© OpenStreetMap contributors、ODbL。地図データそのものは含まない。座席ビューの日差しの計算にだけ使う |
| ホーム観戦ガイドの案内 | `public/data/home-guide.json` | 手で書いた行き方・散策・宿の紹介文。散策先とスタジアム・駅の座標は OpenStreetMap（Nominatim の検索結果、© OpenStreetMap contributors、ODbL）の数値を2026-10-16に確認したもの。宿の紹介は楽天トラベルの宿の案内（https://travel.rakuten.co.jp/HOTEL/187555/ 、https://travel.rakuten.co.jp/HOTEL/181808/ ）を確認して自分の言葉で書いたもの。散策先の説明は保津川下り・嵯峨野観光鉄道・亀岡市観光協会・亀岡市・京都府の公開情報を確認して書いた要約で、文章・画像は複製していない。駐車場は各予約サービスの検索結果ページへのリンクだけで、駐車場の一覧や料金は複製していない。試合の日の駐車場（SANGA CREW 会員の駐車場、保津川下りの駐車場、イオン亀岡店）は、Jリーグチケット・保津川下りの案内・ワクタカスポーツのまとめ記事（https://wakutakasports.com/kyoto-soccer-parking/ 、2026-09-19更新。ページからはリンクしない）を確認して自分の言葉で書いた。 |
| ホーム観戦ガイドの写真 | `public/data/home-guide.json` の `stadium.photo`、`spots[].photo` | Wikimedia Commons の写真10点を、Wikimedia のサーバーの960px縮小画像で読み込む（リポジトリには置かない）。写真の下に作者・利用条件・Commons のファイルページを出す。CC0: 出雲大神宮・鍬山神社（Saigen Jiro）、穴太寺（Kuroshiononeko）。CC BY 4.0: 湯の花温泉（ブルーノ・プラス）。CC BY-SA 4.0: トロッコ亀岡駅に停まるトロッコ列車（Streetdeck、2026-10-16に駅舎の写真から差し替え）、スタジアム（J o）、保津川下り（江戸村のとくぞう）、亀岡市文化資料館（さかおり）。CC BY-SA 3.0: 丹波亀山城跡（kamoseiro）。CC BY-SA 4.0: 丹山酒造（Asturio Cantabrio、名物の欄）。名物の紹介文は亀岡市・京都府の公開情報を確認して自分の言葉で書いた。2026-10-16確認 |
| ホーム観戦ガイドの宿の写真 | `featured_hotels[].image_urls` | 楽天トラベルの画像（img.travel.rakuten.co.jp）を直接読む。複製しない出典は同ファイルの `meta.sources` |
| 画像生成ライブラリ | `modern-screenshot` 4.6.5、`html-to-image` 1.11.11 | いずれもMIT License。前者はライセンス全文と取得記録を同梱、後者は検証ページからCDN読込 |
| フォント | CSS・生成元HTMLのfont-family指定 | システムフォントのみ。フォントファイルの同梱なし |
| プロジェクト独自部分 | リポジトリ全体 | ルート `LICENSE` なし。第三者への包括的な利用許諾は未設定 |

## 公式由来画像の対応関係

同一Git blobであることを基準に、元素材と公開側の配置を照合しました。

| 元素材 | 公開側 |
| --- | --- |
| `docs/sources/202405052125_3.png` | `public/assets/logos/fc-maruyasu.png` |
| `docs/sources/logo_myfc.png` | `public/assets/logos/fujieda-myfc.png` |
| `docs/sources/MD1.webp` | `public/assets/logos/ota-hanasichien.webp` |
| `docs/sources/MD2.webp` | `public/assets/logos/rajaburi.webp` |
| `docs/sources/MD3.webp` | `public/assets/logos/newcastle-jets.webp` |
| `docs/sources/MD4.webp` | `public/assets/logos/hoang-anh-hanoi.webp` |
| `docs/sources/MD5.webp` | `public/assets/logos/pohang-steelers.webp` |
| `docs/sources/MD6.webp` | `public/assets/logos/buriram-united.webp` |
| `docs/sources/MD7.webp` | `public/assets/logos/jeonbuk-hyundai.webp` |
| `docs/sources/MD8.webp` | `public/assets/logos/port-fc.webp` |
| `docs/sources/players-numbers.jpeg` | `public/assets/players/*.webp` 39件 |

`docs/sources/779180131_18617683789036083_7571439592477953627_n.jpg` は、確認基準日時点で `public/` に同一blobの配置を確認できませんでした。元ページと保存目的は未記録です。

## 公式サイトの権利表示

確認したページ:

- 京都サンガF.C. 利用規約: https://www.sanga-fc.jp/other/rules
- Jリーグ 著作権について: https://www.jleague.jp/general/copyright/
- Jリーグ プロパティ利用規約: https://aboutj.jleague.jp/corporate/activities/various_rights/property/

確認基準日時点で、京都サンガF.C.の利用規約は、許諾がある場合を除き、サイト上の文書・画像・ロゴ・エンブレム等の複製や転用を認める内容ではありません。Jリーグもクラブの商標権・著作権・肖像権等は各クラブに帰属すると案内しています。

したがって、現在のロゴと背番号加工物は「出典を記載すれば継続利用できる」とは扱いません。許諾の確認、独自表現への差し替え、または削除の判断が必要です。

## 運用ルール

画像、文章、データ、ライブラリ、フォントを追加・更新するPRでは、次を記録します。

1. 元ページの名称とURL
2. 権利者または配布者
3. 取得日・確認日
4. 元ファイルと利用先
5. 加工内容
6. ライセンスまたは利用条件
7. 許諾の有無と確認方法
8. 再配布できる根拠
9. 未確認事項と公開可否

追加時の判断:

- 出典URLだけでは利用許諾の根拠にしない。
- 非営利・非公式であることだけでは複製可能と判断しない。
- GitHubの公開リポジトリ内は、`public/` 以外も第三者が閲覧・取得できる前提で扱う。
- 権利状態が不明な画像は新規追加せず、独自作成の文字・図形・データ表現を優先する。
- 第三者ライブラリはバージョン、上流URL、ライセンス全文、変更の有無を記録する。
- 判断できない場合はコミットせず、権利者への確認または素材の差し替えを選ぶ。

## 未確認事項と次の判断

### 現行公開の暫定判断

2026-08-21時点では、`public/assets/logos/` の対戦相手ロゴ10件と `public/assets/players/` の背番号タイル39件について、利用許諾が未確認であることを認識した上で、差し替え方針が決まるまで既存公開を継続します。これは利用許諾を確認済みとする判断ではありません。

新規の公式由来画像は追加せず、許諾確認、独自表現への差し替え、または削除を別PRで判断します。本番デプロイ時は、この暫定判断が変更されていないことをPRまたはデプロイ実行記録で確認します。

| 優先度 | 対象 | 必要な判断・作業 |
| --- | --- | --- |
| 高 | 公開中の対戦相手ロゴ10件 | 利用許諾を確認する。確認できない場合は文字表記等への差し替えを検討する |
| 高 | 公開中の背番号タイル39件 | 元画像の利用許諾を確認する。確認できない場合は独自生成の背番号表現へ差し替える |
| 中 | `docs/sources/` の画像11件 | 元URL、権利者、保存目的を特定する。不要・未確認素材の削除は別PRで判断する |
| 中 | 選手データ | 参照した公式選手一覧のURLと確認日を次回更新時に記録する |
| 低 | リポジトリ全体のライセンス | オープンソース化するか、権利留保のままにするか所有者が決定する |

## TLSの中間証明書（2026-10-15 追加）

| 項目 | 内容 |
| --- | --- |
| 対象 | `tools/certs/cybertrust-japan-sureserver-ca-g4.pem` |
| 名称 | Cybertrust Japan SureServer CA G4 |
| 配布者 | サイバートラスト株式会社 |
| 取得元 | http://crl.cybertrust.ne.jp/SureServer/ovcag4/ovcag4.crt （葉の AIA。DER を PEM に変換） |
| 公開値の確認 | https://www.cybertrust.ne.jp/ssl/download-ca/sureserver-ov.html を 2026-10-15 に確認。SHA-256 `83:46:92:2C:B8:73:0B:B6:AE:71:AB:03:BF:C4:24:62:F4:16:04:23:D9:07:9B:E6:43:85:62:1A:C5:87:76:72` |
| 発行者 | Security Communication RootCA2（SECOM Trust Systems） |
| 有効期限 | 2029-05-29 |
| 使い方 | `ticket-sales-sync.yml` の `NODE_EXTRA_CA_CERTS`。秘密鍵は含まない |
| 加工 | DER から PEM への変換のみ |
| 許諾 | 認証局が配布する中間証明書。リポジトリに置いて TLS の検証に使う |

`www.sanga-fc.jp` の葉は、この中間証明書がないと Node が検証できません。検証を無効にはしていません。

## 第三者製ソフトウェア

全HTML/CSS/JavaScriptを検索し、外部ライブラリ参照として `modern-screenshot@4.6.5` と `html-to-image@1.11.11` を確認しました。その後、検証用プロトタイプ `experiments/stadium-3d/` で `three@0.170.0`（CDN読込）と、座席データを作る開発用ツールとして PyMuPDF（同梱しない）を使い始めました。一覧とライセンス表示の所在は `THIRD_PARTY_NOTICES.md` を正とします。
