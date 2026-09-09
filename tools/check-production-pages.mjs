#!/usr/bin/env node

/**
 * 本番へ反映したページを、JavaScriptを動かした状態で確かめる。
 *
 * **この作業環境のChromiumは、外部のHTTPSへ出られません。** curl も Node の fetch も
 * 通るのに、Chromiumだけが握手の途中で切られます（外向きプロキシへのトンネルが
 * 落ちる）。原因は基盤側にあり、こちらでは直せません。
 *
 * そこで、本番のファイルをそのまま手元に落とし、localhost で配ってブラウザに読ませます。
 * **本番と同じバイト列を、JavaScript込みで動かせます。** 読み込み失敗と実行時エラーを
 * 拾うのが目的で、見た目の確認ではありません。
 *
 * 見られないものもあります。本番サーバーが返すヘッダ（MIMEタイプ・リダイレクト・
 * キャッシュ）、HTTPSそのもの、実オリジンに依存する挙動。**同じファイル、違う置き場所**
 * なので、そこは別物です。実機での確認を置き換えるものではありません。
 *
 *   node tools/check-production-pages.mjs
 *   node tools/check-production-pages.mjs squad.html --base https://example.invalid
 *   node tools/check-production-pages.mjs --keep      （落としたファイルを残す）
 */

import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

const DEFAULT_BASE = "https://sangasanga.stars.ne.jp";
const DEFAULT_PAGES = ["timeline.html", "timeline-calendar.html"];

/** この作業環境のPlaywright。プロジェクトの依存ではないので、置き場所を直に指す。 */
const PLAYWRIGHT_PATHS = [
  process.env.PLAYWRIGHT_MODULE,
  "playwright",
  "/opt/node22/lib/node_modules/playwright/index.mjs",
].filter(Boolean);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ics": "text/calendar; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

function parseArgs(argv) {
  const options = { base: DEFAULT_BASE, keep: false, pages: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--base") options.base = argv[i += 1];
    else if (arg === "--keep") options.keep = true;
    else if (arg.startsWith("--")) throw new Error(`知らない指定です: ${arg}`);
    else options.pages.push(arg);
  }
  if (options.pages.length === 0) options.pages = DEFAULT_PAGES;
  if (!options.base) throw new Error("--base に取得元を指定してください");
  return options;
}

/**
 * 参照している相対パスを拾う。HTMLの href/src だけでは足りない。
 * CSSの `url()`（書体ファイル）と、JavaScriptの中に書かれた `data/*.json` も要る。
 * 版クエリ（`?v=`）は落とし、実ファイルの位置だけを返す。
 */
