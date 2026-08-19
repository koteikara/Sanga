#!/usr/bin/env node
/**
 * 背番号一覧画像に載っていない選手のタイルを、既存タイルの数字を組み合わせて作る。
 *
 *   NODE_PATH=$(npm root -g) node tools/compose-player-number.js --number 90 --label HAUS
 *
 * 既存タイル（public/assets/players/*.webp）から数字と名前の字形を切り出して
 * 並べ、1枚のタイルにする。字形は元画像のものをそのまま使うため、見た目が
 * 他のタイルと揃う。
 *
 * 数字はタイル上部、名前はタイル下部から、明るい画素のかたまりを1文字ずつ
 * 切り出して集める。例えばタイル「10 SHIMPEI」からは数字の「1」「0」と、
 * 文字の「S」「H」「I」「M」「P」「E」「I」が得られる。
 * 名前の字形が揃わない場合に限り、その文字だけサンセリフで描く。
 */

const fs = require("fs");
const path = require("path");
const http = require("http");

const DEFAULT_DIR = "public/assets/players";

/** 数字の字形を取り出す元にするタイル。1桁ずつ確実に取れるものを選ぶ */
const DIGIT_SOURCES = ["1", "2", "5", "6", "7", "8", "9", "10", "40"];

/** 名前の字形の取得元。players.json の nameEn とタイルの表記が一致する前提で読む */
const PLAYERS_JSON = "public/data/players.json";

/** 名前の字形を集めるとき、記号や合成文字を含むものは扱いにくいので除く */
function isPlainLabel(text) {
  return /^[A-Z ]+$/.test(text);
}

/** players.json から「背番号 → 名前」を読む。無い場合は名前の切り貼りをあきらめる */
function readLabelSources(dir) {
  if (!fs.existsSync(PLAYERS_JSON)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(PLAYERS_JSON, "utf8"));
    return (data.players || [])
      .filter((p) => isPlainLabel(p.nameEn || ""))
      .filter((p) => fs.existsSync(path.join(dir, `${p.number}.webp`)))
      .map((p) => ({ number: p.number, label: p.nameEn }));
  } catch (err) {
    return [];
  }
}

function parseArgs(argv) {
  const opts = { number: null, label: "", dir: DEFAULT_DIR };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--number") opts.number = argv[++i];
    else if (a === "--label") opts.label = argv[++i];
    else if (a === "--dir") opts.dir = argv[++i];
    else {
      console.error(`不明な引数です: ${a}`);
      process.exit(1);
    }
  }
  if (!opts.number) {
    console.error("--number を指定してください（例: --number 90 --label HAUS）");
    process.exit(1);
  }
  return opts;
}

/** タイル画像とページを同じ場所から配る一時サーバー */
function serveDir(dir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const name = decodeURIComponent(req.url.replace(/^\//, ""));
      if (name && name !== "index.html") {
        const file = path.join(dir, name);
        if (fs.existsSync(file)) {
          res.writeHead(200, { "Content-Type": "image/webp" });
          res.end(fs.readFileSync(file));
          return;
        }
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end('<!DOCTYPE html><meta charset="utf-8"><title>compose</title>');
    });
    server.listen(0, "127.0.0.1", () => {
      const base = `http://127.0.0.1:${server.address().port}`;
      resolve({ base, server });
    });
  });
}

