// 予想スカッド作成 プロトタイプ本体
// design-mockup.html の見た目（盾型カード、装飾、7スタイル、寸法計算の考え方）を引き継ぎ、
// フォーメーション選択・選手選択・位置の微調整・画像化導線・保存呼び出しを実装する。
// design-mockup.html 自体は変更していない。
// 静的importにはHTML側のバージョンクエリが効かないため、更新時はここのクエリも上げる。
import { FORMATIONS } from "./squad-formations.js?v=20260820-6";
import { SAMPLE_PLAYERS } from "./squad-sample-players.js";
// 背番号タイル画像の中身のずれ（tools/measure-tile-offsets.mjs で生成）
import { TILE_OFFSETS } from "./squad-tile-offsets.js?v=20260821-1";
// modern-screenshot@4.6.5（MIT License）。npm registryから取得し、CDNを使わず
// public/assets/vendor/ に静的配置したものを読み込む。詳細は下記の
// 「画像化（PNG出力）」セクションのコメントを参照。
import { domToPng } from "./vendor/modern-screenshot/modern-screenshot.mjs";

const STORAGE_PREFIX = "sanga-squad-";
const STORAGE_INDEX_KEY = STORAGE_PREFIX + "index";

/* ------------------------------------------------------------------
   状態
------------------------------------------------------------------ */
const state = {
  formationKey: "4-4-2",
  slots: cloneSlots(FORMATIONS["4-4-2"].slots), // 各要素に playerNumber を持たせる
  // 登録メンバー（背番号の配列）。人数は自由。ピッチに置いていない人が控えになる。
  // 「登録」と「配置」を分けることで、控えの枠数に縛られずに扱える。
  squad: [],
  title: "予想スタメン",
  matchInfo: "", // 年間スケジュールから選んだ試合の表示文。未選択なら空
  poster: "", // 投稿者名。誰の予想かを画像に残すために使う
  style: "modern",
  showJa: true,
  showPill: true,
  showMascot: false,
};

let players = []; // players.json または サンプルの players 配列

function cloneSlots(slots) {
  return slots.map((s) => ({ ...s, playerNumber: null }));
}

/* ------------------------------------------------------------------
   選手データの読み込み
   public/data/players.json が読めない場合に備え、同梱のサンプルへ切り替える。
   その場合は同梱のサンプル配列にフォールバックし、理由をコンソールに出す。
------------------------------------------------------------------ */
async function loadPlayers() {
  const candidates = ["/data/players.json", "data/players.json"];
  for (const url of candidates) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const json = await res.json();
      if (Array.isArray(json.players) && json.players.length) {
        console.info("[squad-builder] players.json を読み込みました:", url);
        return json.players;
      }
    } catch (err) {
      // 次の候補へ。最終的に全滅したらフォールバックする。
    }
  }
  console.warn(
    "[squad-builder] data/players.json を読み込めないため、" +
      "同梱のサンプル選手データ（sample-players.js）にフォールバックします。" +
      "このファイルは別担当が作成中の想定です。"
  );
  return SAMPLE_PLAYERS.players;
}

function findPlayer(number) {
  return players.find((p) => p.number === number) || null;
}

function isAssigned(number) {
  return state.squad.includes(number);
}

/** ピッチに置かれている背番号 */
function placedNumbers() {
  return state.slots.map((s) => s.playerNumber).filter(Boolean);
}

/** 控え（登録メンバーのうち、ピッチに置かれていない人）。登録順に並ぶ */
function getBench() {
  const placed = placedNumbers();
  return state.squad.filter((n) => !placed.includes(n));
}

/** 登録メンバーに加える（すでにいる場合は何もしない） */
function addToSquad(number) {
  if (!state.squad.includes(number)) state.squad.push(number);
}

/** 登録メンバーから外す。ピッチに置かれていれば、その枠も空ける */
function removeFromSquad(number) {
  state.squad = state.squad.filter((n) => n !== number);
  state.slots.forEach((slot) => {
    if (slot.playerNumber === number) slot.playerNumber = null;
  });
}

/* ------------------------------------------------------------------
   DOM参照
------------------------------------------------------------------ */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const canvas = $("#canvas");
const pitchEl = $("#pitch");
const benchEl = $("#bench");
const benchEditorEl = $("#bench-editor");
const benchCountEl = $("#bench-count");
const formationGrid = $("#formation-grid");
const subtitleEl = $("#sq-subtitle");
const titleTextEl = $("#sq-title-text");
const posterEl = $("#meta-poster");
const formationNumEl = $("#formation-num");

const pickerBackdrop = $("#picker-backdrop");
const pickerList = $("#picker-list");
const pickerFilters = $("#picker-filters");
const pickerTitle = $("#picker-title");
const pickerClose = $("#picker-close");
const pickerClear = $("#picker-clear");

let pickerTarget = null; // { kind: 'slot'|'bench', index }
let pickerFilter = "ALL";

