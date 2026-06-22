# css-inventory.md

## 目的

CSS整理に入る前の棚卸しとして、`public/assets/style.css` の現在の構成、主要セレクタ、表示モード、重複・上書き候補、変更リスクを記録する。

今回の目的は、今後CSSを安全に整理するための現状把握であり、CSS本体の統合、削除、並び替え、リネーム、実装修正は行わない。

## 対象ファイル

- `public/assets/style.css`
- `public/sanga202627season.html`
- `public/assets/app.js`
- `docs/project-structure.md`
- `docs/ai/WORKLOG.md`

## CSS全体の大まかな構成

`public/assets/style.css` は、厳密な章立てというより、追加・改善の履歴に沿ってコメント見出しが積み重なっている構成になっている。

大まかには次の順で並んでいる。

1. `:root` と `.phone` などページ全体・スマートフォン枠の基本指定。
2. `.grid`、`.match`、`.match-inner`、`.ha`、`.date`、`.meta`、`.team`、`.place` など試合カードの基本指定。
3. `@media (min-width:390px)`、`@media (min-width:700px)` による幅別の上書き。
4. `compact layout`、曜日色、ヘッダー・フッター、日程未確定表示、選択状態、長い日付表示などの追加調整。
5. `help overview`、`official notes`、`note overlap fix` など使い方・注記・フッターまわりの調整。
6. 対戦相手ロゴ背景、年見出し、表示列切替、`.layout-*` 系の表示列別指定。
7. フッター操作ボタン、免責事項、LocalStorage削除ボタン、カード高揃えの追加調整。
8. JSON描画、設定パネル、表示モード、フィルタ、共有画像モード関連の指定。

## 主要セレクタ分類

### 基本レイアウト

- `:root`: 色、背景、カード色、ホーム/アウェイ色、文字色、注意色などのCSSカスタムプロパティを定義する。
- `body`: 余白、背景、フォント、ページ全体の文字色を担当する。
- `.phone`: 公開ページ全体のスマートフォン枠。幅、余白、背景、角丸、影を持つ。JavaScriptから表示列クラスや共有画像モードクラスが付与される。
- `h1`: ページタイトルの文字サイズ、配置、余白を担当する。
- `.grid`: 試合カードを並べるグリッド。後半で「同一グリッド行内のカード高揃え」用に再指定されている。
- `[hidden]`: HTMLの `hidden` 属性を確実に非表示にする指定。
- `.json-preview`、`.json-preview-match`、`.json-preview-year`: JSON由来の日程表示領域と年見出しの土台。

### 試合カード

- `.match`: 各試合カードのクリック可能なボタン本体。角丸、枠線、背景、影、最小高さ、状態表示、カード高揃えに関係する。
- `.match-inner`: カード内部のグリッド。ホーム/アウェイ帯、対戦情報、日付欄を並べる。
- `.home .match-inner` / `.away .match-inner`: ホーム/アウェイで縦帯側や列構成を変える。
- `.meta`: 節、チーム名、会場、注記などの情報ブロック。対戦相手ロゴ背景の疑似要素 `.meta::after` と重なるため、内部要素は `.meta > *` で前面に出している。
- `.sec`、`.team`、`.place`、`.small`: 節、対戦相手、会場、補助テキストの表示。
- `.note`、`.match:has(.note)` 系: 注記付きカードの高さ、余白、注記配置を調整する。
- `.match[data-state="1"]`、`.match[data-state="2"]`: タップ状態の視覚表現。JavaScriptの保存状態と連動するため、状態値の意味はCSSだけで判断しない。

### 日付・ホーム/アウェイ・会場表示

- `.ha`: ホーム/アウェイの縦帯。カード高や行高揃えに影響するため注意が必要。
- `.home .ha` / `.away .ha`: ホーム/アウェイごとの背景色。
- `.date`: 日付欄。通常日程、候補日、長い日付、表示列別、共有画像モードで多くの上書きがある。
- `.date .main`: 日付の主表示。後半で「92% scale」の調整が入っている。
- `.date .sub`: 曜日や補助日付の表示。土日色、未確定日、4列表示、共有画像モードで上書きがある。
- `.date.tentative-date`: 日程未確定・候補日ありの淡い黄色の日付枠。
- `.date .range`、`.date .range .main`: 候補日範囲の表示。
- `.date:not(.tentative-date) .main.compact-date`: 長い日付を収めるための縮小表示。通常指定とメディアクエリ内指定がある。
- `.place`: 会場名表示。表示列・表示モードごとに文字サイズや表示の詰め方が変わる。

### 表示列・表示モード

