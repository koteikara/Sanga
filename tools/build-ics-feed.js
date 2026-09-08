#!/usr/bin/env node

/**
 * 購読フィード（`.ics`）を作る。段階2。
 *
 * 設計は docs/supporter-timeline-design.md の「購読フィード」を正とする。
 * 組み立ては public/assets/ics.js が受け持ち、ここは**何を出すかだけ**を決める。
 * 画面からのダウンロード（public/assets/timeline.js）と同じ `buildCalendar()` を
 * 呼ぶので、2つの出口で中身がズレない。
 *
 * **出力先のURLは変えない。** 購読者は最初に登録したURLを持ち続けるため、
 * `?v=` を付けず、置き場所も動かさない。`tools/asset-versions.mjs` は `.ics` を
 * 対象にしていないが、これは偶然ではなく決めごととして守る。
 *
 * 墓標（STATUS:CANCELLED）はまだ無い。段階3で足す。
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const repoRoot = path.resolve(__dirname, '..');
const DEFAULT_EVENTS = path.join(repoRoot, 'public', 'data', 'calendar-events.json');
const DEFAULT_MATCHES = path.join(repoRoot, 'public', 'data', 'matches.json');
const DEFAULT_OUTPUT = path.join(repoRoot, 'public', 'timeline.ics');

const CALENDAR_NAME = 'SANGA SUPPORTER TIMELINE';
const CALENDAR_DESC = '京都サンガF.C. のチケット販売日程と試合日程（非公式）。出典は公式サイト。';
const PROD_ID = '-//SANGA TOOLBOX//SUPPORTER TIMELINE//JA';

/**
 * 取りに来る間隔の目安。**強制はできない**（決めるのはカレンダーアプリ側）。
 * 販売開始は日単位で動くため、半日あれば取りこぼさない。
 */
const REFRESH = 'PT12H';

const WEEK = ['日', '月', '火', '水', '木', '金', '土'];

function usage() {
  console.error('使い方: node tools/build-ics-feed.js [output.ics] [options]');
  console.error('  --events <path>  イベント（既定: public/data/calendar-events.json）');
  console.error('  --matches <path> 試合データ（既定: public/data/matches.json）');
  console.error('  --check          出力先と突き合わせ、差分があれば終了コード1');
  console.error(`出力先を省略した場合: ${path.relative(repoRoot, DEFAULT_OUTPUT)}`);
}

/** 日時が確定しているものだけ。候補日のままのものと日程未定は出さない。 */
function isDated(event) {
  return event.date_precision === 'datetime' || event.date_precision === 'date';
}

/**
 * **特典チケットの引換はフィードに出さない。**
 *
 * 引換は1試合につき3件（コース別）あり、全ホーム戦ぶんで50件を超える。画面からの
 * ダウンロードは「引き換え予定を決めた試合のぶんだけ」に絞れるが、**フィードは
 * 公開URL1本なので誰の予定かを知りようがなく、絞れない。** 全部入れると、使う予定の
 * ない予定でカレンダーが埋まる。SANGA CREW でない人には1件も関係がない。
 *
 * 引換を追いたい人は、画面から引き換え予定を決めてダウンロードする道が残っている。
 */
function isFeedTarget(event) {
  return event.ticket_kind !== 'benefit_exchange';
}

function matchIndexOf(matchesPath) {
  const raw = JSON.parse(fs.readFileSync(matchesPath, 'utf8'));
  const matches = Array.isArray(raw) ? raw : raw.matches;
  if (!Array.isArray(matches)) throw new Error('matches.json の形式が想定と違います');
  const index = new Map();
  matches.forEach((match) => { index.set(match.id, match); });
  return index;
}

function matchLabel(event, matches) {
  const ids = Array.isArray(event.match_ids) ? event.match_ids : [];
  if (!ids.length) return '';
  return ids.map((id) => {
    const match = matches.get(id);
    return match ? `${match.round} ${match.opponent || '未定'}戦` : id;
  }).join(' / ');
}

/**
 * 試合日。販売の予定は試合日と別の日に出るため、題だけではその試合がいつか分からない。
 * 画面（public/assets/timeline.js）と同じ書式にそろえる。
 */