/* ------------------------------------------------------------------
   フォーメーション選択
------------------------------------------------------------------ */
function buildFormationButtons() {
  formationGrid.innerHTML = "";
  Object.entries(FORMATIONS).forEach(([key, f]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn";
    btn.textContent = f.label;
    btn.setAttribute("aria-pressed", String(key === state.formationKey));
    btn.addEventListener("click", () => applyFormation(key));
    formationGrid.appendChild(btn);
  });
}

function applyFormation(key) {
  const f = FORMATIONS[key];
  if (!f) return;
  const prevAssignments = state.slots.map((s) => s.playerNumber);
  state.formationKey = key;
  state.slots = cloneSlots(f.slots);
  // 人数が同じ並びなら、配置済みの選手をできるだけ引き継ぐ（インデックス対応）。
  state.slots.forEach((s, i) => {
    s.playerNumber = prevAssignments[i] || null;
  });
  $$("#formation-grid .btn").forEach((btn, i) => {
    btn.setAttribute("aria-pressed", String(Object.keys(FORMATIONS)[i] === key));
  });
  formationNumEl.textContent = f.label;
  renderAll();
}

function resetPositions() {
  const f = FORMATIONS[state.formationKey];
  state.slots.forEach((s, i) => {
    s.x = f.slots[i].x;
    s.y = f.slots[i].y;
  });
  layoutPitch();
}

/* ------------------------------------------------------------------
   カードDOMの組み立て（design-mockup.html の構造を踏襲）
------------------------------------------------------------------ */
function cardMarkup(player, posLabelFallback) {
  if (!player) {
    return `
      <div class="card"><div class="card-inner">
        <div class="card-meta"><div class="card-num">?</div><div class="card-pos">${escapeHtml(posLabelFallback || "")}</div></div>
        <div class="card-split"></div>
        <div class="empty-hint">タップして<br>選手を選ぶ</div>
      </div></div>`;
  }
  const nameJa = player.nameJa || "";
  // 切り出した背番号タイルがあればそれを使い、無ければCSSのプレースホルダーを出す。
  // 画像の読み込みに失敗した場合も同じくプレースホルダーへ戻す。
  const tileSrc = playerImageSrc(player);
  const tile = tileOffset(player);
  return `
    <div class="card${player.isMascot ? " mascot" : ""}"><div class="card-inner">
      <div class="card-split"></div>
      <div class="card-photo">
        <div class="tile"><b>${escapeHtml(player.number)}</b><span>${escapeHtml(player.nameEn)}</span></div>
        <img class="tile-img" src="${escapeHtml(tileSrc)}" alt=""
             style="--tile-dx:${tile.dx};--tile-dy:${tile.dy}"
             onerror="this.closest('.card-photo').classList.add('no-image')">
      </div>
      <div class="card-name">
        <!-- ローマ字名はタイル画像に入っているため、ここでは出さない -->
        <div class="name-ja" data-fit-ratio="0.8">${escapeHtml(nameJa)}</div>
        <div class="flag flag-${escapeHtml(player.nationality || "jp")}"></div>
      </div>
    </div></div>`;
}

/**
 * 背番号タイル画像の中身を中央へ寄せる量。画像の幅・高さに対する%の
 * 「数値だけ」を返す。CSS側で calc(var(--tile-dx) * 1%) として使うため、
 * 単位は付けない。画像ごとに中身が上下左右へずれており（実測で左右±6%、
 * 上下±4%）、円だけで見せるシンプルスタイルではそのまま「中央でない」と
 * 見えるため補正する。盾型カードのスタイルではCSS側でこの値を使わない。
 */
function tileOffset(player) {
  const o = TILE_OFFSETS[player.number];
  return {
    dx: typeof o?.dx === "number" ? o.dx : 0,
    dy: typeof o?.dy === "number" ? o.dy : 0,
  };
}

/** 背番号タイル画像の場所。公開ページへ移す際はここだけ変える */
const PLAYER_IMAGE_BASE = "assets/players/";

/* ------------------------------------------------------------------
   試合の選択肢。年間スケジュールの公開JSONから作る
------------------------------------------------------------------ */

/** 大会名を短くするための対応表。無い大会は competition_label をそのまま使う */
const COMPETITION_SHORT_LABELS = {
  J1: "J1",
  LEV: "ルヴァン杯",
  EMP: "天皇杯",
};

/** 試合1件を、画像に載せる1行の文にする */
function matchLabel(match) {
  // 1行に収めたいので、月日までにして時刻は入れない
  const date = match.match_date
    ? `${Number(match.match_date.slice(5, 7))}/${Number(match.match_date.slice(8, 10))}`
    : "";
  const competition = COMPETITION_SHORT_LABELS[match.competition] || match.competition_label;
  const head = [competition, match.round].filter(Boolean).join(" ");
  const versus = match.opponent ? `vs ${match.opponent}` : "";
  return [date, head, versus].filter(Boolean).join(" ");
}