async function main() {
  const opts = parseArgs(process.argv);

  let chromium;
  try {
    ({ chromium } = require("playwright"));
  } catch (err) {
    console.error("Playwrightを読み込めませんでした。");
    console.error("  NODE_PATH=$(npm root -g) node tools/compose-player-number.js --number 90 --label HAUS");
    process.exit(1);
  }

  const missing = DIGIT_SOURCES.filter((n) => !fs.existsSync(path.join(opts.dir, `${n}.webp`)));
  if (missing.length) {
    console.error(`字形の元にするタイルが足りません: ${missing.join(", ")}`);
    console.error("先に node tools/crop-player-numbers.js を実行してください。");
    process.exit(1);
  }

  const { base, server } = await serveDir(opts.dir);
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();
    await page.goto(`${base}/`);

    const dataUrl = await page.evaluate(
      async ({ base, sources, labelSources, number, label }) => {
        const load = async (name) => {
          const img = new Image();
          img.src = `${base}/${name}.webp`;
          await img.decode();
          return img;
        };

        /**
         * 画像を読み、指定した帯から1文字ずつ字形を切り出す。
         * bandTop / bandBottom は画像の高さに対する割合で与える。
         */
        const readGlyphs = async (name, bandTopRatio, bandBottomRatio, minWidth) => {
          const img = await load(name);
          const c = document.createElement("canvas");
          c.width = img.width;
          c.height = img.height;
          const ctx = c.getContext("2d");
          ctx.drawImage(img, 0, 0);
          const bandTop = Math.round(img.height * bandTopRatio);
          const bandBottom = Math.round(img.height * bandBottomRatio);
          const bandHeight = bandBottom - bandTop;
          const data = ctx.getImageData(0, bandTop, img.width, bandHeight).data;
          const bright = (x, y) => {
            const i = (y * img.width + x) * 4;
            return data[i] > 170 && data[i + 1] > 170 && data[i + 2] > 170;
          };
          // 明るい画素を含む列を拾い、隙間で桁に分ける
          const cols = [];
          for (let x = 0; x < img.width; x += 1) {
            let hit = false;
            for (let y = 0; y < bandHeight; y += 1) {
              if (bright(x, y)) { hit = true; break; }
            }
            cols.push(hit);
          }
          const groups = [];
          let start = -1;
          for (let x = 0; x <= img.width; x += 1) {
            if (x < img.width && cols[x]) {
              if (start < 0) start = x;
            } else if (start >= 0) {
              if (x - start >= minWidth) groups.push([start, x]);
              start = -1;
            }
          }
          // 各文字の上下も詰める
          return groups.map(([x0, x1]) => {
            let y0 = bandHeight;
            let y1 = 0;
            for (let x = x0; x < x1; x += 1) {
              for (let y = 0; y < bandHeight; y += 1) {
                if (bright(x, y)) {
                  if (y < y0) y0 = y;
                  if (y > y1) y1 = y;
                }
              }
            }
            return { img, x: x0, y: bandTop + y0, w: x1 - x0, h: y1 - y0 + 1 };
          });
        };

        // 数字の辞書（タイルの背番号の並びと、切り出した桁の並びを対応させる）
        const atlas = {};
        let sample = null;
        for (const name of sources) {
          const glyphs = await readGlyphs(name, 0, 0.72, 5);
          if (!sample) sample = await load(name);
          const digits = name.split("");
          if (glyphs.length !== digits.length) continue; // 桁数が合わないものは使わない
          digits.forEach((d, i) => {
            if (!atlas[d]) atlas[d] = glyphs[i];
          });
        }

        // 名前の辞書（タイル下部の名前の並びと、切り出した文字の並びを対応させる）
        const letterAtlas = {};
        for (const src of labelSources || []) {
          const letters = src.label.replace(/ /g, "").split("");
          const glyphs = await readGlyphs(src.number, 0.72, 1, 2);
          if (glyphs.length !== letters.length) continue; // 文字数が合わないものは使わない
          letters.forEach((ch, i) => {
            if (!letterAtlas[ch]) letterAtlas[ch] = glyphs[i];
          });
        }

        const want = number.split("");
        const lacking = want.filter((d) => !atlas[d]);
        if (lacking.length) {
          return { error: `字形が見つからない数字があります: ${lacking.join(", ")}` };
        }

        // 出力先。寸法は既存タイルに合わせる
        const W = sample.width;
        const H = sample.height;
        const out = document.createElement("canvas");
        out.width = W;
        out.height = H;
        const g = out.getContext("2d");

        // 背景色は既存タイルの角から採る
        const sc = document.createElement("canvas");
        sc.width = W;
        sc.height = H;
        const sctx = sc.getContext("2d");
        sctx.drawImage(sample, 0, 0);
        const px = sctx.getImageData(2, 2, 1, 1).data;
        g.fillStyle = `rgb(${px[0]},${px[1]},${px[2]})`;
        g.fillRect(0, 0, W, H);

        // 数字を並べる。高さを揃え、字間は字形の幅から決める
        const targetH = Math.round(H * 0.53);
        const parts = want.map((d) => {
          const gl = atlas[d];
          const scale = targetH / gl.h;
          return { gl, w: Math.round(gl.w * scale), h: targetH };
        });
        const gap = Math.round(W * 0.012);
        const totalW = parts.reduce((a, p) => a + p.w, 0) + gap * (parts.length - 1);
        let x = Math.round((W - totalW) / 2);
        const y = Math.round(H * 0.10);
        parts.forEach((p) => {
          g.drawImage(p.gl.img, p.gl.x, p.gl.y, p.gl.w, p.gl.h, x, y, p.w, p.h);
          x += p.w + gap;
        });

        // 名前。既存タイルから同じ文字を切り出して並べる
        const usedFallback = [];
        if (label) {
          const chars = label.split("");
          const haveAll = chars.every((ch) => ch === " " || letterAtlas[ch]);
          const labelBottom = Math.round(H * 0.90); // 字形が足りないときの描画位置

          if (haveAll) {
            // タイルの寸法はどれも同じなので、拡縮せず原寸のまま置く。
            // これで文字の大きさと太さが既存タイルと完全に一致する。
            const spacing = Math.round(W * 0.014);
            const spaceWidth = Math.round(W * 0.03);
            const items = chars.map((ch) => {
              if (ch === " ") return { space: true, w: spaceWidth };
              const gl = letterAtlas[ch];
              return { gl, w: gl.w, h: gl.h };
            });
            const totalW =
              items.reduce((a, it) => a + it.w, 0) + spacing * (items.length - 1);
            // 縦位置も元のタイルに合わせる（大文字の下端がそろう位置を使う）
            const bottoms = chars
              .filter((ch) => ch !== " ")
              .map((ch) => letterAtlas[ch].y + letterAtlas[ch].h)
              .sort((a, b) => a - b);
            const baseline = bottoms[Math.floor(bottoms.length / 2)];
            let lx = Math.round((W - totalW) / 2);
            items.forEach((it) => {
              if (!it.space) {
                g.drawImage(it.gl.img, it.gl.x, it.gl.y, it.gl.w, it.gl.h, lx, baseline - it.h, it.w, it.h);
              }
              lx += it.w + spacing;
            });
          } else {
            // 足りない文字がある場合だけ、サンセリフで描く
            usedFallback.push(...chars.filter((ch) => ch !== " " && !letterAtlas[ch]));
            g.fillStyle = "#ffffff";
            g.textAlign = "center";
            g.textBaseline = "alphabetic";
            const size = Math.round(H * 0.125);
            g.font = `bold ${size}px "DejaVu Sans", Arial, sans-serif`;
            if ("letterSpacing" in g) g.letterSpacing = `${Math.round(size * 0.06)}px`;
            g.fillText(label, W / 2, labelBottom);
          }
        }

        return { dataUrl: out.toDataURL("image/webp", 0.92), usedFallback };
      },
      {
        base,
        sources: DIGIT_SOURCES,
        labelSources: readLabelSources(opts.dir).filter((p) => p.number !== opts.number),
        number: opts.number,
        label: opts.label,
      }
    );

    if (dataUrl.error) {
      console.error(dataUrl.error);
      process.exit(1);
    }

    const outPath = path.join(opts.dir, `${opts.number}.webp`);
    fs.writeFileSync(outPath, Buffer.from(dataUrl.dataUrl.split(",")[1], "base64"));
    console.log(`背番号${opts.number}のタイルを作成しました: ${outPath}`);
    if (dataUrl.usedFallback && dataUrl.usedFallback.length) {
      console.log(`次の文字は既存タイルに無いため、サンセリフで描きました: ${dataUrl.usedFallback.join(", ")}`);
    } else {
      console.log("数字と名前のどちらも既存タイルの字形を使っています。");
    }
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error("合成に失敗しました。");
  console.error(err);
  process.exit(1);
});
