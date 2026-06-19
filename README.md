# Sanga

京都サンガF.C.の年間スケジュールを管理・生成・公開するための非公式サイト運用リポジトリです。

## 公開サイト

* https://sangasanga.stars.ne.jp/sanga202627season.html

## 目的

このリポジトリでは、京都サンガF.C.の年間スケジュール公開サイトを継続的に運用するために、以下を管理します。

* 公開用HTML
* CSS / JavaScript
* 日程データの定義
* Googleスプレッドシート連携の設計
* JSON生成処理
* 将来的な自動更新・自動デプロイ処理

## 基本方針

* 公開サイトはスターレンタルサーバーで運用する
* このリポジトリは開発・管理用として使う
* 日程データの正本は、将来的にGoogleスプレッドシートへ集約する
* 当面の公開表示では `public/data/matches.json` を日程データの正本として扱い、手書きHTMLカードは移行確認用の比較対象にする
* 公開用HTMLに直接データを書き続けるのではなく、JSON等のデータファイルから表示する構成を目指す
* 毎年の更新作業をできるだけ自動化する
* アクセシビリティとスマートフォンでの使いやすさを重視する

## 想定ディレクトリ構成

```text
/
├─ README.md
├─ AGENTS.md
├─ docs/
│  ├─ data-schema.md
│  ├─ operation-policy.md
│  └─ deploy-policy.md
├─ public/
│  ├─ sanga202627season.html
│  ├─ assets/
│  │  ├─ style.css
│  │  └─ app.js
│  └─ data/
│     └─ matches.sample.json
├─ tools/
│  ├─ generate-json.js
│  └─ validate-data.js
└─ sheets/
   └─ schedule-columns.md
```

## 初期段階の運用

当面は、現在公開しているHTMLを `public/sanga202627season.html` に取り込みます。

その後、段階的に以下を進めます。

1. 既存HTMLの構造を整理する
2. CSS / JavaScriptを分離する
3. 日程データをJSON化する
4. Googleスプレッドシートの列設計を確定する
5. スプレッドシートからJSONを生成する
6. 生成したHTML / JSONをスターレンタルサーバーへ反映する


## GitHub Pages確認環境

本番サーバーへ反映する前の簡易確認環境として、GitHub Pagesで `public/` ディレクトリ配下を公開できます。

`.github/workflows/pages.yml` は、`main` ブランチへのpush時とGitHub Actions画面からの手動実行時に、`public/` をPagesへデプロイします。確認用トップページは `public/index.html` で、公開スケジュールページ `sanga202627season.html` へのリンクを置いています。

### 一時Public運用時の注意

* GitHub Freeでは、PrivateリポジトリのGitHub Pagesが使えない場合があります。
* その場合は、確認時のみ一時的にリポジトリをPublicにしてGitHub Pagesを有効化します。
* Publicにした間は、リポジトリ内のファイル、Actions履歴、ログが第三者に見える可能性があります。
* 認証情報、FTP情報、APIキー、`.env`、サービスアカウントJSONなどは絶対に入れないでください。
* 確認後にPrivateへ戻すと、GitHub Pagesはunpublishされる可能性があります。
* 一時Public運用は簡易確認用です。継続運用では、公開専用リポジトリの分離も検討してください。

## 本番反映手順

スターレンタルサーバーへの本番デプロイは、GitHub Actionsの `本番サーバー手動デプロイ` ワークフローを手動実行して行います。自動デプロイは行わず、`confirm` に `DEPLOY` と入力された場合のみ、Repository Secretsに登録したFTP情報を使って `public/` 配下の公開用ファイルだけをアップロードします。

スターレンタルサーバーへ反映する前後の確認手順、GitHub Secrets登録手順、アップロード対象、アップロードしてはいけないファイル、ロールバック方針は `docs/deploy-policy.md` にまとめています。デプロイ時のエラーや公開URLへ反映されない場合の確認方法も、同じ手順書のトラブル対応メモを参照してください。


## キャッシュ更新方針

スマートフォンなどで古いCSSやJavaScript、JSONが残ることを避けるため、公開HTMLではCSS / JavaScriptのURLにバージョンクエリを付けます。

```html
<link rel="stylesheet" href="assets/style.css?v=20260618-2">
<script src="assets/app.js?v=20260618-2"></script>
```

`public/assets/app.js` から `public/data/matches.json` を読み込む場合も、同じ更新単位が分かるバージョンクエリを付けます。

```js
const dataPath = 'data/matches.json?v=20260618-2';
```

CSS / JavaScript / JSONのいずれかを本番反映する場合は、必要に応じて同じバージョン値を更新し、ページ最下部のバージョン情報もあわせて更新します。

## 年間スケジュールページとニュース連動カレンダーの役割

年間スケジュールページの目的と将来拡張方針は `docs/service-scope.md` を参照してください。年間スケジュールページは、試合予定の確認、LocalStorageを使ったパーソナライズ、SNS共有を中心にしたスマートフォン最優先ページとして扱います。

ニュース連動カレンダーは、公式ニュースに分散しているチケット販売開始、イベント申込締切、イベント開催日時などを一元確認するための別サービスとして考えます。ただし、試合ID、大会、対戦相手、会場、関連URLなどは将来連動できるようにします。