/** 年間スケジュールを読んで、試合の選択肢を並べる */
async function loadMatchOptions() {
  const select = $("#field-match");
  if (!select) return;
  const candidates = ["/data/matches.json", "data/matches.json"];
  for (const url of candidates) {
    try {
      const res = await fetch(url, { cache: "no-cache" });
      if (!res.ok) continue;
      const data = await res.json();
      const matches = (data.matches || []).filter((m) => m.is_visible !== false);
      matches.forEach((m) => {
        const label = matchLabel(m);
        if (!label) return;
        const option = document.createElement("option");
        option.value = label;
        option.textContent = label;
        select.appendChild(option);
      });
      return;
    } catch (err) {
      continue;
    }
  }
  // すべてのURLで読み込み失敗
  console.info("[squad-builder] data/matches.json を読み込めないため、試合の選択肢は空です。");
}

/** 保存データから復元するとき、一覧に無い文字列でも選べるようにする */
function setMatchSelectValue(value) {
  const select = $("#field-match");
  if (!select) return;
  if (value && ![...select.options].some((o) => o.value === value)) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  }
  select.value = value || "";
}

function playerImageSrc(player) {
  if (player.image) {
    // players.json の image は public/ からの相対で持つため、その分をさかのぼる
    return player.image;
  }
  return `${PLAYER_IMAGE_BASE}${encodeURIComponent(player.number)}.webp`;
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

/* ------------------------------------------------------------------
   ピッチの描画
------------------------------------------------------------------ */
function renderPitch() {
  // 既存の .player 要素を作り直す（装飾レイヤーは残す）
  $$(".player", pitchEl).forEach((el) => el.remove());

  state.slots.forEach((slot, index) => {
    const player = slot.playerNumber ? findPlayer(slot.playerNumber) : null;
    const posLabel = state.formationKey === "free" && player
      ? player.position
      : slot.posLabel;

    const wrap = document.createElement("div");
    wrap.className = "player" + (player ? "" : " is-empty");
    wrap.dataset.slotIndex = String(index);
    wrap.setAttribute("role", "group");
    wrap.setAttribute(
      "aria-label",
      (player ? `${posLabel} ${player.nameEn}` : `${posLabel} 未選択`) +
        "。ドラッグで移動、選択で選手を選べます。"
    );
    wrap.innerHTML = cardMarkup(player, posLabel);

    const selectBtn = document.createElement("button");
    selectBtn.type = "button";
    selectBtn.className = "select-btn";
    selectBtn.setAttribute(
      "aria-label",
      (player ? `${posLabel}：${player.nameEn} を変更` : `${posLabel} に選手を選ぶ`)
    );
    selectBtn.addEventListener("click", (e) => {
      if (wrap.dataset.justDragged === "1") {
        wrap.dataset.justDragged = "";
        return;
      }
      openPicker({ kind: "slot", index });
    });
    wrap.appendChild(selectBtn);

    if (state.showPill) {
      const pill = document.createElement("div");
      pill.className = "pos-pill";
      pill.textContent = posLabel;
      wrap.appendChild(pill);
    }

    attachDrag(wrap, slot);
    attachKeyboardNudge(wrap, slot);
    pitchEl.appendChild(wrap);
  });
}

/* ベンチは「画像に載る表示」と「編集用の操作」を分ける。
   キャンバス内（#bench）は表示専用のチップにして、寸法をキャンバス基準（cqw）で
   縮められるようにする。タップ領域44pxが必要な編集用ボタンは、キャンバスの外
   （#bench-editor）に置く。こうしないと編集用のpx寸法がフッターを押し広げ、
   ピッチが薄くなってカードが重なる。 */

/** ベンチチップの縮小率の下限 */
const BENCH_SCALE_MIN = 0.6;
let benchScale = 1;

/** 画像に載るベンチ人数から、基準の縮小率を決める */
function baseBenchScale() {
  const count = getBench().length;
  if (count <= 6) return 1;
  if (count <= 9) return 0.86;
  return 0.74;
}

function applyBenchScale() {
  benchEl.style.setProperty("--bench-scale", String(benchScale));
}

/** キャンバス内のベンチ（表示専用） */
function renderBenchDisplay() {
  benchEl.innerHTML = "";
  getBench().forEach((number) => {
    const player = findPlayer(number);
    if (!player) return;
    const chip = document.createElement("span");
    chip.className = "bench-slot";
    chip.innerHTML = `<b>${escapeHtml(player.number)}</b>${escapeHtml(player.nameEn)}`;
    benchEl.appendChild(chip);
  });
  applyBenchScale();
}

/** キャンバス外のベンチ編集UI。タップ領域を十分にとる */
function renderBenchEditor() {
  if (!benchEditorEl) return;
  benchEditorEl.innerHTML = "";
  const bench = getBench();

  bench.forEach((number) => {
    const player = findPlayer(number);
    if (!player) return;
    const item = document.createElement("span");
    item.className = "bench-edit-slot";
    item.innerHTML = `<b>${escapeHtml(player.number)}</b>${escapeHtml(player.nameEn)}`;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "bench-edit-remove";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `${player.nameEn} を控えから外す`);
    remove.addEventListener("click", () => {
      removeFromSquad(number);
      renderAll();
    });
    item.appendChild(remove);
    benchEditorEl.appendChild(item);
  });

  const add = document.createElement("button");
  add.type = "button";
  add.className = "bench-edit-add";
  add.textContent = "＋ 控えを追加";
  add.addEventListener("click", () => openPicker({ kind: "bench" }));
  benchEditorEl.appendChild(add);

  benchCountEl.textContent = bench.length
    ? `控え ${bench.length}人`
    : "控えはまだ登録されていません";
}

