#!/usr/bin/env node
// stadiums.json / away-transport.csv / away-guide.json / home-guide.json の整合を検証する。
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
  // 宿泊の拠点駅（任意）。最寄り駅の周りに宿が無いスタジアムだけに置く。4つの項目はそろえる
  const hubKeys = ['hub_name', 'hub_latitude', 'hub_longitude', 'hub_note'];
  const hubCount = hubKeys.filter((k) => s[k] !== undefined).length;
  if (hubCount && hubCount !== hubKeys.length) fail(`${loc}: hub_* は ${hubKeys.join(' / ')} をそろえて置く`);
  if (hubCount === hubKeys.length) {
    if (!/駅$/.test(s.hub_name)) fail(`${loc}: hub_name は「〜駅」の形で必要`);
    if (!(s.hub_latitude >= 24 && s.hub_latitude <= 46 && s.hub_longitude >= 122 && s.hub_longitude <= 146)) fail(`${loc}: 拠点駅の座標が日本の範囲外`);
    if (!s.hub_note) fail(`${loc}: hub_note（拠点駅からの行き方）が空`);
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

// ホーム観戦ガイドの案内（public/data/home-guide.json、手で書く）
const inJapan = (lat, lng) => lat >= 24 && lat <= 46 && lng >= 122 && lng <= 146;
const distKm = (a1, o1, a2, o2) => 6371 * 2 * Math.asin(Math.sqrt(Math.sin(((a2 - a1) * Math.PI) / 360) ** 2 + Math.cos((a1 * Math.PI) / 180) * Math.cos((a2 * Math.PI) / 180) * Math.sin(((o2 - o1) * Math.PI) / 360) ** 2));
const home = JSON.parse(read('public/data/home-guide.json'));
const hs = home.stadium || {};
if (!Array.isArray(home.venues) || !home.venues.length) fail('home-guide.json: venues が空');
const homeVenues = new Set(matches.filter((m) => m.home_away === 'H').map((m) => m.venue));
for (const v of home.venues || []) if (!homeVenues.has(v)) fail(`home-guide.json: venues「${v}」は matches.json のホーム戦の会場にありません`);
for (const k of ['id', 'name', 'city', 'station_name']) if (!hs[k]) fail(`home-guide.json: stadium.${k} が空`);
if (ids.has(hs.id)) fail(`home-guide.json: stadium.id ${hs.id} が stadiums.json と重複`);
if (!inJapan(hs.latitude, hs.longitude) || !inJapan(hs.station_latitude, hs.station_longitude)) fail('home-guide.json: stadium の座標が日本の範囲外');
else if (distKm(hs.latitude, hs.longitude, hs.station_latitude, hs.station_longitude) > 3) fail('home-guide.json: 駅がスタジアムから3kmより遠い（取り違えの疑い）');
for (const key of ['access', 'routes', 'spots', 'food_places', 'featured_hotels', 'search_areas']) if (!Array.isArray(home[key]) || !home[key].length) fail(`home-guide.json: ${key} が空`);
for (const a of home.access || []) if (!a.label || !a.text) fail('home-guide.json: access は label と text が要る');
for (const r of home.routes || []) if (!r.label || !r.origin) fail('home-guide.json: routes は label と origin が要る');
const spotIds = new Set();
for (const sp of home.spots || []) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(sp.id || '') || spotIds.has(sp.id)) fail(`home-guide.json: spots の id が不正か重複 ${sp.id}`);
  spotIds.add(sp.id);
  for (const k of ['name', 'kind', 'text']) if (!sp[k]) fail(`home-guide.json: spots[${sp.id}].${k} が空`);
  if (!inJapan(sp.latitude, sp.longitude) || distKm(hs.latitude, hs.longitude, sp.latitude, sp.longitude) > 20) fail(`home-guide.json: spots[${sp.id}] の座標がスタジアムから20kmより遠いか範囲外`);
  if (sp.url && !/^https:\/\//.test(sp.url)) fail(`home-guide.json: spots[${sp.id}].url は https のみ`);
  if (!['walk', 'ride'].includes(sp.reach)) fail(`home-guide.json: spots[${sp.id}].reach は walk（歩いて）か ride（電車・バスで）`);
}
// 車で来る。予約サービスのリンクは https、提携リンクにするときは affiliates.json のキーを書く
const pk = home.parking || {};
if (!Array.isArray(pk.notes) || !pk.notes.length) fail('home-guide.json: parking.notes が空');
if (!Array.isArray(pk.services) || !pk.services.length) fail('home-guide.json: parking.services が空');
for (const sv of pk.services || []) {
  if (!sv.id || !sv.name || !sv.text) fail(`home-guide.json: parking.services[${sv.id}] の id / name / text が空`);
  if (!/^https:\/\//.test(sv.url || '')) fail(`home-guide.json: parking.services[${sv.id}].url は https のみ`);
  if (sv.affiliate_key && !aff[sv.affiliate_key]) fail(`home-guide.json: parking.services[${sv.id}].affiliate_key「${sv.affiliate_key}」が affiliates.json にありません`);
}
for (const c of pk.coin_places || []) if (!c.label || !inJapan(c.latitude, c.longitude) || distKm(hs.latitude, hs.longitude, c.latitude, c.longitude) > 10) fail('home-guide.json: parking.coin_places は label とスタジアムから10km以内の座標が要る');
if (home.more_spots && !/^https:\/\//.test(home.more_spots.url || '')) fail('home-guide.json: more_spots.url は https のみ');
for (const f of home.food_places || []) if (!f.label || !inJapan(f.latitude, f.longitude)) fail('home-guide.json: food_places は label と日本の範囲の座標が要る');
const featuredNos = new Set();
for (const h of home.featured_hotels || []) {
  if (!Number.isInteger(h.hotel_no) || featuredNos.has(h.hotel_no)) fail(`home-guide.json: featured_hotels の hotel_no が不正か重複 ${h.hotel_no}`);
  featuredNos.add(h.hotel_no);
  if (!h.name || !h.text) fail(`home-guide.json: featured_hotels[${h.hotel_no}] の name / text が空`);
  // 宿の案内への普通のリンク（広告リンクは楽天APIが返したものだけを試合ごとのJSONで使う）
  if (!new RegExp(`^https://travel\\.rakuten\\.co\\.jp/HOTEL/${h.hotel_no}/$`).test(h.url || '')) fail(`home-guide.json: featured_hotels[${h.hotel_no}].url は https://travel.rakuten.co.jp/HOTEL/${h.hotel_no}/ の形にする`);
}
const areaIds = new Set();
for (const a of home.search_areas || []) {
  if (!['stadium', 'kameoka'].includes(a.id) || areaIds.has(a.id)) fail(`home-guide.json: search_areas の id は stadium / kameoka（重複なし）: ${a.id}`);
  areaIds.add(a.id);
  if (!a.label || !inJapan(a.latitude, a.longitude)) fail(`home-guide.json: search_areas[${a.id}] の label / 座標`);
  if (![1, 2, 3].includes(a.radius_km)) fail(`home-guide.json: search_areas[${a.id}].radius_km は楽天APIの上限の3以下の整数`);
}
if ((home.search_areas || [])[0] && home.search_areas[0].id !== 'stadium') fail('home-guide.json: search_areas の先頭は stadium（そばの2軒はこの検索で見つける）');

// 認証情報の混入防止
for (const f of ['public/data/hotel-index.json', 'public/data/home-guide.json', ...fs.readdirSync(path.join(root, 'public/data/hotels')).map((n) => `public/data/hotels/${n}`)]) {
  const t = read(f);
  if (/applicationId=|accessKey|RAKUTEN_/i.test(t)) fail(`${f}: 認証情報らしい文字列が含まれています`);
}

if (errors.length) { console.error(errors.map((e) => 'NG ' + e).join('\n')); process.exit(1); }
console.log(`スタジアム検証OK: ${stadiums.length}会場／ホーム観戦ガイド: 散策${home.spots.length}件・そばの宿${home.featured_hotels.length}軒`);
