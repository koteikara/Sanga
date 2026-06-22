# UIプロトタイプ運用ルール

## 目的

UIを伴う機能は、先に `experiments/` 配下でプロトタイプを作ります。
GitHub Pagesで見た目・操作感を確認してから、本番ページへ移植します。

文章指示だけで本番実装すると、スマートフォンUI、設定パネル、LocalStorage、画像生成、フィルタ、カード状態などの見た目・操作感に認識ズレが起きやすくなります。先にプロトタイプで確認できる形にすることで、認識ズレや手戻りを減らします。

## 適用する作業

次のように、見た目や操作感への影響が大きい作業では、原則としてプロトタイプを先に作ります。

* 新しいUI部品を追加する
* 設定パネルに大きな機能を追加する
* カード表示の見た目を変える
* 画像生成・保存画面のような専用画面を追加する
* 観戦準備メモのUIを検討する
* 対戦相手別補助情報のUIを検討する
* 共有URL機能のUIを検討する
* 表示モード・列切替など見た目に影響するUIを大きく変える

## 適用しない作業

次のように、見た目や操作感への影響が小さい作業では、プロトタイプは不要です。

* 誤字修正
* 文言の軽微な修正
* データ修正
* バージョン表記更新
* 小さなCSS調整
* 明らかな不具合修正
* ドキュメントだけの更新

## 基本方針

* プロトタイプは本番実装前の検証用として扱います。
* 本番ページへ直接大きなUI変更を入れる前に、プロトタイプで見た目・操作感を固めます。
* プロトタイプでは、必要最小限のHTML / CSS / JavaScriptで検証します。
* 本番ページの既存機能、既存データ、既存LocalStorageキーを壊さないことを優先します。
* プロトタイプで確定していないUIやデバッグ表示は、本番へ持ち込みません。
* 本番ページから検証用プロトタイプへの導線は追加しません。

## ディレクトリ構成

プロトタイプは、次の構成を基本にします。

```text
experiments/<feature-name>/
  README.md
  prototype.html
  prototype.css
  prototype.js

public/experiments/<feature-name>/
  prototype.html
  prototype.css
  prototype.js
```

`experiments/` は検証用ソースとして扱います。
`public/experiments/` はGitHub Pages確認用コピーとして扱います。
本番ページから `public/experiments/` へリンクしません。
GitHub Pages上の検証用URLを直接開いて確認します。

## プロトタイプ作成の流れ

1. docsで目的・対象ユーザー・画面要件を整理する
2. `experiments/` に最小構成のHTML / CSS / JavaScriptを作る
3. `public/experiments/` にGitHub Pages確認用コピーを置く
4. PC Chromeで確認する
5. iPhone Safariで確認する
6. 必要ならスクリーンショットを見ながら調整する
7. 見た目と操作感が固まったら本番移植PRを作る

## GitHub Pagesでの確認

GitHub Pagesでは、次の形式のURLを直接開いて確認します。

```text
https://koteikara.github.io/Sanga/experiments/<feature-name>/prototype.html
```

例:

```text
https://koteikara.github.io/Sanga/experiments/image-generation/prototype.html
```

プロトタイプ確認用URLは、本番ページの通常導線には追加しません。

## 本番移植の流れ

本番移植時は、次の方針を守ります。

* プロトタイプで採用したUIだけを本番へ移す
* 検証用の不要なUIやデバッグ表示は本番へ持ち込まない
* 本番の既存機能を壊さないように、変更範囲を限定する
* LocalStorageキーは必要になるまで増やさない
* `public/data/matches.json` はUI移植では変更しない

## Codexへの指示に含めること

UIプロトタイプ作成や本番移植をCodexへ依頼する場合は、毎回次を含めます。

* 今回やること
* 今回やらないこと
* 壊してはいけないこと
* 変更してよいファイル
* 変更しないファイル
* GitHub Pages確認URL
* PC Chrome確認項目
* iPhone Safari確認項目
* PR本文見出しルール

## 確認観点

UIプロトタイプ確認では、最低限次を確認します。

* スマホ幅で破綻しない
* PC Chromeで表示できる
* iPhone Safariで表示できる
* ボタンが押しやすい
* フォーカス表示が消えていない
* 文字が小さすぎない
* アニメーションが過剰でない
* `prefers-reduced-motion` に配慮できる
* 画像生成や保存など実機依存の機能は実機で確認する
* 本番ページへの導線を追加していない

## 注意事項

* プロトタイプは検証用であり、本番公開ページの一部として扱いません。
* 本番ページからプロトタイプへリンクしません。
* 認証情報、Secrets、APIキー、`.env`、サービスアカウントJSONなどの実値を書きません。
* 公式サイト等の本文・画像・独自表現を必要以上に転載しません。
* プロトタイプ作成だけのPRでは、本番ページのHTML / CSS / JavaScriptを変更しません。
* UI移植だけのPRでは、公開JSONを変更しません。
* 色枠やカード状態の意味をページ側で固定しません。
