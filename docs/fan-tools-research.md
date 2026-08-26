# 世界の非公式スポーツファンツール調査

確認基準日: 2026-08-26

## この調査の目的

個人開発・コミュニティ制作・SNS発のスポーツファン向けツールを分類し、SANGA TOOLBOXに取り入れる価値が高いものを
優先順位付きで整理します。

本調査はドキュメント整理のみを目的とし、実装、依存関係追加、公開HTML/CSS/JavaScript変更、公開JSON変更は行っていません。

閲覧用の元資料（HTML）は `docs/concept/fan-tools-research.html` です。内容の正本は本文書とします。

本資料は公開事例を分類・抽象化した企画整理用の記録であり、各サービスの仕様や公開状況は変更される可能性があります。

## 全体傾向

面白いのは「公式では作りにくい、小さなファン体験」です。
非公式ファンツールは、ニュース・順位・日程の再掲よりも、ファン本人の行動・思い出・予想・収集・SNS共有を支援するものほど個性が強い傾向があります。

主な軸: 観戦記録 / スタメン作成 / 遠征 / 予想 / 思い出化 / SNS共有 / コレクション / チャント

## 実例

| ツール | ジャンル | 何が面白いか | SANGAへの示唆 |
| --- | --- | --- | --- |
| Squadra | スタメン作成 | 短時間でXIを作り、そのままSNS投稿用画像へ | 既存の予想スカッドと親和性が高い |
| Fitbaw Factory | Groundhopping | GPS、XP、バッジ、ランキング、シーズンまとめ画像 | AWAY PASSPORT / Supporter Level |
| Kopio | 観戦キャリア | 見た試合・選手・勝率を「ファンのキャリア」として記録 | MY SANGA RECORD / Seen XI |
| Fanvoyage | 遠征 | アウェイ観戦、集合、チェックイン、ランキング | 遠征支援の発展形 |
| Stadianity | スタジアムレビュー | 雰囲気、食事、コスパ等をファン視点で評価 | AWAY Tips / Stadium Memo |
| ARENAS | 観戦記念 | GPSチェックイン後に観戦記念チケットを生成 | Match Memory / Digital Ticket |
| GoalClash | 予想ゲーム | スコア・スタメン予想＋ランキング | 予想スカッド答え合わせ |
| 38-0 | ドラフト | 選手ドラフト後に仮想シーズンをシミュレーション | 歴代選手ドラフト |
| Eleven | 初心者支援 | 推し選手診断＋SNSカード | 新規ファン獲得系の参考 |
| Ledger No.2 | 野球スコア | 観戦を「自分で記録する行為」に変える | 能動的観戦体験 |
| Chalk & Pixels | 歴史・スコア | 過去試合を遡ってスコアカード表示 | 「この日何の日」系 |
| WeChant | チャント | 録音・共有・投票 | CHANT BOOKの発展形 |

## 共通パターン

1. 公式情報を見やすく再構成
2. 俺のスタメン・俺の予想
3. サポーター自身の記録
4. スタジアム制覇・Groundhopping
5. 観戦を「思い出」に変換
6. 試合を見る行為をゲーム化
7. 初心者をファンに変える

## SNSとの相性

SNSで強いのは「成果物が外へ出る」ツールです。多くの成功パターンは、アプリ内で完結せず、最後に画像やカードが生成されます。

- スタメン画像 / 観戦記録カード / シーズンまとめ / 推し選手診断 / スタジアム制覇率 / スコアカード

設計原則: 「入力 → 結果 → SNSへ貼る → 他の人もやりたくなる」の循環を作ります。

## SANGA TOOLBOX向け 推奨ランキング

