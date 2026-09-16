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
const { DEADLINE_KINDS } = require('./news-kinds.js');

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

/**
 * 締切のある種類を、公開日から何日まで見るか。
 *
 * **締切は試合の遠さと関係ありません。** 11/7の名古屋戦（当時52日先）のシャトルバスの
 * 申込締切は9/17でした。試合日だけで窓を切ると、この締切は一度も読まれないまま過ぎます。
 *
 * 締切は記事が出た時点で本文に書かれているので、こちらは**公開日**で窓を切ります。
 * 試合には「これから来る」ことだけを求め、何日先かは問いません。
 */
const DEADLINE_WITHIN_DAYS = 30;

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
  console.error(`  --deadline-within <日数> 締切のある種類を公開日から何日まで見るか（既定: ${DEADLINE_WITHIN_DAYS}）`);
  console.error('  --today <YYYY-MM-DD>  基準日。省略時は今日（JST）');
  console.error('  --dry-run             取りに行かず、選んだ結果だけをCSVで出す');
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

/**
 * これからの試合に結び付いた記事だけを選ぶ。窓は2つある。
 *
 * - **試合の窓**（`within` 日）: 当日の流れ・当日券・場内の催しなど、試合の日に効くもの
 * - **公開日の窓**（`deadlineWithin` 日）: 応募や交通の締切など、**試合より先に過ぎるもの**
 *
 * 試合が終わっていれば、どちらの窓でも読みません。
 */
function pick(rows, matches, today, within, deadlineWithin) {
  const picked = [];
  rows.forEach((row) => {
    const ids = (row.match_ids || '').split(' ').filter(Boolean);
    let soonest = null;
    ids.forEach((id) => {
      const match = matches.get(id);
      if (!match || !match.match_date) return;
      const days = daysBetween(today, match.match_date);
      // 試合当日も対象に残す。当日券のように当日に効く案内があるため。
      if (days < 0) return;
      if (soonest === null || days < soonest) soonest = days;
    });
    if (soonest === null) return;

    if (soonest <= within) { picked.push({ row, days: soonest, reason: 'match' }); return; }

    // 試合は遠いが、締切のある種類なら公開日で見る。
    if (!DEADLINE_KINDS.has(row.kind)) return;
    const age = daysBetween(row.published_on, today);
    if (!(age >= 0 && age <= deadlineWithin)) return;
    picked.push({ row, days: soonest, age, reason: 'deadline' });
  });

  // 近い試合から順に。締切のぶんは公開日が新しい順で、試合の後ろに付ける。
  return picked
    .sort((a, b) => {
      if (a.reason !== b.reason) return a.reason === 'match' ? -1 : 1;
      return a.reason === 'match' ? a.days - b.days : a.age - b.age;
    })
    .slice(0, MAX_ARTICLES);
}

async function main(argv) {
  const options = {
    outputDir: null, newsPath: DEFAULT_NEWS, matchesPath: DEFAULT_MATCHES,
    within: DEFAULT_WITHIN_DAYS, deadlineWithin: DEADLINE_WITHIN_DAYS, today: '',
    force: false, dryRun: false,
  };
  const positional = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') { usage(); return 0; }
    if (arg === '--force') { options.force = true; continue; }
    if (arg === '--news') { options.newsPath = path.resolve(argv[i += 1]); continue; }
    if (arg === '--matches') { options.matchesPath = path.resolve(argv[i += 1]); continue; }
    if (arg === '--within') { options.within = Number(argv[i += 1]); continue; }
    if (arg === '--deadline-within') { options.deadlineWithin = Number(argv[i += 1]); continue; }
    if (arg === '--today') { options.today = argv[i += 1]; continue; }
    if (arg === '--dry-run') { options.dryRun = true; continue; }
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
  if (!Number.isInteger(options.deadlineWithin) || options.deadlineWithin < 0) {
    console.error(`--deadline-within は0以上の整数である必要があります: ${options.deadlineWithin}`);
    return 1;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.today)) {
    console.error(`--today の日付が不正です: ${options.today}`);
    return 1;
  }

  if (!options.force && !options.dryRun) {
    const reason = tooSoon(options.outputDir);
    if (reason) {
      console.error(reason);
      console.error('  取得は1日1回程度にとどめます。どうしても必要な場合は --force を付けてください。');
      return 1;
    }
  }

  let picked;
  try {
    picked = pick(
      readRows(options.newsPath), readMatches(options.matchesPath),
      options.today, options.within, options.deadlineWithin,
    );
  } catch (error) {
    console.error(`対象を選べません: ${error.message}`);
    return 1;
  }

  // 選ぶところだけを、相手先へ出ずに確かめられるようにする。
  if (options.dryRun) {
    console.log('article_id,kind,match_ids,reason,days,age');
    picked.forEach(({ row, days, reason, age }) => {
      console.log([row.article_id, row.kind, row.match_ids, reason, days, age === undefined ? '' : age].join(','));
    });
    return 0;
  }

  if (!picked.length) {
    console.log(`取りに行く記事はありません（${options.today} から${options.within}日以内の試合も、`
      + `${options.deadlineWithin}日以内に出た締切の記事も無し）。`);
    fs.mkdirSync(options.outputDir, { recursive: true });
    fs.writeFileSync(stampPath(options.outputDir), `${new Date().toISOString()}\n`);
    return 0;
  }

  fs.mkdirSync(options.outputDir, { recursive: true });
  const byMatch = picked.filter((item) => item.reason === 'match').length;
  console.log(`${picked.length}件を取りに行きます`
    + `（${options.today} から${options.within}日以内の試合${byMatch}件`
    + ` / 試合は先だが締切のある記事${picked.length - byMatch}件）。`);

  for (let i = 0; i < picked.length; i += 1) {
    const { row, days, reason, age } = picked[i];
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
    const why = reason === 'match'
      ? `あと${days}日の試合`
      : `あと${days}日の試合・${age}日前に出た締切`;
    console.log(`  ${row.article_id}（${why} / ${row.kind || row.category}）${html.length}文字`);
  }

  fs.writeFileSync(stampPath(options.outputDir), `${new Date().toISOString()}\n`);
  console.log('次は node tools/parse-news-times.js でCSVにします。');
  return 0;
}

main(process.argv.slice(2)).then((code) => process.exit(code));
