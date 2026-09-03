#!/usr/bin/env node

/**
 * アウェイ戦の試合ページのHTMLから、一般発売の開始日時をCSVにする。
 *
 * 試合ページの「発売情報」には、席種 × 販売区分ごとの販売期間が入っている。
 * 取り出し口は `.info-schedule-list .item` の `.title` と `.date`。
 *
 * **拾うのは一般発売の開始日時だけ。** 相手クラブの会員先行（SOCIO、OMSなど）は
 * 京都のサポーターには使えないことが多く、駐車券は別の商品なので、いまは出さない。
 * どちらも同じ場所にあるので、必要になれば足せる。
 *
 * すでに始まっている区分は `〜09/05(土)23:59` と終了だけが出る。**開始が読めない行は
 * 取らない。** 開始日時が分かるのは「先行は開いたが一般発売はこれから」という
 * 状態の試合で、そうでなければ0件になる。それが正常。
 *
 * HTMLの取得は tools/fetch-away-sales.js が行う。ここは取得しない。
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const DEFAULT_INPUT = path.join(repoRoot, 'docs', 'sheets', 'away-tickets.current.csv');
const DEFAULT_HTML_DIR = path.join(repoRoot, 'tmp', 'away-perform');
const DEFAULT_OUTPUT = path.join(repoRoot, 'docs', 'sheets', 'away-sales.current.csv');

const COLUMNS = ['match_date', 'sale_label', 'starts_at', 'source_url', 'checked_at'];

/** 一般発売の目印。区分名の先頭に付く。クラブ名の付く先行（【FC東京】…）は拾わない。 */
const GENERAL_SALE = '一般発売';

function usage() {
  console.error('使い方: node tools/parse-away-sales.js [options]');
  console.error('  --input <csv>   対象一覧（既定: docs/sheets/away-tickets.current.csv）');
  console.error('  --html <dir>    HTMLの置き場（既定: tmp/away-perform）');
  console.error('  --out <csv>     出力先（既定: docs/sheets/away-sales.current.csv）');
  console.error('  --checked-at <日付> 確認日。省略時は今日');
  console.error('  --check         出力先と比べ、違えば終了コード1（書き換えない）');
}

function stripTags(value) {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function pad(value) {
  return String(value).padStart(2, '0');
}

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
 * `09/11(金)12:00〜` を `2026-09-11T12:00:00+09:00` にする。
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

function parsePage(html, row) {
  const flat = html.replace(/\s+/g, ' ');
  const items = flat.match(/<div class="title">(.*?)<\/div>\s*<div class="date">(.*?)<\/div>/g) || [];

  const found = [];
  items.forEach((item) => {
    const parts = item.match(/<div class="title">(.*?)<\/div>\s*<div class="date">(.*?)<\/div>/);
    if (!parts) return;
    const title = stripTags(parts[1]);
    const date = stripTags(parts[2]);

    // 区分名は `一般発売／ＱＲチケット（Ｊチケ）` の形。`／` の後ろは受取方法で、
    // 同じ販売の重複になるため落とす。
    const category = title.split('／')[0].trim();
    if (!category.startsWith(GENERAL_SALE)) return;
    // 区分名には `一般発売＜１９：３０～＞` のような公式の装飾が付くことがある。
    // 転載せず自分の言葉に揃えるため、目印の語だけを使う。

    const startsAt = toIsoStart(date, row.match_date);
    if (!startsAt) return;

    found.push({ category: GENERAL_SALE, startsAt });
  });

  if (found.length === 0) return null;

  // 受取方法違いで同じ販売が複数出る。最も早い開始を1件だけ採る。
  found.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return found[0];
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
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') { usage(); return 0; }
    if (arg === '--check') { options.check = true; continue; }
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

    const hit = parsePage(fs.readFileSync(htmlPath, 'utf8'), target);
    if (!hit) {
      withoutStart.push(`${target.match_date} ${target.opponent_raw}`);
      return;
    }

    rows.push({
      match_date: target.match_date,
      sale_label: `アウェイ席 ${hit.category} 開始`,
      starts_at: hit.startsAt,
      source_url: target.perform_url,
      checked_at: checkedAt,
    });
  });

  rows.sort((a, b) => a.match_date.localeCompare(b.match_date));
  const csv = toCsv(rows);

  if (options.check) {
    const current = fs.existsSync(options.outputPath) ? fs.readFileSync(options.outputPath, 'utf8') : '';
    // 確認日は毎回動くため、中身の比較からは外す。
    const withoutStamp = (text) => text.split('\n').map((line) => line.replace(/,[^,]*$/, '')).join('\n');
    if (withoutStamp(current) !== withoutStamp(csv)) {
      console.error(`${path.relative(repoRoot, options.outputPath)} がHTMLの内容と一致しません。`);
      console.error('  node tools/parse-away-sales.js を実行して作り直してください。');
      return 1;
    }
    console.log(`生成物OK: ${path.relative(repoRoot, options.outputPath)} はHTMLと一致しています（${rows.length}件）`);
    return 0;
  }

  fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
  fs.writeFileSync(options.outputPath, csv);

  console.log(`${path.relative(repoRoot, options.outputPath)} を書きました（${rows.length}件）`);
  rows.forEach((row) => { console.log(`  ${row.match_date} ${row.sale_label} ${row.starts_at}`); });
  if (withoutStart.length) {
    console.log(`  開始日時が読めなかった試合: ${withoutStart.length}件（すでに発売中で、終了日時しか出ていない）`);
  }
  if (missing.length) {
    console.log(`  HTMLが無い試合: ${missing.length}件（先に node tools/fetch-away-sales.js）`);
  }
  return 0;
}

process.exit(main(process.argv.slice(2)));
