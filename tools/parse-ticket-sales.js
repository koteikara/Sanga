#!/usr/bin/env node

/**
 * 公式のチケット販売スケジュール（常設・表形式）のHTMLから、販売スケジュールCSVを作る。
 *
 * 設計は docs/supporter-timeline-design.md の「情報収集アーキテクチャ」
 * 「販売段階は8つある」「チケット販売スケジュールのスナップショット」を正とする。
 * 出力の列構成は docs/sheets/ticket-sales.2026-08-28.csv と同じで、
 * ここで作ったCSVをそのまま tools/generate-calendar-events.js に渡せる。
 *
 * 取るのは日時・対象・試合との対応という事実だけで、記事本文や公式の説明文は持たない。
 * HTMLの取得は tools/fetch-ticket-sales.js が行う。ここは取得しない（同じHTMLから
 * 何度でも同じCSVが出ることを、ネットワークなしで確かめられるようにするため）。
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const DEFAULT_OUTPUT = path.join(repoRoot, 'tmp', 'ticket-sales.generated.csv');

const SOURCE_URL = 'https://www.sanga-fc.jp/ticket/schedule';

const COLUMNS = [
  'season',
  'competition',
  'round',
  'match_date_raw',
  'match_date',
  'match_date_candidates',
  'kickoff',
  'opponent',
  'entry_group',
  'sale_type',
  'sale_start',
  'official_display_status',
  'schedule_status',
  'schedule_note',
  'source_url',
  'retrieved_at_jst',
];

/**
 * 内容が変わったかを見るときに無視する列。
 *
 * `retrieved_at_jst` は取得のたびに動き、`official_display_status` は販売開始や終了で
 * 日に何度も変わる、そのときの画面表示です。どちらも販売スケジュールという事実ではないため、
 * ここだけが違う場合は「変化なし」として既存のCSVを書き換えません（`--keep-unchanged`）。
 * 毎日中身の変わらないPRが立つのを避けるためです。
 */
const VOLATILE_COLUMNS = ['official_display_status', 'retrieved_at_jst'];

/**
 * 公式表記の段階名。ここに無い段階が現れたら、勝手に取り込まず失敗させる。
 * 段階が増減したときに黙って欠けるより、気付けるほうがよい。
 */
const KNOWN_SALE_TYPES = new Set([
  'シーズンパス先行受付（ホーム指定席をご購入の方）',
  'SC最速先行販売（プラチナ）',
  'SC先々行販売（ゴールド）',
  'SC先行販売（レギュラー・キッズ）',
  '一般販売',
  'SC特典チケット引換 プラチナ',
  'SC特典チケット引換 ゴールド',
  'SC特典チケット引換 レギュラー・キッズ',
]);

/** 表の見出しから entry_group を決める。 */
const ENTRY_GROUP_BY_HEADING = {
  '受付・販売種別': 'ticket_sale',
  'SC特典チケット引換': 'sc_benefit_exchange',
};

/** 販売日程が無い試合につける理由。公式の文が無い場合に、こちらの言葉で埋める。 */
const NOTE_WITHOUT_OFFICIAL_TEXT = '公式販売スケジュールページに販売日程の記載なし';

function usage() {
  console.error('使い方: node tools/parse-ticket-sales.js <schedule.html> [output.csv] [options]');
  console.error('  --retrieved-at <日時>  取得日時（ISO 8601、+09:00）。既定は実行時刻');
  console.error('  --check                出力先の既存CSVと突き合わせ、差分があれば失敗する');
  console.error('  --keep-unchanged       既存CSVとの違いが取得日時と画面表示だけなら書き換えない');
  console.error(`出力先を省略した場合: ${DEFAULT_OUTPUT}`);
}

// --- HTMLの下ごしらえ ------------------------------------------------------

function stripTags(html) {
  return html.replace(/<[^>]*>/g, '');
}

function decodeEntities(text) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

/** タグを消し、全角空白も含めて空白を1つに畳む。 */
function textOf(html) {
  return decodeEntities(stripTags(html)).replace(/[\s　]+/g, ' ').trim();
}

// --- 日付 ------------------------------------------------------------------

/**
 * シーズン表記から年を決める。`2026/27` なら 7月以降が2026年、6月以前が2027年。
 * 公式ページは販売日程にも試合日にも年を書かないため、この規則で補う。
 */
