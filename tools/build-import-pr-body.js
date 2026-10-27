#!/usr/bin/env node

/**
 * チケット販売スケジュールの取り込みPR（.github/workflows/ticket-sales-sync.yml）の本文を作る。
 *
 * 設計は docs/supporter-timeline-design.md の「取り込みPRの本文」を正とする。
 *
 * 以前は本文が固定の文面で、何が変わっても「公開JSONを作り直した」「124行すべてが
 * 書き換わって見える」と書いていた。2026-10-16 の取り込み（ホーム戦のCSVだけが動き、
 * 公開JSONは変わらなかった回）で、本文が差分と合わず、変更内容の欄も空になった。
 *
 * そこで本文は**実際に変わったファイルから組み立てる。**
 *
 * - 取り込むCSVごとに、移ろう列（取得日時・確認日・画面表示）を除いて前後を突き合わせ、
 *   追加・削除・変更を言葉で並べる。公式の販売スケジュールだけはパーサの変更一覧
 *   （`--parse-result`）があればそちらを使う
 * - 公開ファイル（calendar-events.json・ICS）が変わったときだけ「公開JSONを変更するPR」と書く。
 *   変わらないときは「公開ページは変わらない」と書く
 * - 確認してほしいことも、変わったものに合わせて出す
 * - 公式サイトからの取得を止めているあいだは `--paused ticket` / `--paused news` を渡す。
 *   本文は「失敗しました」ではなく「一時停止しています」と書く。同じ段を `--failed` と
 *   同時には指定できない
 *
 * **外へは1リクエストも出さない。** 前の内容は `git show <ref>:<path>`（既定）か
 * `--base-dir` から読む。手元の作り物で結果を確かめられるようにするため。
 */

const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

/**
 * 取り込むCSV。ワークフローの `git add` と同じ並び。
 * `keys` は行を突き合わせる列。同じ値の行が2つ以上あれば、行まるごとで突き合わせる。
 * `volatile` は毎回動く列で、比べない。各パーサの VOLATILE_COLUMNS と同じ。
 */
const CSV_FILES = [
  {
    file: 'docs/sheets/ticket-sales.current.csv',
    label: '公式の販売スケジュール',
    keys: ['competition', 'round', 'sale_type'],
    volatile: ['official_display_status', 'retrieved_at_jst'],
  },
  {
    file: 'docs/sheets/home-tickets.current.csv',
    label: 'ホーム戦の掲載（Jリーグチケット）',
    keys: ['match_date'],
    volatile: ['retrieved_at_jst'],
  },
  {
    file: 'docs/sheets/home-sales.current.csv',
    label: 'ホーム戦の販売日時（Jリーグチケット）',
    keys: ['match_date', 'sale_type'],
    volatile: ['checked_at'],
  },
  {
    file: 'docs/sheets/away-tickets.current.csv',
    label: 'アウェイ席の販売状態（Jリーグチケット）',
    keys: ['match_date'],
    volatile: ['retrieved_at_jst'],
  },
  {
    file: 'docs/sheets/away-sales.current.csv',
    label: 'アウェイ席の発売日時（Jリーグチケット）',
    keys: ['match_date', 'sale_label'],
    volatile: ['checked_at'],
  },
  {
    file: 'docs/sheets/news.current.csv',
    label: '公式の案内（ニュース一覧）',
    keys: ['article_id'],
    volatile: ['retrieved_at_jst'],
  },
  {
    file: 'docs/sheets/news-times.current.csv',
    label: '案内から読んだ日時',
    keys: ['event_id'],
    volatile: ['retrieved_at_jst'],
  },
];

/** 公開ファイル。calendar-events.json の版数が動くと、参照する timeline.js・HTMLも動く。 */
const PUBLIC_FILES = [
  'public/data/calendar-events.json',
  'public/timeline.ics',
  'public/timeline-events.ics',
  'public/assets/timeline.js',
  'public/timeline.html',
  'public/timeline-calendar.html',
];

const FEED_FILES = ['public/timeline.ics', 'public/timeline-events.ics'];

/** 1ファイルあたり本文に並べる行の上限。PR本文の長さには上限がある。 */
const MAX_LINES = 40;

