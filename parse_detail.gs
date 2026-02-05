/** parse_detail.gs */

// parseArticleDetail(detailHtml, article) => TemporalItem[]
function parseArticleDetail(detailHtml, article) {
  var cfg = CFG();
  if (!detailHtml) return [];

  // Extract title from H1 line structure
  // The detail page has H1 and then "YYYY/M/D｜カテゴリ" line. :contentReference[oaicite:3]{index=3}
  var title = extractH1_(detailHtml) || (article && article.title ? article.title : "");
  title = normalizeSpaces(title);

  var publishedYmd = extractPublishedYmd_(detailHtml) || (article && article.publishedYmd ? article.publishedYmd : "");
  var publishedDate = publishedYmd ? parseIsoDateOnly_(publishedYmd, cfg.TZ) : null;

  // Main body text: strip tags
  var bodyText = htmlToText_(detailHtml);

  var items = extractCandidates_(title, bodyText, article, publishedDate);
  return normalizeNewsItems_(items, article);
}

// ---- extraction helpers ----

function extractH1_(html) {
  // Simple: first <h1 ...>...</h1>
  var m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!m) return "";
  return htmlToText_(m[1]);
}

function extractPublishedYmd_(html) {
  // Match "2026/1/24｜" in plain text form
  var t = htmlToText_(html);
  var m = t.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})\s*｜/);
  if (!m) return "";
  return m[1] + "-" + pad2(m[2]) + "-" + pad2(m[3]);
}

// ---- text utils ----

function htmlToText_(html) {
  if (!html) return "";
  var s = String(html);

  // Remove scripts/styles
  s = s.replace(/<script[\s\S]*?<\/script>/gi, " ");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, " ");

  // Replace <br> and block ends with newline-ish
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/(p|div|li|h1|h2|h3|h4|tr|td|th)>/gi, "\n");

  // Strip tags
  s = s.replace(/<[^>]+>/g, " ");

  // Decode basic entities
  s = decodeHtmlEntities_(s);

  // Normalize spaces
  s = s.replace(/\u00A0/g, " ");
  s = s.replace(/[ \t]+/g, " ");
  s = s.replace(/\n\s+\n/g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

function decodeHtmlEntities_(s) {
  return String(s)
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalizeSpaces(s) {
  if (s === null || s === undefined) return "";
  return String(s).replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
}

function normalizeForKey_(s) {
  return normalizeSpaces(String(s || ""))
    .replace(/[０-９]/g, function(ch){ return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0); })
    .toLowerCase();
}

function truncate_(s, n) {
  s = String(s || "");
  if (s.length <= n) return s;
  return s.substring(0, n - 1) + "…";
}

function formatIso_(d) {
  // ISO-ish in local TZ (ledger uses string; calendar uses DateTime in Calendar API)
  var cfg = CFG();
  return Utilities.formatDate(d, cfg.TZ, "yyyy-MM-dd'T'HH:mm:ss");
}

function parseIsoDateOnly_(isoYmd, tz) {
  // isoYmd: YYYY-MM-DD
  var m = String(isoYmd).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10), 0, 0, 0, 0);
}

function extractArticleIdFromUrl_(url) {
  var m = String(url || "").match(/\/news\/detail\/(\d+)/);
  return m ? m[1] : "";
}

function pad2(n) {
  n = String(n);
  return n.length === 1 ? "0" + n : n;
}