function seasonYears(season) {
  const matched = /^(\d{4})\/(\d{2})$/.exec(season);
  if (!matched) throw new Error(`シーズン表記を読み取れません: ${season}`);
  const startYear = Number(matched[1]);
  const endYear = Number(String(startYear).slice(0, 2) + matched[2]);
  if (endYear !== startYear + 1) throw new Error(`シーズン表記が連続する2年ではありません: ${season}`);
  return { startYear, endYear };
}

function yearForMonth(month, years) {
  return month >= 7 ? years.startYear : years.endYear;
}

function isoDate(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** 実在する日付か確かめる。2月30日のような読み違いを通さないため。 */
function assertRealDate(iso, context) {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) {
    throw new Error(`存在しない日付です（${context}）: ${iso}`);
  }
}

// --- 試合見出し（dt）-------------------------------------------------------

/**
 * 見出しから、大会・節・試合日・キックオフ・対戦相手を取り出す。
 *
 * 見出しには3つの形がある。
 *   1. 日程確定: <time datetime="2026-08-22 ...">8.22 (土) 19:00</time>
 *   2. 候補日: 2.13<span class="week">(土)</span> or 2.14<span class="week">(日)</span> キックオフ未定
 *   3. 未定: <span class="date">日程未定</span>
 */
function parseHeading(dtHtml, season, years) {
  const label = /<div class="label">([\s\S]*?)<\/div>/.exec(dtHtml);
  if (!label) throw new Error('試合見出しの label が見つかりません');
  const inner = label[1];

  const roundMatch = /第(\d+)節/.exec(inner);
  if (!roundMatch) throw new Error(`節番号が見つかりません: ${textOf(inner)}`);
  const round = String(Number(roundMatch[1]));
  const competition = textOf(inner.slice(0, roundMatch.index));
  if (!competition) throw new Error(`大会名が見つかりません: ${textOf(inner)}`);

  const heading = {
    competition,
    round,
    matchDateRaw: '',
    matchDate: '',
    matchDateCandidates: '',
    kickoff: '',
    opponent: '',
  };

  // 見出しのうち、日付部分より後ろに対戦相手が置かれている。
  const timeMatch = /<time[^>]*datetime="(\d{4})-(\d{2})-(\d{2})[^"]*"[^>]*>([\s\S]*?)<\/time>/.exec(inner);
  const candidateRegex = /(\d{1,2})\.(\d{1,2})\s*<span class="week">\(([^)]*)\)<\/span>/g;
  const candidates = [...inner.matchAll(candidateRegex)];
  const undecided = /<span class="date">\s*日程未定\s*<\/span>/.exec(inner);

  let afterDate;
  if (timeMatch) {
    const timeText = textOf(timeMatch[4]);
    const kickoff = /(\d{1,2}:\d{2})\s*$/.exec(timeText);
    heading.kickoff = kickoff ? kickoff[1] : '';
    heading.matchDateRaw = kickoff ? timeText.slice(0, kickoff.index).trim() : timeText;
    heading.matchDate = `${timeMatch[1]}-${timeMatch[2]}-${timeMatch[3]}`;
    assertRealDate(heading.matchDate, `第${round}節の試合日`);
    afterDate = inner.slice(timeMatch.index + timeMatch[0].length);
  } else if (candidates.length > 0) {
    const parts = candidates.map((candidate) => {
      const month = Number(candidate[1]);
      const day = Number(candidate[2]);
      const iso = isoDate(yearForMonth(month, years), month, day);
      assertRealDate(iso, `第${round}節の候補日`);
      return { raw: `${month}.${day}(${candidate[3]})`, iso };
    });
    heading.matchDateRaw = parts.map((part) => part.raw).join(' or ');
    heading.matchDateCandidates = parts.map((part) => part.iso).join('|');
    const last = candidates[candidates.length - 1];
    afterDate = inner.slice(last.index + last[0].length);
  } else if (undecided) {
    heading.matchDateRaw = '日程未定';
    afterDate = inner.slice(undecided.index + undecided[0].length);
  } else {
    throw new Error(`試合日を読み取れません: ${textOf(inner)}`);
  }

  heading.opponent = textOf(afterDate).replace(/^キックオフ未定\s*/, '').trim();
  if (!heading.opponent) throw new Error(`対戦相手が見つかりません: ${textOf(inner)}`);
  return heading;
}

