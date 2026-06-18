#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const DEFAULT_OUTPUT = path.join('tmp', 'matches.generated.json');
const GENERATED_AT = new Date().toISOString().slice(0, 16).replace('T', ' ');
const REQUIRED_COLUMNS = ['ID', '節', '開催年', '状態', 'ホームアウェイ', '対戦相手', '会場'];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function usage() {
  console.error('使い方: node tools/generate-matches-from-csv.js <input.csv> [output.json]');
  console.error(`出力先省略時: ${DEFAULT_OUTPUT}`);
}

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

  if (inQuotes) {
    throw new Error('CSVのダブルクォートが閉じられていません。');
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((current) => current.some((value) => value.trim() !== ''));
}

function normalizeStatus(value) {
  const status = String(value || '').trim();
  if (status === '確定' || status === 'confirmed') return { status: 'confirmed', status_label: '確定' };
  if (status === '未確定' || status === 'tentative') return { status: 'tentative', status_label: '未確定' };
  return { status, status_label: status };
}

function normalizeHomeAway(value, label) {
  const homeAway = String(value || '').trim().toUpperCase();
  if (homeAway === 'H') return { home_away: 'H', home_away_label: label || 'ホーム' };
  if (homeAway === 'A') return { home_away: 'A', home_away_label: label || 'アウェイ' };
  return { home_away: homeAway, home_away_label: label || homeAway };
}

function splitCandidates(value) {
  return String(value || '')
    .split('|')
    .map((candidate) => candidate.trim())
    .filter(Boolean);
}

function rowToObject(headers, row) {
  return Object.fromEntries(headers.map((header, index) => [header, String(row[index] || '').trim()]));
}

function validateDate(errors, location, field, value) {
  if (!value) return;
  if (!DATE_PATTERN.test(value)) {
    errors.push(`${location}: ${field} は YYYY-MM-DD 形式で入力してください。`);
  }
}

function buildMatch(row) {
  const status = normalizeStatus(row['状態']);
  const homeAway = normalizeHomeAway(row['ホームアウェイ'], row['ホームアウェイ表示']);
  const candidates = splitCandidates(row['候補日']);

  return {
    id: row['ID'],
    season: '2026-27',
    competition: 'J1',
    competition_label: '明治安田J1リーグ',
    round: row['節'],
    match_date: row['開催日'] || '',
    date_candidates: candidates,
    kickoff_time: '',
    ...homeAway,
    opponent: row['対戦相手'],
    opponent_code: row['対戦相手コード'] || '',
    venue: row['会場'],
    result: '',
    ticket_url: '',
    broadcast: '',
    source_url: row['根拠URL'] || '',
    source_checked_at: GENERATED_AT,
    ...status,
    note: row['注記'] || '',
    updated_at: GENERATED_AT,
  };
}

function validateGenerated(matches) {
  const errors = [];
  const seenIds = new Map();

  matches.forEach((match, index) => {
    const location = match.id || `matches[${index}]`;
    ['id', 'round', 'home_away', 'opponent', 'venue', 'status'].forEach((field) => {
      if (!String(match[field] || '').trim()) errors.push(`${location}: ${field} は必須です。`);
    });

    if (seenIds.has(match.id)) {
      errors.push(`${location}: IDが ${seenIds.get(match.id)} と重複しています。`);
    }
    seenIds.set(match.id, location);

    if (!['H', 'A'].includes(match.home_away)) errors.push(`${location}: home_away は H または A にしてください。`);
    if (!['confirmed', 'tentative'].includes(match.status)) errors.push(`${location}: status は confirmed または tentative にしてください。`);
    if (match.match_date && match.date_candidates.length > 0) errors.push(`${location}: 開催日と候補日は同時に指定できません。`);
    validateDate(errors, location, 'match_date', match.match_date);
    match.date_candidates.forEach((candidate, candidateIndex) => validateDate(errors, location, `date_candidates[${candidateIndex}]`, candidate));
  });

  return errors;
}

function main() {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3] || DEFAULT_OUTPUT;
  if (!inputPath) {
    usage();
    process.exit(1);
  }

  const csv = fs.readFileSync(inputPath, 'utf8').replace(/^\uFEFF/, '');
  const rows = parseCsv(csv);
  if (rows.length < 2) throw new Error('CSVにヘッダー行とデータ行が必要です。');

  const headers = rows[0].map((header) => header.trim());
  const missingColumns = REQUIRED_COLUMNS.filter((column) => !headers.includes(column));
  if (missingColumns.length > 0) throw new Error(`必須列が不足しています: ${missingColumns.join(', ')}`);

  const matches = rows.slice(1)
    .map((row) => rowToObject(headers, row))
    .sort((a, b) => Number(a['表示順'] || 0) - Number(b['表示順'] || 0))
    .map(buildMatch);

  const errors = validateGenerated(matches);
  if (errors.length > 0) {
    console.error('生成JSONの簡易チェックに失敗しました。');
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  const output = {
    meta: {
      season: '2026-27',
      team: '京都サンガF.C.',
      updated_at: GENERATED_AT,
      source: inputPath,
    },
    matches,
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`matches.json形式のJSONを生成しました: ${outputPath}`);
  console.log(`件数: ${matches.length}`);
  console.log('ID重複・必須項目・日付形式の簡易チェックに成功しました。');
}

try {
  main();
} catch (error) {
  console.error(`生成に失敗しました: ${error.message}`);
  process.exit(1);
}
