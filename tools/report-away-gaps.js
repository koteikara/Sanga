#!/usr/bin/env node

/**
 * 手で確かめるアウェイ戦を挙げる。
 *
 * 設計は docs/supporter-timeline-design.md の「アウェイ戦のチケット」を正とする。
 *
 * **新しい取得先を持たない。** 手元のCSVと matches.json を突き合わせるだけで、
 * 外へは1リクエストも出さない。挙がったときに初めて、人が相手クラブ公式を見に行く。
 *
 * アウェイ席の情報源は3種類ある。
 *
 * | 種別 | 情報源 | 自動か |
 * | --- | --- | --- |
 * | 国内・Jリーグチケット掲載クラブ | Jリーグチケット | 全自動 |
 * | 国内・非掲載クラブ（広島・柏・神戸） | 相手クラブ公式 | **人** |
 * | ACL（国外） | 京都公式のACL特設サイト | **人** |
 *
 * 全自動の分は放っておけば揃う。**この道具が挙げるのは残り2つ**で、
 * 誰かが見に行かないと永久に埋まらないものだけ。
 *
 * 出力はGitHubのIssue本文にそのまま貼れるMarkdown。穴が無ければ何も出さない。
 * **静かなのが正常。** 鳴ったら本物、という設計にしている。
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const DEFAULT_MATCHES = path.join(repoRoot, 'public', 'data', 'matches.json');
const DEFAULT_AWAY = path.join(repoRoot, 'docs', 'sheets', 'away-tickets.current.csv');
const DEFAULT_SALES = path.join(repoRoot, 'docs', 'sheets', 'away-sales.current.csv');
const DEFAULT_MANUAL = path.join(repoRoot, 'docs', 'sheets', 'away-sales.manual.csv');

/**
 * 何日前から挙げるか。
 *
 * **実測から決めている。** G大阪戦（10/24）は試合の44日前の時点で、すでに
 * Jリーグチケットに「発売前」で載っていた。広島の自社販売も、試合の30〜39日前に
 * 販売が始まっている（2026-09-10 に4試合ぶん確認）。
 *
 * つまり**30日を切ってまだ何も無い試合は、載る予定が無いと見てよい。**
 * 短くすると気付くのが遅れ、長くすると「まだ載っていないだけ」の試合が毎日並ぶ。
 */
const DEFAULT_WITHIN_DAYS = 30;

/** ACLアウェイで見に行く先。京都公式の集約点で、ここから個別の案内記事へ辿れる。 */
const ACL_HUB_URL = 'https://www.sanga-fc.jp/acle26-27';

function usage() {
  console.error('使い方: node tools/report-away-gaps.js [options]');
  console.error('  --matches <path>            試合データ（既定: public/data/matches.json）');
  console.error('  --away <csv>                Jリーグチケットの掲載（既定: docs/sheets/away-tickets.current.csv）');
  console.error('  --away-sales <csv>          自動で取れた発売日時（既定: docs/sheets/away-sales.current.csv）');
  console.error('  --away-sales-manual <csv>   手入力の発売日時（既定: docs/sheets/away-sales.manual.csv）');
  console.error(`  --within <日数>             何日前から挙げるか（既定: ${DEFAULT_WITHIN_DAYS}）`);
  console.error('  --today <YYYY-MM-DD>        基準日。省略時は今日（JST）');
  console.error('穴が無ければ何も出力しません。終了コードは常に0です。');
}

/** CSVは自分たちで書いた単純な形なので、引用符のない前提で読む。無ければ空。 */
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
  return matches;
}

function todayInJst() {
  const jst = new Date(Date.now() + 9 * 3600000);
  return jst.toISOString().slice(0, 10);
}

