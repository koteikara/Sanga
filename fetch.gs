/** fetch.gs */

function fetchHtml(url) {
  var cfg = CFG();
  var lastErr = null;

  for (var attempt = 1; attempt <= cfg.FETCH_RETRY; attempt++) {
    try {
      var res = UrlFetchApp.fetch(url, {
        method: "get",
        muteHttpExceptions: true,
        followRedirects: true,
        validateHttpsCertificates: true,
        headers: {
          "User-Agent": "Mozilla/5.0 (GAS) TemporalItemBot/1.0",
          "Accept-Language": "ja,en-US;q=0.8,en;q=0.6"
        },
        timeout: cfg.FETCH_TIMEOUT_MS
      });

      var code = res.getResponseCode();
      var body = res.getContentText(); // GAS auto-decodes; assume UTF-8 (site is UTF-8)
      console.log("[fetchHtml] url=" + url + " attempt=" + attempt + " status=" + code + " len=" + (body ? body.length : 0));
      if (code >= 200 && code < 300 && body) return body;

      lastErr = new Error("HTTP " + code + " for " + url);
    } catch (e) {
      console.error("[fetchHtml] url=" + url + " attempt=" + attempt + " exception=" + String(e && e.stack ? e.stack : e));
      lastErr = e;
    }

    Utilities.sleep(cfg.FETCH_SLEEP_BETWEEN_RETRY_MS);
  }

  throw lastErr || new Error("fetchHtml failed: " + url);
}
