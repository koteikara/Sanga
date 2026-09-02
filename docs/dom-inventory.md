# DOM識別子インベントリ

**この文書は `tools/generate-dom-inventory.mjs` が生成します。手で編集しないでください。**
更新は `node tools/generate-dom-inventory.mjs` を実行し、生成結果をコミットします。
`npm run check:static` が実装との差分を検出します。

## 用途

class名、id名、data属性を変更する前に、JavaScriptが参照しているかをここで確認します。
参照がある場合は、CSSとHTMLの該当箇所もあわせて確認します。

テンプレートリテラルで組み立てる動的なclass名（`logo-${opponent_code}` など）は抽出できません。
各機能の仕様書を参照してください。

LocalStorageの保存形式と既定値は `docs/personalization.md` を正本とします。
ここに載るのはキー名だけです。

## 一覧

### 年間スケジュール: `public/assets/app.js`

#### 参照しているid

- `#settings-title`

#### 参照しているclass

- `.compact-date`
- `.cup-match`
- `.date`
- `.display-mode-option`
- `.empty-filter-message`
- `.error`
- `.filter-option`
- `.filter-result`
- `.ha`
- `.has-time`
- `.help-button`
- `.help-close`
- `.help-overlay`
- `.help-panel`
- `.is-open`
- `.is-screenshot-mode`
- `.is-share-error`
- `.is-share-loading`
- `.is-share-success`
- `.json-preview-match`
- `.json-preview-year`
- `.layout-option`
- `.loading`
- `.main`
- `.match`
- `.match-inner`
- `.meta`
- `.neutral-match`
- `.no-logo`
- `.note`
- `.phone`
- `.place`
- `.range`
- `.screenshot-exit-button`
- `.screenshot-mode-live`
- `.screenshot-share-note`
- `.sec`
- `.settings-button`
- `.settings-close`
- `.settings-panel`
- `.share-generate-button`
- `.share-image-actions`
- `.share-preview`
- `.share-preview-image`
- `.share-progress`
- `.share-save-help`
- `.share-save-link`
- `.share-status`
- `.small`
- `.storage-clear`
- `.storage-clear-note`
- `.success`
- `.team`
- `.tentative-date`
- `.time`
- `.year`

#### 操作しているdata属性

- `data-competition`
- `data-display-mode`
- `data-filter`
- `data-has-candidates`
- `data-home-away`
- `data-id`
- `data-json-id`
- `data-json-preview-list`
- `data-layout`
- `data-share-capture-target`
- `data-share-generation-state`
- `data-state`
- `data-status`
- `data-year`

#### 操作しているaria属性

- `aria-busy`
- `aria-expanded`
- `aria-hidden`
- `aria-label`
- `aria-pressed`

#### LocalStorageキー

- `sanga-schedule-button-states-v1`
- `sanga-schedule-display-mode-v1`
- `sanga-schedule-filter-settings-v1`
- `sanga-schedule-layout-v1`

### 予想スカッド: `public/assets/squad-builder.js`

#### 参照しているid

なし

#### 参照しているclass

- `.bench-edit-add`
- `.bench-edit-remove`
- `.bench-edit-slot`
- `.bench-face`
- `.bench-name`
- `.bench-slot`
- `.btn`
- `.card`
- `.card-inner`
- `.card-meta`
- `.card-name`
- `.card-num`
- `.card-photo`
- `.card-pos`
- `.card-split`
- `.danger`
- `.dragging`
- `.empty-hint`
- `.en`
- `.export-save-help`
- `.ja`
- `.name-ja`
- `.names`
- `.no-image`
- `.num`
- `.open`
- `.picker-empty`
- `.picker-item`
- `.picker-open`
- `.player`
- `.pos-pill`
- `.pos-tag`
- `.save-item`
- `.select-btn`
- `.show-ja`
- `.show-pill`
- `.tile`
- `.tile-img`

#### 操作しているdata属性

- `data-bench-emphasis`
- `data-bench-format`
- `data-fit-ratio`
- `data-just-dragged`
- `data-slot-index`
- `data-style`

#### 操作しているaria属性

- `aria-label`
- `aria-pressed`

#### LocalStorageキー

- `sanga-squad-`

### SUPPORTER TIMELINE: `public/assets/timeline.js`

#### 参照しているid

- `#sheet-benefit`

#### 参照しているclass

- `.badge-benefit`
- `.badge-mine`
- `.benefit-actions`
- `.benefit-count`
- `.benefit-detail`
- `.benefit-item`
- `.benefit-item-title`
- `.benefit-tag`
- `.benefit-warn`
- `.block`
- `.btn-remove`
- `.chip`
- `.day`
- `.day-label`
- `.drawer-item-title`
- `.drawer-list`
- `.drawer-meta`
- `.drawer-when`
- `.empty`
- `.event`
- `.event-also`
- `.event-kind`
- `.event-meta`
- `.event-source`
- `.event-source-date`
- `.event-time`
- `.event-title`
- `.event-top`
- `.events`
- `.fold`
- `.head`
- `.is-`
- `.is-benefit`
- `.is-change`
- `.is-closing`
- `.is-mine`
- `.is-on`
- `.is-stuck`
- `.match-away`
- `.match-date`
- `.match-label`
- `.match-name`
- `.match-side`
- `.month`
- `.month-label`
- `.note-tentative`
- `.past`
- `.reason`
- `.sheet`
- `.sheet-open`
- `.tag`
- `.today`
- `.tour`
- `.visually-hidden`

#### 操作しているdata属性

- `data-close-sheet`
- `data-filter`
- `data-motion`
- `data-opener`
- `data-sheet`
- `data-tour-next`
- `data-tour-panel`
- `data-tour-prev`
- `data-tour-skip`

#### 操作しているaria属性

- `aria-hidden`
- `aria-pressed`

#### LocalStorageキー

- `sanga-timeline-benefit-tickets-v1`
- `sanga-timeline-personal-events-v1`
- `sanga-timeline-profile-v1`
- `sanga-timeline-tour-v1`