function usage() {
  console.error('使い方: node tools/build-import-pr-body.js [options]');
  console.error('  --pending-since <ISO日時>  最初の未マージ取り込みの日時（本文先頭の隠しコメント）');
  console.error('  --run-url <URL>           ワークフローの実行');
  console.error('  --parse-result <file>     parse-ticket-sales.js の出力（公式の変更一覧）');
  console.error('  --base-ref <ref>          前の内容を読む git の参照（既定: HEAD）');
  console.error('  --base-dir <dir>          前の内容を git ではなくこのディレクトリから読む');
  console.error('  --head-dir <dir>          後の内容を読むディレクトリ（既定: リポジトリ）');
  console.error('  --failed <名前>           取り込みに失敗した段（ticket / home / away / news）。複数指定できる');
  console.error('  --paused <名前>           一時停止中の段（ticket / news）。失敗ではない。複数指定できる');
}

function parseArgs(argv) {
  const args = { baseRef: 'HEAD', headDir: repoRoot, failed: [], paused: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[i + 1];
      if (value === undefined) throw new Error(`${arg} に値がありません`);
      i += 1;
      return value;
    };
    if (arg === '--pending-since') args.pendingSince = next();
    else if (arg === '--run-url') args.runUrl = next();
    else if (arg === '--parse-result') args.parseResult = next();
    else if (arg === '--base-ref') args.baseRef = next();
    else if (arg === '--base-dir') args.baseDir = next();
    else if (arg === '--head-dir') args.headDir = next();
    else if (arg === '--failed') args.failed.push(next());
    else if (arg === '--paused') args.paused.push(next());
    else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else throw new Error(`不明なオプションです: ${arg}`);
  }
  const known = ['ticket', 'home', 'away', 'news'];
  const pausable = ['ticket', 'news'];
  args.failed.forEach((name) => {
    if (!known.includes(name)) throw new Error(`--failed は ${known.join(' / ')} のどれかです: ${name}`);
  });
  args.paused.forEach((name) => {
    if (!pausable.includes(name)) throw new Error(`--paused は ${pausable.join(' / ')} のどれかです: ${name}`);
    if (args.failed.includes(name)) throw new Error(`--paused と --failed は同時に指定できません: ${name}`);
  });
  return args;
}

/** RFC 4180 の最小実装。区切りと引用だけを扱う。 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') inQuotes = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') field += char;
  }

  if (inQuotes) throw new Error('CSVの引用符が閉じていません');
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function csvRecords(text) {
  if (text === null) return { header: [], records: [] };
  const rows = parseCsv(text.replace(/^﻿/, '')).filter((row) => row.some((cell) => cell.trim() !== ''));
  if (rows.length === 0) return { header: [], records: [] };
  const header = rows[0].map((cell) => cell.trim());
  const records = rows.slice(1).map((row) => {
    const record = {};
    header.forEach((key, index) => { record[key] = (row[index] || '').trim(); });
    return record;
  });
  return { header, records };
}

function readBase(args, file) {
  if (args.baseDir) {
    const full = path.join(args.baseDir, file);
    return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : null;
  }
  try {
    return childProcess.execFileSync('git', ['show', `${args.baseRef}:${file}`], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    return null;
  }
}

function readHead(args, file) {
  const full = path.join(args.headDir, file);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : null;
}

/**
 * 移ろう列を除いて前後を突き合わせる。
 * 返すのは本文にそのまま並べる行。違いが無ければ空。
 */
