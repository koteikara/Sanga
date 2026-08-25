#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const EXPECTED_FORMATION_COUNT = 17;
const EXPECTED_PLAYER_COUNT = 39;
const EXPECTED_STYLES = ["modern", "victorian", "graffiti", "cyber", "vapor", "synth", "scrap", "simple"];
const ALLOWED_POSITIONS = new Set(["GK", "DF", "MF", "FW"]);

function addError(message) {
  errors.push(message);
}

function read(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    addError(`必要なファイルがありません: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function requireText(text, expected, label) {
  if (!text.includes(expected)) {
    addError(`${label} に必要な参照がありません: ${expected}`);
  }
}

const html = read("public/squad.html");
const css = read("public/assets/squad.css");
const builder = read("public/assets/squad-builder.js");
const playersText = read("public/data/players.json");
const formationsText = read("public/assets/squad-formations.js");

const formationsModule = await import(
  `data:text/javascript;base64,${Buffer.from(formationsText).toString("base64")}`
);
const FORMATIONS = formationsModule.FORMATIONS || {};

[
  "public/assets/squad-sample-players.js",
  "public/assets/squad-tile-offsets.js",
  "public/assets/vendor/modern-screenshot/modern-screenshot.mjs",
  "public/assets/vendor/modern-screenshot/LICENSE",
  "public/assets/vendor/modern-screenshot/VENDOR.md",
].forEach(read);

[
  "formation-grid",
  "field-style",
  "bench-editor",
  "bench",
  "pitch",
  "canvas",
  "picker-list",
  "field-bench-format",
  "field-bench-emphasis",
].forEach((id) => requireText(html, `id="${id}"`, "public/squad.html"));

[
  "assets/squad.css",
  "assets/squad-builder.js",
].forEach((asset) => requireText(html, asset, "public/squad.html"));

// キャッシュ用のバージョンクエリ。付け忘れると、更新しても古いCSS/JSが読まれる。
[
  ["assets/squad.css", /assets\/squad\.css\?v=[\w-]+/],
  ["assets/squad-builder.js", /assets\/squad-builder\.js\?v=[\w-]+/],
].forEach(([label, pattern]) => {
  if (!pattern.test(html)) {
    addError(`public/squad.html: ${label} にキャッシュ用のバージョンクエリ（?v=）がありません`);
  }
});

// 静的importにはHTML側のバージョンクエリが効かないため、import指定にも付ける
[
  ["./squad-formations.js", /\.\/squad-formations\.js\?v=[\w-]+/],
  ["./squad-tile-offsets.js", /\.\/squad-tile-offsets\.js\?v=[\w-]+/],
].forEach(([label, pattern]) => {
  if (!pattern.test(builder)) {
    addError(`public/assets/squad-builder.js: ${label} のimportにバージョンクエリ（?v=）がありません`);
  }
});

// 公開JSONの読み込みにもバージョンを付ける（データ更新が反映されなくなるため）
if (!/const DATA_VERSION = "[\w-]+";/.test(builder)) {
  addError("public/assets/squad-builder.js: DATA_VERSION の定義が見つかりません");
}

// ベンチの見せ方オプション。CSSとJSのどちらかだけ欠けると表示が壊れる
[
  ['[data-bench-format="tile"]', "タイル表示"],
  ['[data-bench-format="chip"]', "チップ表示"],
  ['[data-bench-emphasis="large"]', "大きめ"],
].forEach(([selector, label]) => {
  if (!css.includes(selector)) {
    addError(`public/assets/squad.css: ベンチの${label}（${selector}）の指定がありません`);
  }
});
["benchFormat", "benchEmphasis", "nameShort"].forEach((key) => {
  if (!builder.includes(key)) {
    addError(`public/assets/squad-builder.js: ベンチの見せ方に必要な ${key} を扱っていません`);
  }
});

[
  './squad-formations.js',
  './squad-sample-players.js',
  './squad-tile-offsets.js',
  './vendor/modern-screenshot/modern-screenshot.mjs',
].forEach((asset) => requireText(builder, asset, "public/assets/squad-builder.js"));

const styleSelect = html.match(/<select\s+id="field-style"[\s\S]*?<\/select>/);
if (!styleSelect) {
  addError("public/squad.html にスタイル選択肢がありません");
} else {
  const styles = [...styleSelect[0].matchAll(/<option\s+value="([^"]+)"/g)].map((match) => match[1]);
  if (JSON.stringify(styles) !== JSON.stringify(EXPECTED_STYLES)) {
    addError(`スタイルは ${EXPECTED_STYLES.join(", ")} の${EXPECTED_STYLES.length}件である必要があります: ${styles.join(", ")}`);
  }
}

const formationEntries = Object.entries(FORMATIONS);
if (formationEntries.length !== EXPECTED_FORMATION_COUNT) {
  addError(`フォーメーションは${EXPECTED_FORMATION_COUNT}件である必要があります: ${formationEntries.length}件`);
}

formationEntries.forEach(([key, formation]) => {
  if (!formation || !Array.isArray(formation.slots)) {
    addError(`${key}: slots が配列ではありません`);
    return;
  }
  if (formation.slots.length !== 11) {
    addError(`${key}: ピッチ上の枠は11件である必要があります: ${formation.slots.length}件`);
  }
  const ids = new Set();
  formation.slots.forEach((slot, index) => {
    if (!slot || typeof slot !== "object") {
      addError(`${key}[ ${index} ]: 枠がオブジェクトではありません`);
      return;
    }
    if (ids.has(slot.id)) addError(`${key}: 枠IDが重複しています: ${slot.id}`);
    ids.add(slot.id);
    if (!ALLOWED_POSITIONS.has(slot.posGroup) || !ALLOWED_POSITIONS.has(slot.posLabel)) {
      addError(`${key}/${slot.id}: ポジションはGK / DF / MF / FWのいずれかにしてください`);
    }
    if (![slot.x, slot.y].every((value) => Number.isFinite(value) && value >= 0 && value <= 100)) {
      addError(`${key}/${slot.id}: xとyは0〜100の数値にしてください`);
    }
  });
});

try {
  const players = JSON.parse(playersText).players;
  if (!Array.isArray(players) || players.length !== EXPECTED_PLAYER_COUNT) {
    addError(`players.json は${EXPECTED_PLAYER_COUNT}件である必要があります`);
  }
} catch (error) {
  addError(`players.json を解析できません: ${error.message}`);
}

EXPECTED_STYLES.filter((style) => style !== "simple").forEach((style) => {
  const headerPath = path.join(repoRoot, "public", "assets", "squad", `header-${style === "modern" ? "starting-xi" : style}.png`);
  if (!fs.existsSync(headerPath)) {
    addError(`スタイル用見出し画像がありません: ${path.relative(repoRoot, headerPath)}`);
  }
});

const openBraces = (css.match(/{/g) || []).length;
const closeBraces = (css.match(/}/g) || []).length;
if (openBraces !== closeBraces) {
  addError(`squad.css の波括弧数が一致しません: {=${openBraces}, }=${closeBraces}`);
}

if (errors.length > 0) {
  console.error("スカッド静的契約の検証に失敗しました。");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(
  `スカッド静的契約の検証に成功しました。選手${EXPECTED_PLAYER_COUNT}件、` +
    `フォーメーション${EXPECTED_FORMATION_COUNT}件、スタイル${EXPECTED_STYLES.length}件、` +
    `バージョンクエリとベンチ表示オプションを確認しました。`
);
