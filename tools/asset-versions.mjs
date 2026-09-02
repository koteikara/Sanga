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

// 画像も対象にする。中身を差し替えても名前が同じなら、再訪した人には
// 古い画像が使われ続ける（サムネイルの日付がずれたまま残った実例がある）。
// svgは favicon をデータURIで書いているため対象から外す。
// 公開JSONも対象にする。日程データを更新しても参照側の版数が同じままだと、
// 再訪した人には古い日程が使われ続ける（手書きの版数で実際に起きていた）。
const ASSET_REF = /(["'])((?:\.{0,2}\/)?[\w./-]+\.(?:css|js|mjs|json|webp|png|jpe?g))(\?[^"']*)?\1/g;

// 版数が無いと更新が届かないので、参照先が見つからなければ落とす拡張子。
const REQUIRED_REF = /\.(?:css|js|mjs|json)$/;

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
  // 入口ページのサムネイルは tools.json に書かれている。ここも参照側として扱う
  const toolsJson = path.join(publicDir, "data", "tools.json");
  const data = fs.existsSync(toolsJson) ? [toolsJson] : [];
  return [...html, ...scripts, ...data].sort();
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
  const sourceSet = new Set(sources);
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

        // tools.json のパスは JSON からではなく public/ からの相対で書かれている。
        // 入口ページ（public/index.html）が読む側だから。
        // 公開JSONの読み込みも同じで、fetch の相対パスはスクリプトではなく
        // 読み込んだページ（public/ 直下）を基準に解決される。
        const base = source === path.join(publicDir, "data", "tools.json") || ref.endsWith(".json")
          ? publicDir
          : path.dirname(source);
        const target = ref.startsWith("/")
          ? path.join(publicDir, ref.slice(1))
          : path.resolve(base, ref);

        if (!target.startsWith(publicDir + path.sep) || !fs.existsSync(target)) {
          // 画像は download 属性の保存ファイル名など、実ファイルでない文字列にも
          // 当たる。見つからなければ触らない。CSS・JavaScriptは従来どおり落とす。
          if (!REQUIRED_REF.test(ref)) return match;
          unresolved.push({ source, ref });
          return match;
        }

        // 参照先が参照側でもあるときは、書き換え途中の中身でハッシュを取る。
        // そうしないと連鎖した参照が収束しない。画像などはファイルの生バイトを読む。
        const body = sourceSet.has(target) ? readFile(target) : fs.readFileSync(target);
        return `${quote}${ref}${replaceVersionQuery(query, hashOf(body))}${quote}`;
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
