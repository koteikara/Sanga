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
| `public/data/stadiums.json`（スタジアムと最寄り駅の座標。matches.json の `venue` 略称で引く） | ホテル検索の中心点 |
| 楽天トラベル VacantHotelSearch | `public/data/hotels/{match_id}.json` と `hotel-index.json` |
| `docs/sheets/away-transport.csv`（最寄り駅・アクセス・任意の交通リンク） | `public/data/away-guide.json`（`tools/generate-away-guide.js`） |

- 対象は国内のアウェイ戦（ACL は除く）。宿泊は前泊（試合前日チェックイン）と当日泊（試合の日チェックイン）の2通りで、どちらも2名・1泊。1泊ごとにスタジアムから半径3kmと最寄り駅から半径1kmの2回検索し、それぞれ安い順に6件まで、重なりを除いて最大12件を安い順に並べる（1試合4回のAPI呼び出し、1秒1回）。日程未定の試合は候補日の早いほう。
- 最寄り駅は `stadiums.json` の `station_name` / `station_latitude` / `station_longitude`。座標は「国土数値情報（鉄道データ）」（国土交通省、CC-BY-4.0）を OpenPOI API（https://openpoiapi.com/）で駅名とスタジアム周辺15kmで検索し、いちばん近い同名の駅を採った（2026-10-16確認。出典は `stadiums.json` の `meta.station_source`）。`tools/validate-stadiums.js` が名前の形と、スタジアムから15km以内であることを確かめる。
- 最寄り駅の周りに宿がほとんど無いスタジアムには「宿泊の拠点駅」`hub_name` / `hub_latitude` / `hub_longitude` / `hub_note`（行き方）を置き、駅周辺の検索をそこで行う（2026-10-16）。選び方は、スタジアムへ乗り換えなしか少ない乗り換えで行けて、OpenPOI API で「ホテル」を半径1kmで検索した件数が多い駅。現在: パナスタ→新大阪、メルスタ→東京（高速バス。スタジアム周辺にも駅周辺にも宿が少ないため、遠征の宿泊地として多い東京駅を採る）、埼スタ→浦和、水戸信ス→水戸、フクアリ→千葉、味スタ→調布、ノエスタ→神戸、ハナサカ→天王寺。ページでは「泊まるなら ○○駅周辺」と出す。
- スタジアムの欄には、OpenStreetMap の埋め込み地図（`export/embed.html`、キー不要、`loading="lazy"`）と、Googleマップで周辺の「グルメ／ラーメン／居酒屋／カフェ」を検索するボタン（スタジアム周辺と、拠点駅か最寄り駅の周辺）、市の「ご当地グルメ」をGoogle検索するリンクを置く。
- 料金は、VacantHotelSearch が返す空室プラン（`roomInfo` の `roomBasicInfo` と直後の `dailyCharge`）のうち、`dailyCharge.total`（その日1泊の合計料金）が最安のもの（`stay_charge_total`）。並び順もこの料金。ページでは「2名1泊 ¥○〜」と、2で割った「1人 約¥○」、食事の有無を出す。プランが取れなかった宿だけ `hotelMinCharge`（楽天の説明では「1部屋1泊あたり、税・サービス料込みの最安値の目安」）を「目安」として出す。楽天の説明には `total` が指定人数分かどうかが書かれていないため、実際の応答で `rakutenCharge`・`chargeFlag`（0=1人あたり、1=1室あたり）と突き合わせて確かめる。
- 取得条件・日時（`meta.updated_at`、JST）をページに表示する。広告表記（PR）はページ冒頭と各ホテル欄に出す。
- 見た目は過密日程カレンダーと同じ紫の地・ぼかし（ネビュラ）と紙のカード（`public/assets/away.css`）。試合ごとに大会色の帯（J1 / ルヴァン）、ホテルは写真つきカードを前泊・当日泊の2列で横に流す（2026-10-15、2列化は10-16）。列ごとに件数と「スワイプで他の宿 →」を出し、マウス操作の画面では左右の送りボタンも出す。ホテル名は全角英数字を半角にそろえ（NFKC）、3行まで出す。試合ごとの欄は開け閉めできる（`details` / `summary`。直近の試合と、URL の `#試合ID` の試合だけ最初から開く。ホテルと地図は開いたときに読む。見出しを押したときは中身を620msで伸び縮みさせ（grid の行を 0fr⇔1fr、easeInOutCubic、高さと透明度。時間は `away.css` の `--acc-dur`。JS の保険の時間 900ms はこれより長く保つ）、動きを止める設定〈`prefers-reduced-motion` / 入口ページの切り替え〉ではすぐ切り替える）。試合へ飛ぶ帯は濃い色で、スクロールしても画面の上に貼り付き、いま見ている試合を濃く示す。拠点駅の周りの宿でスタジアムから5kmより遠いものは、スタジアムまでの距離を出さず駅までの距離だけを出す（2026-10-16）。
- ホテルの写真は楽天が返す `hotelImageUrl`（無ければ `hotelThumbnailUrl`）を `img.travel.rakuten.co.jp` から直接読む。画像を複製して置かない。読めないときは写真なしの絵に替える。評価（★と件数）も楽天の値をそのまま出す。楽天ウェブサービスのクレジット（Supported by Rakuten Developers）をページ下に置く。
- A8.net の計測ピクセルは、同じ提携リンクにつきページで1回だけ置く（試合の数だけ表示回数が増えないように）。
- ホテルのリンクは、楽天がアフィリエイトIDつきで返した `hotelInformationUrl` だけを使う。IDをリポジトリに書かない。

