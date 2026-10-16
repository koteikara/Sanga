# 公開サイト入口ページの設計

確認基準日: 2026-10-14

状態: 実装済み。`public/index.html` が入口ページとして動いています（`assets/index.css`、`index-page.js`、
`index-nebula.js`、`index-motion.js`、`public/data/tools.json` 6件）。
2026-09-08に、入口ページ以外の公開ページへ共通トップバーを足しました（「公開ページ共通のトップバー」）。
2026-10-14に、ツールカードの事前出力、ページ別OGP画像、canonical、`sitemap.xml` / `robots.txt`、
アクセス解析の入れ物を足しました（「描画方式とJavaScript無効時の扱い」「ページ共通のメタ情報」「検索エンジン向けのファイル」「アクセス解析」）。
以降の見た目変更は、これまでどおりプロトタイプで確認してから入れます（`docs/ui-prototype-workflow.md`）。

## 索引

| 知りたいこと | 節 |
| --- | --- |
| 何のための設計か | 目的と現状の問題 |
| 各ページから入口へ戻る導線 | 公開ページ共通のトップバー |
| 何を載せるか | 情報構造 |
| データの形 | `tools.json` のスキーマ |
| どう描画するか | 描画方式とJavaScript無効時の扱い |
| メタ情報の方針 | ページ共通のメタ情報 |
| sitemap / robots | 検索エンジン向けのファイル |
| 訪問数の把握 | アクセス解析 |
| 背景の動きをどう作るか | 背景表現の実装方式 |
| 何を自動検証するか | 検証 |
| 進め方 | 実装の段取り |

## 目的と現状の問題

`public/index.html` は本番サーバーの `/` にあたる公開サイトの入口です。ところが現状は次の状態にあります。

```html
<title>京都サンガF.C. 年間スケジュール確認環境</title>
<p>GitHub Pagesで公開する本番反映前の確認用トップページです。</p>
```

訪問者が最初に見るページが「本番反映前の確認用」と自己紹介しています。GitHub Pagesを確認環境として使う方針は変わりませんが、`index.html` 自体は本番の入口であり、記述が実態と食い違っています。

導線も不足しています。公開しているページは5件ですが、`index.html` から辿れるのは2件だけで、求・譲ツール、スライド、2025シーズン日程は直URLでしか到達できません（`docs/production-inventory-audit.md`）。

この設計は、`index.html` を「各ツールへの入口」として作り直すためのものです。

## 位置づけ

* `public/index.html` は公開サイトの入口として、各ツールへの導線を提供する。
* 入口ページ以外の公開ページは、共通トップバーで入口へ戻れるようにする（2026-09-08追加）。
  ツール同士は直接リンクせず、行き来は入口ページを経由する。
* GitHub Pagesは引き続き本番反映前の確認環境として使う。入口ページもそこで確認する。
* 検証用プロトタイプへは導線を作らない（`docs/roadmap.md` の開発方針）。
* 非公式のファン作成物であることを入口で明示する。既存ページと同じ趣旨の表記を置く。

## 公開ページ共通のトップバー

2026-09-08時点。正本は `public/assets/topbar.css` です。

直URLで共有されたページに来た人が入口へ戻れないままだったため、入口ページ以外の公開ページに
同じ地のバーを置きました。中身は2つで、**アイコンは作成者のX**（入口ページと同じ）、
**`SANGA TOOLBOX` は入口ページ**へ向きます。

| ページ | 読み込む | アイコン | SANGA TOOLBOX |
| --- | --- | --- | --- |
| `sanga202627season.html` | `assets/topbar.css` | X | `index.html` |
| `squad.html` | `assets/topbar.css` | X | `index.html` |
| `timeline.html` | `assets/topbar.css` | X | `index.html` |
| `timeline-calendar.html` | `assets/topbar.css` | X | `index.html` |
| `away.html` | `assets/topbar.css` | X | `index.html` |
| `home.html` | `assets/topbar.css` | X | `index.html` |
| `sanga2025season.html` | `assets/topbar.css` | X | `index.html` |
| `sanga_slides.html` | `assets/topbar.css` | X | `index.html` |
| `TradePost/index-v1.html` | `../assets/topbar.css` | X | `../index.html` |

