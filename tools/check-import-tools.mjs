#!/usr/bin/env node

// 本番取り込みスクリプトの動作検証。
//
// FTPのカレントディレクトリは接続内で持ち越されるため、相対パスでCWDを重ねると
// 降りた先からの相対解決になり、別のディレクトリを見てしまう。この誤りは
// 読むだけでは見つけにくく、実サーバーでしか再現しない。そこで、CWDを
// 実サーバーと同じく「現在位置からの相対」で解決する検証用FTPサーバーを
// その場で立て、CLIを実際に動かして確認する。

import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const LOGIN_DIR = "/home/example";
const PUBLIC_DIR = `${LOGIN_DIR}/public_html`;

const remoteDirs = {
  [PUBLIC_DIR]: [
    "type=dir;size=0; assets",
    "type=dir;size=0; photos",
    "type=file;size=5;modify=20260101000000; index.html",
    "type=file;size=7;modify=20260101000000; gallery.html",
    "type=file;size=2;modify=20260101000000; .ftp-deploy-sync-state.json",
    "type=file;size=3;modify=20260101000000; legacy.php",
  ],
  [`${PUBLIC_DIR}/assets`]: [
    "type=dir;size=0; css",
    "type=file;size=4;modify=20260101000000; extra.css",
  ],
  [`${PUBLIC_DIR}/assets/css`]: ["type=file;size=6;modify=20260101000000; deep.css"],
  [`${PUBLIC_DIR}/photos`]: ["type=file;size=3;modify=20260101000000; a b.jpg"],
};

const remoteFiles = {
  [`${PUBLIC_DIR}/index.html`]: "AAAAA",
  [`${PUBLIC_DIR}/gallery.html`]: "BBBBBBB",
  [`${PUBLIC_DIR}/legacy.php`]: "PHP",
  [`${PUBLIC_DIR}/assets/extra.css`]: "CCCC",
  [`${PUBLIC_DIR}/assets/css/deep.css`]: "DDDDDD",
  [`${PUBLIC_DIR}/photos/a b.jpg`]: "EEE",
  [`${PUBLIC_DIR}/.ftp-deploy-sync-state.json`]: "{}",
};

// 実サーバーと同じ相対解決。ここを絶対解決にすると検証の意味がなくなる。
function resolveRemote(currentDir, argument) {
  const joined = argument.startsWith("/") ? argument : `${currentDir}/${argument}`;
  const parts = [];
  for (const part of joined.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return `/${parts.join("/")}`;
}

function startFakeServer() {
  const server = net.createServer((socket) => {
    let currentDir = LOGIN_DIR;
    let dataServer = null;
    let dataSocket = null;

    const openData = async () => {
      dataServer = net.createServer();
      await new Promise((resolve) => dataServer.listen(0, "127.0.0.1", resolve));
      const { port } = dataServer.address();
      dataSocket = new Promise((resolve) => dataServer.once("connection", resolve));
      socket.write(`227 Entering Passive Mode (127,0,0,1,${Math.floor(port / 256)},${port % 256})\r\n`);
    };

    const sendData = async (body) => {
      socket.write("150 opening data connection\r\n");
      const connection = await dataSocket;
      connection.end(body);
      dataServer.close();
      socket.write("226 transfer complete\r\n");
    };

    socket.write("220 fake ftp\r\n");
    socket.on("data", async (chunk) => {
      for (const line of chunk.toString("utf8").split("\r\n").filter(Boolean)) {
        const command = line.split(" ")[0];
        const argument = line.slice(command.length + 1);

        if (command === "USER" || command === "PASS") socket.write("230 logged in\r\n");
        else if (command === "TYPE") socket.write("200 ok\r\n");
        else if (command === "PWD") socket.write(`257 "${LOGIN_DIR}" is current directory\r\n`);
        else if (command === "CWD") {
          const target = resolveRemote(currentDir, argument);
          if (!remoteDirs[target]) socket.write(`550 ${target}: No such directory\r\n`);
          else {
            currentDir = target;
            socket.write("250 ok\r\n");
          }
        } else if (command === "PASV") await openData();
        else if (command === "MLSD") await sendData(`${(remoteDirs[currentDir] ?? []).join("\r\n")}\r\n`);
        else if (command === "RETR") {
          const target = resolveRemote(currentDir, argument);
          const body = remoteFiles[target];
          if (body === undefined) {
            socket.write(`550 ${target}: No such file\r\n`);
            (await dataSocket).destroy();
            dataServer.close();
          } else {
            await sendData(body);
          }
        } else if (command === "QUIT") {
          socket.write("221 bye\r\n");
          socket.end();
        } else socket.write("502 not implemented\r\n");
      }
    });
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

// 検証用サーバーは同じプロセスで動くため、子プロセスは非同期で起動する。
// spawnSyncで待つとイベントループが止まり、サーバーが応答できない。
async function runImport({ port, remoteDir, outDir, extraArgs = [], mode = "download" }) {
  const child = spawn(
    process.execPath,
    [path.join(rootDir, "tools", "fetch-production-files.mjs"), "--mode", mode, "--out", outDir, ...extraArgs],
    {
      cwd: rootDir,
      env: {
        ...process.env,
        STAR_SERVER_HOST: "127.0.0.1",
        STAR_SERVER_PORT: String(port),
        STAR_SERVER_USER: "example",
        STAR_SERVER_PASSWORD: "example",
        STAR_SERVER_PROTOCOL: "ftp",
        STAR_SERVER_REMOTE_DIR: remoteDir,
      },
    },
  );

  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });

  const status = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });

  assert.equal(status, 0, `取り込みが失敗しました (${remoteDir}):\n${output}`);
  return JSON.parse(fs.readFileSync(path.join(outDir, "inventory.json"), "utf8"));
}