### 認証情報

環境変数（または GitHub Secrets）`RAKUTEN_APP_ID` / `RAKUTEN_AFFILIATE_ID` / `RAKUTEN_ACCESS_KEY`。`openapi.rakuten.co.jp` のAPIは accessKey が必須で、許可サイトの判定に **Origin ヘッダー**が要る（Referer だけだと403 `REQUEST_CONTEXT_BODY_HTTP_REFERRER_MISSING`）。既定は `https://sangasanga.stars.ne.jp`、別ドメインなら環境変数 `RAKUTEN_ORIGIN` で変える。リンクにはアフィリエイトIDが含まれる（楽天が返すURLそのまま。アフィリエイトの性質上、公開されるのは避けられない）。`tools/validate-stadiums.js` は公開JSONに認証情報らしい文字列が混ざっていないかも見る。

### 更新

- 自動: `hotels-sync.yml`（毎週月曜 10:00 JST。`.github/workflows/`）。差分があれば下書きPR（`away-guide.json` が変わると `away-guide.js` / `away.html` の版数も変わるため、コミットは `public/` 全体）。デプロイはしない。`github.token` で作ったPRではCIが自動で動かないので、PR画面から閉じて開き直すか、手元で `npm run check` を確かめてからmergeする。
- 手動: `python tools/hotels/build_match_hotels.py --all-away` → `node tools/generate-away-guide.js` → `npm run fix:asset-versions` → `npm run check:static`
- API を呼ばない検証: `--response-file tools/fixtures/hotels/vacant-hotel-search.sample.json`（出力は公開データに含めない）

### 会場・交通の追加

スタジアムが増えたら `stadiums.json` に最寄り駅の名前・座標とともに追加し、`away-transport.csv` に1行足す。交通のアフィリエイトリンクは `transport_label` と `transport_url`（https のみ）に手で入れる。

### A8.net の提携リンク（バス・宿の汎用リンク）

`public/data/affiliates.json` に、エアトリ（夜行・高速バス）とじゃらん（宿）のA8リンクと計測ピクセルを置く。`away-guide.js` が全試合に同じバスリンクを出し、じゃらんは楽天のホテル候補の下に汎用の宿リンクとして出す（ホテルが「準備中」の試合でも出る）。`rel="nofollow sponsored"`、ピクセルは1×1・alt空。`tools/validate-stadiums.js` が `px.a8.net` と `www*.a8.net/0.gif` 以外を拒否する。IDは公開されるものなのでコミットしてよい。

## ホーム観戦ガイド（2026-10-16 実装）

ホーム観戦ガイドとアウェイ遠征ガイドは、ページ上部の切り替え（`nav.guide-switch`、見た目は `away.css`、今いるページに `aria-current="page"`）で行き来できる（2026-10-16）。

サンガスタジアム by KYOCERA に来る人向けの独立ページ `public/home.html`（`assets/home-guide.js`、見た目は `away.css` を共有し `home.css` で足す）。対象は、アウェイから来るサポーター、遠方から泊まりで来る人、泊まらずにスタジアムの周りを歩きたい人（ページには書かない。2026-10-16に冒頭の一文を外した）。アウェイ遠征ガイドと同じく、日程ページからはリンクせず、入口の `tools.json` のカードからだけ辿れる。

### 中身と正本

