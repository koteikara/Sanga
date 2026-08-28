# WORKLOG.md

## 目的

現在および今後の作業記録の入口です。長期化を避けるため、一定期間ごとに `docs/archive/ai/` へ分割します。

過去の記録:

- `docs/archive/ai/WORKLOG-2026-06-22_to_2026-07-09.md`

## 記録する作業

- 将来の保守に必要な設計判断がある。
- 手動・実機確認の結果を残す必要がある。
- 未確認事項、残課題、互換性上の注意がある。
- PR本文だけでは後から探しにくい。

軽微な文書修正など、PR本文で十分に追跡できる作業は重複記録しません。

## 記録形式

```markdown
## YYYY-MM-DD 作業テーマ

### 変更ファイル

### 変更内容

### 確認結果

### 未確認項目

### 残課題

### 人間が確認すべき点
```

## 現在の記録

新しい記録はこの下へ追加します。

## 2026-08-28 SUPPORTER TIMELINE の企画設計とPhase 1プロトタイプ

### 変更ファイル

- `docs/supporter-timeline-design.md`（新規）
- `docs/news-extraction-research.md`（新規）
- `docs/fan-tools-research.md`（新規）
- `docs/concept/`（新規。元資料HTML2件と構成図）
- `experiments/supporter-timeline/`（新規。Phase 1プロトタイプ）
- `docs/service-scope.md`、`docs/roadmap.md`、`docs/personalization.md`、`docs/project-structure.md`、`AGENTS.md`

### 変更内容

公式情報をサポーター本人の時間軸に統合する非公式ツールの企画設計と、Phase 1の検証用プロトタイプを追加しました。
`docs/service-scope.md` の「ニュース連動カレンダー」構想の後継にあたります。

### 将来の保守に必要な設計判断

**AIによる日時抽出を使わない。** 当初はニュース記事をLLMで解析する設計でしたが、誤抽出を人間が確認する
運用負荷が現実的でないと判断しました。調査の結果、公式記事には `応募期限` `販売開始日時` などの意味ラベルがあり、
**意味ラベルの直下だけを allow-list で解析すれば決定的なパーサで足りる**ことが分かりました。
そのうえで、確実に読めない記事は**日時を抽出せずURLだけ残します**（画像のみ、変更履歴あり、複数イベント、
ラベルなし、日付継承が必要の5条件）。「誤りを人間が直す」のではなく「取れないものは取らない」設計です。

**確定していない日時をICSに出さない。** `matches.json` は57試合中28試合が未確定、18試合が候補日複数です。
`date_precision`（`datetime` / `date` / `candidates` / `unknown`）で画面表示とICS出力を別々に分岐させ、
候補日と日程未定は画面には出してもカレンダーには流しません。購読カレンダーに入った予定は確定情報として
届くためです。

**変更検知はメールを起点にする。** 記事側は日時変更が既存記事の上書きとして反映され、変更前の値が
取り消し線で残ります。素朴に拾うと古い日時を掴むため対象外条件に入れました。代わりに公式メールでは
変更が独立した1通として届くため、そちらを起点にします。

**プロフィールは端末から出さない。** イベント側は `audience`（誰向けかという事実）だけを公開データに持ち、
利用者の属性はLocalStorageに置いて照合も端末内で行います。静的ファイルの配信だけでパーソナライズが成立します。

**シーズンパスは会員種別と独立した軸。** SANGA CREW の等級（`platinum` / `gold` / `regular` / `kids`）と
シーズンパス保有は別で、「ゴールドクルーでシーズンパス保持者」が成立します。`has_season_ticket` を
別キーで持ちます。1試合のチケット販売は5段階に分かれ、同じ試合に販売開始が5件並びます。

**収益化しない。** 公式サイトの利用規約が営利目的の行為を禁止しているため、アフィリエイトは採用しません。
ホテル提案（`tools/hotels/`、中断中）にも同じ判断が及びます。

**出典は記事URLへ直接リンクする。** 規約はトップページへのリンクを求めていますが、記述は「お願い」であり、
日時という誤ると実害が出る情報を扱う以上、利用者がその場で一次情報を確認できることを優先しました。

### 確認結果

ヘッドレスChromium（幅430px、`Asia/Tokyo`）:

- 「次にやること」が直近のACTION 1件を出し、過ぎた段階を飛ばす
- MY予定が公式イベントと同じ日の時系列に混ざる（17:00配布 → 18:10座席へ移動 → 19:00キックオフ）
- チケット絞り込みで販売5段階が並ぶ
- ICS書き出しで日時が確定していないものを除外。時刻はUTC変換、時刻未定は `DTSTART;VALUE=DATE`
- 横スクロールなし、JavaScriptエラーなし

実機:

- **Android** — `.ics` のダウンロードとカレンダーアプリへの受け渡しに成功
- **iOS Safari** — 成功。取り込み前に件数と全件リストのプレビューが出る。`DTEND` も反映される

### 未確認項目

- ニュース記事の実件数（調査で月40件と月96件の開きがある。ニュース一覧の最終ページで確定する）
- 公式サイトのJSON-LDの有無、`sitemap.xml` の内容、CORS
- 公式サイトからの取得可否そのもの（取得できるまでは手入力運用）
- メールのHTML本文に日時があったのか、画像主体で本文が薄いのか

### 残課題

