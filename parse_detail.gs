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

  // Candidates from:
  // - title bracket date patterns
  // - body text patterns (月日 + time)
  var items = [];

  // (A) title-based patterns e.g. 〖3/18(水)長崎戦〗, 〖1/30(金)～2/10(火)〗, 〖3/8(日)まで〗
  items = items.concat(extractFromTitle_(title, article, publishedDate));

  // (B) body-based patterns
  items = items.concat(extractFromBody_(bodyText, article, publishedDate));

  // Normalize / unique by itemKey (within-article)
  var seen = {};
  var out = [];
  for (var i = 0; i < items.length; i++) {
    var it = finalizeItem_(items[i], article);
    if (!it) continue;
    if (seen[it.itemKey]) continue;
    seen[it.itemKey] = true;
    out.push(it);
  }
  return out;
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

function extractFromTitle_(title, article, publishedDate) {
  var cfg = CFG();
  var out = [];
  var year = inferYear_(publishedDate);

  // Range: 〖1/30(金)～2/10(火)〗
  var reRange = /[〖【\[]\s*(\d{1,2})\/(\d{1,2})\([^)]*\)\s*[～〜-]\s*(\d{1,2})\/(\d{1,2})\([^)]*\)\s*[〗】\]]/g;
  var m;
  while ((m = reRange.exec(title)) !== null) {
    var sm = parseInt(m[1], 10), sd = parseInt(m[2], 10);
    var em = parseInt(m[3], 10), ed = parseInt(m[4], 10);
    var y1 = resolveYearForMonth_(year, sm, publishedDate);
    var y2 = resolveYearForMonth_(year, em, publishedDate);
    var start = makeDate_(y1, sm, sd, 0, 0);
    var end = makeDate_(y2, em, ed, 23, 59);
    out.push({
      type: "period",
      label: "title-range",
      start: start,
      end: end,
      sourceText: m[0]
    });
  }

  // Deadline: 〖3/8(日)まで〗 or "3/8(日)まで"
  var reDeadline = /(\d{1,2})\/(\d{1,2})\([^)]*\)\s*まで/g;
  while ((m = reDeadline.exec(title)) !== null) {
    var mm = parseInt(m[1], 10), dd = parseInt(m[2], 10);
    var y = resolveYearForMonth_(year, mm, publishedDate);
    var d = makeDate_(y, mm, dd, 23, 59);
    out.push({
      type: "deadline",
      label: "title-deadline",
      start: d,
      end: d,
      sourceText: m[0]
    });
  }

  // Single date: 〖3/18(水)長崎戦〗
  var reSingle = /(\d{1,2})\/(\d{1,2})\([^)]*\)/g;
  while ((m = reSingle.exec(title)) !== null) {
    var mm2 = parseInt(m[1], 10), dd2 = parseInt(m[2], 10);
    var y3 = resolveYearForMonth_(year, mm2, publishedDate);
    var d2 = makeDate_(y3, mm2, dd2, 0, 0);
    var t = guessTypeFromContext_(title, "title");
    out.push({
      type: t,
      label: "title-date",
      start: d2,
      end: makeDate_(y3, mm2, dd2, 23, 59),
      sourceText: m[0]
    });
  }

  return out;
}