`index.html` は読み込みません。入口ページのバーは `assets/index.css` に自前で持っており、
ページ内アンカー（TOOLS / ARCHIVE / ABOUT）と背景の動きを止めるボタンを持つ点が違います。

### 画面に固定しない

**バーは通常のフローに置き、スクロールすればそのまま流れて消えます。**
2026-09-08の実機確認で「固定は邪魔になる場面が出てきそう」という判断があり、
それまでの `position: fixed` をやめました。固定をやめたことで次がまとめて要らなくなっています。

- 高さぶんを空けるための `body` の `padding-top`
- その計算に使っていた `--topbar-h` の宣言
- ダイアログや画像生成画面と重ね順を取り合わないようにする指定

`--topbar-h` を宣言しないため、SUPPORTER TIMELINEの貼り付き見出しは画面上端で止まります。
参照していた `assets/timeline.css` の `top` と `assets/timeline.js` の監視位置も削除済みです
（2026-09-08）。リポジトリ内に `--topbar-h` を使う場所はもうありません。

`assets/squad.css` にあった `--topbar-gap: 16px` は削除済みです（2026-09-08）。
リポジトリ内に `--topbar-gap` を使う場所はもうありません。

### 幅いっぱいに見せるための2つの指定

公開ページの `body` はページごとにばらばらで、そのまま置くと帯が本文の幅に縮みます。
`topbar.css` 側で吸収しています。

| 指定 | 効く相手 | 無いとどうなるか |
| --- | --- | --- |
| `margin-inline: calc(50% - 50vw)` | `body` に左右の余白があるページ（予想スカッド、スライド） | 帯がページの余白の内側に収まり、下の罫線が画面端まで届かない |
| `align-self: stretch` | 縦並びの flex で中央寄せしている `body`（予想スカッド、2025シーズン日程） | 帯が中身の幅（実測220px）に縮む |
| `body.topbar-row` の折り返し | 横並びの flex の `body`（年間スケジュールだけ） | 帯が本文の隣に並び、実測で幅220px・高さ2850pxの縦帯になる |

`body.topbar-row` は `public/sanga202627season.html` の `<body>` にだけ付けています。

`margin-inline` に `vw` を使うため、クラシックなスクロールバーを出すデスクトップブラウザでは
スクロールバーの幅ぶん横に溢れる可能性があります。スマートフォン最優先のため、そのままにしています。

### ページ側の上余白との折り合い

バーはページの `body` の中に置くので、`body` が上余白を持っているとその内側から始まります。
そろえるために、次の2ページは上余白を `body` から中身側へ移しました。

| ページ | 直し方 |
| --- | --- |
| `squad.html` | `assets/squad.css` の `body` から上余白20pxを外し、`.proto-title` で取る（2026-09-08） |
| `sanga_slides.html` | `body { margin: 20px }` を `margin: 0; padding: 0 20px 20px` にし、`table` の `margin-top: 10px` と `caption` の10pxで元と同じ20pxを保つ（2026-09-08） |

どちらも見た目の余白は変えていません。今後 `body` に上余白を持つページを足すときは、
同じように中身側へ移してください。

### 画像生成画面では隠す

年間スケジュールの画像生成画面は操作UIを隠す画面なので、`body:has(.phone.is-screenshot-mode)` で
バーも隠します。`:has()` が無いブラウザではバーが残りますが、生成画像の対象は
`[data-share-capture-target]` の中だけなので画像には入りません。

## 情報構造

ポートフォリオサイトの並べ方を採ります。参考にしたのは https://sato-takaaki.work/ の構成です（見た目のテイストは異なります）。