function describeCsvChanges(spec, beforeText, afterText) {
  const before = csvRecords(beforeText);
  const after = csvRecords(afterText);
  const header = after.header.length ? after.header : before.header;
  const columns = header.filter((name) => !spec.volatile.includes(name));
  const show = (record) => columns.map((name) => record[name] || '（空）').join(' / ');

  const keyed = (records) => {
    const map = new Map();
    for (const record of records) {
      const key = spec.keys.map((name) => record[name] || '').join('|');
      if (map.has(key)) return null;
      map.set(key, record);
    }
    return map;
  };
  const beforeMap = keyed(before.records);
  const afterMap = keyed(after.records);

  const lines = [];
  if (beforeMap && afterMap) {
    beforeMap.forEach((record, key) => {
      if (!afterMap.has(key)) lines.push(`削除: ${show(record)}`);
    });
    afterMap.forEach((record, key) => {
      const old = beforeMap.get(key);
      if (!old) {
        lines.push(`追加: ${show(record)}`);
        return;
      }
      const diffs = columns
        .filter((name) => (old[name] || '') !== (record[name] || ''))
        .map((name) => `${name}: ${old[name] || '（空）'} → ${record[name] || '（空）'}`);
      if (diffs.length) lines.push(`変更: ${spec.keys.map((name) => record[name]).join(' ')} / ${diffs.join(' / ')}`);
    });
    return lines;
  }

  // 突き合わせる列が一意でないときは、行まるごとで数える。
  const count = (records) => {
    const map = new Map();
    records.forEach((record) => {
      const text = show(record);
      map.set(text, (map.get(text) || 0) + 1);
    });
    return map;
  };
  const beforeCount = count(before.records);
  const afterCount = count(after.records);
  beforeCount.forEach((n, text) => {
    for (let i = afterCount.get(text) || 0; i < n; i += 1) lines.push(`削除: ${text}`);
  });
  afterCount.forEach((n, text) => {
    for (let i = beforeCount.get(text) || 0; i < n; i += 1) lines.push(`追加: ${text}`);
  });
  return lines;
}

function truncate(lines) {
  if (lines.length <= MAX_LINES) return lines;
  return lines.slice(0, MAX_LINES).concat([`……ほか${lines.length - MAX_LINES}件（差分はPRの Files changed で確認してください）`]);
}

