# 本番サーバー反映手順

この文書は、GitHub Pagesで確認した `public/` 配下の公開ファイルを、スターレンタルサーバーへ手動反映する前後の確認手順をまとめたものです。

## 前提方針

* 本番サーバーへの反映は、明示的に作業指示がある場合のみ行います。
* スターレンタルサーバーへアップロードする対象は、原則として `public/` 配下の公開用ファイルのみです。
* GitHub Pagesは本番反映前の簡易確認環境として利用します。
* FTP、SSH、サーバーパスワード、APIキー、トークンなどの認証情報は、リポジトリに作成・保存・変更しません。
* `.env`、秘密鍵、サービスアカウントJSONなどの機密ファイルは、リポジトリにも本番アップロード対象にも含めません。
* 本番反映前に、直前の本番ファイルを必ずバックアップします。

## 本番反映前の確認手順

### 1. ローカル検証

本番へアップロードする前に、リポジトリ内で次の確認を行います。

```bash
node tools/validate-matches.js
node tools/export-matches-review.js
node --check public/assets/app.js
```

確認観点:

* `node tools/validate-matches.js` が成功する。
* `public/data/matches.json` の日程データが38件である。
* ID、日付形式、日付範囲、候補日の昇順、注記番号、必須項目に問題がない。
* `node tools/export-matches-review.js` で確認用一覧を出力できる。
* `node --check public/assets/app.js` でJavaScript構文エラーが出ない。
* `public/data/matches.json` の日程データを意図せず変更していない。

### 2. GitHub Pagesでの画面確認

GitHub Pages上で `sanga202627season.html` を開き、本番反映前の表示・操作を確認します。

確認項目:

* GitHub Pagesで `sanga202627season.html` が表示できる。
* JSON由来の日程カードが表示される。
* 日程カードが38件表示される。
* 2026 / 2027 の年見出しが表示される。
* 第16節が「未定」と表示される。
* 注記付き日程が正しく表示される。
* カードタップで枠色が変わる。
* リロード後もタップ状態がLocalStorageに保存され、復元される。
* 表示列変更が動作する。
* 表示列変更の選択状態がLocalStorageに保存され、リロード後も復元される。
* 使い方ダイアログが開閉できる。
* 使い方ダイアログはキーボード操作や閉じる操作で大きな問題がない。
* 保存内容削除ボタンが動作し、カードタップ状態と表示列設定を削除できる。
* PC表示で大きな崩れがない。
* スマートフォン幅で表示が破綻しない。
* 日程、対戦相手、会場、時刻、注記の表示が意図通りである。

## 本番アップロード対象ファイル

スターレンタルサーバーへアップロードする対象は、原則として `public/` 配下のファイルのみです。

最低限、次のファイルをアップロード対象にします。

* `public/sanga202627season.html`
* `public/assets/style.css`
* `public/assets/app.js`
* `public/data/matches.json`

必要に応じて、次のファイルもアップロード対象にします。

* `public/index.html`
* `public/.nojekyll`

アップロード時は、サーバー上の公開ディレクトリに合わせて、`public/` の中身を公開先へ配置します。リポジトリ管理用のディレクトリやファイルをまとめてアップロードしないでください。

## 本番サーバーへアップロードしてはいけないもの

次のファイル・ディレクトリ・情報は、本番サーバーへアップロードしない方針です。

* `.git/`
* `.github/`
* `docs/`
* `tools/`
* `README.md`
* `AGENTS.md`
* 認証情報
* `.env`
* サービスアカウントJSON
* FTP、SSH、APIキー、トークン類
* その他、公開サイトの表示に不要な開発・運用管理用ファイル

## 本番反映手順

1. 反映前の本番ファイルをローカルなど安全な場所へバックアップする。
2. GitHub Pagesで確認済みのファイルと、アップロード予定ファイルが一致していることを確認する。
3. `public/sanga202627season.html`、`public/assets/style.css`、`public/assets/app.js`、`public/data/matches.json` をアップロードする。
4. 必要な場合のみ、`public/index.html` と `public/.nojekyll` もアップロードする。
5. ブラウザで本番URLを開き、反映後確認を行う。

## 本番反映後の確認項目

本番反映後は、PC表示だけでなく必ずスマートフォン表示でも確認します。

確認項目:

