# 画像生成ライブラリ小規模検証

## 検証目的

年間スケジュールページのスクショ用表示に近い最小DOMを用意し、ブラウザ内でPNG化できるかを小さく確認します。今回の検証は `experiments/image-generation/` 配下だけで行い、本番ページには画像生成機能を導入しません。

## 検証対象

優先検証対象は次の2つです。

* `html-to-image`
* `modern-screenshot`

追加候補は次の2つですが、今回のprototypeでは未実装です。

* `dom-to-image-more`
* `html2canvas`

未検証理由は、まず優先候補2つで案Bの画像化対象範囲、CSS Grid、状態枠、PNG生成導線を確認し、実装を小さく保つためです。

今回対象外のライブラリは次のとおりです。

* `satori`
* `node-html-to-image`
* `dom-to-image`

## 検証ページ

検証ページは次のファイルです。

```text
experiments/image-generation/prototype.html
```

簡易サーバーで確認する場合の例です。

```bash
python3 -m http.server 4173
```

```text
http://localhost:4173/experiments/image-generation/prototype.html
```

GitHub Pagesでスマホ実機確認を行うため、同じ検証ページを公開用コピーとして次にも配置しています。

```text
public/experiments/image-generation/prototype.html
```

確認URL:

```text
https://koteikara.github.io/Sanga/experiments/image-generation/prototype.html
```

`public/experiments/` 配下は検証ページ公開用であり、本番の年間スケジュールページからはリンクしません。

## 画像化対象範囲

PR #66 の推奨に合わせ、案Bとして `.json-preview-grid`、短い注意書き、作成者表記を含む専用ラッパーを画像化対象にしています。

```html
<section class="share-capture-target" id="share-capture-target">
  <div class="json-preview-grid">
    ...
  </div>
  <p class="screenshot-share-note">非公式の確認用日程表です。最新情報は公式情報をご確認ください。</p>
  <p class="creator-credit">作成者：Kou from OSAKA</p>
</section>
```

画像生成ボタン、PNGダウンロードボタン、列切替ボタン、検証用メッセージ、通常表示に戻るボタン相当のUI、hidden要素は画像化対象外です。

## 試したライブラリ

`prototype.html` では検証用HTML内のみでCDNを使用しています。本番ページからは読み込まれません。

* `html-to-image`: `prototype.js` で `https://esm.sh/html-to-image@1.11.11` から読み込みます。
* `modern-screenshot`: `prototype.js` で `https://esm.sh/modern-screenshot@4.6.5` から読み込みます。

CDN利用は検証ページ限定です。
本番導入時はCDN / npm / vendor配置のいずれにするか別途判断します。CDNを採用する場合は、SRI、供給元リスク、可用性、ライセンス、バージョン固定方針の確認が必要です。

## 動作確認手順

1. `python3 -m http.server 4173` を実行します。
2. `http://localhost:4173/experiments/image-generation/prototype.html` を開きます。
3. 1列 / 2列 / 3列 / 4列を切り替えます。
4. `html-to-image` を選び、PNG生成を試します。
5. `modern-screenshot` を選び、PNG生成を試します。
6. 生成中、成功、失敗メッセージが `aria-live` 領域に表示されることを確認します。
7. PNGプレビューが表示されることを確認します。
8. PNGダウンロードリンクが表示されることを確認します。

## 確認項目

* 1列 / 2列 / 3列 / 4列でPNG化できるか
* CSS Gridが反映されるか
* border / box-shadow / グラデーションが反映されるか
* 赤色枠 / 水色枠が反映されるか
* 候補日表示が崩れないか
* 未定表示が崩れないか
* hidden要素が入らないか
* 作成者表記と短い注意書きが入るか
* PNGプレビューが表示されるか
* PNGダウンロードできるか
* PC Chromeで動くか
* iPhone Safariで試す必要があるか
* Android Chromeで試す必要があるか
* 長尺DOMでメモリ問題が出そうか

## 分かったこと

Codex環境では実ブラウザでの画像生成確認は未実施。ローカルまたはGitHub Pages上での手動確認が必要です。

実装上は、画像化対象を `#share-capture-target` に分離することで、列切替UI、画像生成UI、PNGダウンロードリンク、検証用メッセージ、hidden要素を対象外にできます。

## 懸念点

* CDN利用は検証用に限定しており、本番導入時は供給元リスクとSRI確認が必要です。
* iPhone Safari、Android Chrome、PC Chromeで実際にPNG化できるかは未確認です。
* 長尺DOMではCanvasやSVGのサイズ制限、メモリ使用量、生成時間が問題になる可能性があります。
* 4列表示はスマートフォン幅では可読性が落ちるため、画像共有用の列数上限を別途検討する必要があります。
* Webフォントや外部画像を含める場合は、CORSや読み込み完了タイミングの確認が必要です。

## 本番導入する場合の推奨方針

まずは `html-to-image` と `modern-screenshot` をPC Chrome、iPhone Safari、Android Chromeで比較し、案Bの限定ラッパーで問題が少ない候補を1つに絞ります。

本番導入では、外部サーバーへDOMや画像を送信しないブラウザ内完結を維持します。依存関係の導入方法は、CDNではなくnpm同梱またはvendor配置を含めて、ライセンス、SRI、更新運用、静的サイトでの扱いやすさを確認してから決めます。
