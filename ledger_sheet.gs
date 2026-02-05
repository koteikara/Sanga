/** ledger_sheet.gs
 *
 * - EventLedger: TemporalItem upsert ledger (itemKey-based)
 * - CalendarEvents: Manual/Imported event management sheet (eventKey-based)
 */

function ensureLedgerSheet() {
  var cfg = CFG();
  var ss = openLedgerSpreadsheet_(cfg);
  var sh = ss.getSheetByName(cfg.LEDGER_SHEET_NAME);
  if (!sh) sh = ss.insertSheet(cfg.LEDGER_SHEET_NAME);

  var header = [
    "itemKey","calendarEventId","articleId","url","type","label",
    "startIso","endIso","summary","fingerprint","lastUpsertAt","status"
  ];

  var firstRow = sh.getRange(1, 1, 1, header.length).getValues()[0];
  var mismatch = false;
  for (var i = 0; i < header.length; i++) {
    if (String(firstRow[i] || "") !== header[i]) { mismatch = true; break; }
  }
  if (mismatch) {
    sh.getRange(1, 1, 1, header.length).setValues([header]);
    sh.setFrozenRows(1);
  }
}

function ensureCalendarEventsSheet() {
  var cfg = CFG();
  var ss = openLedgerSpreadsheet_(cfg);
  var sh = ss.getSheetByName(cfg.CAL_EVENTS_SHEET_NAME);
  if (!sh) sh = ss.insertSheet(cfg.CAL_EVENTS_SHEET_NAME);

  var header = [
    "eventKey","calendarEventId","source","status","title",
    "startIso","endIso","isAllDay","location","description",
    "url","lastSyncAt","fingerprint"
  ];

  var firstRow = sh.getRange(1, 1, 1, header.length).getValues()[0];
  var mismatch = false;
  for (var i = 0; i < header.length; i++) {
    if (String(firstRow[i] || "") !== header[i]) { mismatch = true; break; }
  }
  if (mismatch) {
    sh.getRange(1, 1, 1, header.length).setValues([header]);
    sh.setFrozenRows(1);
  }
}

/** -----------------------------
 * EventLedger operations
 * ----------------------------- */

function getLedgerRowByItemKey(itemKey) {
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
      if (String(values[i][0]) === String(itemKey)) {
        return ledgerRowArrayToObj_(values[i], i + 2);
      }
    }
    return null;
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

