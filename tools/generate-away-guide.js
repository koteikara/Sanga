#!/usr/bin/env node
// アウェイ遠征ガイド用の公開JSON public/data/away-guide.json を作る。
// 入力: public/data/matches.json / stadiums.json / hotel-index.json と docs/sheets/away-transport.csv
// 使い方: node tools/generate-away-guide.js [--check]
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dataDir = path.join(root, 'public', 'data');
const outPath = path.join(dataDir, 'away-guide.json');
const csvPath = path.join(root, 'docs', 'sheets', 'away-transport.csv');
const check = process.argv.includes('--check');

const readJson = (name) => JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8'));

function parseCsv(text) {
  const rows = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim() !== '').map((l) => l.split(','));
  const head = rows.shift();
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()])));
}

const matches = readJson('matches.json').matches;
const stadiums = readJson('stadiums.json').stadiums;
const hotelIndex = readJson('hotel-index.json');
const transport = Object.fromEntries(parseCsv(fs.readFileSync(csvPath, 'utf8')).map((r) => [r.stadium_id, r]));
const byVenue = Object.fromEntries(stadiums.map((s) => [s.venue, s]));
const hotelById = Object.fromEntries((hotelIndex.matches || []).map((m) => [m.match_id, m]));

const entries = matches
  .filter((m) => m.home_away === 'A' && m.competition !== 'ACL' && m.is_visible !== false)
  .map((m) => {
    const s = byVenue[m.venue];
    const t = s ? transport[s.id] : null;
    const h = hotelById[m.id];
    return {
      match_id: m.id,
      competition: m.competition || '',
      competition_label: m.competition_label || m.competition,
      round: m.round || '',
      opponent: m.opponent,
      match_date: m.match_date || '',
      date_candidates: m.date_candidates || [],
      kickoff_time: m.kickoff_time || '',
      stadium_id: s ? s.id : '',
      venue_name: s ? s.name : m.venue,
      city: s ? s.city : '',
      latitude: s ? s.latitude : null,
      longitude: s ? s.longitude : null,
      station: t ? t.station : '',
      station_name: s && s.station_name ? s.station_name : '',
      station_latitude: s && s.station_latitude != null ? s.station_latitude : null,
      station_longitude: s && s.station_longitude != null ? s.station_longitude : null,
      hub_name: s && s.hub_name ? s.hub_name : '',
      hub_latitude: s && s.hub_latitude != null ? s.hub_latitude : null,
      hub_longitude: s && s.hub_longitude != null ? s.hub_longitude : null,
      hub_note: s && s.hub_note ? s.hub_note : '',
      access_note: t ? t.access_note : '',
      transport_label: t ? t.transport_label : '',
      transport_url: t ? t.transport_url : '',
      hotels_path: h ? h.data_path : '',
    };
  });

const doc = {
  meta: {
    season: '2026-27',
    source: 'matches.json / stadiums.json / away-transport.csv / hotel-index.json',
    hotels_updated_at: (hotelIndex.meta && hotelIndex.meta.updated_at) || '',
    note: 'ACL（海外）は対象外',
  },
  matches: entries,
};
const text = JSON.stringify(doc, null, 2) + '\n';

if (check) {
  const old = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : '';
  if (old !== text) {
    console.error('NG public/data/away-guide.json が古い。node tools/generate-away-guide.js を実行してください');
    process.exit(1);
  }
  console.log(`away-guide.json は最新です（${entries.length}試合）`);
} else {
  fs.writeFileSync(outPath, text);
  console.log(`away-guide.json を更新しました（${entries.length}試合）`);
}