その構成の要点は3つです。

1. **見出しで区切らない。** 作品を等間隔のグリッドに流す。
2. **分類は見出しではなくカード下のテキストで示す。** 参考サイトは「ART DIRECTION , WEB DESIGN」のような短い分類タグだが、道具箱では `description` の1文をそのまま置く。分類より用途のほうが、訪問者が選ぶ助けになるため。
3. **一枚絵が主役。** 画面のスクリーンショットを色の面に載せ、その面の色が作品ごとの目印になる。

これを道具箱に置き換えると、作品＝ツールになります。訪問者は「何ができるページか」を、説明文より先に画面の絵で判断できます。

区分は2つに減らします。

| 区分 | 内容 | 掲載するもの |
| --- | --- | --- |
| 現役 | 今使えるツール | サポータータイムライン、年間スケジュール、予想スカッド、過密日程カレンダー、求・譲 投稿フォーマット、アウェイ遠征ガイド、ホーム観戦ガイド |
| 過去のページ | 更新していないが残しているもの | 2025シーズン日程、選手が思う"サンガのみりょく" |

以前は「主要ツール／補助ツール／過去のページ」の3区分でしたが、主要と補助を分ける見出しをやめました。3つしかないツールを2つの見出しで割ると、グリッドが細切れになって参考サイトの利点（等間隔に流れる一覧性）が消えるためです。用途の限定は説明文で表せます。

過去のページを載せるのは、直URLで共有されている利用者が戻ってこられるようにするためです。`ARCHIVE` の小見出しの下にまとめ、サムネイルの不透明度を落として、現役のツールと同じ強さでは見せません。

将来ツールが増えた場合（`docs/service-scope.md` のニュース連動カレンダーなど）は、現役のグリッドに足します。区分自体を増やす場合はこの文書を更新します。
2026-09-08に過密日程カレンダー（`calendar.html`）を現役へ足しました。並びは予想スカッドの次です。
2026-09-09にサポータータイムライン（`timeline.html`）を現役の先頭へ足しました。販売開始の締切がある唯一のツールで、見落とすと取り返しがつかないためです。サムネイルは初回の使い方を閉じた状態（`localStorage` の `sanga-timeline-tour-v2` を `done` にして）で撮ります。
2026-10-15にアウェイ遠征ガイド（`away.html`）を現役の末尾へ足しました。アフィリエイト（PR）を含むため、カードの説明文にも「PRを含みます」と書きます。日程ページ（timeline・年間スケジュール）からはリンクしません（2026-07-09の方針。`docs/hotels-operation-flow.md`）。
2026-10-16に現役の並びを、サポータータイムライン・年間スケジュール・予想スカッド・過密日程カレンダー・ホーム観戦ガイド・アウェイ遠征ガイド・求・譲 投稿フォーマットの順にしました（運営者の指定。観戦ガイド2つを並べ、求・譲を末尾へ）。ホーム観戦ガイドのサムネイルは、ページ上部に観戦ガイドの切り替えを足したので撮り直しました。
2026-10-16にホーム観戦ガイド（`home.html`）をアウェイ遠征ガイドの次へ足しました。考え方はアウェイ遠征ガイドと同じで、説明文に「PRを含みます」と書き、日程ページからはリンクしません。サムネイルはページの頭（行き方の欄）を撮っています。

### サムネイル

各ツールを実際にブラウザで開いて撮ったスクリーンショットを使います。作り絵ではなく実物を出すのは、入口の絵と遷移先が食い違わないようにするためです。

* 撮影幅はスマホ相当（430×880）。ツールがスマホ前提であることを絵でも示す。
* 出力は WebP、344×704、品質0.82。5枚あわせて約130KBに収まる。
* そのツールらしさが一番出る位置まで送ってから撮る（予想スカッドならピッチ）。
* 撮り直しの手順は `docs/ui-prototype-workflow.md` に置く。ツールの見た目を変えたら撮り直す。

