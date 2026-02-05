/** calendar_upsert.gs */

// upsertCalendarEvent(item, article, {dryRun})
function upsertCalendarEvent(item, article, opt) {
  var cfg = CFG();
  opt = opt || {};
  var dryRun = !!opt.dryRun;

  if (!item || item.type !== "sale") {
    console.log("[skip] itemKey=" + (item && item.itemKey ? item.itemKey : "") + " (not sale)");
    return;
  }

  var normalizedItem = normalizeSaleItem_(item);

  var summary = buildSaleSummary_(normalizedItem);
  var description = buildDescription(normalizedItem, article);

  var fp = buildFingerprint(normalizedItem, summary);

  // Ledger lookup by itemKey + fingerprint
  var matchedRow = getLedgerRowByItemKeyAndFingerprint_(normalizedItem.itemKey, fp);
  if (matchedRow) {
    console.log("[skip] itemKey=" + normalizedItem.itemKey + " (fingerprint same)");
    return;
  }

  // Ledger lookup by itemKey
  var row = getLedgerRowByItemKey(normalizedItem.itemKey);

  if (!row) {
    if (dryRun) {
      console.log("[DRYRUN][insert] itemKey=" + normalizedItem.itemKey + " summary=" + summary);
      return;
    }
    // Insert
    var event = insertEvent_(cfg, normalizedItem, summary, description);
    upsertLedgerRow({
      itemKey: normalizedItem.itemKey,
      calendarEventId: event.id,
      articleId: article.articleId || "",
      url: article.url || "",
      type: normalizedItem.type || "",
      label: normalizedItem.label || "",
      startIso: formatIsoLedger_(normalizedItem.start),
      endIso: formatIsoLedger_(normalizedItem.end),
      summary: summary,
      fingerprint: fp,
      lastUpsertAt: nowIso_(),
      status: "active"
    });
    console.log("[insert] itemKey=" + normalizedItem.itemKey + " eventId=" + event.id);
    return;
  }

  if (dryRun) {
    console.log("[DRYRUN][update] itemKey=" + normalizedItem.itemKey + " eventId=" + row.calendarEventId);
    return;
  }

  // Update/Patch
  var patched = patchEvent_(cfg, row.calendarEventId, normalizedItem, summary, description);
  upsertLedgerRow({
    itemKey: normalizedItem.itemKey,
    calendarEventId: row.calendarEventId,
    articleId: article.articleId || row.articleId || "",
    url: article.url || row.url || "",
    type: normalizedItem.type || row.type || "",
    label: normalizedItem.label || row.label || "",
    startIso: formatIsoLedger_(normalizedItem.start),
    endIso: formatIsoLedger_(normalizedItem.end),
    summary: summary,
    fingerprint: fp,
    lastUpsertAt: nowIso_(),
    status: row.status || "active"
  });
  console.log("[patch] itemKey=" + normalizedItem.itemKey + " eventId=" + patched.id);
}

function buildSummary(item, article) {
  var cfg = CFG();
  var prefix = typePrefix_(item.type);
  var datePart = formatHumanRange_(item.start, item.end);
  var base = (prefix ? prefix + " " : "") + datePart + " " + (article && article.title ? article.title : "");
  base = normalizeSpaces(base);
  return truncateUtf16_(base, cfg.SUMMARY_MAX_LEN);
}

function buildSaleSummary_(item) {
  var cfg = CFG();
  var label = item && item.label ? item.label : "販売開始";
  var base = "【販売開始】" + label;
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

function normalizeSaleItem_(item) {
  var cfg = CFG();
  var normalized = {};
  for (var k in item) {
    if (Object.prototype.hasOwnProperty.call(item, k)) normalized[k] = item[k];
  }

  var start = item && item.start ? new Date(item.start) : null;
  var end = item && item.end ? new Date(item.end) : null;
  normalized.start = start;
  normalized.end = end;

  if (!start) return normalized;

  var startDay = Utilities.formatDate(start, cfg.TZ, "yyyy-MM-dd");
  var endDay = end ? Utilities.formatDate(end, cfg.TZ, "yyyy-MM-dd") : null;
  if (!end || endDay !== startDay) {
    var corrected = new Date(start);
    corrected.setHours(23, 59, 0, 0);
    normalized.end = corrected;
  }
  return normalized;
}

function getLedgerRowByItemKeyAndFingerprint_(itemKey, fingerprint) {
  var cfg = CFG();
  var ss = openLedgerSpreadsheet_(cfg);
  var sh = ss.getSheetByName(cfg.LEDGER_SHEET_NAME);
  if (!sh) throw new Error("Ledger sheet missing. Call ensureLedgerSheet() first.");

  var lock = LockService.getDocumentLock();
  try {
    lock.waitLock(2000);
  } catch (e) {
    throw new Error("EventLedger is locked by another execution. Stop running executions and retry.");
  }

  try {
    var lastRow = sh.getLastRow();
    if (lastRow <= 1) return null;

    var values = sh.getRange(2, 1, lastRow - 1, 12).getValues();
    for (var i = 0; i < values.length; i++) {
      if (String(values[i][0]) === String(itemKey) && String(values[i][9]) === String(fingerprint)) {
        return ledgerRowArrayToObj_(values[i], i + 2);
      }
    }
    return null;
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}