function renderBench() {
  renderBenchDisplay();
  renderBenchEditor();
}

function renderMeta() {
  titleTextEl.textContent = state.title;
  subtitleEl.textContent = state.matchInfo;
  // 投稿者名は入力があるときだけ出す
  const poster = state.poster.trim();
  posterEl.textContent = poster ? `予想: ${poster}` : "";
  posterEl.hidden = !poster;
  canvas.dataset.style = state.style;
  document.body.classList.toggle("show-ja", state.showJa);
  document.body.classList.toggle("show-pill", state.showPill);
}

function renderAll() {
  renderMeta();
  renderPitch();
  renderBench();
  requestAnimationFrame(layoutPitch);
}

/* ------------------------------------------------------------------
   寸法計算（design-mockup.html の fitCards / fitNames と同じ考え方）
   スタイルによって余白やヘッダー高さが変わるため、毎回測り直す。
   自由配置レイアウトのため「行」の概念がなく、
   ピッチの実寸から上限を算出したうえで、各カードの位置を
   ピッチ内に収まるようクランプする。
------------------------------------------------------------------ */
/** カードの縦横比（.card の aspect-ratio と同じ） */
const CARD_ASPECT = 64 / 47; // height / width
/** カード高さの下限。重ならない範囲でのみ効かせる（幾何的な上限を超えない） */
const CARD_H_MIN = 70;
/** カード高さの上限。420px幅キャンバスでの見え方に合わせた値 */
const CARD_H_MAX = 75.1;

function fitCards() {
  const pitch = pitchEl;
  // .player 自体の余白（CSSのpaddingぶん）も占有矩形に含める。値をCSSから直接測ることで、
  // squad.css 側の余白が変わっても追随する。
  const samplePlayer = $(".player", pitch);
  const playerCs = samplePlayer ? getComputedStyle(samplePlayer) : null;
  const playerPadX = playerCs ? parseFloat(playerCs.paddingLeft) + parseFloat(playerCs.paddingRight) : 4;
  const playerPadY = playerCs ? parseFloat(playerCs.paddingTop) + parseFloat(playerCs.paddingBottom) : 2;
  const sampleCard = samplePlayer ? $(".card", samplePlayer) : null;
  const playerRect = samplePlayer?.getBoundingClientRect();
  const cardRect = sampleCard?.getBoundingClientRect();
  // カード下に出る名前・ポジション表示まで含めた占有高さを、現在のDOMから比率で求める。
  // シンプルのようにカード外へ名前を出すスタイルも、個別分岐なしで同じ計算へ反映する。
  const belowCardRatio =
    playerRect && cardRect && cardRect.height > 0
      ? Math.max(0, playerRect.bottom - cardRect.bottom) / cardRect.height
      : 0;
  const playerHeightRatio = 1 + belowCardRatio;
  const margin = 1; // 上下左右の安全マージン
  const availH = pitch.clientHeight - margin;
  const availW = pitch.clientWidth - margin;
  const pitchW = pitch.clientWidth;
  const pitchH = pitch.clientHeight;
  // シンプルは円形（1:1）、それ以外は盾型（47:64）。実際のCSSと同じ比率で
  // 横方向の上限を求めないと、円形カードだけ隣のスロットへ重なる。
  const cardAspect = state.style === "simple" ? 1 : CARD_ASPECT;

  // 縦：ピッチ高さの目安比率（design-mockup.htmlの4行構成に近い密度）。見やすさの上限として使う。
  let cardH = pitch.clientHeight * 0.225;

  // フォーメーションごとの実際のスロット間隔から、カードどうしが重ならない上限を求める。
  // .player の占有矩形は、幅=カード幅、高さ=カード高さ×実測比率として扱う。
  // 2枚の矩形が重ならないためには、中心間の横距離がカード幅以上、または
  // 中心間の縦距離がプレイヤー占有高さ以上あればよい（軸分離の判定）。
  // どちらか一方の条件を満たせばよいので、各組について許容できるカード高さの上限は
  // 「横方向だけで満たす場合の上限」と「縦方向だけで満たす場合の上限」の大きい方になる。
  // 全ペアのうち一番厳しい（小さい）上限が、このフォーメーションで安全な最大カード高さ。
  const slots = state.slots;
  let pairBound = Infinity;
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const dx = (Math.abs(slots[i].x - slots[j].x) / 100) * pitchW;
      const dy = (Math.abs(slots[i].y - slots[j].y) / 100) * pitchH;
      const boundByWidth = (dx - playerPadX) * cardAspect; // 横方向だけで dx >= カード幅+余白 を満たす上限
      const boundByHeight = (dy - playerPadY) / playerHeightRatio; // 縦方向だけで占有高さが中心間隔へ収まる上限
      pairBound = Math.min(pairBound, Math.max(boundByWidth, boundByHeight));
    }
  }
  if (Number.isFinite(pairBound)) cardH = Math.min(cardH, pairBound);

  // ピッチ自体に収まる上限（安全マージンとカード下の表示領域を含む）
  cardH = Math.min(cardH, (availH - playerPadY) / playerHeightRatio);
  cardH = Math.min(cardH, (availW - playerPadX) * cardAspect);
  // ここまでで求めた値は「これ以上大きくすると重なる／はみ出す」という幾何的な上限。
  // 下限 CARD_H_MIN はこの上限を超えない範囲でだけ効かせる。上限を無視して下限を
  // 優先すると、カードどうしが重なる（a808f1a の不具合はこれが原因）。
  const idealH = cardH;
  cardH = Math.min(Math.max(cardH, CARD_H_MIN), CARD_H_MAX, idealH);
  pitch.style.setProperty("--card-h", cardH + "px");
  return { cardH, idealH, clamped: idealH < CARD_H_MIN };
}