function extractFromBody_(text, article, publishedDate) {
  var out = [];
  var year = inferYear_(publishedDate);

  // Pattern 1: "3月18日(水)19:00"
  // Also catch "1月26日(月)19:00～" (treat as point in time)
  var reMdTime = /(\d{1,2})月(\d{1,2})日(?:\([^)]*\))?(?:\s*([01]?\d|2[0-3])[:：]([0-5]\d))?/g;
  var m;
  while ((m = reMdTime.exec(text)) !== null) {
    var mm = parseInt(m[1], 10);
    var dd = parseInt(m[2], 10);
    var hh = (m[3] !== undefined && m[3] !== null) ? parseInt(m[3], 10) : null;
    var mi = (m[4] !== undefined && m[4] !== null) ? parseInt(m[4], 10) : null;

    // Look around for context words within +-40 chars
    var idx = m.index;
    var ctx = text.substring(Math.max(0, idx - 40), Math.min(text.length, idx + 40));
    var typ = guessTypeFromContext_(ctx, "body");
    var y = resolveYearForMonth_(year, mm, publishedDate);

    var start = makeDate_(y, mm, dd, hh !== null ? hh : 0, mi !== null ? mi : 0);
    var end;

    // If context indicates kickoff or explicit time, use 2 hours block as default
    if (hh !== null && mi !== null && /キックオフ|開始|開演/.test(ctx)) {
      end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    } else if (hh !== null && mi !== null && /～|〜|-/.test(ctx)) {
      // not reliable; fall back to same day end
      end = makeDate_(y, mm, dd, 23, 59);
    } else {
      // all-day
      end = makeDate_(y, mm, dd, 23, 59);
    }

    // Special: "～" right after time suggests "from" (sale start)
    if (/～|〜/.test(ctx) && /販売|受付|申込|先行/.test(ctx)) {
      typ = "sale";
    }

    out.push({
      type: typ,
      label: deriveLabelFromContext_(ctx),
      start: start,
      end: end,
      sourceText: normalizeSpaces(ctx)
    });
  }

  // Pattern 2: range like "1月30日(金)～2月10日(火)"
  var reRange2 = /(\d{1,2})月(\d{1,2})日(?:\([^)]*\))?\s*[～〜-]\s*(\d{1,2})月(\d{1,2})日(?:\([^)]*\))?/g;
  while ((m = reRange2.exec(text)) !== null) {
    var sm = parseInt(m[1], 10), sd = parseInt(m[2], 10);
    var em = parseInt(m[3], 10), ed = parseInt(m[4], 10);
    var idx2 = m.index;
    var ctx2 = text.substring(Math.max(0, idx2 - 40), Math.min(text.length, idx2 + 80));
    var y1 = resolveYearForMonth_(year, sm, publishedDate);
    var y2 = resolveYearForMonth_(year, em, publishedDate);

    out.push({
      type: "period",
      label: deriveLabelFromContext_(ctx2),
      start: makeDate_(y1, sm, sd, 0, 0),
      end: makeDate_(y2, em, ed, 23, 59),
      sourceText: normalizeSpaces(m[0])
    });
  }

  // Pattern 3: "まで" deadline like "3月8日(日)まで"
  var reDeadline = /(\d{1,2})月(\d{1,2})日(?:\([^)]*\))?\s*まで/g;
  while ((m = reDeadline.exec(text)) !== null) {
    var mm3 = parseInt(m[1], 10), dd3 = parseInt(m[2], 10);
    var idx3 = m.index;
    var ctx3 = text.substring(Math.max(0, idx3 - 40), Math.min(text.length, idx3 + 60));
    var y3 = resolveYearForMonth_(year, mm3, publishedDate);
    var d = makeDate_(y3, mm3, dd3, 23, 59);
    out.push({
      type: "deadline",
      label: deriveLabelFromContext_(ctx3),
      start: d,
      end: d,
      sourceText: normalizeSpaces(ctx3)
    });
  }

  return out;
}

function guessTypeFromContext_(ctx, where) {
  if (!ctx) return "event";
  if (/キックオフ|戦\b|vs\.?|対戦|節\b/.test(ctx)) return "match";
  if (/締切|まで|期限|応募|申込/.test(ctx)) return "deadline";
  if (/販売|発売|先行販売|受付開始|抽選受付/.test(ctx)) return "sale";
  if (/開催|実施|イベント|公開|放送|配信/.test(ctx)) return "event";
  return "event";
}

function deriveLabelFromContext_(ctx) {
  if (!ctx) return "";
  // lightweight: pick a keyword-ish label
  if (/先行販売/.test(ctx)) return "先行販売";
  if (/一般販売/.test(ctx)) return "一般販売";
  if (/抽選/.test(ctx)) return "抽選";
  if (/受付/.test(ctx)) return "受付";
  if (/キックオフ/.test(ctx)) return "キックオフ";
  if (/開催/.test(ctx)) return "開催";
  return "";
}

function finalizeItem_(it, article) {
  if (!it || !it.start || !it.end) return null;

  // Ensure end >= start
  if (it.end.getTime() < it.start.getTime()) {
    var tmp = it.start; it.start = it.end; it.end = tmp;
  }

  // Normalize type
  it.type = it.type || "event";
  it.label = it.label || "";

  // itemKey: stable based on URL + type + start/end + label (normalized)
  var material = [
    (article && article.url ? article.url : ""),
    it.type,
    formatIso_(it.start),
    formatIso_(it.end),
    normalizeForKey_(it.label)
  ].join("|");
  it.itemKey = sha256Hex(material);

  // Trim sourceText for logs
  it.sourceText = truncate_(normalizeSpaces(it.sourceText || ""), 300);

  return it;
}

function inferYear_(publishedDate) {
  if (publishedDate) return publishedDate.getFullYear();
  return new Date().getFullYear();
}

function resolveYearForMonth_(baseYear, month, publishedDate) {
  // If published month exists and target month is "earlier", assume next year for forward-looking announcements.
  if (!publishedDate) return baseYear;
  var pm = publishedDate.getMonth() + 1;
  var py = publishedDate.getFullYear();
  if (month + 2 < pm) return py + 1; // allow small backward refs
  return py;
}

function makeDate_(y, m, d, hh, mi) {
  // JS Date month is 0-based
  return new Date(y, m - 1, d, hh || 0, mi || 0, 0, 0);
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
