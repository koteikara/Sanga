#!/usr/bin/env node

/**
 * 記事の本文から日時を読み、CSVにする。
 *
 * 設計は docs/supporter-timeline-design.md の「イベント・配布・物販の取り込み」を正とする。
 *
 * ## 分類してから読む
 *
 * 全記事に1つの規則を当てると、時刻を含む行の3分の2が雑音だった（2026-09-11 実測）。
 * **先に記事を分類すると、種類ごとに読み方が決まる。** 手元の9本では8本から読めた。
 *
 * | 規則 | いつ効くか | 何を出すか |
 * | --- | --- | --- |
 * | タイムスケジュール | 「タイムスケジュール」の見出しがある | 入場開始・場外ブース開始など |
 * | 当日券 | 種類が「当日券」 | 当日券の発売 |
 * | 物販ブース | 種類が「グッズの発売」 | ブースの営業開始 |
 * | 応募の締切 | 種類が「応募・抽選」 | 応募の締切 |
 *
 * タイムスケジュールだけは種類で絞らない。**見出しという構造が手掛かり**なので、
 * 記事の分類より確かだから。実際、その記事は題からは「交通・駐車」に分類された。
 *
 * ## 出さないほうを厚く決める
 *
 * - キックオフと試合終了は matches.json に持っている。二重に出さない
 * - 事務局や店舗の営業時間、駅の発着は落とす。語彙が閉じていて増えない
 * - 意味の分からない行は捨てる。時刻だけあっても役に立たない
 *
 * **本文とタイトルは保存も転載もしない。** 出すのは日時と、こちらの語彙のラベルだけ。
 */

const fs = require('fs');
const path = require('path');
const { EXTRACTABLE_KINDS, labelOfTimetableItem, placeOfTicket } = require('./news-kinds.js');

const repoRoot = path.resolve(__dirname, '..');
const DEFAULT_NEWS = path.join(repoRoot, 'docs', 'sheets', 'news.current.csv');
const DEFAULT_ARTICLES = path.join(repoRoot, 'tmp', 'news-articles');
const DEFAULT_MATCHES = path.join(repoRoot, 'public', 'data', 'matches.json');
const DEFAULT_OUTPUT = path.join(repoRoot, 'docs', 'sheets', 'news-times.current.csv');

const HEADER = 'event_id,article_id,match_id,kind,label,starts_at,source_url,retrieved_at_jst';

/**
 * 落とす行。**語彙が閉じていて、これ以上増えない。**
 * 事務局・店舗・電話窓口の営業時間と、列車の発着。どれも予定ではない。
 */
const DENY = /平日|月[〜～~]金|火[〜～~]金|営業|TEL|お電話番号|年末年始|祝日除|駅発|駅着|特急|号車/;

const TIME = /(\d{1,2})[:：](\d{2})/;

function usage() {
  console.error('使い方: node tools/parse-news-times.js [出力CSV] [options]');
  console.error('  --check                  書き換えず、既存CSVと一致するかだけ確かめる');
  console.error('  --keep-unchanged         違いが取得日時だけなら書き換えない');
  console.error('  --news <csv>             一覧のCSV（既定: docs/sheets/news.current.csv）');
  console.error('  --articles <dir>         記事本文（既定: tmp/news-articles）');
  console.error('  --matches <path>         試合データ（既定: public/data/matches.json）');
  console.error('  --retrieved-at <ISO8601> 取得日時（既定: 実行時刻）');
  console.error(`出力を省略した場合: ${DEFAULT_OUTPUT}`);
}

function pad(n) { return String(n).padStart(2, '0'); }

function jstStamp(date) {
  const jst = new Date(date.getTime() + 9 * 3600000);
  return `${jst.getUTCFullYear()}-${pad(jst.getUTCMonth() + 1)}-${pad(jst.getUTCDate())}`
    + `T${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}:${pad(jst.getUTCSeconds())}+09:00`;
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

/** HTMLから本文の行を取り出す。関連ニュース以降は別の記事の題なので捨てる。 */
function bodyLines(html) {
  let text = html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<head[\s\S]*?<\/head>/g, ' ')
    .replace(/<header[\s\S]*?<\/header>/g, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/g, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/g, ' ');
  const start = text.indexOf('<main');
  if (start >= 0) {
    const end = text.indexOf('</main>', start);
    text = text.slice(start, end < 0 ? undefined : end);
  }
  text = text
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6]|dt|dd|table)>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  const lines = text.split('\n').map((line) => line.replace(/[ \t　]+/g, ' ').trim()).filter(Boolean);
  const cut = lines.findIndex((line) => line === '関連ニュース');
  return cut > 0 ? lines.slice(0, cut) : lines;
}

