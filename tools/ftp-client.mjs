#!/usr/bin/env node

// 依存なしの最小FTP/FTPSクライアント。
//
// 本番はスターレンタルサーバーで、公開物の配布はFTPだけが経路です。
// リポジトリは「追加の依存はなく、Node.js 20があれば実行できる」方針のため、
// npmのFTPライブラリを足さず、必要な範囲だけを net / tls で実装しています。
//
// 実装しているのは取り込みに必要な操作だけです。
//   - ログイン（平文FTP / AUTH TLSによる明示FTPS / 990番の暗黙FTPS）
//   - PASVによるデータ接続
//   - MLSD、取得できない場合はUNIX形式LISTによる一覧
//   - RETRによるダウンロード
// アップロードは実装しません。本番への反映はFTP-Deploy-Actionの担当で、
// このクライアントは取り込み（読み取り）専用です。

import net from "node:net";
import tls from "node:tls";

const DEFAULT_TIMEOUT_MS = 30000;

class FtpError extends Error {}

// 制御チャネルの応答を組み立てる。
// 複数行応答は "250-" で始まり、同じコードの "250 " 行で終わる。
function createResponseReader() {
  let buffer = "";
  let multilineCode = null;

  return function push(chunk) {
    buffer += chunk;
    const completed = [];

    let index;
    while ((index = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, index).replace(/\r$/, "");
      buffer = buffer.slice(index + 1);

      const start = /^(\d{3})([ -])/.exec(line);

      if (multilineCode === null) {
        if (!start) continue;
        if (start[2] === "-") {
          multilineCode = start[1];
          completed.push({ partial: line });
          continue;
        }
        completed.push({ code: Number(start[1]), text: line });
        continue;
      }

      completed.push({ partial: line });
      if (start && start[1] === multilineCode && start[2] === " ") {
        multilineCode = null;
        completed[completed.length - 1] = { code: Number(start[1]), text: line };
      }
    }

    return completed;
  };
}

export class FtpClient {
  // secure: "none" | "explicit" | "implicit"
  constructor({ host, port, user, password, secure = "none", timeoutMs = DEFAULT_TIMEOUT_MS, log = () => {} }) {
    this.host = host;
    this.port = port;
    this.user = user;
    this.password = password;
    this.secure = secure;
    this.timeoutMs = timeoutMs;
    this.log = log;
    this.socket = null;
    this.pending = [];
    this.lines = [];
    this.readResponse = createResponseReader();
  }

  #attach(socket) {
    this.socket = socket;
    socket.setTimeout(this.timeoutMs);
    socket.on("data", (chunk) => this.#handleData(chunk.toString("utf8")));
    socket.on("timeout", () => this.#fail(new FtpError("制御接続がタイムアウトしました。")));
    socket.on("error", (error) => this.#fail(error));
  }

  #handleData(chunk) {
    for (const entry of this.readResponse(chunk)) {
      if (entry.partial !== undefined) {
        this.lines.push(entry.partial);
        continue;
      }
      this.lines.push(entry.text);
      const response = { code: entry.code, text: this.lines.join("\n") };
      this.lines = [];
      const waiter = this.pending.shift();
      if (waiter) waiter.resolve(response);
    }
  }

  #fail(error) {
    const waiters = this.pending.splice(0);
    for (const waiter of waiters) waiter.reject(error);
  }

