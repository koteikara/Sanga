/** main.gs */

function run() {
  var cfg = CFG();
  logRuntime_(cfg);
  ensureSafety_(cfg);

  // シート整備
  ensureLedgerSheet();
  ensureCalendarEventsSheet();

  var listUrl = cfg.NEWS_LIST_URL;
  var maxPages = cfg.MAX_PAGES_RUN;
  if (!maxPages || maxPages < 1) {
    console.log("[run] MAX_PAGES_RUN is invalid. fallback to 1 (was " + maxPages + ")");
    maxPages = 1;
  }
  console.log("[run] start listUrl=" + listUrl + " maxPages=" + maxPages);

  var allArticles = [];
  for (var p = 1; p <= maxPages; p++) {
    var url = buildListPageUrl_(listUrl, p);
    var html = "";
    try {
      html = fetchHtml(url);
    } catch (e) {
      console.error("[run][list] fetch failed page=" + p + " url=" + url + " error=" + String(e && e.stack ? e.stack : e));
      throw e;
    }
    console.log("[run][list] page=" + p + " url=" + url + " htmlLen=" + (html ? html.length : 0));
    var articles = [];
    try {
      articles = parseNewsList(html) || [];
    } catch (e2) {
      console.error("[run][list] parse failed page=" + p + " url=" + url + " error=" + String(e2 && e2.stack ? e2.stack : e2));
      throw e2;
    }
    console.log("[run][list] page=" + p + " parsed=" + articles.length);
    if (articles.length === 0) {
      console.log("[run][list] empty page=" + p + " break");
      break;
    }
    allArticles = allArticles.concat(articles);
    console.log("[run][list] page=" + p + " accumulated=" + allArticles.length);
  }

  console.log("[run] pre-dedupe articles=" + allArticles.length);
  allArticles = dedupeArticles_(allArticles);
  console.log("[run] post-dedupe articles=" + allArticles.length);

  var totalItems = 0;
  for (var i = 0; i < allArticles.length; i++) {
    var a = allArticles[i];
    try {
      var detailHtml = fetchHtml(a.url);
      var items = parseArticleDetail(detailHtml, a); // parse_detail.gs 側
      if (!items || items.length === 0) continue;

      for (var j = 0; j < items.length; j++) {
        totalItems += 1;
        upsertCalendarEvent(items[j], a, { dryRun: false }); // calendar_upsert.gs 側
      }
    } catch (e) {
      console.error("[run] article failed:", a.url, String(e && e.stack ? e.stack : e));
    }
  }

  console.log("[run] done. articles=" + allArticles.length + " items=" + totalItems);
}

function run_test_only() {
  var cfg = CFG();
  logRuntime_(cfg);
  ensureSafety_(cfg);

  ensureLedgerSheet();
  ensureCalendarEventsSheet();

  var testUrl = getProp("TEST_URL", "");
  if (!testUrl) throw new Error("TEST_URL is empty in ScriptProperties.");

  var fake = {
    articleId: extractArticleIdFromUrl_(testUrl),
    url: testUrl,
    title: "(test) " + testUrl,
    publishedYmd: ""
  };

  var detailHtml = fetchHtml(testUrl);
  var items = parseArticleDetail(detailHtml, fake);

  console.log("[run_test_only] extracted items=" + (items ? items.length : 0));
  if (items) {
    for (var i = 0; i < items.length; i++) {
      upsertCalendarEvent(items[i], fake, { dryRun: false });
    }
  }
}