/** 1行に収まらない見出しを、収まるまで文字サイズを下げる */
function fitOneLine(el) {
  el.style.fontSize = "";
  const base = parseFloat(getComputedStyle(el).fontSize);
  const avail = el.parentElement.clientWidth;
  if (!avail) return;
  let size = base;
  const min = base * 0.6;
  while (el.scrollWidth > avail && size > min) {
    size -= base * 0.04;
    el.style.fontSize = `${size}px`;
  }
}

function fitNames() {
  [subtitleEl, titleTextEl].forEach((el) => {
    if (el) fitOneLine(el);
  });
  $$(".name-en,.name-ja,.tile span", pitchEl).forEach((el) => {
    el.style.fontSize = "";
    el.style.transform = "";
    const base = parseFloat(getComputedStyle(el).fontSize);
    const box = el.parentElement;
    const cs = getComputedStyle(box);
    const ratio = parseFloat(el.dataset.fitRatio || 1);
    const avail =
      (box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) * ratio;
    if (avail <= 0 || !base) return;
    let size = base;
    const min = base * 0.6;
    while (el.offsetWidth > avail && size > min) {
      size -= base * 0.04;
      el.style.fontSize = size + "px";
    }
    if (el.offsetWidth > avail) {
      el.style.transformOrigin = "center";
      el.style.transform = "scaleX(" + (avail / el.offsetWidth).toFixed(3) + ")";
    }
  });
}

// 各 .player をピッチ内に収まるようクランプして配置する。
function layoutPitch() {
  // ベンチの行数が増えるとフッターが伸び、ピッチが薄くなってカードが重なる。
  // まず枚数に応じた基準の縮小率を当て、それでもカードが下限に張り付く場合は
  // ベンチ側をもう一段縮めて、ピッチの取り分を増やす。
  benchScale = baseBenchScale();
  applyBenchScale();
  let fitted = fitCards();
  for (let i = 0; i < 2 && fitted.clamped && benchScale > BENCH_SCALE_MIN; i++) {
    benchScale = Math.max(BENCH_SCALE_MIN, benchScale - 0.1);
    applyBenchScale();
    fitted = fitCards();
  }
  const pitchRect = pitchEl.getBoundingClientRect();
  $$(".player", pitchEl).forEach((el) => {
    const index = Number(el.dataset.slotIndex);
    const slot = state.slots[index];
    if (!slot) return;
    positionPlayer(el, slot, pitchRect);
  });
  fitNames();
}

function positionPlayer(el, slot, pitchRectArg) {
  const pitchRect = pitchRectArg || pitchEl.getBoundingClientRect();
  const halfW = el.offsetWidth / 2;
  const halfH = el.offsetHeight / 2;
  let leftPx = (slot.x / 100) * pitchRect.width;
  let topPx = (slot.y / 100) * pitchRect.height;
  const minL = Math.min(halfW, pitchRect.width / 2);
  const maxL = Math.max(pitchRect.width - halfW, pitchRect.width / 2);
  const minT = Math.min(halfH, pitchRect.height / 2);
  const maxT = Math.max(pitchRect.height - halfH, pitchRect.height / 2);
  leftPx = Math.min(Math.max(leftPx, minL), maxL);
  topPx = Math.min(Math.max(topPx, minT), maxT);
  el.style.left = leftPx + "px";
  el.style.top = topPx + "px";
}