| 順位 | 案 | 内容 | 評価 |
| --- | --- | --- | --- |
| 1 | MY SANGA RECORD | 観戦試合数、勝敗、勝率、HOME/AWAY、見たゴール数、スタジアム数を記録 | 既存の年間スケジュールと最も自然につながる。SANGA WRAPPEDの土台 |
| 2 | SANGA WRAPPED | シーズン終了時に「あなたのシーズン」を縦長・正方形画像で生成 | SNS拡散性が高く、年末の定番にしやすい |
| 3 | MATCH MEMORY | 試合結果・写真・一言メモから観戦記念カードやデジタル半券を作る | 「記録」より「思い出」に寄せられる |
| 4 | AWAY PASSPORT | 訪問したJリーグスタジアムを埋め、制覇率・訪問回数・遠征距離を可視化 | Jリーグの遠征文化と相性が良い |
| 5 | MY SANGA BEST XI | 歴代ベスト11、外国籍XI、アカデミーXI、現地で見た選手だけのXI | 既存予想スカッドの資産を流用できる |
| 6 | 予想スカッド答え合わせ | 公式スタメン発表後に的中数と年間的中率を表示 | 既存ツールを継続利用型に進化させられる |
| 7 | SUPPORTER CAREER | 通算観戦数・シーズン数・スタジアム数・遠征数を選手のキャリア風に見せる | 長期利用の理由になる |
| 8 | MATCHDAY DASHBOARD | 当日のキックオフ、開門、天気、持ち物、イベント、座席移動を一画面に | Supporter Timelineと強く接続できる |
| 9 | CHANT BOOK | 現役・過去選手チャント、歌詞、元曲、音声を整理 | 権利処理や音源利用に注意。まずは歌詞・情報中心が安全 |
| 10 | SANGA KIT COLLECTION | 歴代ユニフォーム図鑑＋所有ユニフォームの管理 | 画像権利とデータ整備コストがやや高い |

## 実現しやすさ

既存資産を流用しやすい案:

- 予想スカッド答え合わせ / 歴代BEST XI / MY SANGA RECORD / Season Wrapped / Result Card / 観戦勝率・連勝記録

年間スケジュール、LocalStorage、共有画像生成の既存資産が活かせます。

面白いが後回しでもよい案:

- GPSチェックイン / サポーターランキング / ユーザー投稿レビュー / チャント投稿・投票 / コミュニティSNS / リアルタイム遠征集合

理由: 認証・サーバーDB・モデレーション・位置情報・運用負荷が増えるためです。

## 既存資産との対応

推奨案が、このリポジトリの何を流用できるかを整理します。

| 案 | 流用できる既存資産 | 新規に必要なもの |
| --- | --- | --- |
| MY SANGA RECORD | `public/data/matches.json`（57件）、`sanga-schedule-button-states-v1` の観戦状態 | 観戦実績の集計、勝率・スタジアム数の算出 |
| SANGA WRAPPED | 共有用画像生成（`docs/screenshot-social-share.md`）、上記の集計 | 縦長・正方形レイアウト、年度切り替え |
| MATCH MEMORY | 画像生成、`matches.json` の結果列 | 写真・メモの保存領域（端末内） |
| AWAY PASSPORT | `matches.json` の `venue` / `venue_code`、`home_away` | スタジアムマスタ、訪問記録、距離データ |
| MY SANGA BEST XI | 予想スカッド（`public/squad.html`、`public/data/players.json` 39件、フォーメーション17件） | 歴代選手データ |
| 予想スカッド答え合わせ | 予想スカッドの保存データ | 公式スタメンデータの入手経路 |
| MATCHDAY DASHBOARD | `matches.json`、SUPPORTER TIMELINE のイベントデータ | 当日表示の集約UI |

**最大の分岐点は「歴代選手データ」と「観戦実績データ」を新たに持つかどうかです。**
現在の正本は今季の試合57件と選手39件だけで、過去シーズンのデータはありません。
歴代BEST XIや歴代ユニフォーム図鑑は、データ整備そのものが本体の作業量になります。
一方でMY SANGA RECORD系は、利用者が端末内に貯める個人データなので、正本データを増やさずに始められます。

## 判断メモ