- Phase 2（プロフィール照合）が次の一手の第一候補。詳細は `docs/supporter-timeline-design.md` の「現在地と次の一手」
- ICSは1回きりの取り込みで、日時変更に追随するには購読フィード（`webcal:`）が要る
- MY予定がICSに含まれる。iOSは取り込み前に外せるがAndroidにはその画面がない
- 同時刻イベントの並び順はカレンダーアプリ側に依存し制御できない
- 過去のイベントがタイムラインに残り続ける

### 人間が確認すべき点

- ニュース一覧の最終ページを見て、月あたりの記事数を確定する
- チケット販売スケジュールの常設ページで、先行販売5段階の順序を確認する
- プロトタイプを継続して触り、実データが入る前に表示の過不足を判断する

## 2026-08-25 検証コマンドの集約とアーカイブ検索除外

### 変更ファイル

`package.json`（新規）、`tools/check-static-assets.mjs`（新規）、`docs/ai/EFFICIENCY-BACKLOG.md`（新規）、
`AGENTS.md`、`README.md`、`docs/project-structure.md`、`docs/codex-workflow.md`、`docs/ai/PLAN.md`、
`.gitignore`、`.github/workflows/static-checks.yml`、`.github/workflows/squad-checks.yml`、
`.github/workflows/deploy-production.yml`

### 変更内容

検証コマンドを `package.json` の `npm run check` 系へ集約し、文書とワークフローYAMLの双方から
同じスクリプトを呼ぶようにした。CIのステップ内にPythonで直書きしていたCSS波括弧数チェックと
HTML参照チェックは `tools/check-static-assets.mjs` へ移し、手元でも同一の検証を実行できるようにした。
あわせて `AGENTS.md` に `docs/archive/` を調査時の検索対象から外す旨を明記した。

公開物（`public/` 配下）の変更はない。検証の内容と対象は移設前と同じで、squad.cssの波括弧数と
squad.htmlの参照チェックのみ新規に追加している。

### 確認結果

`npm run check` が全項目成功。matches 57件、players 39件、フォーメーション17件、スタイル8件を確認。
`npm run check:squad:browser`（Playwright）はこの環境では未実行。

### 未確認項目

GitHub Actions上での実行結果。3ワークフローすべてでステップを差し替えているため、PR上のCI結果で確認が必要。

### 残課題

`docs/ai/EFFICIENCY-BACKLOG.md` の課題3〜6（チェックリストのスクリプト移管、インベントリ文書の自動生成化、
必読表の索引方式化、1PR=1ブランチの明文化）。

### 人間が確認すべき点

`--expected-count 57` の定義箇所が `package.json` へ移った点。日程件数を変える際はここを更新する。

## 2026-08-25 文書構成の整理（インベントリ自動生成・索引方式・チェックリスト圧縮）

### 変更ファイル

`tools/generate-dom-inventory.mjs`（新規）、`docs/dom-inventory.md`（新規・自動生成）、
`tools/validate-app-contract.js`、`package.json`、`AGENTS.md`、`docs/project-structure.md`、
`docs/ai/JS_CHANGE_CHECKLIST.md`、`docs/parallel-work-policy.md`、`docs/roadmap.md`、
`docs/ai/EFFICIENCY-BACKLOG.md`、索引を追加した7文書（`data-schema` / `filtering` / `squad-builder` /
`display-modes` / `operation-flow` / `deploy-policy` / `personalization`）、
`docs/archive/implementation/` へ移動した3文書（`js-inventory` / `css-inventory` / `html-analysis`）

### 変更内容

`docs/ai/EFFICIENCY-BACKLOG.md` の課題3〜6を実施した。

DOM識別子の一覧を手書きから自動生成へ変えた。`tools/generate-dom-inventory.mjs` が
`app.js` と `squad-builder.js` からid・class・data属性・aria属性・LocalStorageキーを抽出し、
`npm run check:static` が `--check` で実装との差分を検出する。

`JS_CHANGE_CHECKLIST.md` は199行から121行へ縮小した。`validate-app-contract.js` が既に
検証している項目を文書から削り、自動化されていなかった `PANEL_CLOSE_DELAY_MS=240` は
契約チェックへ追加した。残したのは実ブラウザ確認と人間の判断が必要な項目だけ。

`AGENTS.md` の「作業前の必読文書」を「文書の引き方」へ変更し、主要7文書の冒頭へ索引表を置いた。
整理作業前の棚卸し3本は履歴として `docs/archive/implementation/` へ移した。

公開物（`public/` 配下）の変更はない。

### 確認結果

`npm run check` が全項目成功。`generate-dom-inventory.mjs --check` の差分検出は、
生成結果を意図的に書き換えて失敗することを確認済み。

### 未確認項目

GitHub Actions上での実行結果。`check:static` に生成物の差分検出を追加したため、PR上のCIで確認が必要。
実ブラウザでの表示・操作（今回はJavaScriptの挙動を変更していないため影響しない想定）。

### 残課題

なし。新しい効率改善の課題は `docs/ai/EFFICIENCY-BACKLOG.md` の「今後の課題」へ追記する。

### 人間が確認すべき点

棚卸し3本をアーカイブへ移した判断。現行情報として必要なものは `docs/dom-inventory.md` と
`docs/personalization.md` が持っているが、当時の調査内容を現行文書として残したい場合は差し戻す。

