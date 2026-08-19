#!/usr/bin/env node
/**
 * 公式の背番号一覧画像から、背番号ごとのタイル画像を切り出す。
 *
 *   node tools/crop-player-numbers.js
 *   node tools/crop-player-numbers.js --input docs/sources/players-numbers.jpeg --outdir public/assets/players
 *
 * 元画像は6列で並んでおり、最終行だけ中央寄せで2件になっている。
 * その並びを下の GRID として持ち、各セルを切り出してWebPで保存する。
 *
 * このスクリプトは素材を一度作るための道具であり、CIでは実行しない。
 * 画像の切り出しにブラウザのCanvasを使うため、実行にはPlaywrightが必要になる。
 * 導入していない環境では次のように実行する。
 *
 *   NODE_PATH=$(npm root -g) node tools/crop-player-numbers.js
 *
 * 元画像を差し替えて並びが変わった場合は、GRID と LAYOUT を直す。
 * 切り出し位置は tools/crop-player-numbers.js --grid で確認できる。
 */

const fs = require("fs");
const path = require("path");
const http = require("http");

const DEFAULT_INPUT = "docs/sources/players-numbers.jpeg";
const DEFAULT_OUTDIR = "public/assets/players";

/** 元画像の寸法と、タイルの並び方 */
const LAYOUT = {
  imageWidth: 1057,
  columns: 6,
  originY: 16, // 1行目の上端
  rowHeight: 173.4, // 行の送り
};

/** 各行に並ぶ背番号。null は空きを表す */
const GRID = [
  ["1", "2", "5", "6", "7", "8"],
  ["9", "10", "11", "14", "15", "16"],
  ["17", "18", "19", "21", "23", "25"],
  ["26", "29", "31", "32", "34", "36"],
  ["38", "39", "40", "43", "44", "48"],
  ["50", "60", "77", "93", "94", "99"],
  [null, null, "83", "510", null, null],
];

function parseArgs(argv) {
  const opts = { input: DEFAULT_INPUT, outdir: DEFAULT_OUTDIR, grid: false };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--input") opts.input = argv[++i];
    else if (a === "--outdir") opts.outdir = argv[++i];
    else if (a === "--grid") opts.grid = true;
    else {
      console.error(`不明な引数です: ${a}`);
      process.exit(1);
    }
  }
  return opts;
}

/**
 * Canvasから画像を読むにはHTTP経由である必要があるため、
 * 元画像を配る一時的なサーバーを立てる。
 */
function serveFile(filePath) {
  const body = fs.readFileSync(filePath);
  const type = filePath.endsWith(".png") ? "image/png" : "image/jpeg";
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      // 画像とページを同じ場所から配ることで、Canvasの読み取り制限を避ける
      if (req.url === "/image") {
        res.writeHead(200, { "Content-Type": type, "Access-Control-Allow-Origin": "*" });
        res.end(body);
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end("<!DOCTYPE html><meta charset=\"utf-8\"><title>crop</title>");
    });
    server.listen(0, "127.0.0.1", () => {
      const base = `http://127.0.0.1:${server.address().port}`;
      resolve({ url: `${base}/image`, pageUrl: `${base}/`, server });
    });
  });
}

/** 切り出す矩形を組み立てる */
function buildCells() {
  const cellWidth = LAYOUT.imageWidth / LAYOUT.columns;
  const cells = [];
  GRID.forEach((row, rowIndex) => {
    row.forEach((number, colIndex) => {
      if (!number) return;
      cells.push({
        number,
        x: Math.round(colIndex * cellWidth),
        y: Math.round(LAYOUT.originY + rowIndex * LAYOUT.rowHeight),
        width: Math.round(cellWidth),
        height: Math.round(LAYOUT.rowHeight),
      });
    });
  });
  return cells;
}

async function main() {
  const opts = parseArgs(process.argv);

  if (!fs.existsSync(opts.input)) {
    console.error(`元画像が見つかりません: ${opts.input}`);
    console.error("docs/sources/README.md の説明に沿って元画像を置いてください。");
    process.exit(1);
  }

  let chromium;
  try {
    ({ chromium } = require("playwright"));
  } catch (err) {
    console.error("Playwrightを読み込めませんでした。");
    console.error("グローバル導入済みの場合は次のように実行してください。");
    console.error("  NODE_PATH=$(npm root -g) node tools/crop-player-numbers.js");
    process.exit(1);
  }

  const cells = buildCells();
  const { url, pageUrl, server } = await serveFile(opts.input);
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();
    await page.goto(pageUrl);

    if (opts.grid) {
      // 切り出し位置を目で確認するための重ね描き
      await page.setViewportSize({ width: LAYOUT.imageWidth + 40, height: 1400 });
      await page.setContent(
        `<style>body{margin:0;position:relative}img{display:block}
         .cell{position:absolute;border:2px solid #00ff88;box-sizing:border-box}</style>
         <img src="${url}">`
      );
      await page.waitForTimeout(500);
      await page.evaluate((list) => {
        list.forEach((c) => {
          const d = document.createElement("div");
          d.className = "cell";
          d.style.left = `${c.x}px`;
          d.style.top = `${c.y}px`;
          d.style.width = `${c.width}px`;
          d.style.height = `${c.height}px`;
          document.body.appendChild(d);
        });
      }, cells);
      const gridPath = "crop-grid.png";
      await page.screenshot({ path: gridPath, fullPage: true });
      console.log(`切り出し位置を ${gridPath} に出力しました。`);
      return;
    }

    fs.mkdirSync(opts.outdir, { recursive: true });

    const results = await page.evaluate(
      async ({ src, list }) => {
        const img = new Image();
        img.src = src;
        await img.decode();
        return list.map((c) => {
          const canvas = document.createElement("canvas");
          canvas.width = c.width;
          canvas.height = c.height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, c.x, c.y, c.width, c.height, 0, 0, c.width, c.height);
          return { number: c.number, dataUrl: canvas.toDataURL("image/webp", 0.92) };
        });
      },
      { src: url, list: cells }
    );

    results.forEach((r) => {
      const base64 = r.dataUrl.split(",")[1];
      const outPath = path.join(opts.outdir, `${r.number}.webp`);
      fs.writeFileSync(outPath, Buffer.from(base64, "base64"));
    });

    console.log(`背番号タイルを ${results.length} 件切り出しました: ${opts.outdir}`);
    console.log(`背番号: ${results.map((r) => r.number).join(", ")}`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error("切り出しに失敗しました。");
  console.error(err);
  process.exit(1);
});
