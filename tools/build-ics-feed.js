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
 * **消えた予定は墓標として残す。** 生成物から消すだけでは、購読した人のカレンダーからは
 * 消えない。前回のフィードを読み、今回いなくなったUIDを STATUS:CANCELLED で出し続ける。
 * 残す期間は、その予定が結び付く試合の試合日から1週間後まで。
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const repoRoot = path.resolve(__dirname, '..');
const DEFAULT_EVENTS = path.join(repoRoot, 'public', 'data', 'calendar-events.json');
const DEFAULT_MATCHES = path.join(repoRoot, 'public', 'data', 'matches.json');
const DEFAULT_OUTPUT = path.join(repoRoot, 'public', 'timeline.ics');

// 名前だけで公式の配信と見分けが付くようにする。カレンダーの一覧には常時出る。
const CALENDAR_NAME = 'SANGA SUPPORTER TIMELINE（非公式）';
const CALENDAR_DESC = '京都サンガF.C. のチケット販売日程と試合日程（非公式）。出典は公式サイト。';
const PROD_ID = '-//SANGA TOOLBOX//SUPPORTER TIMELINE//JA';

/**
 * 取りに来る間隔の目安。**強制はできない**（決めるのはカレンダーアプリ側）。
 * 販売開始は日単位で動くため、半日あれば取りこぼさない。
 */
const REFRESH = 'PT12H';

/**
 * 墓標を残す期間。試合日から数える。
 *
 * 終わった試合の予定をいつまでも配る意味は無い。かといって即座に消すと、その間に
 * 同期しなかった端末には取り消しが届かない。1週間あれば行き渡る。
 */
const TOMBSTONE_DAYS = 7;

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
  if (event.ticket_kind === 'benefit_exchange') return false;
  // **記事から読み取った日時は、このフィードに混ぜない。**
  // 1試合で10件を超える。いま timeline.ics を登録している人は「チケットの発売開始と
  // 試合」が来ると思って登録しており、当日のブースや入場の時刻が黙って増えると、
  // 登録した覚えのないものが届くことになる。先に配ったURLの意味は変えない。
  // これらは2本目のフィードで配る（docs/supporter-timeline-design.md の「2本目を足す」）。
  return !event.derived_from;
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
    if (!match) return id;
    // 相手が決まっていない試合（勝ち上がり枠）を「未定戦」と呼ばない。
    if (!match.opponent || match.opponent === '未定') {
      return `${match.competition_label || ''} ${match.round || ''}`.trim() || id;
    }
    return `${match.round} ${match.opponent}戦`;
  }).join(' / ');
}

/**
 * カレンダーの題に付けるホーム／アウェイ。
 *
 * **画面と違い、カレンダーには印を添える場所がない。** 画面は試合名の後ろに
 * H / A のしるしを別に出せるが、ICSで月表示に出るのは SUMMARY だけ。
 * 会場名から察してもらうしかない状態だったので、題そのものに入れる。
 * 遠征が要るかどうかは、予定を見た人がまず知りたいこと。
 *
 * `home_away` が空の試合（勝ち上がり枠）には付けない。分からないものを言い切らない。
 */