  #await() {
    return new Promise((resolve, reject) => {
      this.pending.push({ resolve, reject });
    });
  }

  async send(command, { expect = [2, 3], mask = false } = {}) {
    this.log(`> ${mask ? command.split(" ")[0] + " ****" : command}`);
    const waiting = this.#await();
    this.socket.write(`${command}\r\n`);
    const response = await waiting;
    this.log(`< ${response.text}`);

    const group = Math.floor(response.code / 100);
    if (!expect.includes(group)) {
      throw new FtpError(`FTPコマンドが失敗しました: ${command.split(" ")[0]} -> ${response.text}`);
    }
    return response;
  }

  async connect() {
    const greeting = this.#await();

    if (this.secure === "implicit") {
      this.#attach(tls.connect({ host: this.host, port: this.port, servername: this.host }));
    } else {
      this.#attach(net.connect({ host: this.host, port: this.port }));
    }

    const hello = await greeting;
    this.log(`< ${hello.text}`);
    if (Math.floor(hello.code / 100) !== 2) {
      throw new FtpError(`FTPサーバーの応答が異常です: ${hello.text}`);
    }

    if (this.secure === "explicit") {
      await this.send("AUTH TLS");
      await this.#upgradeControl();
    }

    await this.send(`USER ${this.user}`);
    await this.send(`PASS ${this.password}`, { mask: true });

    if (this.secure !== "none") {
      // データチャネルも暗号化する。未対応サーバーはここで失敗させ、
      // 平文で本番の中身を流さない。
      await this.send("PBSZ 0");
      await this.send("PROT P");
    }

    await this.send("TYPE I");
  }

  #upgradeControl() {
    return new Promise((resolve, reject) => {
      const plain = this.socket;
      plain.removeAllListeners("data");
      plain.removeAllListeners("timeout");
      plain.removeAllListeners("error");

      const secured = tls.connect({ socket: plain, servername: this.host }, () => {
        this.#attach(secured);
        resolve();
      });
      secured.once("error", reject);
    });
  }

  async #openDataConnection() {
    const response = await this.send("PASV");
    const numbers = /(\d+),(\d+),(\d+),(\d+),(\d+),(\d+)/.exec(response.text);
    if (!numbers) {
      throw new FtpError(`PASV応答を解釈できません: ${response.text}`);
    }

    const port = Number(numbers[5]) * 256 + Number(numbers[6]);
    // 応答のIPではなく接続先ホストを使う。NAT配下のサーバーが
    // 到達できないプライベートIPを返すことがあるため。
    const options = { host: this.host, port };

    const socket = this.secure === "none"
      ? net.connect(options)
      : tls.connect({ ...options, servername: this.host, session: this.socket.getSession?.() });

    socket.setTimeout(this.timeoutMs);
    return socket;
  }

  async #receive(command) {
    const dataSocket = await this.#openDataConnection();
    const chunks = [];

    const finished = new Promise((resolve, reject) => {
      dataSocket.on("data", (chunk) => chunks.push(chunk));
      dataSocket.on("end", resolve);
      dataSocket.on("close", resolve);
      dataSocket.on("timeout", () => reject(new FtpError("データ接続がタイムアウトしました。")));
      dataSocket.on("error", reject);
    });

    await this.send(command, { expect: [1] });
    await finished;
    await this.#await().then((response) => this.log(`< ${response.text}`));

    return Buffer.concat(chunks);
  }

  async list(remoteDir) {
    await this.send(`CWD ${remoteDir}`);

    try {
      const machine = await this.#receive("MLSD");
      const entries = parseMlsd(machine.toString("utf8"));
      if (entries.length > 0) return entries;
    } catch {
      // MLSD非対応サーバーはLISTへ落とす。
    }

    const listing = await this.#receive("LIST -a");
    return parseUnixList(listing.toString("utf8"));
  }

  async download(remotePath) {
    return this.#receive(`RETR ${remotePath}`);
  }

  async close() {
    if (!this.socket) return;
    try {
      await this.send("QUIT", { expect: [2] });
    } catch {
      // 切断済みでも問題にしない。
    }
    this.socket.destroy();
    this.socket = null;
  }
}

// MLSD: "type=file;size=1234;modify=20260101000000; name"
export function parseMlsd(text) {
  const entries = [];

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;

    const separator = line.indexOf(" ");
    if (separator < 0) continue;

    const facts = {};
    for (const fact of line.slice(0, separator).split(";")) {
      const equals = fact.indexOf("=");
      if (equals < 0) continue;
      facts[fact.slice(0, equals).toLowerCase()] = fact.slice(equals + 1);
    }

    const name = line.slice(separator + 1);
    if (name === "." || name === "..") continue;

    const type = facts.type === "dir" ? "dir" : facts.type === "file" ? "file" : null;
    if (!type) continue;

    entries.push({ name, type, size: Number(facts.size ?? 0), modifiedAt: facts.modify ?? "" });
  }

  return entries;
}

// LIST: "-rw-r--r-- 1 user group 1234 Jan 1 00:00 name"
export function parseUnixList(text) {
  const entries = [];

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (/^total\s/i.test(line)) continue;

    const match = /^([-dl])\S*\s+\S+\s+\S+\s+\S+\s+(\d+)\s+(?:\S+\s+\S+\s+\S+)\s+(.+)$/.exec(line);
    if (!match) continue;

    let name = match[3];
    if (match[1] === "l") name = name.split(" -> ")[0];
    if (name === "." || name === "..") continue;
    // シンボリックリンクは実体の所在が判断できないため取り込み対象にしない。
    if (match[1] === "l") continue;

    entries.push({
      name,
      type: match[1] === "d" ? "dir" : "file",
      size: Number(match[2]),
      modifiedAt: "",
    });
  }

  return entries;
}

export { FtpError };