- `.layout-group`、`.layout-label`、`.layout-option`: 表示列切替ボタン群。初期のフッター内指定、フッター見た目調整、設定パネル内指定がある。
- `.layout-option[aria-pressed="true"]`: 選択中の表示列ボタン。JavaScriptが `aria-pressed` を更新する。
- `.phone.layout-1 .json-preview-grid` / `.phone.layout-3 .grid` / `.phone.layout-4 .grid`: 表示列数に応じたグリッド列指定。
- `.phone.layout-1 ...`、`.phone.layout-4 ...`: 1列・4列表示時のカード高さ、内部グリッド、文字サイズ、日付欄、注記、ロゴ背景の調整。
- `.display-mode-option`: 表示モード切替ボタン。選択状態は `aria-pressed` と `::before` で示す。
- `.display-mode-compact ...`: コンパクト表示時のカード高さ、枠線、文字サイズ、日付欄、注記の調整。
- `.phone.layout-3 .display-mode-compact ...`、`.phone.layout-4 .display-mode-compact ...`: 表示列とコンパクト表示の組み合わせ上書き。

### スマートフォン表示

- 初期状態の `.phone` はスマートフォン優先の幅で作られている。
- `@media (min-width:390px)`: 390px以上で2列グリッド、カード最小高さ、文字サイズ、日付欄サイズ、コンパクト表示の列数・高さなどを調整する。
- `@media (min-width:700px)`: `.phone` の幅を430pxにする。
- `.phone.layout-1`、`.phone.layout-3`、`.phone.layout-4`: スマートフォン枠内での表示列切替を担う。
- `.phone.is-screenshot-mode` 系: 共有画像生成時の見た目を固定・調整する。通常閲覧とは別の表示モードとして扱う必要がある。

### ダイアログ

- `.help-overlay`: 使い方ダイアログの背景オーバーレイ。
- `.help-panel`: 使い方ダイアログ本体。下から出るパネルとして `transform` と `transition` を持つ。
- `.help-panel.is-open`: ダイアログ表示状態。
- `.help-handle`: ダイアログ上部のハンドル表示。設定パネルにも同じクラスが使われている。
- `.help-close`、`.help-close:focus-visible`: 使い方ダイアログの閉じるボタンとフォーカス表示。
- `.settings-panel`、`.settings-panel.is-open`: 設定ダイアログ本体と表示状態。
- `.settings-close`、`.settings-close:focus-visible`: 設定ダイアログの閉じるボタンとフォーカス表示。
- `.settings-section`、`.settings-subsection`、`.settings-note`、`.settings-section-muted`: 設定パネル内の区切りと説明文。
- `@media (prefers-reduced-motion:reduce)`: ダイアログ・ボタン・共有画像プレビューなどの動きを抑制する。

### フッター・免責事項

- `.footer-tools`: 使い方・設定ボタンや凡例を含むフッター領域。複数回出現している。
- `.footer-actions`: フッター内の操作ボタン配置。初期指定、視覚調整、統一ボタン指定前の再調整がある。
- `.footer-action-button`: 使い方ボタン・設定ボタンの統一見た目。
- `.footer-tools .legend`: 凡例テキスト。
- `.disclaimer`: 免責事項。文言はHTML側にあり、CSSは見た目のみ担当する。
- `.creator-credit`、`.creator-credit a`: 作成者表示とリンク。
- `.site-version`: バージョン表示。
- `.screenshot-share-note`: 共有画像モード時の注意文。

### ボタン・操作部品

- `.help-button`、`.settings-button`: フッターの主要操作ボタン。後半で `.footer-action-button` による統一指定も受ける。
- `.help-icon`、`.settings-icon`: ボタン内アイコン。サイズやグラデーションに関係する。
- `.layout-option`、`.display-mode-option`、`.filter-option`: 設定パネル内の選択ボタン。`aria-pressed` とフォーカス表示が重要。
- `.storage-clear`: LocalStorage削除ボタン。使い方ダイアログ内にあり、説明文とセットで扱う必要がある。
- `.storage-clear-note`: LocalStorage削除結果のライブ領域。
- `.screenshot-exit-button`: 共有画像モード終了ボタン。
- `.share-generate-button`、`.share-save-link`: 共有画像生成・保存操作。`.share-save-link` は複数回出現している。

### 状態表示

- `.match[data-state="1"]`、`.match[data-state="2"]`: 試合カードのタップ状態表示。
- `.layout-option[aria-pressed="true"]`、`.display-mode-option[aria-pressed="true"]`、`.filter-option[aria-pressed="true"]`: 選択中の操作状態。
- `.filter-result`、`.empty-filter-message`: 絞り込み結果件数や空結果の表示。
- `.phone.is-screenshot-mode`、`.phone.is-share-loading`、`.phone.is-share-success`、`.phone.is-share-error`: 共有画像生成状態。
- `.share-status`、`.share-progress`、`.share-progress-bar`、`.share-preview`: 共有画像生成の進行・結果表示。