async function checkRemoteDir({ port, remoteDir, outRoot, label }) {
  const outDir = path.join(outRoot, label);
  const inventory = await runImport({ port, remoteDir, outDir });

  const importable = inventory.importable.map((entry) => entry.path).sort();
  assert.deepEqual(
    importable,
    ["assets/css/deep.css", "assets/extra.css", "gallery.html", "photos/a b.jpg"],
    `取り込み候補が想定と違います (${remoteDir}): ${importable.join(", ")}`,
  );

  // public/index.html が既にあるため、同名は取り込まない。
  assert.deepEqual(inventory.managed.map((entry) => entry.path), ["index.html"]);
  // サーバー設定・動的スクリプトは既定で自動配置しない。
  assert.deepEqual(inventory.review.map((entry) => entry.path), ["legacy.php"]);
  // 同期状態ファイルは取り込まない。
  assert.deepEqual(inventory.excluded.map((entry) => entry.path), [".ftp-deploy-sync-state.json"]);

  const expectedContents = {
    "gallery.html": "BBBBBBB",
    "assets/extra.css": "CCCC",
    "assets/css/deep.css": "DDDDDD",
    "photos/a b.jpg": "EEE",
  };

  for (const [relativePath, expected] of Object.entries(expectedContents)) {
    const actual = fs.readFileSync(path.join(outDir, "files", relativePath), "utf8");
    assert.equal(actual, expected, `取得内容が違います (${remoteDir}) ${relativePath}`);
  }

  console.log(`取り込みOK STAR_SERVER_REMOTE_DIR=${remoteDir}: 候補${importable.length}件`);
}

const { server, port } = await startFakeServer();
const outRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sanga-import-check-"));

try {
  // 相対指定と絶対指定の両方を確認する。相対指定はCWDの持ち越しで壊れやすい。
  await checkRemoteDir({ port, remoteDir: "public_html/", outRoot, label: "relative" });
  await checkRemoteDir({ port, remoteDir: `${PUBLIC_DIR}/`, outRoot, label: "absolute" });

  const withReview = await runImport({
    port,
    remoteDir: "public_html/",
    outDir: path.join(outRoot, "review"),
    extraArgs: ["--include-review"],
  });
  assert.equal(withReview.review.length, 1);
  assert.ok(fs.existsSync(path.join(outRoot, "review", "files", "legacy.php")));
  console.log("取り込みOK --include-review: 要判断1件を取得");

  // バックアップは分類も除外もせず、サーバー上のすべてを取得する。
  // ここが漏れると、本番デプロイ前の退避が「戻せないバックアップ」になる。
  const backupDir = path.join(outRoot, "backup");
  await runImport({ port, remoteDir: "public_html/", outDir: backupDir, mode: "backup" });

  const backedUp = [];
  (function collect(dir, prefix) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const next = path.join(dir, entry.name);
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      entry.isDirectory() ? collect(next, rel) : backedUp.push(rel);
    }
  })(path.join(backupDir, "files"), "");

  assert.deepEqual(
    backedUp.sort(),
    [
      ".ftp-deploy-sync-state.json",
      "assets/css/deep.css",
      "assets/extra.css",
      "gallery.html",
      "index.html",
      "legacy.php",
      "photos/a b.jpg",
    ],
    `バックアップの取得漏れがあります: ${backedUp.join(", ")}`,
  );

  // public/ を書き換えないことも確認する。バックアップは取得だけが仕事。
  assert.equal(fs.readFileSync(path.join(rootDir, "public", "index.html"), "utf8").includes("AAAAA"), false);
  console.log(`バックアップOK: ${backedUp.length}件をすべて取得し、public/ は変更なし`);
} finally {
  server.close();
  fs.rmSync(outRoot, { recursive: true, force: true });
}

console.log("取り込みスクリプトの検証に合格しました。");
