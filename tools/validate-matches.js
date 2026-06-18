#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const matchesPath = path.join(repoRoot, 'public', 'data', 'matches.json');
const htmlPath = path.join(repoRoot, 'public', 'sanga202627season.html');
const expectedCount = 38;
const allowedHomeAway = new Set(['H', 'A']);
const allowedStatus = new Set(['confirmed', 'tentative']);

const errors = [];

function addError(location, field, message) {
  errors.push(`${location}: ${field} - ${message}`);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function hasDateInfo(match) {
  return isNonEmptyString(match.match_date)
    || (Array.isArray(match.date_candidates) && match.date_candidates.length > 0);
}

function expectedId(index) {
  return `sec${String(index + 1).padStart(2, '0')}`;
}

function readJsonFile(filePath) {
  let raw;

  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    addError('matches.json', 'file', `${filePath} を読み込めません: ${error.message}`);
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    addError('matches.json', 'JSON', `JSONとして読み込めません: ${error.message}`);
    return null;
  }
}

function validateMatchesJson(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    addError('matches.json', 'root', 'ルートはオブジェクトである必要があります');
    return;
  }

  if (!Array.isArray(data.matches)) {
    addError('matches.json', 'matches', 'matches は配列である必要があります');
    return;
  }

  if (data.matches.length !== expectedCount) {
    addError('matches.json', 'matches', `件数は${expectedCount}件である必要があります（現在 ${data.matches.length} 件）`);
  }

  const seenIds = new Map();

  data.matches.forEach((match, index) => {
    const location = isNonEmptyString(match && match.id) ? match.id : `matches[${index}]`;

    if (!match || typeof match !== 'object' || Array.isArray(match)) {
      addError(`matches[${index}]`, 'entry', '各要素はオブジェクトである必要があります');
      return;
    }

    if (!isNonEmptyString(match.id)) {
      addError(location, 'id', '空でない文字列である必要があります');
    } else {
      if (seenIds.has(match.id)) {
        addError(location, 'id', `${seenIds.get(match.id)} と重複しています`);
      } else {
        seenIds.set(match.id, location);
      }

      const requiredId = expectedId(index);
      if (match.id !== requiredId) {
        addError(location, 'id', `${requiredId} 形式・順序である必要があります`);
      }
    }

    if (!allowedHomeAway.has(match.home_away)) {
      addError(location, 'home_away', 'H または A のみ指定できます');
    }

    ['opponent', 'venue', 'round'].forEach((field) => {
      if (!isNonEmptyString(match[field])) {
        addError(location, field, '空でない文字列である必要があります');
      }
    });

    if (!hasDateInfo(match)) {
      addError(location, 'match_date/date_candidates', 'match_date または date_candidates のどちらかに日程情報が必要です');
    }

    if (Object.prototype.hasOwnProperty.call(match, 'date_candidates') && !Array.isArray(match.date_candidates)) {
      addError(location, 'date_candidates', '指定する場合は配列である必要があります');
    }

    if (!allowedStatus.has(match.status)) {
      addError(location, 'status', 'confirmed または tentative のみ指定できます');
    }
  });
}

function validateHtmlCards() {
  let html;

  try {
    html = fs.readFileSync(htmlPath, 'utf8');
  } catch (error) {
    addError('sanga202627season.html', 'file', `${htmlPath} を読み込めません: ${error.message}`);
    return;
  }

  const matchCards = html.match(/<button\b[^>]*class="[^"]*\bmatch\b[^"]*"[^>]*data-id="sec\d{2}"/g) || [];

  if (matchCards.length !== expectedCount) {
    addError('sanga202627season.html', 'match cards', `手書き日程カード数は${expectedCount}件である必要があります（現在 ${matchCards.length} 件）`);
  }
}

const data = readJsonFile(matchesPath);
if (data) {
  validateMatchesJson(data);
}
validateHtmlCards();

if (errors.length > 0) {
  console.error('日程データの検証に失敗しました。');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`日程データの検証に成功しました。matches.json は${expectedCount}件、HTMLの手書き日程カードも${expectedCount}件です。`);