// --- 販売表（dd）-----------------------------------------------------------

/** 「7月25日(土)　11:00～」を ISO 8601 の日時にする。 */
function parseSaleStart(cellText, years, context) {
  const matched = /(\d{1,2})月(\d{1,2})日\s*\([^)]*\)\s*(\d{1,2}):(\d{2})/.exec(cellText);
  if (!matched) throw new Error(`販売開始日時を読み取れません（${context}）: ${cellText}`);
  const month = Number(matched[1]);
  const day = Number(matched[2]);
  const iso = isoDate(yearForMonth(month, years), month, day);
  assertRealDate(iso, context);
  return `${iso}T${matched[3].padStart(2, '0')}:${matched[4]}:00+09:00`;
}

/** 表の1行から、段階名・公式の状態表示・開始日時を取り出す。 */
function parseSaleRow(rowHtml, entryGroup, years, context) {
  const cells = [...rowHtml.matchAll(/<t([hd])[^>]*>([\s\S]*?)<\/t\1>/g)];
  if (cells.length < 2) throw new Error(`販売表の行を読み取れません（${context}）`);

  const headCell = cells[0][2];
  const statusMatch = /<span class="onsale">([\s\S]*?)<\/span>/.exec(headCell);
  const officialDisplayStatus = statusMatch ? textOf(statusMatch[1]) : '';
  const saleType = textOf(headCell.replace(/<span class="onsale">[\s\S]*?<\/span>/g, ''));
  if (!KNOWN_SALE_TYPES.has(saleType)) {
    throw new Error(`未知の販売種別です（${context}）: ${saleType}`);
  }

  return {
    entryGroup,
    saleType,
    saleStart: parseSaleStart(textOf(cells[1][2]), years, `${context} / ${saleType}`),
    officialDisplayStatus,
  };
}

