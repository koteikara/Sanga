#!/usr/bin/env node

/**
 * calendar-events の検証。
 *
 * 仕様は docs/supporter-timeline-design.md の「情報モデル」「日時の確からしさ」
 * 「販売段階は8つある」を正とする。検証なしで公開データを増やさない方針のための道具。
 *
 * 使い方: node tools/validate-calendar-events.js <calendar-events.json> [--matches <path>]
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const DEFAULT_MATCHES = path.join(repoRoot, 'public', 'data', 'matches.json');

const PRECISIONS = new Set(['datetime', 'date', 'candidates', 'unknown']);
const TYPES = new Set(['ticket', 'entry', 'event', 'goods', 'match', 'personal']);
const ACTION_TYPES = new Set(['action', 'information', 'personal']);
const SOURCES = new Set(['official', 'personal']);
const STATUSES = new Set(['confirmed', 'tentative']);
const TICKET_KINDS = new Set(['sale', 'benefit_exchange', 'unscheduled']);
const GRADES = new Set(['platinum', 'gold', 'regular', 'kids']);

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/;

const errors = [];

function addError(location, message) {
  errors.push(`${location}: ${message}`);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function checkAudience(location, audience) {
  if (audience === undefined) return;
  if (audience === null || typeof audience !== 'object' || Array.isArray(audience)) {
    addError(location, 'audience はオブジェクトである必要があります');
    return;
  }
  Object.keys(audience).forEach((key) => {
    if (key !== 'fc_grade' && key !== 'season_ticket') {
      addError(location, `audience に知らないキーがあります: ${key}`);
    }
  });
  if (hasOwn(audience, 'season_ticket') && typeof audience.season_ticket !== 'boolean') {
    addError(location, 'audience.season_ticket は真偽値である必要があります');
  }
  if (hasOwn(audience, 'fc_grade')) {
    if (!Array.isArray(audience.fc_grade) || audience.fc_grade.length === 0) {
      addError(location, 'audience.fc_grade は1件以上の配列である必要があります');
      return;
    }
    audience.fc_grade.forEach((grade) => {
      if (!GRADES.has(grade)) addError(location, `audience.fc_grade に知らない会員種別があります: ${grade}`);
    });
  }
}

/** 日時の確からしさと、starts_at / date_candidates の組み合わせを突き合わせる。 */
function checkDates(location, event) {
  const precision = event.date_precision;
  const candidates = Array.isArray(event.date_candidates) ? event.date_candidates : [];

  if (!Array.isArray(event.date_candidates)) {
    addError(location, 'date_candidates は配列である必要があります');
  }
  candidates.forEach((value) => {
    if (!DATE_PATTERN.test(value)) addError(location, `date_candidates の日付が不正です: ${value}`);
  });

  if (precision === 'datetime' || precision === 'date') {
    if (!DATETIME_PATTERN.test(event.starts_at || '')) {
      addError(location, `starts_at は ISO 8601（+09:00付き）である必要があります: ${event.starts_at}`);
    }
    if (candidates.length > 0) {
      addError(location, `date_precision が ${precision} のとき date_candidates は空である必要があります`);
    }
  } else if (precision === 'candidates') {
    if (isNonEmptyString(event.starts_at)) {
      addError(location, 'date_precision が candidates のとき starts_at は空である必要があります');
    }
    // 候補が1件のこともある（日付は挙がっているが確定していない）。matches.json の第32節がその例。
    if (candidates.length < 1) {
      addError(location, 'date_precision が candidates のとき date_candidates が必要です');
    }
  } else if (precision === 'unknown') {
    if (isNonEmptyString(event.starts_at)) {
      addError(location, 'date_precision が unknown のとき starts_at は空である必要があります');
    }
    if (candidates.length > 0) {
      addError(location, 'date_precision が unknown のとき date_candidates は空である必要があります');
    }
  }

  if (isNonEmptyString(event.ends_at)) {
    if (!DATETIME_PATTERN.test(event.ends_at)) {
      addError(location, `ends_at は ISO 8601（+09:00付き）である必要があります: ${event.ends_at}`);
    } else if (isNonEmptyString(event.starts_at) && event.ends_at < event.starts_at) {
      addError(location, 'ends_at が starts_at より前です');
    }
  }
}

