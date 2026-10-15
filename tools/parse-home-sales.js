#!/usr/bin/env node

/**
 * ホーム戦の試合ページ（Jリーグチケット）のHTMLから、販売区分ごとの開始日時をCSVにする。
 *
 * 公式サイトの販売スケジュール（tools/fetch-ticket-sales.js）は、2026-10 に表が画像に
 * なってから更新できなくなった。その代わりに、同じ販売をJリーグチケットの試合ページから読む。
 * 設計は docs/supporter-timeline-design.md の「ホーム戦の販売日時をJリーグチケットで補う」。
 *
 * 試合ページの「発売情報」には、席種 × 販売区分 × 受取方法ごとの販売期間が入っている。
 * 取り出し口は `.info-schedule-list .item` の `.title` と `.date`（アウェイと同じ）。
 * 区分名は公式の販売スケジュールの `sale_type` に読み替えて出す。読み替えられない区分
 * （駐車券、企画チケットなど）は出さない。
 *
 * すでに始まっている区分は `〜10/31(土)15:10` と終了だけが出る。**開始が読めない区分は
 * 取らない。** そのため、これから始まる区分だけが行になる。0件も正常。
 *
 * HTMLの取得は tools/fetch-away-sales.js（--input docs/sheets/home-tickets.current.csv）が行う。
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const DEFAULT_INPUT = path.join(repoRoot, 'docs', 'sheets', 'home-tickets.current.csv');
const DEFAULT_HTML_DIR = path.join(repoRoot, 'tmp', 'home-perform');
const DEFAULT_OUTPUT = path.join(repoRoot, 'docs', 'sheets', 'home-sales.current.csv');

const COLUMNS = ['match_date', 'sale_type', 'starts_at', 'source_url', 'checked_at'];

/**
 * Jリーグチケットの区分名（NFKCで半角にした先頭）→ 公式の販売スケジュールの `sale_type`。
 * 先に長いものから比べる（`SC先々行` を `SC先行` と取り違えない）。
 * 区分名に付く会員種別や公式の装飾は転載せず、公式の段階名にそろえる。
 */
const CATEGORY_MAP = [
  ['SC最速先行販売', 'SC最速先行販売（プラチナ）'],
  ['SC先々行販売', 'SC先々行販売（ゴールド）'],
  ['SC先行販売', 'SC先行販売（レギュラー・キッズ）'],
  ['シーズンパス先行受付', 'シーズンパス先行受付（ホーム指定席をご購入の方）'],
  ['シーズンパス先行販売', 'シーズンパス先行販売'],
  ['一般発売', '一般販売'],
];

function usage() {
  console.error('使い方: node tools/parse-home-sales.js [options]');
  console.error('  --input <csv>   対象一覧（既定: docs/sheets/home-tickets.current.csv）');
  console.error('  --html <dir>    HTMLの置き場（既定: tmp/home-perform）');
  console.error('  --out <csv>     出力先（既定: docs/sheets/home-sales.current.csv）');
  console.error('  --checked-at <日付> 確認日。省略時は今日');
  console.error('  --keep-unchanged 違いが確認日だけなら書き換えない');
  console.error('  --check         出力先と比べ、違えば終了コード1（書き換えない）');
}

