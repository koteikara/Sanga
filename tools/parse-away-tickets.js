#!/usr/bin/env node

/**
 * JリーグチケットのクラブページのHTMLから、アウェイ戦の販売状態をCSVにする。
 *
 * 出力するのは事実だけ（試合日・対戦相手・会場・在庫の状態・試合ページのURL）で、
 * 文章や画像は持たない。設計は docs/supporter-timeline-design.md の
 * 「アウェイ戦のチケット」を正とする。
 *
 * ここに出るのは「そのサイトで売っている発売中の試合」だけで、全アウェイ戦ではない。
 * 載っていない試合を「発売前」と解釈しないこと。未発売なのか、別のプレイガイドで
 * 売っているのか（神戸は楽天チケット、柏はローソンチケットなど）区別できない。
 *
 * HTMLの取得は tools/fetch-away-tickets.js が行う。ここは取得しない。
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const DEFAULT_OUTPUT = path.join(repoRoot, 'docs', 'sheets', 'away-tickets.current.csv');
const BASE_URL = 'https://www.jleague-ticket.jp';

/** ページのアウェイ節を囲むコメント。ホーム戦を巻き込まないための目印。 */
const SECTION_START = 'アウェイここから';
const SECTION_END = 'アウェイここまで';

const COLUMNS = [
  'match_date',
  'kickoff',
  'competition',
  'opponent_raw',
  'venue',
  'state_raw',
  'perform_url',
  'retrieved_at_jst',
];

function usage() {
  console.error('使い方: node tools/parse-away-tickets.js <away.html> [output.csv] [options]');
  console.error('  --retrieved-at <ISO8601> 取得日時。省略時は実行時刻');
  console.error('  --check                  出力先と比べ、違えば終了コード1（書き換えない）');
  console.error(`出力先を省略した場合: ${path.relative(repoRoot, DEFAULT_OUTPUT)}`);
}

