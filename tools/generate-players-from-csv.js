#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const DEFAULT_INPUT = path.join('docs', 'sheets', 'players.csv');
const DEFAULT_OUTPUT = path.join('public', 'data', 'players.json');
const GENERATED_AT = new Date().toISOString().slice(0, 10);
const REQUIRED_COLUMNS = ['背番号', 'ローマ字名'];
const SOURCE_LABEL = '京都サンガF.C. 公式サイト';

function usage() {
  console.error('使い方: node tools/generate-players-from-csv.js [input.csv] [output.json]');
  console.error(`入力省略時: ${DEFAULT_INPUT}`);
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

  // 「#」で始まる行はコメント行として扱い、空行と同様に除外する
  return rows.filter((current) => {
    const first = String(current[0] || '').trim();
    if (first.startsWith('#')) return false;
    return current.some((value) => value.trim() !== '');
  });
}

function rowToObject(headers, row) {
  return Object.fromEntries(headers.map((header, index) => [header, String(row[index] || '').trim()]));
}

function parseBoolean(value) {
  const text = String(value || '').trim().toLowerCase();
  return text === 'true' || text === '1' || text === 'はい' || text === '○';
}

function buildPlayer(row) {
  const number = row['背番号'];

  // 画像列が空欄の場合はJSONにも空文字のまま出力する。
  // 背番号からのパス解決は表示側・検証側で行う（省略時の挙動は players-data-schema.md を参照）。
  return {
    number,
    nameEn: row['ローマ字名'],
    nameJa: row['日本語名'] || '',
    nameKana: row['かな'] || '',
    position: row['ポジション'] || '',
    nationality: row['国籍'] || '',
    image: row['画像'] || '',
    isMascot: parseBoolean(row['マスコット']),
  };
}

function validateGenerated(players) {
  const errors = [];
  const seenNumbers = new Map();

  players.forEach((player, index) => {
    const location = player.number || `players[${index}]`;

    if (!String(player.number || '').trim()) errors.push(`${location}: number は必須です。`);
    if (!String(player.nameEn || '').trim()) errors.push(`${location}: nameEn は必須です。`);

    if (seenNumbers.has(player.number)) {
      errors.push(`${location}: numberが ${seenNumbers.get(player.number)} と重複しています。`);
    }
    seenNumbers.set(player.number, location);
  });

  return errors;
}

function main() {
  const inputPath = process.argv[2] || DEFAULT_INPUT;
  const outputPath = process.argv[3] || DEFAULT_OUTPUT;

  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    usage();
    return;
  }

  const csv = fs.readFileSync(inputPath, 'utf8').replace(/^﻿/, '');
  const rows = parseCsv(csv);
  if (rows.length < 2) throw new Error('CSVにヘッダー行とデータ行が必要です。');

  const headers = rows[0].map((header) => header.trim());
  const missingColumns = REQUIRED_COLUMNS.filter((column) => !headers.includes(column));
  if (missingColumns.length > 0) throw new Error(`必須列が不足しています: ${missingColumns.join(', ')}`);

  const players = rows.slice(1)
    .map((row) => rowToObject(headers, row))
    .map(buildPlayer);

  const errors = validateGenerated(players);
  if (errors.length > 0) {
    console.error('生成JSONの簡易チェックに失敗しました。');
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  const output = {
    updatedAt: GENERATED_AT,
    source: SOURCE_LABEL,
    players,
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`players.json形式のJSONを生成しました: ${outputPath}`);
  console.log(`件数: ${players.length}`);
  console.log('背番号重複・必須項目の簡易チェックに成功しました。');
}

try {
  main();
} catch (error) {
  console.error(`生成に失敗しました: ${error.message}`);
  process.exit(1);
}