function run_full_scan(year, dryRun) {
  var cfg = CFG();
  logRuntime_(cfg);
  ensureSafety_(cfg);

  ensureLedgerSheet();
  ensureCalendarEventsSheet();

  year = parseInt(year, 10);
  if (!year) throw new Error("year is required (e.g. 2026).");
  dryRun = !!dryRun;

  var listUrl = cfg.NEWS_LIST_URL;
  var page = 1;
  var stopEmptyCount = 0;

  var scannedArticles = 0;
  var upsertedItems = 0;

  while (true) {
    var url = buildListPageUrl_(listUrl, page);
    var html = fetchHtml(url);
    var articles = parseNewsList(html);

    if (!articles || articles.length === 0) {
      stopEmptyCount += 1;
      if (stopEmptyCount >= 2) break;
      page += 1;
      continue;
    }

    for (var i = 0; i < articles.length; i++) {
      var a = articles[i];
      scannedArticles += 1;

      try {
        var detailHtml = fetchHtml(a.url);
        var items = parseArticleDetail(detailHtml, a);
        items = filterItemsByYear_(items, year);

        for (var j = 0; j < items.length; j++) {
          upsertedItems += 1;
          upsertCalendarEvent(items[j], a, { dryRun: dryRun });
        }
      } catch (e) {
        console.error("[run_full_scan] article failed:", a.url, String(e && e.stack ? e.stack : e));
      }
    }

    page += 1;
    if (page > 2000) break;
  }

  console.log("[run_full_scan] done. year=" + year + " dryRun=" + dryRun +
              " scannedArticles=" + scannedArticles + " items=" + upsertedItems);
}

/** =========================================================
 * Menu / Entry points
 * ========================================================= */

function menu_sync_calendar_events_dryrun() {
  ensureCalendarEventsSheet();
  sync_calendar_events_from_sheet(true);
}

function menu_sync_calendar_events() {
  ensureCalendarEventsSheet();
  sync_calendar_events_from_sheet(false);
}

function menu_import_calendar_events_default_range() {
  ensureCalendarEventsSheet();
  import_calendar_events_to_sheet("", "", false);
}

function menu_import_calendar_events_from_props() {
  ensureCalendarEventsSheet();
  var minIso = getProp("IMPORT_TIME_MIN", "");
  var maxIso = getProp("IMPORT_TIME_MAX", "");
  var inc = String(getProp("IMPORT_INCLUDE_DELETED", "false")).toLowerCase() === "true";
  import_calendar_events_to_sheet(minIso, maxIso, inc);
}

function menu_add_manual_event_template() {
  ensureCalendarEventsSheet();
  var cfg = CFG();
  var key = "manual:" + Utilities.formatDate(new Date(), cfg.TZ, "yyyy-MM-dd") + ":new-event";

  upsertCalendarEventsRow({
    eventKey: key,
    calendarEventId: "",
    source: "manual",
    status: "active",
    title: "（手動）イベント名を入力",
    startIso: Utilities.formatDate(new Date(), cfg.TZ, "yyyy-MM-dd'T'09:00:00"),
    endIso: Utilities.formatDate(new Date(), cfg.TZ, "yyyy-MM-dd'T'10:00:00"),
    isAllDay: false,
    location: "",
    description: "",
    url: "",
    lastSyncAt: "",
    fingerprint: ""
  });

  console.log("[template] added eventKey=" + key);
}

function onOpen() {
  try {
    var ui = SpreadsheetApp.getUi();
    ui.createMenu("ニュース連動カレンダー管理")
      .addItem("手動でイベントを登録・編集する", "menu_open_manual_event_sidebar") // ui_sidebar.gs に本体がある前提
      .addSeparator()
      .addItem("変更内容を確認する（カレンダーは変更しない）", "menu_sync_calendar_events_dryrun")
      .addItem("シート内容をカレンダーに反映する", "menu_sync_calendar_events")
      .addSeparator()
      .addItem("カレンダーからイベントを取り込む（復旧用）", "menu_import_calendar_events_default_range")
      .addSeparator()
      .addItem("手動イベントの入力用行を追加", "menu_add_manual_event_template")
      .addToUi();
  } catch (e) {
    console.log("[onOpen] skipped: " + String(e));
  }
}

/** -----------------------------
 * internals
 * ----------------------------- */

function buildListPageUrl_(baseUrl, page) {
  if (page <= 1) return baseUrl;
  return baseUrl + (baseUrl.indexOf("?") >= 0 ? "&" : "?") + "page=" + page;
}

