/** normalize_news_items.gs */

function normalizeNewsItems_(items, article) {
  if (!items || items.length === 0) return [];

  var seen = {};
  var out = [];
  for (var i = 0; i < items.length; i++) {
    var it = enforceSaleEnd_(items[i]);
    it = finalizeItem_(it, article);
    if (!it) continue;
    if (it.type !== "sale") continue;
    if (seen[it.itemKey]) continue;
    seen[it.itemKey] = true;
    out.push(it);
  }
  return out;
}

function enforceSaleEnd_(it) {
  if (!it || !it.start) return it;
  if (it.type !== "sale") return it;
  var start = new Date(it.start.getTime());
  it.start = start;
  it.end = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59, 0, 0);
  return it;
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
