#!/usr/bin/env node

/**
 * これからの試合に結び付いた記事の本文を取得して保存する。
 *
 * 設計は docs/supporter-timeline-design.md の「イベント・配布・物販の取り込み」に従う。
 *
 * **全部は取らない。** 一覧に載る記事は30日で117件あるが、本文が要るのは
 * 「試合に結び付いていて」「その試合がこれから来る」ものだけ。実測では
 * 1試合あたり13件ほどで、対象はふつう1〜2試合ぶんに収まる。
 *
 * **毎日取り直す。** 公式の記事は上書きで更新され、題に「(9/8追記)」が付く。
 * 前に取ったものを使い回すと、変更に気付けない。
 *
 * 取得するのは日時という事実だけで、**本文とタイトルは保存も転載もしない。**
 * 保存先は tmp/ で、リポジトリには入れない（.gitignore）。
 *
 * 解析は tools/parse-news-times.js が行う。ここは取得だけを受け持つ。
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const DEFAULT_NEWS = path.join(repoRoot, 'docs', 'sheets', 'news.current.csv');
const DEFAULT_MATCHES = path.join(repoRoot, 'public', 'data', 'matches.json');
const DEFAULT_OUTPUT_DIR = path.join(repoRoot, 'tmp', 'news-articles');

/**
 * 何日先の試合まで見るか。
 *
 * 試合当日の案内は実測で試合の2週間前あたりから出はじめる（9/11の柏戦は8/25が初出）。
 * 21日あれば取りこぼさず、かつ対象がふくらまない。
 */
const DEFAULT_WITHIN_DAYS = 21;

/** 1回の実行で取る本数の上限。相手先への負荷と実行時間の歯止め。 */
const MAX_ARTICLES = 25;

const CRAWL_DELAY_SECONDS = 10;
const MIN_INTERVAL_HOURS = 24;
const MAX_ATTEMPTS = 3;
const TIMEOUT_MS = 30000;
const USER_AGENT = 'SangaSupporterTimeline/1.0 (+https://github.com/koteikara/Sanga; unofficial fan tool)';

function usage() {
  console.error('使い方: node tools/fetch-news-articles.js [出力ディレクトリ] [options]');
  console.error('  --force               前回取得からの間隔にかかわらず取得する');
  console.error('  --news <csv>          一覧のCSV（既定: docs/sheets/news.current.csv）');
  console.error('  --matches <path>      試合データ（既定: public/data/matches.json）');
  console.error(`  --within <日数>       何日先の試合まで見るか（既定: ${DEFAULT_WITHIN_DAYS}）`);
  console.error('  --today <YYYY-MM-DD>  基準日。省略時は今日（JST）');
  console.error(`出力先を省略した場合: ${DEFAULT_OUTPUT_DIR}`);
}

function pad(n) { return String(n).padStart(2, '0'); }

function todayInJst() {
  return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
}

function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

function readRows(csvPath) {
  if (!fs.existsSync(csvPath)) return [];
  const text = fs.readFileSync(csvPath, 'utf8').replace(/^﻿/, '');
  const lines = text.split('\n').filter((line) => line.trim() !== '');
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map((name) => name.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row = {};
    header.forEach((name, index) => { row[name] = (cells[index] || '').trim(); });
    return row;
  });
}

function readMatches(matchesPath) {
  const raw = JSON.parse(fs.readFileSync(matchesPath, 'utf8'));
  const matches = Array.isArray(raw) ? raw : raw.matches;
  if (!Array.isArray(matches)) throw new Error('matches.json の形式が想定と違います');
  const byId = new Map();
  matches.forEach((match) => { byId.set(match.id, match); });
  return byId;
}

function stampPath(outputDir) { return path.join(outputDir, '.fetched-at'); }

function tooSoon(outputDir) {
  const stamp = stampPath(outputDir);
  if (!fs.existsSync(stamp)) return null;
  const previous = Date.parse(fs.readFileSync(stamp, 'utf8').trim());
  if (Number.isNaN(previous)) return null;
  const elapsedHours = (Date.now() - previous) / 3600000;
  if (elapsedHours >= MIN_INTERVAL_HOURS) return null;
  return `前回の取得から${elapsedHours.toFixed(1)}時間しか経っていません（あと${(MIN_INTERVAL_HOURS - elapsedHours).toFixed(1)}時間）。`;
}

