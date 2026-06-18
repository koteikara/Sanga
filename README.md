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

この検証では、`public/data/matches.json` の件数・ID・必須項目・状態値に加えて、日付形式、日付範囲、候補日の昇順、注記番号、`public/sanga202627season.html` 内の日程カードとの主要項目の一致を確認します。

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
