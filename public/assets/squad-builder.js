// 予想スカッド作成 プロトタイプ本体
// design-mockup.html の見た目（盾型カード、装飾、7スタイル、寸法計算の考え方）を引き継ぎ、
// フォーメーション選択・選手選択・位置の微調整・画像化導線・保存呼び出しを実装する。
// design-mockup.html 自体は変更していない。
import { FORMATIONS, BENCH_SIZE } from "./squad-formations.js";
import { SAMPLE_PLAYERS } from "./squad-sample-players.js";
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
  bench: new Array(BENCH_SIZE).fill(null),
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
  return (
    state.slots.some((s) => s.playerNumber === number) ||
    state.bench.some((n) => n === number)
  );
}

/* ------------------------------------------------------------------
   DOM参照
------------------------------------------------------------------ */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const canvas = $("#canvas");
const pitchEl = $("#pitch");
const benchEl = $("#bench");
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
  return `
    <div class="card${player.isMascot ? " mascot" : ""}"><div class="card-inner">
      <div class="card-split"></div>
      <div class="card-photo">
        <div class="tile"><b>${escapeHtml(player.number)}</b><span>${escapeHtml(player.nameEn)}</span></div>
        <img class="tile-img" src="${escapeHtml(tileSrc)}" alt=""
             onerror="this.closest('.card-photo').classList.add('no-image')">
      </div>
      <div class="card-name">
        <!-- ローマ字名はタイル画像に入っているため、ここでは出さない -->
        <div class="name-ja" data-fit-ratio="0.8">${escapeHtml(nameJa)}</div>
        <div class="flag flag-${escapeHtml(player.nationality || "jp")}"></div>
      </div>
    </div></div>`;
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

function renderBench() {
  benchEl.innerHTML = "";
  state.bench.forEach((number, index) => {
    const player = number ? findPlayer(number) : null;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "bench-slot" + (player ? "" : " is-empty");
    // 空き枠は画像の中で場所を取らないよう、記号だけにする
    btn.innerHTML = player
      ? `<b>${escapeHtml(player.number)}</b>${escapeHtml(player.nameEn)}`
      : "＋";
    btn.setAttribute(
      "aria-label",
      player ? `控え${index + 1}：${player.nameEn} を変更` : `控え${index + 1} に選手を選ぶ`
    );
    btn.addEventListener("click", () => openPicker({ kind: "bench", index }));
    benchEl.appendChild(btn);
  });
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

function fitCards() {
  const pitch = pitchEl;
  const pillEl = $(".pos-pill", pitch);
  const pillH = state.showPill && pillEl ? pillEl.getBoundingClientRect().height : 0;
  // .player 自体の余白（CSSのpaddingぶん）も占有矩形に含める。値をCSSから直接測ることで、
  // squad.css 側の余白が変わっても追随する。
  const samplePlayer = $(".player", pitch);
  const playerCs = samplePlayer ? getComputedStyle(samplePlayer) : null;
  const playerPadX = playerCs ? parseFloat(playerCs.paddingLeft) + parseFloat(playerCs.paddingRight) : 4;
  const playerPadY = playerCs ? parseFloat(playerCs.paddingTop) + parseFloat(playerCs.paddingBottom) : 2;
  const margin = 1; // 上下左右の安全マージン
  const availH = pitch.clientHeight - margin;
  const availW = pitch.clientWidth - margin;
  const pitchW = pitch.clientWidth;
  const pitchH = pitch.clientHeight;

  // 縦：ピッチ高さの目安比率（design-mockup.htmlの4行構成に近い密度）。見やすさの上限として使う。
  let cardH = pitch.clientHeight * 0.225;

  // フォーメーションごとの実際のスロット間隔から、カードどうしが重ならない上限を求める。
  // .player はカード＋ピルの縦積みなので、占有矩形は 幅=カード幅、高さ=カード高さ+ピル高さ とみなす。
  // 2枚の矩形が重ならないためには、中心間の横距離がカード幅以上、または
  // 中心間の縦距離が「カード高さ+ピル高さ」以上あればよい（軸分離の判定）。
  // どちらか一方の条件を満たせばよいので、各組について許容できるカード高さの上限は
  // 「横方向だけで満たす場合の上限」と「縦方向だけで満たす場合の上限」の大きい方になる。
  // 全ペアのうち一番厳しい（小さい）上限が、このフォーメーションで安全な最大カード高さ。
  const slots = state.slots;
  let pairBound = Infinity;
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const dx = (Math.abs(slots[i].x - slots[j].x) / 100) * pitchW;
      const dy = (Math.abs(slots[i].y - slots[j].y) / 100) * pitchH;
      const boundByWidth = (dx - playerPadX) * CARD_ASPECT; // 横方向だけで dx >= カード幅+余白 を満たす上限
      const boundByHeight = dy - pillH - playerPadY; // 縦方向だけで dy >= カード高さ+ピル高さ+余白 を満たす上限
      pairBound = Math.min(pairBound, Math.max(boundByWidth, boundByHeight));
    }
  }
  if (Number.isFinite(pairBound)) cardH = Math.min(cardH, pairBound);

  // ピッチ自体に収まる上限（安全マージン込み。ピルと余白の分だけ縦に余分がいる）
  cardH = Math.min(cardH, availH - pillH - playerPadY);
  cardH = Math.min(cardH, (availW - playerPadX) * CARD_ASPECT);
  cardH = Math.max(cardH, 24);
  pitch.style.setProperty("--card-h", cardH + "px");
  console.log(`[squad] ${state.formationKey}: cardH=${cardH.toFixed(1)}px, pairBound=${pairBound.toFixed(1)}px`);
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
  fitCards();
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
      : `控え ${target.index + 1} に選手を選ぶ`;
  pickerBackdrop.classList.add("open");
  pickerClose.focus();
}

function closePicker() {
  pickerBackdrop.classList.remove("open");
  pickerTarget = null;
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
    state.slots[pickerTarget.index].playerNumber = number;
  } else {
    state.bench[pickerTarget.index] = number;
  }
  renderAll();
}

pickerClear.addEventListener("click", () => {
  if (!pickerTarget) return;
  if (pickerTarget.kind === "slot") state.slots[pickerTarget.index].playerNumber = null;
  else state.bench[pickerTarget.index] = null;
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
    bench: state.bench,
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
  state.bench = data.bench;
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
