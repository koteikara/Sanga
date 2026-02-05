/** calendar_upsert.gs */

// upsertCalendarEvent(item, article, {dryRun})
function upsertCalendarEvent(item, article, opt) {
  var cfg = CFG();
  opt = opt || {};
  var dryRun = !!opt.dryRun;

  // Ledger lookup by itemKey
  var row = getLedgerRowByItemKey(item.itemKey);

  var summary = buildSummary(item, article);
  var description = buildDescription(item, article);

  var fp = buildFingerprint(item, summary);

  if (!row) {
    if (dryRun) {
      console.log("[DRYRUN][insert] itemKey=" + item.itemKey + " summary=" + summary);
      return;
    }
    // Insert
    var event = insertEvent_(cfg, item, summary, description);
    upsertLedgerRow({
      itemKey: item.itemKey,
      calendarEventId: event.id,
      articleId: article.articleId || "",
      url: article.url || "",
      type: item.type || "",
      label: item.label || "",
      startIso: formatIsoLedger_(item.start),
      endIso: formatIsoLedger_(item.end),
      summary: summary,
      fingerprint: fp,
      lastUpsertAt: nowIso_(),
      status: "active"
    });
    console.log("[insert] itemKey=" + item.itemKey + " eventId=" + event.id);
    return;
  }

  // row exists
  if (row.fingerprint === fp) {
    console.log("[skip] itemKey=" + item.itemKey + " (fingerprint same)");
    return;
  }

  if (dryRun) {
    console.log("[DRYRUN][update] itemKey=" + item.itemKey + " eventId=" + row.calendarEventId);
    return;
  }

  // Update/Patch
  var patched = patchEvent_(cfg, row.calendarEventId, item, summary, description);
  upsertLedgerRow({
    itemKey: item.itemKey,
    calendarEventId: row.calendarEventId,
    articleId: article.articleId || row.articleId || "",
    url: article.url || row.url || "",
    type: item.type || row.type || "",
    label: item.label || row.label || "",
    startIso: formatIsoLedger_(item.start),
    endIso: formatIsoLedger_(item.end),
    summary: summary,
    fingerprint: fp,
    lastUpsertAt: nowIso_(),
    status: row.status || "active"
  });
  console.log("[update] itemKey=" + item.itemKey + " eventId=" + patched.id);
}

function buildSummary(item, article) {
  var cfg = CFG();
  var prefix = typePrefix_(item.type);
  var datePart = formatHumanRange_(item.start, item.end);
  var base = (prefix ? prefix + " " : "") + datePart + " " + (article && article.title ? article.title : "");
  base = normalizeSpaces(base);
  return truncateUtf16_(base, cfg.SUMMARY_MAX_LEN);
}

function buildDescription(item, article) {
  var cfg = CFG();
  var lines = [];
  lines.push("source: " + (article && article.url ? article.url : ""));
  if (article && article.articleId) lines.push("articleId: " + article.articleId);
  if (article && article.publishedYmd) lines.push("published: " + article.publishedYmd);
  if (item && item.type) lines.push("type: " + item.type);
  if (item && item.label) lines.push("label: " + item.label);
  if (item && item.sourceText) lines.push("evidence: " + item.sourceText);
  var s = lines.join("\n");
  if (s.length > cfg.DESCRIPTION_MAX_LEN) s = s.substring(0, cfg.DESCRIPTION_MAX_LEN - 1) + "…";
  return s;
}

function buildFingerprint(item, summary) {
  // fingerprint = hash(summary + "|" + startIso + "|" + endIso)
  var a = summary + "|" + formatIsoLedger_(item.start) + "|" + formatIsoLedger_(item.end);
  return sha256Hex(a);
}

// ---- Calendar API (Advanced Google Services: Calendar) ----

function insertEvent_(cfg, item, summary, description) {
  var event = {
    summary: summary,
    description: description,
    start: toEventDateTime_(item.start),
    end: toEventDateTime_(item.end)
  };
  return Calendar.Events.insert(event, cfg.TARGET_CALENDAR_ID);
}

function patchEvent_(cfg, eventId, item, summary, description) {
  var patch = {
    summary: summary,
    description: description,
    start: toEventDateTime_(item.start),
    end: toEventDateTime_(item.end)
  };
  return Calendar.Events.patch(patch, cfg.TARGET_CALENDAR_ID, eventId);
}

function toEventDateTime_(d) {
  var cfg = CFG();
  // Use RFC3339 with timezone offset via Utilities.formatDate
  var rfc3339 = Utilities.formatDate(d, cfg.TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");
  return { dateTime: rfc3339, timeZone: cfg.TZ };
}

// ---- formatting helpers ----

function typePrefix_(type) {
  if (type === "match") return "[試合]";
  if (type === "deadline") return "[締切]";
  if (type === "sale") return "[販売/受付]";
  if (type === "period") return "[期間]";
  if (type === "event") return "[イベント]";
  return "[予定]";
}

function formatHumanRange_(start, end) {
  var cfg = CFG();
  var s1 = Utilities.formatDate(start, cfg.TZ, "M/d");
  var t1 = Utilities.formatDate(start, cfg.TZ, "H:mm");
  var s2 = Utilities.formatDate(end, cfg.TZ, "M/d");
  var t2 = Utilities.formatDate(end, cfg.TZ, "H:mm");

  // If looks like all-day (00:00-23:59)
  var allDayish = (t1 === "0:00" && (t2 === "23:59" || t2 === "23:58"));

  if (s1 === s2) {
    if (allDayish) return s1;
    // if end is within same day and not all-day, show time range
    return s1 + " " + t1 + "-" + t2;
  }
  return s1 + "〜" + s2;
}

function formatIsoLedger_(d) {
  var cfg = CFG();
  return Utilities.formatDate(d, cfg.TZ, "yyyy-MM-dd'T'HH:mm:ss");
}

function nowIso_() {
  var cfg = CFG();
  return Utilities.formatDate(new Date(), cfg.TZ, "yyyy-MM-dd'T'HH:mm:ss");
}

function truncateUtf16_(s, maxLen) {
  s = String(s || "");
  if (s.length <= maxLen) return s;
  return s.substring(0, Math.max(0, maxLen - 1)) + "…";
}
