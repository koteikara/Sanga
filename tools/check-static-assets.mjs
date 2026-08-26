#!/usr/bin/env node

// 公開アセットの静的な整合を検証する。
// これまでGitHub Actionsのステップ内にPythonで直書きしていた検証を、
// 手元でも同じコマンドで実行できるようにNodeへ移した。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const errors = [];

function readPublicFile(relativePath) {
  const filePath = path.join(rootDir, "public", relativePath);
  if (!fs.existsSync(filePath)) {
    errors.push(`ファイルが見つかりません: public/${relativePath}`);
    return null;
  }
  return fs.readFileSync(filePath, "utf8");
}

function checkCssBraces(relativePath) {
  const css = readPublicFile(relativePath);
  if (css === null) return;

  const openCount = (css.match(/\{/g) || []).length;
  const closeCount = (css.match(/\}/g) || []).length;

  if (openCount !== closeCount) {
    errors.push(`波括弧の数が一致しません public/${relativePath}: {=${openCount}, }=${closeCount}`);
    return;
  }

  console.log(`波括弧OK public/${relativePath}: {=${openCount}, }=${closeCount}`);
}

function checkHtmlReferences(relativePath, requiredRefs) {
  const html = readPublicFile(relativePath);
  if (html === null) return;

  const missing = requiredRefs.filter((ref) => !html.includes(ref));

  if (missing.length > 0) {
    errors.push(`参照が見つかりません public/${relativePath}: ${missing.join(", ")}`);
    return;
  }

  console.log(`参照OK public/${relativePath}: ${requiredRefs.join(", ")}`);
}

// 入口ページの noscript は tools.json と二重管理になる。ずれると
// JavaScriptが動かない環境だけ導線が古いまま残るため、突き合わせる。
function checkIndexNoscriptLinks() {
  const html = readPublicFile("index.html");
  if (html === null) return;

  const toolsPath = path.join(rootDir, "public", "data", "tools.json");
  if (!fs.existsSync(toolsPath)) {
    errors.push("ファイルが見つかりません: public/data/tools.json");
    return;
  }

  let tools;
  try {
    tools = JSON.parse(fs.readFileSync(toolsPath, "utf8")).tools;
  } catch (error) {
    errors.push(`public/data/tools.json を解釈できません: ${error.message}`);
    return;
  }

  const noscript = /<noscript>([\s\S]*?)<\/noscript>/.exec(html);
  if (!noscript) {
    errors.push("public/index.html に noscript がありません");
    return;
  }

  const inNoscript = [...noscript[1].matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  const expected = tools.filter((tool) => tool.section === "live").map((tool) => tool.href);

  const missing = expected.filter((href) => !inNoscript.includes(href));
  const extra = inNoscript.filter((href) => !expected.includes(href));

  if (missing.length > 0 || extra.length > 0) {
    errors.push(
      `public/index.html の noscript が tools.json の live と一致しません` +
        (missing.length ? ` / 足りない: ${missing.join(", ")}` : "") +
        (extra.length ? ` / 余分: ${extra.join(", ")}` : "")
    );
    return;
  }

  console.log(`noscriptOK public/index.html: tools.json の live ${expected.length}件と一致`);
}

// CSSとJavaScriptの参照にはバージョンクエリを必ず付ける。
// 付け忘れると、中身を直しても再訪した人には古いファイルが使われ続ける。
// 実際に app.js からCDN依存を外したとき、参照側を上げ忘れていた。
function checkAssetVersionQuery(relativePath) {
  const html = readPublicFile(relativePath);
  if (html === null) return;

  const refs = [...html.matchAll(/(?:href|src)="([^"]+\.(?:css|js|mjs)(?:\?[^"]*)?)"/g)]
    .map((m) => m[1])
    // 外部URLは対象外。こちらでキャッシュを制御できない
    .filter((ref) => !/^[a-z][a-z0-9+.-]*:/i.test(ref) && !ref.startsWith("//"));

  const missing = refs.filter((ref) => !/\?v=/.test(ref));

  if (missing.length > 0) {
    errors.push(`バージョンクエリがありません public/${relativePath}: ${missing.join(", ")}`);
    return;
  }

  console.log(`版数OK public/${relativePath}: ${refs.length}件すべてに ?v= が付いています`);
}

checkCssBraces("assets/style.css");
checkCssBraces("assets/squad.css");
checkCssBraces("assets/index.css");
checkHtmlReferences("sanga202627season.html", ["assets/style.css", "assets/app.js"]);
checkHtmlReferences("squad.html", ["assets/squad.css", "assets/squad-builder.js"]);
checkHtmlReferences("index.html", [
  "assets/index.css",
  "assets/index-page.js",
  "assets/index-nebula.js",
  "assets/index-motion.js",
]);
checkIndexNoscriptLinks();

for (const page of [
  "index.html",
  "sanga202627season.html",
  "squad.html",
  "sanga2025season.html",
  "sanga_slides.html",
  "TradePost/index-v1.html",
]) {
  checkAssetVersionQuery(page);
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`エラー: ${error}`);
  }
  process.exit(1);
}

console.log("公開アセットの静的検証に合格しました。");