スプレッドシート列を完成させる前に、`docs/service-scope.md` の方針に沿って、年間スケジュールページ用の試合シートへ入れる列と、ニュース連動カレンダー側または別の日程イベントデータへ分ける列を検討します。

## スプレッドシート連携準備

将来的にはGoogleスプレッドシートを日程データの正本にしますが、現段階ではGoogle Sheets APIの自動連携や認証情報の作成は行いません。まずはスプレッドシートからCSVを書き出し、確認用JSONを生成する準備段階です。

列定義と入力ルールは `docs/sheets/schedule-columns.md` にまとめています。実際のGoogleスプレッドシート作成時は、シート構成、入力ルール、プルダウン候補、CSV出力手順を整理した `docs/sheets/schedule-template.md` を参照してください。ヘッダー行テンプレートは `docs/sheets/schedule.template.csv`、検証用サンプルCSVは `docs/sheets/schedule.sample.csv` です。

38件分のCSVを最初から手入力せず、現在の正本である `public/data/matches.json` からGoogleスプレッドシート用の初期CSVを生成できます。生成済みの初期取り込み用CSVは `docs/sheets/schedule.initial.csv` です。このファイルは、現在の `public/data/matches.json` から生成した38件分の初期データで、Googleスプレッドシートを新規作成するときに「試合」シートへ取り込んで使います。

```bash
node tools/export-matches-to-sheet-csv.js public/data/matches.json tmp/schedule-from-current-json.csv
```

Googleスプレッドシートへ `docs/sheets/schedule.initial.csv` を取り込んだ後は、状態、ホームアウェイ、ホームアウェイ表示、開催年、注記番号、対戦相手コードなどのプルダウンを設定し、「注記」「設定」「確認」シートも追加します。`docs/sheets/schedule.initial.csv` は初期取り込み用であり、今後の日程データの正本はGoogleスプレッドシート側へ移していく想定です。

`tmp/` 配下はCSV生成・検証用の一時作業ディレクトリです。Googleスプレッドシートへ取り込む初期CSVや、Googleスプレッドシートから出力したCSVは `tmp/schedule-from-current-json.csv`、`tmp/schedule-from-sheet.csv` などに置きます。生成結果確認用のJSONは `tmp/matches.generated.json` に出力します。`tmp/` 配下は `.gitignore` により原則コミットしません。

スプレッドシートで内容を確認・修正した後は、CSVでダウンロードし、`tmp/schedule-from-sheet.csv` として扱います。そのCSVから `tools/generate-matches-from-csv.js` で `matches.json` 形式の確認用JSONを生成して、`tools/validate-generated-matches.js` で検証します。

```bash
node tools/generate-matches-from-csv.js docs/sheets/schedule.sample.csv tmp/matches.generated.json
node tools/validate-generated-matches.js tmp/matches.generated.json
```

本番用38件として確認する場合は、件数チェックも指定します。

```bash
node tools/validate-generated-matches.js tmp/matches.generated.json --expected-count 38
```

生成直後に公開用の `public/data/matches.json` を直接上書きしないでください。まず `tmp/matches.generated.json` を検証し、件数、ID重複、必須項目、日付形式、候補日、状態値、注記番号などを確認します。検証後に内容を目視確認し、問題がない場合だけ `public/data/matches.json` へ手作業で反映します。

本番反映前には、従来どおり公開用JSON向けの検証も実行します。

```bash
node tools/validate-matches.js
```

## 注意事項

* 本番サーバーへのアップロードは、明示的に指示した場合のみ行う
* FTPパスワード、SSH秘密鍵、APIキー、トークンなどの認証情報はリポジトリに保存しない
* `.env` やサービスアカウントJSONなどの機密ファイルをコミットしない
* 公式サイト等の文章や画像を必要以上に転載しない
* 公開情報を利用する場合は、可能な限り出典URLを記録する

## 検証コマンド

日程JSONと既存HTML内の手書き日程カードを確認する場合は、次のコマンドを実行します。

```bash
node tools/validate-matches.js
```

この検証では、`public/data/matches.json` の件数・ID・必須項目・状態値に加えて、日付形式、日付範囲、候補日の昇順、注記番号を確認します。`public/sanga202627season.html` 内に手書き日程カードが残っている場合は、主要項目の一致もあわせて確認します。手書き日程カードを削除した後は、HTML照合をスキップし、`matches.json` 単体の検証結果を成功条件にします。

日程データを目視確認しやすい一覧として出力する場合は、次のコマンドを実行します。

```bash
node tools/export-matches-review.js
```

Markdownファイルとして保存して確認する場合は、次のように実行します。

```bash
node tools/export-matches-review.js > /tmp/sanga-matches-review.md
```

日程データ監査の観点や、誤りが見つかった場合の記録欄は `docs/schedule-audit.md` にまとめています。

## ライセンス・位置づけ

このサイトは非公式の京都サンガF.C.年間スケジュールサイトです。

掲載内容には誤りが含まれる可能性があります。正確な情報は、京都サンガF.C.公式サイト、Jリーグ公式サイト、各大会公式サイト等を確認してください。
