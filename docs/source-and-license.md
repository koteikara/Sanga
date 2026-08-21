# 出典・ライセンス管理

確認基準日: 2026-08-21

## 目的

公開データ、画像素材、加工物、第三者製ソフトウェアについて、出典、生成経路、権利確認の状態を区別して記録します。

この文書はリポジトリ内の事実関係を整理する運用記録であり、法的な利用許諾を示すものではありません。不明な素材を「非営利だから利用可能」「出典を書けば利用可能」と判断しません。

## 現在の棚卸し

| 区分 | 対象 | 現在の状態 |
| --- | --- | --- |
| 日程データ | `public/data/matches.json` | 各試合に `source_url` と `source_checked_at` を保持。Jリーグ・京都サンガF.C.等の公開情報を参照 |
| 選手データ | `public/data/players.json`、`docs/sheets/players.csv` | 公式サイトを参照して手入力。公式ページの具体的URLと確認日が未記録 |
| 対戦相手ロゴ | `public/assets/logos/` 9件 | `docs/sources/` の画像を加工・複製して配置。元ページURLと利用許諾が未確認 |
| 背番号タイル | `public/assets/players/` 39件 | `docs/sources/players-numbers.jpeg` から切り出した加工物。元ページURLと利用許諾が未確認 |
| スカッド見出し | `public/assets/squad/` 7件 | リポジトリ内のHTML/CSSから生成。生成元は `experiments/squad-builder/assets/*-source.html`。8番目の「シンプル」は画像を使わず文字で表示 |
| 画像生成ライブラリ | `modern-screenshot` 4.6.5、`html-to-image` 1.11.11 | いずれもMIT License。前者はライセンス全文と取得記録を同梱、後者は検証ページからCDN読込 |
| フォント | CSS・生成元HTMLのfont-family指定 | システムフォントのみ。フォントファイルの同梱なし |
| プロジェクト独自部分 | リポジトリ全体 | ルート `LICENSE` なし。第三者への包括的な利用許諾は未設定 |

## 公式由来画像の対応関係

同一Git blobであることを基準に、元素材と公開側の配置を照合しました。

| 元素材 | 公開側 |
| --- | --- |
| `docs/sources/202405052125_3.png` | `public/assets/logos/fc-maruyasu.png` |
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

2026-08-21時点では、`public/assets/logos/` の対戦相手ロゴ9件と `public/assets/players/` の背番号タイル39件について、利用許諾が未確認であることを認識した上で、差し替え方針が決まるまで既存公開を継続します。これは利用許諾を確認済みとする判断ではありません。

新規の公式由来画像は追加せず、許諾確認、独自表現への差し替え、または削除を別PRで判断します。本番デプロイ時は、この暫定判断が変更されていないことをPRまたはデプロイ実行記録で確認します。

| 優先度 | 対象 | 必要な判断・作業 |
| --- | --- | --- |
| 高 | 公開中の対戦相手ロゴ9件 | 利用許諾を確認する。確認できない場合は文字表記等への差し替えを検討する |
| 高 | 公開中の背番号タイル39件 | 元画像の利用許諾を確認する。確認できない場合は独自生成の背番号表現へ差し替える |
| 中 | `docs/sources/` の画像11件 | 元URL、権利者、保存目的を特定する。不要・未確認素材の削除は別PRで判断する |
| 中 | 選手データ | 参照した公式選手一覧のURLと確認日を次回更新時に記録する |
| 低 | リポジトリ全体のライセンス | オープンソース化するか、権利留保のままにするか所有者が決定する |

## 第三者製ソフトウェア

全HTML/CSS/JavaScriptを検索し、外部ライブラリ参照として `modern-screenshot@4.6.5` と `html-to-image@1.11.11` を確認しました。一覧とライセンス表示の所在は `THIRD_PARTY_NOTICES.md` を正とします。
