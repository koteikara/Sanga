/** config.gs
 *
 * IMPORTANT:
 * - This file defines CFG() and getProp().
 * - Other modules (ledger_sheet.gs, fetch.gs, etc.) depend on CFG().
 */

var TZ_DEFAULT = "Asia/Tokyo";
var NEWS_LIST_URL_DEFAULT = "https://www.sanga-fc.jp/news";

// IDs (should be set in Config sheet; ScriptProperties is bootstrap/fallback only)
var TARGET_CALENDAR_ID_DEFAULT = "";
var LEDGER_SHEET_ID_DEFAULT = "";

// Sheet names
var LEDGER_SHEET_NAME_DEFAULT = "EventLedger";
var CAL_EVENTS_SHEET_NAME_DEFAULT = "CalendarEvents";
var CONFIG_SHEET_NAME_DEFAULT = "Config";
var APIKEYS_SHEET_NAME_DEFAULT = "APIKeys";

// Runtime limits
var MAX_PAGES_RUN_DEFAULT = 2;
var FETCH_TIMEOUT_MS_DEFAULT = 20000;
var FETCH_RETRY_DEFAULT = 3;
var FETCH_SLEEP_BETWEEN_RETRY_MS_DEFAULT = 600;

// Output formatting
var SUMMARY_MAX_LEN_DEFAULT = 80;
var DESCRIPTION_MAX_LEN_DEFAULT = 8000;

function getProp(key, defaultValue) {
  var v = PropertiesService.getScriptProperties().getProperty(key);
  if (v === null || v === undefined || v === "") return defaultValue;
  return v;
}

function CFG() {
  // Base (bootstrap) from ScriptProperties
  var base = {
    TZ: getProp("TZ", TZ_DEFAULT),

    NEWS_LIST_URL: getProp("NEWS_LIST_URL", NEWS_LIST_URL_DEFAULT),
    TARGET_CALENDAR_ID: getProp("TARGET_CALENDAR_ID", TARGET_CALENDAR_ID_DEFAULT),
    LEDGER_SHEET_ID: getProp("LEDGER_SHEET_ID", LEDGER_SHEET_ID_DEFAULT),

    LEDGER_SHEET_NAME: getProp("LEDGER_SHEET_NAME", LEDGER_SHEET_NAME_DEFAULT),
    CAL_EVENTS_SHEET_NAME: getProp("CAL_EVENTS_SHEET_NAME", CAL_EVENTS_SHEET_NAME_DEFAULT),
    CONFIG_SHEET_NAME: getProp("CONFIG_SHEET_NAME", CONFIG_SHEET_NAME_DEFAULT),
    APIKEYS_SHEET_NAME: getProp("APIKEYS_SHEET_NAME", APIKEYS_SHEET_NAME_DEFAULT),

    MAX_PAGES_RUN: parseInt(getProp("MAX_PAGES_RUN", String(MAX_PAGES_RUN_DEFAULT)), 10) || MAX_PAGES_RUN_DEFAULT,
    FETCH_TIMEOUT_MS: parseInt(getProp("FETCH_TIMEOUT_MS", String(FETCH_TIMEOUT_MS_DEFAULT)), 10) || FETCH_TIMEOUT_MS_DEFAULT,
    FETCH_RETRY: parseInt(getProp("FETCH_RETRY", String(FETCH_RETRY_DEFAULT)), 10) || FETCH_RETRY_DEFAULT,
    FETCH_SLEEP_BETWEEN_RETRY_MS: parseInt(getProp("FETCH_SLEEP_BETWEEN_RETRY_MS", String(FETCH_SLEEP_BETWEEN_RETRY_MS_DEFAULT)), 10) || FETCH_SLEEP_BETWEEN_RETRY_MS_DEFAULT,

    SUMMARY_MAX_LEN: parseInt(getProp("SUMMARY_MAX_LEN", String(SUMMARY_MAX_LEN_DEFAULT)), 10) || SUMMARY_MAX_LEN_DEFAULT,
    DESCRIPTION_MAX_LEN: parseInt(getProp("DESCRIPTION_MAX_LEN", String(DESCRIPTION_MAX_LEN_DEFAULT)), 10) || DESCRIPTION_MAX_LEN_DEFAULT
  };

  // Override by Config sheet (primary source)
  // Requires config_sheet.gs to be present
  try {
    return applyConfigSheetOverrides_(base);
  } catch (e) {
    console.log("[CFG] Config sheet override skipped: " + String(e && e.message ? e.message : e));
    return base;
  }
}
