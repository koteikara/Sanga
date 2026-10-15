// アウェイ遠征ガイド。data/away-guide.json と、試合ごとの data/hotels/{id}.json を読んで並べる。
// 文字列は textContent だけで入れる。リンクは https のものだけ（楽天のアフィリエイトURLなど）。
// ホテルの写真は楽天トラベルの画像ホストのものだけを出す。
(function () {
  "use strict";
  var list = document.getElementById("awayList");
  var meta = document.getElementById("awayMeta");
  var jump = document.getElementById("awayJump");

  var SVG_NS = "http://www.w3.org/2000/svg";
  var A8_LINK = /^https:\/\/px\.a8\.net\/svt\/ejp\?a8mat=[A-Za-z0-9+]+$/;
  var A8_PIXEL = /^https:\/\/www\d+\.a8\.net\/0\.gif\?a8mat=[A-Za-z0-9+]+$/;
  var RAKUTEN_IMAGE = /^https:\/\/img\.travel\.rakuten\.co\.jp\/[^\s"'<>]+$/;
  var WEEK = ["日", "月", "火", "水", "木", "金", "土"];
  var affiliates = {};
  var pixelShown = {};

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  // 線だけのアイコン。path の d を受け取る
  function icon(d) {
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    var path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    svg.append(path);
    return svg;
  }
  var ICON_ROUTE = "M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z";
  var ICON_BUS = "M6 17V6a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v11M4 17h16M8 21v-4M16 21v-4M6 11h12";
  var ICON_HOTEL = "M3 21V7l9-4 9 4v14M9 21v-5h6v5M8 10h.01M12 10h.01M16 10h.01M8 13.5h.01M12 13.5h.01M16 13.5h.01";

  function prTag() { return el("span", "pr-tag", "PR"); }

  function safeLink(url, cls, rel) {
    if (!/^https:\/\//.test(url || "")) return null;
    var a = el("a", cls);
    a.href = url;
    a.target = "_blank";
    a.rel = rel || "noopener noreferrer";
    return a;
  }

  // A8リンク。計測ピクセル（1x1、altなし）はページで1回だけ置く
  function a8Link(key, cls, build) {
    var item = affiliates[key];
    if (!item || !A8_LINK.test(item.href || "")) return null;
    var wrap = el("span", "away-a8");
    var a = safeLink(item.href, cls, "nofollow sponsored noopener noreferrer");
    build(a, item.label);
    wrap.append(a);
    if (!pixelShown[key] && A8_PIXEL.test(item.pixel || "")) {
      pixelShown[key] = true;
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

  function getJson(path) {
    return fetch(path, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error(path + " " + r.status);
      return r.json();
    });
  }

  function md(iso) {
    var p = iso.split("-");
    var day = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])).getDay();
    return Number(p[1]) + "/" + Number(p[2]) + "（" + WEEK[day] + "）";
  }
  function shortMd(iso) {
    var p = iso.split("-");
    return Number(p[1]) + "/" + Number(p[2]);
  }
  function dateLabel(m) {
    if (m.match_date) return md(m.match_date);
    if (m.date_candidates && m.date_candidates.length) return m.date_candidates.map(md).join(" か ");
    return "日程未定";
  }

  function hotelCard(h) {
    var li = el("li", "hotel");
    var a = safeLink(h.affiliate_url, "hotel-link", "nofollow sponsored noopener noreferrer");
    var box = a || el("div", "hotel-link");

    var photo = el("div", "hotel-photo");
    var src = [h.hotel_image_url, h.hotel_thumbnail_url].filter(function (u) { return RAKUTEN_IMAGE.test(u || ""); })[0];
    if (src) {
      var img = document.createElement("img");
      img.src = src;
      img.alt = "";
      img.width = 320;
      img.height = 240;
      img.loading = "lazy";
      img.decoding = "async";
      img.referrerPolicy = "no-referrer";
      // 読めなかったら写真なしの表示に替える
      img.addEventListener("error", function () {
        var empty = el("div", "hotel-photo-empty");
        empty.append(icon(ICON_HOTEL));
        img.replaceWith(empty);
      });
      photo.append(img);
    } else {
      var empty = el("div", "hotel-photo-empty");
      empty.append(icon(ICON_HOTEL));
      photo.append(empty);
    }
    if (h.stadium_proximity) photo.append(el("span", "hotel-near", "会場近く"));
    box.append(photo);

    var text = el("div", "hotel-text");
    text.append(el("p", "hotel-name", h.hotel_name));
    var price = el("p", "hotel-price");
    if (h.stay_charge_total != null) {
      // その日・2名で空いているプランの最安（取得時点）。1人あたりは2で割った目安
      price.append(document.createTextNode("2名1泊 "));
      price.append(el("b", null, "¥" + Number(h.stay_charge_total).toLocaleString("ja-JP")));
      price.append(document.createTextNode("〜"));
      text.append(price);
      var per = "1人 約¥" + Math.round(h.stay_charge_total / 2).toLocaleString("ja-JP");
      text.append(el("p", "hotel-plan", h.stay_meal ? per + "・" + h.stay_meal : per));
      price = null;
    } else if (h.min_charge != null) {
      price.append(document.createTextNode("目安 "));
      price.append(el("b", null, "¥" + Number(h.min_charge).toLocaleString("ja-JP")));
      price.append(document.createTextNode("〜"));
    } else {
      price.textContent = "料金は楽天トラベルで確認";
    }
    if (price) text.append(price);
    var sub = el("p", "hotel-sub");
    if (h.distance_km_from_stadium != null) sub.append(el("span", null, "会場まで" + h.distance_km_from_stadium + "km"));
    if (h.review_average != null && h.review_count) {
      var star = el("span", "hotel-star", "★" + Number(h.review_average).toFixed(1));
      var rv = el("span");
      rv.append(star);
      rv.append(document.createTextNode("（" + h.review_count + "件）"));
      sub.append(rv);
    }
    if (sub.childNodes.length) text.append(sub);
    box.append(text);
    li.append(box);
    return li;
  }

  function renderHotels(box, doc) {
    var m = doc.meta || {};
    box.textContent = "";
    if (!doc.hotels || !doc.hotels.length) {
      box.append(el("p", "h-empty", "取得時点では条件に合う空室が見つかりませんでした。下の「ほかの宿を探す」からも探せます。"));
      return;
    }
    var ul = el("ul", "hotels");
    ul.setAttribute("aria-label", "前泊ホテルの候補 " + doc.hotels.length + "件（横にスクロールできます）");
    doc.hotels.forEach(function (h) { ul.append(hotelCard(h)); });
    box.append(ul);
    box.append(el("p", "h-foot", "料金は取得時点で空室のあったプランの最安（税・サービス料込み）。取得 " + (m.updated_at || "") + " JST ／ 提供：楽天トラベル"));
  }

  function renderMatch(m) {
    var li = el("li", "away-match" + (m.competition === "LEV" ? " is-lev" : ""));
    li.id = m.match_id;
    var article = el("article");
    article.setAttribute("aria-labelledby", m.match_id + "-title");

    var head = el("header", "m-head");
    head.append(el("p", "m-comp", m.competition_label + "　" + m.round));
    var title = el("h2", "m-title");
    title.id = m.match_id + "-title";
    title.append(el("small", null, "vs"));
    title.append(document.createTextNode(m.opponent));
    head.append(title);
    var date = el("p", "m-date", dateLabel(m));
    date.append(el("small", null, m.match_date ? (m.kickoff_time ? m.kickoff_time + " キックオフ" : "キックオフ未定") : "日程未定"));
    head.append(date);
    article.append(head);

    var body = el("div", "m-body");
    var facts = el("dl", "m-facts");
    facts.append(el("dt", null, "会場"));
    var venue = el("dd", null, m.venue_name);
    if (m.city) { venue.append(document.createTextNode(" ")); venue.append(el("span", "m-city", m.city)); }
    facts.append(venue);
    if (m.station || m.access_note) {
      facts.append(el("dt", null, "アクセス"));
      facts.append(el("dd", null, m.access_note || m.station));
    }
    body.append(facts);

    var actions = el("div", "m-actions");
    if (m.latitude != null) {
      var map = safeLink("https://www.google.com/maps/dir/?api=1&origin=" + encodeURIComponent("京都駅") + "&destination=" + m.latitude + "," + m.longitude, "m-btn");
      map.append(icon(ICON_ROUTE));
      map.append(document.createTextNode("京都駅からの経路"));
      actions.append(map);
    }
    var tr = safeLink(m.transport_url, "m-btn", "nofollow sponsored noopener noreferrer");
    if (tr) {
      tr.append(prTag());
      tr.append(document.createTextNode(m.transport_label || "交通の予約"));
      actions.append(tr);
    }
    var bus = a8Link("bus", "m-btn", function (a) {
      a.append(prTag());
      a.append(icon(ICON_BUS));
      a.append(document.createTextNode("高速バスを探す（エアトリ）"));
    });
    if (bus) actions.append(bus);
    if (actions.childNodes.length) body.append(actions);

    var hh = el("div", "h-head");
    var ht = el("h3", "h-title", "前泊ホテル");
    ht.append(prTag());
    hh.append(ht);
    var checkin = m.match_date || (m.date_candidates && m.date_candidates[0]);
    if (checkin) {
      var prev = new Date(checkin + "T00:00:00");
      prev.setDate(prev.getDate() - 1);
      var iso = prev.getFullYear() + "-" + String(prev.getMonth() + 1).padStart(2, "0") + "-" + String(prev.getDate()).padStart(2, "0");
      hh.append(el("span", "h-cond", shortMd(iso) + " 泊・2名・会場から3km以内・安い順"));
    }
    body.append(hh);

    var box = el("div", "h-box");
    if (m.hotels_path) {
      box.append(el("p", "h-empty", "読み込んでいます…"));
      getJson(m.hotels_path).then(function (d) { renderHotels(box, d); })
        .catch(function () { box.textContent = ""; box.append(el("p", "h-empty", "ホテル情報を読み込めませんでした。")); });
    } else {
      box.append(el("p", "h-empty", "ホテル候補は準備中です（日程確定後に自動で取得します）。"));
    }
    body.append(box);

    var jalan = a8Link("lodging", null, function (a) { a.textContent = "じゃらんで探す"; });
    if (jalan) {
      var more = el("p", "m-more");
      more.append(prTag());
      more.append(document.createTextNode("ほかの宿を探す："));
      more.append(jalan);
      body.append(more);
    }
    article.append(body);
    li.append(article);
    return li;
  }

  function renderJump(matches) {
    matches.forEach(function (m) {
      var li = el("li");
      var a = el("a");
      a.href = "#" + m.match_id;
      a.append(el("span", "away-jump-date", m.match_date ? shortMd(m.match_date) : (m.date_candidates.length ? shortMd(m.date_candidates[0]) + "〜" : "未定")));
      a.append(el("span", "away-jump-opp", m.opponent));
      li.append(a);
      jump.append(li);
    });
    if (matches.length > 1) jump.parentNode.hidden = false;
  }

  getJson("data/affiliates.json?v=996953b2").catch(function () { return {}; }).then(function (a) {
    affiliates = a || {};
    return getJson("data/away-guide.json?v=32971663");
  }).then(function (doc) {
    // 終わった試合は出さない（日付は日本時間。未定は候補日の最後で判断）
    var today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    var upcoming = doc.matches.filter(function (m) {
      var last = m.match_date || (m.date_candidates.length ? m.date_candidates[m.date_candidates.length - 1] : "9999-12-31");
      return last >= today;
    });
    upcoming.forEach(function (m) { list.append(renderMatch(m)); });
    renderJump(upcoming);
    meta.textContent = "これからの国内アウェイ " + upcoming.length + "試合" + (doc.meta.hotels_updated_at ? "／ ホテル情報の取得 " + doc.meta.hotels_updated_at + " JST" : "／ ホテル情報は取得前");
  }).catch(function () {
    meta.textContent = "データを読み込めませんでした。時間をおいて開き直してください。";
  });
})();