function upsertLedgerRow(record) {
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
    var rowNum = findRowByKey_(sh, 1, record.itemKey, 2);

    var row = [
      record.itemKey || "",
      record.calendarEventId || "",
      record.articleId || "",
      record.url || "",
      record.type || "",
      record.label || "",
      record.startIso || "",
      record.endIso || "",
      record.summary || "",
      record.fingerprint || "",
      record.lastUpsertAt || "",
      record.status || ""
    ];

    if (rowNum === -1) sh.appendRow(row);
    else sh.getRange(rowNum, 1, 1, row.length).setValues([row]);
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

function ledgerRowArrayToObj_(arr, rowNum) {
  return {
    _rowNum: rowNum,
    itemKey: String(arr[0] || ""),
    calendarEventId: String(arr[1] || ""),
    articleId: String(arr[2] || ""),
    url: String(arr[3] || ""),
    type: String(arr[4] || ""),
    label: String(arr[5] || ""),
    startIso: String(arr[6] || ""),
    endIso: String(arr[7] || ""),
    summary: String(arr[8] || ""),
    fingerprint: String(arr[9] || ""),
    lastUpsertAt: String(arr[10] || ""),
    status: String(arr[11] || "")
  };
}

/** -----------------------------
 * CalendarEvents operations
 * ----------------------------- */

function getCalendarEventsRowByEventKey(eventKey) {
  ensureCalendarEventsSheet();
  var cfg = CFG();
  var ss = openLedgerSpreadsheet_(cfg);
  var sh = ss.getSheetByName(cfg.CAL_EVENTS_SHEET_NAME);

  var lock = LockService.getDocumentLock();
  try {
    lock.waitLock(2000);
  } catch (e) {
    throw new Error("CalendarEvents is locked by another execution. Stop running executions and retry.");
  }

  try {
    var lastRow = sh.getLastRow();
    if (lastRow <= 1) return null;

    var values = sh.getRange(2, 1, lastRow - 1, 13).getValues();
    for (var i = 0; i < values.length; i++) {
      if (String(values[i][0]) === String(eventKey)) {
        return calEventsRowArrayToObj_(values[i], i + 2);
      }
    }
    return null;
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

function getCalendarEventsRowByEventId(calendarEventId) {
  ensureCalendarEventsSheet();
  var cfg = CFG();
  var ss = openLedgerSpreadsheet_(cfg);
  var sh = ss.getSheetByName(cfg.CAL_EVENTS_SHEET_NAME);

  var lock = LockService.getDocumentLock();
  try {
    lock.waitLock(2000);
  } catch (e) {
    throw new Error("CalendarEvents is locked by another execution. Stop running executions and retry.");
  }

  try {
    var lastRow = sh.getLastRow();
    if (lastRow <= 1) return null;

    var values = sh.getRange(2, 1, lastRow - 1, 13).getValues();
    for (var i = 0; i < values.length; i++) {
      if (String(values[i][1]) === String(calendarEventId)) {
        return calEventsRowArrayToObj_(values[i], i + 2);
      }
    }
    return null;
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

function upsertCalendarEventsRow(record) {
  ensureCalendarEventsSheet();
  var cfg = CFG();
  var ss = openLedgerSpreadsheet_(cfg);
  var sh = ss.getSheetByName(cfg.CAL_EVENTS_SHEET_NAME);

  var lock = LockService.getDocumentLock();
  try {
    lock.waitLock(2000);
  } catch (e) {
    throw new Error("CalendarEvents is locked by another execution. Stop running executions and retry.");
  }

  try {
    var rowNum = findRowByKey_(sh, 1, record.eventKey, 2);

    var row = [
      record.eventKey || "",
      record.calendarEventId || "",
      record.source || "",
      record.status || "",
      record.title || "",
      record.startIso || "",
      record.endIso || "",
      record.isAllDay === true ? "TRUE" : (record.isAllDay === false ? "FALSE" : String(record.isAllDay || "")),
      record.location || "",
      record.description || "",
      record.url || "",
      record.lastSyncAt || "",
      record.fingerprint || ""
    ];

    if (rowNum === -1) sh.appendRow(row);
    else sh.getRange(rowNum, 1, 1, row.length).setValues([row]);
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

function listCalendarEventsRecords(options) {
  ensureCalendarEventsSheet();
  options = options || {};

  var cfg = CFG();
  var ss = openLedgerSpreadsheet_(cfg);
  var sh = ss.getSheetByName(cfg.CAL_EVENTS_SHEET_NAME);

  var lastRow = sh.getLastRow();
  if (lastRow <= 1) return [];

  var values = sh.getRange(2, 1, lastRow - 1, 13).getValues();
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var rec = calEventsRowArrayToObj_(values[i], i + 2);
    if (options.onlyActive && rec.status && String(rec.status).toLowerCase() === "cancelled") continue;
    out.push(rec);
  }
  return out;
}

function calEventsRowArrayToObj_(arr, rowNum) {
  var isAllDayRaw = String(arr[7] || "");
  var isAllDay = null;
  if (isAllDayRaw === "TRUE" || isAllDayRaw === "true") isAllDay = true;
  if (isAllDayRaw === "FALSE" || isAllDayRaw === "false") isAllDay = false;

  return {
    _rowNum: rowNum,
    eventKey: String(arr[0] || ""),
    calendarEventId: String(arr[1] || ""),
    source: String(arr[2] || ""),
    status: String(arr[3] || ""),
    title: String(arr[4] || ""),
    startIso: String(arr[5] || ""),
    endIso: String(arr[6] || ""),
    isAllDay: isAllDay,
    location: String(arr[8] || ""),
    description: String(arr[9] || ""),
    url: String(arr[10] || ""),
    lastSyncAt: String(arr[11] || ""),
    fingerprint: String(arr[12] || "")
  };
}

/** -----------------------------
 * shared helpers
 * ----------------------------- */

function findRowByKey_(sheet, keyColIndex1Based, keyValue, startRow) {
  startRow = startRow || 2;
  var lastRow = sheet.getLastRow();
  if (lastRow < startRow) return -1;

  var range = sheet.getRange(startRow, keyColIndex1Based, lastRow - startRow + 1, 1).getValues();
  for (var i = 0; i < range.length; i++) {
    if (String(range[i][0]) === String(keyValue)) return startRow + i;
  }
  return -1;
}

/**
 * Prefer active spreadsheet when spreadsheet-bound.
 * Fall back to openById when needed.
 */
function openLedgerSpreadsheet_(cfg) {
  try {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) {
      var activeId = String(active.getId() || "");
      if (!cfg.LEDGER_SHEET_ID || cfg.LEDGER_SHEET_ID === activeId) return active;
    }
  } catch (e) {}

  if (!cfg.LEDGER_SHEET_ID) {
    throw new Error("LEDGER_SHEET_ID is empty. Put it in Config sheet (recommended).");
  }
  return SpreadsheetApp.openById(cfg.LEDGER_SHEET_ID);
}
