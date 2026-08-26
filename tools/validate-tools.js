#!/usr/bin/env node

// 入口ページのツール一覧 public/data/tools.json の検証スクリプト。
// docs/site-index.md の「検証」で決めた内容を実装する。
//
// 主目的はリンク切れを落とすこと。ページを削除・改名したときに、
// 入口が壊れたまま気づかない事態を防ぐ。

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const publicDir = path.join(repoRoot, 'public');
const toolsPath = path.join(publicDir, 'data', 'tools.json');

const ALLOWED_SECTIONS = new Set(['live', 'archive']);
const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ACCENT_PATTERN = /^#[0-9a-f]{6}$/i;
const REQUIRED_TEXT_KEYS = ['name', 'description'];

const errors = [];

function fail(message) {
  errors.push(message);
}

function readTools() {
  if (!fs.existsSync(toolsPath)) {
    fail('public/data/tools.json が見つかりません');
    return null;
  }
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(toolsPath, 'utf8'));
  } catch (error) {
    fail(`public/data/tools.json を解釈できません: ${error.message}`);
    return null;
  }
  if (!Array.isArray(parsed.tools)) {
    fail('tools が配列ではありません');
    return null;
  }
  return parsed;
}

// public/ の外や外部サイトを指していないかを見る。
// 入口ページは同一サイト内の導線だけを扱う。
function resolveInsidePublic(relativePath, label) {
  // 参照にはキャッシュ対策のクエリが付く（tools/asset-versions.mjs が付ける）。
  // 実在確認はクエリを外したパスで行う。
  relativePath = relativePath.split('?')[0];

  if (/^[a-z][a-z0-9+.-]*:/i.test(relativePath) || relativePath.startsWith('//')) {
    fail(`${label} は外部URLです: ${relativePath}`);
    return null;
  }
  if (relativePath.startsWith('/')) {
    fail(`${label} は public/ からの相対パスで書いてください: ${relativePath}`);
    return null;
  }
  const resolved = path.resolve(publicDir, relativePath);
  if (resolved !== publicDir && !resolved.startsWith(publicDir + path.sep)) {
    fail(`${label} が public/ の外を指しています: ${relativePath}`);
    return null;
  }
  return resolved;
}

function validateTool(tool, index) {
  const where = `tools[${index}]`;

  if (typeof tool.id !== 'string' || !ID_PATTERN.test(tool.id)) {
    fail(`${where}.id は英小文字・数字・ハイフンで書いてください: ${JSON.stringify(tool.id)}`);
  }

  for (const key of REQUIRED_TEXT_KEYS) {
    if (typeof tool[key] !== 'string' || tool[key].trim() === '') {
      fail(`${where}.${key} が空です`);
    }
  }

  if (!ALLOWED_SECTIONS.has(tool.section)) {
    fail(`${where}.section は ${[...ALLOWED_SECTIONS].join(' / ')} のいずれかです: ${JSON.stringify(tool.section)}`);
  }

  if (typeof tool.accent !== 'string' || !ACCENT_PATTERN.test(tool.accent)) {
    fail(`${where}.accent は #rrggbb で書いてください: ${JSON.stringify(tool.accent)}`);
  }

  for (const key of ['href', 'thumb']) {
    if (typeof tool[key] !== 'string' || tool[key].trim() === '') {
      fail(`${where}.${key} が空です`);
      continue;
    }
    const resolved = resolveInsidePublic(tool[key], `${where}.${key}`);
    if (resolved === null) continue;
    if (!fs.existsSync(resolved)) {
      fail(`${where}.${key} の参照先がありません: public/${tool[key]}`);
    }
  }
}

const data = readTools();

if (data) {
  const seenIds = new Map();

  data.tools.forEach((tool, index) => {
    validateTool(tool, index);
    if (typeof tool.id === 'string') {
      if (seenIds.has(tool.id)) {
        fail(`id が重複しています: ${tool.id}（tools[${seenIds.get(tool.id)}] と tools[${index}]）`);
      } else {
        seenIds.set(tool.id, index);
      }
    }
  });

  if (data.tools.filter((tool) => tool.section === 'live').length === 0) {
    fail('現役のツールが1件もありません。入口ページに導線が出なくなります');
  }
}

if (errors.length > 0) {
  for (const error of errors) console.error(`エラー: ${error}`);
  process.exit(1);
}

const live = data.tools.filter((tool) => tool.section === 'live').length;
const archive = data.tools.length - live;
console.log(`ツール一覧の検証に成功しました。現役${live}件、過去のページ${archive}件です。`);