/** 公式の変更一覧のうち、本文に要る行。パーサの案内文（書きましたなど）も含め、そのまま使う。 */
function readParseResult(file) {
  if (!file || !fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter((line) => line.trim() !== '');
}

function build(args) {
  const csvChanges = [];
  CSV_FILES.forEach((spec) => {
    const beforeText = readBase(args, spec.file);
    const afterText = readHead(args, spec.file);
    if (beforeText === afterText) return;
    let lines = describeCsvChanges(spec, beforeText, afterText);
    if (spec.file === 'docs/sheets/ticket-sales.current.csv') {
      const parsed = readParseResult(args.parseResult);
      if (parsed.length) lines = parsed;
    }
    if (lines.length === 0) lines = ['取得日時・確認日だけが変わりました（`--force_pr` で取り込んだ場合）'];
    csvChanges.push({ spec, lines: truncate(lines) });
  });

  const publicChanged = PUBLIC_FILES.filter((file) => readBase(args, file) !== readHead(args, file));
  const changed = (file) => csvChanges.some((change) => change.spec.file === file);
  const dataChanged = publicChanged.includes('public/data/calendar-events.json');
  const feedChanged = FEED_FILES.filter((file) => publicChanged.includes(file));
  const homeChanged = changed('docs/sheets/home-tickets.current.csv') || changed('docs/sheets/home-sales.current.csv');
  const awayChanged = changed('docs/sheets/away-tickets.current.csv') || changed('docs/sheets/away-sales.current.csv');
  const officialChanged = changed('docs/sheets/ticket-sales.current.csv');
  const failed = (name) => args.failed.includes(name);
  const paused = (name) => args.paused.includes(name);

  const out = [];
  const push = (...lines) => { out.push(...lines); };

  if (args.pendingSince) push(`<!-- pending-since: ${args.pendingSince} -->`);
  push('## 概要', '');
  push('- チケット販売スケジュールの自動取り込みです（`.github/workflows/ticket-sales-sync.yml`）。手作業の編集は含みません。');
  push('- 内容を確認してからマージしてください。自動ではマージしません。');
  push(`- 変わったデータ: ${csvChanges.map((change) => change.spec.label).join('、') || 'なし'}`);
  if (dataChanged) {
    push('- **公開JSONを変更するPRです。** 取り込んだCSVから `public/data/calendar-events.json` を作り直しています。公開ページ（`public/timeline.html`）が読むデータです。');
  } else {
    push('- **公開JSONは変わりません。** 取り込んだCSVから作り直した `public/data/calendar-events.json` は、いまの内容と同じでした。CSVだけを更新するPRです。');
  }
  if (feedChanged.length) {
    push(`- **購読フィード（${feedChanged.map((file) => `\`${file}\``).join(' と ')}）も変わります。** マージすると購読している人のカレンダーに届きます。予定が消えていないかは特に確認してください。`);
  } else {
    push('- 購読フィード（`public/timeline.ics` と `public/timeline-events.ics`）は変わりません。');
  }
  if (homeChanged) {
    push('- ホーム戦の販売日時は、公式の販売スケジュールが更新できないため、Jリーグチケットの試合ページから補っています（`docs/sheets/home-sales.current.csv`）。公式と日時が違う段階だけ、こちらで上書きします。日時が公式と同じなら公開JSONは変わりません。');
  }
  if (awayChanged) {
    push('- アウェイ席は、発売中の試合に加え**発売前の試合も載ります**。**ただし載っていない試合は「発売前」ではありません**（別のプレイガイドで売っている場合があります）。');
  }
  if (paused('ticket')) push('- **公式の販売スケジュールの取得は一時停止しています。** 公式サイト（sanga-fc.jp）が戻るまで、取得も解析もしません。`ticket-sales.current.csv` は前回の値のままです。');
  else if (failed('ticket')) push('- **公式の販売スケジュールの解析は失敗しました。** `ticket-sales.current.csv` は前回の値のままです。');
  if (failed('home')) push('- **ホーム戦（Jリーグチケット）の取り込みは失敗しました。** `home-sales.current.csv` は前回の値のままです。');
  if (failed('away')) push('- **アウェイの取り込みは失敗しました。** このPRのアウェイ関連ファイルは前回の値のままです。実行ログを確認してください。');
  if (paused('news')) push('- **公式の案内の取り込みは一時停止しています。** 公式サイト（sanga-fc.jp）が戻るまで取得しません。案内のCSVは前回の値のままです。');
  else if (failed('news')) push('- **公式の案内の取り込みは失敗しました。** 案内のCSVは前回の値のままです。');
  push('- 取得日時・確認日・画面表示（受付中・販売中）だけの違いでは更新しません。');
  push('');

  push('## 変更内容', '');
  push('取得日時の列は毎回動くため、CSVの差分はそのぶん多く見えます。その列を除いて突き合わせた結果です。', '');
  csvChanges.forEach(({ spec, lines }) => {
    push(`### ${spec.label}（\`${spec.file}\`）`, '');
    push('```text', ...lines, '```', '');
  });
  if (publicChanged.length) {
    push('### 公開ファイル', '');
    publicChanged.forEach((file) => push(`- \`${file}\``));
    push('');
  } else {
    push('公開ファイル（`public/`）の変更はありません。', '');
  }

  push('## 確認内容', '');
  push('- 取り込み時に `npm run check:static`（`check:timeline` → `check:timeline:public` を含む）を実行し、合格しています。');
  push('- GitHub Actionsが作ったPRではワークフローが起動しないため、このPRにはCIの結果が付きません。');
  push('');

  push('## 注意点', '');
  if (officialChanged) {
    push('- 販売日時の変更が、公式ページの表示と一致しているか。');
    push('- 掲載済みだった試合が未掲載に戻っていないか（戻っている場合は取得の失敗を疑う）。');
  }
  if (homeChanged) push('- ホーム戦の販売日時が、Jリーグチケットの試合ページの表示と一致しているか。');
  if (awayChanged) push('- アウェイ席の販売状態・発売日時が、Jリーグチケットの試合ページの表示と一致しているか。');
  if (feedChanged.length) push('- 購読フィードから予定が消えていないか。');
  push('- 本番反映はマージと別に、手動のデプロイで行います。');
  if (args.runUrl) push('', `実行: ${args.runUrl}`);

  return `${out.join('\n')}\n`;
}

function main(argv) {
  const args = parseArgs(argv);
  process.stdout.write(build(args));
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    usage();
    process.exit(1);
  }
}

module.exports = { build, describeCsvChanges, parseArgs };