## `tools.json` のスキーマ

入口ページに載せるツールは `public/data/tools.json` で管理します。ツールの追加・削除・文言変更をHTMLの編集なしで行えるようにするためです。

### 項目

| キー | 型 | 必須 | 内容 |
| --- | --- | --- | --- |
| `id` | 文字列 | 必須 | ツールの識別子。英小文字とハイフン。一意 |
| `name` | 文字列 | 必須 | 入口ページに出す名前。ページの `<title>` と揃える必要はなく、一覧で分かりやすい表記にする |
| `description` | 文字列 | 必須 | 1文の説明。何ができるページかを書く |
| `href` | 文字列 | 必須 | `public/` からの相対パス。同一サイト内のみ。外部URLは扱わない |
| `section` | 文字列 | 必須 | `live` / `archive` のいずれか。上記の2区分に対応する |
| `thumb` | 文字列 | 必須 | サムネイル画像への相対パス |
| `accent` | 文字列 | 必須 | サムネイルの背景に敷く色。`#rrggbb` |

### JSONの形

```json
{
  "updatedAt": "2026-08-26",
  "tools": [
    {
      "id": "season-schedule",
      "name": "年間スケジュール",
      "description": "2026/27シーズンの試合日程を確認し、参戦予定を保存できます。",
      "href": "sanga202627season.html",
      "thumb": "assets/thumbs/season-schedule.webp",
      "accent": "#7b0064",
      "section": "live"
    }
  ]
}
```

### 決めたこと

* 掲載順は配列の順序に従う。並べ替え用の項目は持たない。順序を変えたいときは配列を並べ替える。
* `section` は固定の2値にする。自由な文字列にすると表示側が壊れるため、検証で弾く。
* サムネイルは持つ。当初は「決まってから足す」としていたが、ポートフォリオ型の構成では絵が主役になるため必須にした。
* `description` はカードに出す。短い分類タグも試したが、道具箱では「何ができるページか」のほうが選ぶ助けになるため、1文の説明に統一した。
* 個人メモ、運用者メモ、認証情報は含めない（`AGENTS.md`）。

## 描画方式とJavaScript無効時の扱い

ツールの正本は `tools.json` のままです。データ変更だけでツールを追加できる形は変えていません。

カードのHTMLは `tools/build-seo.mjs` が `tools.json` から組み立て、`index.html` の
`<!-- tools:begin -->` と `<!-- tools:end -->` の間に書きます（2026-10-14から）。
JavaScriptを動かさない検索エンジンにも、JavaScriptが無効な人にも同じ一覧が見えるようにするためです。

* `index-page.js` は事前出力されたカードがあればそれを使い、スクロールに合わせた出現演出だけを付ける。
* 出現演出でカードを隠すのは、JavaScriptが `reveal-ready` を付けたときだけ。JavaScriptが無効でもカードは見えたまま。
* `tools.json` を変えたら `npm run generate:seo`（`npm run fix:asset-versions` からも呼ばれる）でカードを書き直す。
  書き忘れは `npm run check:seo` が検出する。

以前は `<noscript>` に現役ツールの素のリンク一覧を書き、JavaScriptで `tools.json` から描画していました。
事前出力で同じ役目を果たせるうえ、JavaScript無効時に一覧が2回出てしまうため、`<noscript>` は外しました。
`index-page.js` には、事前出力が無いHTMLのときだけ `tools.json` から組み立てる従来の処理を残しています。

`tools.json` を読むときの読み込みパスは既存ページと同じく、絶対パスと相対パスの順で試します。本番サーバーとGitHub Pagesでルートが異なるためです（`public/assets/squad-builder.js` と同じ方式）。バージョンクエリも既存ページに合わせて付けます。

## ページ共通のメタ情報