function matchDateLabel(event, matches) {
  const ids = Array.isArray(event.match_ids) ? event.match_ids : [];
  if (ids.length !== 1) return '';
  const match = matches.get(ids[0]);
  if (!match) return '';
  if (!match.match_date) return '試合日未定';
  const parts = String(match.match_date).split('-');
  if (parts.length !== 3) return '';
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (Number.isNaN(date.getTime())) return '';
  return `試合日 ${date.getMonth() + 1}/${date.getDate()}（${WEEK[date.getDay()]}）`;
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** 予定を、組み立て（assets/ics.js）が受け取る形に直す。 */
function specOf(event, matches) {
  const start = parseDate(event.starts_at);
  if (!start) return null;

  const description = [];
  let label = matchLabel(event, matches);
  // 試合そのものの予定では、予定の日付が試合日なので重ねて書かない。
  if (event.type !== 'match') {
    const matchDate = matchDateLabel(event, matches);
    if (matchDate) label = label ? `${label}（${matchDate}）` : matchDate;
  }
  if (label) description.push(label);
  if (event.source_url) description.push(event.source_url);

  return {
    uid: event.id,
    start,
    end: parseDate(event.ends_at),
    allDay: event.date_precision === 'date',
    summary: event.title,
    description: description.join('\n'),
    sequence: event.calendar_sequence,
    lastModified: parseDate(event.calendar_last_modified),
  };
}

/**
 * DTSTAMP に書く時刻。
 *
 * **実行時刻を使わない。** 使うと、中身が同じでも作り直すたびにファイルが変わり、
 * `--check` が通らず、意味のない差分がコミットに乗る。イベントの更新時刻のうち
 * いちばん新しいものを使えば、中身が変わったときだけ動く。
 */
function stampOf(events, meta) {
  let newest = null;
  events.forEach((event) => {
    const at = parseDate(event.calendar_last_modified);
    if (at && (!newest || at > newest)) newest = at;
  });
  if (newest) return newest;
  const fallback = parseDate(meta && meta.updated_at);
  return fallback || new Date(0);
}

/**
 * VCALENDAR に購読向けの行を足す。
 *
 * `REFRESH-INTERVAL` と `X-PUBLISHED-TTL` は取りに来る間隔の**希望**で、強制はできない。
 * どちらを見るかはアプリによって違うため両方書く。
 */
function withRefresh(text) {
  const marker = 'X-WR-CALNAME:';
  const lines = text.split('\r\n');
  const at = lines.findIndex((line) => line.startsWith(marker));
  if (at < 0) throw new Error('X-WR-CALNAME が見つかりません');
  lines.splice(at + 1, 0,
    `X-WR-CALDESC:${CALENDAR_DESC}`,
    `REFRESH-INTERVAL;VALUE=DURATION:${REFRESH}`,
    `X-PUBLISHED-TTL:${REFRESH}`);
  return lines.join('\r\n');
}

async function main(argv) {
  const options = { eventsPath: DEFAULT_EVENTS, matchesPath: DEFAULT_MATCHES, check: false };
  const positional = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') { usage(); return 0; }
    if (arg === '--check') { options.check = true; continue; }
    if (arg === '--events') { options.eventsPath = path.resolve(argv[i += 1]); continue; }
    if (arg === '--matches') { options.matchesPath = path.resolve(argv[i += 1]); continue; }
    if (arg.startsWith('--')) { console.error(`知らない引数です: ${arg}`); usage(); return 1; }
    positional.push(arg);
  }

  if (positional.length > 1) { usage(); return 1; }
  const outputPath = positional[0] ? path.resolve(positional[0]) : DEFAULT_OUTPUT;

  let data;
  let matches;
  try {
    data = JSON.parse(fs.readFileSync(options.eventsPath, 'utf8'));
    matches = matchIndexOf(options.matchesPath);
  } catch (error) {
    console.error(`読めません: ${error.message}`);
    return 1;
  }

  // 組み立てはブラウザと共通。ESモジュールなので import() で読む。
  const icsPath = path.join(repoRoot, 'public', 'assets', 'ics.js');
  const { buildCalendar } = await import(pathToFileURL(icsPath).href);

  const all = data.events || [];
  const target = all.filter(isDated).filter(isFeedTarget);
  const specs = target.map((event) => specOf(event, matches)).filter(Boolean);

  const text = withRefresh(buildCalendar(specs, {
    now: stampOf(target, data.meta),
    calendarName: CALENDAR_NAME,
    prodId: PROD_ID,
  }));

  if (options.check) {
    if (!fs.existsSync(outputPath)) {
      console.error(`差分検出: ${path.relative(repoRoot, outputPath)} がありません。生成コマンドを実行してください。`);
      return 1;
    }
    if (fs.readFileSync(outputPath, 'utf8') !== text) {
      console.error(`差分検出: ${path.relative(repoRoot, outputPath)} が生成結果と一致しません。生成コマンドを実行して結果をコミットしてください。`);
      return 1;
    }
    console.log(`生成物OK: ${path.relative(repoRoot, outputPath)} は calendar-events.json から生成した結果と一致しています（${specs.length}件）`);
    return 0;
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, text);

  const skipped = all.filter(isDated).length - target.length;
  console.log(`生成しました: ${path.relative(repoRoot, outputPath)}（${specs.length}件）`);
  if (skipped > 0) console.log(`  特典チケットの引換${skipped}件は入れていません（誰の予定か分からないため絞れない）`);
  console.log(`  日時が確定していない${all.length - all.filter(isDated).length}件も入れていません`);
  console.log('  このURLは変えないでください。購読者は最初に登録したURLを持ち続けます。');
  return 0;
}

main(process.argv.slice(2)).then((code) => process.exit(code));
