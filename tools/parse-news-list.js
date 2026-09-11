#!/usr/bin/env node

/**
 * ニュース一覧のHTMLから、記事の事実だけをCSVにする。
 *
 * 設計は docs/supporter-timeline-design.md の「イベント・配布・物販の取り込み」を正とする。
 *
 * **持つのは事実だけ。** 記事IDと公開日とカテゴリと試合との対応と、記事のURL。
 * **題（タイトル）は残さない。** 題は対戦相手と日付を割り出すためだけに読み、CSVには書かない
 * （`docs/supporter-timeline-design.md` の「利用規約から決めたこと」）。
 *
 * 題の頭は実測で定型だった。
 *
 *     【M/D(曜)相手戦】…
 *
 * 2026-09-11 の実測では対象4カテゴリの65%に付いており、`public/data/matches.json` と
 * 突き合わせた43件すべてが一意の試合に解決した（失敗ゼロ）。
 * **`対象試合` ラベルを本文から読む必要がない。**
 *
 * 1つの題に2試合が並ぶことがある（`【8/22(土)水戸戦･8/29(土)福岡戦】`）。
 * `match_ids` は配列なので、そのまま両方入れる。
 *
 * ## 一覧の構造でつまずきやすいところ
 *
 * - 各ページの先頭に「ピックアップ」が**毎ページ同じ内容で繰り返される**。
 *   記事IDで重複を除かないと、9ページで90件のところを120件以上に数える。
 * - 同じ記事が2つの日付書式で載る。ピックアップ側は `2026/09/07`、一覧側は `2026/9/9`。
 *   どちらも読めるようにしてある。
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const DEFAULT_INPUT_DIR = path.join(repoRoot, 'tmp', 'news-list');
const DEFAULT_OUTPUT = path.join(repoRoot, 'docs', 'sheets', 'news.current.csv');
const DEFAULT_MATCHES = path.join(repoRoot, 'public', 'data', 'matches.json');

const HEADER = 'article_id,published_on,category,match_ids,source_url,retrieved_at_jst';

/**
 * 記事1件ぶんの `<a>`。ピックアップ側（サムネイルあり）と一覧側の両方に当たる。
 * 中身は最大600文字までしか見ない。次の記事まで飲み込まないため。
 */
const ARTICLE_RE = /<a href="(https:\/\/www\.sanga-fc\.jp\/news\/detail\/(\d+))"[^>]*>([\s\S]{0,600}?)<\/a>/g;
/** `<p>2026/9/9<span>グッズ</span></p> <p>題</p>` の形。ゼロ詰めの有無は問わない。 */
const ITEM_RE = /<p>(\d{4})\/(\d{1,2})\/(\d{1,2})<span>([^<]*)<\/span><\/p>\s*<p>([\s\S]*?)<\/p>/;
/** 題の頭に並ぶ `M/D(曜)相手戦`。1つの `【】` に複数入ることがある。 */
const MATCH_RE = /(\d{1,2})\/(\d{1,2})\([日月火水木金土]\)([^】･・、,]+?)戦/g;

function usage() {
  console.error('使い方: node tools/parse-news-list.js [入力ディレクトリまたはHTML] [出力CSV] [options]');
  console.error('  --check                  書き換えず、既存CSVと一致するかだけ確かめる');
  console.error('  --keep-unchanged         違いが取得日時だけなら書き換えない');
  console.error('  --matches <path>         試合データ（既定: public/data/matches.json）');
  console.error('  --retrieved-at <ISO8601> 取得日時（既定: 実行時刻）');
  console.error(`入力を省略した場合: ${DEFAULT_INPUT_DIR}`);
  console.error(`出力を省略した場合: ${DEFAULT_OUTPUT}`);
}

function pad(n) { return String(n).padStart(2, '0'); }

function jstStamp(date) {
  const jst = new Date(date.getTime() + 9 * 3600000);
  return `${jst.getUTCFullYear()}-${pad(jst.getUTCMonth() + 1)}-${pad(jst.getUTCDate())}`
    + `T${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}:${pad(jst.getUTCSeconds())}+09:00`;
}

function decode(text) {
  return text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ');
}

function readMatches(matchesPath) {
  const raw = JSON.parse(fs.readFileSync(matchesPath, 'utf8'));
  const matches = Array.isArray(raw) ? raw : raw.matches;
  if (!Array.isArray(matches)) throw new Error('matches.json の形式が想定と違います');
  return matches.filter((m) => m.match_date);
}

/**
 * 題に出る `M/D(曜)相手` を試合IDに直す。
 *
 * **年は書かれていない。** 月日が一致する試合が**ちょうど1つ**のときだけ採り、
 * さらに相手の名前が前方一致するかを確かめる（`大田` → `大田ハナ・シチズン`）。
 * どちらか外れたら黙って捨てる。**間違った試合に結び付けるくらいなら結び付けない。**
 */
function matchIdsFromTitle(title, matches) {
  const ids = [];
  let m;
  MATCH_RE.lastIndex = 0;
  while ((m = MATCH_RE.exec(title))) {
    const suffix = `-${pad(m[1])}-${pad(m[2])}`;
    const opponent = m[3].trim();
    const candidates = matches.filter((x) => x.match_date.endsWith(suffix));
    if (candidates.length !== 1) continue;
    const found = candidates[0];
    if (!found.opponent || !found.opponent.startsWith(opponent)) continue;
    if (!ids.includes(found.id)) ids.push(found.id);
  }
  return ids;
}

function collectHtmlFiles(inputPath) {
  const stat = fs.statSync(inputPath);
  if (!stat.isDirectory()) return [inputPath];
  return fs.readdirSync(inputPath)
    .filter((name) => name.endsWith('.html'))
    .sort()
    .map((name) => path.join(inputPath, name));
}