- 個人の観戦実績はLocalStorage中心で扱い、公開JSONには含めません（`AGENTS.md`、`docs/personalization.md`）。
  端末を変えると消えるため、書き出し・読み込みの手段は早い段階で用意する必要があります。
- 選手画像、ユニフォーム画像、チャント音源・歌詞は権利確認が必要です。`docs/source-and-license.md` と
  `THIRD_PARTY_NOTICES.md` に由来と利用条件を残せないものは採用しません。
  公式由来画像の許諾確認は `docs/roadmap.md` 上でも保留中です。
- 認証・サーバーDB・投稿モデレーションを伴う案（GPSチェックイン、ランキング、ユーザー投稿）は、
  現在の構成（静的ホスティング＋手動デプロイ）から外れます。採用するなら構成変更の判断が先です。
- 案を1つ足すごとに公開ページが増えます。追加時は `docs/site-index.md`（入口ページ）と
  `docs/production-inventory-audit.md`（公開物一覧）の更新が必要です。

## 全体構成案

「試合前 → 当日 → 試合後 → シーズン終了」をつなぎます。

```text
年間スケジュール
      │
      ├─ 試合前
      │    ├─ 予想スカッド
      │    ├─ 予想答え合わせ
      │    └─ Supporter Timeline
      │
      ├─ 試合当日
      │    ├─ Matchday Dashboard
      │    ├─ Supporter Timeline
      │    └─ Away Passport
      │
      ├─ 試合後
      │    ├─ MY SANGA RECORD
      │    └─ MATCH MEMORY
      │
      └─ シーズン終了
           ├─ SANGA WRAPPED
           └─ SUPPORTER CAREER
```

## アイデア一覧

| カテゴリ | アイデア |
| --- | --- |
| 観戦記録 | MY SANGA RECORD / 観戦勝率 / 観戦連勝 / 得点目撃数 / Seen Players / Seen XI / 初観戦 / 100試合記念 |
| 遠征 | AWAY PASSPORT / スタジアム制覇率 / 日本地図 / 総移動距離 / 最遠征 / Away Tips / Away費用メモ / 遠征持ち物 |
| 思い出 | MATCH MEMORY / Digital Ticket / Result Card / Match Poster / Monthly Wrapped / Lifetime Wrapped |
| 予想 | スタメン答え合わせ / Score Prediction / Scorer Prediction / 年間的中率 / Match Bingo |
| 歴代選手 | 歴代BEST XI / 外国籍XI / アカデミーXI / 年代別XI / Draft XI / 2択BEST XI |
| クイズ | 今日のサンガクイズ / 背番号クイズ / Career Path Quiz / 写真クイズ |
| チャント | CHANT BOOK / チャント練習 / 新チャント投票 |
| コレクション | 歴代ユニフォーム図鑑 / My Kit Collection / グッズ所有リスト / Wishlist |
| 実用 | Matchday Dashboard / Supporter Timeline / Home Screen Widget / カレンダー連携 |

## 現時点の推奨

- 最優先: Supporter Timeline。公式情報が散らばるという、実際の観戦行動上の困りごとを直接解決できる。
- 次点: MY SANGA RECORD → SANGA WRAPPED。既存年間スケジュールと自然に連携でき、SNS共有にも強い。
- その次: MATCH MEMORY / AWAY PASSPORT / 予想答え合わせ。観戦前・当日・試合後の体験を埋められる。

## 未確定・保留事項

- 各案の採用可否と実装時期は未決定。
- 選手画像・ユニフォーム画像・チャント音源の権利確認は未実施。
- 位置情報・ユーザー投稿を伴う案は、運用体制が決まるまで対象外とする。

## 関連ドキュメント

- `docs/supporter-timeline-design.md`
- `docs/roadmap.md`
- `docs/screenshot-social-share.md`
- `docs/source-and-license.md`
- `docs/site-index.md`
- `docs/service-scope.md`
- `docs/ui-prototype-workflow.md`
- `docs/concept/fan-tools-research.html`
