/** config_sheet.gs
 *
 * IMPORTANT:
 * - DO NOT call CFG() in this file to avoid recursion.
 * - Use ScriptProperties + defaults (from config.gs global constants) only.
 *
 * Bootstrap priority:
 * 1) active spreadsheet id (spreadsheet-bound)
 * 2) ScriptProperties.CONFIG_SHEET_ID
 * 3) ScriptProperties.LEDGER_SHEET_ID
 *
 * Config sheet format:
 *   A:key | B:value | C:description
 */

function getConfigValue(key, defaultValue) {
  key = normalizeConfigKey_(key);
  var map = getConfigMapCached_();
  var v = map[key];
  if (v === undefined || v === null || String(v).trim() === "") return defaultValue;
  return String(v);
}

function getConfigValueAsInt(key, defaultValue) {
  var v = getConfigValue(key, "");
  if (v === "") return defaultValue;
  var n = parseInt(v, 10);
  return isNaN(n) ? defaultValue : n;
}

function getConfigValueAsBool(key, defaultValue) {
  var v = String(getConfigValue(key, "") || "").toLowerCase().trim();
  if (!v) return defaultValue;
  if (v === "true" || v === "1" || v === "yes" || v === "y") return true;
  if (v === "false" || v === "0" || v === "no" || v === "n") return false;
  return defaultValue;
}

/**
 * Apply Config sheet values onto a base config object (from config.gs).
 * Config sheet is the source of truth.
 */
function applyConfigSheetOverrides_(cfgObj) {
  var out = shallowClone_(cfgObj);

  // Core IDs (requested)
  out.LEDGER_SHEET_ID = getConfigValue("LEDGER_SHEET_ID", out.LEDGER_SHEET_ID);
  out.TARGET_CALENDAR_ID = getConfigValue("TARGET_CALENDAR_ID", out.TARGET_CALENDAR_ID);

  // General
  out.TZ = getConfigValue("TZ", out.TZ);
  out.NEWS_LIST_URL = getConfigValue("NEWS_LIST_URL", out.NEWS_LIST_URL);

  // Runtime params
  out.MAX_PAGES_RUN = getConfigValueAsInt("MAX_PAGES_RUN", out.MAX_PAGES_RUN);
  out.FETCH_TIMEOUT_MS = getConfigValueAsInt("FETCH_TIMEOUT_MS", out.FETCH_TIMEOUT_MS);
  out.FETCH_RETRY = getConfigValueAsInt("FETCH_RETRY", out.FETCH_RETRY);
  out.FETCH_SLEEP_BETWEEN_RETRY_MS = getConfigValueAsInt("FETCH_SLEEP_BETWEEN_RETRY_MS", out.FETCH_SLEEP_BETWEEN_RETRY_MS);

  // Output formatting
  out.SUMMARY_MAX_LEN = getConfigValueAsInt("SUMMARY_MAX_LEN", out.SUMMARY_MAX_LEN);
  out.DESCRIPTION_MAX_LEN = getConfigValueAsInt("DESCRIPTION_MAX_LEN", out.DESCRIPTION_MAX_LEN);

  // Sheet names (optional)
  out.LEDGER_SHEET_NAME = getConfigValue("LEDGER_SHEET_NAME", out.LEDGER_SHEET_NAME);
  out.CAL_EVENTS_SHEET_NAME = getConfigValue("CAL_EVENTS_SHEET_NAME", out.CAL_EVENTS_SHEET_NAME);

  return out;
}

/** Optional API key retrieval from APIKeys sheet (service | apiKey | note) */
function getApiKey(serviceName, defaultValue) {
  var sheetId = resolveBootstrapSheetId_();
  if (!sheetId) return defaultValue;

  var apiSheetName = String(getProp("APIKEYS_SHEET_NAME", typeof APIKEYS_SHEET_NAME_DEFAULT !== "undefined" ? APIKEYS_SHEET_NAME_DEFAULT : "APIKeys"));

  var ss = SpreadsheetApp.openById(sheetId);
  var sh = ss.getSheetByName(apiSheetName);
  if (!sh) return defaultValue;

  var lastRow = sh.getLastRow();
  if (lastRow <= 1) return defaultValue;

  var values = sh.getRange(2, 1, lastRow - 1, 3).getValues();
  var target = String(serviceName || "").trim().toLowerCase();

  for (var i = 0; i < values.length; i++) {
    var s = String(values[i][0] || "").trim().toLowerCase();
    if (s && s === target) {
      var k = String(values[i][1] || "").trim();
      return k || defaultValue;
    }
  }
  return defaultValue;
}