function sleep(seconds) {
  return new Promise((resolve) => { setTimeout(resolve, seconds * 1000); });
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

/** これからの試合に結び付いた記事だけを選ぶ。近い試合から順に。 */
function pick(rows, matches, today, within) {
  const picked = [];
  rows.forEach((row) => {
    const ids = (row.match_ids || '').split(' ').filter(Boolean);
    let soonest = null;
    ids.forEach((id) => {
      const match = matches.get(id);
      if (!match || !match.match_date) return;
      const days = daysBetween(today, match.match_date);
      // 試合当日も対象に残す。当日券のように当日に効く案内があるため。
      if (days < 0 || days > within) return;
      if (soonest === null || days < soonest) soonest = days;
    });
    if (soonest !== null) picked.push({ row, days: soonest });
  });
  return picked.sort((a, b) => a.days - b.days).slice(0, MAX_ARTICLES);
}

async function main(argv) {
  const options = {
    outputDir: null, newsPath: DEFAULT_NEWS, matchesPath: DEFAULT_MATCHES,
    within: DEFAULT_WITHIN_DAYS, today: '', force: false,
  };
  const positional = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') { usage(); return 0; }
    if (arg === '--force') { options.force = true; continue; }
    if (arg === '--news') { options.newsPath = path.resolve(argv[i += 1]); continue; }
    if (arg === '--matches') { options.matchesPath = path.resolve(argv[i += 1]); continue; }
    if (arg === '--within') { options.within = Number(argv[i += 1]); continue; }
    if (arg === '--today') { options.today = argv[i += 1]; continue; }
    if (arg.startsWith('--')) { console.error(`不明なオプション: ${arg}`); usage(); return 1; }
    positional.push(arg);
  }

  if (positional.length > 1) { usage(); return 1; }
  options.outputDir = positional[0] ? path.resolve(positional[0]) : DEFAULT_OUTPUT_DIR;
  options.today = options.today || todayInJst();

  if (!Number.isInteger(options.within) || options.within < 0) {
    console.error(`--within は0以上の整数である必要があります: ${options.within}`);
    return 1;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.today)) {
    console.error(`--today の日付が不正です: ${options.today}`);
    return 1;
  }

  if (!options.force) {
    const reason = tooSoon(options.outputDir);
    if (reason) {
      console.error(reason);
      console.error('  取得は1日1回程度にとどめます。どうしても必要な場合は --force を付けてください。');
      return 1;
    }
  }

  let picked;
  try {
    picked = pick(readRows(options.newsPath), readMatches(options.matchesPath), options.today, options.within);
  } catch (error) {
    console.error(`対象を選べません: ${error.message}`);
    return 1;
  }

  if (!picked.length) {
    console.log(`取りに行く記事はありません（${options.today} から${options.within}日以内の試合に結び付いた記事なし）。`);
    fs.mkdirSync(options.outputDir, { recursive: true });
    fs.writeFileSync(stampPath(options.outputDir), `${new Date().toISOString()}\n`);
    return 0;
  }

  fs.mkdirSync(options.outputDir, { recursive: true });
  console.log(`${picked.length}件を取りに行きます（${options.today} から${options.within}日以内の試合）。`);

  for (let i = 0; i < picked.length; i += 1) {
    const { row, days } = picked[i];
    if (i > 0) await sleep(CRAWL_DELAY_SECONDS);
    let html;
    try {
      html = await fetchWithRetry(row.source_url);
    } catch (error) {
      // 1本落ちても残りは取る。取れなかったぶんは日時が出ないだけで、嘘にはならない。
      console.error(`  ${row.article_id} を取得できませんでした: ${error.message}`);
      continue;
    }
    fs.writeFileSync(path.join(options.outputDir, `${row.article_id}.html`), html);
    console.log(`  ${row.article_id}（あと${days}日の試合 / ${row.kind || row.category}）${html.length}文字`);
  }

  fs.writeFileSync(stampPath(options.outputDir), `${new Date().toISOString()}\n`);
  console.log('次は node tools/parse-news-times.js でCSVにします。');
  return 0;
}

main(process.argv.slice(2)).then((code) => process.exit(code));