* 本番URLで `sanga202627season.html` が表示できる。
* JSON由来の日程カードが表示される。
* 日程カードが38件表示される。
* 2026 / 2027 の年見出しが表示される。
* 第16節が「未定」と表示される。
* 注記付き日程が正しく表示される。
* カードタップで枠色が変わる。
* リロード後もタップ状態がLocalStorageに保存され、復元される。
* 表示列変更が動作する。
* 使い方ダイアログが動作する。
* 保存内容削除ボタンが動作する。
* CSSやJavaScriptの読み込みエラーがない。
* `public/data/matches.json` 相当のJSON読み込みエラーがない。
* スマートフォン幅で表示が破綻していない。

## ロールバック方針

問題が出た場合にすぐ戻せるよう、反映前の本番ファイルを必ずバックアップします。

* 問題が出た場合は、直前のHTML/CSS/JS/JSONへ戻します。
* `matches.json` のみの不具合であれば、前回の `matches.json` に戻します。
* JavaScript不具合で日程が表示できない場合は、`app.js` を前回版に戻します。
* CSS不具合で表示が崩れる場合は、`style.css` を前回版に戻します。
* HTML構造の不具合でページ全体に影響がある場合は、`sanga202627season.html` を前回版に戻します。
* 複数ファイルの組み合わせで不具合が出た場合は、バックアップした直前一式へ戻します。
* ロールバック後も、本番URLとスマートフォン表示で再確認します。

## 注意事項

* この手順書は、本番反映前後の確認と手動アップロード対象を整理するためのものです。
* この文書の作成・更新だけでは、本番サーバーへのアップロードは行いません。
* 認証情報が必要な作業は、リポジトリ内に認証情報を保存せず、安全な管理方法を別途利用します。

## GitHub Actionsによる手動デプロイ

本番サーバーへの反映は、GitHub Actionsの手動実行ワークフロー `.github/workflows/deploy-production.yml` から行います。自動実行ではなく、GitHub Actions画面で明示的に実行した場合のみ動作します。

### Repository Secretsの登録

GitHubのリポジトリ画面で、次のRepository Secretsを登録します。実値はリポジトリへコミットせず、GitHub Secretsにのみ保存します。

必須:

* `STAR_SERVER_HOST`: スターレンタルサーバーのFTPホスト名
* `STAR_SERVER_USER`: FTPユーザー名
* `STAR_SERVER_PASSWORD`: FTPパスワード
* `STAR_SERVER_REMOTE_DIR`: `public/` の中身を配置するサーバー側ディレクトリ

任意:

* `STAR_SERVER_PORT`: FTPポート番号。未設定時は `21` を使います。
* `STAR_SERVER_PROTOCOL`: FTP方式。未設定時は `ftp` を使います。

登録手順:

1. GitHubで対象リポジトリを開く。
2. `Settings` → `Secrets and variables` → `Actions` を開く。
3. `Repository secrets` の `New repository secret` を選ぶ。
4. 上記のSecret名と値を1件ずつ登録する。
5. 登録後もSecretの値は画面上で再表示できないため、必要に応じて安全な場所で管理する。

### 手動実行手順

1. GitHubで対象リポジトリを開く。
2. `Actions` タブを開く。
3. `本番サーバー手動デプロイ` ワークフローを選ぶ。
4. `Run workflow` を選ぶ。
5. 対象ブランチに `main` を選ぶ。
6. `confirm` に `DEPLOY` と入力する。
7. `Run workflow` を実行する。
8. ワークフローの完了後、本番URLで表示と操作を確認する。

`confirm` が `DEPLOY` 以外の場合、ワークフローは確認入力の検証で停止し、アップロードは行いません。

### ワークフロー内の検証

アップロード前に、ワークフロー内で次の検証を実行します。

```bash
node tools/validate-matches.js
node --check public/assets/app.js
```

どちらかが失敗した場合は、FTPアップロードのステップに進みません。

### アップロード範囲

GitHub ActionsのFTPアップロードでは、`local-dir` を `./public/` に限定します。そのため、サーバーへ送る対象は `public/` 配下の公開用ファイルのみです。

少なくとも次の公開用ファイルがアップロード対象に含まれます。

* `public/sanga202627season.html`
* `public/assets/style.css`
* `public/assets/app.js`
* `public/data/matches.json`

次のリポジトリ管理用ファイルやディレクトリは、アップロード対象に含めません。

* `.git/`
* `.github/`
* `docs/`
* `tools/`
* `README.md`
* `AGENTS.md`