/** 試合1件分の販売表をすべて読む。表が無ければ空配列を返す（未掲載）。 */
function parseSaleTables(ddHtml, years, context) {
  const sales = [];
  for (const table of ddHtml.matchAll(/<table class="schedule__list__table">([\s\S]*?)<\/table>/g)) {
    const body = table[1];
    const headingCell = /<thead>[\s\S]*?<th[^>]*>([\s\S]*?)<\/th>/.exec(body);
    const heading = headingCell ? textOf(headingCell[1]) : '';
    const entryGroup = ENTRY_GROUP_BY_HEADING[heading];
    if (!entryGroup) throw new Error(`未知の表見出しです（${context}）: ${heading}`);

    const tbody = /<tbody>([\s\S]*?)<\/tbody>/.exec(body);
    if (!tbody) throw new Error(`販売表の tbody が見つかりません（${context}）`);
    for (const row of tbody[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
      sales.push(parseSaleRow(row[1], entryGroup, years, context));
    }
  }
  return sales;
}

/** 未掲載の理由。公式の一文があればそれを使い、末尾の丁寧表現だけ落とす。 */
function parseScheduleNote(ddHtml) {
  const paragraph = /<p[^>]*>([\s\S]*?)<\/p>/.exec(ddHtml);
  const text = paragraph ? textOf(paragraph[1]) : '';
  if (!text) return NOTE_WITHOUT_OFFICIAL_TEXT;
  return text.replace(/いたします。$/, '').replace(/。$/, '');
}

// --- 組み立て --------------------------------------------------------------

function parseSchedule(html, options) {
  const seasonMatch = /<h2>\s*(\d{4}\/\d{2})シーズン/.exec(html);
  if (!seasonMatch) throw new Error('シーズン表記（<h2>）が見つかりません。ページ構成が変わった可能性があります');
  const season = seasonMatch[1];
  const years = seasonYears(season);

  const list = /<dl class="schedule__list">([\s\S]*?)<\/dl>/.exec(html);
  if (!list) throw new Error('販売スケジュール（dl.schedule__list）が見つかりません。ページ構成が変わった可能性があります');

  const blocks = [...list[1].matchAll(/<dt class="[^"]*"[^>]*>([\s\S]*?)<\/dt>\s*<dd class="aco_box"[^>]*>([\s\S]*?)<\/dd>/g)];
  if (blocks.length === 0) throw new Error('試合ブロック（dt/dd）が1件も見つかりません');

  const rows = [];
  for (const block of blocks) {
    const heading = parseHeading(block[0], season, years);
    const context = `第${heading.round}節`;
    const sales = parseSaleTables(block[2], years, context);

    const base = {
      season,
      competition: heading.competition,
      round: heading.round,
      match_date_raw: heading.matchDateRaw,
      match_date: heading.matchDate,
      match_date_candidates: heading.matchDateCandidates,
      kickoff: heading.kickoff,
      opponent: heading.opponent,
      source_url: SOURCE_URL,
      retrieved_at_jst: options.retrievedAt,
    };

    if (sales.length === 0) {
      rows.push({
        ...base,
        entry_group: '',
        sale_type: '',
        sale_start: '',
        official_display_status: '',
        schedule_status: '未掲載',
        schedule_note: parseScheduleNote(block[2]),
      });
      continue;
    }

    for (const sale of sales) {
      rows.push({
        ...base,
        entry_group: sale.entryGroup,
        sale_type: sale.saleType,
        sale_start: sale.saleStart,
        official_display_status: sale.officialDisplayStatus,
        schedule_status: '掲載済み',
        schedule_note: '',
      });
    }
  }
  return { season, rows, matchCount: blocks.length };
}

// --- CSV -------------------------------------------------------------------

/** RFC 4180 の最小限の読み取り。既存CSVとの突き合わせにだけ使う。 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char !== '"') { cell += char; continue; }
      if (text[i + 1] === '"') { cell += '"'; i += 1; continue; }
      quoted = false;
      continue;
    }
    if (char === '"') { quoted = true; continue; }
    if (char === ',') { row.push(cell); cell = ''; continue; }
    if (char === '\r') continue;
    if (char === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue; }
    cell += char;
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  return rows.filter((cells) => cells.some((value) => value !== ''));
}

/** 移ろう列を除いた中身。これが同じなら「変化なし」とみなす。 */
function comparableRows(csvText) {
  const rows = parseCsv(csvText.replace(/^\uFEFF/, ''));
  if (rows.length === 0) return null;
  const header = rows[0];
  const keep = header
    .map((name, index) => (VOLATILE_COLUMNS.includes(name) ? -1 : index))
    .filter((index) => index >= 0);
  return JSON.stringify(rows.map((cells) => keep.map((index) => cells[index] ?? '')));
}

/** 行を見分ける鍵。1試合の中で段階名は重複しない。 */
function rowKey(row) {
  return [row.round, row.entry_group, row.sale_type].join('\u0000');
}

/** 行の見出し。変更報告を読む人が、どの試合のどの段階か分かるように。 */
function rowLabel(row) {
  const match = `第${row.round}節 ${row.opponent}`;
  return row.sale_type ? `${match} / ${row.sale_type}` : match;
}

/** CSVを列名つきの行に変換する。 */
function rowsWithNames(csvText) {
  const rows = parseCsv(csvText.replace(/^\uFEFF/, ''));
  if (rows.length === 0) return [];
  const header = rows[0];
  return rows.slice(1).map((cells) => {
    const row = {};
    header.forEach((name, index) => { row[name] = cells[index] ?? ''; });
    return row;
  });
}

/**
 * 既存CSVと新しいCSVの違いを、人が読める形で並べる。
 *
 * `retrieved_at_jst` は全行で動くため、そのままdiffを取ると124行すべてが
 * 書き換わったように見えて、何が変わったのか読めない。移ろう列を除いて突き合わせ、
 * 変わった値だけを挙げる。
 */
function describeChanges(existingCsv, newCsv) {
  const before = new Map(rowsWithNames(existingCsv).map((row) => [rowKey(row), row]));
  const after = new Map(rowsWithNames(newCsv).map((row) => [rowKey(row), row]));
  const compared = COLUMNS.filter((column) => !VOLATILE_COLUMNS.includes(column));
  const lines = [];

  for (const [key, row] of after) {
    const previous = before.get(key);
    if (!previous) { lines.push(`追加: ${rowLabel(row)}（${row.sale_start || row.schedule_status}）`); continue; }
    for (const column of compared) {
      if (previous[column] !== row[column]) {
        lines.push(`変更: ${rowLabel(row)} / ${column}: ${previous[column] || '(空)'} → ${row[column] || '(空)'}`);
      }
    }
  }
  for (const [key, row] of before) {
    if (!after.has(key)) lines.push(`削除: ${rowLabel(row)}（${row.sale_start || row.schedule_status}）`);
  }
  return lines;
}

function csvCell(value) {
  const text = value === undefined || value === null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** 既存のスナップショットに合わせ、BOM付きUTF-8・CRLF・末尾改行で書き出す。 */
function toCsv(rows) {
  const lines = [COLUMNS.join(',')];
  for (const row of rows) {
    lines.push(COLUMNS.map((column) => csvCell(row[column])).join(','));
  }
  return '\uFEFF' + lines.map((line) => line + '\r\n').join('');
}

// --- 入口 ------------------------------------------------------------------

/** 実行時刻を JST の ISO 8601 にする。CSVの retrieved_at_jst は +09:00 固定のため。 */
function nowInJst() {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${jst.toISOString().slice(0, 19)}+09:00`;
}

function main(argv) {
  const options = { htmlPath: null, outputPath: null, retrievedAt: null, check: false, keepUnchanged: false };
  const positional = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') { usage(); return 0; }
    if (arg === '--check') { options.check = true; continue; }
    if (arg === '--keep-unchanged') { options.keepUnchanged = true; continue; }
    if (arg === '--retrieved-at') { options.retrievedAt = argv[i += 1]; continue; }
    if (arg.startsWith('--')) { console.error(`不明なオプション: ${arg}`); usage(); return 1; }
    positional.push(arg);
  }

  if (positional.length === 0 || positional.length > 2) { usage(); return 1; }
  options.htmlPath = path.resolve(positional[0]);
  options.outputPath = positional[1] ? path.resolve(positional[1]) : DEFAULT_OUTPUT;
  if (!options.retrievedAt) options.retrievedAt = nowInJst();

  let result;
  try {
    const html = fs.readFileSync(options.htmlPath, 'utf8');
    result = parseSchedule(html, options);
  } catch (error) {
    console.error(`解析に失敗しました: ${error.message}`);
    return 1;
  }

  const csv = toCsv(result.rows);

  if (options.check) {
    if (!fs.existsSync(options.outputPath)) {
      console.error(`突き合わせ先がありません: ${options.outputPath}`);
      return 1;
    }
    const existing = fs.readFileSync(options.outputPath, 'utf8');
    if (existing !== csv) {
      console.error(`CSVが最新ではありません: ${path.relative(repoRoot, options.outputPath)}`);
      console.error('  node tools/parse-ticket-sales.js <html> <csv> で作り直してください。');
      return 1;
    }
    console.log(`OK: ${path.relative(repoRoot, options.outputPath)} は最新です（${result.rows.length}行）`);
    return 0;
  }

  const existing = fs.existsSync(options.outputPath) ? fs.readFileSync(options.outputPath, 'utf8') : null;

  if (options.keepUnchanged && existing !== null && comparableRows(existing) === comparableRows(csv)) {
    console.log(`変化なし: ${path.relative(repoRoot, options.outputPath)} は書き換えていません`);
    console.log(`  違いは${VOLATILE_COLUMNS.join(' と ')}だけでした（試合${result.matchCount}件・${result.rows.length}行）`);
    return 0;
  }

  fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
  fs.writeFileSync(options.outputPath, csv);
  console.log(`${path.relative(repoRoot, options.outputPath)} を書き出しました`);
  console.log(`  シーズン: ${result.season} / 試合: ${result.matchCount}件 / 行: ${result.rows.length}`);

  // retrieved_at_jst は全行で動くため、diffだけでは何が変わったか読めない。
  if (existing !== null) {
    const changes = describeChanges(existing, csv);
    console.log(changes.length === 0 ? '  内容の変更なし（取得日時と画面表示のみ）' : `  内容の変更 ${changes.length}件:`);
    for (const line of changes) console.log(`    ${line}`);
  }
  return 0;
}

process.exit(main(process.argv.slice(2)));
