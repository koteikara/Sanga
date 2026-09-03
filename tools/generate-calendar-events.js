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

/** 公式の段階名 → 保存する事実。題は自分の言葉で書き、公式の表記を転載しない。 */
const STAGES = {
  'シーズンパス先行受付（ホーム指定席をご購入の方）': {
    suffix: 'season',
    kind: 'sale',
    audience: { season_ticket: true },
    label: 'シーズンパス先行受付 開始',
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

function readCsvRecords(csvPath) {
  const text = fs.readFileSync(csvPath, 'utf8').replace(/^﻿/, '');
  const rows = parseCsv(text).filter((row) => row.some((cell) => cell.trim() !== ''));
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

function matchIdForRound(round) {
  const number = Number(round);
  if (!Number.isInteger(number) || number < 1) {
    throw new Error(`節の値を数として読めません: ${round}`);
  }
  return `sec${String(number).padStart(2, '0')}`;
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
 * 版の基準時刻。SEQUENCE を Unix秒にすると2038年に32bit符号付き整数を超えるため、
 * 桁を小さく保つ目的で 2024-01-01 UTC を起点にする。
 */
const VERSION_EPOCH_MS = Date.UTC(2024, 0, 1);

/**
 * カレンダー側の版情報を作る。正本はCSVの retrieved_at_jst で、
 * 公式ページを取り直した時刻。行ごとに持つ唯一の「いつ時点の事実か」を表す値。
 *
 * SEQUENCE は非負整数で、同じUIDに対して下がってはいけない。
 * 取得時刻の経過分にすることで、取り直すたびに必ず増える。
 * ただし中身が変わっていない行でも版が上がる点は docs に注意点として書いている。
 */
function calendarVersion(retrievedAt) {
  const parsed = retrievedAt ? new Date(retrievedAt) : null;
  const at = parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date();
  return {
    calendar_sequence: Math.max(0, Math.floor((at.getTime() - VERSION_EPOCH_MS) / 60000)),
    calendar_last_modified: at.toISOString().replace(/\.\d{3}Z$/, 'Z'),
  };
}

function ticketEvent(record, match, checkedAt) {
  const matchId = match.id;
  const opponent = match.opponent || '未定';
  const version = calendarVersion(record.retrieved_at_jst);

  if (record.schedule_status === '未掲載') {
    return Object.assign({
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
    }, version);
  }

  const stage = STAGES[record.sale_type];
  if (!stage) throw new Error(`知らない販売段階です: ${record.sale_type}`);
  if (!record.sale_start) throw new Error(`販売開始日時が空です: ${matchId} ${record.sale_type}`);

  return Object.assign({
    id: `ticket-${matchId}-${stage.suffix}`,
    starts_at: record.sale_start,
    ends_at: '',
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
  }, version);
}

/**
 * 試合そのもののイベント。日時の確からしさは matches.json の状態をそのまま写す。
 * 試合が未確定でも販売日時は確定して告知されるため、両者の date_precision は別に持つ。
 */
function matchEvent(match) {
  const opponent = match.opponent || '未定';
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
    return Object.assign(base, {
      starts_at: `${match.match_date}T${time}:00+09:00`,
      date_precision: match.kickoff_time ? 'datetime' : 'date',
      date_candidates: [],
      title: `${opponent}戦 キックオフ（${match.venue || '会場未定'}）`,
    });
  }

  if (Array.isArray(match.date_candidates) && match.date_candidates.length > 0) {
    return Object.assign(base, {
      starts_at: '',
      date_precision: 'candidates',
      date_candidates: match.date_candidates.slice(),
      title: `${opponent}戦 キックオフ（開催日が候補のまま）`,
    });
  }

  return Object.assign(base, {
    starts_at: '',
    date_precision: 'unknown',
    date_candidates: [],
    title: `${opponent}戦 キックオフ（試合日が未定）`,
  });
}

/**
 * アウェイ戦の販売状態。Jリーグチケットに載っている試合だけが対象で、
 * 全アウェイ戦ではない。載っていない試合は何も持たない（「発売前」と扱わない）。
 *
 * 試合との対応付けは日付で行う。相手の表記が「横浜Ｆ・マリノス」と「横浜FM」で
 * 揃わないため、名前では結び付けない。1日に2試合はないので日付が鍵になる。
 */
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
      state: 'on_sale',
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
    ends_at: '',
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

  const events = [];
  const rounds = new Set();

  records.forEach((record) => {
    const matchId = matchIdForRound(record.round);
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

  Array.from(rounds).sort().forEach((matchId) => {
    events.push(matchEvent(matchIndex.get(matchId)));
  });

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
      updated_at: checkedAt,
    },
    events: sortEvents(events),
    skipped,
    away_tickets: awayTickets,
  };
}

function main(argv) {
  const positional = [];
  const options = { matchesPath: DEFAULT_MATCHES, samplesPath: '', awayPath: '', awaySalesPath: '', awaySalesCurrentPath: '', checkedAt: '', check: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--matches') { options.matchesPath = argv[i += 1]; continue; }
    if (arg === '--samples') { options.samplesPath = argv[i += 1]; continue; }
    if (arg === '--away') { options.awayPath = argv[i += 1]; continue; }
    if (arg === '--away-sales') { options.awaySalesPath = argv[i += 1]; continue; }
    if (arg === '--away-sales-current') { options.awaySalesCurrentPath = argv[i += 1]; continue; }
    if (arg === '--checked-at') { options.checkedAt = argv[i += 1]; continue; }
    if (arg === '--check') { options.check = true; continue; }
    if (arg === '-h' || arg === '--help') { usage(); return 0; }
    if (arg.startsWith('--')) { console.error(`知らない引数です: ${arg}`); usage(); return 1; }
    positional.push(arg);
  }

  if (positional.length === 0) { usage(); return 1; }
  options.csvPath = positional[0];
  const outputPath = positional[1] || DEFAULT_OUTPUT;

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
  console.log(`生成しました: ${path.relative(repoRoot, outputPath)}（イベント${data.events.length}件・試合${data.meta.match_count}件${awayNote}）`);
  return 0;
}

process.exit(main(process.argv.slice(2)));
