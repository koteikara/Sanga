#!/usr/bin/env node

/**
 * チケット販売スケジュールのCSVと matches.json から calendar-events を生成する。
 *
 * 設計は docs/supporter-timeline-design.md の「情報収集アーキテクチャ」
 * 「販売段階は8つある」「チケット販売スケジュールのスナップショット」を正とする。
 *
 * 生成するのは事実だけ（日時・対象・試合との対応）で、記事本文やタイトルは持たない。
 * 検証用の作り物は --samples で別ファイルから足す。実データと作り物を混ぜないため。
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const DEFAULT_MATCHES = path.join(repoRoot, 'public', 'data', 'matches.json');
const DEFAULT_OUTPUT = path.join(repoRoot, 'tmp', 'calendar-events.generated.json');

const SOURCE_URL = 'https://www.sanga-fc.jp/ticket/schedule';
const NEWS_SOURCE_URL = 'https://www.sanga-fc.jp/news';

/** 公式の段階名 → 保存する事実。題は自分の言葉で書き、公式の表記を転載しない。 */
const STAGES = {
  'シーズンパス先行受付（ホーム指定席をご購入の方）': {
    suffix: 'season',
    kind: 'sale',
    audience: { season_ticket: true },
    label: 'シーズンパス先行受付 開始',
  },
  // ACLだけ「受付」ではなく「販売」と呼ぶ。対象も役割も上と同じなので、
  // suffix と対象者はそろえる。題だけ公式の呼び方に合わせる。
  'シーズンパス先行販売': {
    suffix: 'season',
    kind: 'sale',
    audience: { season_ticket: true },
    label: 'シーズンパス先行販売 開始',
  },
  'SC最速先行販売（プラチナ）': {
    suffix: 'platinum',
    kind: 'sale',
    audience: { fc_grade: ['platinum'] },
    label: 'プラチナ先行販売 開始',
  },
  'SC先々行販売（ゴールド）': {
    suffix: 'gold',
    kind: 'sale',
    audience: { fc_grade: ['gold'] },
    label: 'ゴールド先行販売 開始',
  },
  'SC先行販売（レギュラー・キッズ）': {
    suffix: 'regular',
    kind: 'sale',
    audience: { fc_grade: ['regular', 'kids'] },
    label: 'レギュラー・キッズ先行販売 開始',
  },
  一般販売: {
    suffix: 'general',
    kind: 'sale',
    audience: {},
    label: '一般販売 開始',
  },
  'SC特典チケット引換 プラチナ': {
    suffix: 'benefit-platinum',
    kind: 'benefit_exchange',
    audience: { fc_grade: ['platinum'] },
    label: '特典チケット引換 開始（プラチナ）',
  },
  'SC特典チケット引換 ゴールド': {
    suffix: 'benefit-gold',
    kind: 'benefit_exchange',
    audience: { fc_grade: ['gold'] },
    label: '特典チケット引換 開始（ゴールド）',
  },
  'SC特典チケット引換 レギュラー・キッズ': {
    suffix: 'benefit-regular',
    kind: 'benefit_exchange',
    audience: { fc_grade: ['regular', 'kids'] },
    label: '特典チケット引換 開始（レギュラー・キッズ）',
  },
};

