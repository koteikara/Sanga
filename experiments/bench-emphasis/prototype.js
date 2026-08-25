/*
 * ベンチ強調オプションのプロトタイプ本体
 *
 * 本番ページ（squad.html）を同一オリジンのiframeで4枚読み込み、
 * それぞれに別のベンチ設定を当てて並べて比べる。配置計算・画像・
 * スタイル切替は本番のコードがそのまま動くので、ベンチだけを差し替えた
 * ときに実際どう見えるかを、移植前に確認できる。
 *
 * ここでやっていること:
 *   1. iframeの中の本番UIを操作して、スタメン11人と控えを埋める
 *   2. ベンチのCSS（bench-overlay.css.js）を差し込む
 *   3. ベンチのDOMを見せ方に応じて組み替える（tileのときだけ）
 *
 * 3は本番では squad-builder.js の renderBenchDisplay() が行う想定。
 * ここでは本番のJSを変更せずに確かめるため、外から組み替えている。
 */
import { NAME_SHORT } from "./name-short.js";
import { BENCH_OVERLAY_CSS } from "./bench-overlay.css.js";

/** 本番ページの位置。public/experiments/<name>/ から見た相対 */
const SQUAD_URL = "../../squad.html";
/** 背番号タイル画像の位置 */
const PLAYER_IMAGE_BASE = "../../assets/players/";
/** 背番号タイルの中央寄せ補正 */
const TILE_OFFSETS_URL = "../../assets/squad-tile-offsets.js";

/** 4通りの比較。見せ方（chip / tile）× 大きさ（standard / large） */
const VARIANTS = [
  { format: "chip", emphasis: "standard", title: "A. チップ × 標準（現行）", desc: "いまの見え方。比較の基準にする。" },
  { format: "chip", emphasis: "large", title: "B. チップ × 大きめ", desc: "文字と余白を1.35倍。1行あたりの人数が減り、背番号と名前が読みやすくなる。" },
  { format: "tile", emphasis: "standard", title: "C. 背番号タイル × 標準", desc: "スタメンと同じ背番号画像を円で並べる。名前は省略名。" },
  { format: "tile", emphasis: "large", title: "D. 背番号タイル × 大きめ", desc: "Cを1.35倍。もっとも目立つが、ピッチの取り分が減る。" },
];

/** 見分けにくい組み合わせを意図的に含めた控えの並び */
const BENCH_PRESET = ["38", "43", "2", "10", "16", "31", "39", "23", "26", "9", "34", "36"];

const $ = (sel) => document.querySelector(sel);
const statusEl = $("#status");
const variantsEl = $("#variants");

let tileOffsets = {};
try {
  ({ TILE_OFFSETS: tileOffsets } = await import(TILE_OFFSETS_URL));
} catch (err) {
  console.warn("[bench-emphasis] 背番号タイルの補正値を読めませんでした。補正なしで表示します。", err);
}

function currentSettings() {
  return {
    width: Number($("#field-width").value),
    benchCount: Number($("#field-bench").value),
    style: $("#field-style").value,
    showName: $("#field-name").value,
    priority: $("#field-priority").value,
  };
}

/**
 * iframeの読み込み完了を待つ。
 * src を指定した直後の contentDocument は about:blank で readyState が
 * complete になっているため、readyState では判断せず load を待つ。
 */
function waitForLoad(frame) {
  return new Promise((resolve) => {
    frame.addEventListener("load", () => resolve(), { once: true });
  });
}

/** 条件が満たされるまで待つ。本番UIの描画待ちに使う */
async function waitFor(check, label) {
  for (let i = 0; i < 200; i++) {
    if (check()) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`待機がタイムアウトしました: ${label}`);
}

