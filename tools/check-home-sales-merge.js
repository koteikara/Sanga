#!/usr/bin/env node

/**
 * generate-calendar-events.js の --home-sales（Jリーグチケットで公式を補う）が
 * 決めたとおりに動くかを、作り物の入力で確かめる。
 *
 * 入力: docs/sheets/ticket-sales.current.csv（公式、2026-09-09 時点）と
 *       tools/fixtures/home-sales.merge.sample.csv（sec15 = 2026-11-21 の3行）
 *
 * - 日時が違う段階（ゴールド）は、Jリーグチケットの日時と出典で上書きする
 * - 日時が同じ段階（一般）は、公式の行をそのまま使う（出典を差し替えない）
 * - シーズンパス先行は「受付」と「販売」の呼び方違いでも同じ段階として上書きし、重複させない
 * - イベントIDは重複しない
 *
 * 手入力（tools/fixtures/home-sales.manual.sample.csv）:
 * - 同じ段階は、公式とJリーグチケットより手入力を優先する（sec15 一般）
 * - 公式に無い大会の段階は足す（sec41 一般）
 * - 手入力に無い段階は、これまでどおりJリーグチケットが上書きする（sec15 ゴールド）
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const output = path.join(repoRoot, 'tmp', 'calendar-events.home-sales-merge.json');
const FIXTURE_URL = 'https://www.jleague-ticket.jp/sales/perform/2000001/001';

execFileSync(process.execPath, [
  path.join(__dirname, 'generate-calendar-events.js'),
  path.join(repoRoot, 'docs', 'sheets', 'ticket-sales.current.csv'),
  output,
  '--home-sales', path.join(__dirname, 'fixtures', 'home-sales.merge.sample.csv'),
], { stdio: 'pipe' });

const events = JSON.parse(fs.readFileSync(output, 'utf8')).events;
const byId = new Map();
const problems = [];
events.forEach((event) => {
  if (byId.has(event.id)) problems.push(`イベントIDが重複しています: ${event.id}`);
  byId.set(event.id, event);
});

function expect(id, startsAt, sourceIsFixture) {
  const event = byId.get(id);
  if (!event) { problems.push(`${id} がありません`); return; }
  if (event.starts_at !== startsAt) problems.push(`${id} の開始が ${event.starts_at}（期待 ${startsAt}）`);
  if ((event.source_url === FIXTURE_URL) !== sourceIsFixture) {
    problems.push(`${id} の出典が ${event.source_url}（Jリーグチケットの出典${sourceIsFixture ? 'のはず' : 'ではないはず'}）`);
  }
}

expect('ticket-sec15-gold', '2026-10-29T12:00:00+09:00', true);
expect('ticket-sec15-general', '2026-10-31T12:00:00+09:00', false);
expect('ticket-sec15-season', '2026-10-20T11:00:00+09:00', true);
expect('ticket-sec15-platinum', '2026-10-26T12:00:00+09:00', false);

if (problems.length) {
  problems.forEach((line) => console.error(`NG ${line}`));
  process.exit(1);
}
console.log('ホーム戦の販売日時の上書き: 決めたとおりに動いています（4段階）');

const MANUAL_URL = 'https://www.sanga-fc.jp/news/detail/2000001';
const manualOutput = path.join(repoRoot, 'tmp', 'calendar-events.home-sales-manual-merge.json');

execFileSync(process.execPath, [
  path.join(__dirname, 'generate-calendar-events.js'),
  path.join(repoRoot, 'docs', 'sheets', 'ticket-sales.current.csv'),
  manualOutput,
  '--home-sales', path.join(__dirname, 'fixtures', 'home-sales.merge.sample.csv'),
  '--home-sales-manual', path.join(__dirname, 'fixtures', 'home-sales.manual.sample.csv'),
], { stdio: 'pipe' });

const manualEvents = JSON.parse(fs.readFileSync(manualOutput, 'utf8')).events;
const manualById = new Map();
manualEvents.forEach((event) => {
  if (manualById.has(event.id)) problems.push(`手入力の確認でイベントIDが重複しています: ${event.id}`);
  manualById.set(event.id, event);
});

function expectManual(id, startsAt, sourceUrl) {
  const event = manualById.get(id);
  if (!event) { problems.push(`手入力の確認: ${id} がありません`); return; }
  if (event.starts_at !== startsAt) problems.push(`手入力の確認: ${id} の開始が ${event.starts_at}（期待 ${startsAt}）`);
  if (event.source_url !== sourceUrl) {
    problems.push(`手入力の確認: ${id} の出典が ${event.source_url}（期待 ${sourceUrl}）`);
  }
}

// 手入力は公式・Jリーグチケットより優先する（一般の日時と出典を差し替える）
expectManual('ticket-sec15-general', '2026-11-01T13:00:00+09:00', MANUAL_URL);
// 手入力に無い段階は、これまでどおりJリーグチケットが上書きする
expectManual('ticket-sec15-gold', '2026-10-29T12:00:00+09:00', FIXTURE_URL);
// 公式に無い天皇杯の段階を足す
expectManual('ticket-sec41-general', '2026-11-14T13:00:00+09:00', MANUAL_URL);

if (problems.length) {
  problems.forEach((line) => console.error(`NG ${line}`));
  process.exit(1);
}
console.log('ホーム戦の販売日時の手入力: 決めたとおりに動いています（上書き1・追加1）');