function daysBetween(from, to) {
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = new Date(`${to}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

/**
 * 穴を探す。
 *
 * **日程が未定の試合は対象外。** 試合日が決まっていないと「あと何日」を測れず、
 * 挙げても人が動きようがない。日程が決まった時点で自然に対象へ入る。
 */
function findGaps(options) {
  const matches = readMatches(options.matchesPath);
  const listedDates = new Set(readRows(options.awayPath).map((row) => row.match_date));
  const salesDates = new Set(readRows(options.salesPath).map((row) => row.match_date));
  const manualIds = new Set(readRows(options.manualPath).map((row) => row.match_id));

  return matches
    .filter((match) => match.home_away === 'A' && match.match_date)
    .filter((match) => {
      if (manualIds.has(match.id)) return false;        // 手で入れてある
      if (salesDates.has(match.match_date)) return false; // 自動で日時が取れている
      if (listedDates.has(match.match_date)) return false; // 掲載があり、いずれ自動で取れる
      return true;
    })
    .map((match) => ({ match, days: daysBetween(options.today, match.match_date) }))
    .filter((entry) => entry.days >= 0 && entry.days <= options.within)
    .sort((a, b) => a.days - b.days);
}

/** ACLかどうか。見に行く先が違うので分ける。 */
function isAcl(match) {
  return match.competition === 'ACL';
}

function renderBody(gaps, options) {
  const lines = [];
  lines.push('アウェイ席の情報が取れていない試合です。**相手クラブ公式か京都公式を見て、');
  lines.push('`docs/sheets/away-sales.manual.csv` に1行足してください。**');
  lines.push('');
  lines.push(`試合まで${options.within}日以内で、販売日時も掲載も無いものだけを挙げています。`);
  lines.push('Jリーグチケットに載っている試合は自動で取れるので出しません。');
  lines.push('');

  const domestic = gaps.filter((entry) => !isAcl(entry.match));
  const acl = gaps.filter((entry) => isAcl(entry.match));

  if (domestic.length) {
    lines.push('## 国内（相手クラブ公式を見る）');
    lines.push('');
    domestic.forEach(({ match, days }) => {
      lines.push(`- **${match.match_date}（あと${days}日）${match.opponent}戦** … ${match.venue || '会場未定'}`);
    });
    lines.push('');
    lines.push('Jリーグチケットに載らないクラブがあります（2026-09-10 時点で広島・柏・神戸）。');
    lines.push('相手クラブのページで「ホーム戦の掲載が0」か「試合ページにビジター席の語が無い」なら、');
    lines.push('そのクラブは対象です。詳しくは `docs/supporter-timeline-design.md` の');
    lines.push('「Jリーグチケットを使わないクラブの見つけ方」。');
    lines.push('');
  }

  if (acl.length) {
    lines.push('## ACL（京都公式の特設サイトを見る）');
    lines.push('');
    acl.forEach(({ match, days }) => {
      lines.push(`- **${match.match_date}（あと${days}日）${match.opponent}戦** … ${match.venue || '会場未定'}`);
    });
    lines.push('');
    lines.push(`見に行く先: ${ACL_HUB_URL}`);
    lines.push('');
    lines.push('ACLアウェイはJリーグチケットにも相手クラブにも載りません。京都公式が案内します。');
    lines.push('特設サイトのニュース一覧に「【M/D(曜)◯◯戦】チケット情報」の記事が出ます。');
    lines.push('**前売と当日券のどちらを採るかは、その都度読んで決めてください**');
    lines.push('（大田戦では当日券を採りました。前売は現地の銀行手続きが要ったためです）。');
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('この一覧は `tools/report-away-gaps.js` が毎日作り直します。');
  lines.push('**穴が無くなればこのIssueは閉じます。** 手で閉じる必要はありません。');

  return lines.join('\n');
}

function main(argv) {
  const options = {
    matchesPath: DEFAULT_MATCHES,
    awayPath: DEFAULT_AWAY,
    salesPath: DEFAULT_SALES,
    manualPath: DEFAULT_MANUAL,
    within: DEFAULT_WITHIN_DAYS,
    today: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') { usage(); return 0; }
    if (arg === '--matches') { options.matchesPath = path.resolve(argv[i += 1]); continue; }
    if (arg === '--away') { options.awayPath = path.resolve(argv[i += 1]); continue; }
    if (arg === '--away-sales') { options.salesPath = path.resolve(argv[i += 1]); continue; }
    if (arg === '--away-sales-manual') { options.manualPath = path.resolve(argv[i += 1]); continue; }
    if (arg === '--within') { options.within = Number(argv[i += 1]); continue; }
    if (arg === '--today') { options.today = argv[i += 1]; continue; }
    console.error(`不明なオプション: ${arg}`); usage(); return 1;
  }

  if (!Number.isInteger(options.within) || options.within < 0) {
    console.error(`--within は0以上の整数である必要があります: ${options.within}`);
    return 1;
  }
  options.today = options.today || todayInJst();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.today)) {
    console.error(`--today の日付が不正です: ${options.today}`);
    return 1;
  }

  let gaps;
  try {
    gaps = findGaps(options);
  } catch (error) {
    console.error(`穴を探せません: ${error.message}`);
    return 1;
  }

  // 穴が無ければ何も出さない。呼び出し側は出力が空かどうかで閉じるか決める。
  if (gaps.length === 0) {
    console.error(`手で確かめるアウェイ戦はありません（${options.today} から${options.within}日以内）。`);
    return 0;
  }

  console.log(renderBody(gaps, options));
  console.error(`手で確かめるアウェイ戦が${gaps.length}件あります（${options.today} から${options.within}日以内）。`);
  return 0;
}

process.exit(main(process.argv.slice(2)));
