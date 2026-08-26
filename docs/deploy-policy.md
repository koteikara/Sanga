# 本番サーバー反映手順

## 索引

| 知りたいこと | 節 |
| --- | --- |
| 本番反映の前に何を確認するか | 本番反映前の確認手順 |
| 何をアップロードし、何をしないか | 本番アップロード対象ファイル / アップロードしてはいけないもの |
| 実際の反映操作 | GitHub Actionsによる手動デプロイ |
| 反映後の確認 | 本番反映後の確認項目 |
| 問題が起きたとき | ロールバック方針 / デプロイ時トラブル対応メモ |
| サーバー側にだけあるファイル | サーバー上のリポジトリ外ファイル |

全文を読む必要はありません。該当する節だけを引いてください。

この文書は、GitHub Pagesで確認した `public/` 配下の公開ファイルを、スターレンタルサーバーへ手動反映する前後の確認手順をまとめたものです。

## 前提方針

* 本番サーバーへの反映は、明示的に作業指示がある場合のみ行います。
* スターレンタルサーバーへアップロードする対象は、原則として `public/` 配下の公開用ファイルのみです。
* GitHub Pagesは本番反映前の簡易確認環境として利用します。
* FTP、SSH、サーバーパスワード、APIキー、トークンなどの認証情報は、リポジトリに作成・保存・変更しません。
* `.env`、秘密鍵、サービスアカウントJSONなどの機密ファイルは、リポジトリにも本番アップロード対象にも含めません。
* 本番反映前に、直前の本番ファイルを必ずバックアップします。

## サーバー上のリポジトリ外ファイル

FTPアップロードはサーバー上の `.ftp-deploy-sync-state.json` を基準に差分を反映します。リポジトリ外でサーバーへ直接置いたファイルは、この状態ファイルに載っていないため同期の管理外にあり、状態ファイルの内容によっては次回デプロイで削除される可能性があります。

該当するファイルは `docs/production-import.md` の手順でリポジトリへ取り込み、正本を `public/` に一本化してください。取り込み処理は本番に対して読み取りだけを行い、デプロイは行いません。

## 予想スカッド変更時の追加確認

`public/squad.html`、スカッド用CSS/JavaScript、`players.json` を変更した場合は `docs/ai/SQUAD_BROWSER_CHECKLIST.md` に従います。PR時と本番デプロイ前は `.github/workflows/squad-checks.yml` が次を自動実行します。

```bash
node --check public/assets/squad-builder.js
node --check public/assets/squad-formations.js
node --check public/assets/squad-sample-players.js
node tools/validate-players.js
node tools/validate-squad-contract.mjs
node tools/check-squad-layout.mjs
```

Chromiumレイアウトはスタメン11人を配置した状態で、幅320px・375px・420px、控え0人・5人・9人・12人、17フォーメーション、8スタイルを検証します。いずれかが失敗した場合、本番デプロイはFTPアップロードへ進みません。iPhone SafariのPNG生成やタッチ操作は自動検証の対象外なので、変更内容に応じて実機確認します。

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
* `public/data/matches.json` の日程データが57件である。
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

予想スカッドを変更した場合は、追加で次を確認します。

* 本番URLで `squad.html` が表示できる。
* フォーメーション、選手選択、保存、画像生成の主要操作を確認できる。
* スタイルの件数と並び順が現行仕様に一致する（2026-08-21時点では8種類で、「シンプル」が最下段）。
* CSS/JavaScriptが対象HTMLのバージョンクエリ付きで読み込まれている。
* ページ由来のJavaScriptエラーがない。
* iPhone SafariのPNG生成とタッチ操作は、自動検証の成功だけで完了扱いにせず、変更内容に応じて実機確認する。

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

このWorkflowは本番サーバー上の直前ファイルを自動バックアップしません。`Run workflow` を押す前に、本書「本番反映手順」のバックアップを別途完了し、実行者が確認します。

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

1. 直前の本番ファイルのバックアップが完了していることを確認する。Workflow自体はバックアップを作成しない。
2. デプロイ対象の `main` のcommit SHAを確認し、記録する。
3. GitHubで対象リポジトリを開く。
4. `Actions` タブを開く。
5. `本番サーバー手動デプロイ` ワークフローを選ぶ。
6. `Run workflow` を選ぶ。
7. 対象ブランチに `main` を選ぶ。
8. `confirm` に `DEPLOY` と入力する。
9. `Run workflow` を実行し、実行URLを記録・共有する。
10. 確認入力、スカッド事前検証、日程JSON・JavaScript検証、FTPアップロードがすべて成功したことを確認する。
11. 本番URLで表示と操作を確認する。