function usage() {
  console.error('使い方: node tools/generate-calendar-events.js <ticket-sales.csv> [output.json] [options]');
  console.error('  --matches <path>   試合データ（既定: public/data/matches.json）');
  console.error('  --samples <path>   検証用の作り物イベントを足す（events と skipped を持つJSON）');
  console.error('  --news <csv>       ニュース一覧のCSV。試合ごとの案内の件数を足す');
  console.error('  --news-times <csv>        記事から読んだ日時。イベントとして並べる');
  console.error('  --news-times-manual <csv> 上の手直し（drop / edit）');
  console.error('  --checked-at <日付> 出典の確認日。省略時はCSVの retrieved_at_jst から取る');
  console.error('  --check            出力先の既存ファイルと突き合わせ、差分があれば失敗する');
  console.error(`出力先を省略した場合: ${DEFAULT_OUTPUT}`);
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

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (inQuotes) throw new Error('CSVの引用符が閉じていません');
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function readCsvRecords(csvPath, { allowEmpty = false } = {}) {
  const text = fs.readFileSync(csvPath, 'utf8').replace(/^﻿/, '');
  const rows = parseCsv(text).filter((row) => row.some((cell) => cell.trim() !== ''));
  // 手直し用のCSVは、見出しだけで中身が無いのが**ふつうの状態**。空を失敗にしない。
  if (rows.length === 1 && allowEmpty) return [];
  if (rows.length < 2) throw new Error('CSVに行がありません');
  const header = rows[0].map((cell) => cell.trim());
  return rows.slice(1).map((row) => {
    const record = {};
    header.forEach((key, index) => {
      record[key] = (row[index] || '').trim();
    });
    return record;
  });
}

/**
 * CSVの大会名と節番号から、matches.json の試合IDを作る。
 *
 * **節番号だけでは足りない。** 節は大会ごとに1から振り直されるので、J1の第2節と
 * ACLリーグステージの第2節が同じIDになる。別の試合の日程を、別の試合の販売予定に
 * 結び付けてしまう。
 *
 * 知らない大会が来たら止める。黙って `sec02` に落とすより、気付けるほうがよい。
 */
const MATCH_ID_BY_COMPETITION = [
  { test: /AFCチャンピオンズリーグ/, id: (n) => `acl-md${n}` },
  { test: /Ｊ１リーグ|J1リーグ/, id: (n) => `sec${String(n).padStart(2, '0')}` },
];

function matchIdFor(competition, round) {
  const number = Number(round);
  if (!Number.isInteger(number) || number < 1) {
    throw new Error(`節の値を数として読めません: ${round}`);
  }
  const rule = MATCH_ID_BY_COMPETITION.find((entry) => entry.test.test(competition || ''));
  if (!rule) throw new Error(`知らない大会です（試合IDの作り方が決まっていません）: ${competition}`);
  return rule.id(number);
}

function buildMatchIndex(matchesPath) {
  const raw = JSON.parse(fs.readFileSync(matchesPath, 'utf8'));
  const matches = Array.isArray(raw) ? raw : raw.matches;
  if (!Array.isArray(matches)) throw new Error('matches.json の形式が想定と違います');
  const index = new Map();
  matches.forEach((match) => {
    index.set(match.id, match);
  });
  return index;
}

/**
 * カレンダーに出る項目。**版が上がるかどうかは、この6つが変わったかだけで決める。**
 *
 * public/assets/timeline.js の buildIcs() が VEVENT に書き出す項目と揃えている。
 * どちらかを変えたらもう一方も直すこと。source_checked_at のような「いつ確認したか」は
 * カレンダーに出ないので、ここには入れない。取り直すたびに動くため、入れると
 * 中身が同じでも版が上がってしまう。
 */
const ICS_FIELDS = ['starts_at', 'ends_at', 'date_precision', 'title', 'source_url', 'match_ids'];

/**
 * 書き出しの型そのものを変えたときに上げる番号。
 *
 * 上の6つはCSVから来る値で、**説明欄の作り方を変えても動きません。** 断り書きを足す、
 * 試合日の書き方を変える、といった型の変更は、値が同じままなので版が上がらない。
 * 版が上がらないと、既に受け取っている人の予定は古い形のまま残る。断り書きなら、
 * 断りの無い予定を持ったままの人が残るということ。
 *
 * そこで型を変えたときはここを1つ上げる。**全件の版が1つ上がり、受け取っている
 * 全員に届く。** 逆に、上げずに型を変えてはいけない。
 *
 * 1 … 断り書き（assets/ics.js の DISCLAIMER）を説明欄に足した（2026-09-08）
 * 2 … 試合の題に【ホーム】【アウェイ】を付け、説明欄の「未定戦」をやめた（2026-09-10）
 */
const ICS_TEMPLATE_VERSION = 2;

/** 同じ内容かどうかを比べるための指紋。 */
function icsFingerprint(event) {
  return JSON.stringify(ICS_FIELDS.map((key) => event[key] === undefined ? null : event[key]));
}

/**
 * 前回の生成物を UID ごとに引けるようにする。無ければ空。
 * 前回どの型で書き出したか（meta.ics_template_version）も一緒に返す。
 */
function readPrevious(outputPath) {
  const index = new Map();
  let templateVersion = null;
  if (!outputPath || !fs.existsSync(outputPath)) return { index, templateVersion };
  try {
    const previous = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    (previous.events || []).forEach((event) => { if (event.id) index.set(event.id, event); });
    if (previous.meta && Number.isFinite(previous.meta.ics_template_version)) {
      templateVersion = previous.meta.ics_template_version;
    }
  } catch (error) {
    console.error(`前回の生成物を読めませんでした（版は作り直します）: ${error.message}`);
  }
  return { index, templateVersion };
}

/**
 * カレンダー側の版を付ける。
 *
 * SEQUENCE は同じUIDに対して下がってはいけず、内容が変わったときに上がるべき値。
 * 取得時刻から作ると、取り直しただけで全イベントの版が上がり、購読側が毎回
 * 全件を更新扱いにしてしまう。そこで**前回の生成物と見比べ、カレンダーに出る項目が
 * 変わった行だけ +1 する。** 変わっていない行は前回の版と更新時刻をそのまま持ち越す。
 *
 * 前回に無いUID（新しいイベント）は 0 から始める。前回の値は形を問わず引き継ぐので、
 * 取得時刻から作っていた頃の大きな番号もそのまま保たれ、下がることはない。
 */
function applyVersions(events, snapshotAt, previous) {
  const lastModified = snapshotAt.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const previousIndex = previous.index;
  // 型が変わったなら、値が同じ行も書き出しの中身は変わっている。全件上げる。
  const templateChanged = previous.templateVersion !== ICS_TEMPLATE_VERSION;

  events.forEach((event) => {
    const previous = previousIndex.get(event.id);
    if (!previous) {
      event.calendar_sequence = 0;
      event.calendar_last_modified = lastModified;
      return;
    }

    const previousSequence = Number.isFinite(previous.calendar_sequence)
      ? Math.max(0, Math.floor(previous.calendar_sequence))
      : 0;

    if (!templateChanged && icsFingerprint(previous) === icsFingerprint(event)) {
      event.calendar_sequence = previousSequence;
      event.calendar_last_modified = previous.calendar_last_modified || lastModified;
      return;
    }

    event.calendar_sequence = previousSequence + 1;
    event.calendar_last_modified = lastModified;
  });

  return events;
}

/**
 * 予定の終わりを決める。
 *
 * **`DTEND` を省くと、アプリごとに違う長さで表示されます。** RFC 5545 では
 * 「DTSTART と同じ時刻に終わる（長さ0）」ですが、Microsoft は自社の仕様書で
 * Outlook が1時間として取り込むと明記しており、Googleカレンダーも1時間の枠にします。
 * 一方 `DTEND` に `DTSTART` と同じ値は書けません（仕様上「後でなければならない」）。
 * 長さ0は表現できないので、**こちらで短い長さを明示して、どのアプリでも同じに見せます。**
 *
 * 販売開始は15分。題が「開始」なので、終わりを匂わせない短さにする。
 * 1時間にすると「13:00までに買わないと終わる」と読めてしまい、事実と違う。
 */
const SALE_MINUTES = 15;
/** キックオフは2時間。試合はおおむねこの長さで、1時間だと短すぎる。 */
const MATCH_MINUTES = 120;

/** JSTの `2026-07-25T11:00:00+09:00` に分を足して、同じ形で返す。 */
function plusMinutes(startsAt, minutes) {
  const at = new Date(startsAt);
  if (Number.isNaN(at.getTime())) return '';
  const jst = new Date(at.getTime() + minutes * 60000 + 9 * 3600000);
  const pad = (value) => String(value).padStart(2, '0');
  return `${jst.getUTCFullYear()}-${pad(jst.getUTCMonth() + 1)}-${pad(jst.getUTCDate())}`
    + `T${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}:${pad(jst.getUTCSeconds())}+09:00`;
}

function ticketEvent(record, match, checkedAt) {
  const matchId = match.id;
  const opponent = match.opponent || '未定';

  if (record.schedule_status === '未掲載') {
    return {
      id: `ticket-${matchId}-unscheduled`,
      starts_at: '',
      ends_at: '',
      date_precision: 'unknown',
      date_candidates: [],
      type: 'ticket',
      ticket_kind: 'unscheduled',
      title: `${opponent}戦 チケット販売日程は未告知`,
      source: 'official',
      action_type: 'information',
      audience: {},
      interest_tags: [],
      match_ids: [matchId],
      source_url: record.source_url || SOURCE_URL,
      source_checked_at: checkedAt,
      status: 'tentative',
      is_visible: true,
      note: record.schedule_note || '',
    };
  }

  const stage = STAGES[record.sale_type];
  if (!stage) throw new Error(`知らない販売段階です: ${record.sale_type}`);
  if (!record.sale_start) throw new Error(`販売開始日時が空です: ${matchId} ${record.sale_type}`);

  return {
    id: `ticket-${matchId}-${stage.suffix}`,
    starts_at: record.sale_start,
    ends_at: plusMinutes(record.sale_start, SALE_MINUTES),
    date_precision: 'datetime',
    date_candidates: [],
    type: 'ticket',
    ticket_kind: stage.kind,
    title: `${opponent}戦 ${stage.label}`,
    source: 'official',
    action_type: 'action',
    audience: stage.audience,
    interest_tags: [],
    match_ids: [matchId],
    source_url: record.source_url || SOURCE_URL,
    source_checked_at: checkedAt,
    status: 'confirmed',
    is_visible: true,
  };
}

/**
 * 試合そのもののイベント。日時の確からしさは matches.json の状態をそのまま写す。
 * 試合が未確定でも販売日時は確定して告知されるため、両者の date_precision は別に持つ。
 */
/**
 * 試合の呼び名。**相手が決まっていない試合がある。**
 * ルヴァン杯と天皇杯の勝ち上がり枠は、日程だけ先に決まって相手と会場が「未定」で入る。
 * そのまま並べると「未定戦」になるので、大会と回戦で呼ぶ（`share_title`）。
 */
function matchLabel(match) {
  const opponent = match.opponent && match.opponent !== '未定' ? match.opponent : '';
  if (opponent) return `${opponent}戦`;
  return match.share_title
    || `${match.competition_label || ''} ${match.round || ''}`.trim()
    || '試合';
}

/** 会場も「未定」で入ることがある。分からないものを括弧で見せない。 */
function venueSuffix(match) {
  const venue = match.venue && match.venue !== '未定' ? match.venue : '';
  return venue ? `（${venue}）` : '';
}

function matchEvent(match) {
  const label = matchLabel(match);
  const base = {
    id: `match-${match.id}`,
    ends_at: '',
    type: 'match',
    source: 'official',
    action_type: 'information',
    audience: {},
    interest_tags: [],
    match_ids: [match.id],
    source_url: match.source_url || '',
    source_checked_at: match.source_checked_at || '',
    status: match.status || 'confirmed',
    is_visible: true,
  };

  if (match.match_date) {
    const time = match.kickoff_time || '00:00';
    const startsAt = `${match.match_date}T${time}:00+09:00`;
    return Object.assign(base, {
      starts_at: startsAt,
      // 時刻が分からない試合は終日として出るため、終わりは持たせない。
      ends_at: match.kickoff_time ? plusMinutes(startsAt, MATCH_MINUTES) : '',
      date_precision: match.kickoff_time ? 'datetime' : 'date',
      date_candidates: [],
      title: `${label} キックオフ${venueSuffix(match)}`,
    });
  }

  if (Array.isArray(match.date_candidates) && match.date_candidates.length > 0) {
    return Object.assign(base, {
      starts_at: '',
      date_precision: 'candidates',
      date_candidates: match.date_candidates.slice(),
      title: `${label} キックオフ（開催日が候補のまま）`,
    });
  }

  return Object.assign(base, {
    starts_at: '',
    date_precision: 'unknown',
    date_candidates: [],
    title: `${label} キックオフ（試合日が未定）`,
  });
}

/**
 * 画面に出る状態は、ページが実際に書いている語からだけ決める。
 *
 * **`before_sale` を持つのは、行に「発売前」と書いてある場合だけ。**
 * 行そのものが無いことは、いまも「発売前」を意味しない（未発売なのか、
 * 別のプレイガイドで売っているのか区別できない）。両者は別の話で、
 * 前者は観測できる事実、後者は観測できない推測。
 *
 * 知らない語は `unknown` にして、画面では何も言わない。
 * 取り違えて「発売中」と言い切るより、黙るほうがよい。
 */
const AWAY_STATE_BY_RAW = new Map([
  ['空席あり', 'on_sale'],
  ['空席わずか', 'on_sale'],
  ['残りわずか', 'on_sale'],
  ['完売', 'sold_out'],
  ['発売前', 'before_sale'],
]);

function awayStateOf(stateRaw) {
  return AWAY_STATE_BY_RAW.get((stateRaw || '').trim()) || 'unknown';
}

/**
 * アウェイ戦の販売状態。Jリーグチケットに載っている試合だけが対象で、
 * 全アウェイ戦ではない。載っていない試合は何も持たない（「発売前」と扱わない）。
 *
 * 試合との対応付けは日付で行う。相手の表記が「横浜Ｆ・マリノス」と「横浜FM」で
 * 揃わないため、名前では結び付けない。1日に2試合はないので日付が鍵になる。
 */
/**
 * 記事から読み取った日時を、タイムラインのイベントにする。
 *
 * **種類ごとに出し方が違う。** 買う・申し込むものは ACTION、開く・始まるものは
 * INFORMATION（docs/supporter-timeline-design.md の「表示カテゴリ」）。
 */
const NEWS_TIME_KINDS = {
  '当日の流れ': { type: 'event', action_type: 'information' },
  '物販ブース': { type: 'goods', action_type: 'information' },
  // 当日券は公式の販売スケジュール表（先行5段階＋引換3件）には載らない別口。
  // ticket_kind を分けて、8段階の数え上げから外す。
  '当日券': { type: 'ticket', action_type: 'action', ticket_kind: 'same_day' },
  '応募の締切': { type: 'entry', action_type: 'action' },
};

/**
 * 記事から読み取った日時を読み込み、手入力で上書きする。
 *
 * **上書きできる余地を必ず残す。** チケットの販売スケジュールは公式の表という
 * 構造化された出典から取るが、こちらは記事の本文から読み取っている。取り違えは起きうる。
 * 量が多い（1シーズン150件ほどの見込み）ので人が全部入力するのは回らないが、
 * **間違いを見つけたら1行で直せる**ようにしておく。
 *
 * `docs/sheets/news-times.manual.csv` の `action` が `drop` なら消し、
 * `edit` なら `label` と `starts_at` を差し替える。
 */
function buildNewsTimes(csvPath, manualPath, matchIndex) {
  const manual = new Map();
  const problems = [];
  if (manualPath) {
    readCsvRecords(manualPath, { allowEmpty: true }).forEach((record) => {
      if (!record.event_id) return;
      if (record.action !== 'drop' && record.action !== 'edit') {
        problems.push(`action は drop か edit です: ${record.event_id}（${record.action}）`);
        return;
      }
      manual.set(record.event_id, record);
    });
  }

  const events = [];
  readCsvRecords(csvPath, { allowEmpty: true }).forEach((record) => {
    if (!record.event_id || !record.starts_at || !record.match_id) return;
    const match = matchIndex.get(record.match_id);
    if (!match) { problems.push(`matches.json にない試合IDです: ${record.match_id}`); return; }
    const shape = NEWS_TIME_KINDS[record.kind];
    if (!shape) { problems.push(`知らない種類です: ${record.kind}（${record.event_id}）`); return; }

    const override = manual.get(record.event_id);
    if (override && override.action === 'drop') return;
    const label = (override && override.label) || record.label;
    const startsAt = (override && override.starts_at) || record.starts_at;

    events.push({
      id: record.event_id,
      starts_at: startsAt,
      ends_at: '',
      date_precision: 'datetime',
      date_candidates: [],
      type: shape.type,
      ...(shape.ticket_kind ? { ticket_kind: shape.ticket_kind } : {}),
      title: `${matchLabel(match)} ${label}`,
      source: 'official',
      action_type: shape.action_type,
      // **記事の本文から読み取ったものだと画面で分かるようにする。**
      // 公式の販売スケジュール表から取るチケットと、同じ確かさに見せない。
      derived_from: override ? 'news_article_edited' : 'news_article',
      news_kind: record.kind,
      audience: {},
      interest_tags: [],
      match_ids: [record.match_id],
      source_url: record.source_url,
      source_checked_at: (record.retrieved_at_jst || '').slice(0, 10),
      status: 'confirmed',
      is_visible: true,
    });
  });

  return { events, problems };
}

/**
 * ニュース一覧のCSVから、試合ごとの案内の件数をまとめる。
 *
 * **日時を持たない。** ここで作るのは「この試合の案内が何件あり、どこにあるか」だけで、
 * 時系列のイベントにはしない。記事の中の日時は揺れるため、層1では扱わない
 * （docs/supporter-timeline-design.md の「イベント・配布・物販の取り込み」）。
 *
 * **題も持たない。** 公式の記事タイトルは保存も転載もしないため、CSVにも入っていない。
 * 画面に出せるのは公開日・カテゴリ・リンクの3つで、中身はリンク先で読んでもらう。
 */
function buildNews(csvPath, matches, checkedAt) {
  const records = readCsvRecords(csvPath);
  const known = new Set(matches.map((match) => match.id));
  const byMatch = new Map();
  let linked = 0;

  records.forEach((record) => {
    const ids = (record.match_ids || "").split(" ").filter(Boolean).filter((id) => known.has(id));
    if (!ids.length) return;
    linked += 1;
    ids.forEach((id) => {
      if (!byMatch.has(id)) byMatch.set(id, []);
      byMatch.get(id).push({
        published_on: record.published_on,
        category: record.category,
        source_url: record.source_url,
      });
    });
  });

  const list = Array.from(byMatch.entries()).map(([matchId, articles]) => {
    // 新しい順。同じ日なら記事IDの大きいほうが新しいが、CSVがすでにその順で並ぶ。
    const counts = new Map();
    articles.forEach((article) => { counts.set(article.category, (counts.get(article.category) || 0) + 1); });
    return {
      match_id: matchId,
      count: articles.length,
      categories: Array.from(counts.entries())
        .sort((x, y) => (y[1] - x[1]) || (x[0] < y[0] ? -1 : 1))
        .map(([name, count]) => ({ name, count })),
      articles,
    };
  }).sort((x, y) => (x.match_id < y.match_id ? -1 : 1));

  return {
    source: NEWS_SOURCE_URL,
    csv: path.relative(repoRoot, path.resolve(csvPath)),
    checked_at: checkedAt,
    article_count: records.length,
    linked_count: linked,
    by_match: list,
  };
}

function buildAwayTickets(csvPath, matches) {
  const records = readCsvRecords(csvPath).filter((record) => record.match_date);
  const byDate = new Map();
  matches.forEach((match) => {
    if (match.home_away !== 'A' || !match.match_date) return;
    if (byDate.has(match.match_date)) byDate.set(match.match_date, null); // 同日に複数あれば決められない
    else byDate.set(match.match_date, match);
  });

  const tickets = [];
  const unmatched = [];
  records.forEach((record) => {
    const match = byDate.get(record.match_date);
    if (!match) {
      unmatched.push(`${record.match_date} ${record.opponent_raw}`);
      return;
    }
    tickets.push({
      match_id: match.id,
      state: awayStateOf(record.state_raw),
      state_note: record.state_raw || '',
      checked_at: (record.retrieved_at_jst || '').slice(0, 10),
      source_url: record.perform_url,
    });
  });

  tickets.sort((a, b) => a.match_id.localeCompare(b.match_id));
  return { tickets, unmatched };
}

/**
 * アウェイ席の発売開始日時。手で入れたCSVから作る。
 *
 * Jリーグチケットに載らない試合（神戸は楽天チケット、柏はローソンチケットなど）と、
 * まだ発売前で試合ページが無い試合は、対戦クラブ公式を見て手で入れる。年24試合、
 * 1試合1回で回る。**出典は必ずクラブ公式で、SNSやまとめは手掛かりであって出典ではない。**
 */
function awaySaleEvent(record, match) {
  const opponent = match.opponent || '未定';
  const label = record.sale_label || 'アウェイ席 発売';
  return {
    id: `ticket-${match.id}-away`,
    starts_at: record.starts_at,
    ends_at: plusMinutes(record.starts_at, SALE_MINUTES),
    date_precision: 'datetime',
    date_candidates: [],
    type: 'ticket',
    ticket_kind: 'away_sale',
    title: `${opponent}戦 ${label}`,
    source: 'official',
    action_type: 'action',
    // アウェイ席は相手クラブの会員か一般販売で、SANGA CREW の等級は効かない。
    audience: {},
    interest_tags: [],
    match_ids: [match.id],
    source_url: record.source_url,
    source_checked_at: record.checked_at,
    status: 'confirmed',
    is_visible: true,
  };
}

/**
 * 試合ページから取った一般発売。日付で試合に結び付ける（相手の表記が揃わないため）。
 * **手入力（--away-sales）が同じ試合を持っていれば、そちらを優先する。**
 * 人がクラブ公式で確認したもののほうが確かで、あとから上書きできる余地を残す。
 */
function buildAwaySalesCurrent(csvPath, matchIndex, takenMatchIds) {
  const records = readCsvRecords(csvPath).filter((record) => record.match_date && record.starts_at);
  const byDate = new Map();
  matchIndex.forEach((match) => {
    if (match.home_away !== 'A' || !match.match_date) return;
    if (byDate.has(match.match_date)) byDate.set(match.match_date, null);
    else byDate.set(match.match_date, match);
  });

  const events = [];
  const problems = [];
  records.forEach((record) => {
    const match = byDate.get(record.match_date);
    if (!match) {
      problems.push(`日付から試合を決められません: ${record.match_date}`);
      return;
    }
    if (takenMatchIds.has(match.id)) return; // 手入力が優先
    events.push(awaySaleEvent(record, match));
  });

  return { events, problems };
}

function buildAwaySales(csvPath, matchIndex) {
  // 見出しだけで中身が無いのが通常の状態。公式で日時が出た試合から1行ずつ足していく。
  const text = fs.readFileSync(csvPath, 'utf8').replace(/^\ufeff/, '');
  const hasRows = text.split('\n').slice(1).some((line) => line.trim() !== '');
  if (!hasRows) return { events: [], problems: [] };

  const records = readCsvRecords(csvPath).filter((record) => record.match_id);
  const events = [];
  const problems = [];

  records.forEach((record) => {
    const match = matchIndex.get(record.match_id);
    if (!match) {
      problems.push(`matches.json にない試合IDです: ${record.match_id}`);
      return;
    }
    if (match.home_away !== 'A') {
      problems.push(`アウェイ戦ではありません: ${record.match_id}`);
      return;
    }
    if (!record.starts_at) {
      problems.push(`starts_at が空です: ${record.match_id}`);
      return;
    }
    if (!record.source_url) {
      problems.push(`source_url が空です: ${record.match_id}（出典はクラブ公式のURL）`);
      return;
    }
    events.push(awaySaleEvent(record, match));
  });

  return { events, problems };
}

function sortEvents(events) {
  return events.slice().sort((a, b) => {
    const left = a.starts_at || '9999';
    const right = b.starts_at || '9999';
    if (left !== right) return left < right ? -1 : 1;
    return a.id < b.id ? -1 : 1;
  });
}

function build(options) {
  const records = readCsvRecords(options.csvPath).filter((record) => record.season);
  if (records.length === 0) throw new Error('CSVに対象の行がありません');

  const matchIndex = buildMatchIndex(options.matchesPath);
  const checkedAt = options.checkedAt
    || (records[0].retrieved_at_jst || '').slice(0, 10)
    || new Date().toISOString().slice(0, 10);

  // 版の「変わった時刻」に使う。CSVを取り直した時刻を1つだけ使い、行ごとには持たない。
  const parsedSnapshot = new Date(records[0].retrieved_at_jst || '');
  const snapshotAt = Number.isNaN(parsedSnapshot.getTime()) ? new Date() : parsedSnapshot;

  const events = [];
  const rounds = new Set();

  records.forEach((record) => {
    const matchId = matchIdFor(record.competition, record.round);
    const match = matchIndex.get(matchId);
    if (!match) throw new Error(`matches.json に該当する試合がありません: ${matchId}`);
    rounds.add(matchId);
    events.push(ticketEvent(record, match, checkedAt));
  });

  let awaySaleProblems = [];
  const awaySaleMatchIds = new Set();
  if (options.awaySalesPath) {
    const sales = buildAwaySales(options.awaySalesPath, matchIndex);
    sales.events.forEach((event) => {
      events.push(event);
      rounds.add(event.match_ids[0]);
      awaySaleMatchIds.add(event.match_ids[0]);
    });
    awaySaleProblems = sales.problems;
  }

  if (options.awaySalesCurrentPath) {
    const sales = buildAwaySalesCurrent(options.awaySalesCurrentPath, matchIndex, awaySaleMatchIds);
    sales.events.forEach((event) => {
      events.push(event);
      rounds.add(event.match_ids[0]);
    });
    awaySaleProblems = awaySaleProblems.concat(sales.problems);
  }

  let awayTickets = [];
  let awayUnmatched = [];
  if (options.awayPath) {
    const away = buildAwayTickets(options.awayPath, Array.from(matchIndex.values()));
    awayTickets = away.tickets;
    awayUnmatched = away.unmatched;
    // アウェイ席が発売中の試合も時系列に出す。試合そのもののイベントが無いと、
    // 販売状態を添える先が画面に無い。
    awayTickets.forEach((ticket) => { rounds.add(ticket.match_id); });
  }

  // **日程が確定した試合は、チケットの情報が無くても時系列に出す。**
  // これを入れる前は、試合イベントはチケット情報の副産物だった。ホーム戦は公式の
  // 販売スケジュールに1試合8段階ぶん載るので自動的に揃うが、アウェイ戦は情報源が
  // 試合ごとに違い、揃わない試合は**試合そのものが画面から消えていた**。
  // 2026-09-10 時点でアウェイ24試合のうち20試合、ACL4試合が全部そうだった。
  //
  // 日程未定の試合は足さない。ただしチケット情報を持つ試合（販売日程だけ先に
  // 決まっているホーム戦など）は、これまでどおり上で rounds に入っている。
  matchIndex.forEach((match) => {
    if (match.match_date) rounds.add(match.id);
  });

  Array.from(rounds).sort().forEach((matchId) => {
    events.push(matchEvent(matchIndex.get(matchId)));
  });

  let news = null;
  if (options.newsPath) {
    news = buildNews(options.newsPath, Array.from(matchIndex.values()), checkedAt);
  }

  let newsTimeProblems = [];
  if (options.newsTimesPath) {
    const built = buildNewsTimes(options.newsTimesPath, options.newsTimesManualPath, matchIndex);
    built.events.forEach((event) => {
      events.push(event);
      rounds.add(event.match_ids[0]);
    });
    newsTimeProblems = built.problems;
  }

  let skipped = [];
  if (options.samplesPath) {
    const samples = JSON.parse(fs.readFileSync(options.samplesPath, 'utf8'));
    (samples.events || []).forEach((event) => {
      events.push(Object.assign({}, event, { is_sample: true }));
    });
    skipped = samples.skipped || [];
  }

  return {
    awayUnmatched,
    awaySaleProblems,
    newsTimeProblems,
    meta: {
      note: options.samplesPath
        ? 'チケット販売と試合は実データ。作り物のイベントには is_sample: true が付く。tools/generate-calendar-events.js が生成する。手で編集しない。'
        : 'チケット販売と試合の実データ。tools/generate-calendar-events.js が生成する。手で編集しない。',
      generator: 'tools/generate-calendar-events.js',
      ticket_source: SOURCE_URL,
      ticket_checked_at: checkedAt,
      ticket_csv: path.relative(repoRoot, path.resolve(options.csvPath)),
      matches_source: path.relative(repoRoot, path.resolve(options.matchesPath)),
      match_count: rounds.size,
      ics_template_version: ICS_TEMPLATE_VERSION,
      updated_at: checkedAt,
    },
    events: applyVersions(sortEvents(events), snapshotAt, readPrevious(options.outputPath)),
    skipped,
    away_tickets: awayTickets,
    news,
  };
}

function main(argv) {
  const positional = [];
  const options = { matchesPath: DEFAULT_MATCHES, samplesPath: '', awayPath: '', awaySalesPath: '', awaySalesCurrentPath: '', newsPath: '', newsTimesPath: '', newsTimesManualPath: '', checkedAt: '', check: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--matches') { options.matchesPath = argv[i += 1]; continue; }
    if (arg === '--samples') { options.samplesPath = argv[i += 1]; continue; }
    if (arg === '--away') { options.awayPath = argv[i += 1]; continue; }
    if (arg === '--away-sales') { options.awaySalesPath = argv[i += 1]; continue; }
    if (arg === '--away-sales-current') { options.awaySalesCurrentPath = argv[i += 1]; continue; }
    if (arg === '--news') { options.newsPath = argv[i += 1]; continue; }
    if (arg === '--news-times') { options.newsTimesPath = argv[i += 1]; continue; }
    if (arg === '--news-times-manual') { options.newsTimesManualPath = argv[i += 1]; continue; }
    if (arg === '--checked-at') { options.checkedAt = argv[i += 1]; continue; }
    if (arg === '--check') { options.check = true; continue; }
    if (arg === '-h' || arg === '--help') { usage(); return 0; }
    if (arg.startsWith('--')) { console.error(`知らない引数です: ${arg}`); usage(); return 1; }
    positional.push(arg);
  }

  if (positional.length === 0) { usage(); return 1; }
  options.csvPath = positional[0];
  const outputPath = positional[1] || DEFAULT_OUTPUT;
  // 版は前回の生成物と見比べて決めるため、出力先を build() に渡す。
  options.outputPath = outputPath;

  let data;
  try {
    data = build(options);
  } catch (error) {
    console.error(`生成に失敗しました: ${error.message}`);
    return 1;
  }

  // 突き合わせに失敗した行は生成物に入れず、実行時の警告として出す。
  const awayUnmatched = data.awayUnmatched || [];
  delete data.awayUnmatched;
  const awaySaleProblems = data.awaySaleProblems || [];
  delete data.awaySaleProblems;
  const newsTimeProblems = data.newsTimeProblems || [];
  delete data.newsTimeProblems;

  if (newsTimeProblems.length) {
    console.error(`記事から読んだ日時に問題があります（${newsTimeProblems.length}件）。その行は取り込んでいません。`);
    newsTimeProblems.forEach((line) => { console.error(`  ${line}`); });
  }

  if (awaySaleProblems.length) {
    console.error(`アウェイ席の手入力に問題があります（${awaySaleProblems.length}件）。その行は取り込んでいません。`);
    awaySaleProblems.forEach((line) => { console.error(`  ${line}`); });
  }

  const text = `${JSON.stringify(data, null, 2)}\n`;

  if (awayUnmatched.length) {
    console.error(`アウェイ戦の突き合わせに失敗しました（${awayUnmatched.length}件）。日付が matches.json のアウェイ戦と一致しません。`);
    awayUnmatched.forEach((line) => { console.error(`  ${line}`); });
  }

  if (options.check) {
    if (!fs.existsSync(outputPath)) {
      console.error(`差分検出: ${path.relative(repoRoot, outputPath)} がありません。生成コマンドを実行してください。`);
      return 1;
    }
    if (fs.readFileSync(outputPath, 'utf8') !== text) {
      console.error(`差分検出: ${path.relative(repoRoot, outputPath)} が生成結果と一致しません。生成コマンドを実行して結果をコミットしてください。`);
      return 1;
    }
    console.log(`生成物OK: ${path.relative(repoRoot, outputPath)} は CSV と matches.json から生成した結果と一致しています。`);
    return 0;
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, text);
  const awayNote = data.away_tickets.length ? `・アウェイ販売中${data.away_tickets.length}件` : '';
  const newsNote = data.news ? `・案内${data.news.linked_count}件（${data.news.by_match.length}試合）` : '';
  console.log(`生成しました: ${path.relative(repoRoot, outputPath)}（イベント${data.events.length}件・試合${data.meta.match_count}件${awayNote}${newsNote}）`);
  return 0;
}

process.exit(main(process.argv.slice(2)));
