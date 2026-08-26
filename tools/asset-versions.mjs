#!/usr/bin/env node

// CSS・JavaScriptの参照に付けるバージョンクエリ（?v=）を、ファイルの内容ハッシュで管理する。
//
// 手で日付や連番を書いていたときは「付いているか」しか検証できず、中身を変えたのに
// 版数を上げ忘れる事故を止められなかった。版数を内容から決めれば、上げ忘れは
// 「参照側に書かれた値」と「実ファイルのハッシュ」の不一致として必ず検出できる。
//
//   node tools/asset-versions.mjs          参照側の ?v= を実際のハッシュへ書き換える
//   node tools/asset-versions.mjs --check   ずれていれば一覧を出して終了コード1
//
// JavaScriptの静的importにもHTMLと同じ理屈でクエリが要るため、HTMLだけでなく
// public/assets 配下のスクリプトも走査対象にする（vendor配下は第三者のコードなので
// 書き換えない。参照先としては扱う）。

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(rootDir, "public");

// 8桁でも公開アセットの規模では衝突しない。URLに載るので短さを優先する。
const HASH_LENGTH = 8;

const ASSET_REF = /(["'])((?:\.{0,2}\/)?[\w./-]+\.(?:css|js|mjs))(\?[^"']*)?\1/g;

function hashOf(content) {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, HASH_LENGTH);
}

function listFiles(dir, predicate) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...listFiles(full, predicate));
    } else if (predicate(full)) {
      found.push(full);
    }
  }
  return found;
}

// 参照側として走査するファイル。ここに書かれた ?v= を管理する。
function sourceFiles() {
  const html = listFiles(publicDir, (file) => file.endsWith(".html"));
  const scripts = listFiles(path.join(publicDir, "assets"), (file) => /\.(?:js|mjs)$/.test(file)).filter(
    (file) => !file.split(path.sep).includes("vendor")
  );
  return [...html, ...scripts].sort();
}

function replaceVersionQuery(query, version) {
  const params = new URLSearchParams(query ? query.slice(1) : "");
  params.set("v", version);
  return `?${params.toString()}`;
}

// 参照先の中身が変わると参照元の中身も変わるため（例: index-nebula.js が
// index-motion.js を参照する）、一度の書き換えでは落ち着かない。変化がなくなるまで繰り返す。
const MAX_PASSES = 10;

// 参照側の ?v= をすべて内容ハッシュに揃えた状態を、メモリ上で作る。
// 戻り値は「ファイルパス -> あるべき中身」。
export function resolveAssetVersions() {
  const sources = sourceFiles();
  const contents = new Map();
  const readFile = (file) => {
    if (!contents.has(file)) contents.set(file, fs.readFileSync(file, "utf8"));
    return contents.get(file);
  };
  const unresolved = [];

  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    let changed = false;
    unresolved.length = 0;

    for (const source of sources) {
      const before = readFile(source);
      const after = before.replace(ASSET_REF, (match, quote, ref, query) => {
        if (/^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith("//")) return match;

        const target = ref.startsWith("/")
          ? path.join(publicDir, ref.slice(1))
          : path.resolve(path.dirname(source), ref);

        if (!target.startsWith(publicDir + path.sep) || !fs.existsSync(target)) {
          unresolved.push({ source, ref });
          return match;
        }

        return `${quote}${ref}${replaceVersionQuery(query, hashOf(readFile(target)))}${quote}`;
      });

      if (after !== before) {
        contents.set(source, after);
        changed = true;
      }
    }

    if (!changed) return { contents, unresolved: [...unresolved] };
  }

  throw new Error(
    `バージョンクエリが${MAX_PASSES}回の走査で収束しませんでした。参照が循環していないか確認してください。`
  );
}

// 参照側の ?v= と実ファイルの内容ハッシュがずれている箇所を返す。
export function collectAssetVersionIssues() {
  const { contents, unresolved } = resolveAssetVersions();
  const issues = [];

  for (const [file, expected] of contents) {
    const actual = fs.readFileSync(file, "utf8");
    if (actual === expected) continue;

    const relative = path.relative(rootDir, file);
    const actualRefs = [...actual.matchAll(ASSET_REF)].map((m) => m[2] + (m[3] || ""));
    const expectedRefs = [...expected.matchAll(ASSET_REF)].map((m) => m[2] + (m[3] || ""));

    for (const [index, expectedRef] of expectedRefs.entries()) {
      if (actualRefs[index] !== expectedRef) {
        issues.push(`版数が内容と一致しません ${relative}: ${actualRefs[index]} -> ${expectedRef}`);
      }
    }
  }

  for (const { source, ref } of unresolved) {
    issues.push(`参照先のファイルがありません ${path.relative(rootDir, source)}: ${ref}`);
  }

  return issues;
}

export function writeAssetVersions() {
  const { contents } = resolveAssetVersions();
  const updated = [];

  for (const [file, expected] of contents) {
    if (fs.readFileSync(file, "utf8") === expected) continue;
    fs.writeFileSync(file, expected);
    updated.push(path.relative(rootDir, file));
  }

  return updated;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  if (process.argv.includes("--check")) {
    const issues = collectAssetVersionIssues();
    if (issues.length > 0) {
      for (const issue of issues) console.error(`エラー: ${issue}`);
      console.error("node tools/asset-versions.mjs を実行すると版数を揃えられます。");
      process.exit(1);
    }
    console.log("版数OK: すべての参照が内容ハッシュと一致しています。");
  } else {
    const updated = writeAssetVersions();
    if (updated.length === 0) {
      console.log("更新はありません。すべての参照が内容ハッシュと一致しています。");
    } else {
      for (const file of updated) console.log(`更新: ${file}`);
    }
  }
}