/** iframeの中の本番UIを操作して、スタメンと控えを埋める */
async function fillSquad(doc, { style, benchCount }) {
  await waitFor(() => doc.querySelectorAll("#pitch .player .select-btn").length === 11, "ピッチの枠");
  await waitFor(() => doc.querySelectorAll(".picker-item").length > 0 || true, "選手一覧");

  const styleSelect = doc.querySelector("#field-style");
  styleSelect.value = style;
  styleSelect.dispatchEvent(new doc.defaultView.Event("change", { bubbles: true }));

  const pickItem = (predicate) => {
    const item = [...doc.querySelectorAll(".picker-item")].find(predicate);
    if (!item) throw new Error("選手を選べませんでした");
    item.click();
  };

  // スタメンは控えに使う背番号を避けて埋める
  const starters = [...doc.querySelectorAll("#pitch .player .select-btn")];
  for (const btn of starters) {
    btn.click();
    await waitFor(() => doc.querySelectorAll(".picker-item").length > 0, "選手一覧");
    pickItem((el) => {
      const num = el.querySelector(".num").textContent.trim();
      return !el.classList.contains("is-used") && !BENCH_PRESET.includes(num);
    });
  }

  // 控えは見分けにくい組み合わせを含む固定の並びで埋める
  for (const num of BENCH_PRESET.slice(0, benchCount)) {
    doc.querySelector(".bench-edit-add").click();
    await waitFor(() => doc.querySelectorAll(".picker-item").length > 0, "選手一覧");
    pickItem((el) => el.querySelector(".num").textContent.trim() === num);
  }
}

/** ベンチのCSSをiframeへ差し込む */
function injectBenchCss(doc) {
  if (doc.getElementById("bench-overlay-css")) return;
  const style = doc.createElement("style");
  style.id = "bench-overlay-css";
  style.textContent = BENCH_OVERLAY_CSS;
  doc.head.appendChild(style);
}

/**
 * ベンチのDOMを見せ方に合わせて組み替える。
 * 本番では renderBenchDisplay() がこの形で組み立てる想定。
 */
function applyBenchFormat(doc, { format, emphasis, showName, priority }) {
  const bench = doc.querySelector("#bench");
  if (!bench) return;
  // 属性はキャンバスに付ける。フッターの上限も同じ根から指定でき、
  // :has() を使わずに済む（iOS Safari 15系に :has() が無い）。
  const canvas = doc.querySelector("#canvas");
  canvas.dataset.benchFormat = format;
  canvas.dataset.benchEmphasis = emphasis;
  canvas.dataset.benchName = showName;

  bench.querySelectorAll(".bench-slot").forEach((slot) => {
    const num = slot.dataset.number || slot.querySelector("b")?.textContent?.trim();
    if (!num) return;
    slot.dataset.number = num;
    if (format === "chip") {
      // 現行の見せ方。背番号＋ローマ字名
      if (!slot.dataset.chipHtml) return;
      slot.innerHTML = slot.dataset.chipHtml;
      return;
    }
    if (!slot.dataset.chipHtml) slot.dataset.chipHtml = slot.innerHTML;
    const offset = tileOffsets[num] || { dx: 0, dy: 0 };
    const short = NAME_SHORT[num] || "";
    slot.innerHTML =
      `<span class="bench-face">` +
      `<img src="${PLAYER_IMAGE_BASE}${encodeURIComponent(num)}.webp" alt=""` +
      ` style="--tile-dx:${offset.dx};--tile-dy:${offset.dy}"></span>` +
      `<span class="bench-name">${short}</span>`;
  });

  applyPriority(doc, priority);
  if (format === "tile") fitBenchNames(doc);
}

/**
 * 「大きめ」を選んだときに、ピッチとベンチのどちらを優先するか。
 *
 * 本番の layoutPitch() は、カードが下限（70px）に張り付くとベンチ側を
 * 自動で縮めてピッチの取り分を増やす。ピッチ優先のこの動きは、ベンチを
 * 大きくしたいという指定と競合し、「大きめ」がほぼ効かなくなる。
 * ベンチ優先では、人数だけで決まる基準の縮小率へ戻して比べられるようにする。
 * 本番へ移植するなら、大きめのときだけカード高さの下限を緩める形になる。
 */