function dedupeArticles_(articles) {
  var seen = {};
  var out = [];
  for (var i = 0; i < articles.length; i++) {
    var a = articles[i];
    var k = (a.articleId || "") + "|" + (a.url || "");
    if (seen[k]) continue;
    seen[k] = true;
    out.push(a);
  }
  return out;
}

function filterItemsByYear_(items, year) {
  if (!items || items.length === 0) return [];
  var out = [];
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var sy = it.start ? it.start.getFullYear() : null;
    var ey = it.end ? it.end.getFullYear() : null;
    if (sy === year || ey === year) out.push(it);
  }
  return out;
}

function ensureSafety_(cfg) {
  if (!cfg.TARGET_CALENDAR_ID || cfg.TARGET_CALENDAR_ID === "primary") {
    throw new Error("Safety stop: TARGET_CALENDAR_ID is empty or 'primary'.");
  }
  if (!cfg.LEDGER_SHEET_ID) {
    throw new Error("LEDGER_SHEET_ID is empty. Use a dedicated spreadsheet for EventLedger/CalendarEvents.");
  }
}

function logRuntime_(cfg) {
  var cal = Calendar.Calendars.get(cfg.TARGET_CALENDAR_ID);
  console.log("[runtime] calendar id=" + cfg.TARGET_CALENDAR_ID +
              " summary=" + (cal && cal.summary ? cal.summary : "") +
              " accessRole=" + (cal && cal.accessRole ? cal.accessRole : ""));
}

/** ニュース1件の抽出だけ確認（カレンダー登録しない） */
function run_test_extract_only() {
  var cfg = CFG();
  logRuntime_(cfg);
  ensureSafety_(cfg);

  var testUrl = getProp("TEST_URL", "");
  if (!testUrl) {
    throw new Error("TEST_URL is empty. ScriptProperties に TEST_URL を入れてください。");
  }

  var article = {
    articleId: extractArticleIdFromUrl_(testUrl),
    url: testUrl,
    title: "(test) " + testUrl,
    publishedYmd: ""
  };

  var detailHtml = fetchHtml(testUrl);
  var items = parseArticleDetail(detailHtml, article) || [];

  console.log("[extract-only] url=" + testUrl);
  console.log("[extract-only] items=" + items.length);

  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    console.log(
      "[item#" + (i + 1) + "] " +
      "itemKey=" + (it.itemKey || "") +
      " type=" + it.type +
      " start=" + (it.start ? Utilities.formatDate(it.start, cfg.TZ, "yyyy-MM-dd'T'HH:mm:ss") : "") +
      " end=" + (it.end ? Utilities.formatDate(it.end, cfg.TZ, "yyyy-MM-dd'T'HH:mm:ss") : "") +
      " label=" + (it.label || "") +
      " sourceText=" + (it.sourceText || "")
    );
  }

  console.log("[extract-only] done");
}

function run_test_list_only() {
  var cfg = CFG();
  var html = fetchHtml(cfg.NEWS_LIST_URL);
  console.log("[list-only] url=" + cfg.NEWS_LIST_URL + " htmlLen=" + (html ? html.length : 0));
  console.log("[list-only] raw /news/detail count=" + (html.match(/\/news\/detail\/\d+/g) || []).length);
  var articles = parseNewsList(html);
  console.log("[list-only] parsed articles=" + (articles ? articles.length : 0));
  articles = articles || [];
  if (articles[0]) console.log("[list-only] first=" + JSON.stringify(articles[0]));
}

function run_debug_list_scan() {
  var cfg = CFG();
  var url = cfg.NEWS_LIST_URL;
  var html = fetchHtml(url) || "";

  console.log("[scan] url=" + url + " htmlLen=" + html.length);

  var m = html.match(/\/news\/detail\/\d+/g) || [];
  console.log("[scan] /news/detail count=" + m.length);
  if (m[0]) console.log("[scan] sample=" + m.slice(0, 5).join(", "));

  // タイトルっぽい手がかり（ありがちな class/id を軽く確認）
  console.log("[scan] has 'news' word? " + (html.indexOf("news") >= 0));
  console.log("[scan] has 'detail' word? " + (html.indexOf("detail") >= 0));
}
