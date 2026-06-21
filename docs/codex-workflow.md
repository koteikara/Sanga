# Codex作業共通ルール

## この文書の目的

この文書は、Codexへ作業を依頼するときに毎回書いていた共通ルールを集約し、指示書を短くするためのものです。

今後のCodex作業では、個別タスクの内容に加えて「`docs/codex-workflow.md` の共通ルールに従う」と指定することで、PR作成ルール、変更禁止事項、確認項目、デプロイ前後の注意を共通前提として扱います。

## Codex作業の基本方針

* 既存仕様を壊さないことを最優先にします。
* 変更範囲は必要最小限にします。
* 作業対象外のファイルを変更しません。
* 画面、データ、ドキュメントのどれを変更するPRかを明確にします。
* 公開JSONを変更するPRかどうかを必ず区別します。
* HTML / CSS / JavaScript を変更する場合は、キャッシュクエリとページ下部のバージョン表記を確認します。
* ドキュメントのみのPRでは `public/` 配下を変更しません。
* 不明点がある場合は、推測で大きな変更をせず、安全側に倒して小さく進めます。

## PR作成ルール

PRタイトル、PR本文、作業後の報告は必ず日本語で記載します。

PR本文の見出しは、必ず次の日本語見出しを使います。

```text
概要
変更内容
確認内容
注意点
```

次の英語見出しは使いません。

```text
Motivation
Description
Testing
Summary
```

PR本文には、作業内容に応じて次を含めます。

* 何を変更したか
* 何を変更していないか
* 実行した検証
* GitHub Pagesで確認すべき項目
* 本番デプロイが必要かどうか
* 注意点

Conventional Commits風の接頭辞を使う場合でも、説明部分は日本語で書きます。

## 変更禁止・注意対象

### 原則として勝手に変更しないもの

次のファイルや領域は、作業内容が明示的に変更を求めている場合を除き、勝手に変更しません。

```text
public/data/matches.json
.github/workflows/
tools/
docs/sheets/schedule.initial.csv
package.json
package-lock.json
requirements.txt
.env
認証情報
Secrets
```

### ドキュメントPRでは変更しないもの

ドキュメントのみのPRでは、次を変更しません。

```text
public/sanga202627season.html
public/assets/app.js
public/assets/style.css
public/data/matches.json
```

### UI PRで注意するもの

UIを変更するPRでは、主に次のファイルが対象になります。

```text
public/sanga202627season.html
public/assets/app.js
public/assets/style.css
```

HTML / CSS / JavaScript を変更した場合は、CSS / JavaScript / JSON のキャッシュクエリと、ページ下部のバージョン表記を確認します。

## 表記統一ルール

色枠や状態を説明するときは、次の表記に統一します。

```text
赤色枠
水色枠
枠線あり
```

次の表記は使いません。

```text
赤枠
```

赤色枠・水色枠の意味はページ側で固定しません。

* `赤色枠 = 参戦予定` のように書きません。
* `水色枠 = 気になる` のように書きません。
* 利用者が自由に意味を決める方針を維持します。

## LocalStorage互換性ルール

既存のLocalStorageキーは次のとおりです。

```text
sanga-schedule-button-states-v1
sanga-schedule-layout-v1
sanga-schedule-filter-settings-v1
```

LocalStorageを扱う場合は、次の方針を守ります。

* 既存キーを勝手に変更しません。
* 既存利用者の保存状態を壊しません。
* キーを変更する場合は、移行処理または告知を検討します。
* `sec01`〜`sec38` のID維持を重視します。
* フィルタで非表示にしたカードの状態は削除しません。
* 保存内容削除ボタンの対象を変更する場合は、ボタンや説明文の文言も更新します。

## アクセシビリティ共通要件

すべてのPRで次の項目を必ず実装する必要はありません。ただし、該当するUIを触る場合は確認します。

* アイコンだけで意味を伝えません。
* 色だけで状態を伝えません。
* ボタンには分かりやすいテキストを併記します。
* 開閉UIでは `aria-expanded` を確認します。
* 開閉対象を持つUIでは `aria-controls` を確認します。
* 押下状態を持つボタンでは `aria-pressed` を確認します。
* 動的な結果表示や件数表示では、必要に応じて `aria-live` を確認します。
* キーボード操作時の `focus-visible` を消しません。
* キーボードだけで操作できる状態を保ちます。
* パネルやダイアログを開くUIでは、必要に応じてEscキーで閉じる操作を確認します。
* パネルを閉じた後、操作元へフォーカスが戻るか確認します。
* アニメーションを追加・変更する場合は `prefers-reduced-motion` に配慮します。
* フィルタ結果が0件になったとき、空白だけにせずメッセージを表示します。