function collectRefs(text) {
  const found = new Set();
  const patterns = [
    /(?:href|src)="([^"?#]+)(?:\?[^"#]*)?(?:#[^"]*)?"/g,
    /url\(\s*"?([^")?#]+)(?:\?[^")#]*)?"?\s*\)/g,
    /["'`](\.?\/?(?:assets|data)\/[A-Za-z0-9._-]+)(?:\?[^"'`]*)?["'`]/g,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const ref = match[1].replace(/^\.?\//, "");
      // 外部URLとデータURIは持ってこない。手元に落とすのは同じサイトのものだけ。
      if (/^(?:[a-z]+:|\/\/)/i.test(match[1])) continue;
      // 組み立て途中の文字列（`${...}` や引用符混じり）を掴むことがある。実在しうる形だけ通す。
      if (!/^[A-Za-z0-9._/-]+$/.test(ref)) continue;
      found.add(ref);
    }
  }
  return [...found];
}

async function download(base, ref, dir, seen, problems) {
  if (seen.has(ref)) return;
  seen.add(ref);

  const response = await fetch(`${base}/${ref}`);
  if (!response.ok) {
    problems.push(`取得できません（HTTP ${response.status}）: ${ref}`);
    return;
  }
  const body = Buffer.from(await response.arrayBuffer());
  const file = path.join(dir, ref);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);

  // テキストのものは、その中の参照も追う。書体は CSS の中にしか出てこない。
  // **HTMLは追わない。** トップバーが入口ページを指しているので、追うとサイト全体を
  // 引きずってくる。確かめたいページは呼ぶ側が名前で指定する。
  if (/\.(?:html|css|js|mjs)$/.test(ref)) {
    for (const child of collectRefs(body.toString("utf8"))) {
      if (child.endsWith(".html")) continue;
      // CSSの url() だけはそのファイルからの相対。HTMLとJavaScriptの参照は、
      // 読み込むページ（サイトの根）からの相対で解決される。
      const resolved = ref.endsWith(".css")
        ? path.posix.normalize(path.posix.join(path.posix.dirname(ref), child))
        : child;
      // 相対の指定が上へ抜けたものは、サイトの外なので追わない。
      if (resolved.startsWith("..")) continue;
      await download(base, resolved, dir, seen, problems);
    }
  }
}

function serve(dir) {
  const server = http.createServer((request, response) => {
    const target = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const file = path.join(dir, target);
    // 落とした場所より外は出さない。
    if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      response.writeHead(404).end("not found");
      return;
    }
    response.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(response);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

async function loadPlaywright() {
  for (const candidate of PLAYWRIGHT_PATHS) {
    try {
      return await import(candidate);
    } catch (error) {
      // 次の置き場所を試す。全部だめなら呼ぶ側に知らせる。
    }
  }
  return null;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const base = options.base.replace(/\/+$/, "");

  const playwright = await loadPlaywright();
  if (!playwright) {
    console.error("Playwrightが見つかりません。ブラウザでの確認は行えません。");
    console.error(`  探した場所: ${PLAYWRIGHT_PATHS.join(", ")}`);
    console.error("  PLAYWRIGHT_MODULE に置き場所を指定できます。");
    return 1;
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sanga-prod-"));
  const problems = [];
  const seen = new Set();

  console.log(`取得元: ${base}`);
  for (const page of options.pages) {
    await download(base, page, dir, seen, problems);
  }
  console.log(`  ${seen.size}件を手元に落としました`);
  problems.forEach((problem) => console.error(`  ${problem}`));

  const { server, port } = await serve(dir);
  const browser = await playwright.chromium.launch();
  let failed = problems.length;

  for (const page of options.pages) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 900 },
      timezoneId: "Asia/Tokyo",
      locale: "ja-JP",
    });
    const tab = await context.newPage();
    const found = [];
    tab.on("pageerror", (error) => found.push(`JavaScriptエラー: ${String(error).split("\n")[0]}`));
    tab.on("requestfailed", (request) => found.push(`読み込み失敗: ${request.url()}`));
    tab.on("console", (message) => {
      if (message.type() === "error") found.push(`console.error: ${message.text().slice(0, 120)}`);
    });

    try {
      // 背景の演出は確認の対象ではないので切る。落ちても本題と関係が無い。
      await tab.goto(`http://127.0.0.1:${port}/${page}?nebula=off`, { waitUntil: "networkidle", timeout: 30000 });
      await tab.waitForTimeout(1200);
    } catch (error) {
      found.push(`開けません: ${error.message.split("\n")[0]}`);
    }

    if (found.length === 0) {
      console.log(`OK ${page}`);
    } else {
      console.error(`NG ${page}`);
      found.forEach((item) => console.error(`  ${item}`));
      failed += found.length;
    }
    await context.close();
  }

  await browser.close();
  server.close();

  if (options.keep) console.log(`落としたファイル: ${dir}`);
  else fs.rmSync(dir, { recursive: true, force: true });

  if (failed > 0) {
    console.error(`本番ページの確認に失敗しました（${failed}件）`);
    return 1;
  }
  console.log("本番ページの確認に合格しました。読み込み失敗も実行時エラーもありません。");
  console.log("  ヘッダ・HTTPS・実オリジンの挙動は見ていません。実機での確認は別に行ってください。");
  return 0;
}

main().then(
  (code) => { process.exitCode = code; },
  (error) => {
    console.error(`確認に失敗しました: ${error.message}`);
    process.exitCode = 1;
  },
);