| 欄 | 中身 | 正本 |
| --- | --- | --- |
| スタジアムへの行き方 | 京都駅（快速・普通・特急）・大阪方面・舞鶴方面（特急まいづる）・バス（京阪京都交通の観戦シャトルバス）・亀岡駅・車・帰りの案内、京都駅・大阪駅・西舞鶴駅からの経路（Googleマップ）、OpenStreetMap の地図。`access[].url` / `link_label` で案内へのリンクを付けられる | `public/data/home-guide.json` の `stadium` / `access` / `routes` |
| 車で来る | 試合の日はスタジアムの駐車場を使えないこと（公式で主催者・関係者専用）と渋滞の注意。試合の日に停められる駐車場（SANGA CREW 会員の駐車場チケット＝Jリーグチケット、保津川下りの駐車場、イオン亀岡店）、予約サービス（akippa・タイムズのB・特P・軒先パーキングのサンガスタジアム周辺の検索結果）、コインパーキングのGoogleマップ検索（亀岡駅、離れて停めてJRで来る八木駅・嵯峨嵐山駅） | `parking`（`match_day_lots` / `services` / `coin_places`） |
| 試合の前後に亀岡を巡る | 亀岡市内に限る。写真は、亀岡市の画像オープンデータ「かめコレ」（CC BY 4.0）を960×540の WebP に縮めて `public/assets/home/` に置いたもの（スタジアム・保津川下り・トロッコ・出雲大神宮）を優先し、無いものは Wikimedia Commons の縮小画像（`upload.wikimedia.org/wikipedia/commons/thumb/…/960px-…`）を直接読む。作者・利用条件・出典（`source_label`）を写真の下に出す（`spots[].photo`、スタジアムは `stadium.photo`）。歩いて（保津川下り、丹波亀山城跡、亀岡市文化資料館）と、電車・バスで（トロッコ亀岡駅、出雲大神宮、鍬山神社、穴太寺、湯の花温泉）に分ける。亀岡駅からの直線距離はページで計算 | `spots`（`reach` が `walk` / `ride`）、`more_spots` |
| 亀岡のグルメ | 亀岡の名物（亀岡牛、丹波の地酒、京野菜と丹波の味、ぼたん鍋、直売所のたわわ朝霧）を紹介し、それぞれGoogleマップで探すボタンを付ける（京都サンガ公式のスタジアムグルメのページは2026-10-16にリンク切れだったので載せない）。スタジアム・亀岡駅周辺と湯の花温泉周辺のお店のGoogleマップ検索 | `specialties`（`map_query` / `map_label` / 任意の `photo`）、`food_places` |
| 泊まる | スタジアムのそばの2軒（ホテルルートイン京都亀岡駅前 187555、サンロイヤルホテル 亀岡駅前 181808）を、楽天トラベルの画像（`featured_hotels[].image_urls`。読めなければ次の候補、最後は絵。ルートインは楽天APIの画像が404のため、2026-10-16に楽天の宿ページの外観写真〈`trvimg.r10s.jp/share/image_up/…`〉を先頭に置いた。試合ごとの空室のカードでも、そばの2軒はこの `image_urls` を先に試す）と楽天トラベルの宿の案内（広告ではないリンク）で出し、次に亀岡市内（湯の花温泉）。じゃらんのA8リンク | `featured_hotels` |
| 試合ごとの空室 | サンガスタジアムのホーム戦（`venues` に書いた会場。ACLのホームも含む）ごとに前泊・当日泊 | `public/data/hotels/{match_id}.json`（楽天API） |

`home-guide.json` は手で書く。所要時間は目安で、運行・営業は公式を優先する旨をページに書いている。出典と確認日は `meta.sources`。`tools/validate-stadiums.js` が形・座標の範囲・`venues` が `matches.json` のホーム戦の会場にあること・そばの2軒のURLの形を確かめる。

### 駐車場の予約サービスと提携リンク

2026-10-16に特P（とくぴー）と A8.net で提携し、`affiliates.json` の `parking_tokup` を `parking.services[tokup].affiliate_key` に書いた（PRの札つき。A8 のリンクは特Pのトップに飛ぶので、説明文で「サンガスタジアム」で検索するよう案内する）。akippa は申請中で、通るまで普通のリンク。タイムズのB・軒先パーキングは提携なしで普通のリンク。以下は当初の記録：駐車場の4サービスは提携していなかったので、普通のリンクで出していた。紹介記事では akippa・特P が A8.net、軒先パーキングがバリューコマースで扱われていたとあるが、どれも数年前の情報で、現在の提携の可否は A8.net 等の管理画面で確かめる必要がある。提携した場合は、`affiliates.json` に A8 のリンクとピクセルを足し、`home-guide.json` の `parking.services[].affiliate_key` にそのキーを書くと、ページは PR の札を付けて提携リンクに切り替える（A8 のリンクは広告主が決めた着地ページへ飛ぶため、サンガスタジアム周辺の検索結果に飛ばせるかは別途確かめる）。

### ホテルの取り方（`build_match_hotels.py --all-home`）

- 1泊ごとに `search_areas` の順に検索する。先頭は `stadium`（スタジアムから半径3km。そばの2軒はここで見つける）、次は `kameoka`（湯の花温泉から半径3km）。区域ごとに安い順で6件まで、重なりは先の区域に残す。
- 並びは、そばの2軒（`featured_hotels` の順、`featured: true`、`area: "stadium"`）→ スタジアム周辺のほかの宿 → 湯の花温泉（`area: "kameoka"`）。1試合4回のAPI呼び出し。
- そばの2軒が取得時点で空いていないときも、ページは2軒を先頭に「取得時点では2名の空室が見つかりませんでした」として出す（知りたいことなので隠さない）。
- `hotels-sync.yml` は `--all-away --all-home` で両方を週1回取り直す。
