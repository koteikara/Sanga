// 検索とSNS向けの土台をまとめて作る。
//
// 1. public/sitemap.xml と public/robots.txt
// 2. public/index.html のツールカード（<!-- tools:begin --> と <!-- tools:end --> の間）
//    JavaScriptが動かない検索エンジンにもリンクが見えるよう、tools.json から先に書いておく。
// 3. 各ページの og:image / og:image:alt / og:url / canonical（PAGES の表どおりにそろえる）
//
// 使い方:
//   node tools/build-seo.mjs          生成して書き込む
//   node tools/build-seo.mjs --check  ずれがあれば失敗する（check:static から呼ぶ）
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ORIGIN = "https://sangasanga.stars.ne.jp";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pub = path.join(root, "public");
const check = process.argv.includes("--check");

// file: public/ からの位置 / ogp: assets/ からの画像 / alt: 画像の代替テキスト / url: canonical
// ページ別の画像は tools/ogp/make-ogp.mjs が作る。alt は画像に描いた文字と合わせる。
const COMMON_ALT = "SANGA TOOLBOX — 観戦をちょっと楽しくする道具を、サンガを応援する人みんなに。";
const PAGES = [
  { file: "index.html", url: "/", ogp: "ogp.jpg", alt: COMMON_ALT, priority: "1.0" },
  { file: "timeline.html", ogp: "ogp/timeline.jpg", alt: "SANGA TOOLBOX サポータータイムライン — チケット販売とキックオフを、ひとつの時系列に。", priority: "0.9" },
  { file: "timeline-calendar.html", ogp: "ogp/timeline-calendar.jpg", alt: "SANGA TOOLBOX カレンダーで受け取る — 販売開始と試合日程を、自分のカレンダーへ。", priority: "0.6" },
  { file: "sanga202627season.html", ogp: "ogp/season.jpg", alt: "SANGA TOOLBOX 2026/27 年間スケジュール — 全試合の日程を見て、参戦予定を保存。", priority: "0.9" },
  { file: "squad.html", ogp: "ogp/squad.jpg", alt: "SANGA TOOLBOX 予想スカッド作成 — スタメンを並べて、画像で共有。", priority: "0.8" },
  { file: "calendar.html", ogp: "ogp/calendar.jpg", alt: "SANGA TOOLBOX 過密日程カレンダー — 2026/27シーズンの試合間隔を色で見る。", priority: "0.8" },
  { file: "TradePost/index-v1.html", ogp: "ogp/trade.jpg", alt: "SANGA TOOLBOX 求・譲 投稿フォーマット — チケットやグッズの交換を、Xに投稿しやすく。", priority: "0.7" },
  { file: "sanga2025season.html", ogp: "ogp.jpg", alt: COMMON_ALT, priority: "0.3" },
  { file: "sanga_slides.html", ogp: "ogp.jpg", alt: COMMON_ALT, priority: "0.3" },
];

const problems = [];
const writes = [];

function put(rel, text) {
  const abs = path.join(pub, rel);
  const old = fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : null;
  if (old === text) return;
  if (check) problems.push(`${rel} が古い。node tools/build-seo.mjs を実行してください`);
  else { fs.writeFileSync(abs, text); writes.push(rel); }
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// --- 1. sitemap / robots ---
const urlOf = (p) => ORIGIN + (p.url ?? "/" + p.file);
const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...PAGES.map((p) => `  <url><loc>${esc(urlOf(p))}</loc><priority>${p.priority}</priority></url>`),
  "</urlset>",
  "",
].join("\n");
put("sitemap.xml", sitemap);
put("robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`);

// --- 2. ツールカード ---
const tools = JSON.parse(fs.readFileSync(path.join(pub, "data/tools.json"), "utf8")).tools;
const card = (t, i, pad) => [
  `${pad}<li class="work" style="--delay: ${(i % 2) * 90}ms"><a class="work-link" href="${esc(t.href)}">`,
  `${pad}  <span class="work-thumb"${t.accent ? ` style="--accent: ${esc(t.accent)}"` : ""}>${t.thumb ? `<img src="${esc(t.thumb)}" loading="lazy" decoding="async" width="344" height="704" alt="">` : ""}</span>`,
  `${pad}  <span class="work-name">${esc(t.name)}</span>`,
  `${pad}  <span class="work-desc">${esc(t.description)}</span>`,
  `${pad}</a></li>`,
].join("\n");
const grid = (list, pad) => [`${pad}<ul class="work-grid">`, ...list.map((t, i) => card(t, i, pad + "  ")), `${pad}</ul>`].join("\n");
const live = tools.filter((t) => t.section !== "archive");
const archive = tools.filter((t) => t.section === "archive");
let cards = grid(live, "  ");
if (archive.length) {
  cards += [
    "",
    '  <section class="archive" id="archive">',
    '    <h2 class="archive-title">ARCHIVE</h2>',
    '    <p class="archive-note">更新は終了していますが、そのまま残しています。</p>',
    grid(archive, "    "),
    "  </section>",
  ].join("\n");
}
const indexPath = "index.html";
let index = fs.readFileSync(path.join(pub, indexPath), "utf8");
const re = /<!-- tools:begin[^>]*-->[\s\S]*?<!-- tools:end -->/;
if (!re.test(index)) problems.push("index.html に <!-- tools:begin --> / <!-- tools:end --> がありません");
else index = index.replace(re, `<!-- tools:begin（tools/build-seo.mjs が data/tools.json から書く。手で直さない） -->\n${cards}\n  <!-- tools:end -->`);

// --- 3. og:image / canonical ---
const pageText = new Map([[indexPath, index]]);
for (const p of PAGES) {
  let html = pageText.get(p.file) ?? fs.readFileSync(path.join(pub, p.file), "utf8");
  if (!fs.existsSync(path.join(pub, "assets", p.ogp))) problems.push(`assets/${p.ogp} がありません（${p.file}）`);
  const img = `${ORIGIN}/assets/${p.ogp}`;
  if (!/property="og:image" content="/.test(html)) problems.push(`${p.file} に og:image がありません`);
  html = html.replace(/(property="og:image" content=")[^"]*(")/, `$1${img}$2`);
  html = html.replace(/(property="og:image:alt" content=")[^"]*(")/, `$1${esc(p.alt)}$2`);
  html = html.replace(/(property="og:url" content=")[^"]*(")/, `$1${urlOf(p)}$2`);
  const canon = `<link rel="canonical" href="${urlOf(p)}">`;
  if (/<link rel="canonical"[^>]*>/.test(html)) html = html.replace(/<link rel="canonical"[^>]*>/, canon);
  else html = html.replace(/(\n([ \t]*)<meta property="og:url"[^\n]*)/, `\n$2${canon}$1`);
  put(p.file, html);
}

if (problems.length) {
  console.error(problems.map((p) => "NG " + p).join("\n"));
  process.exit(1);
}
console.log(check ? "SEOの生成物は最新です。" : writes.length ? `更新: ${writes.join(", ")}` : "変更なし");
