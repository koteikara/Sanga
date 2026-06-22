#!/usr/bin/env node

const fs = require('fs');

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MIN_DATE = '2026-08-01';
const MAX_DATE = '2027-06-30';
const ALLOWED_HOME_AWAY = new Set(['', 'H', 'A']);
const ALLOWED_STATUS = new Set(['confirmed', 'tentative']);
const ALLOWED_COMPETITIONS = new Set(['J1', 'LEV', 'EMP', 'ACL', 'FRI']);
const ALLOWED_MATCH_STATUS = new Set(['試合前', '試合中', '試合終了', '延期', '中止', '未定']);
const ALLOWED_RESULTS = new Set(['勝', '分', '敗', '未定']);
const TIME_PATTERN = /^\d{2}:\d{2}$/;
const URL_PATTERN = /^https?:\/\//;
const REQUIRED_META_FIELDS = ['season', 'team', 'updated_at', 'source'];
const REQUIRED_MATCH_FIELDS = [
  'id',
  'season',
  'competition',
  'competition_label',
  'round',
  'opponent',
  'venue',
  'status',
  'status_label',
];

function usage() {
  console.error('使い方: node tools/validate-generated-matches.js <generated.json> [--expected-count 件数] [--strict]');
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = {
    filePath: '',
    expectedCount: null,
    strict: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--strict') {
      options.strict = true;
      continue;
    }

    if (arg === '--expected-count') {
      const value = args[index + 1];
      if (!value || !/^\d+$/.test(value)) {
        throw new Error('--expected-count には正の整数を指定してください。');
      }
      options.expectedCount = Number(value);
      index += 1;
      continue;
    }

    if (arg.startsWith('--')) {
      throw new Error(`未対応のオプションです: ${arg}`);
    }

    if (options.filePath) {
      throw new Error(`入力ファイルは1つだけ指定してください: ${arg}`);
    }
    options.filePath = arg;
  }

  if (!options.filePath) {
    throw new Error('検証対象のJSONファイルを指定してください。');
  }

  return options;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function addIssue(issues, location, message) {
  issues.push(`${location}: ${message}`);
}

function isRealDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validateDateValue(errors, warnings, location, field, value) {
  if (!DATE_PATTERN.test(value)) {
    addIssue(errors, location, `${field} は YYYY-MM-DD 形式で入力してください。`);
    return;
  }

  if (!isRealDate(value)) {
    addIssue(errors, location, `${field} は実在する日付で入力してください。`);
    return;
  }

  if (value < MIN_DATE || value > MAX_DATE) {
    addIssue(warnings, location, `${field} は原則 ${MIN_DATE} から ${MAX_DATE} の範囲内にしてください。`);
  }
}

function hasNoteNumber(note) {
  return /^※\d+(?:[:：]|\s|$)/.test(String(note || '').trim());
}


function isEmptyValue(value) {
  return value === undefined || value === null || value === '';
}

function validateOptionalString(errors, location, field, value) {
  if (!isEmptyValue(value) && typeof value !== 'string') {
    addIssue(errors, location, `${field} は文字列で入力してください。`);
  }
}

function validateOptionalUrl(warnings, location, field, value) {
  if (isEmptyValue(value)) return;
  if (typeof value !== 'string' || !URL_PATTERN.test(value)) {
    addIssue(warnings, location, `${field} は http:// または https:// で始まるURLを推奨します。`);
  }
}

function validateOptionalScore(errors, location, field, value) {
  if (isEmptyValue(value)) return;
  if (Number.isNaN(Number(value))) {
    addIssue(errors, location, `${field} は数値として扱える値で入力してください。`);
  }
}

