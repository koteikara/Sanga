#!/usr/bin/env node

// public/assets/ のJavaScriptが参照するDOM識別子を抽出し、docs/dom-inventory.md を生成する。
//
// この一覧は手で書くと必ず実装からずれる。ずれた一覧は、読む側へ誤った前提を
// 与えるぶん、一覧が無い状態より害が大きい。そのため生成物として扱い、
// `--check` でCIが実装との差分を検出する。
//
//   node tools/generate-dom-inventory.mjs          生成・更新する
//   node tools/generate-dom-inventory.mjs --check  生成結果と現在の内容が一致するか確認する
//
// 抽出対象は、セレクタ、classList操作、className代入、属性操作、dataset参照、
// JavaScriptが組み立てるHTML文字列のclass属性、LocalStorageキーです。
// 抽出できるのは文字列リテラルとして書かれた識別子だけです。
// テンプレートリテラルで組み立てる `logo-${opponent_code}` のような動的クラス名は
// 対象外のため、必要なら各機能の仕様書側に記載します。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(rootDir, "docs", "dom-inventory.md");

const targets = [
  { label: "年間スケジュール", file: "public/assets/app.js" },
  { label: "予想スカッド", file: "public/assets/squad-builder.js" },
];

// セレクタ文字列を受け取る呼び出し。ここから #id / .class / [data-*] / [aria-*] を拾う。
const SELECTOR_CALL = /(?:querySelector|querySelectorAll|closest|matches)\(\s*(['"])((?:(?!\1).)*)\1/g;
const CLASS_LIST_CALL = /classList\.(?:add|remove|toggle|contains|replace)\(\s*([^)]*)\)/g;
const CLASS_NAME_ASSIGN = /\.className\s*=\s*(['"])((?:(?!\1).)*)\1/g;
const ATTRIBUTE_CALL = /(?:set|get|remove|has)Attribute\(\s*(['"])((?:(?!\1).)*)\1/g;
const DATASET_ACCESS = /\.dataset\.([A-Za-z0-9_$]+)/g;
// JavaScriptが組み立てるHTML文字列内のclass属性。CSS側の依存になるため拾う。
const MARKUP_CLASS = /class="([^"${]*)"/g;
const STORAGE_KEY = /(['"])(sanga-[a-z0-9-]+)\1/g;
const STRING_LITERAL = /(['"])((?:(?!\1).)*)\1/g;

function camelToDataAttribute(name) {
  return `data-${name.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
}

function collect(source) {
  const ids = new Set();
  const classes = new Set();
  const dataAttributes = new Set();
  const ariaAttributes = new Set();
  const storageKeys = new Set();

  function readSelector(selector) {
    for (const match of selector.matchAll(/#([A-Za-z][\w-]*)/g)) ids.add(`#${match[1]}`);
    for (const match of selector.matchAll(/\.([A-Za-z][\w-]*)/g)) classes.add(`.${match[1]}`);
    for (const match of selector.matchAll(/\[(data-[\w-]+)/g)) dataAttributes.add(match[1]);
    for (const match of selector.matchAll(/\[(aria-[\w-]+)/g)) ariaAttributes.add(match[1]);
  }

  for (const match of source.matchAll(SELECTOR_CALL)) readSelector(match[2]);

  for (const match of source.matchAll(CLASS_LIST_CALL)) {
    for (const literal of match[1].matchAll(STRING_LITERAL)) {
      for (const name of literal[2].split(/\s+/)) {
        if (/^[A-Za-z][\w-]*$/.test(name)) classes.add(`.${name}`);
      }
    }
  }

  for (const match of source.matchAll(CLASS_NAME_ASSIGN)) {
    for (const name of match[2].split(/\s+/)) {
      if (/^[A-Za-z][\w-]*$/.test(name)) classes.add(`.${name}`);
    }
  }

  for (const match of source.matchAll(ATTRIBUTE_CALL)) {
    const name = match[2];
    if (name.startsWith("data-")) dataAttributes.add(name);
    if (name.startsWith("aria-")) ariaAttributes.add(name);
  }

  for (const match of source.matchAll(MARKUP_CLASS)) {
    for (const name of match[1].split(/\s+/)) {
      if (/^[A-Za-z][\w-]*$/.test(name)) classes.add(`.${name}`);
    }
  }

  for (const match of source.matchAll(DATASET_ACCESS)) {
    dataAttributes.add(camelToDataAttribute(match[1]));
  }

  for (const match of source.matchAll(STORAGE_KEY)) storageKeys.add(match[2]);

  return { ids, classes, dataAttributes, ariaAttributes, storageKeys };
}

function renderList(title, values) {
  const sorted = [...values].sort((a, b) => a.localeCompare(b));
  if (sorted.length === 0) {
    return `#### ${title}\n\nなし\n`;
  }
  return `#### ${title}\n\n${sorted.map((value) => `- \`${value}\``).join("\n")}\n`;
}

function build() {
  const sections = targets.map(({ label, file }) => {
    const source = fs.readFileSync(path.join(rootDir, file), "utf8");
    const found = collect(source);
    return [
      `### ${label}: \`${file}\``,
      "",
      renderList("参照しているid", found.ids),
      renderList("参照しているclass", found.classes),
      renderList("操作しているdata属性", found.dataAttributes),
      renderList("操作しているaria属性", found.ariaAttributes),
      renderList("LocalStorageキー", found.storageKeys),
    ].join("\n");
  });

  return [
    "# DOM識別子インベントリ",
    "",
    "**この文書は `tools/generate-dom-inventory.mjs` が生成します。手で編集しないでください。**",
    "更新は `node tools/generate-dom-inventory.mjs` を実行し、生成結果をコミットします。",
    "`npm run check:static` が実装との差分を検出します。",
    "",
    "## 用途",
    "",
    "class名、id名、data属性を変更する前に、JavaScriptが参照しているかをここで確認します。",
    "参照がある場合は、CSSとHTMLの該当箇所もあわせて確認します。",
    "",
    "テンプレートリテラルで組み立てる動的なclass名（`logo-${opponent_code}` など）は抽出できません。",
    "各機能の仕様書を参照してください。",
    "",
    "LocalStorageの保存形式と既定値は `docs/personalization.md` を正本とします。",
    "ここに載るのはキー名だけです。",
    "",
    "## 一覧",
    "",
    ...sections,
  ].join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

const generated = build();
const isCheck = process.argv.includes("--check");

if (isCheck) {
  const current = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, "utf8") : "";
  if (current !== generated) {
    console.error("エラー: docs/dom-inventory.md が実装とずれています。");
    console.error("`node tools/generate-dom-inventory.mjs` を実行して生成結果をコミットしてください。");
    process.exit(1);
  }
  console.log("DOM識別子インベントリOK: docs/dom-inventory.md は実装と一致しています。");
} else {
  fs.writeFileSync(outputPath, generated, "utf8");
  console.log(`生成しました: docs/dom-inventory.md`);
}
