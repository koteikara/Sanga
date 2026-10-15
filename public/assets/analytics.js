// アクセス解析（Cloudflare Web Analytics）。
//
// Cookieを使わず、個人を特定しない集計だけを行う。
// TOKEN が空のあいだは何もしない。有効にするには:
//   1. Cloudflare ダッシュボード → Analytics & Logs → Web Analytics → Add a site
//      でホスト名 sangasanga.stars.ne.jp を登録する（DNS移管は不要）
//   2. 表示される JS スニペットの data-cf-beacon にある "token" の値を下の TOKEN に貼る
//   3. npm run fix:asset-versions → 本番デプロイ
// GitHub Pages の確認環境や手元では送らない（本番ホストのときだけ動く）。
(function () {
  var TOKEN = "e9951ebab47e411ca5317934a9455c73";
  var HOST = "sangasanga.stars.ne.jp";
  if (!TOKEN || location.hostname !== HOST) return;
  var s = document.createElement("script");
  s.defer = true;
  s.src = "https://static.cloudflareinsights.com/beacon.min.js";
  s.setAttribute("data-cf-beacon", JSON.stringify({ token: TOKEN }));
  document.head.appendChild(s);
})();
