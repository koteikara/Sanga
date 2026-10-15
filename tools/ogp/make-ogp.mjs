// ページ別のOGP画像（1200×630）を作る。文言を変えたら再実行し、画像をコミットする。
//
// 共通画像と同じ背景・キャラクターの型（tools/ogp/ogp-page.html）にページ名を差し込み、
// Chromium で描画して public/assets/ogp/<key>.jpg に書き出す。
// 文字は Google Fonts の Noto Sans JP を使うため、ネットにつながる環境で実行する。
//
// 使い方: node tools/ogp/make-ogp.mjs
// Playwright はプロジェクトの依存ではない。見つからなければ PLAYWRIGHT_MODULE で場所を指す。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, "../../public/assets/ogp");
const TEMPLATE = pathToFileURL(path.join(here, "ogp-page.html")).href;

// key: 出力名 / title: 「|」で改行 / accent: tools.json のカード色にそろえる
export const PAGES = [
  { key: "timeline", title: "サポーター|タイムライン", lead: "チケット販売とキックオフを、ひとつの時系列に。", accent: "#c0398f" },
  { key: "timeline-calendar", title: "カレンダーで|受け取る", lead: "販売開始と試合日程を、自分のカレンダーへ。", accent: "#c0398f" },
  { key: "season", title: "2026/27|年間スケジュール", lead: "全試合の日程を見て、参戦予定を保存。", accent: "#b0168f" },
  { key: "away", title: "アウェイ|遠征ガイド", lead: "会場・最寄り駅・前泊ホテル候補を、試合ごとに。", accent: "#b0168f" },
  { key: "squad", title: "予想スカッド作成", lead: "スタメンを並べて、画像で共有。", accent: "#2f9e5f" },
  { key: "calendar", title: "過密日程|カレンダー", lead: "2026/27シーズンの試合間隔を色で見る。", accent: "#e0573f" },
  { key: "trade", title: "求・譲|投稿フォーマット", lead: "チケットやグッズの交換を、Xに投稿しやすく。", accent: "#8e44c4" },
];

async function loadChromium() {
  for (const spec of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright/index.mjs"].filter(Boolean)) {
    try { return (await import(spec)).chromium; } catch { /* 次へ */ }
  }
  throw new Error("Playwright が見つかりません。PLAYWRIGHT_MODULE で場所を指定してください");
}

const chromium = await loadChromium();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
fs.mkdirSync(OUT, { recursive: true });
for (const p of PAGES) {
  const q = new URLSearchParams({ title: p.title, lead: p.lead, accent: p.accent });
  await page.goto(`${TEMPLATE}?${q}`, { waitUntil: "networkidle" });
  await page.waitForSelector("body[data-ready]");
  const file = path.join(OUT, `${p.key}.jpg`);
  await page.screenshot({ path: file, type: "jpeg", quality: 88 });
  console.log("wrote", path.relative(process.cwd(), file));
}
await browser.close();