## 重複・上書き候補

同じセレクタが複数回出てくる箇所は、現時点では不要と断定しない。表示モード、追加修正、アクセシビリティ、共有画像モードなどの意図的な上書きである可能性がある。

- セレクタ: `.match`
- 出現箇所: 基本カード指定、後半の「equal height cards in each grid row」
- 役割: カード本体の見た目と、グリッド行内で高さを揃えるためのflex化。
- 統合できそうか: 要確認。
- 注意点: カード高さ、縦帯、日付欄、クリック領域に影響するため実ブラウザ確認が必要。

- セレクタ: `.ha`
- 出現箇所: 基本カード指定、後半の「equal height cards in each grid row」
- 役割: ホーム/アウェイ縦帯の表示と、高さ追随。
- 統合できそうか: 要確認。
- 注意点: `.home` / `.away`、`.layout-*`、注記付きカードと連動する。

- セレクタ: `.date:not(.tentative-date) .main.compact-date`
- 出現箇所: 長い日付表示の通常指定、390px以上のメディアクエリ内指定。
- 役割: 通常日付の長い文字列を収める。
- 統合できそうか: 画面幅別の意図があるため要確認。
- 注意点: 日付の可読性、スマートフォン幅での詰まりに影響する。

- セレクタ: `.footer-tools` / `.footer-tools .legend`
- 出現箇所: `help overview`、`official notes 1-7`
- 役割: フッター領域と凡例の余白・色・表示調整。
- 統合できそうか: 要確認。
- 注意点: 使い方・設定ボタン、免責事項、凡例の見え方に影響する。

- セレクタ: `.help-button`
- 出現箇所: `help overview`、`official notes 1-7`、`footer action visual alignment`、`help button affordance`、`prefers-reduced-motion` 内。
- 役割: 使い方ボタンの基本見た目、余白、押下感、動き抑制。
- 統合できそうか: 低リスクではない。要確認。
- 注意点: `.footer-action-button` の統一指定と重なるため、見た目・フォーカス・ホバーの確認が必要。

- セレクタ: `.note` / `.match:has(.note)` 系
- 出現箇所: `official notes`、`note and hover refinement`、`note overlap fix`、390px以上のメディアクエリ内。
- 役割: 公式注記・候補日注記の表示とカード高さ調整。
- 統合できそうか: 要確認。
- 注意点: 注記付きカードは高さが大きくなりやすく、最近のカード高揃え修正とも関係する。

- セレクタ: `.meta::after`
- 出現箇所: `translucent opponent logo background`、`opponent logo size adjustment`、表示列別指定。
- 役割: 対戦相手ロゴを透過背景として表示する。
- 統合できそうか: 要確認。
- 注意点: 背景画像、サイズ、位置、前面テキストの可読性に影響する。

- セレクタ: `.footer-actions` / `.layout-group` / `.layout-label` / `.layout-option`
- 出現箇所: `layout toggle`、`footer action visual alignment`、`settings section` 内。
- 役割: 表示列ボタンの配置と、設定パネル内での再利用。
- 統合できそうか: 要確認。
- 注意点: フッター内と設定パネル内で必要な見た目が異なる可能性がある。

- セレクタ: `.phone.layout-4 ...`
- 出現箇所: 4列表示ブロック内に同種セレクタが複数回、さらに「4-column date left spacing」で追加上書き。
- 役割: 4列表示でカードを詰めるためのサイズ・余白・日付欄調整。
- 統合できそうか: 中〜高リスク。要確認。
- 注意点: 4列表示は余白が小さく、日付・チーム名・会場が詰まりやすい。

- セレクタ: `.settings-button` / `.settings-icon` / `.settings-panel`
- 出現箇所: 設定パネル基本指定、統一フッター操作ボタン、`prefers-reduced-motion` 内。
- 役割: 設定ボタン・設定パネルの見た目と動き。
- 統合できそうか: 要確認。
- 注意点: ダイアログ開閉、フォーカス移動、キーボード操作に影響する可能性がある。

- セレクタ: `.screenshot-exit-button`
- 出現箇所: `screenshot share mode` 内で複数回。
- 役割: 共有画像モード終了ボタンの配置・見た目。
- 統合できそうか: 要確認。
- 注意点: 共有画像モードは通常表示とは異なるため、単純統合は避ける。

- セレクタ: `.share-save-link`
- 出現箇所: 共有画像生成関連で複数回。
- 役割: 生成画像保存リンクのボタン風表示と状態表示。
- 統合できそうか: 要確認。
- 注意点: HTML上のリンク要素としての役割、フォーカス表示、非表示状態に注意する。

