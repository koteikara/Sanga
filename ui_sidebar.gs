/** ui_sidebar.gs */

function menu_open_manual_event_sidebar() {
  var ui = SpreadsheetApp.getUi();
  var html = HtmlService.createTemplateFromFile("sidebar_form")
    .evaluate()
    .setTitle("手動イベント登録")
    .setWidth(360);
  ui.showSidebar(html);
}

function ui_init_sidebar() {
  console.log("[ui_init] start");

  // 1) CFG()
  console.log("[ui_init] CFG() start");
  var cfg = CFG();
  console.log("[ui_init] CFG() done: TZ=" + cfg.TZ +
              " LEDGER_SHEET_ID=" + cfg.LEDGER_SHEET_ID +
              " CAL_EVENTS_SHEET_NAME=" + cfg.CAL_EVENTS_SHEET_NAME);

  // 2) ensureCalendarEventsSheet()
  console.log("[ui_init] ensureCalendarEventsSheet() start");
  ensureCalendarEventsSheet();
  console.log("[ui_init] ensureCalendarEventsSheet() done");

  // 3) defaults
  var now = new Date();
  var ymd = Utilities.formatDate(now, cfg.TZ, "yyyy-MM-dd");
  var startIso = Utilities.formatDate(now, cfg.TZ, "yyyy-MM-dd'T'09:00:00");
  var endIso = Utilities.formatDate(now, cfg.TZ, "yyyy-MM-dd'T'10:00:00");

  console.log("[ui_init] done");
  return {
    ok: true,
    tz: cfg.TZ,
    defaultEventKey: "manual:" + ymd + ":new-event",
    defaultStartIso: startIso,
    defaultEndIso: endIso
  };
}

function ui_upsert_manual_event_from_form(form) {
  ensureCalendarEventsSheet();
  form = form || {};

  var rec = {
    eventKey: String(form.eventKey || "").trim(),
    calendarEventId: String(form.calendarEventId || "").trim(),
    source: String(form.source || "manual").trim() || "manual",
    status: String(form.status || "active").trim() || "active",
    title: String(form.title || "").trim(),
    startIso: String(form.startIso || "").trim(),
    endIso: String(form.endIso || "").trim(),
    isAllDay: (String(form.isAllDay || "").toLowerCase() === "true"),
    location: String(form.location || "").trim(),
    description: String(form.description || "").trim(),
    url: String(form.url || "").trim(),
    lastSyncAt: "",
    fingerprint: ""
  };

  if (!rec.eventKey) throw new Error("eventKey は必須です。");
  if (!rec.title) throw new Error("title は必須です。");
  if (!rec.startIso || !rec.endIso) throw new Error("startIso / endIso は必須です。");

  if (rec.isAllDay) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(rec.startIso)) rec.startIso = rec.startIso + "T00:00:00";
    if (/^\d{4}-\d{2}-\d{2}$/.test(rec.endIso)) rec.endIso = rec.endIso + "T23:59:00";
  }

  upsertCalendarEventsRow(rec);
  return getCalendarEventsRowByEventKey(rec.eventKey);
}

function ui_sync_calendar_events(dryRun) {
  dryRun = !!dryRun;
  ensureCalendarEventsSheet();
  sync_calendar_events_from_sheet(dryRun);
  return { ok: true, dryRun: dryRun };
}

function ui_import_calendar_events(timeMinIso, timeMaxIso, includeDeleted) {
  ensureCalendarEventsSheet();
  import_calendar_events_to_sheet(timeMinIso || "", timeMaxIso || "", !!includeDeleted);
  return { ok: true };
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