function validateMatch(match, index, seenIds, errors, warnings) {
  const location = isPlainObject(match) && isNonEmptyString(match.id) ? match.id : `matches[${index}]`;

  if (!isPlainObject(match)) {
    addIssue(errors, location, '各試合はオブジェクトである必要があります。');
    return;
  }

  REQUIRED_MATCH_FIELDS.forEach((field) => {
    if (!isNonEmptyString(match[field])) {
      addIssue(errors, location, `${field} は必須です。`);
    }
  });

  if (isNonEmptyString(match.id)) {
    if (seenIds.has(match.id)) {
      addIssue(errors, location, `id が ${seenIds.get(match.id)} と重複しています。`);
    } else {
      seenIds.set(match.id, location);
    }
  }

  if (!ALLOWED_HOME_AWAY.has(match.home_away)) {
    addIssue(errors, location, 'home_away は H または A または空欄にしてください。');
  }

  if (!ALLOWED_STATUS.has(match.status)) {
    addIssue(errors, location, 'status は confirmed または tentative にしてください。');
  }

  if (!ALLOWED_COMPETITIONS.has(match.competition)) {
    addIssue(errors, location, 'competition は J1 / LEV / EMP / ACL / FRI のいずれかにしてください。');
  }

  if (isNonEmptyString(match.kickoff_time) && !TIME_PATTERN.test(match.kickoff_time)) {
    addIssue(errors, location, 'kickoff_time は HH:MM 形式で入力してください。');
  }

  if (!isEmptyValue(match.match_status) && !ALLOWED_MATCH_STATUS.has(match.match_status)) {
    addIssue(errors, location, 'match_status は 試合前 / 試合中 / 試合終了 / 延期 / 中止 / 未定 のいずれかにしてください。');
  }

  validateOptionalScore(errors, location, 'kyoto_score', match.kyoto_score);
  validateOptionalScore(errors, location, 'opponent_score', match.opponent_score);

  if (!isEmptyValue(match.result) && !ALLOWED_RESULTS.has(match.result)) {
    addIssue(errors, location, 'result は 勝 / 分 / 敗 / 未定 のいずれかにしてください。');
  }

  validateOptionalUrl(warnings, location, 'ticket_url', match.ticket_url);
  validateOptionalUrl(warnings, location, 'event_url', match.event_url);
  validateOptionalUrl(warnings, location, 'broadcast_url', match.broadcast_url);
  validateOptionalString(errors, location, 'public_note', match.public_note);
  validateOptionalString(errors, location, 'share_title', match.share_title);

  if (!isEmptyValue(match.is_visible) && typeof match.is_visible !== 'boolean') {
    addIssue(errors, location, 'is_visible は boolean で入力してください。');
  }

  const hasMatchDate = isNonEmptyString(match.match_date);
  const hasDateCandidatesField = hasOwn(match, 'date_candidates');

  if (!hasDateCandidatesField) {
    addIssue(errors, location, 'date_candidates は配列で指定してください。');
  } else if (!Array.isArray(match.date_candidates)) {
    addIssue(errors, location, 'date_candidates は配列で指定してください。');
  }

  const candidates = Array.isArray(match.date_candidates) ? match.date_candidates : [];

  if (hasMatchDate && candidates.length > 0) {
    addIssue(errors, location, 'match_date と date_candidates は同時に指定できません。');
  }

  if (hasMatchDate) {
    validateDateValue(errors, warnings, location, 'match_date', match.match_date);
  }

  let previousCandidate = null;
  candidates.forEach((candidate, candidateIndex) => {
    const field = `date_candidates[${candidateIndex}]`;

    if (!isNonEmptyString(candidate)) {
      addIssue(errors, location, `${field} は空でない文字列で入力してください。`);
      return;
    }

    validateDateValue(errors, warnings, location, field, candidate);

    if (previousCandidate && previousCandidate > candidate) {
      addIssue(errors, location, 'date_candidates は昇順で入力してください。');
    }
    previousCandidate = candidate;
  });

  if (isNonEmptyString(match.note) && match.note.includes('※') && !hasNoteNumber(match.note)) {
    addIssue(errors, location, 'note の注記番号は「※数字」で判別できる形式にしてください。');
  }

  if (match.status === 'confirmed' && !hasMatchDate) {
    addIssue(warnings, location, 'status が confirmed の場合は、原則 match_date を指定してください。');
  }

  if (match.status === 'tentative' && hasMatchDate && candidates.length === 0 && !isNonEmptyString(match.note)) {
    addIssue(warnings, location, 'status が tentative ですが match_date が指定されています。確定扱いでよいか確認してください。');
  }
}

function validateData(data, options) {
  const errors = [];
  const warnings = [];

  if (!isPlainObject(data)) {
    addIssue(errors, 'root', 'ルートはオブジェクトである必要があります。');
    return { errors, warnings, count: 0 };
  }

  if (!isPlainObject(data.meta)) {
    addIssue(errors, 'meta', 'meta が存在し、オブジェクトである必要があります。');
  } else {
    REQUIRED_META_FIELDS.forEach((field) => {
      if (!isNonEmptyString(data.meta[field])) {
        addIssue(errors, 'meta', `${field} は必須です。`);
      }
    });
  }

  if (!Array.isArray(data.matches)) {
    addIssue(errors, 'matches', 'matches は配列である必要があります。');
    return { errors, warnings, count: 0 };
  }

  if (data.matches.length === 0) {
    addIssue(errors, 'matches', 'matches は空にできません。');
  }

  if (options.expectedCount !== null && data.matches.length !== options.expectedCount) {
    addIssue(errors, 'matches', `件数は${options.expectedCount}件である必要があります（現在 ${data.matches.length} 件）。`);
  }

  const seenIds = new Map();
  data.matches.forEach((match, index) => validateMatch(match, index, seenIds, errors, warnings));

  return { errors, warnings, count: data.matches.length };
}

function readJson(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new Error(`${filePath} を読み込めません: ${error.message}`);
  }

  try {
    return JSON.parse(raw.replace(/^\uFEFF/, ''));
  } catch (error) {
    throw new Error(`JSONとして読み込めません: ${error.message}`);
  }
}

function printResult(filePath, result, strict) {
  const effectiveErrors = strict ? result.errors.concat(result.warnings.map((warning) => `strict: ${warning}`)) : result.errors;

  if (effectiveErrors.length > 0) {
    console.error('生成JSONの検証に失敗しました。');
    effectiveErrors.forEach((error) => console.error(`- ${error}`));
    if (!strict && result.warnings.length > 0) {
      console.error('警告:');
      result.warnings.forEach((warning) => console.error(`- ${warning}`));
    }
  } else {
    console.log('生成JSONの検証に成功しました。');
    if (result.warnings.length > 0) {
      console.log('警告:');
      result.warnings.forEach((warning) => console.log(`- ${warning}`));
    }
  }

  console.log(`対象: ${filePath}`);
  console.log(`件数: ${result.count}`);
  console.log(`警告: ${result.warnings.length}`);
  console.log(`エラー: ${effectiveErrors.length}`);

  return effectiveErrors.length > 0 ? 1 : 0;
}

function main() {
  const options = parseArgs(process.argv);
  const data = readJson(options.filePath);
  const result = validateData(data, options);
  process.exitCode = printResult(options.filePath, result, options.strict);
}

try {
  main();
} catch (error) {
  console.error('生成JSONの検証に失敗しました。');
  console.error(`- ${error.message}`);
  usage();
  process.exit(1);
}