function checkEvent(event, index, matchIds) {
  const location = `events[${index}]${event && event.id ? ` (${event.id})` : ''}`;

  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    addError(location, 'イベントはオブジェクトである必要があります');
    return;
  }

  ['id', 'starts_at', 'ends_at', 'date_precision', 'date_candidates', 'type', 'title',
    'source', 'action_type', 'match_ids', 'status', 'is_visible'].forEach((key) => {
    if (!hasOwn(event, key)) addError(location, `${key} がありません`);
  });

  if (!isNonEmptyString(event.id)) addError(location, 'id が空です');
  if (!isNonEmptyString(event.title)) addError(location, 'title が空です');
  if (!PRECISIONS.has(event.date_precision)) addError(location, `date_precision が不正です: ${event.date_precision}`);
  if (!TYPES.has(event.type)) addError(location, `type が不正です: ${event.type}`);
  if (!ACTION_TYPES.has(event.action_type)) addError(location, `action_type が不正です: ${event.action_type}`);
  if (!SOURCES.has(event.source)) addError(location, `source が不正です: ${event.source}`);
  if (!STATUSES.has(event.status)) addError(location, `status が不正です: ${event.status}`);
  if (typeof event.is_visible !== 'boolean') addError(location, 'is_visible は真偽値である必要があります');

  if (hasOwn(event, 'ticket_kind') && !TICKET_KINDS.has(event.ticket_kind)) {
    addError(location, `ticket_kind が不正です: ${event.ticket_kind}`);
  }
  if (event.type === 'ticket' && !hasOwn(event, 'ticket_kind')) {
    addError(location, 'type が ticket のとき ticket_kind が必要です');
  }

  if (event.source === 'personal' || event.action_type === 'personal' || event.type === 'personal') {
    addError(location, '公開データに個人の予定を含めません');
  }

  checkDates(location, event);
  checkAudience(location, event.audience);

  if (!Array.isArray(event.match_ids)) {
    addError(location, 'match_ids は配列である必要があります');
  } else {
    event.match_ids.forEach((id) => {
      if (!matchIds.has(id)) addError(location, `match_ids に matches.json にない試合IDがあります: ${id}`);
    });
  }

  // 誤情報対策として、実データには出典を必須にする。作り物のサンプルは対象外。
  if (!event.is_sample && !isNonEmptyString(event.source_url)) {
    addError(location, 'source_url がありません（実データには出典が必要です）');
  }
  if (!event.is_sample && !isNonEmptyString(event.source_checked_at)) {
    addError(location, 'source_checked_at がありません');
  }
  if (isNonEmptyString(event.source_checked_at) && !DATE_PATTERN.test(event.source_checked_at)) {
    addError(location, `source_checked_at の日付が不正です: ${event.source_checked_at}`);
  }
}

function checkTicketStages(events) {
  // 1試合の販売は先行5段階と特典チケット引換3件。段階が欠けたり重複したら知らせる。
  const byMatch = new Map();
  events.forEach((event) => {
    if (!event || event.type !== 'ticket' || event.ticket_kind === 'unscheduled') return;
    const matchId = (event.match_ids || [])[0];
    if (!matchId) return;
    if (!byMatch.has(matchId)) byMatch.set(matchId, []);
    byMatch.get(matchId).push(event);
  });

  byMatch.forEach((list, matchId) => {
    const suffixes = list.map((event) => event.id.replace(`ticket-${matchId}-`, ''));
    const unique = new Set(suffixes);
    if (unique.size !== suffixes.length) {
      addError(`match ${matchId}`, 'チケットイベントのIDが重複しています');
    }
    if (list.length !== 8) {
      addError(`match ${matchId}`, `チケットイベントが8件ではありません: ${list.length}件`);
    }
  });
}

function main(argv) {
  const positional = [];
  let matchesPath = DEFAULT_MATCHES;

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--matches') { matchesPath = argv[i += 1]; continue; }
    if (argv[i] === '-h' || argv[i] === '--help') {
      console.error('使い方: node tools/validate-calendar-events.js <calendar-events.json> [--matches <path>]');
      return 0;
    }
    positional.push(argv[i]);
  }

  if (positional.length === 0) {
    console.error('使い方: node tools/validate-calendar-events.js <calendar-events.json> [--matches <path>]');
    return 1;
  }

  const targetPath = positional[0];
  let data;
  let matchIds;
  try {
    data = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
    const rawMatches = JSON.parse(fs.readFileSync(matchesPath, 'utf8'));
    const matches = Array.isArray(rawMatches) ? rawMatches : rawMatches.matches;
    matchIds = new Set(matches.map((match) => match.id));
  } catch (error) {
    console.error(`読み込みに失敗しました: ${error.message}`);
    return 1;
  }

  if (!Array.isArray(data.events)) {
    console.error('events が配列ではありません');
    return 1;
  }

  const seen = new Set();
  data.events.forEach((event, index) => {
    checkEvent(event, index, matchIds);
    if (event && isNonEmptyString(event.id)) {
      if (seen.has(event.id)) addError(`events[${index}]`, `id が重複しています: ${event.id}`);
      seen.add(event.id);
    }
  });

  checkTicketStages(data.events);

  if (Array.isArray(data.skipped)) {
    data.skipped.forEach((item, index) => {
      if (!item || !isNonEmptyString(item.url)) addError(`skipped[${index}]`, 'url がありません');
      if (!item || !isNonEmptyString(item.reason)) addError(`skipped[${index}]`, 'reason がありません');
    });
  }

  if (errors.length > 0) {
    console.error(`calendar-events の検証に失敗しました（${errors.length}件）:`);
    errors.forEach((message) => console.error(`  ${message}`));
    return 1;
  }

  const ticketCount = data.events.filter((event) => event.type === 'ticket').length;
  const sampleCount = data.events.filter((event) => event.is_sample).length;
  console.log(`calendar-events の検証に成功しました: ${path.relative(repoRoot, path.resolve(targetPath))}`);
  console.log(`  イベント${data.events.length}件（チケット${ticketCount}件・作り物${sampleCount}件）、取り込まなかった記事${(data.skipped || []).length}件`);
  return 0;
}

process.exit(main(process.argv.slice(2)));
