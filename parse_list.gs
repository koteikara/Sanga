/** parse_list.gs
 *
 * 返却: [{articleId, url, title, publishedYmd}]
 * - /news/detail/NNNNN をHTML全文から走査して拾う（hrefに限定しない）
 * - 重複は articleId 単位で1件に正規化
 * - HTML内の最初の出現位置でソートして返す
 */

function parseNewsList(html) {
  Logger.log("[parseNewsList] VERSION=2026-02-05-B"); // ★署名ログ
  html = String(html || "");
  if (!html) return [];

  var base = "https://www.sanga-fc.jp";

  // 1) detail パスを全文から拾う
  var ids = {};
  var reId = /\/news\/detail\/(\d+)/g;
  var m;
  while ((m = reId.exec(html)) !== null) {
    var id = m[1];
    if (id) ids[id] = true;
  }

  var out = [];
  var idList = Object.keys(ids);

  for (var i = 0; i < idList.length; i++) {
    var articleId = idList[i];
    out.push({
      articleId: articleId,
      url: base + "/news/detail/" + articleId,
      title: "",
      publishedYmd: ""
    });
  }

  // 2) HTML内の最初の登場位置でソート
  out.sort(function(a, b) {
    var pa = html.indexOf("/news/detail/" + a.articleId);
    var pb = html.indexOf("/news/detail/" + b.articleId);
    if (pa === -1 && pb === -1) return 0;
    if (pa === -1) return 1;
    if (pb === -1) return -1;
    return pa - pb;
  });

  Logger.log("[parseNewsList] ids=" + out.length); // 任意：件数ログ
  return out;
}