function stripTags(value) {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function pad(value) {
  return String(value).padStart(2, '0');
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

function performId(url) {
  const found = url.match(/\/sales\/perform\/(\d+)\/(\d+)/);
  return found ? `${found[1]}-${found[2]}` : '';
}

/**
 * `10/26(月)12:00〜` を `2026-10-26T12:00:00+09:00` にする。
 * 年はページに無いので、試合日を基準にする。販売は試合より前なので、
 * 月が試合月より大きければ前年と読む（12月開始・1月開催のような場合）。
 */
function toIsoStart(dateText, matchDate) {
  const found = dateText.match(/^(\d{1,2})\/(\d{1,2})\([^)]*\)(\d{1,2}):(\d{2})〜/);
  if (!found) return '';
  const [, month, day, hour, minute] = found.map(Number);

  const matchParts = String(matchDate).split('-');
  if (matchParts.length !== 3) return '';
  const matchYear = Number(matchParts[0]);
  const matchMonth = Number(matchParts[1]);
  const year = month > matchMonth ? matchYear - 1 : matchYear;

  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00+09:00`;
}

function saleTypeOf(title) {
  // 区分名は `ＳＣ先行販売【レギュラークルー・キッズクルー】／ＱＲチケット（Ｊチケ）` の形。
  // `／` の後ろは受取方法で、同じ販売の重複になるため落とす。
  const category = title.normalize('NFKC').split('/')[0].trim();
  const hit = CATEGORY_MAP.find(([prefix]) => category.startsWith(prefix));
  return hit ? hit[1] : null;
}

/** 区分ごとに、席種・受取方法をまたいで最も早い開始を1件だけ採る。 */
function parsePage(html, row) {
  const flat = html.replace(/\s+/g, ' ');
  const items = flat.match(/<div class="title">(.*?)<\/div>\s*<div class="date">(.*?)<\/div>/g) || [];

  const earliest = new Map();
  items.forEach((item) => {
    const parts = item.match(/<div class="title">(.*?)<\/div>\s*<div class="date">(.*?)<\/div>/);
    if (!parts) return;
    const saleType = saleTypeOf(stripTags(parts[1]));
    if (!saleType) return;
    const startsAt = toIsoStart(stripTags(parts[2]), row.match_date);
    if (!startsAt) return;
    const known = earliest.get(saleType);
    if (!known || startsAt < known) earliest.set(saleType, startsAt);
  });

  return Array.from(earliest, ([saleType, startsAt]) => ({ saleType, startsAt }));
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

/** 確認日は毎回動く。ここだけが違う場合に書き換えると、中身の変わらないPRが毎日立つ。 */
const VOLATILE_COLUMNS = ['checked_at'];

function comparableCsv(text) {
  const lines = text.replace(/^﻿/, '').split('\n').filter((line) => line.trim() !== '');
  if (lines.length === 0) return null;
  const header = lines[0].split(',');
  const keep = header
    .map((name, index) => (VOLATILE_COLUMNS.includes(name.trim()) ? -1 : index))
    .filter((index) => index >= 0);
  return JSON.stringify(lines.map((line) => {
    const cells = line.split(',');
    return keep.map((index) => cells[index] ?? '');
  }));
}

function todayStamp() {
  const jst = new Date(Date.now() + 9 * 3600000);
  return `${jst.getUTCFullYear()}-${pad(jst.getUTCMonth() + 1)}-${pad(jst.getUTCDate())}`;
}

function main(argv) {
  const options = {
    inputPath: DEFAULT_INPUT,
    htmlDir: DEFAULT_HTML_DIR,
    outputPath: DEFAULT_OUTPUT,
    checkedAt: '',
    check: false,
    keepUnchanged: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') { usage(); return 0; }
    if (arg === '--check') { options.check = true; continue; }
    if (arg === '--keep-unchanged') { options.keepUnchanged = true; continue; }
    if (arg === '--input') { options.inputPath = path.resolve(argv[i += 1]); continue; }
    if (arg === '--html') { options.htmlDir = path.resolve(argv[i += 1]); continue; }
    if (arg === '--out') { options.outputPath = path.resolve(argv[i += 1]); continue; }
    if (arg === '--checked-at') { options.checkedAt = argv[i += 1]; continue; }
    console.error(`不明なオプション: ${arg}`); usage(); return 1;
  }

  const checkedAt = options.checkedAt || todayStamp();

  let targets;
  try {
    targets = readRows(options.inputPath).filter((row) => row.perform_url);
  } catch (error) {
    console.error(`一覧を読めません: ${error.message}`);
    return 1;
  }

  const rows = [];
  const missing = [];
  const withoutStart = [];

  targets.forEach((target) => {
    const id = performId(target.perform_url);
    const htmlPath = path.join(options.htmlDir, `${id}.html`);
    if (!id || !fs.existsSync(htmlPath)) {
      missing.push(`${target.match_date} ${target.opponent_raw}`);
      return;
    }

    const hits = parsePage(fs.readFileSync(htmlPath, 'utf8'), target);
    if (hits.length === 0) {
      withoutStart.push(`${target.match_date} ${target.opponent_raw}`);
      return;
    }

    hits.forEach((hit) => {
      rows.push({
        match_date: target.match_date,
        sale_type: hit.saleType,
        starts_at: hit.startsAt,
        source_url: target.perform_url,
        checked_at: checkedAt,
      });
    });
  });

  rows.sort((a, b) => (a.match_date === b.match_date
    ? a.starts_at.localeCompare(b.starts_at) || a.sale_type.localeCompare(b.sale_type)
    : a.match_date.localeCompare(b.match_date)));
  const csv = toCsv(rows);

  const existing = fs.existsSync(options.outputPath) ? fs.readFileSync(options.outputPath, 'utf8') : null;

  if (options.check) {
    const current = existing || '';
    // 確認日は毎回動くため、中身の比較からは外す。
    if (comparableCsv(current) !== comparableCsv(csv)) {
      console.error(`${path.relative(repoRoot, options.outputPath)} がHTMLの内容と一致しません。`);
      console.error('  node tools/parse-home-sales.js を実行して作り直してください。');
      return 1;
    }
    console.log(`生成物OK: ${path.relative(repoRoot, options.outputPath)} はHTMLと一致しています（${rows.length}件）`);
    return 0;
  }

  if (options.keepUnchanged && existing !== null && comparableCsv(existing) === comparableCsv(csv)) {
    console.log(`変化なし: ${path.relative(repoRoot, options.outputPath)} は書き換えていません`);
    console.log(`  違いは確認日だけでした（${rows.length}件）`);
    return 0;
  }

  fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
  fs.writeFileSync(options.outputPath, csv);

  console.log(`${path.relative(repoRoot, options.outputPath)} を書きました（${rows.length}件）`);
  rows.forEach((row) => { console.log(`  ${row.match_date} ${row.sale_type} ${row.starts_at}`); });
  if (withoutStart.length) {
    console.log(`  これから始まる区分が無い試合: ${withoutStart.length}件（すべて発売中で、終了日時しか出ていない）`);
  }
  if (missing.length) {
    console.log(`  HTMLが無い試合: ${missing.length}件（先に node tools/fetch-away-sales.js --input ${path.relative(repoRoot, options.inputPath)} --out ${path.relative(repoRoot, options.htmlDir)}）`);
  }
  return 0;
}

process.exit(main(process.argv.slice(2)));