function stripTags(value) {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** 大会名は `<span class="bg-j1"></span>明治安田Ｊ１リーグ` の形で、中に空のspanが入る。 */
function competitionOf(row) {
  const found = row.match(/class="[^"]*\bcomp-ttk\b[^"]*"[^>]*>([\s\S]*?)<\/div>/);
  return found ? stripTags(found[1]) : '';
}

function pick(html, className) {
  const matcher = new RegExp(`<[^>]*class="[^"]*\\b${className}\\b[^"]*"[^>]*>([\\s\\S]*?)<\\/`, '');
  const found = html.match(matcher);
  return found ? stripTags(found[1]) : '';
}

/**
 * 行に出るのは「9/2」だけで年が無い。シーズンは年をまたぐため、
 * 取得日から見て過去1か月より前になる月は翌年として読む。
 */
function resolveYear(month, day, retrievedAt) {
  const base = new Date(retrievedAt);
  const year = base.getFullYear();
  const candidate = new Date(year, month - 1, day);
  const monthAgo = new Date(base.getFullYear(), base.getMonth(), base.getDate() - 31);
  return candidate < monthAgo ? year + 1 : year;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function parseRows(html, retrievedAt) {
  const start = html.indexOf(SECTION_START);
  const end = html.indexOf(SECTION_END);
  if (start < 0 || end < 0 || end < start) {
    throw new Error(`アウェイ節の目印（${SECTION_START} / ${SECTION_END}）が見つかりません。ページ構成を確認してください。`);
  }

  const section = html.slice(start, end);
  const rows = [];
  const skipped = [];
  const supplementary = [];

  // 1試合が1つの <li>。アンカー単位で切ると入れ子で取りこぼすため、行で切る。
  const chunks = section.split(/<li[\s>]/).filter((chunk) => chunk.includes('/sales/perform/'));
  chunks.forEach((chunk) => {
    const row = chunk.split('</li>')[0];
    const href = (row.match(/href="(\/sales\/perform\/[^"]+)"/) || [])[1];
    const day = pick(row, 'vs-box-info-day');
    const opponent = pick(row, 'team-name');
    const stateRaw = pick(row, 'comp-status');

    const dayParts = day.match(/^(\d{1,2})\/(\d{1,2})$/);

    // 駐車券・車椅子席・企画チケットは「その他」で並び、対戦相手の欄を持たない。
    // 同じ試合の付随チケットなので、試合の状態としては数えない。読めなかったのとは違う。
    if (!opponent) {
      supplementary.push(stripTags(row).slice(0, 60));
      return;
    }

    if (!href || !dayParts) {
      skipped.push(stripTags(row).slice(0, 60));
      return;
    }

    const month = Number(dayParts[1]);
    const date = Number(dayParts[2]);
    const year = resolveYear(month, date, retrievedAt);

    rows.push({
      match_date: `${year}-${pad(month)}-${pad(date)}`,
      kickoff: pick(row, 'vs-box-info-time'),
      competition: competitionOf(row),
      opponent_raw: opponent,
      // 会場は team-name の次のspan。クラス名が無いため、団体名を取り除いて拾う。
      venue: stripTags((row.match(/class="team-name"[^>]*>[\s\S]*?<\/p>([\s\S]*?)<\/div>/) || [])[1] || ''),
      state_raw: stateRaw,
      perform_url: `${BASE_URL}${href}`,
      retrieved_at_jst: retrievedAt,
    });
  });

  return { rows, skipped, supplementary };
}

function toCsv(rows) {
  const escape = (value) => {
    const text = value === undefined || value === null ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [COLUMNS.join(',')];
  rows.forEach((row) => { lines.push(COLUMNS.map((key) => escape(row[key])).join(',')); });
  return `${lines.join('\n')}\n`;
}

function jstStamp(date) {
  const jst = new Date(date.getTime() + 9 * 3600000);
  return `${jst.getUTCFullYear()}-${pad(jst.getUTCMonth() + 1)}-${pad(jst.getUTCDate())}`
    + `T${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}:${pad(jst.getUTCSeconds())}+09:00`;
}

function main(argv) {
  const options = { retrievedAt: null, check: false };
  const positional = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') { usage(); return 0; }
    if (arg === '--check') { options.check = true; continue; }
    if (arg === '--retrieved-at') { options.retrievedAt = argv[i += 1]; continue; }
    if (arg.startsWith('--')) { console.error(`不明なオプション: ${arg}`); usage(); return 1; }
    positional.push(arg);
  }

  if (positional.length < 1 || positional.length > 2) { usage(); return 1; }

  const htmlPath = path.resolve(positional[0]);
  const outputPath = positional[1] ? path.resolve(positional[1]) : DEFAULT_OUTPUT;
  const retrievedAt = options.retrievedAt || jstStamp(new Date());

  let html;
  try {
    html = fs.readFileSync(htmlPath, 'utf8');
  } catch (error) {
    console.error(`HTMLを読めません: ${error.message}`);
    return 1;
  }

  let parsed;
  try {
    parsed = parseRows(html, retrievedAt);
  } catch (error) {
    console.error(error.message);
    return 1;
  }

  parsed.rows.sort((a, b) => (a.match_date === b.match_date
    ? a.perform_url.localeCompare(b.perform_url)
    : a.match_date.localeCompare(b.match_date)));

  const csv = toCsv(parsed.rows);

  if (options.check) {
    const current = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : '';
    // 取得日時は毎回動くため、中身の比較からは外す。
    const withoutStamp = (text) => text.split('\n').map((line) => line.replace(/,[^,]*$/, '')).join('\n');
    if (withoutStamp(current) !== withoutStamp(csv)) {
      console.error(`${path.relative(repoRoot, outputPath)} がHTMLの内容と一致しません。`);
      console.error('  node tools/parse-away-tickets.js を実行して作り直してください。');
      return 1;
    }
    console.log(`生成物OK: ${path.relative(repoRoot, outputPath)} はHTMLと一致しています（${parsed.rows.length}件）`);
    return 0;
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, csv);

  console.log(`${path.relative(repoRoot, outputPath)} を書きました（${parsed.rows.length}件）`);
  parsed.rows.forEach((row) => {
    console.log(`  ${row.match_date} ${row.opponent_raw}（${row.state_raw}）`);
  });
  if (parsed.supplementary.length) {
    console.log(`  付随チケット（駐車券・車椅子など）として数えなかった行: ${parsed.supplementary.length}件`);
  }
  if (parsed.skipped.length) {
    console.log(`  読めなかった行: ${parsed.skipped.length}件`);
    parsed.skipped.forEach((line) => { console.log(`    ${line}`); });
  }
  console.log('  ここに出るのは発売中の試合だけです。載っていない試合を「発売前」と扱わないでください。');
  return 0;
}

process.exit(main(process.argv.slice(2)));
