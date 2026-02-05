/** utils_date.gs */

function toIsoYmd(d) {
  var cfg = CFG();
  return Utilities.formatDate(d, cfg.TZ, "yyyy-MM-dd");
}

function toIsoLocal(d) {
  var cfg = CFG();
  return Utilities.formatDate(d, cfg.TZ, "yyyy-MM-dd'T'HH:mm:ss");
}