function applyPriority(doc, priority) {
  const bench = doc.querySelector("#bench");
  if (!bench || priority !== "bench") return;
  const count = bench.children.length;
  const base = count <= 6 ? 1 : count <= 9 ? 0.86 : 0.74;
  const current = bench.style.getPropertyValue("--bench-scale");
  if (current === String(base)) return;
  bench.style.setProperty("--bench-scale", String(base));
  fitBenchNames(doc);
}

/**
 * 本番側は配置し直すたびに --bench-scale を書き戻すため、ベンチ優先の
 * 指定はそのあとに当て直す必要がある。styleの変化を見て掛け直す。
 */
function watchPriority(doc, priority) {
  if (priority !== "bench") return;
  const bench = doc.querySelector("#bench");
  if (!bench) return;
  new doc.defaultView.MutationObserver(() => applyPriority(doc, priority))
    .observe(bench, { attributes: true, attributeFilter: ["style"] });
}

/**
 * 名前が枠に収まらない場合だけ横方向へ圧縮する。
 * カードの名前（squad-builder.js の fitNames）と同じ考え方。
 */
function fitBenchNames(doc) {
  doc.querySelectorAll("#bench .bench-slot").forEach((slot) => {
    const name = slot.querySelector(".bench-name");
    if (!name) return;
    name.style.transform = "";
    const avail = slot.getBoundingClientRect().width;
    const width = name.getBoundingClientRect().width;
    if (width > avail && width > 0) {
      name.style.transform = `scaleX(${(avail / width).toFixed(3)})`;
    }
  });
}

/** 1枚ぶんの比較を作る */
async function buildVariant(variant, settings) {
  const wrap = document.createElement("div");
  wrap.className = "variant";
  wrap.innerHTML =
    `<h2>${variant.title}</h2>` +
    `<p class="desc">${variant.desc}</p>`;
  const frame = document.createElement("iframe");
  frame.src = SQUAD_URL;
  frame.width = settings.width;
  frame.height = Math.round(settings.width * 16 / 9) + 220; // ヘッダーと余白のぶん
  frame.title = variant.title;
  wrap.appendChild(frame);
  variantsEl.appendChild(wrap);

  await waitForLoad(frame);
  const doc = frame.contentDocument;
  // キャンバス以外（設定パネル）は比較に不要なので隠す
  const hide = doc.createElement("style");
  // 比較に不要な部分（設定パネル、画像生成の導線、説明文）は隠す
  hide.textContent =
    `.panel,.export-section,.export-status{display:none !important}` +
    `.proto-layout{display:block !important}` +
    `body{padding:8px !important;gap:0 !important}`;
  doc.head.appendChild(hide);

  await fillSquad(doc, { ...settings, ...variant });
  injectBenchCss(doc);
  applyBenchFormat(doc, { ...variant, showName: settings.showName, priority: settings.priority });

  watchPriority(doc, settings.priority);

  // 本番側がベンチを描き直したら、同じ設定をかけ直す
  const bench = doc.querySelector("#bench");
  new doc.defaultView.MutationObserver(() => {
    applyBenchFormat(doc, { ...variant, showName: settings.showName, priority: settings.priority });
  }).observe(bench, { childList: true });
}

async function render() {
  const settings = currentSettings();
  variantsEl.innerHTML = "";
  statusEl.textContent = "読み込み中…";
  try {
    for (const variant of VARIANTS) {
      await buildVariant(variant, settings);
    }
    statusEl.textContent = `幅${settings.width}px／控え${settings.benchCount}人／${$("#field-style").selectedOptions[0].textContent}`;
  } catch (err) {
    statusEl.textContent = `失敗しました: ${err.message}`;
    console.error(err);
  }
}

["#field-width", "#field-bench", "#field-style", "#field-name", "#field-priority"].forEach((sel) => {
  $(sel).addEventListener("change", render);
});

render();
