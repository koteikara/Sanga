#!/usr/bin/env node

// 本番サーバー（スターレンタルサーバー）にあってリポジトリに無いファイルを洗い出し、
// GitHubで管理できる形に取り込む。
//
// 背景:
//   本番へは .github/workflows/deploy-production.yml が public/ をFTP同期します。
//   FTP-Deploy-Actionは同期状態ファイルを基準に差分を反映するため、リポジトリ外で
//   サーバーへ直接置いたファイルは、いつ消えても不思議ではない状態にあります。
//   このスクリプトは逆向き（本番 -> リポジトリ）の一度きりの取り込みを自動化します。
//
// 使い方:
//   node tools/fetch-production-files.mjs                        一覧だけ作る
//   node tools/fetch-production-files.mjs --mode download         取り込み候補を取得する
//   node tools/fetch-production-files.mjs --mode download --apply 取得後に public/ へ配置する
//
// 認証情報は環境変数からのみ読み、リポジトリには保存しません。
//   STAR_SERVER_HOST / STAR_SERVER_USER / STAR_SERVER_PASSWORD / STAR_SERVER_REMOTE_DIR
//   STAR_SERVER_PORT（既定 21）/ STAR_SERVER_PROTOCOL（既定 ftp）

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { FtpClient } from "./ftp-client.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// 取り込み対象にしないもの。
// .ftp-deploy-sync-state.json はデプロイ側が管理する状態ファイルで、
// リポジトリへ持ち込むと同期判定が壊れる。
const EXCLUDED_NAMES = new Set([".ftp-deploy-sync-state.json", ".DS_Store", "Thumbs.db"]);
const EXCLUDED_DIRS = new Set([".git", ".well-known"]);

// 自動配置せず人の判断に回すもの。サーバー設定や動的スクリプトは、
// public/ に置くと本番の挙動そのものを変えてしまうため。
const REVIEW_EXTENSIONS = new Set([".htaccess", ".php", ".cgi", ".pl", ".py", ".sh", ".conf", ".ini"]);

const DEFAULT_MAX_BYTES = 20 * 1024 * 1024;

function parseArgs(argv) {
  const options = {
    mode: "inventory",
    outDir: path.join(rootDir, "tmp", "production-import"),
    apply: false,
    includeReview: false,
    maxBytes: DEFAULT_MAX_BYTES,
    verbose: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--mode") options.mode = argv[++index];
    else if (arg === "--out") options.outDir = path.resolve(rootDir, argv[++index]);
    else if (arg === "--apply") options.apply = true;
    else if (arg === "--include-review") options.includeReview = true;
    else if (arg === "--max-bytes") options.maxBytes = Number(argv[++index]);
    else if (arg === "--verbose") options.verbose = true;
    else throw new Error(`不明な引数です: ${arg}`);
  }

  if (!["inventory", "download"].includes(options.mode)) {
    throw new Error(`--mode は inventory か download です: ${options.mode}`);
  }
  if (options.apply && options.mode !== "download") {
    throw new Error("--apply は --mode download と一緒に指定します。");
  }
  if (!Number.isFinite(options.maxBytes) || options.maxBytes <= 0) {
    throw new Error("--max-bytes には正の数値を指定します。");
  }

  return options;
}

function readCredentials() {
  const host = process.env.STAR_SERVER_HOST;
  const user = process.env.STAR_SERVER_USER;
  const password = process.env.STAR_SERVER_PASSWORD;
  const remoteDir = process.env.STAR_SERVER_REMOTE_DIR;

  const missing = [
    ["STAR_SERVER_HOST", host],
    ["STAR_SERVER_USER", user],
    ["STAR_SERVER_PASSWORD", password],
    ["STAR_SERVER_REMOTE_DIR", remoteDir],
  ].filter(([, value]) => !value).map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(`環境変数が設定されていません: ${missing.join(", ")}`);
  }

  const protocol = (process.env.STAR_SERVER_PROTOCOL || "ftp").toLowerCase();
  const secure = protocol === "ftps" ? "explicit" : protocol === "ftps-legacy" ? "implicit" : "none";
  if (!["ftp", "ftps", "ftps-legacy"].includes(protocol)) {
    throw new Error(`STAR_SERVER_PROTOCOL は ftp / ftps / ftps-legacy のいずれかです: ${protocol}`);
  }

  return {
    host,
    user,
    password,
    remoteDir: remoteDir.endsWith("/") ? remoteDir : `${remoteDir}/`,
    port: Number(process.env.STAR_SERVER_PORT || (secure === "implicit" ? 990 : 21)),
    secure,
  };
}

function classify(relativePath) {
  const name = path.posix.basename(relativePath);
  const extension = name.startsWith(".") && !name.slice(1).includes(".") ? name : path.posix.extname(name);

  if (fs.existsSync(path.join(rootDir, "public", relativePath))) return "managed";
  if (REVIEW_EXTENSIONS.has(extension.toLowerCase())) return "review";
  return "importable";
}

