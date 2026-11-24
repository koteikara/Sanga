#!/usr/bin/env node

/**
 * 墓標の期限を、記事由来のUIDでも効かせられているか確かめる。ネットワークは使わない。
 *
 * 墓標は、結び付く試合の試合日から7日後の終わりを過ぎたらフィードから外す
 * （tools/build-ics-feed.js の tombstoneExpiry）。試合は UID から引くが、2026-11-24 までは
 * `match-*` と `ticket-*` しか引けず、記事由来（`news-{記事番号}-{試合ID}-…`）の墓標は
 * いつまでも残っていた。
 *
 * 試合は作り物（`acl-md1` と、それに頭が重なる `acl-md10`、`sec19`）。実在の日程は使わない。
 */

const { matchOfUid, tombstoneExpiry, tombstonesFor } = require('./build-ics-feed.js');

const DOMAIN = 'sanga-timeline.invalid';
const matches = new Map([
  ['acl-md1', { id: 'acl-md1', match_date: '2030-09-15' }],
  ['acl-md10', { id: 'acl-md10', match_date: '2030-12-01' }],
  ['sec19', { id: 'sec19', match_date: '2030-12-13' }],
  ['sec20', { id: 'sec20', match_date: '' }],
]);

const failures = [];
function expect(condition, message) {
  if (!condition) failures.push(message);
}

function matchIdOf(uid) {
  const match = matchOfUid(`${uid}@${DOMAIN}`, matches);
  return match ? match.id : null;
}

// --- 試合の引き方。ハイフンで切らず、実在する試合IDと突き合わせる。
[
  ['news-90001-acl-md1-flow-1700', 'acl-md1'],
  ['news-90002-acl-md10-booth-1600', 'acl-md10'],
  ['news-90003-sec19-entry-1200', 'sec19'],
  ['news-90004-sec19-1200', 'sec19'], // 古い形（slug なし）
  ['match-acl-md1', 'acl-md1'],
  ['ticket-acl-md1-general', 'acl-md1'],
  ['ticket-acl-md10-general', 'acl-md10'],
  ['news-90005-sec99-entry-1200', null], // 無い試合
  ['news-abc-sec19-entry-1200', null], // 記事番号が数字でない
  ['other-sec19-x', null],
].forEach(([uid, expected]) => {
  const actual = matchIdOf(uid);
  expect(actual === expected, `${uid}: 試合は ${expected} のはず（${actual}）`);
});

// --- 期限の計算は形を問わず同じ（試合日の7日後 23:59:59、ローカル日付）。
const expiryOf = (uid) => tombstoneExpiry(`${uid}@${DOMAIN}`, matches);
const until = new Date(2030, 8, 22, 23, 59, 59).getTime();
['match-acl-md1', 'ticket-acl-md1-general', 'news-90001-acl-md1-flow-1700'].forEach((uid) => {
  const at = expiryOf(uid);
  expect(at && at.getTime() === until, `${uid}: 期限は 2030-09-22 23:59:59 のはず（${at}）`);
});
expect(expiryOf('news-90006-sec20-entry-1200') === null, '試合日の無い試合の墓標は消さないはず');

// --- 墓標の出し入れ。前回フィードにあり、今回いないUIDだけを渡す。
function previousOf(uids) {
  const previous = new Map();
  uids.forEach((uid) => {
    previous.set(`${uid}@${DOMAIN}`, {
      uid: `${uid}@${DOMAIN}`, status: 'CANCELLED', sequence: 1,
      dtstart: '20300901T030000Z', lastModified: '20300901T000000Z', summary: uid, description: '',
    });
  });
  return previous;
}

const uids = [
  'news-90001-acl-md1-flow-1700',
  'match-acl-md1',
  'ticket-acl-md1-general',
  'news-90003-sec19-entry-1200',
  'news-90005-sec99-entry-1200',
];

// 期限の前（2030-09-22 23:00）: どれも残る。
const before = tombstonesFor(previousOf(uids), new Set(), matches, new Date(2030, 8, 22, 23, 0, 0));
expect(before.expired.length === 0, `期限の前は何も落ちないはず（${before.expired.join(', ')}）`);
expect(before.specs.length === uids.length, `期限の前は ${uids.length} 件残るはず（${before.specs.length}）`);
const kept = before.specs.find((spec) => spec.uid === 'news-90001-acl-md1-flow-1700');
expect(kept && kept.sequence === 1 && kept.status === 'CANCELLED', '残る墓標は版を持ち越すはず');

// 期限の後（2030-09-23 00:00）: acl-md1 の3件が落ち、sec19 と引けない試合のものは残る。
const after = tombstonesFor(previousOf(uids), new Set(), matches, new Date(2030, 8, 23, 0, 0, 0));
const expired = after.expired.map((uid) => uid.split('@')[0]).sort();
const expected = ['match-acl-md1', 'news-90001-acl-md1-flow-1700', 'ticket-acl-md1-general'];
expect(JSON.stringify(expired) === JSON.stringify(expected), `期限の後に落ちるのは acl-md1 の3件のはず（${expired.join(', ')}）`);
const left = after.specs.map((spec) => spec.uid).sort();
expect(JSON.stringify(left) === JSON.stringify(['news-90003-sec19-entry-1200', 'news-90005-sec99-entry-1200']),
  `期限の後に残るのは sec19 と、試合を引けないものだけのはず（${left.join(', ')}）`);

if (failures.length) {
  console.error(`墓標の期限の確認に失敗しました（${failures.length}件）`);
  failures.forEach((line) => { console.error(`  ${line}`); });
  process.exit(1);
}
console.log('墓標の期限の確認OK: 記事由来のUIDからも試合を引き、試合日+7日を過ぎた墓標を落とす。match-* / ticket-* の期限は変わらない。');