/* ------------------------------------------------------------------
   ドラッグ操作（ポインタイベント。タッチでも動く）
------------------------------------------------------------------ */
function attachDrag(el, slot) {
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let originLeft = 0;
  let originTop = 0;
  const threshold = 6;

  el.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".select-btn") && e.pointerType !== "touch" && e.pointerType !== "pen") {
      // マウスではボタン自体のクリックにも任せるが、ドラッグ検出は続ける
    }
    startX = e.clientX;
    startY = e.clientY;
    originLeft = parseFloat(el.style.left) || 0;
    originTop = parseFloat(el.style.top) || 0;
    dragging = false;

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!dragging && Math.hypot(dx, dy) > threshold) {
        dragging = true;
        el.classList.add("dragging");
        // ドラッグが確定した時点でポインタを捕捉する。
        // 最初から捕捉すると select-btn への click が発火しなくなるため遅延させる。
        el.setPointerCapture(e.pointerId);
      }
      if (!dragging) return;
      const pitchRect = pitchEl.getBoundingClientRect();
      const newLeft = originLeft + dx;
      const newTop = originTop + dy;
      slot.x = (newLeft / pitchRect.width) * 100;
      slot.y = (newTop / pitchRect.height) * 100;
      positionPlayer(el, slot, pitchRect);
    };
    const onUp = (ev) => {
      if (dragging) el.releasePointerCapture(e.pointerId);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      if (dragging) {
        el.classList.remove("dragging");
        el.dataset.justDragged = "1";
        // 最終位置を確定（クランプ込みで再配置）
        positionPlayer(el, slot);
      }
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
  });
}

// キーボードでも位置を微調整できるように、矢印キーで2%ずつ動かす
function attachKeyboardNudge(el, slot) {
  el.tabIndex = -1; // フォーカス自体は内部の select-btn が担う。予備として保持。
  el.addEventListener("keydown", (e) => {
    const step = 2;
    let moved = true;
    if (e.key === "ArrowLeft") slot.x -= step;
    else if (e.key === "ArrowRight") slot.x += step;
    else if (e.key === "ArrowUp") slot.y -= step;
    else if (e.key === "ArrowDown") slot.y += step;
    else moved = false;
    if (moved) {
      e.preventDefault();
      positionPlayer(el, slot);
    }
  });
}

/* ------------------------------------------------------------------
   選手選択モーダル
------------------------------------------------------------------ */
function openPicker(target) {
  pickerTarget = target;
  pickerFilter =
    target.kind === "slot" && state.formationKey !== "free"
      ? state.slots[target.index].posGroup || "ALL"
      : "ALL";
  buildPickerFilters();
  renderPickerList();
  pickerTitle.textContent =
    target.kind === "slot"
      ? `${state.slots[target.index].posLabel} に選手を選ぶ`
      : "控えに追加する選手を選ぶ";
  pickerBackdrop.classList.add("open");
  lockBackgroundScroll();
  pickerClose.focus();
}

function closePicker() {
  pickerBackdrop.classList.remove("open");
  unlockBackgroundScroll();
  pickerTarget = null;
}

/* モーダルを開いている間、背面の画面が動かないようにする。
   iOS Safari は overflow:hidden だけでは背面がスクロールしてしまうため、
   body を position:fixed で止めて、閉じるときに元の位置へ戻す。 */
let lockedScrollY = 0;

function lockBackgroundScroll() {
  lockedScrollY = window.scrollY;
  document.body.style.top = `-${lockedScrollY}px`;
  document.body.classList.add("picker-open");
}

function unlockBackgroundScroll() {
  if (!document.body.classList.contains("picker-open")) return;
  document.body.classList.remove("picker-open");
  document.body.style.top = "";
  window.scrollTo(0, lockedScrollY);
}

function buildPickerFilters() {
  const groups = ["ALL", "GK", "DF", "MF", "FW"];
  pickerFilters.innerHTML = "";
  groups.forEach((g) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = g === "ALL" ? "すべて" : g;
    btn.setAttribute("aria-pressed", String(g === pickerFilter));
    btn.addEventListener("click", () => {
      pickerFilter = g;
      buildPickerFilters();
      renderPickerList();
    });
    pickerFilters.appendChild(btn);
  });
}

function renderPickerList() {
  pickerList.innerHTML = "";
  const list = players.filter((p) => {
    if (p.isMascot && !state.showMascot) return false;
    if (p.isMascot && pickerTarget?.kind === "slot") return false; // マスコットはベンチのみ
    if (pickerFilter !== "ALL" && p.position !== pickerFilter) return false;
    return true;
  });
  if (!list.length) {
    pickerList.innerHTML = `<p class="picker-empty">条件に合う選手がいません。</p>`;
    return;
  }
  list.forEach((p) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "picker-item" + (isAssigned(p.number) ? " is-used" : "");
    item.innerHTML = `
      <span class="num">${escapeHtml(p.number)}</span>
      <span class="names"><span class="en">${escapeHtml(p.nameEn)}</span><br><span class="ja">${escapeHtml(p.nameJa || "")}</span></span>
      <span class="pos-tag">${escapeHtml(p.position || "MASCOT")}</span>
    `;
    item.addEventListener("click", () => {
      assignPlayer(p.number);
      closePicker();
    });
    pickerList.appendChild(item);
  });
}