async function walk(client, remoteRoot, relativeDir, collected, options) {
  const remoteDir = path.posix.join(remoteRoot, relativeDir);
  const entries = await client.list(remoteDir);

  for (const entry of entries) {
    const relativePath = relativeDir ? path.posix.join(relativeDir, entry.name) : entry.name;

    if (entry.type === "dir") {
      if (EXCLUDED_DIRS.has(entry.name)) {
        collected.excluded.push({ path: `${relativePath}/`, reason: "除外ディレクトリ" });
        continue;
      }
      await walk(client, remoteRoot, relativePath, collected, options);
      continue;
    }

    if (EXCLUDED_NAMES.has(entry.name)) {
      collected.excluded.push({ path: relativePath, reason: "除外ファイル" });
      continue;
    }

    const category = classify(relativePath);
    const record = { path: relativePath, size: entry.size, modifiedAt: entry.modifiedAt };

    if (category === "managed") collected.managed.push(record);
    else if (category === "review") collected.review.push(record);
    else if (entry.size > options.maxBytes) {
      collected.oversized.push({ ...record, limit: options.maxBytes });
    } else {
      collected.importable.push(record);
    }
  }
}

function renderReport(collected, credentials) {
  const lines = [];
  const total = collected.managed.length + collected.importable.length + collected.review.length;

  lines.push("# 本番サーバー取り込み一覧");
  lines.push("");
  lines.push(`- 取得日時: ${new Date().toISOString()}`);
  lines.push(`- 走査対象: FTPログイン後の \`${credentials.remoteDir}\` 配下`);
  lines.push(`- 走査ファイル数: ${total}件`);
  lines.push("");
  lines.push("認証情報とホスト名はこの一覧に記録しません。");
  lines.push("");

  const sections = [
    ["リポジトリ管理済み（public/ に同名あり）", collected.managed, "これらは取り込み不要です。内容差分は別途確認してください。"],
    ["取り込み候補（public/ に無い公開物）", collected.importable, "`--mode download` で取得し、`--apply` で `public/` へ配置します。"],
    ["要判断（サーバー設定・動的スクリプト）", collected.review, "`public/` へ置くと本番の挙動が変わるため、自動配置しません。人が判断します。"],
    ["サイズ超過", collected.oversized, "`--max-bytes` を超えたため取得していません。必要なら上限を上げます。"],
    ["除外", collected.excluded, "同期状態ファイルなど、取り込み対象にしないものです。"],
  ];

  for (const [title, items, note] of sections) {
    lines.push(`## ${title}（${items.length}件）`);
    lines.push("");
    lines.push(note);
    lines.push("");
    if (items.length === 0) {
      lines.push("該当なし。");
    } else {
      for (const item of items) {
        const size = item.size === undefined ? "" : ` — ${item.size} bytes`;
        lines.push(`- \`${item.path}\`${size}${item.reason ? ` — ${item.reason}` : ""}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

function writeFileEnsured(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, data);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const credentials = readCredentials();

  const client = new FtpClient({
    host: credentials.host,
    port: credentials.port,
    user: credentials.user,
    password: credentials.password,
    secure: credentials.secure,
    log: options.verbose ? (message) => console.log(message) : () => {},
  });

  const collected = { managed: [], importable: [], review: [], oversized: [], excluded: [] };

  await client.connect();
  try {
    await walk(client, credentials.remoteDir, "", collected, options);

    if (options.mode === "download") {
      const targets = options.includeReview
        ? [...collected.importable, ...collected.review]
        : collected.importable;

      for (const target of targets) {
        const buffer = await client.download(path.posix.join(credentials.remoteDir, target.path));
        writeFileEnsured(path.join(options.outDir, "files", target.path), buffer);
        console.log(`取得: ${target.path}（${buffer.length} bytes）`);
      }

      if (options.apply) {
        for (const target of targets) {
          const from = path.join(options.outDir, "files", target.path);
          const to = path.join(rootDir, "public", target.path);
          fs.mkdirSync(path.dirname(to), { recursive: true });
          fs.copyFileSync(from, to);
          console.log(`配置: public/${target.path}`);
        }
      }
    }
  } finally {
    await client.close();
  }

  writeFileEnsured(path.join(options.outDir, "inventory.json"), `${JSON.stringify(collected, null, 2)}\n`);
  writeFileEnsured(path.join(options.outDir, "inventory.md"), renderReport(collected, credentials));

  console.log("");
  console.log(`管理済み: ${collected.managed.length}件`);
  console.log(`取り込み候補: ${collected.importable.length}件`);
  console.log(`要判断: ${collected.review.length}件`);
  console.log(`サイズ超過: ${collected.oversized.length}件`);
  console.log(`除外: ${collected.excluded.length}件`);
  console.log(`一覧: ${path.relative(rootDir, path.join(options.outDir, "inventory.md"))}`);
}

main().catch((error) => {
  console.error(`エラー: ${error.message}`);
  process.exit(1);
});
