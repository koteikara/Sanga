#!/usr/bin/env node

/**
 * アウェイ戦の試合ページ（Jリーグチケット）を取得してHTMLを保存する。
 *
 * 対象は docs/sheets/away-tickets.current.csv に載っている試合ページだけ。
 * つまり段階1が拾った「そのサイトで売っている発売中の試合」に限る。
 *
 * 方針は docs/supporter-timeline-design.md の「アウェイ戦のチケット」に従う。
 * 1ページごとに10秒以上空け、頻度は1日1回程度にとどめる。
 * 取得するのは事実（販売区分と販売期間）だけで、文章・画像は保存も転載もしない。
 *
 * 解析は tools/parse-away-sales.js が行う。ここは取得だけを受け持つ。
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const DEFAULT_INPUT = path.join(repoRoot, 'docs', 'sheets', 'away-tickets.current.csv');
const DEFAULT_OUTPUT_DIR = path.join(repoRoot, 'tmp', 'away-perform');

const CRAWL_DELAY_SECONDS = 10;
const MIN_INTERVAL_HOURS = 24;
const MAX_ATTEMPTS = 3;
const TIMEOUT_MS = 30000;

const USER_AGENT = 'SangaSupporterTimeline/1.0 (+https://github.com/koteikara/Sanga; unofficial fan tool)';

function usage() {
  console.error('使い方: node tools/fetch-away-sales.js [options]');
  console.error('  --input <csv>   対象一覧（既定: docs/sheets/away-tickets.current.csv）');
  console.error('  --out <dir>     保存先（既定: tmp/away-perform）');
  console.error('  --force         前回取得からの間隔にかかわらず取得する');
  console.error(`1ページごとに${CRAWL_DELAY_SECONDS}秒以上空けます。`);
}

function sleep(seconds) {
  return new Promise((resolve) => { setTimeout(resolve, seconds * 1000); });
}

function stampPath(outputDir) {
  return path.join(outputDir, '.fetched-at');
}

function tooSoon(outputDir) {
  const stamp = stampPath(outputDir);
  if (!fs.existsSync(stamp)) return null;
  const previous = Date.parse(fs.readFileSync(stamp, 'utf8').trim());
  if (Number.isNaN(previous)) return null;
  const elapsedHours = (Date.now() - previous) / 3600000;
  if (elapsedHours >= MIN_INTERVAL_HOURS) return null;
  return `前回の取得から${elapsedHours.toFixed(1)}時間しか経っていません。`;
}

/** CSVは自分たちで書いた単純な形なので、引用符のない前提で読む。 */
function readRows(csvPath) {
  const text = fs.readFileSync(csvPath, 'utf8').replace(/^﻿/, '');
  const lines = text.split('\n').filter((line) => line.trim() !== '');
  if (lines.length < 2) return [];
  const header = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row = {};
    header.forEach((key, index) => { row[key.trim()] = (cells[index] || '').trim(); });
    return row;
  });
}

/** URLの `/sales/perform/2628602/001` から `2628602-001` を作る。保存名にする。 */
function performId(url) {
  const found = url.match(/\/sales\/perform\/(\d+)\/(\d+)/);
  return found ? `${found[1]}-${found[2]}` : '';
}

async function fetchOnce(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithRetry(url) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await fetchOnce(url);
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) {
        console.error(`取得に失敗しました（${attempt}回目）: ${error.message}`);
        await sleep(CRAWL_DELAY_SECONDS);
      }
    }
  }
  throw lastError;
}

async function main(argv) {
  const options = { inputPath: DEFAULT_INPUT, outputDir: DEFAULT_OUTPUT_DIR, force: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') { usage(); return 0; }
    if (arg === '--force') { options.force = true; continue; }
    if (arg === '--input') { options.inputPath = path.resolve(argv[i += 1]); continue; }
    if (arg === '--out') { options.outputDir = path.resolve(argv[i += 1]); continue; }
    console.error(`不明なオプション: ${arg}`); usage(); return 1;
  }

  if (!options.force) {
    const reason = tooSoon(options.outputDir);
    if (reason) {
      console.error(reason);
      console.error('  取得は1日1回程度にとどめます。必要な場合は --force を付けてください。');
      return 1;
    }
  }

  let rows;
  try {
    rows = readRows(options.inputPath).filter((row) => row.perform_url);
  } catch (error) {
    console.error(`一覧を読めません: ${error.message}`);
    return 1;
  }

  if (rows.length === 0) {
    console.log('対象の試合ページがありません。段階1の取り込みが先です。');
    return 0;
  }

  fs.mkdirSync(options.outputDir, { recursive: true });

  let saved = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const id = performId(row.perform_url);
    if (!id) {
      console.error(`試合ページのURLの形が想定と違います: ${row.perform_url}`);
      continue;
    }

    // 相手先に負荷をかけない。1件目の前には待たない。
    if (i > 0) await sleep(CRAWL_DELAY_SECONDS);

    let html;
    try {
      html = await fetchWithRetry(row.perform_url);
    } catch (error) {
      console.error(`取得できませんでした（${row.opponent_raw}）: ${error.message}`);
      continue;
    }

    fs.writeFileSync(path.join(options.outputDir, `${id}.html`), html);
    saved += 1;
    console.log(`  ${row.match_date} ${row.opponent_raw} → ${id}.html（${html.length}文字）`);
  }

  fs.writeFileSync(stampPath(options.outputDir), `${new Date().toISOString()}\n`);
  console.log(`${saved}件を ${path.relative(repoRoot, options.outputDir)} に保存しました。`);
  console.log('  次は node tools/parse-away-sales.js でCSVにします。');
  return saved > 0 ? 0 : 1;
}

main(process.argv.slice(2)).then((code) => process.exit(code));
