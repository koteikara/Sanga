// ホーム観戦ガイド。data/home-guide.json（手で書く案内）と、matches.json・hotel-index.json から
// サンガスタジアムのホーム戦を拾い、試合ごとの data/hotels/{id}.json を読んで並べる。
// ホテルのカード・横に流す列・試合の開け閉めは assets/away-guide.js と同じ作り（見た目は away.css を共有）。
// 文字列は textContent だけで入れる。リンクは https のものだけ。ホテルの写真は楽天トラベルの画像ホストのものだけ。
(function () {
  "use strict";
  var meta = document.getElementById("homeMeta");
  var list = document.getElementById("homeList");

  var SVG_NS = "http://www.w3.org/2000/svg";
  var A8_LINK = /^https:\/\/px\.a8\.net\/svt\/ejp\?a8mat=[A-Za-z0-9+]+$/;
  var A8_PIXEL = /^https:\/\/www\d+\.a8\.net\/0\.gif\?a8mat=[A-Za-z0-9+]+$/;
  // 楽天トラベルの画像。img.travel.rakuten.co.jp と、宿ページの写真が置かれている trvimg.r10s.jp
  var RAKUTEN_IMAGE = /^https:\/\/(?:img\.travel\.rakuten\.co\.jp|trvimg\.r10s\.jp)\/[^\s"'<>]+$/;
  var WEEK = ["日", "月", "火", "水", "木", "金", "土"];
  var affiliates = {};
  var pixelShown = {};
  var guide = null;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
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
  var ICON_HOTEL = "M3 21V7l9-4 9 4v14M9 21v-5h6v5M8 10h.01M12 10h.01M16 10h.01M8 13.5h.01M12 13.5h.01M16 13.5h.01";
  var ICON_LINK = "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5";

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
  function dateLabel(m) {
    if (m.match_date) return md(m.match_date);
    if (m.date_candidates && m.date_candidates.length) return m.date_candidates.map(md).join(" か ");
    return "日程未定";
  }
  function displayName(name) {
    var s = String(name || "");
    if (s.normalize) s = s.normalize("NFKC");
    return s.replace(/\s+/g, " ").trim();
  }
  function km(lat1, lng1, lat2, lng2) {
    var r = Math.PI / 180;
    var a = Math.pow(Math.sin((lat2 - lat1) * r / 2), 2) + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.pow(Math.sin((lng2 - lng1) * r / 2), 2);
    return 6371 * 2 * Math.asin(Math.sqrt(a));
  }
  function mapsPlace(lat, lng) {
    return "https://www.google.com/maps/search/?api=1&query=" + Number(lat).toFixed(5) + "%2C" + Number(lng).toFixed(5);
  }
  function scrollBehavior() {
    return document.documentElement.dataset.motion === "off" ? "auto" : "smooth";
  }

  // OpenStreetMap の埋め込み地図（キー不要、画面に入ってから読む）
  function osmMap(title, lat, lng, dLat, dLng) {
    var wrap = el("figure", "m-map");
    var iframe = document.createElement("iframe");
    iframe.src = "https://www.openstreetmap.org/export/embed.html?bbox=" +
      [lng - dLng, lat - dLat, lng + dLng, lat + dLat].map(function (n) { return n.toFixed(5); }).join("%2C") +
      "&layer=mapnik&marker=" + lat.toFixed(5) + "%2C" + lng.toFixed(5);
    iframe.title = title;
    iframe.loading = "lazy";
    iframe.referrerPolicy = "no-referrer-when-downgrade";
    wrap.append(iframe);
    var cap = el("figcaption", "m-map-cap");
    var big = safeLink(mapsPlace(lat, lng), null);
    big.textContent = "大きな地図で見る（Googleマップ）";
    cap.append(big);
    wrap.append(cap);
    return wrap;
  }

  // ---------- アクセス ----------
  function renderAccess() {
    var s = guide.stadium;
    var box = document.getElementById("accessBody");
    var sp = s.photo || {};
    if (PHOTO_SRC.test(sp.src || "")) {
      var sfig = el("figure", "stadium-figure");
      sfig.append(picture("stadium-photo", [sp.src], sp.alt, ICON_ROUTE));
      sfig.append(credit(sp));
      box.append(sfig);
    }
    var facts = el("dl", "m-facts");
    facts.append(el("dt", null, "スタジアム"));
    var venue = el("dd", null, s.name);
    venue.append(document.createTextNode(" "));
    venue.append(el("span", "m-city", s.city));
    facts.append(venue);
    (guide.access || []).forEach(function (a) {
      facts.append(el("dt", null, a.label));
      var dd = el("dd", null, a.text);
      var link = safeLink(a.url, "home-inline-link");
      if (link) {
        link.textContent = a.link_label || "案内";
        link.setAttribute("aria-label", (a.link_label || "案内") + "（新しいタブで開きます）");
        dd.append(link);
      }
      facts.append(dd);
    });
    box.append(facts);

    var actions = el("div", "m-actions");
    (guide.routes || []).forEach(function (r) {
      var a = safeLink("https://www.google.com/maps/dir/?api=1&travelmode=transit&origin=" + encodeURIComponent(r.origin) + "&destination=" + s.latitude + "," + s.longitude, "m-btn");
      a.append(icon(ICON_ROUTE));
      a.append(document.createTextNode(r.label + "の経路"));
      actions.append(a);
    });
    if (actions.childNodes.length) box.append(actions);
    box.append(osmMap(s.name + " と亀岡駅の周辺の地図", s.latitude, s.longitude, 0.006, 0.009));
  }

  // ---------- 車で来る ----------
  var ICON_CAR = "M5 17h14M6 17v2M18 17v2M4 13l2-5a2 2 0 0 1 1.9-1.4h8.2A2 2 0 0 1 18 8l2 5v4H4v-4zM4 13h16M7.5 15h.01M16.5 15h.01";
  function renderParking() {
    var pk = guide.parking || {};
    var box = document.getElementById("parkingBody");
    (pk.notes || []).forEach(function (t) { box.append(el("p", "home-note parking-note", t)); });

    // 試合の日に使える駐車場（会員向け・保津川下り・商業施設）
    if ((pk.match_day_lots || []).length) {
      box.append(el("h3", "home-sub", "試合の日に停められる駐車場"));
      var lots = el("ul", "parking-lots");
      pk.match_day_lots.forEach(function (lot) {
        var li = el("li", "parking-lot");
        var name = el("h4", "parking-name");
        name.append(icon(ICON_CAR));
        name.append(document.createTextNode(lot.name));
        li.append(name);
        li.append(el("p", "parking-text", lot.text));
        var a = safeLink(lot.url, "home-inline-link");
        if (a) {
          a.textContent = lot.link_label || "案内";
          a.setAttribute("aria-label", lot.name + "：" + (lot.link_label || "案内") + "（新しいタブで開きます）");
          var pl = el("p", "parking-lot-link");
          pl.append(a);
          li.append(pl);
        }
        lots.append(li);
      });
      box.append(lots);
    }

    box.append(el("h3", "home-sub", "予約サービスで探す"));
    var ul = el("ul", "parking-services");
    (pk.services || []).forEach(function (sv) {
      var li = el("li", "parking-service");
      // 提携リンク（affiliates.json に A8 のリンクがあるとき）は PR を付けてそちらを使う。無ければ普通のリンク
      var link = sv.affiliate_key ? a8Link(sv.affiliate_key, "parking-link", function (a) { a.append(prTag()); }) : null;
      var a = link ? link.querySelector("a") : safeLink(sv.url, "parking-link");
      if (!a) return;
      var name = el("span", "parking-name");
      name.append(icon(ICON_CAR));
      name.append(document.createTextNode(sv.name));
      a.append(name);
      a.append(el("span", "parking-text", sv.text));
      a.setAttribute("aria-label", sv.name + "：サンガスタジアム周辺の駐車場（新しいタブで開きます）");
      li.append(link || a);
      ul.append(li);
    });
    box.append(ul);

    box.append(el("h3", "home-sub", "コインパーキングを地図で探す"));
    box.append(el("p", "home-note parking-note", "離れた駅の近くに停めて、JR嵯峨野線で亀岡駅へ向かうこともできます。"));
    var food = el("div", "m-food");
    (pk.coin_places || []).forEach(function (p) {
      var row = el("div", "m-food-row");
      row.append(el("span", "m-food-place", p.label));
      var list = el("ul", "m-food-list");
      ["コインパーキング", "駐車場"].forEach(function (w) {
        var a = safeLink("https://www.google.com/maps/search/" + encodeURIComponent(w) + "/@" + Number(p.latitude).toFixed(5) + "," + Number(p.longitude).toFixed(5) + ",16z", "m-chip");
        a.textContent = w;
        a.setAttribute("aria-label", p.label + "の" + w + "をGoogleマップで探す");
        var li = el("li");
        li.append(a);
        list.append(li);
      });
      row.append(list);
      food.append(row);
    });
    box.append(food);
  }

  // 写真。手元に置いた画像（散策）か、楽天トラベルの画像（宿）。読めなければ順に次の候補、最後は絵に替える
  function picture(cls, srcs, alt, fallbackIcon) {
    var fig = el("div", cls);
    var list = srcs.slice();
    var empty = function () { var e = el("div", "hotel-photo-empty"); e.append(icon(fallbackIcon)); return e; };
    if (!list.length) { fig.append(empty()); return fig; }
    var img = document.createElement("img");
    img.alt = alt || "";
    img.width = 640;
    img.height = 480;
    img.loading = "lazy";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    img.addEventListener("error", function () {
      if (list.length) img.src = list.shift();
      else img.replaceWith(empty());
    });
    img.src = list.shift();
    fig.append(img);
    return fig;
  }
  // 写真は、手元に置いた画像（亀岡市「かめコレ」を縮めたもの）か Wikimedia Commons の縮小画像だけ（作者・利用条件をそばに出す）
  var PHOTO_SRC = /^(?:assets\/home\/[a-z0-9-]+\.webp(?:\?v=[0-9a-f]+)?|https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/thumb\/[^\s"'<>]+)$/;
  function credit(ph) {
    var cap = el("figcaption", "spot-credit");
    cap.append(document.createTextNode("写真：" + (ph.credit || "") + " / "));
    var lic = safeLink(ph.license_url, null) || el("span");
    lic.textContent = ph.license || "";
    cap.append(lic);
    var src = safeLink(ph.source_url, null);
    if (src) { cap.append(document.createTextNode("（")); src.textContent = ph.source_label || "Wikimedia Commons"; cap.append(src); cap.append(document.createTextNode("）")); }
    return cap;
  }


  // ---------- 亀岡を巡る ----------
  function renderSpots() {
    var s = guide.stadium;
    (guide.spots || []).forEach(function (p) {
      var ul = document.getElementById(p.reach === "walk" ? "spotsWalk" : "spotsRide");
      var li = el("li", "spot");
      var ph = p.photo || {};
      if (PHOTO_SRC.test(ph.src || "")) {
        var fig = el("figure", "spot-figure");
        fig.append(picture("spot-photo", [ph.src], ph.alt, ICON_ROUTE));
        fig.append(credit(ph));  // 作者と利用条件（CC BY などの表示義務）
        li.append(fig);
      }
      li.append(el("span", "spot-kind", p.kind));
      li.append(el("h3", "spot-name", p.name));
      li.append(el("p", "spot-text", p.text));
      if (p.latitude != null) {
        var d = km(s.station_latitude, s.station_longitude, p.latitude, p.longitude);
        li.append(el("p", "spot-dist", s.station_name + "から直線で約" + (d < 1 ? d.toFixed(1) : Math.round(d)) + "km"));
      }
      var links = el("div", "spot-links");
      if (p.latitude != null) {
        var map = safeLink(mapsPlace(p.latitude, p.longitude), "m-chip");
        map.append(icon(ICON_ROUTE));
        map.append(document.createTextNode("地図"));
        map.setAttribute("aria-label", p.name + "をGoogleマップで見る");
        links.append(map);
      }
      var site = safeLink(p.url, "m-chip");
      if (site) {
        site.append(icon(ICON_LINK));
        site.append(document.createTextNode("公式サイト"));
        site.setAttribute("aria-label", p.name + "の公式サイト（新しいタブで開きます）");
        links.append(site);
      }
      li.append(links);
      ul.append(li);
    });
    var more = guide.more_spots;
    var a = more && safeLink(more.url, null);
    if (a) {
      a.textContent = more.label;
      document.getElementById("spotsMore").append(a);
    }
  }

  // ---------- 亀岡の名物 ----------
  function renderSpecialties() {
    var ul = document.getElementById("specialtyList");
    (guide.specialties || []).forEach(function (p) {
      var li = el("li", "spot");
      var ph = p.photo || {};
      if (PHOTO_SRC.test(ph.src || "")) {
        var fig = el("figure", "spot-figure");
        fig.append(picture("spot-photo", [ph.src], ph.alt, ICON_ROUTE));
        fig.append(credit(ph));
        li.append(fig);
      }
      li.append(el("span", "spot-kind", p.kind));
      li.append(el("h3", "spot-name", p.name));
      li.append(el("p", "spot-text", p.text));
      if (p.map_query) {
        var links = el("div", "spot-links");
        var a = safeLink("https://www.google.com/maps/search/" + encodeURIComponent(p.map_query) + "/@" + Number(guide.stadium.station_latitude).toFixed(5) + "," + Number(guide.stadium.station_longitude).toFixed(5) + ",14z", "m-chip");
        a.append(icon(ICON_ROUTE));
        a.append(document.createTextNode(p.map_label || "地図"));
        a.setAttribute("aria-label", p.name + "：" + (p.map_label || "地図") + "（Googleマップ）");
        links.append(a);
        li.append(links);
      }
      ul.append(li);
    });
  }

  // ---------- ごはん ----------
  var FOOD_WORDS = ["グルメ", "ラーメン", "居酒屋", "カフェ"];
  function renderFood() {
    var box = el("div", "m-food");
    (guide.food_places || []).forEach(function (p) {
      var row = el("div", "m-food-row");
      row.append(el("span", "m-food-place", p.label));
      var ul = el("ul", "m-food-list");
      FOOD_WORDS.forEach(function (w) {
        var a = safeLink("https://www.google.com/maps/search/" + encodeURIComponent(w) + "/@" + Number(p.latitude).toFixed(5) + "," + Number(p.longitude).toFixed(5) + ",16z", "m-chip");
        a.textContent = w;
        a.setAttribute("aria-label", p.label + "の" + w + "をGoogleマップで探す");
        var li = el("li");
        li.append(a);
        ul.append(li);
      });
      row.append(ul);
      box.append(row);
    });
    var local = safeLink("https://www.google.com/search?q=" + encodeURIComponent("亀岡市 ご当地グルメ"), "m-food-local");
    local.textContent = "亀岡市のご当地グルメを調べる";
    var p2 = el("p", "m-food-more");
    p2.append(local);
    box.append(p2);
    document.getElementById("foodBody").append(box);
  }

  // ---------- 泊まる（スタジアムのそばの2軒） ----------
  function renderStay() {
    var ul = document.getElementById("featuredList");
    (guide.featured_hotels || []).forEach(function (h) {
      var li = el("li", "featured-item");
      var imgs = (h.image_urls || []).filter(function (u) { return RAKUTEN_IMAGE.test(u); });
      var fig = el("figure", "featured-figure");
      fig.append(picture("featured-photo", imgs, h.name, ICON_HOTEL));
      if (imgs.length) fig.append(el("figcaption", "spot-credit", "写真：楽天トラベル"));
      li.append(fig);
      li.append(el("h4", "featured-name", h.name));
      li.append(el("p", "featured-text", h.text));
      var a = safeLink(h.url, "m-btn");
      if (a) {
        a.append(icon(ICON_HOTEL));
        a.append(document.createTextNode("楽天トラベルで見る"));
        a.setAttribute("aria-label", h.name + "を楽天トラベルで見る（新しいタブで開きます）");
        li.append(a);
      }
      ul.append(li);
    });
    var jalan = a8Link("lodging", null, function (a) { a.textContent = "じゃらんで探す"; });
    if (jalan) {
      var more = document.getElementById("stayMore");
      more.append(prTag());
      more.append(document.createTextNode("ほかの宿を探す："));
      more.append(jalan);
    }
  }

  // ---------- 試合ごとの空室 ----------
  var featuredNos = {};

  function nearLabel(h) {
    if (h.featured) return "スタジアムすぐ";
    if (h.area === "kameoka") return "湯の花温泉";
    if (h.stadium_proximity) return "スタジアム近く";
    return "";
  }

  // そばの2軒は home-guide.json の image_urls を先に試す（楽天APIの画像が無いことがあるため）。読めなければ次の候補、最後は絵
  var featuredImages = {};
  function photo(h) {
    var box = el("div", "hotel-photo");
    var list = h ? (featuredImages[h.hotel_no] || []).concat([h.hotel_image_url, h.hotel_thumbnail_url]) : [];
    list = list.filter(function (u, i) { return RAKUTEN_IMAGE.test(u || "") && list.indexOf(u) === i; });
    var empty = function () { var e = el("div", "hotel-photo-empty"); e.append(icon(ICON_HOTEL)); return e; };
    if (list.length) {
      var img = document.createElement("img");
      img.src = list.shift();
      img.alt = "";
      img.width = 320;
      img.height = 240;
      img.loading = "lazy";
      img.decoding = "async";
      img.referrerPolicy = "no-referrer";
      img.addEventListener("error", function () {
        if (list.length) img.src = list.shift();
        else img.replaceWith(empty());
      });
      box.append(img);
    } else {
      box.append(empty());
    }
    return box;
  }

  function hotelCard(h) {
    var li = el("li", "hotel");
    var a = safeLink(h.affiliate_url, "hotel-link", "nofollow sponsored noopener noreferrer");
    var box = a || el("div", "hotel-link");
    var ph = photo(h);
    var near = nearLabel(h);
    if (near) ph.append(el("span", "hotel-near", near));
    box.append(ph);

    var text = el("div", "hotel-text");
    var name = el("p", "hotel-name", displayName(h.hotel_name));
    name.title = h.hotel_name;
    text.append(name);
    var price = el("p", "hotel-price");
    if (h.stay_charge_total != null) {
      price.append(document.createTextNode("2名1泊 "));
      price.append(el("b", null, "¥" + Number(h.stay_charge_total).toLocaleString("ja-JP")));
      price.append(document.createTextNode("〜"));
      text.append(price);
      var per = "1人 約¥" + Math.round(h.stay_charge_total / 2).toLocaleString("ja-JP");
      text.append(el("p", "hotel-plan", h.stay_meal ? per + "・" + h.stay_meal : per));
    } else if (h.min_charge != null) {
      price.append(document.createTextNode("目安 "));
      price.append(el("b", null, "¥" + Number(h.min_charge).toLocaleString("ja-JP")));
      price.append(document.createTextNode("〜"));
      text.append(price);
    } else {
      price.textContent = "料金は楽天トラベルで確認";
      text.append(price);
    }
    var sub = el("p", "hotel-sub");
    if (h.distance_km_from_stadium != null) sub.append(el("span", null, "スタジアムまで" + h.distance_km_from_stadium + "km"));
    if (h.review_average != null && h.review_count) {
      var rv = el("span");
      rv.append(el("span", "hotel-star", "★" + Number(h.review_average).toFixed(1)));
      rv.append(document.createTextNode("（" + h.review_count + "件）"));
      sub.append(rv);
    }
    if (sub.childNodes.length) text.append(sub);
    box.append(text);
    li.append(box);
    return li;
  }

  // スタジアムのそばの2軒が取得時点で空いていなかったときのカード。楽天トラベルの宿の案内へ（広告ではないリンク）
  function fullCard(f) {
    var li = el("li", "hotel is-full");
    var a = safeLink(f.url, "hotel-link");
    var box = a || el("div", "hotel-link");
    var ph = photo({ hotel_no: f.hotel_no });
    ph.append(el("span", "hotel-near", "スタジアムすぐ"));
    box.append(ph);
    var text = el("div", "hotel-text");
    text.append(el("p", "hotel-name", f.name));
    text.append(el("p", "hotel-price", "取得時点では2名の空室が見つかりませんでした"));
    text.append(el("p", "hotel-sub", "楽天トラベルで確かめる"));
    box.append(text);
    li.append(box);
    return li;
  }

  var rowSeq = 0;
  function hotelRow(cards, label) {
    var wrap = el("div", "h-row");
    var ul = el("ul", "hotels");
    ul.id = "home-hotels-" + (++rowSeq);
    ul.setAttribute("aria-label", label + "の候補 " + cards.length + "件");
    cards.forEach(function (c) { ul.append(c); });
    if (cards.length > 1) {
      [["prev", "前の宿", "M15 18l-6-6 6-6"], ["next", "次の宿", "M9 18l6-6-6-6"]].forEach(function (b) {
        var btn = el("button", "h-arrow h-arrow-" + b[0]);
        btn.type = "button";
        btn.setAttribute("aria-label", label + "：" + b[1]);
        btn.setAttribute("aria-controls", ul.id);
        btn.append(icon(b[2]));
        btn.addEventListener("click", function () {
          ul.scrollBy({ left: (b[0] === "next" ? 1 : -1) * ul.clientWidth * 0.8, behavior: scrollBehavior() });
        });
        wrap.append(btn);
      });
      var sync = function () {
        var max = ul.scrollWidth - ul.clientWidth - 2;
        wrap.classList.toggle("at-start", ul.scrollLeft <= 2);
        wrap.classList.toggle("at-end", ul.scrollLeft >= max);
      };
      ul.addEventListener("scroll", sync, { passive: true });
      requestAnimationFrame(sync);
    }
    wrap.prepend(ul);
    return wrap;
  }

  function night(label, checkin, hotels) {
    var sec = el("section", "night");
    var head = el("div", "night-head");
    head.append(el("h4", "night-title", label));
    if (checkin) head.append(el("span", "night-date", md(checkin) + " チェックイン"));
    // そばの2軒は、空いていなくても先頭に出す（空いていないことも知りたいことなので）
    var found = {};
    hotels.forEach(function (h) { if (h.featured) found[h.hotel_no] = true; });
    var cards = [];
    (guide.featured_hotels || []).forEach(function (f) {
      if (!found[f.hotel_no]) cards.push(fullCard(f));
    });
    var featuredCards = hotels.filter(function (h) { return h.featured; }).map(hotelCard);
    cards = featuredCards.concat(cards).concat(hotels.filter(function (h) { return !h.featured; }).map(hotelCard));
    if (cards.length > 1) head.append(el("span", "night-hint", cards.length + "件・スワイプで他の宿 →"));
    sec.append(head);
    sec.append(hotelRow(cards, label));
    return sec;
  }

  function renderHotels(box, doc) {
    var m = doc.meta || {};
    // featured の印が無いデータでも、宿の番号でそばの2軒を見分ける
    (doc.hotels || []).concat(doc.same_day_hotels || []).forEach(function (h) { if (featuredNos[h.hotel_no]) h.featured = true; });
    box.textContent = "";
    box.append(night("前泊", m.checkin_date, doc.hotels || []));
    if (Array.isArray(doc.same_day_hotels)) box.append(night("当日泊", m.same_day_checkin_date, doc.same_day_hotels));
    box.append(el("p", "h-foot", "料金は取得時点で空室のあったプランの最安（2名1泊・税・サービス料込み）。取得 " + (m.updated_at || "") + " JST ／ 提供：楽天トラベル"));
  }

  function matchBody(m) {
    var body = el("div", "m-body");
    var hh = el("div", "h-head");
    var ht = el("h3", "h-title", "ホテル");
    ht.append(prTag());
    hh.append(ht);
    hh.append(el("span", "h-cond", "2名・スタジアムのそばの2軒→スタジアムから3km→湯の花温泉・各区域で安い順"));
    body.append(hh);
    var box = el("div", "h-box");
    if (m.hotels_path) {
      box.append(el("p", "h-empty", "読み込んでいます…"));
      getJson(m.hotels_path).then(function (d) { renderHotels(box, d); })
        .catch(function () { box.textContent = ""; box.append(el("p", "h-empty", "ホテル情報を読み込めませんでした。")); });
    } else {
      box.append(el("p", "h-empty", "空室の情報は準備中です（週1回、自動で取得します）。上の「泊まる」から楽天トラベルの宿の案内を開けます。"));
    }
    body.append(box);
    return body;
  }

  function renderMatch(m) {
    var li = el("li", "away-match" + (m.competition === "LEV" ? " is-lev" : ""));
    li.id = m.id;
    var article = el("article");
    article.setAttribute("aria-labelledby", m.id + "-title");
    var details = el("details", "m-details");
    var head = el("summary", "m-head");
    head.append(el("span", "m-comp", (m.competition_label || m.competition) + "　" + (m.round || "")));
    var title = el("h3", "m-title");
    title.id = m.id + "-title";
    title.append(el("small", null, "vs"));
    title.append(document.createTextNode(m.opponent));
    head.append(title);
    var date = el("span", "m-date", dateLabel(m));
    date.append(el("small", null, m.match_date ? (m.kickoff_time ? m.kickoff_time + " キックオフ" : "キックオフ未定") : "日程未定"));
    head.append(date);
    var chev = el("span", "m-chev");
    chev.append(icon("M6 9l6 6 6-6"));
    head.append(chev);
    details.append(head);
    article.append(details);

    var wrap = null;
    function ensureBody() {
      if (!wrap) {
        wrap = el("div", "m-wrap");
        var clip = el("div", "m-clip");
        clip.append(matchBody(m));
        wrap.append(clip);
        details.append(wrap);
      }
      return wrap;
    }
    function reduced() { return document.documentElement.dataset.motion === "off"; }
    var closing = null;
    function finishClose() {
      if (!closing) return;
      wrap.removeEventListener("transitionend", closing);
      closing = null;
      details.open = false;
    }
    function expand(animate) {
      if (closing) { wrap.removeEventListener("transitionend", closing); closing = null; }
      ensureBody();
      details.open = true;
      if (!animate) { details.classList.add("is-open"); return; }
      void wrap.offsetHeight;
      details.classList.add("is-open");
    }
    function collapse() {
      details.classList.remove("is-open");
      if (reduced()) { details.open = false; return; }
      closing = function (e) { if (e.target === wrap && e.propertyName === "grid-template-rows") finishClose(); };
      wrap.addEventListener("transitionend", closing);
      setTimeout(finishClose, 900);  // transitionend が来ないときの保険（--acc-dur より長く）
    }
    details.addEventListener("toggle", function () {
      if (details.open && !details.classList.contains("is-open")) expand(false);
    });
    head.addEventListener("click", function (e) {
      e.preventDefault();
      if (details.classList.contains("is-open")) collapse();
      else expand(!reduced());
    });
    li.append(article);
    li.openMatch = function () { expand(false); };
    return li;
  }

  function renderMatches(matches, index) {
    var venues = guide.venues || [];
    var paths = {};
    (index.matches || []).forEach(function (e) { paths[e.match_id] = e.data_path; });
    var today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    var home = matches.filter(function (m) {
      if (m.home_away !== "H" || venues.indexOf(m.venue) < 0 || m.is_visible === false) return false;
      var last = m.match_date || (m.date_candidates && m.date_candidates.length ? m.date_candidates[m.date_candidates.length - 1] : "9999-12-31");
      return last >= today;
    });
    home.forEach(function (m) {
      m.hotels_path = paths[m.id] || "";
      list.append(renderMatch(m));
    });
    // 直近の試合は最初から開く。URL に #試合ID があればその試合も開く
    if (home.length) document.getElementById(home[0].id).openMatch();
    var hash = (location.hash || "").slice(1);
    var target = hash && document.getElementById(hash);
    if (target && target.openMatch) {
      target.openMatch();
      target.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
    }
    if (!home.length) list.append(el("li", "h-empty", "これからのホーム戦はありません。"));
    return home.length;
  }

  // ページ内の移動は、移動先の見出しにフォーカスを移す（キーボードと読み上げで迷わないように）
  document.getElementById("homeJump").addEventListener("click", function (e) {
    var a = e.target.closest("a[href^='#']");
    if (!a) return;
    var target = document.getElementById(a.getAttribute("href").slice(1));
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
    target.focus({ preventScroll: true });
    try { history.replaceState(null, "", a.getAttribute("href")); } catch (err) {}
  });

  Promise.all([
    getJson("data/home-guide.json?v=fe03d6b2"),
    getJson("data/affiliates.json?v=0d08689a").catch(function () { return {}; }),
  ]).then(function (r) {
    guide = r[0];
    affiliates = r[1] || {};
    (guide.featured_hotels || []).forEach(function (h) { featuredNos[h.hotel_no] = true; featuredImages[h.hotel_no] = h.image_urls || []; });
    renderAccess();
    renderParking();
    renderSpots();
    renderSpecialties();
    renderFood();
    renderStay();
    return Promise.all([
      getJson("data/matches.json?v=2b655a4a"),
      getJson("data/hotel-index.json?v=dd6a582c").catch(function () { return { matches: [] }; }),
    ]);
  }).then(function (r) {
    var n = renderMatches(r[0].matches || [], r[1] || {});
    var updated = r[1] && r[1].meta && r[1].meta.updated_at;
    meta.textContent = "これからのホーム戦 " + n + "試合" + (updated ? "／ ホテル情報の取得 " + updated + " JST" : "");
  }).catch(function () {
    meta.textContent = "データを読み込めませんでした。時間をおいて開き直してください。";
  });
})();
