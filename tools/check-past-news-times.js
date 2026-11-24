#!/usr/bin/env node

/**
 * 過ぎた締切が再抽出されても、公開JSONとフィードで生き返らないことを確かめる。
 *
 * 2026-11-23 の取り込み（PR #409）で起きたことの再現。入力は
 * `tools/fixtures/past-news-times/`（README に出どころ）。ネットワークは使わない。
 *
 * 1. 前回のフィードで `news-22070-sec19-entry-1200` が CANCELLED・SEQUENCE 1
 * 2. 前回のJSONにはそのUIDが無い（#407 後の main）
 * 3. news-times に締切 2026-11-12 12:00 の行が戻ってくる（同期は 2026-11-23）
 *
 * 結果として、JSONに出ず、フィードでは CANCELLED のまま版が1以上であること。
 * まだ来ていない予定は、これまでどおり CONFIRMED で出ること。
 * 加えて、作り物の場合として「墓標になった未来の予定が戻ったとき、版が下がらない」ことも見る。
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const fixtures = path.join(repoRoot, 'tools', 'fixtures', 'past-news-times');
const generator = path.join(repoRoot, 'tools', 'generate-calendar-events.js');
const feedBuilder = path.join(repoRoot, 'tools', 'build-ics-feed.js');
// 書き換えないスナップショット（AGENTS.md）。チケットの行はこの確認では見ない。
const ticketCsv = path.join(repoRoot, 'docs', 'sheets', 'ticket-sales.2026-08-28.csv');
const matchesPath = path.join(repoRoot, 'public', 'data', 'matches.json');
const emptyManual = path.join(fixtures, 'news-times.manual.empty.csv');

const failures = [];
function expect(condition, message) {
  if (!condition) failures.push(message);
}

function run(script, args) {
  return execFileSync(process.execPath, [script, ...args], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/** フィードを UID ごとの { status, sequence } にする。 */
function readFeed(feedPath) {
  const text = fs.readFileSync(feedPath, 'utf8').replace(/\r\n[ \t]/g, '');
  const index = new Map();
  let current = null;
  text.split('\r\n').forEach((line) => {
    if (line === 'BEGIN:VEVENT') current = {};
    else if (line === 'END:VEVENT') { if (current && current.uid) index.set(current.uid, current); current = null; }
    else if (current) {
      const at = line.indexOf(':');
      const name = line.slice(0, at);
      const value = line.slice(at + 1);
      if (name === 'UID') current.uid = value.split('@')[0];
      if (name === 'STATUS') current.status = value;
      if (name === 'SEQUENCE') current.sequence = Number(value);
    }
  });
  return index;
}

/**
 * 1回分の同期を、作業用のディレクトリで回す。
 * 前回のJSONとフィードを出力先に置いてから生成するのは、実際の取り込みと同じ。
 */
function sync(name, { previousFeed, now }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `past-news-times-${name}-`));
  const jsonPath = path.join(dir, 'calendar-events.json');
  const feedPath = path.join(dir, 'timeline-events.ics');
  fs.copyFileSync(path.join(fixtures, 'previous.calendar-events.json'), jsonPath);
  fs.writeFileSync(feedPath, previousFeed);

  const generateArgs = [ticketCsv, jsonPath, '--matches', matchesPath,
    '--news-times', path.join(fixtures, 'news-times.csv'), '--news-times-manual', emptyManual];
  if (now) generateArgs.push('--now', now);
  run(generator, generateArgs);
  const feedArgs = [feedPath, '--feed', 'events', '--events', jsonPath, '--matches', matchesPath];
  run(feedBuilder, feedArgs);

  // 作り直しても同じになること。版が毎回動くと --check が通らない。
  try {
    run(generator, generateArgs.concat('--check'));
    run(feedBuilder, feedArgs.concat('--check'));
  } catch (error) {
    failures.push(`${name}: 2回目の生成で結果が変わりました（${(error.stderr || error.message).trim()}）`);
  }

  const json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const events = new Map(json.events.map((event) => [event.id, event]));
  const feed = readFeed(feedPath);
  fs.rmSync(dir, { recursive: true, force: true });
  return { events, feed };
}

function isLiveInJson(event) {
  return Boolean(event) && event.is_visible !== false && event.status === 'confirmed';
}

const previousFeed = fs.readFileSync(path.join(fixtures, 'previous.timeline-events.ics'), 'utf8');
const before = readFeed(path.join(fixtures, 'previous.timeline-events.ics'));
const UID = 'news-22070-sec19-entry-1200';

