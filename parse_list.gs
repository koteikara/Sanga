/** parse_list.gs */

// Returns [{articleId, url, title, publishedYmd}]
function parseNewsList(html) {
  if (!html) return [];

  // Match detail links like /news/detail/20711 and capture anchor text that contains date/category/title.
  // In the list page, items appear as: "2026/1/31 試合情報 〇〇" :contentReference[oaicite:2]{index=2}
  var re = /href="(\/news\/detail\/(\d+))"[^>]*>\s*([^<]+)\s*</g;
  var m;
  var out = [];
  var base = "https://www.sanga-fc.jp";

  while ((m = re.exec(html)) !== null) {
    var path = m[1];
    var articleId = m[2];
    var text = normalizeSpaces_(m[3]);

    // text example: "2026/1/31 試合情報 新エリア「サンガグルメ街道」開催のお知らせ"
    // publishedYmd parse:
    var pub = "";
    var pubm = text.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
    if (pubm) {
      pub = pad2_(pubm[1], 4) + "-" + pad2_(pubm[2], 2) + "-" + pad2_(pubm[3], 2);
    }

    // title: remove leading date and category-ish tokens
    var title = text
      .replace(/^\d{4}\/\d{1,2}\/\d{1,2}\s+/, "")
      .replace(/^(トップチーム|試合情報|ファンクラブ|チケット|グッズ|ホームタウン活動|アカデミー|スクール|メディア|クラブ|スポンサー|フットサルパーク|その他)\s+/, "");

    out.push({
      articleId: articleId,
      url: base + path,
      title: title,
      publishedYmd: pub
    });
  }

  // Dedupe within page
  var seen = {};
  var deduped = [];
  for (var i = 0; i < out.length; i++) {
    var k = out[i].articleId + "|" + out[i].url;
    if (seen[k]) continue;
    seen[k] = true;
    deduped.push(out[i]);
  }
  return deduped;
}

function normalizeSpaces_(s) {
  if (s === null || s === undefined) return "";
  return String(s).replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
}

function pad2_(n, len) {
  n = String(n);
  while (n.length < len) n = "0" + n;
  return n;
}
