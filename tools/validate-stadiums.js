#!/usr/bin/env node
// stadiums.json / away-transport.csv / away-guide.json の整合を検証する。
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const errors = [];
const fail = (m) => errors.push(m);

const stadiums = JSON.parse(read('public/data/stadiums.json')).stadiums || [];
const matches = JSON.parse(read('public/data/matches.json')).matches;
const ids = new Set();
const venues = new Set();
for (const s of stadiums) {
  const loc = `stadiums[${s.id}]`;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s.id || '')) fail(`${loc}: id が不正`);
  if (ids.has(s.id)) fail(`${loc}: id が重複`);
  ids.add(s.id);
  if (venues.has(s.venue)) fail(`${loc}: venue が重複 ${s.venue}`);
  venues.add(s.venue);
  for (const k of ['venue', 'name', 'city']) if (!s[k]) fail(`${loc}: ${k} が空`);
  if (!(s.latitude >= 24 && s.latitude <= 46 && s.longitude >= 122 && s.longitude <= 146)) fail(`${loc}: 座標が日本の範囲外`);
  // 最寄り駅（ホテルを駅の周りでも探す中心）。名前と座標はそろえて持つ
  if (!s.station_name || !/駅$/.test(s.station_name)) fail(`${loc}: station_name は「〜駅」の形で必要`);
  if (!(s.station_latitude >= 24 && s.station_latitude <= 46 && s.station_longitude >= 122 && s.station_longitude <= 146)) fail(`${loc}: 駅の座標が日本の範囲外`);
  else {
    const km = 6371 * 2 * Math.asin(Math.sqrt(Math.sin(((s.station_latitude - s.latitude) * Math.PI) / 360) ** 2 + Math.cos((s.latitude * Math.PI) / 180) * Math.cos((s.station_latitude * Math.PI) / 180) * Math.sin(((s.station_longitude - s.longitude) * Math.PI) / 360) ** 2));
    if (km > 15) fail(`${loc}: 最寄り駅がスタジアムから ${km.toFixed(1)}km 離れています（取り違えの疑い）`);
  }
}

// 国内アウェイ戦の会場がすべて登録されていること
for (const m of matches) {
  if (m.home_away === 'A' && m.competition !== 'ACL' && !venues.has(m.venue)) fail(`matches ${m.id}: 会場「${m.venue}」が stadiums.json にありません`);
}

// 交通CSV
const lines = read('docs/sheets/away-transport.csv').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
const head = lines.shift().split(',');
const want = ['stadium_id', 'station', 'access_note', 'transport_label', 'transport_url'];
if (want.join() !== head.join()) fail(`away-transport.csv: 見出しは ${want.join(',')} にしてください`);
const seen = new Set();
for (const line of lines) {
  const c = line.split(',');
  if (c.length !== want.length) { fail(`away-transport.csv: 列数が違います: ${line}`); continue; }
  if (!ids.has(c[0])) fail(`away-transport.csv: 不明な stadium_id ${c[0]}`);
  if (seen.has(c[0])) fail(`away-transport.csv: stadium_id 重複 ${c[0]}`);
  seen.add(c[0]);
  if (!c[1] || !c[2]) fail(`away-transport.csv: station / access_note が空 ${c[0]}`);
  if (c[4] && !/^https:\/\//.test(c[4])) fail(`away-transport.csv: transport_url は https のみ ${c[0]}`);
  if (c[4] && !c[3]) fail(`away-transport.csv: transport_url があるのに transport_label が空 ${c[0]}`);
}
for (const id of ids) if (!seen.has(id)) fail(`away-transport.csv: ${id} の行がありません`);

// A8.net 提携リンク（public/data/affiliates.json）。許可するのは A8 のホストだけ
const aff = JSON.parse(read('public/data/affiliates.json'));
for (const key of ['bus', 'lodging']) {
  const a = aff[key] || {};
  if (!a.label) fail(`affiliates.${key}: label が空`);
  if (!/^https:\/\/px\.a8\.net\/svt\/ejp\?a8mat=[A-Za-z0-9+]+$/.test(a.href || '')) fail(`affiliates.${key}: href が px.a8.net の形ではありません`);
  if (a.pixel && !/^https:\/\/www\d+\.a8\.net\/0\.gif\?a8mat=[A-Za-z0-9+]+$/.test(a.pixel)) fail(`affiliates.${key}: pixel が www*.a8.net/0.gif の形ではありません`);
}

// 認証情報の混入防止
for (const f of ['public/data/hotel-index.json', ...fs.readdirSync(path.join(root, 'public/data/hotels')).map((n) => `public/data/hotels/${n}`)]) {
  const t = read(f);
  if (/applicationId=|accessKey|RAKUTEN_/i.test(t)) fail(`${f}: 認証情報らしい文字列が含まれています`);
}

if (errors.length) { console.error(errors.map((e) => 'NG ' + e).join('\n')); process.exit(1); }
console.log(`スタジアム検証OK: ${stadiums.length}会場`);