function assignPlayer(number) {
  if (!pickerTarget) return;
  if (pickerTarget.kind === "slot") {
    // すでに他の枠にいる場合は、そちらを空けてから置く（重複を作らない）
    state.slots.forEach((slot) => {
      if (slot.playerNumber === number) slot.playerNumber = null;
    });
    state.slots[pickerTarget.index].playerNumber = number;
  }
  addToSquad(number);
  renderAll();
}

pickerClear.addEventListener("click", () => {
  if (!pickerTarget) return;
  if (pickerTarget.kind === "slot") {
    const number = state.slots[pickerTarget.index].playerNumber;
    if (number) removeFromSquad(number);
  }
  closePicker();
  renderAll();
});
pickerClose.addEventListener("click", closePicker);
pickerBackdrop.addEventListener("click", (e) => {
  if (e.target === pickerBackdrop) closePicker();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && pickerBackdrop.classList.contains("open")) closePicker();
});

/* ------------------------------------------------------------------
   画像化（PNG出力）
   docs/image-generation-research.md の結論に従い、modern-screenshot@4.6.5 を使う。
   年間スケジュールページ（public/assets/app.js）ではesm.sh CDN経由で同バージョンを
   読み込んでいるが、本プロトタイプではCDNに依存せず、npm registryから取得した
   modern-screenshot@4.6.5 の dist/index.mjs をそのまま
   experiments/squad-builder/vendor/modern-screenshot/modern-screenshot.mjs に
   静的配置して読み込む（MITライセンス表記は同ディレクトリのLICENSEを参照）。
------------------------------------------------------------------ */
async function exportPng(node) {
  // modern-screenshot はブラウザ内でDOMを解析してPNGのdata URLを返す。
  // 対象DOMや生成画像を外部サーバーへ送信しない。
  // 背景色を明示しないと透明/黒背景に見えることがあるため、canvas自体の
  // 背景色（styleで設定済み）に加えてbackgroundColorも指定しておく。
  return await domToPng(node, {
    scale: 2,
    backgroundColor: getComputedStyle(node).backgroundColor || "#0b0b12",
  });
}

const exportBtn = $("#export-btn");
const exportStatus = $("#export-status");
const exportPreview = $("#export-preview");

exportBtn.addEventListener("click", async () => {
  exportBtn.disabled = true;
  exportStatus.textContent = "画像を生成しています…";
  exportPreview.innerHTML = "";
  try {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const dataUrl = await exportPng(canvas);
    const img = document.createElement("img");
    img.src = dataUrl;
    img.alt = "生成された予想スカッド画像のプレビュー";
    exportPreview.appendChild(img);
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "sanga-squad.png";
    a.textContent = "画像を保存";
    a.className = "btn";
    exportPreview.appendChild(a);
    const help = document.createElement("p");
    help.className = "export-save-help";
    help.textContent = "スマホでは画像を長押しして保存してください。";
    exportPreview.appendChild(help);
    exportStatus.textContent = "画像を保存できます。";
  } catch (err) {
    console.error("Squad image generation failed:", err);
    exportStatus.textContent =
      "画像生成に失敗しました。表示スタイルや選手の配置を変えて再度お試しください。エラー: " +
      (err && err.message ? err.message : String(err));
  } finally {
    exportBtn.disabled = false;
  }
});

/* ------------------------------------------------------------------
   保存・呼び出し（LocalStorage、名前を付けて複数保存）
------------------------------------------------------------------ */
function getIndex() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_INDEX_KEY) || "[]");
  } catch {
    return [];
  }
}
function setIndex(list) {
  localStorage.setItem(STORAGE_INDEX_KEY, JSON.stringify(list));
}
function saveKeyFor(name) {
  return STORAGE_PREFIX + "save-" + encodeURIComponent(name);
}

