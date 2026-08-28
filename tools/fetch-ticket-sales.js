#!/usr/bin/env node

/**
 * 公式のチケット販売スケジュールページを取得してHTMLを保存する。
 *
 * 取得マナーは docs/supporter-timeline-design.md の「公式サイトの利用条件」に従う。
 * robots.txt に一般的な Disallow は無いが `Crawl-delay: 10` の指定があるため、
 * リクエスト間隔は10秒以上空け、頻度は1日1回程度にとどめる。
 * 前回の取得時刻を出力先の隣に記録し、既定では24時間以内の再取得を断る。
 *
 * 解析は tools/parse-ticket-sales.js が行う。ここは取得だけを受け持つ。
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const SOURCE_URL = 'https://www.sanga-fc.jp/ticket/schedule';
const DEFAULT_OUTPUT = path.join(repoRoot, 'tmp', 'ticket-schedule.html');

/** robots.txt の Crawl-delay に合わせた最小間隔（秒）。再試行の待ちにも使う。 */
const CRAWL_DELAY_SECONDS = 10;
/** 「1日1回程度」を守るための、同じ出力先への最小間隔（時間）。 */
const MIN_INTERVAL_HOURS = 24;
const MAX_ATTEMPTS = 3;
const TIMEOUT_MS = 30000;

/** 素性を明かし、連絡先の代わりにリポジトリを示す。 */
const USER_AGENT = 'SangaSupporterTimeline/1.0 (+https://github.com/koteikara/Sanga; unofficial fan tool)';

function usage() {
  console.error('使い方: node tools/fetch-ticket-sales.js [output.html] [options]');
  console.error('  --force    前回取得からの間隔にかかわらず取得する');
  console.error(`  --url <URL> 取得先（既定: ${SOURCE_URL}）`);
  console.error(`出力先を省略した場合: ${DEFAULT_OUTPUT}`);
  console.error(`取得間隔は既定で${MIN_INTERVAL_HOURS}時間以上空けます。`);
}

function stampPath(outputPath) {
  return `${outputPath}.fetched-at`;
}

/** 前回の取得時刻からの経過時間を見て、間隔が足りなければ理由を返す。 */
function tooSoon(outputPath) {
  const stamp = stampPath(outputPath);
  if (!fs.existsSync(stamp)) return null;
  const previous = Date.parse(fs.readFileSync(stamp, 'utf8').trim());
  if (Number.isNaN(previous)) return null;
  const elapsedHours = (Date.now() - previous) / 3600000;
  if (elapsedHours >= MIN_INTERVAL_HOURS) return null;
  const remaining = (MIN_INTERVAL_HOURS - elapsedHours).toFixed(1);
  return `前回の取得から${elapsedHours.toFixed(1)}時間しか経っていません（あと${remaining}時間）。`;
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
        console.error(`  ${CRAWL_DELAY_SECONDS}秒待って再試行します。`);
        await sleep(CRAWL_DELAY_SECONDS);
      }
    }
  }
  throw lastError;
}

async function main(argv) {
  const options = { outputPath: null, url: SOURCE_URL, force: false };
  const positional = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') { usage(); return 0; }
    if (arg === '--force') { options.force = true; continue; }
    if (arg === '--url') { options.url = argv[i += 1]; continue; }
    if (arg.startsWith('--')) { console.error(`不明なオプション: ${arg}`); usage(); return 1; }
    positional.push(arg);
  }

  if (positional.length > 1) { usage(); return 1; }
  options.outputPath = positional[0] ? path.resolve(positional[0]) : DEFAULT_OUTPUT;

  if (!options.force) {
    const reason = tooSoon(options.outputPath);
    if (reason) {
      console.error(reason);
      console.error('  取得は1日1回程度にとどめます。どうしても必要な場合は --force を付けてください。');
      return 1;
    }
  }

  let html;
  try {
    html = await fetchWithRetry(options.url);
  } catch (error) {
    console.error(`取得できませんでした: ${error.message}`);
    return 1;
  }

  if (!html.includes('schedule__list')) {
    console.error('販売スケジュールの目印（schedule__list）がHTMLにありません。取得先かページ構成を確認してください。');
    return 1;
  }

  fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
  fs.writeFileSync(options.outputPath, html);
  fs.writeFileSync(stampPath(options.outputPath), `${new Date().toISOString()}\n`);

  console.log(`${path.relative(repoRoot, options.outputPath)} を保存しました（${html.length}文字）`);
  console.log('  次は node tools/parse-ticket-sales.js でCSVにします。');
  return 0;
}

main(process.argv.slice(2)).then((code) => process.exit(code));