`confirm` が `DEPLOY` 以外の場合、ワークフローは確認入力の検証で停止し、アップロードは行いません。

### ワークフロー内の検証

ワークフローは最初に、実行元が `main` であり、確認入力が `DEPLOY` であることを確認します。続いて再利用可能な `squad-checks.yml` でスカッドの構文、データ、静的契約、Chromiumレイアウトを検証し、最後に日程JSONと年間スケジュール用JavaScriptを検証します。

いずれかの確認が失敗した場合は、FTPアップロードのジョブを開始しません。

### アップロード範囲

GitHub ActionsのFTPアップロードでは、`local-dir` を `./public/` に限定します。そのため、サーバーへ送る対象は `public/` 配下の公開用ファイルのみです。

検証用のプロトタイプは `public/` に置かず、リポジトリ直下の `experiments/` だけを正本にしています。`exclude` 設定はActionの既定除外を上書きするため、`.git` 系と `node_modules` を明示的に列挙しています。

公開対象から外したいファイルは、`exclude` に足すのではなく `public/` から取り除きます。除外したファイルは同期の比較対象から外れるだけで、サーバー上の実物は残るためです。

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

## デプロイ時トラブル対応メモ

GitHub Actionsによる本番デプロイで問題が発生した場合は、エラーメッセージとアップロード先の対応関係を確認します。FTPホスト、ユーザー名、パスワード、サーバーパスなどの実値は、手順書やログに記載せず、GitHub Secretsで管理します。

### `server-dir should be a folder (must end with /)`

原因:

* `STAR_SERVER_REMOTE_DIR` の末尾に `/` がない。

対応:

* `STAR_SERVER_REMOTE_DIR` は必ず `/` で終わる値にする。
* FTPログイン直後のディレクトリ直下へアップロードする場合は `./` を指定する。

例:

```text
STAR_SERVER_REMOTE_DIR=./
```

または

```text
STAR_SERVER_REMOTE_DIR=public_html/
```

### `FTPError: 530 Login incorrect.`

原因候補:

* `STAR_SERVER_HOST` が違う。
* `STAR_SERVER_USER` が違う。
* `STAR_SERVER_PASSWORD` が違う。
* FTPユーザー名の形式がサーバー管理画面の表示と違う。
* FTPではなくFTPS指定が必要な可能性がある。

対応:

* Secretsの値は再表示できないため、怪しい場合は再登録する。
* FTPホストには `https://` や末尾 `/` を付けない。
* 管理画面に表示されているFTPユーザー名をそのまま使う。
* 必要に応じて `STAR_SERVER_PROTOCOL` や `STAR_SERVER_PORT` を設定する。

### アップロード成功ログが出ても公開URLに反映されない

原因:

* `STAR_SERVER_REMOTE_DIR` が公開ディレクトリではない場所を指している。
* FTPログイン直後の場所と、Web公開ディレクトリが異なる。

対応:

* FTP上で `.ftp-deploy-sync-state.json` が作成された場所を確認する。
* その場所に `sanga202627season.html`、`assets/`、`data/` があるか確認する。
* 公開URLに対応するディレクトリを `STAR_SERVER_REMOTE_DIR` に指定する。
* FTPログイン直後のディレクトリ直下が公開先であれば `./` を指定する。

### 初回デプロイ時の `.ftp-deploy-sync-state.json`

* 初回デプロイ時にFTP Deploy Actionが同期状態管理用に作成するファイルです。
* 次回以降は差分アップロードに使われます。
* 原則として削除しません。

### 同期が削除できるのは記録済みのファイルだけ

FTP Deploy Actionは `.ftp-deploy-sync-state.json` に記録されたファイルだけを比較対象にします。このActionがアップロードしたことのないファイルは認識されず、リポジトリ側に無くても削除されません。ログの `Server Files:` はサーバー上の実ファイル数ではなく、記録済みの件数です。

サーバーへ直接置いたファイルを消したい場合は、FTPで手動削除します。詳しい経緯と実測値は `docs/production-inventory-audit.md` の「FTP同期が削除できる範囲」を参照してください。

### Node 20 非推奨警告

* 現時点ではアップロード成功可否の直接原因ではありませんでした。
* 今後GitHub Actionsや利用Action側の更新が必要になる可能性があります。
* 継続的に出る場合は、利用しているActionやNode設定の更新を検討します。
