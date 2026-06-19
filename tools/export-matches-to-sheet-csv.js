#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const DEFAULT_OUTPUT = path.join('tmp', 'schedule-from-current-json.csv');
const HEADERS = [
  'ID',
  '表示順',
  '節',
  '開催年',
  '開催日',
  '候補日',
  '状態',
  'ホームアウェイ',
  'ホームアウェイ表示',
  '対戦相手',
  '対戦相手コード',
  '会場',
  '注記番号',
  '注記',
  '根拠URL',
  '確認日',
  'メモ',
];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const NOTE_NUMBER_PATTERN = /^(※\d+)(?:[:：]|\s|$)/;

function usage() {
  console.error('使い方: node tools/export-matches-to-sheet-csv.js <input.json> [output.csv]');
  console.error(`出力先省略時: ${DEFAULT_OUTPUT}`);
}

function readJson(inputPath) {
  let raw;
  try {
    raw = fs.readFileSync(inputPath, 'utf8');
  } catch (error) {
    throw new Error(`${inputPath} を読み込めません: ${error.message}`);
  }

  try {
    return JSON.parse(raw.replace(/^\uFEFF/, ''));
  } catch (error) {
    throw new Error(`${inputPath} をJSONとして読み込めません: ${error.message}`);
  }
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function getYear(match) {
  const matchDate = String(match.match_date || '').trim();
  if (DATE_PATTERN.test(matchDate)) return matchDate.slice(0, 4);

  const candidates = Array.isArray(match.date_candidates) ? match.date_candidates : [];
  const firstCandidate = String(candidates[0] || '').trim();
  if (DATE_PATTERN.test(firstCandidate)) return firstCandidate.slice(0, 4);

  return '';
}

function getStatusLabel(status) {
  if (status === 'confirmed') return '確定';
  if (status === 'tentative') return '未確定';
  return status || '';
}

function getCheckedDate(value) {
  const text = String(value || '').trim();
  const matched = text.match(/\d{4}-\d{2}-\d{2}/);
  return matched ? matched[0] : '';
}

function getNoteNumber(note) {
  const matched = String(note || '').trim().match(NOTE_NUMBER_PATTERN);
  return matched ? matched[1] : '';
}

function matchToRow(match, index) {
  const candidates = Array.isArray(match.date_candidates) ? match.date_candidates : [];
  const note = match.note || '';

  return [
    match.id || '',
    String(index + 1),
    match.round || '',
    getYear(match),
    match.match_date || '',
    candidates.join('|'),
    getStatusLabel(match.status),
    match.home_away || '',
    match.home_away_label || '',
    match.opponent || '',
    match.opponent_code || '',
    match.venue || '',
    getNoteNumber(note),
    note,
    match.source_url || '',
    getCheckedDate(match.source_checked_at),
    '',
  ];
}

function toCsv(rows) {
  return `${rows.map((row) => row.map(csvEscape).join(',')).join('\n')}\n`;
}

function main() {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3] || DEFAULT_OUTPUT;
  if (!inputPath) {
    usage();
    process.exit(1);
  }

  const data = readJson(inputPath);
  if (!Array.isArray(data.matches)) {
    throw new Error('入力JSONの matches は配列である必要があります。');
  }

  const rows = [HEADERS, ...data.matches.map(matchToRow)];
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, toCsv(rows), 'utf8');

  console.log(`スプレッドシート用CSVを生成しました: ${outputPath}`);
  console.log(`件数: ${data.matches.length}`);
}

try {
  main();
} catch (error) {
  console.error(`CSV生成に失敗しました: ${error.message}`);
  process.exit(1);
}