/** Debug utility: clear config cache immediately */
function debug_clear_config_cache() {
  CacheService.getScriptCache().remove("CONFIG_MAP_V1");
  console.log("[config] cache cleared");
}

/** -----------------------------
 * Internal helpers
 * ----------------------------- */

function getConfigMapCached_() {
  var cache = CacheService.getScriptCache();
  var cacheKey = "CONFIG_MAP_V1";
  var cached = cache.get(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch (e) {}
  }

  var lock = LockService.getDocumentLock();
  try {
    lock.waitLock(2000);
  } catch (e2) {
    throw new Error("Config read is locked by another execution. Stop running executions and retry.");
  }

  try {
    cached = cache.get(cacheKey);
    if (cached) {
      try { return JSON.parse(cached); } catch (e3) {}
    }

    var map = getConfigMap_();
    cache.put(cacheKey, JSON.stringify(map), 300);
    return map;
  } finally {
    try { lock.releaseLock(); } catch (e4) {}
  }
}

function getConfigMap_() {
  var sheetId = resolveBootstrapSheetId_();
  if (!sheetId) {
    throw new Error("Bootstrap failed: spreadsheet-bound required OR set ScriptProperties CONFIG_SHEET_ID/LEDGER_SHEET_ID.");
  }

  var configSheetName = String(getProp("CONFIG_SHEET_NAME", typeof CONFIG_SHEET_NAME_DEFAULT !== "undefined" ? CONFIG_SHEET_NAME_DEFAULT : "Config"));

  console.log("[config] bootstrapSheetId=" + sheetId + " sheet=" + configSheetName);

  // 1st read from bootstrap spreadsheet
  var map1 = readConfigMapFromSpreadsheet_(sheetId, configSheetName);

  // If Config specifies a different LEDGER_SHEET_ID, re-read from there
  var finalLedgerId = String(map1["LEDGER_SHEET_ID"] || "").trim();
  if (finalLedgerId && finalLedgerId !== sheetId) {
    console.log("[config] redirect LEDGER_SHEET_ID=" + finalLedgerId);
    var map2 = readConfigMapFromSpreadsheet_(finalLedgerId, configSheetName);
    return mergeConfigMaps_(map1, map2);
  }
  return map1;
}

function resolveBootstrapSheetId_() {
  // 1) Active spreadsheet if container-bound
  try {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) {
      var id1 = String(active.getId() || "").trim();
      if (id1) return id1;
    }
  } catch (e) {}

  // 2) ScriptProperties fallback
  var id2 = String(getProp("CONFIG_SHEET_ID", "") || "").trim();
  if (id2) return id2;

  var id3 = String(getProp("LEDGER_SHEET_ID", "") || "").trim();
  if (id3) return id3;

  return "";
}

function readConfigMapFromSpreadsheet_(spreadsheetId, configSheetName) {
  var ss = SpreadsheetApp.openById(spreadsheetId);
  var sh = ss.getSheetByName(configSheetName);
  if (!sh) throw new Error("Config sheet not found: " + configSheetName + " in " + spreadsheetId);

  var lastRow = sh.getLastRow();
  if (lastRow <= 1) return {};

  var values = sh.getRange(2, 1, lastRow - 1, 3).getValues();
  var map = {};
  for (var i = 0; i < values.length; i++) {
    var k = String(values[i][0] || "").trim();
    if (!k) continue;
    if (k[0] === "#") continue;
    k = normalizeConfigKey_(k);

    var v = values[i][1];
    if (v === null || v === undefined) v = "";
    map[k] = String(v).trim();
  }
  return map;
}

function mergeConfigMaps_(baseMap, overrideMap) {
  var out = {};
  var k;
  for (k in baseMap) out[k] = baseMap[k];
  for (k in overrideMap) out[k] = overrideMap[k];
  return out;
}

function normalizeConfigKey_(k) {
  return String(k || "").trim().toUpperCase().replace(/\s+/g, "_");
}

function shallowClone_(obj) {
  var o = {};
  for (var k in obj) o[k] = obj[k];
  return o;
}
