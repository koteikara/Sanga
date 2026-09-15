#!/usr/bin/env node

/**
 * JリーグチケットのクラブページからアウェイのHTMLを取得して保存する。
 *
 * 方針は docs/supporter-timeline-design.md の「アウェイ戦のチケット」に従う。
 * 2026-08-31 に確認した時点で robots.txt に Disallow も Crawl-delay も無く、
 * 利用規約にも自動取得を禁じる条項は無い。ただし頻度は1日1回程度にとどめる。
 *
 * 取得するのは事実（試合と在庫の状態）だけで、文章・画像は保存も転載もしない。
 *
 * 解析は tools/parse-away-tickets.js が行う。ここは取得だけを受け持つ。
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const SOURCE_URL = 'https://www.jleague-ticket.jp/club/ks/?tab=away';
const DEFAULT_OUTPUT = path.join(repoRoot, 'tmp', 'away-tickets.html');

/** 相手先に負荷をかけないための最小間隔（秒）。再試行の待ちにも使う。 */
const CRAWL_DELAY_SECONDS = 10;
/** 「1日1回程度」を守るための、同じ出力先への最小間隔（時間）。 */
const MIN_INTERVAL_HOURS = 24;
const MAX_ATTEMPTS = 3;
const TIMEOUT_MS = 30000;

/** このページであることの目印（試合ページへのリンク）。無ければ取得できていても中身が違う。 */
const PAGE_MARKER = '/sales/perform/';

/** 素性を明かし、連絡先の代わりにリポジトリを示す。 */
const USER_AGENT = 'SangaSupporterTimeline/1.0 (+https://github.com/koteikara/Sanga; unofficial fan tool)';

function usage() {
  console.error('使い方: node tools/fetch-away-tickets.js [output.html] [options]');
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

/** 何を受け取ったのかを一行にする。題があれば題を、無ければ本文の頭を見せる。 */
function describeHtml(html) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const head = title
    ? title[1].replace(/\s+/g, ' ').trim()
    : html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  return `${html.length}文字 / ${head || '(空)'}`;
}

/**
 * 目印の無いHTMLを残す。次に同じことが起きたとき、何が返ってきたのかを
 * 見るためだけに使う。**リポジトリには入れない**（出力先は tmp/ の隣）。
 */
function saveUnexpected(outputPath, html) {
  const file = `${outputPath}.unexpected.html`;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, html);
    return file;
  } catch (error) {
    console.error(`  受け取ったHTMLを保存できませんでした: ${error.message}`);
    return null;
  }
}

/**
 * 取れないとき（HTTPエラー・時間切れ）に加え、**目印の無いHTMLも取り直す**。
 *
 * 2026-09-14の取り込み#19で、同じURLが手元では正しく取れるのにCIでだけ目印を
 * 欠きました。一度きりなら取り直せば通ります。3回とも欠けるならページ構成の変更で、
 * そのときは最後に受け取ったものを `error.unexpectedHtml` に付けて返します。
 *
 * 中身の検査を再試行の外に置くと、一過性の失敗でその日の取り込みが丸ごと止まります。
 */
async function fetchWithRetry(url) {
  let lastError;
  let unexpectedHtml = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const html = await fetchOnce(url);
      if (html.includes(PAGE_MARKER)) return html;
      unexpectedHtml = html;
      throw new Error(`目印（${PAGE_MARKER}）がHTMLにありません（${describeHtml(html)}）`);
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) {
        console.error(`取得に失敗しました（${attempt}回目）: ${error.message}`);
        console.error(`  ${CRAWL_DELAY_SECONDS}秒待って再試行します。`);
        await sleep(CRAWL_DELAY_SECONDS);
      }
    }
  }
  lastError.unexpectedHtml = unexpectedHtml;
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
    if (error.unexpectedHtml) {
      const saved = saveUnexpected(options.outputPath, error.unexpectedHtml);
      if (saved) {
        console.error(`  受け取ったHTMLを ${path.relative(repoRoot, saved)} に残しました。`);
        console.error('  取得先かページ構成を確認してください。');
      }
    }
    return 1;
  }

  fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
  fs.writeFileSync(options.outputPath, html);
  fs.writeFileSync(stampPath(options.outputPath), `${new Date().toISOString()}\n`);

  console.log(`${path.relative(repoRoot, options.outputPath)} を保存しました（${html.length}文字）`);
  console.log('  次は node tools/parse-away-tickets.js でCSVにします。');
  return 0;
}

main(process.argv.slice(2)).then((code) => process.exit(code));