## 変更しやすい箇所

- コメント見出しの追加や、既存セクションの目的を説明するドキュメント追記。
- `docs/css-inventory.md` のような棚卸しドキュメントの更新。
- セレクタの未使用確認だけを行い、実装は変更しない作業。
- CSS内の近接した同一目的コメントの補足。ただし今回はCSS本体には追加しない。
- Static Checksで確認できる、波括弧数やHTMLからのCSS/JS参照確認。

## 変更に注意が必要な箇所

- `.match`、`.match-inner`、`.ha`、`.date`: 試合カード高さ、縦帯、日付欄、クリック領域に直結する。
- `.phone.layout-*`: 表示列切替とLocalStorage保存状態に連動する。
- `.display-mode-compact`: コンパクト表示と通常表示の差分に関係する。
- `.help-panel`、`.settings-panel`、`.help-overlay`、`.help-close`、`.settings-close`: ダイアログ操作、フォーカス、Escキー、背景クリックの確認が必要。
- `.storage-clear`、`.storage-clear-note`: LocalStorage削除操作と利用者説明に関係する。
- `.footer-action-button`、`.help-button`、`.settings-button`: 主要操作ボタンの見た目、押下感、フォーカス表示に関係する。
- `.meta::after`: 対戦相手ロゴ背景の可読性に影響する。
- `.phone.is-screenshot-mode`、共有画像生成関連: 通常表示では確認しづらい専用表示なので、変更時は別途確認が必要。
- `@media (min-width:390px)` と `@media (prefers-reduced-motion:reduce)`: 幅別・動き抑制設定の上書き順に注意する。

## 次に小さく整理できそうな候補

### 低リスク

- CSS本体を変更せず、セレクタ一覧と用途をドキュメントに追記する。
- コメント見出しを追加する前提で、どこに見出しを入れるかだけを別ドキュメントに整理する。
- `rg` や簡易スクリプトで、HTML/JavaScriptから参照されるclass名・id名を確認する。
- 同じセレクタが複数回出る箇所を、削除せず「上書き候補」として継続管理する。

### 中リスク

- 近接する同じセレクタ内の明らかに同じ目的の指定を、事前に差分確認手順を決めたうえで統合する。
- 表示モードごとのCSSブロックの並びを、コメント見出し単位で整理する。
- `.footer-actions`、`.layout-group`、`.layout-option` など、設定パネルとフッターで重なるボタン系指定を役割別に分ける。
- `.note` と `.match:has(.note)` 系の役割をコメントで明確にする。

### 高リスク

- レイアウト系セレクタの統合。
- `.match`、`.match-inner`、`.date`、`.ha`、`.layout-*` の大きな整理。
- ダイアログやLocalStorage削除ボタン周辺の構造変更。
- 共有画像モード `.phone.is-screenshot-mode` 系の整理。
- 表示列・表示モード・フィルタのJavaScript連動クラス名変更。

## 今回は変更しないもの

- `public/assets/style.css` は変更しない。
- `public/sanga202627season.html` は変更しない。
- `public/assets/app.js` は変更しない。
- `public/data/matches.json` は変更しない。
- `.github/workflows/static-checks.yml` は変更しない。
- LocalStorageキーは変更しない。
- CSSセレクタの統合、削除、並び替え、リネームは行わない。
- 試合日程、節番号、対戦相手、会場、キックオフ時刻は変更しない。

## 要確認事項

- 各重複セレクタが、意図的な履歴上書きなのか、整理可能な重複なのか。
- `.phone.layout-4` 系の複数ブロックが、どの画面幅・表示モード・共有画像モードを想定しているか。
- `.help-button` と `.footer-action-button` の責務分担。
- `.layout-group` / `.layout-option` がフッター用と設定パネル用でどこまで共通化できるか。
- `.match:has(.note)` 系が注記付きカードの高さ揃えに必要な指定をすべて満たしているか。
- 実ブラウザで、スマートフォン幅、PC幅、1列/2列/3列/4列、通常カード/コンパクト、共有画像モードを確認する手順。
- CSS整理を始める前に、スクリーンショット比較やPlaywright等の実ブラウザ確認をどこまで用意するか。

## 2026-06-22 低リスクコメント見出し追加メモ

- `public/assets/style.css` に、棚卸し分類をもとにした大まかなコメント見出しを追加した。
- 今回の整理では、CSSの指定値、セレクタ、セレクタ名、ルールの統合・削除・大きな並び替えは行っていない。
- 次の整理候補として記録している重複・上書き候補の検証や統合は、今回はまだ実施していない。