/** `HH:MM` を試合日と組んで絶対時刻にする。25:00 のような表記は翌日に送る。 */
function atMatchDate(matchDate, hour, minute) {
  let day = matchDate;
  let h = hour;
  if (h >= 24) {
    h -= 24;
    const next = new Date(`${matchDate}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    day = next.toISOString().slice(0, 10);
  }
  if (h > 23 || minute > 59) return '';
  return `${day}T${pad(h)}:${pad(minute)}:00+09:00`;
}

/**
 * 当日のタイムスケジュールを読む。
 *
 * 「タイムスケジュール」の見出しの下に `HH:MM～ 説明` が並ぶ。説明を語彙に直せない行は
 * 捨てる。見出しから離れて時刻の無い行が2つ続いたら、表が終わったと見なす。
 */
function readTimetable(lines, match) {
  const found = [];
  let inside = false;
  let quiet = 0;
  lines.forEach((line) => {
    // 表の見出しは何度でも入口になる。**題にも「タイムスケジュール」が入る**ため、
    // 題で入ってしまってから本当の見出しに着く前に抜けることがある。
    const isHeading = /タイムスケジュール|当日のスケジュール/.test(line) && line.length < 40;
    if (isHeading) { inside = true; quiet = 0; return; }
    if (!inside) return;
    const m = line.match(/^(\d{1,2})[:：](\d{2})\s*[〜～]?\s*(.*)$/);
    if (!m) {
      quiet += 1;
      if (quiet >= 2) inside = false;
      return;
    }
    quiet = 0;
    if (DENY.test(line)) return;
    const label = labelOfTimetableItem(m[3]);
    if (!label) return; // キックオフ・試合終了・意味の分からない行
    const startsAt = atMatchDate(match.match_date, Number(m[1]), Number(m[2]));
    if (startsAt) found.push({ kind: '当日の流れ', label, starts_at: startsAt });
  });
  return found;
}

/**
 * 当日券。「試合当日 HH:MM〜」の形だけを採る。
 *
 * **どこで買えるかを必ず添える。** 1つの記事にオンラインと窓口が並び、実測では
 * 11時間ずれていた。場所が分からないと、開いていない窓口へ行くことになる。
 *
 * 記事は「売り場 → 販売時間 → 時刻」の順に並ぶので、**直前に出た売り場を使い、
 * 使ったら忘れる。** 手前へ何行か遡る作りだと、間に関係のない行があっても
 * 前の売り場を拾ってしまう。売り場が分からない時刻は採らない。
 */
function readSameDayTicket(lines, match) {
  const found = [];
  let place = null;
  lines.forEach((line) => {
    const seen = placeOfTicket(line);
    if (seen) { place = seen; return; }
    if (DENY.test(line)) return;
    const m = line.match(/試合当日\s*(\d{1,2})[:：]?(\d{2})?\s*(?:時)?\s*(頃)?\s*[〜～]/);
    if (!m) return;
    if (!place) return;
    const startsAt = atMatchDate(match.match_date, Number(m[1]), Number(m[2] || 0));
    if (!startsAt) { place = null; return; }
    const rough = m[3] ? '・時刻は目安' : '';
    found.push({ kind: '当日券', label: `当日券の発売（${place}${rough}）`, starts_at: startsAt });
    place = null;
  });
  return found;
}

/** 物販ブース。「（HH:MM〜HH:MM）」の開きの時刻だけを採る。 */
function readBooth(lines, match) {
  const found = [];
  lines.forEach((line) => {
    if (DENY.test(line)) return;
    const m = line.match(/[（(]\s*(\d{1,2})[:：](\d{2})\s*[〜～]\s*\d{1,2}[:：]\d{2}\s*[）)]/);
    if (!m) return;
    const startsAt = atMatchDate(match.match_date, Number(m[1]), Number(m[2]));
    if (startsAt) found.push({ kind: '物販ブース', label: 'グッズ販売開始', starts_at: startsAt });
  });
  return found;
}

/**
 * 応募の締切。
 *
 * **年が書かれていない。** 記事の公開日を起点にし、月日がそれより前なら翌年と見なす。
 * 「本日」は公開日そのもの。読めなければ出さない。
 */
function readEntryDeadline(lines, publishedOn) {
  const found = [];
  const [year] = publishedOn.split('-').map(Number);
  lines.forEach((line) => {
    if (DENY.test(line)) return;
    if (!/(まで|締切|締め切り)/.test(line) && !/[〜～]/.test(line)) return;
    if (!TIME.test(line)) return;
    // 「〜9/10(木)12:00」「9月17日(木)15:00まで」のように、締切側は行の後ろに来る
    const m = line.match(/(\d{1,2})[\/月](\d{1,2})日?\s*(?:\([日月火水木金土]\))?\s*(\d{1,2})[:：](\d{2})(?![\s\S]*\d{1,2}[\/月]\d{1,2})/);
    if (!m) return;
    let y = year;
    const monthDay = `${pad(m[1])}-${pad(m[2])}`;
    if (monthDay < publishedOn.slice(5)) y += 1; // 年をまたぐ締切
    const hour = Number(m[3]);
    if (hour > 23 || Number(m[4]) > 59) return;
    found.push({
      kind: '応募の締切',
      label: '応募の締切',
      starts_at: `${y}-${monthDay}T${pad(hour)}:${pad(m[4])}:00+09:00`,
    });
  });
  return found;
}

function extract(article, match, lines) {
  let found = readTimetable(lines, match);
  if (article.kind === '当日券') found = found.concat(readSameDayTicket(lines, match));
  if (article.kind === 'グッズの発売') found = found.concat(readBooth(lines, match));
  if (article.kind === '応募・抽選') found = found.concat(readEntryDeadline(lines, article.published_on));
  return found;
}

function build(options) {
  const articles = readRows(options.newsPath);
  const matches = readMatches(options.matchesPath);
  const rows = [];
  const seen = new Set();
  let read = 0;

  articles.forEach((article) => {
    const file = path.join(options.articlesDir, `${article.article_id}.html`);
    if (!fs.existsSync(file)) return;
    const ids = (article.match_ids || '').split(' ').filter(Boolean);
    if (!ids.length) return;
    // タイムスケジュールは種類で絞らない。見出しという構造のほうが確かだから。
    if (article.kind && !EXTRACTABLE_KINDS.has(article.kind) && !/タイムスケジュール/.test(fs.readFileSync(file, 'utf8'))) return;
    read += 1;

    const lines = bodyLines(fs.readFileSync(file, 'utf8'));
    ids.forEach((matchId) => {
      const match = matches.get(matchId);
      if (!match || !match.match_date) return;
      extract(article, match, lines).forEach((item) => {
        // 同じ記事の同じ時刻は1つにする。販売場所と受取場所で同じ時間が2度書かれる例がある。
        const stamp = item.starts_at.slice(11, 16).replace(':', '');
        let id = `news-${article.article_id}-${matchId}-${stamp}`;
        if (seen.has(id)) return;
        seen.add(id);
        rows.push({
          event_id: id,
          article_id: article.article_id,
          match_id: matchId,
          kind: item.kind,
          label: item.label,
          starts_at: item.starts_at,
          source_url: article.source_url,
        });
      });
    });
  });

  rows.sort((a, b) => (a.starts_at === b.starts_at
    ? (a.event_id < b.event_id ? -1 : 1)
    : (a.starts_at < b.starts_at ? -1 : 1)));
  return { rows, read };
}

function toCsv(rows, retrievedAt) {
  const lines = [HEADER];
  rows.forEach((row) => {
    lines.push([
      row.event_id, row.article_id, row.match_id, row.kind,
      row.label, row.starts_at, row.source_url, retrievedAt,
    ].join(','));
  });
  return `${lines.join('\n')}\n`;
}

function comparableCsv(csv) {
  return csv.split('\n').map((line) => line.replace(/,[^,]*$/, '')).join('\n');
}

function main(argv) {
  const options = {
    newsPath: DEFAULT_NEWS, articlesDir: DEFAULT_ARTICLES, matchesPath: DEFAULT_MATCHES,
    retrievedAt: null, check: false, keepUnchanged: false,
  };
  const positional = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') { usage(); return 0; }
    if (arg === '--check') { options.check = true; continue; }
    if (arg === '--keep-unchanged') { options.keepUnchanged = true; continue; }
    if (arg === '--news') { options.newsPath = path.resolve(argv[i += 1]); continue; }
    if (arg === '--articles') { options.articlesDir = path.resolve(argv[i += 1]); continue; }
    if (arg === '--matches') { options.matchesPath = path.resolve(argv[i += 1]); continue; }
    if (arg === '--retrieved-at') { options.retrievedAt = argv[i += 1]; continue; }
    if (arg.startsWith('--')) { console.error(`不明なオプション: ${arg}`); usage(); return 1; }
    positional.push(arg);
  }

  if (positional.length > 1) { usage(); return 1; }
  const outputPath = positional[0] ? path.resolve(positional[0]) : DEFAULT_OUTPUT;
  const retrievedAt = options.retrievedAt || jstStamp(new Date());

  let built;
  try {
    built = build(options);
  } catch (error) {
    console.error(`解析できません: ${error.message}`);
    return 1;
  }

  const csv = toCsv(built.rows, retrievedAt);
  const existing = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : null;

  if (options.check) {
    if (existing === null) { console.error(`比べる相手がありません: ${path.relative(repoRoot, outputPath)}`); return 1; }
    if (comparableCsv(existing) !== comparableCsv(csv)) {
      console.error(`${path.relative(repoRoot, outputPath)} と一致しません`);
      return 1;
    }
    console.log(`${path.relative(repoRoot, outputPath)} と一致しました（${built.rows.length}件）`);
    return 0;
  }

  if (options.keepUnchanged && existing !== null && comparableCsv(existing) === comparableCsv(csv)) {
    console.log(`変化なし: ${path.relative(repoRoot, outputPath)} は書き換えていません（${built.rows.length}件）`);
    return 0;
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, csv);
  console.log(`${path.relative(repoRoot, outputPath)} を書きました（${built.rows.length}件 / 記事${built.read}本を読んだ）`);
  const byKind = {};
  built.rows.forEach((row) => { byKind[row.kind] = (byKind[row.kind] || 0) + 1; });
  Object.entries(byKind).sort((a, b) => b[1] - a[1]).forEach(([kind, count]) => {
    console.log(`  ${kind} ${count}件`);
  });
  return 0;
}

process.exit(main(process.argv.slice(2)));