function parse(files, matches) {
  const byId = new Map();
  const skipped = [];

  files.forEach((file) => {
    const html = fs.readFileSync(file, 'utf8');
    let a;
    ARTICLE_RE.lastIndex = 0;
    while ((a = ARTICLE_RE.exec(html))) {
      const [, url, id, innerRaw] = a;
      const inner = innerRaw.replace(/\s+/g, ' ');
      const item = inner.match(ITEM_RE);
      if (!item) {
        // ヘッダーやフッターからも記事URLへリンクが張られている（アプリ案内など）。
        // 日付とカテゴリを伴わないものは記事一覧の項目ではないので、静かに飛ばす。
        continue;
      }
      if (byId.has(id)) continue; // ピックアップと一覧で同じ記事が2度出る
      const category = decode(item[4]).trim();
      const title = decode(item[5]).replace(/\s+/g, ' ').trim();
      if (!category) { skipped.push(`${id}: カテゴリが空`); continue; }
      byId.set(id, {
        article_id: id,
        published_on: `${item[1]}-${pad(item[2])}-${pad(item[3])}`,
        category,
        match_ids: matchIdsFromTitle(title, matches),
        source_url: url,
      });
    }
  });

  const rows = [...byId.values()].sort((x, y) => (
    x.published_on === y.published_on
      ? Number(y.article_id) - Number(x.article_id)
      : (x.published_on < y.published_on ? 1 : -1)
  ));
  return { rows, skipped };
}

function toCsv(rows, retrievedAt) {
  const lines = [HEADER];
  rows.forEach((row) => {
    // カテゴリは公式の分類語で、カンマを含む例は実測で無い。含んだら取り込まない。
    if (row.category.includes(',')) return;
    lines.push([
      row.article_id, row.published_on, row.category,
      row.match_ids.join(' '), row.source_url, retrievedAt,
    ].join(','));
  });
  return `${lines.join('\n')}\n`;
}

/** 取得日時だけの違いを無視して見比べるための形。 */
function comparableCsv(csv) {
  return csv.split('\n').map((line) => line.replace(/,[^,]*$/, '')).join('\n');
}

function main(argv) {
  const options = { retrievedAt: null, check: false, keepUnchanged: false, matchesPath: DEFAULT_MATCHES };
  const positional = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') { usage(); return 0; }
    if (arg === '--check') { options.check = true; continue; }
    if (arg === '--keep-unchanged') { options.keepUnchanged = true; continue; }
    if (arg === '--matches') { options.matchesPath = path.resolve(argv[i += 1]); continue; }
    if (arg === '--retrieved-at') { options.retrievedAt = argv[i += 1]; continue; }
    if (arg.startsWith('--')) { console.error(`不明なオプション: ${arg}`); usage(); return 1; }
    positional.push(arg);
  }

  if (positional.length > 2) { usage(); return 1; }
  const inputPath = positional[0] ? path.resolve(positional[0]) : DEFAULT_INPUT_DIR;
  const outputPath = positional[1] ? path.resolve(positional[1]) : DEFAULT_OUTPUT;
  const retrievedAt = options.retrievedAt || jstStamp(new Date());

  if (!fs.existsSync(inputPath)) {
    console.error(`入力がありません: ${path.relative(repoRoot, inputPath)}`);
    console.error('  先に node tools/fetch-news-list.js を実行してください。');
    return 1;
  }

  let files;
  let matches;
  let parsed;
  try {
    files = collectHtmlFiles(inputPath);
    if (!files.length) { console.error(`HTMLがありません: ${path.relative(repoRoot, inputPath)}`); return 1; }
    matches = readMatches(options.matchesPath);
    parsed = parse(files, matches);
  } catch (error) {
    console.error(`解析できません: ${error.message}`);
    return 1;
  }

  if (!parsed.rows.length) {
    console.error('記事を1件も読めませんでした。ページ構成の変更を疑ってください。');
    return 1;
  }

  const csv = toCsv(parsed.rows, retrievedAt);
  const existing = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : null;

  if (options.check) {
    if (existing === null) {
      console.error(`比べる相手がありません: ${path.relative(repoRoot, outputPath)}`);
      return 1;
    }
    if (comparableCsv(existing) !== comparableCsv(csv)) {
      console.error(`${path.relative(repoRoot, outputPath)} と一致しません`);
      return 1;
    }
    console.log(`${path.relative(repoRoot, outputPath)} と一致しました（記事${parsed.rows.length}件）`);
    return 0;
  }

  if (options.keepUnchanged && existing !== null && comparableCsv(existing) === comparableCsv(csv)) {
    console.log(`変化なし: ${path.relative(repoRoot, outputPath)} は書き換えていません`);
    console.log(`  違いは取得日時だけでした（記事${parsed.rows.length}件）`);
    return 0;
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, csv);

  const linked = parsed.rows.filter((row) => row.match_ids.length).length;
  const byCategory = {};
  parsed.rows.forEach((row) => { byCategory[row.category] = (byCategory[row.category] || 0) + 1; });

  console.log(`${path.relative(repoRoot, outputPath)} を書きました（記事${parsed.rows.length}件 / ${files.length}ページ）`);
  console.log(`  試合に結び付いた記事: ${linked}件（${Math.round((linked / parsed.rows.length) * 100)}%）`);
  Object.entries(byCategory).sort((x, y) => y[1] - x[1]).forEach(([name, count]) => {
    console.log(`    ${name} ${count}件`);
  });
  if (parsed.skipped.length) {
    console.log(`  読めなかった項目: ${parsed.skipped.length}件`);
    parsed.skipped.forEach((line) => { console.log(`    ${line}`); });
  }
  return 0;
}

process.exit(main(process.argv.slice(2)));