function matchSideLabel(event, matches) {
  if (event.type !== 'match') return '';
  const ids = Array.isArray(event.match_ids) ? event.match_ids : [];
  if (ids.length !== 1) return '';
  const match = matches.get(ids[0]);
  if (!match) return '';
  if (match.home_away === 'H') return 'ホーム';
  if (match.home_away === 'A') return 'アウェイ';
  return '';
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
function specOf(event, matches, disclaimer) {
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
  // 断り書きは最後。読み飛ばされても、題と試合日と出典は先に目に入る。
  if (disclaimer) description.push(disclaimer);

  const side = matchSideLabel(event, matches);

  return {
    uid: event.id,
    start,
    end: parseDate(event.ends_at),
    allDay: event.date_precision === 'date',
    summary: side ? `【${side}】${event.title}` : event.title,
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

/* ---------- 墓標 ---------- */

/**
 * 前回のフィードを読み、UIDごとに中身を取り出す。
 *
 * 自分で書いた形なので、1行1項目・折り返しは空白1つ、という前提で読む。
 * ここが唯一の「前回どこまで配ったか」の記録で、別ファイルを持たない。
 */
function readPreviousFeed(feedPath) {
  const index = new Map();
  if (!fs.existsSync(feedPath)) return index;

  // 折り返しをほどく。続きの行は空白1つで始まる（RFC 5545 3.1）。
  const unfolded = fs.readFileSync(feedPath, 'utf8').replace(/\r\n[ \t]/g, '');

  unfolded.split('\r\n').forEach((line) => {
    if (line === 'BEGIN:VEVENT') index.set('__current__', {});
    else if (line === 'END:VEVENT') {
      const event = index.get('__current__');
      index.delete('__current__');
      if (event && event.uid) index.set(event.uid, event);
    } else {
      const event = index.get('__current__');
      if (!event) return;
      const at = line.indexOf(':');
      if (at < 0) return;
      const name = line.slice(0, at);
      const value = line.slice(at + 1);
      if (name === 'UID') event.uid = value;
      else if (name === 'SEQUENCE') event.sequence = Number(value);
      else if (name === 'STATUS') event.status = value;
      else if (name === 'SUMMARY') event.summary = icsUnescape(value);
      else if (name === 'DESCRIPTION') event.description = icsUnescape(value);
      else if (name === 'DTSTART') event.dtstart = value;
      else if (name === 'DTSTART;VALUE=DATE') { event.dtstart = value; event.allDay = true; }
      else if (name === 'DTEND') event.dtend = value;
      else if (name === 'LAST-MODIFIED') event.lastModified = value;
    }
  });

  index.delete('__current__');
  return index;
}

/**
 * 逃がした文字を元に戻す。**読み戻すときに必ず要る。**
 * 逃がしたまま渡すと組み立てでもう一度逃がされ、`\n` が `\\n` になって
 * 説明欄に文字として出てしまう。
 */
function icsUnescape(text) {
  return String(text).replace(/\\([\\;,nN])/g, (whole, char) => (
    char === 'n' || char === 'N' ? '\n' : char
  ));
}

/** `20260911T100000Z` を Date に戻す。 */
function fromUtcStamp(value) {
  const found = String(value).match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (found) {
    const [, y, mo, d, h, mi, sec] = found.map(Number);
    return new Date(Date.UTC(y, mo - 1, d, h, mi, sec));
  }
  const dateOnly = String(value).match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dateOnly) {
    const [, y, mo, d] = dateOnly.map(Number);
    return new Date(y, mo - 1, d);
  }
  return null;
}

/**
 * UIDから試合を引く。**UIDを分解しない。**
 * 試合IDにハイフンを含むもの（`acl-md1`）があり、区切りで切ると壊れるため、
 * 実在する試合IDと突き合わせる。
 */
function matchOfUid(uid, matches) {
  const id = uid.split('@')[0];
  for (const [matchId, match] of matches) {
    if (id === `match-${matchId}` || id.startsWith(`ticket-${matchId}-`)) return match;
  }
  return null;
}

/**
 * 墓標を残す期限。試合日の TOMBSTONE_DAYS 日後の終わり。
 * 試合日が分からないうちは消さない（まだ先の試合なので、消す理由がない）。
 */
function tombstoneExpiry(uid, matches) {
  const match = matchOfUid(uid, matches);
  if (!match || !match.match_date) return null;
  const parts = String(match.match_date).split('-');
  if (parts.length !== 3) return null;
  const until = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]) + TOMBSTONE_DAYS, 23, 59, 59);
  return Number.isNaN(until.getTime()) ? null : until;
}

/**
 * 今回いなくなったUIDを墓標にする。
 *
 * **版は墓標になった一度だけ上げる。** 上げないと取り消しが更新として届かず、
 * 毎回上げると同じ取り消しが何度も更新として届く。すでに墓標なら前回の版を持ち越す。
 */
function tombstonesFor(previous, liveUids, matches, now) {
  const specs = [];
  const expired = [];

  previous.forEach((event, uid) => {
    if (liveUids.has(uid)) return;

    const until = tombstoneExpiry(uid, matches);
    if (until && now > until) { expired.push(uid); return; }

    const start = fromUtcStamp(event.dtstart);
    if (!start) return;

    const wasCancelled = event.status === 'CANCELLED';
    specs.push({
      uid: uid.split('@')[0],
      start,
      end: fromUtcStamp(event.dtend),
      allDay: Boolean(event.allDay),
      summary: event.summary || '',
      description: event.description || '',
      sequence: wasCancelled ? event.sequence : (Number(event.sequence) || 0) + 1,
      // すでに墓標なら、取り消した時刻をそのまま持ち越す。毎回動かすと
      // 同じ取り消しが更新として何度も届く。
      lastModified: wasCancelled ? fromUtcStamp(event.lastModified) : now,
      status: 'CANCELLED',
    });
  });

  return { specs, expired };
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
  const { buildCalendar, UID_DOMAIN, DISCLAIMER } = await import(pathToFileURL(icsPath).href);

  const all = data.events || [];
  const target = all.filter(isDated).filter(isFeedTarget);
  const live = target.map((event) => specOf(event, matches, DISCLAIMER)).filter(Boolean);

  const stamp = stampOf(target, data.meta);

  // 前回配ったUIDのうち、今回いなくなったものを墓標にする。
  const previous = readPreviousFeed(outputPath);
  const liveUids = new Set(live.map((spec) => `${spec.uid}@${UID_DOMAIN}`));
  const graves = tombstonesFor(previous, liveUids, matches, stamp);

  const specs = live.concat(graves.specs);

  const text = buildCalendar(specs, {
    now: stamp,
    calendarName: CALENDAR_NAME,
    prodId: PROD_ID,
    calendarDescription: CALENDAR_DESC,
    refreshInterval: REFRESH,
  });

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
  if (graves.specs.length) {
    console.log(`  うち墓標（取り消し）${graves.specs.length}件:`);
    graves.specs.forEach((spec) => { console.log(`    ${spec.uid} ${spec.summary}`); });
  }
  if (graves.expired.length) {
    console.log(`  試合日から${TOMBSTONE_DAYS}日が過ぎたため落とした墓標: ${graves.expired.length}件`);
  }
  if (skipped > 0) console.log(`  特典チケットの引換${skipped}件は入れていません（誰の予定か分からないため絞れない）`);
  console.log(`  日時が確定していない${all.length - all.filter(isDated).length}件も入れていません`);
  console.log('  このURLは変えないでください。購読者は最初に登録したURLを持ち続けます。');
  return 0;
}

main(process.argv.slice(2)).then((code) => process.exit(code));