現状は `TradePost/index-v1.html` に `description`、`squad.html` に favicon があるだけで、OGPはどのページにもありません。SNSで共有されたときの見え方が揃わないため、全公開ページで揃えます。

| 項目 | 方針 |
| --- | --- |
| `description` | 全ページに置く。そのページで何ができるかを1文で書く。原則として入口ページの `tools.json` の `description` と同じにする（例外は後述） |
| favicon | `squad.html` にあるSVGデータURIを全ページで共有する。外部ファイルにはせず、現状の方式を踏襲する |
| `og:title` / `og:description` | 各ページの `<title>` と `description` に合わせる |
| `og:type` | `website` |
| `og:url` | 本番の公開URL |
| `og:image` | 主要8ページはページ別の画像（`assets/ogp/*.jpg`）、入口ページとアーカイブ2ページは共通の `assets/ogp.jpg`。いずれも1200×630。`twitter:card` は `summary_large_image` |
| `og:image:alt` | 画像に描いた文字と合わせる |
| canonical | `og:url` と同じ本番URL |

`og:image`、`og:image:alt`、`og:url`、canonical は `tools/build-seo.mjs` の `PAGES` の表が正本です。
ページのHTMLを手で直しても、次の生成で表の値に戻ります。

### OGP画像

`experiments/site-index/ogp-source.html` を1200×630で描画し、JPEG品質88で書き出しています。PNGだと452KBになりますが、見た目の差が分からないままJPEGで53KBに収まります。

入口ページとアーカイブ2ページはこの共通画像です。

主要ページ（タイムライン、カレンダーで受け取る、年間スケジュール、予想スカッド、過密日程カレンダー、求・譲）は
ページ別の画像にしました（2026-10-14）。2026-10-15にアウェイ遠征ガイド、2026-10-16にホーム観戦ガイドを足し、いまは8ページです。共通画像の背景と2体のキャラクターを土台にし、
左にキャラクター、右にページ名と1行の説明を置いています。ページごとの違いは、`tools.json` のカード色に寄せた
アクセントの線と背景の差し色です。クラブの紋章やマークは使わず、このサイトのキャラクターと文字だけで作っています。

| 画像 | 型 | 生成 |
| --- | --- | --- |
| `assets/ogp.jpg` | `experiments/site-index/ogp-source.html` | ヘッドレスブラウザで撮影（手作業） |
| `assets/ogp/*.jpg` | `tools/ogp/ogp-page.html` | `node tools/ogp/make-ogp.mjs` |

ページ別画像の文言と色は `tools/ogp/make-ogp.mjs` の `PAGES` にあります。文言を変えたら再実行して画像をコミットし、
`tools/build-seo.mjs` の `alt` も合わせます。文字は Google Fonts の Noto Sans JP を読むため、ネットにつながる環境で実行します。
Playwright はプロジェクトの依存ではないので、見つからないときは `PLAYWRIGHT_MODULE` で場所を指します。
画像のURLに版数は付けていません。差し替えてもSNS側のキャッシュがしばらく古い画像を出すことがあります。

共通画像を作り直すときは、元のHTMLを編集してヘッドレスブラウザで撮り直してください。手順は `docs/ui-prototype-workflow.md` のサムネイル撮り直しと同じ考え方です。

適用したのは `tools.json` に載っている5ページと入口ページです。`sanga2025.html` は `sanga2025season.html` への3秒リダイレクトだけのページなので対象外にしました。滞在する先ではなく、共有される想定もありません。

`description` は原則 `tools.json` の文言と同じにします。入口のカードとページのメタで別々の文を持つと、片方だけ古くなるためです。

ただし `TradePost/index-v1.html` は例外で、元からあった文をそのまま残しています。カードの文より情報量があり、検索から来る人に向いているためです。**カードは一覧で読ませる短い文、ページのメタは検索・共有向けの文と、役割が違う場合があります。** 同じにできない理由があるときは、この文書に書き足してください。

