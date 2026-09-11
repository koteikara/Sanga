#!/usr/bin/env node

/**
 * 京都サンガF.C.公式のニュース一覧を取得して保存する。
 *
 * 方針は docs/supporter-timeline-design.md の「イベント・配布・物販の取り込み」に従う。
 *
 * **一覧だけを取る。記事は開かない。** 一覧のHTMLはCMSが出しており、
 * 日付・カテゴリ・題・記事URLが書き手の手を経ずに並ぶ。
 * ここが揺れない唯一の層で、層1（全自動）が読むのはこれだけ。
 *
 * 取得するのは事実（記事があること・日付・カテゴリ・試合との対応）だけで、
 * **記事本文とタイトルは保存も転載もしない**（`docs/supporter-timeline-design.md` の
 * 「利用規約から決めたこと」）。題は解析の途中で対戦相手を割り出すためだけに使い、
 * CSVにも公開JSONにも残さない。
 *
 * robots.txt の `Crawl-delay: 10` に合わせ、ページ間は10秒以上空ける。
 *
 * 解析は tools/parse-news-list.js が行う。ここは取得だけを受け持つ。
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const SOURCE_URL = 'https://www.sanga-fc.jp/news';
const DEFAULT_OUTPUT_DIR = path.join(repoRoot, 'tmp', 'news-list');

/**
 * 何ページ取るか。
 *
 * **実測から決めている。** 一覧は1ページ10件で、記事は30日に117件（1日3.9件）出る
 * （2026-09-11 に9ページ90件で実測）。5ページ50件でおよそ13日ぶんになり、
 * 次のホーム戦までの案内をひととおり覆える。
 *
 * 増やすと取得が10秒ずつ伸び、減らすと古い試合の案内を取りこぼす。
 */
const DEFAULT_PAGES = 5;

/** 相手先に負荷をかけないための最小間隔（秒）。再試行の待ちにも使う。 */
const CRAWL_DELAY_SECONDS = 10;
/** 「1日1回程度」を守るための、同じ出力先への最小間隔（時間）。 */
const MIN_INTERVAL_HOURS = 24;
const MAX_ATTEMPTS = 3;
const TIMEOUT_MS = 30000;

/** 素性を明かし、連絡先の代わりにリポジトリを示す。 */
const USER_AGENT = 'SangaSupporterTimeline/1.0 (+https://github.com/koteikara/Sanga; unofficial fan tool)';

function usage() {
  console.error('使い方: node tools/fetch-news-list.js [出力ディレクトリ] [options]');
  console.error('  --force        前回取得からの間隔にかかわらず取得する');
  console.error(`  --pages <数>   取得するページ数（既定: ${DEFAULT_PAGES}）`);
  console.error(`  --url <URL>    取得先（既定: ${SOURCE_URL}）`);
  console.error(`出力先を省略した場合: ${DEFAULT_OUTPUT_DIR}`);
  console.error(`取得間隔は既定で${MIN_INTERVAL_HOURS}時間以上、ページ間は${CRAWL_DELAY_SECONDS}秒以上空けます。`);
}

function stampPath(outputDir) {
  return path.join(outputDir, '.fetched-at');
}

/** 前回の取得時刻からの経過時間を見て、間隔が足りなければ理由を返す。 */
function tooSoon(outputDir) {
  const stamp = stampPath(outputDir);
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
    // 一覧は `/news/` が `/news` へ301を返す。追従しないと235バイトの空応答を掴む。
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

function pageUrl(baseUrl, page) {
  return page === 1 ? baseUrl : `${baseUrl}?page=${page}`;
}

async function main(argv) {
  const options = { outputDir: null, url: SOURCE_URL, pages: DEFAULT_PAGES, force: false };
  const positional = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') { usage(); return 0; }
    if (arg === '--force') { options.force = true; continue; }
    if (arg === '--url') { options.url = argv[i += 1]; continue; }
    if (arg === '--pages') { options.pages = Number(argv[i += 1]); continue; }
    if (arg.startsWith('--')) { console.error(`不明なオプション: ${arg}`); usage(); return 1; }
    positional.push(arg);
  }

  if (positional.length > 1) { usage(); return 1; }
  options.outputDir = positional[0] ? path.resolve(positional[0]) : DEFAULT_OUTPUT_DIR;

  if (!Number.isInteger(options.pages) || options.pages < 1 || options.pages > 20) {
    console.error(`--pages は1以上20以下の整数である必要があります: ${options.pages}`);
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

  fs.mkdirSync(options.outputDir, { recursive: true });

  for (let page = 1; page <= options.pages; page += 1) {
    if (page > 1) await sleep(CRAWL_DELAY_SECONDS);
    const url = pageUrl(options.url, page);
    let html;
    try {
      html = await fetchWithRetry(url);
    } catch (error) {
      console.error(`${url} を取得できませんでした: ${error.message}`);
      return 1;
    }

    // 記事が1件も無いページはあり得ないので、リンクの形が消えたら構成の変更を疑う。
    if (!html.includes('/news/detail/')) {
      console.error(`記事へのリンク（/news/detail/）が ${url} のHTMLにありません。`);
      console.error('  取得先かページ構成を確認してください。');
      return 1;
    }

    const file = path.join(options.outputDir, `page-${String(page).padStart(2, '0')}.html`);
    fs.writeFileSync(file, html);
    console.log(`${path.relative(repoRoot, file)} を保存しました（${html.length}文字）`);
  }

  fs.writeFileSync(stampPath(options.outputDir), `${new Date().toISOString()}\n`);
  console.log(`${options.pages}ページを保存しました。次は node tools/parse-news-list.js でCSVにします。`);
  return 0;
}

main(process.argv.slice(2)).then((code) => process.exit(code));
