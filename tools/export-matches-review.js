#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const matchesPath = path.join(repoRoot, 'public', 'data', 'matches.json');

function readMatches() {
  const raw = fs.readFileSync(matchesPath, 'utf8');
  const data = JSON.parse(raw);

  if (!data || !Array.isArray(data.matches)) {
    throw new Error('public/data/matches.json の matches は配列である必要があります');
  }

  return data.matches;
}

function formatDate(match) {
  if (match.match_date) {
    return match.match_date;
  }

  if (Array.isArray(match.date_candidates) && match.date_candidates.length > 0) {
    return match.date_candidates.join(' / ');
  }

  return '';
}

function noteNumber(note) {
  if (typeof note !== 'string') {
    return '';
  }

  const match = note.trim().match(/^※\d+/);
  return match ? match[0] : '';
}

function escapeCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function toMarkdownTable(matches) {
  const headers = ['ID', '節', '日付', 'H/A', '対戦相手', '会場', '状態', '注記', '確認メモ'];
  const lines = [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
  ];

  matches.forEach((match) => {
    const row = [
      match.id,
      match.round,
      formatDate(match),
      match.home_away,
      match.opponent,
      match.venue,
      match.status,
      noteNumber(match.note),
      '',
    ].map(escapeCell);

    lines.push(`| ${row.join(' | ')} |`);
  });

  return `${lines.join('\n')}\n`;
}

try {
  process.stdout.write(toMarkdownTable(readMatches()));
} catch (error) {
  console.error(`確認用一覧の出力に失敗しました: ${error.message}`);
  process.exit(1);
}
