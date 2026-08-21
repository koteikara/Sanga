// 背番号タイル画像の「中身の中心」を測り、squad-tile-offsets.js を作り直す。
//
// タイル画像は背番号とローマ字名を焼き込んだ正方形で、画像ごとに中身が
// わずかに左右へ寄っている（実測で最大 ±5%）。円だけで見せるシンプル
// スタイルではこのずれがそのまま「中央でない」と見えるため、画像ごとの
// 補正量を先に測って持たせる。
//
//   npx http-server public -p 8123 -s &
//   node tools/measure-tile-offsets.mjs
//
// 環境変数:
//   BASE_URL           既定 http://127.0.0.1:8123
//   PLAYWRIGHT_MODULE  グローバル導入のPlaywrightを使う場合のimport先
import { readFile, writeFile } from "node:fs/promises";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch (err) {
  if (!process.env.PLAYWRIGHT_MODULE) {
    console.error(
      "Playwrightが見つかりません。`npm i -D playwright` を実行するか、" +
        "PLAYWRIGHT_MODULE にグローバル導入先のパスを指定してください。"
    );
    process.exit(2);
  }
  ({ chromium } = await import(process.env.PLAYWRIGHT_MODULE));
}

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:8123";
const OUT = new URL("../public/assets/squad-tile-offsets.js", import.meta.url);

const data = JSON.parse(await readFile(new URL("../public/data/players.json", import.meta.url), "utf8"));
const numbers = data.players.map((p) => p.number);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${BASE_URL}/squad.html`, { waitUntil: "domcontentloaded" });

const offsets = await page.evaluate(async (nums) => {
  // 地色（#750069）から離れた画素を「中身」とみなし、その外接矩形の中心を測る。
  const BG = [117, 0, 105];
  const out = {};
  for (const n of nums) {
    const img = new Image();
    img.src = `assets/players/${encodeURIComponent(n)}.webp`;
    try {
      await img.decode();
    } catch (err) {
      continue; // 画像が無い背番号は補正なし
    }
    const cv = document.createElement("canvas");
    cv.width = img.width;
    cv.height = img.height;
    const ctx = cv.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
    let x0 = Infinity, x1 = -1;
    for (let y = 0; y < cv.height; y++) {
      for (let x = 0; x < cv.width; x++) {
        const i = (y * cv.width + x) * 4;
        const diff = Math.abs(d[i] - BG[0]) + Math.abs(d[i + 1] - BG[1]) + Math.abs(d[i + 2] - BG[2]);
        if (diff > 60) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
        }
      }
    }
    if (x1 < 0) continue;
    // 画像幅に対する比率で、中身の中心を画像の中心へ寄せる量
    const dx = (0.5 - (x0 + x1) / 2 / cv.width) * 100;
    if (Math.abs(dx) >= 0.5) out[n] = Math.round(dx * 10) / 10;
  }
  return out;
}, numbers);

await browser.close();

const body = Object.entries(offsets)
  .map(([n, dx]) => `  ${JSON.stringify(n)}: ${dx},`)
  .join("\n");
await writeFile(
  OUT,
  `// 自動生成: tools/measure-tile-offsets.mjs\n` +
    `// 背番号タイル画像の中身が中央からずれている量（画像幅に対する%）。\n` +
    `// 円だけで見せるシンプルスタイルで、この分だけ画像を横へ動かして中央に揃える。\n` +
    `// 画像を差し替えたら再生成すること。\n` +
    `export const TILE_OFFSETS = {\n${body}\n};\n`
);
console.log(`${Object.keys(offsets).length}件の補正を書き出しました: ${OUT.pathname}`);
