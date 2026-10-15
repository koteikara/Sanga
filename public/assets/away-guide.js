// アウェイ遠征ガイド。data/away-guide.json と、試合ごとの data/hotels/{id}.json を読んで並べる。
// 文字列は textContent だけで入れる。リンクは https のものだけ（楽天のアフィリエイトURLなど）。
(function () {
  "use strict";
  var list = document.getElementById("awayList");
  var meta = document.getElementById("awayMeta");

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  var A8_LINK = /^https:\/\/px\.a8\.net\/svt\/ejp\?a8mat=[A-Za-z0-9+]+$/;
  var A8_PIXEL = /^https:\/\/www\d+\.a8\.net\/0\.gif\?a8mat=[A-Za-z0-9+]+$/;
  var affiliates = {};

  // A8リンク + 計測ピクセル（1x1、altなし）。ホストとURLの形が合わなければ出さない。
  function a8Link(item) {
    if (!item || !A8_LINK.test(item.href || "")) return null;
    var wrap = el("span", "away-a8");
    var a = safeLink(item.href, item.label, "nofollow sponsored noopener noreferrer");
    wrap.append(a);
    if (A8_PIXEL.test(item.pixel || "")) {
      var img = document.createElement("img");
      img.src = item.pixel;
      img.width = 1;
      img.height = 1;
      img.alt = "";
      img.setAttribute("aria-hidden", "true");
      wrap.append(img);
    }
    return wrap;
  }
  function safeLink(url, text, rel) {
    if (!/^https:\/\//.test(url || "")) return null;
    var a = el("a", null, text);
    a.href = url;
    a.target = "_blank";
    a.rel = rel || "noopener noreferrer";
    return a;
  }
  function getJson(path) {
    return fetch(path, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error(path + " " + r.status);
      return r.json();
    });
  }
  function dateText(m) {
    if (m.match_date) return m.match_date.replace(/-/g, "/") + (m.kickoff_time ? " " + m.kickoff_time : "");
    if (m.date_candidates && m.date_candidates.length) return m.date_candidates.map(function (d) { return d.slice(5).replace("-", "/"); }).join(" or ") + "（日程未定）";
    return "日程未定";
  }
  function yen(n) { return n == null ? "料金は楽天トラベルで確認" : "最安 " + Number(n).toLocaleString("ja-JP") + "円〜"; }

  function renderHotels(box, doc) {
    var m = doc.meta || {};
    box.textContent = "";
    if (!doc.hotels || !doc.hotels.length) {
      box.append(el("p", "away-empty", "取得時点では条件に合う空室が見つかりませんでした。"));
      return;
    }
    var ul = el("ul", "away-hotels");
    doc.hotels.forEach(function (h) {
      var li = el("li", "away-hotel");
      var a = safeLink(h.affiliate_url, h.hotel_name, "nofollow sponsored noopener noreferrer");
      li.append(a || el("span", null, h.hotel_name));
      li.append(el("span", "away-hotel-info", " " + yen(h.min_charge) + " ／ 会場から約" + (h.distance_km_from_stadium != null ? h.distance_km_from_stadium : "?") + "km"));
      ul.append(li);
    });
    box.append(ul);
    box.append(el("p", "away-fetched", "宿泊 " + m.checkin_date + " → " + m.checkout_date + "（2名）／ 取得 " + m.updated_at + " JST／ 提供: 楽天トラベル"));
  }

  function renderMatch(m) {
    var li = el("li", "away-match");
    li.id = m.match_id;
    var head = el("h2", "away-match-title", "vs " + m.opponent);
    head.append(el("span", "away-match-round", " " + m.competition_label + " " + m.round));
    li.append(head);
    li.append(el("p", "away-match-date", dateText(m)));
    li.append(el("p", "away-match-venue", m.venue_name + (m.city ? "（" + m.city + "）" : "")));
    if (m.station || m.access_note) li.append(el("p", "away-match-access", "最寄り: " + (m.access_note || m.station)));
    var links = el("p", "away-match-links");
    if (m.latitude != null) {
      var map = safeLink("https://www.google.com/maps/dir/?api=1&origin=" + encodeURIComponent("京都駅") + "&destination=" + m.latitude + "," + m.longitude, "京都駅からの経路（Googleマップ）");
      if (map) links.append(map);
    }
    var tr = safeLink(m.transport_url, m.transport_label || "交通の予約", "nofollow sponsored noopener noreferrer");
    if (tr) { links.append(document.createTextNode(" ／ ")); links.append(tr); }
    if (links.childNodes.length) li.append(links);
    var bus = a8Link(affiliates.bus);
    if (bus) {
      var busP = el("p", "away-match-bus", "［PR］ ");
      busP.append(bus);
      li.append(busP);
    }

    var box = el("div", "away-hotel-box");
    li.append(el("h3", "away-hotel-title", "前泊ホテル候補［PR］"));
    if (m.hotels_path) {
      box.append(el("p", "away-empty", "読み込んでいます…"));
      getJson(m.hotels_path).then(function (d) { renderHotels(box, d); })
        .catch(function () { box.textContent = ""; box.append(el("p", "away-empty", "ホテル情報を読み込めませんでした。")); });
    } else {
      box.append(el("p", "away-empty", "ホテル候補は準備中です（日程確定後に自動で取得します）。"));
    }
    li.append(box);
    var jalan = a8Link(affiliates.lodging);
    if (jalan) {
      var jp = el("p", "away-match-lodging", "宿を探す［PR］ ");
      jp.append(jalan);
      li.append(jp);
    }
    return li;
  }

  getJson("data/affiliates.json?v=996953b2").catch(function () { return {}; }).then(function (a) {
    affiliates = a;
    return getJson("data/away-guide.json?v=54151935");
  }).then(function (doc) {
    // 終わった試合は出さない（日付は日本時間。未定は候補日の最後で判断）
    var today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    var upcoming = doc.matches.filter(function (m) {
      var last = m.match_date || (m.date_candidates.length ? m.date_candidates[m.date_candidates.length - 1] : "9999-12-31");
      return last >= today;
    });
    upcoming.forEach(function (m) { list.append(renderMatch(m)); });
    meta.textContent = "これからの国内アウェイ " + upcoming.length + "試合" + (doc.meta.hotels_updated_at ? "／ ホテル情報の取得 " + doc.meta.hotels_updated_at + " JST" : "／ ホテル情報は取得前");
  }).catch(function () {
    meta.textContent = "データを読み込めませんでした。時間をおいて開き直してください。";
  });
})();
