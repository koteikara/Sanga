/** parse_list.gs
 *
 * 返却: [{articleId, url, title, publishedYmd}]
 * - まず /news/detail/NNNNN をHTML全体から走査して拾う（hrefに限定しない）
 * - 重複は articleId 単位で1件に正規化
 * - title/publishedYmd は現状空でもOK（必要なら後で強化）
 */

function parseNewsList(html) {
  html = String(html || "");
  if (!html) return [];

  var base = "https://www.sanga-fc.jp";

  // 1) まず detail パスを全文から拾う（hrefに限定しない）
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

  // 2) 一応、出現順に近い並びにしたいので、HTML内の最初の登場位置でソート
  out.sort(function(a, b) {
    var pa = html.indexOf("/news/detail/" + a.articleId);
    var pb = html.indexOf("/news/detail/" + b.articleId);
    if (pa === -1 && pb === -1) return 0;
    if (pa === -1) return 1;
    if (pb === -1) return -1;
    return pa - pb;
  });

  return out;
}