// 前提が崩れていたら、確認そのものが意味を失う。
expect(before.get(UID) && before.get(UID).status === 'CANCELLED' && before.get(UID).sequence === 1,
  `前提: 前回フィードの ${UID} は CANCELLED・SEQUENCE 1 のはず`);
const previousJson = JSON.parse(fs.readFileSync(path.join(fixtures, 'previous.calendar-events.json'), 'utf8'));
expect(!previousJson.events.some((event) => event.id === UID), `前提: 前回JSONに ${UID} は無いはず`);

// --- 22070 型の再現。同期時点は news-times の retrieved_at_jst（2026-11-23 05:08 JST）から決まる。
const real = sync('22070', { previousFeed });

expect(!isLiveInJson(real.events.get(UID)), `${UID}: 過ぎた締切が公開JSONに生きた予定として出ています`);
const grave = real.feed.get(UID);
expect(grave && grave.status === 'CANCELLED', `${UID}: フィードで CANCELLED のままのはず（${grave && grave.status}）`);
expect(grave && grave.sequence >= 1, `${UID}: SEQUENCE が下がりました（${grave && grave.sequence}）`);

// ほかの過ぎた締切も同じ規則。前回 CONFIRMED・版0 → 墓標・版1。
['news-22122-sec17-entry-2359', 'news-22125-sec20-entry-1200', 'news-22126-sec20-entry-1200'].forEach((id) => {
  expect(!isLiveInJson(real.events.get(id)), `${id}: 過ぎた締切が公開JSONに生きた予定として出ています`);
  const entry = real.feed.get(id);
  expect(entry && entry.status === 'CANCELLED', `${id}: フィードで CANCELLED になるはず（${entry && entry.status}）`);
  expect(entry && entry.sequence === before.get(id).sequence + 1, `${id}: 墓標の版は前回 +1 のはず（${entry && entry.sequence}）`);
});

// 対照: まだ来ていない予定は、これまでどおり出る。前回からある行は版も変えない。
[
  ['news-22107-sec19-entry-1200', 0],
  ['news-22107-sec20-entry-1200', 0],
  ['news-22105-acl-md6-flow-1715', 0],
  ['news-22128-acl-md5-booth-1600', 0],
].forEach(([id, sequence]) => {
  expect(isLiveInJson(real.events.get(id)), `${id}: 未来の予定が公開JSONから消えています`);
  const entry = real.feed.get(id);
  expect(entry && entry.status === 'CONFIRMED', `${id}: 未来の予定は CONFIRMED のはず（${entry && entry.status}）`);
  expect(entry && entry.sequence === sequence, `${id}: 未来の予定の版が変わりました（${entry && entry.sequence}）`);
});

// --now で同期時点を固定できること。締切より前に同期したなら、22070 は生きた予定。
const early = sync('now', { previousFeed, now: '2026-11-10T22:00:00+09:00' });
expect(isLiveInJson(early.events.get(UID)), `${UID}: --now で締切前に固定したのに公開JSONに出ていません`);
const revived = early.feed.get(UID);
expect(revived && revived.status === 'CONFIRMED' && revived.sequence === 2,
  `${UID}: 締切前に戻ったなら CONFIRMED・前回の版 +1（2）のはず（${revived && revived.status} ${revived && revived.sequence}）`);

// --- 作り物の場合: まだ来ていない予定が一度墓標になり、再抽出で戻ってきた。
// 前回フィードの 22105 だけを CANCELLED・SEQUENCE 1 に書き換える（実際には起きていない状態）。
const forged = previousFeed.replace(
  /(UID:news-22105-acl-md6-flow-1715@[^\r]*\r\n(?:(?!END:VEVENT)[^\r]*\r\n)*?)SEQUENCE:0\r\n((?:(?!END:VEVENT)[^\r]*\r\n)*?)STATUS:CONFIRMED/,
  '$1SEQUENCE:1\r\n$2STATUS:CANCELLED',
);
expect(forged !== previousFeed, '前提: 作り物のフィードを作れませんでした');
const back = sync('revive', { previousFeed: forged });
const future = back.feed.get('news-22105-acl-md6-flow-1715');
expect(future && future.status === 'CONFIRMED', `22105: 未来の予定は戻るはず（${future && future.status}）`);
expect(future && future.sequence === 2, `22105: 戻るときは前回の版 +1（2）のはず（${future && future.sequence}）`);

if (failures.length) {
  console.error(`過ぎた締切の確認に失敗しました（${failures.length}件）`);
  failures.forEach((line) => { console.error(`  ${line}`); });
  process.exit(1);
}
console.log('過ぎた締切の確認OK: 22070 型の再抽出で、公開JSONに出ず、フィードは CANCELLED のまま版も下がらない。未来の予定は変わらない。');
