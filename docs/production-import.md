# 本番サーバーからの取り込み手順

## 索引

| 知りたいこと | 節 |
| --- | --- |
| なぜ取り込むのか | 目的と前提 |
| 何が起きるか | 取り込みの流れ |
| 実行方法 | GitHub Actionsからの実行 / 手元での実行 |
| 取り込まないもの | 取り込み対象の分類 |
| 取り込んだ後 | 取り込み後の扱い |

全文を読む必要はありません。該当する節だけを引いてください。

この文書は、リポジトリ外で本番サーバーへ直接置いたファイルを、GitHub管理下へ一度きりで取り込むための手順です。本番へ反映する向き（リポジトリ → サーバー）は `docs/deploy-policy.md` を正とします。

## 目的と前提

本番反映は `.github/workflows/deploy-production.yml` が `public/` 配下をFTP同期します。FTP-Deploy-Actionはサーバー上の `.ftp-deploy-sync-state.json` を基準に差分を反映するため、**リポジトリ外でサーバーへ直接置いたファイルは、同期の対象外のまま取り残されるか、状態ファイルの内容によっては削除される可能性があります。** 履歴もレビューも残らないため、リポジトリ側へ取り込んで正本を一本化します。

前提:

* 取り込み処理は本番サーバーに対して読み取りしか行いません。アップロードも削除もしません。
* 認証情報はGitHub Secretsにのみ置き、リポジトリには保存しません。登録するSecretは `docs/deploy-policy.md` の「Repository Secretsの登録」と同じものです。
* 取り込み後の本番反映は、これまでどおり手動デプロイの明示的な指示がある場合だけ行います。

## 取り込みの流れ

1. FTPでログインし、`STAR_SERVER_REMOTE_DIR` 配下を再帰的に一覧する。
2. `public/` に同名ファイルがあるかで分類する。
3. 一覧を `tmp/production-import/inventory.md` と `inventory.json` に出力する。
4. 取り込み候補をダウンロードし、`public/` へ配置する。
5. `npm run check:static` を実行し、ドラフトPRを作成する。

`tmp/` は `.gitignore` の対象で、一覧やダウンロード物はコミットされません。コミットされるのは `public/` へ配置したファイルだけです。

## 取り込み対象の分類

| 分類 | 内容 | 既定の扱い |
| --- | --- | --- |
| リポジトリ管理済み | `public/` に同名ファイルがある | 取り込まない。内容差分は人が確認する |
| 取り込み候補 | `public/` に無い公開物 | ダウンロードして `public/` へ配置する |
| 要判断 | `.htaccess`、`.php`、`.cgi`、`.pl`、`.py`、`.sh`、`.conf`、`.ini` | 自動配置しない。`--include-review` を明示した場合のみ取り込む |
| サイズ超過 | `--max-bytes`（既定20MB）を超えるファイル | ダウンロードせず一覧にだけ載せる |
| 除外 | `.ftp-deploy-sync-state.json`、`.DS_Store`、`Thumbs.db`、`.git/`、`.well-known/` | 取り込まない |

サーバー設定や動的スクリプトを「要判断」に分けているのは、`public/` へ置くと本番の挙動そのものを変えるためです。シンボリックリンクは実体の所在を判断できないため、一覧にも取り込みにも含めません。

## GitHub Actionsからの実行

認証情報を持つのはGitHub Actionsだけなので、通常はこちらを使います。

1. GitHubで `Actions` タブを開く。
2. `本番サーバーからの取り込み` ワークフローを選ぶ。
3. `Run workflow` を選ぶ。
4. `mode` を選ぶ。
   * `inventory`: 一覧だけ作る。まずこちらで内容を確認する。
   * `import`: 取り込んで `public/` へ配置し、ドラフトPRまで作る。
   * `backup`: サーバー上の全ファイルを取得し、成果物として残す。本番デプロイ前の退避用。
5. 必要な場合だけ `include_review` を有効にする。
6. 実行後、実行ページのサマリーに表示された一覧を確認する。同じ内容は成果物 `production-inventory` （`inventory.md` と `inventory.json` を含むzip）からも取得できる。
7. `import` を選んだ場合は、作成されたドラフトPRの差分を確認する。

`import` は `npm run check:static` に成功した場合だけPRを作成します。`public/` に差分がない場合はPRを作りません。

PRの自動作成には、リポジトリ設定 Settings → Actions → General → Workflow permissions の「Allow GitHub Actions to create and approve pull requests」が必要です。無効の場合、取り込んだ内容は `import/production-<日時>` ブランチへpushされたうえで、実行サマリーにPR作成用のリンクが出ます。ジョブは失敗しません。この設定を有効にするかどうかは、リポジトリ所有者が判断します。

## 本番デプロイ前のバックアップ