function saveSquad(name) {
  const data = {
    formationKey: state.formationKey,
    slots: state.slots.map(({ id, posGroup, posLabel, x, y, playerNumber }) => ({
      id, posGroup, posLabel, x, y, playerNumber,
    })),
    squad: state.squad,
    title: state.title,
    matchInfo: state.matchInfo,
    poster: state.poster,
    style: state.style,
    showJa: state.showJa,
    showPill: state.showPill,
    showMascot: state.showMascot,
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(saveKeyFor(name), JSON.stringify(data));
  const index = getIndex();
  if (!index.includes(name)) index.push(name);
  setIndex(index);
  renderSaveList();
}

function loadSquad(name) {
  const raw = localStorage.getItem(saveKeyFor(name));
  if (!raw) return;
  const data = JSON.parse(raw);
  state.formationKey = data.formationKey;
  state.slots = data.slots;
  // 旧形式（bench が9枠固定の配列）も読めるようにする。書き戻しは新形式のみ。
  // 背番号は文字列で扱う（players.json が文字列のため）。古い保存データに
  // 数値が入っていても照合できるようにそろえる。
  state.squad = (
    Array.isArray(data.squad)
      ? data.squad
      : [
          ...data.slots.map((slot) => slot.playerNumber),
          ...(data.bench || []),
        ]
  )
    .filter(Boolean)
    .map(String);
  state.slots.forEach((slot) => {
    if (slot.playerNumber) slot.playerNumber = String(slot.playerNumber);
  });
  state.title = data.title;
  state.matchInfo = data.matchInfo;
  state.poster = data.poster || "";
  state.style = data.style;
  state.showJa = data.showJa;
  state.showPill = data.showPill;
  state.showMascot = data.showMascot;

  $("#field-title").value = state.title;
  setMatchSelectValue(state.matchInfo);
  $("#field-poster").value = state.poster;
  $("#field-style").value = state.style;
  $("#tg-ja").checked = state.showJa;
  $("#tg-pill").checked = state.showPill;
  $("#tg-mascot").checked = state.showMascot;
  $$("#formation-grid .btn").forEach((btn, i) => {
    btn.setAttribute("aria-pressed", String(Object.keys(FORMATIONS)[i] === state.formationKey));
  });
  formationNumEl.textContent = FORMATIONS[state.formationKey].label;
  renderAll();
}

function deleteSquad(name) {
  localStorage.removeItem(saveKeyFor(name));
  setIndex(getIndex().filter((n) => n !== name));
  renderSaveList();
}

function renderSaveList() {
  const listEl = $("#save-list");
  const index = getIndex();
  listEl.innerHTML = "";
  if (!index.length) {
    listEl.innerHTML = `<p class="picker-empty">保存されたスカッドはまだありません。</p>`;
    return;
  }
  index.forEach((name) => {
    const row = document.createElement("div");
    row.className = "save-item";
    row.innerHTML = `<span>${escapeHtml(name)}</span>`;
    const loadBtn = document.createElement("button");
    loadBtn.className = "btn";
    loadBtn.textContent = "呼び出す";
    loadBtn.setAttribute("aria-label", `${name} を呼び出す`);
    loadBtn.addEventListener("click", () => loadSquad(name));
    const delBtn = document.createElement("button");
    delBtn.className = "btn danger";
    delBtn.textContent = "削除";
    delBtn.setAttribute("aria-label", `${name} を削除`);
    delBtn.addEventListener("click", () => {
      if (confirm(`「${name}」を削除しますか？`)) deleteSquad(name);
    });
    row.appendChild(loadBtn);
    row.appendChild(delBtn);
    listEl.appendChild(row);
  });
}

/* ------------------------------------------------------------------
   設定パネルのイベント結線
------------------------------------------------------------------ */
function wireControls() {
  $("#field-title").addEventListener("input", (e) => {
    state.title = e.target.value;
    renderMeta();
  });
  $("#field-match").addEventListener("change", (e) => {
    state.matchInfo = e.target.value;
    renderMeta();
  });
  $("#field-poster").addEventListener("input", (e) => {
    state.poster = e.target.value;
    renderMeta();
  });
  $("#field-style").addEventListener("change", (e) => {
    state.style = e.target.value;
    renderMeta();
    requestAnimationFrame(layoutPitch);
  });
  $("#tg-ja").addEventListener("change", (e) => {
    state.showJa = e.target.checked;
    renderMeta();
    requestAnimationFrame(layoutPitch);
  });
  $("#tg-pill").addEventListener("change", (e) => {
    state.showPill = e.target.checked;
    renderMeta();
    renderPitch();
    requestAnimationFrame(layoutPitch);
  });
  $("#tg-mascot").addEventListener("change", (e) => {
    state.showMascot = e.target.checked;
  });
  $("#reset-positions").addEventListener("click", resetPositions);
  $("#save-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("#save-name");
    const name = input.value.trim();
    if (!name) return;
    saveSquad(name);
    input.value = "";
  });
}

/* ------------------------------------------------------------------
   初期化
------------------------------------------------------------------ */
async function init() {
  players = await loadPlayers();
  await loadMatchOptions();
  buildFormationButtons();
  wireControls();
  renderSaveList();
  renderAll();
  window.addEventListener("resize", () => requestAnimationFrame(layoutPitch));
  // ベンチの行数や見出しの行数が変わるとピッチの高さも変わる。
  // そのたびにカードの寸法を計算し直す。
  if (window.ResizeObserver) {
    let scheduled = false;
    new ResizeObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        layoutPitch();
      });
    }).observe(pitchEl);
  }
  document.fonts && document.fonts.ready.then(() => requestAnimationFrame(layoutPitch));
}
init();