## 検索エンジン向けのファイル

`public/sitemap.xml` と `public/robots.txt` は `tools/build-seo.mjs` が `PAGES` の表から生成します。
手で編集しません。載せるのは入口ページ、主要8ページ、アーカイブ2ページの計11ページで、`priority` も表で決めます。
`robots.txt` はすべて許可し、`sitemap.xml` の場所だけを示します。

ページを足す・外すときは `PAGES` の表を直し、`npm run generate:seo` を実行します。

## アクセス解析

`public/assets/analytics.js` を全公開ページ（`PAGES` の9ページ）の `<head>` から `defer` で読みます。
Cloudflare Web Analytics を使い、Cookie を使わず個人を特定しない集計だけを行います。

* `TOKEN` が空のあいだは何も送らない。2026-10-15にトークンを設定した（Cloudflare 側のサイト名は `sangasanga.stars.ne.jp`）。トークンはページに公開される値で、秘密情報ではない。
* 入口ページの ABOUT に「Cookie を使わないアクセス解析（Cloudflare Web Analytics）を使っています。」と書いている。
* 本番のホスト（`sangasanga.stars.ne.jp`）以外では送らない。GitHub Pages の確認環境や手元の数字は混ざらない。
* 有効にする手順はファイル冒頭のコメントにある。トークンを入れたら `npm run fix:asset-versions` を実行し、本番反映する。

## 背景表現の実装方式

入口ページの背景に、紫の霧が流れる表現（ネビュラ）を置きます。実装は**生のWebGLによるフルスクリーン・フラグメントシェーダー**とし、ライブラリを使いません。

### ThreeUIを検討した結果