## 認証情報・Secrets禁止ルール

認証情報やSecretsの実値は、リポジトリ、ドキュメント、Actionsログへ出さないようにします。

* 認証情報を作成しません。
* `.env` を作成しません。
* APIキーをコミットしません。
* FTP情報をコミットしません。
* サービスアカウントJSONをコミットしません。
* Secretsの実値を書きません。
* ActionsログやドキュメントにSecretsが出ないようにします。
* Public運用時は、リポジトリ内ファイルやActionsログが第三者に見える可能性に注意します。

## 検証コマンド

共通検証コマンドは次のとおりです。

```bash
node tools/validate-matches.js
node --check tools/generate-matches-from-csv.js
node --check tools/validate-generated-matches.js
node --check tools/export-matches-to-sheet-csv.js
node --check public/assets/app.js
```

ドキュメントのみのPRでは、環境や変更内容に応じて実行できる範囲で確認します。実行しない場合は、PR本文や作業後の報告に理由を記載します。

## GitHub Pages確認項目

UI / HTML / CSS / JavaScript を変更した場合は、GitHub Pagesで次を確認します。作業内容に応じて、必要な項目だけPR本文に抜粋して構いません。

```text
□ ページが正常に読み込まれる
□ 38件表示される
□ 2026 / 2027 見出しが自然に表示される
□ 設定パネルを開閉できる
□ 使い方パネルを開閉できる
□ 2列 / 3列 / 4列切替が動く
□ HOME / AWAY / 2026 / 2027 / 未確定 / 枠線あり / 赤色枠 / 水色枠フィルタが動く
□ フィルタ条件がリロード後も残る
□ 保存内容削除で保存状態が削除される
□ カードタップで赤色枠 / 水色枠が切り替わる
□ リロード後もカード状態が復元される
□ スマホ表示で日程欄がゴチャついていない
□ ページ下部のバージョン情報が更新されている
□ 作成者表記が表示される
```

## 本番デプロイ前後の注意

* GitHub Pages確認後に本番サーバーへ手動デプロイします。
* 本番デプロイはGitHub Actionsから手動実行します。
* branchは通常 `main` を使います。
* 本番URLでGitHub Pagesと同じ項目を確認します。
* スマホ実機確認を優先します。
* 古いCSS / JavaScript / JSONが残る場合はキャッシュを疑います。
* CSS / JavaScript / JSON変更時はバージョンクエリを確認します。

## 作業種別ごとの短縮指示テンプレート

### ドキュメントのみPR

```text
docs/codex-workflow.md の共通ルールに従ってください。
今回はドキュメントのみの変更です。
public/、tools/、.github/workflows/、依存関係ファイルは変更しないでください。
```

### UI修正PR

```text
docs/codex-workflow.md の共通ルールに従ってください。
対象は public/sanga202627season.html、public/assets/style.css、public/assets/app.js です。
public/data/matches.json は変更しないでください。
HTML/CSS/JSを変更した場合はキャッシュクエリとページ下部バージョンを更新してください。
```

### データ更新PR

```text
docs/codex-workflow.md と docs/operation-flow.md の共通ルールに従ってください。
docs/sheets/schedule.initial.csv から public/data/matches.json を生成・検証してください。
ID、LocalStorage互換性、公開JSONに出してはいけない列に注意してください。
```

### デプロイ手順PR

```text
docs/codex-workflow.md と docs/operation-flow.md の共通ルールに従ってください。
GitHub Actions、Secrets、FTP情報の実値を絶対に書かないでください。
```

## やってはいけないこと

* 作業対象外のファイルをついでに変更しない。
* ドキュメントのみのPRで `public/` 配下を変更しない。
* 明示的な依頼なしに `.github/workflows/` や `tools/` を変更しない。
* 明示的な依頼なしに `public/data/matches.json` を変更しない。
* 明示的な依頼なしに依存関係ファイルを変更しない。
* `tmp/` 配下の一時ファイルをコミットしない。
* `.env`、認証情報、APIキー、FTP情報、サービスアカウントJSON、Secretsの実値を作成・記載・コミットしない。
* headroomなどのツールを、調査や合意なしにインストールしない。
* `赤枠` 表記を復活させない。
* 赤色枠・水色枠の意味をページ側で固定しない。
* LocalStorageキーや `sec01`〜`sec38` のIDを勝手に変更しない。
* フィルタで非表示になったカード状態を削除しない。
* 本番サーバーへ、明示的な指示なしにデプロイしない。
