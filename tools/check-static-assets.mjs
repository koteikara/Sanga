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

checkCssBraces("assets/style.css");
checkCssBraces("assets/squad.css");
checkHtmlReferences("sanga202627season.html", ["assets/style.css", "assets/app.js"]);
checkHtmlReferences("squad.html", ["assets/squad.css", "assets/squad-builder.js"]);

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`エラー: ${error}`);
  }
  process.exit(1);
}

console.log("公開アセットの静的検証に合格しました。");