`docs/deploy-policy.md` は本番反映前のバックアップを求めていますが、デプロイのワークフロー自体はバックアップを作りません。`mode: backup` がその退避を担います。

`backup` は分類も除外も行わず、サーバー上のすべてのファイルを取得します。`.ftp-deploy-sync-state.json` も含めます。差分ではなく「その時点のサーバーの写し」を残すことが目的で、`public/` へは何も配置しません。

成果物は `production-backup-<実行番号>` という名前で90日間保存されます。復元するときは、成果物を展開して `STAR_SERVER_REMOTE_DIR` 配下へアップロードします。

取得中にファイルが取れなかった場合、処理は途中で失敗します。欠けたまま完成したように見えるバックアップを作らないためです。失敗した場合は原因を確認し、取り直してからデプロイしてください。

## 手元での実行

FTP認証情報を安全に扱える環境でのみ実行します。値をシェル履歴やファイルへ残さないでください。

```bash
export STAR_SERVER_HOST=...
export STAR_SERVER_USER=...
export STAR_SERVER_PASSWORD=...
export STAR_SERVER_REMOTE_DIR=./

# 一覧だけ作る
node tools/fetch-production-files.mjs

# 取り込み候補を取得して public/ へ配置する
node tools/fetch-production-files.mjs --mode download --apply
```

| オプション | 意味 |
| --- | --- |
| `--mode inventory`（既定） | 一覧のみ作る |
| `--mode download` | 取り込み候補をダウンロードする |
| `--mode backup` | サーバー上の全ファイルを取得する（分類・除外なし） |
| `--apply` | ダウンロード物を `public/` へ配置する（`--mode download` と併用） |
| `--include-review` | 「要判断」も対象に含める |
| `--out <dir>` | 出力先（既定 `tmp/production-import`） |
| `--max-bytes <n>` | 1ファイルの上限（既定 20971520） |
| `--verbose` | FTPのやり取りを表示する。パスワードは伏せる |

`STAR_SERVER_PORT` は未設定時に `21`（暗黙FTPSは `990`）、`STAR_SERVER_PROTOCOL` は未設定時に `ftp` を使います。`ftps` は明示FTPS（AUTH TLS）、`ftps-legacy` は暗黙FTPSです。FTPS指定時はデータチャネルも暗号化し、サーバーが対応しない場合は平文へ落とさず失敗します。

## 取り込み後の扱い

* 取り込んだファイルは `public/` 配下の公開物として、以後リポジトリが正本になります。
* PRのレビューでは、個人メモ・運用者メモ・認証情報・未公開情報が含まれていないかを必ず確認します。含まれる場合は取り込まず、サーバー側の配置を見直します。
* マージ後の本番反映は `docs/deploy-policy.md` の手動デプロイ手順に従います。反映前のバックアップは従来どおり実行者が行います。
* 取り込み後は、同じファイルをサーバーへ直接置く運用をやめ、リポジトリ経由に統一します。二重管理のままだと、次のデプロイでどちらが残るか予測できません。

## 実装

| ファイル | 役割 |
| --- | --- |
| `tools/fetch-production-files.mjs` | 一覧作成、分類、ダウンロード、`public/` への配置 |
| `tools/ftp-client.mjs` | 依存なしの最小FTP/FTPSクライアント（読み取り専用） |
| `.github/workflows/import-production-files.yml` | 手動実行ワークフロー。一覧の成果物保存とドラフトPR作成 |
| `tools/check-import-tools.mjs` | `npm run check:tools` の実体。検証用FTPサーバーを立てて取り込みを実行し、走査・分類・取得結果を確認する |

### パスの扱い

FTPのカレントディレクトリは接続内で持ち越されます。相対パスで `CWD` を重ねると降りた先からの相対解決になり、別のディレクトリを見てしまうため、接続直後に `PWD` でログインディレクトリを取得し、`STAR_SERVER_REMOTE_DIR` を絶対パスへ解決したうえで、走査と取得のパスをすべてその絶対パス起点で組み立てます。`STAR_SERVER_REMOTE_DIR` は `./` のような相対指定でも `/home/example/public_html/` のような絶対指定でも動きます。

サーバーが返したファイル名は、そのままローカルのパスには使いません。区切り文字や上位参照を含む名前は取り込まず、一覧の「除外」に「扱えない名前」として記録します。

`npm run check:tools` は、実サーバーと同じく `CWD` を現在位置からの相対で解決する検証用FTPサーバーをその場で立て、相対指定と絶対指定の両方で入れ子ディレクトリを走査できることを確認します。この検証は本番サーバーへ接続しません。

FTPクライアントを自前で持っているのは、`tools/` が追加の依存を持たずNode.js 20だけで動く方針のためです。実装しているのはログイン、`PASV`、`MLSD`（非対応時は `LIST`）、`RETR` だけで、アップロード系のコマンドは持ちません。
