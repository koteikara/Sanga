#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const matchesPath = path.join(repoRoot, 'public', 'data', 'matches.json');
const htmlPath = path.join(repoRoot, 'public', 'sanga202627season.html');
const expectedCount = 38;
const allowedHomeAway = new Set(['H', 'A']);
const allowedStatus = new Set(['confirmed', 'tentative']);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const minDate = '2026-08-01';
const maxDate = '2027-06-30';

const errors = [];

function addError(location, field, message) {
  errors.push(`${location}: ${field} - ${message}`);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function hasDateInfo(match) {
  return isNonEmptyString(match.match_date)
    || (Array.isArray(match.date_candidates) && match.date_candidates.length > 0);
}

function expectedId(index) {
  return `sec${String(index + 1).padStart(2, '0')}`;
}

function normalizeText(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, '')
    .trim();
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

function validateDateString(location, field, value) {
  if (!datePattern.test(value)) {
    addError(location, field, 'YYYY-MM-DD 形式である必要があります');
    return;
  }

  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    addError(location, field, '実在する日付である必要があります');
    return;
  }

  if (value < minDate || value > maxDate) {
    addError(location, field, `${minDate} から ${maxDate} の範囲内である必要があります`);
  }
}

function validateDateFields(match, location) {
  const hasMatchDate = isNonEmptyString(match.match_date);
  const hasCandidates = Array.isArray(match.date_candidates) && match.date_candidates.length > 0;

  if (hasMatchDate && hasCandidates) {
    addError(location, 'match_date/date_candidates', 'match_date と date_candidates は同時に指定できません');
  }

  if (hasMatchDate) {
    validateDateString(location, 'match_date', match.match_date);
  }

  if (hasOwn(match, 'date_candidates')) {
    if (!Array.isArray(match.date_candidates)) {
      addError(location, 'date_candidates', '指定する場合は配列である必要があります');
      return;
    }

    let previousDate = null;
    match.date_candidates.forEach((candidate, candidateIndex) => {
      const field = `date_candidates[${candidateIndex}]`;
      if (!isNonEmptyString(candidate)) {
        addError(location, field, '空でない文字列である必要があります');
        return;
      }

      validateDateString(location, field, candidate);

      if (previousDate && previousDate > candidate) {
        addError(location, 'date_candidates', '日付は昇順である必要があります');
      }
      previousDate = candidate;
    });
  }
}

function validateNote(location, note) {
  if (!isNonEmptyString(note)) {
    return;
  }

  const match = note.trim().match(/^※(\d+)(?:[:：]|\s|$)/);
  if (!match) {
    addError(location, 'note', '画面表示用の「※数字」で始まる注記番号を判別できる必要があります');
  }
}

function validateMatchesJson(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    addError('matches.json', 'root', 'ルートはオブジェクトである必要があります');
    return [];
  }

  if (!Array.isArray(data.matches)) {
    addError('matches.json', 'matches', 'matches は配列である必要があります');
    return [];
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

    validateDateFields(match, location);

    if (!allowedStatus.has(match.status)) {
      addError(location, 'status', 'confirmed または tentative のみ指定できます');
    }

    validateNote(location, match.note);
  });

  return data.matches;
}

function extractClassHomeAway(className) {
  if (/\bhome\b/.test(className)) return 'H';
  if (/\baway\b/.test(className)) return 'A';
  return '';
}

function extractFirst(pattern, text) {
  const match = text.match(pattern);
  return match ? normalizeText(match[1]) : '';
}

function parseHtmlCards() {
  let html;

  try {
    html = fs.readFileSync(htmlPath, 'utf8');
  } catch (error) {
    addError('sanga202627season.html', 'file', `${htmlPath} を読み込めません: ${error.message}`);
    return [];
  }

  const cards = [];
  const cardPattern = /<button\b([^>]*)\bclass="([^"]*\bmatch\b[^"]*)"([^>]*)>([\s\S]*?)<\/button>/g;
  let match;

  while ((match = cardPattern.exec(html)) !== null) {
    const attributes = `${match[1]} ${match[3]}`;
    const body = match[4];
    const idMatch = attributes.match(/\bdata-id="([^"]+)"/);
    const id = idMatch ? idMatch[1] : '';

    cards.push({
      id,
      round: extractFirst(/<span\b[^>]*class="[^"]*\bsec\b[^"]*"[^>]*>([\s\S]*?)<\/span>/, body),
      opponent: extractFirst(/<span\b[^>]*class="[^"]*\bteam\b[^"]*"[^>]*>([\s\S]*?)<\/span>/, body),
      home_away: extractClassHomeAway(match[2]),
      venue: extractFirst(/<span\b[^>]*class="[^"]*\bplace\b[^"]*"[^>]*>([\s\S]*?)<\/span>/, body),
      note_number: extractFirst(/<span\b[^>]*class="[^"]*\bnote\b[^"]*"[^>]*>(※\d+)<\/span>/, body),
    });
  }

  if (cards.length !== expectedCount) {
    addError('sanga202627season.html', 'match cards', `手書き日程カード数は${expectedCount}件である必要があります（現在 ${cards.length} 件）`);
  }

  return cards;
}

function noteNumberFromJson(note) {
  if (!isNonEmptyString(note)) return '';
  const match = note.trim().match(/^※\d+/);
  return match ? match[0] : '';
}

function compareJsonWithHtml(matches, htmlCards) {
  const cardsById = new Map(htmlCards.map((card) => [card.id, card]));

  matches.forEach((match) => {
    if (!match || !isNonEmptyString(match.id)) return;

    const card = cardsById.get(match.id);
    if (!card) {
      addError(match.id, 'HTML card', '同じ data-id の手書き日程カードが見つかりません');
      return;
    }

    [
      ['round', '節'],
      ['opponent', '対戦相手'],
      ['home_away', 'ホーム/アウェイ'],
      ['venue', '会場'],
    ].forEach(([field, label]) => {
      if (normalizeText(match[field]) !== normalizeText(card[field])) {
        addError(match.id, label, `JSON「${match[field] || ''}」とHTML「${card[field] || ''}」が一致しません`);
      }
    });

    const jsonNoteNumber = noteNumberFromJson(match.note);
    if (jsonNoteNumber !== card.note_number) {
      addError(match.id, '注記番号', `JSON「${jsonNoteNumber}」とHTML「${card.note_number}」が一致しません`);
    }
  });
}

const data = readJsonFile(matchesPath);
let matches = [];
if (data) {
  matches = validateMatchesJson(data);
}
const htmlCards = parseHtmlCards();
if (matches.length > 0 && htmlCards.length > 0) {
  compareJsonWithHtml(matches, htmlCards);
}

if (errors.length > 0) {
  console.error('日程データの検証に失敗しました。');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`日程データの検証に成功しました。matches.json は${expectedCount}件、HTMLの手書き日程カードも${expectedCount}件です。`);
console.log('日付形式・日付範囲・候補日の昇順・注記番号・JSONとHTMLの主要項目一致も確認しました。');