同じ表現を提供する [ThreeUI](https://github.com/MengTo/threeui)（MIT）を検討しました。採用しない判断です。

| 調べたこと | 結果 |
| --- | --- |
| パッケージ規模 | `@designcodeio/threeui` は展開後52MB、684ファイル |
| 依存 | `three@0.128` と `three@0.165` を別名で同梱し、さらに peer で `three>=0.149` を要求する。実質3系統 |
| 前提 | React 18/19 と Vite。script タグでは動かない |

このリポジトリはビルド工程を持たず、`package.json` に依存パッケージがありません。入口ページのためだけにReactとビルドを導入すると、スタックが二分し、安定させたばかりのFTP同期にも生成物の扱いを足すことになります。

一方でThreeUIの実装を読むと、**描画本体はcanvasを受け取って `{resize, render, dispose}` を返す素のTypeScript**で、Reactは `useEffect` とObserverを繋ぐ薄い器でした。フレームワークは表現に必須ではありません。

さらに、ネビュラは画面いっぱいの四角形に1枚のフラグメントシェーダーを描くだけの表現です。シーングラフ、カメラ、ジオメトリといった three.js の機能に出番がありません。three.js を同梱すると357KB（gzip 127KB）増えますが、得られるものがないと判断しました。

| 方式 | 追加サイズ | ビルド | 依存 |
| --- | --- | --- | --- |
| ThreeUI | 配信数百KB | 必要 | React、three×3 |
| three.js を同梱 | 357KB（gzip 127KB） | 不要 | three |
| 生WebGL（採用） | 約8KB | 不要 | なし |

### 満たすこと

* **進行的強化として実装する。** WebGLが使えない環境、初期化に失敗した場合は、CSSの背景をそのまま見せる。入口ページの導線が消えないことを最優先にする。
* `prefers-reduced-motion: reduce` では1枚だけ描いて静止させる。真っ暗にしない。
* 画面外・別タブでは描画を止める。
* 画素密度は2倍で頭打ちにする。フラグメントシェーダーの負荷は面積に比例する。
* 文字の可読性を落とさない。ビネットと配色で背景の明るさに上限をかける。

## 検証

`npm run check:static` から実行します。検証コマンドは `package.json` に集約し、ワークフローYAMLへ直接書きません（`AGENTS.md`）。

`tools/validate-tools.js`（新規）で次を確認します。

* `id` が一意で、英小文字とハイフンのみ。
* `section` が `live` / `archive` のいずれか。
* `href` が `public/` 配下に実在する。**リンク切れをここで落とします。** ページを削除・改名したときに入口が壊れたまま気づかない事態を防ぐのが主目的です。
* `href` が外部URLでない。`public/` の外も指していない。
* `thumb` の画像が実在する。
* `accent` が `#rrggbb` の形。
* `name`、`description` が空でない。
* 現役のツールが1件以上ある。0件だと入口から導線が消える。

`tools/check-static-assets.mjs` に次を追加します。

* `index.html` が `tools.json` と入口用JavaScriptを参照していること。
* `<!-- tools:begin -->` と `<!-- tools:end -->` の間のリンク先が、`tools.json` の全件の `href` と一致すること。

`npm run check:seo`（`check:static` から呼ぶ）は、`node tools/build-seo.mjs --check` で
カード、`sitemap.xml`、`robots.txt`、各ページの `og:image` / `og:image:alt` / `og:url` / canonical が生成結果と一致するかを見ます。

## 実装の段取り

見た目を伴う変更のため、`docs/ui-prototype-workflow.md` に従いプロトタイプを先に作ります。

1. ~~**見た目の設計**~~ 済み。紫を基調にし、ポートフォリオ型のグリッドに決めた。
2. ~~**プロトタイプ**~~ 済み。`experiments/site-index/` にあり、GitHub Pagesで確認できる。
3. ~~**`tools.json` と検証**~~ 済み。`public/data/tools.json` と `tools/validate-tools.js`。
4. ~~**本番実装**~~ 済み。`public/index.html` と `assets/index.css` / `index-page.js` / `index-nebula.js` / `index-motion.js`。
5. ~~**メタ情報の統一**~~ 済み。入口ページを含む公開6ページに `description` / favicon / OGP を入れた。
6. 本番反映は `docs/deploy-policy.md` の手順に従う。
7. ~~**検索とSNS向けの土台**~~ 済み（2026-10-14）。カードの事前出力、ページ別OGP、canonical、`sitemap.xml` / `robots.txt`、アクセス解析の入れ物。

## 本番のファイル構成

| ファイル | 役割 |
| --- | --- |
| `public/index.html` | 骨組み。上部バー、見出し、グリッドの器、ABOUT |
| `public/assets/index.css` | 配色、背景、キャラクター、グリッド |
| `public/assets/index-page.js` | 事前出力されたカードに出現演出を付ける。事前出力が無いときだけ `tools.json` から組み立てる |
| `public/assets/index-nebula.js` | 生WebGLの背景。進行的強化として足す |
| `public/assets/index-motion.js` | 動きを止めるかどうかの設定 |
| `public/assets/thumbs/` | 各ツールのスクリーンショット |
| `public/assets/avatar.webp` | 作り手のアイコン |
| `public/assets/analytics.js` | アクセス解析。全公開ページから読む |
| `public/assets/ogp/` | ページ別のOGP画像 |
| `public/sitemap.xml` / `public/robots.txt` | 検索エンジン向け。`tools/build-seo.mjs` が生成 |
| `tools/build-seo.mjs` | カード、sitemap、robots、各ページのOGP・canonical をそろえる |
| `tools/ogp/` | ページ別OGP画像の型と生成スクリプト |

`index-` を頭に付けているのは、`assets/` に日程・スカッドのファイルが同居しているためです。どのページのものかがファイル名で分かるようにしています。

## この設計で決めていないこと

* `TradePost/` に `index.html` が無く `/TradePost/` で到達できない問題（`docs/production-inventory-audit.md` の未解決課題）。入口から `index-v1.html` へ直接リンクすれば導線は成立しますが、URLの見た目としては整えたいところです。
