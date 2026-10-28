// ホーム観戦ガイド。data/home-guide.json（手で書く案内）と、matches.json・hotel-index.json から
// サンガスタジアムのホーム戦を拾い、試合ごとの data/hotels/{id}.json を読んで並べる。
// ホテルのカード・横に流す列・試合の開け閉めは assets/away-guide.js と同じ作り（見た目は away.css を共有）。
// 文字列は textContent だけで入れる。リンクは https のものだけ。ホテルの写真は楽天トラベルの画像ホストのものだけ。
// 英語版（home-en.html）・韓国語版（home-ko.html）も同じスクリプト。<html lang> で data/home-guide.{en,ko}.json を重ね、
// 画面の文言は T(キー, 日本語) で引く（訳が無いキーは日本語のまま出る）。
(function () {
  "use strict";
  var meta = document.getElementById("homeMeta");
  var list = document.getElementById("homeList");

  var SVG_NS = "http://www.w3.org/2000/svg";
  // A8のリンク。飛び先を指定したもの（&a8ejpredirect=エンコードした https のURL）も通す
  var A8_LINK = /^https:\/\/px\.a8\.net\/svt\/ejp\?a8mat=[A-Za-z0-9+]+(?:&a8ejpredirect=https%3A%2F%2F[A-Za-z0-9%._~-]+)?$/;
  var A8_PIXEL = /^https:\/\/www\d+\.a8\.net\/0\.gif\?a8mat=[A-Za-z0-9+]+$/;
  // 楽天トラベルの画像。img.travel.rakuten.co.jp と、宿ページの写真が置かれている trvimg.r10s.jp
  var RAKUTEN_IMAGE = /^https:\/\/(?:img\.travel\.rakuten\.co\.jp|trvimg\.r10s\.jp)\/[^\s"'<>]+$/;
  var LANG = (document.documentElement.lang || "ja").slice(0, 2);
  // 訳の重ね書き。版数は tools/asset-versions.mjs が揃える
  var OVERLAY = { en: "data/home-guide.en.json?v=22f0df81", ko: "data/home-guide.ko.json?v=a8ff3698" }[LANG] || "";
  var ui = {};
  var names = {};
  function T(key, ja, args) {
    var s = typeof ui[key] === "string" ? ui[key] : ja;
    (args || []).forEach(function (v, i) { s = s.split("{" + i + "}").join(v); });
    return s;
  }
  // 訳は文字列だけを差し替える。配列は位置で、オブジェクトはキーで重ねる（URL・座標・写真の場所は日本語版のまま）
  function overlay(base, tr) {
    if (Array.isArray(base)) return Array.isArray(tr) ? base.map(function (b, i) { return overlay(b, tr[i]); }) : base;
    if (base && typeof base === "object") {
      if (!tr || typeof tr !== "object" || Array.isArray(tr)) return base;
      var out = {};
      Object.keys(base).forEach(function (k) { out[k] = overlay(base[k], tr[k]); });
      return out;
    }
    return typeof base === "string" && typeof tr === "string" ? tr : base;
  }
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
    // 同じ提携（a8mat が同じ）のリンクが複数あっても、ピクセルは1回だけ
    var mat = (item.pixel || "").split("a8mat=")[1];
    if (mat && !pixelShown[mat] && A8_PIXEL.test(item.pixel)) {
      pixelShown[mat] = true;
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

  // ?v= 付きは通常キャッシュ。版数の無い data/hotels/*.json だけ cache: no-store。
  var openHotelReady = {};
  function getJson(path) {
    var versioned = /[?&]v=[0-9a-f]{6,}/i.test(path);
    return fetch(path, versioned ? undefined : { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error(path + " " + r.status);
      return r.json();
    });
  }

  function md(iso) {
    var p = iso.split("-");
    var day = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])).getDay();
    return T("date", "{0}/{1}（{2}）", [Number(p[1]), Number(p[2]), T("week", "日,月,火,水,木,金,土").split(",")[day]]);
  }
  function dateLabel(m) {
    if (m.match_date) return md(m.match_date);
    if (m.date_candidates && m.date_candidates.length) return m.date_candidates.map(md).join(T("date_or", " か "));
    return T("date_tbd", "日程未定");
  }
  // 節・回戦。訳が無い形（MD1 など）はそのまま
  function roundLabel(r) {
    var n;
    if ((n = /^第(\d+)節$/.exec(r))) return T("round_sec", "第{0}節", [n[1]]);
    if ((n = /^(\d+)回戦$/.exec(r))) return T("round_n", "{0}回戦", [n[1]]);
    if ((n = /^ラウンド(\d+)$/.exec(r))) return T("round_of", "ラウンド{0}", [n[1]]);
    return (names.rounds || {})[r] || r;
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
    big.textContent = T("map_big", "大きな地図で見る（Googleマップ）");
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
    facts.append(el("dt", null, T("stadium", "スタジアム")));
    var venue = el("dd", null, s.name);
    venue.append(document.createTextNode(" "));
    venue.append(el("span", "m-city", s.city));
    facts.append(venue);
    (guide.access || []).forEach(function (a) {
      facts.append(el("dt", null, a.label));
      var dd = el("dd", null, a.text);
      var link = safeLink(a.url, "home-inline-link");
      if (link) {
        link.textContent = a.link_label || T("guide_link", "案内");
        link.setAttribute("aria-label", T("new_tab", "{0}（新しいタブで開きます）", [a.link_label || T("guide_link", "案内")]));
        dd.append(link);
      }
      facts.append(dd);
    });
    box.append(facts);

    var actions = el("div", "m-actions");
    (guide.routes || []).forEach(function (r) {
      var a = safeLink("https://www.google.com/maps/dir/?api=1&travelmode=transit&origin=" + encodeURIComponent(r.origin) + "&destination=" + s.latitude + "," + s.longitude, "m-btn");
      a.append(icon(ICON_ROUTE));
      a.append(document.createTextNode(T("route", "{0}の経路", [r.label])));
      actions.append(a);
    });
    if (actions.childNodes.length) box.append(actions);
    box.append(osmMap(T("map_title", "{0} と{1}の周辺の地図", [s.name, s.station_name]), s.latitude, s.longitude, 0.006, 0.009));
  }

  // ---------- 車で来る ----------
  var ICON_CAR = "M5 17h14M6 17v2M18 17v2M4 13l2-5a2 2 0 0 1 1.9-1.4h8.2A2 2 0 0 1 18 8l2 5v4H4v-4zM4 13h16M7.5 15h.01M16.5 15h.01";
  function renderParking() {
    var pk = guide.parking || {};
    var box = document.getElementById("parkingBody");
    (pk.notes || []).forEach(function (t) { box.append(el("p", "home-note parking-note", t)); });

    // 試合の日に使える駐車場（会員向け・保津川下り・商業施設）
    if ((pk.match_day_lots || []).length) {
      box.append(el("h3", "home-sub", T("lots_title", "試合の日に停められる駐車場")));
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
          a.textContent = lot.link_label || T("guide_link", "案内");
          a.setAttribute("aria-label", T("new_tab", "{0}（新しいタブで開きます）", [lot.name + T("colon", "：") + (lot.link_label || T("guide_link", "案内"))]));
          var pl = el("p", "parking-lot-link");
          pl.append(a);
          li.append(pl);
        }
        lots.append(li);
      });
      box.append(lots);
    }

    box.append(el("h3", "home-sub", T("services_title", "予約サービスで探す")));
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
      a.setAttribute("aria-label", T("service_label", "{0}：サンガスタジアム周辺の駐車場（新しいタブで開きます）", [sv.name]));
      li.append(link || a);
      ul.append(li);
    });
    box.append(ul);

    box.append(el("h3", "home-sub", T("coin_title", "コインパーキングを地図で探す")));
    box.append(el("p", "home-note parking-note", T("coin_note", "離れた駅の近くに停めて、JR嵯峨野線で亀岡駅へ向かうこともできます。")));
    var food = el("div", "m-food");
    (pk.coin_places || []).forEach(function (p) {
      var row = el("div", "m-food-row");
      row.append(el("span", "m-food-place", p.label));
      var list = el("ul", "m-food-list");
      T("coin_words", "コインパーキング,駐車場").split(",").forEach(function (w) {
        var a = safeLink("https://www.google.com/maps/search/" + encodeURIComponent(w) + "/@" + Number(p.latitude).toFixed(5) + "," + Number(p.longitude).toFixed(5) + ",16z", "m-chip");
        a.textContent = w;
        a.setAttribute("aria-label", T("maps_search", "{0}の{1}をGoogleマップで探す", [p.label, w]));
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
    cap.append(document.createTextNode(T("photo", "写真：") + (ph.credit || "") + " / "));
    var lic = safeLink(ph.license_url, null) || el("span");
    lic.textContent = ph.license || "";
    cap.append(lic);
    var src = safeLink(ph.source_url, null);
    if (src) { cap.append(document.createTextNode(T("paren_open", "（"))); src.textContent = ph.source_label || "Wikimedia Commons"; cap.append(src); cap.append(document.createTextNode(T("paren_close", "）"))); }
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
        li.append(el("p", "spot-dist", T("dist", "{0}から直線で約{1}km", [s.station_name, d < 1 ? d.toFixed(1) : Math.round(d)])));
      }
      var links = el("div", "spot-links");
      if (p.latitude != null) {
        var map = safeLink(mapsPlace(p.latitude, p.longitude), "m-chip");
        map.append(icon(ICON_ROUTE));
        map.append(document.createTextNode(T("map", "地図")));
        map.setAttribute("aria-label", T("maps_view", "{0}をGoogleマップで見る", [p.name]));
        links.append(map);
      }
      var site = safeLink(p.url, "m-chip");
      if (site) {
        site.append(icon(ICON_LINK));
        site.append(document.createTextNode(T("official", "公式サイト")));
        site.setAttribute("aria-label", T("official_label", "{0}の公式サイト（新しいタブで開きます）", [p.name]));
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
        a.append(document.createTextNode(p.map_label || T("map", "地図")));
        a.setAttribute("aria-label", p.name + T("colon", "：") + (p.map_label || T("map", "地図")) + T("gmaps_suffix", "（Googleマップ）"));
        links.append(a);
        li.append(links);
      }
      ul.append(li);
    });
  }

  // ---------- ごはん ----------
  function renderFood() {
    var box = el("div", "m-food");
    (guide.food_places || []).forEach(function (p) {
      var row = el("div", "m-food-row");
      row.append(el("span", "m-food-place", p.label));
      var ul = el("ul", "m-food-list");
      T("food_words", "グルメ,ラーメン,居酒屋,カフェ").split(",").forEach(function (w) {
        var a = safeLink("https://www.google.com/maps/search/" + encodeURIComponent(w) + "/@" + Number(p.latitude).toFixed(5) + "," + Number(p.longitude).toFixed(5) + ",16z", "m-chip");
        a.textContent = w;
        a.setAttribute("aria-label", T("maps_search", "{0}の{1}をGoogleマップで探す", [p.label, w]));
        var li = el("li");
        li.append(a);
        ul.append(li);
      });
      row.append(ul);
      box.append(row);
    });
    var local = safeLink("https://www.google.com/search?q=" + encodeURIComponent(T("food_query", "亀岡市 ご当地グルメ")), "m-food-local");
    local.textContent = T("food_local", "亀岡市のご当地グルメを調べる");
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
      if (imgs.length) fig.append(el("figcaption", "spot-credit", T("photo", "写真：") + T("rt_name", "楽天トラベル")));
      li.append(fig);
      li.append(el("h4", "featured-name", h.name));
      li.append(el("p", "featured-text", h.text));
      var a = safeLink(h.url, "m-btn");
      if (a) {
        a.append(icon(ICON_HOTEL));
        a.append(document.createTextNode(T("rt_view", "楽天トラベルで見る")));
        a.setAttribute("aria-label", T("rt_view_label", "{0}を楽天トラベルで見る（新しいタブで開きます）", [h.name]));
        li.append(a);
      }
      // 英語版・韓国語版だけ、見る人の言語で開く Agoda の宿ページも出す（日本語版は楽天トラベルだけ）
      var agoda = LANG !== "ja" && h.agoda_key ? a8Link(h.agoda_key, "m-btn", function (b) {
        b.append(icon(ICON_HOTEL));
        b.append(document.createTextNode(T("agoda_view", "Agodaで見る")));
        b.append(prTag());
        b.setAttribute("aria-label", T("agoda_view_label", "{0}をAgodaで見る（広告・新しいタブで開きます）", [h.name]));
      }) : null;
      if (agoda) { agoda.classList.add("featured-a8"); li.append(agoda); }
      ul.append(li);
    });
    // ほかの宿: 日本語版はじゃらん、英語版・韓国語版は言語が切り替わる Agoda
    var jalan = a8Link(LANG === "ja" ? "lodging" : "lodging_agoda", null, function (a) { a.textContent = T("stay_search", "じゃらんで探す"); });
    if (jalan) {
      var more = document.getElementById("stayMore");
      more.append(prTag());
      more.append(document.createTextNode(T("stay_more", "ほかの宿を探す：")));
      more.append(jalan);
    }
  }

  // ---------- 試合ごとの空室 ----------
  var featuredNos = {};
  var featuredNames = {};

  function nearLabel(h) {
    if (h.featured) return T("near_featured", "スタジアムすぐ");
    if (h.area === "kameoka") return T("near_yunohana", "湯の花温泉");
    if (h.stadium_proximity) return T("near_stadium", "スタジアム近く");
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
    // そばの2軒は案内に書いた名前（英語版・韓国語版では訳した名前）。ほかは楽天トラベルの名前のまま
    var name = el("p", "hotel-name", featuredNames[h.hotel_no] || displayName(h.hotel_name));
    name.title = h.hotel_name;
    text.append(name);
    var price = el("p", "hotel-price");
    if (h.stay_charge_total != null) {
      price.append(document.createTextNode(T("price_two", "2名1泊 ")));
      price.append(el("b", null, "¥" + Number(h.stay_charge_total).toLocaleString("ja-JP")));
      price.append(document.createTextNode(T("price_suffix", "〜")));
      text.append(price);
      var per = T("price_per", "1人 約¥{0}", [Math.round(h.stay_charge_total / 2).toLocaleString("ja-JP")]);
      var meal = h.stay_meal && ((names.meals || {})[h.stay_meal] || h.stay_meal);
      text.append(el("p", "hotel-plan", meal ? per + T("sep", "・") + meal : per));
    } else if (h.min_charge != null) {
      price.append(document.createTextNode(T("price_from", "目安 ")));
      price.append(el("b", null, "¥" + Number(h.min_charge).toLocaleString("ja-JP")));
      price.append(document.createTextNode(T("price_suffix", "〜")));
      text.append(price);
    } else {
      price.textContent = T("price_check", "料金は楽天トラベルで確認");
      text.append(price);
    }
    var sub = el("p", "hotel-sub");
    if (h.distance_km_from_stadium != null) sub.append(el("span", null, T("hotel_dist", "スタジアムまで{0}km", [h.distance_km_from_stadium])));
    if (h.review_average != null && h.review_count) {
      var rv = el("span");
      rv.append(el("span", "hotel-star", "★" + Number(h.review_average).toFixed(1)));
      rv.append(document.createTextNode(T("reviews", "（{0}件）", [h.review_count])));
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
    ph.append(el("span", "hotel-near", T("near_featured", "スタジアムすぐ")));
    box.append(ph);
    var text = el("div", "hotel-text");
    text.append(el("p", "hotel-name", f.name));
    text.append(el("p", "hotel-price", T("full", "取得時点では2名の空室が見つかりませんでした")));
    text.append(el("p", "hotel-sub", T("full_check", "楽天トラベルで確かめる")));
    box.append(text);
    li.append(box);
    return li;
  }

  var rowSeq = 0;
  function hotelRow(cards, label) {
    var wrap = el("div", "h-row");
    var ul = el("ul", "hotels");
    ul.id = "home-hotels-" + (++rowSeq);
    ul.setAttribute("aria-label", T("row_label", "{0}の候補 {1}件", [label, cards.length]));
    cards.forEach(function (c) { ul.append(c); });
    if (cards.length > 1) {
      [["prev", T("prev", "前の宿"), "M15 18l-6-6 6-6"], ["next", T("next", "次の宿"), "M9 18l6-6-6-6"]].forEach(function (b) {
        var btn = el("button", "h-arrow h-arrow-" + b[0]);
        btn.type = "button";
        btn.setAttribute("aria-label", label + T("colon", "：") + b[1]);
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
    if (checkin) head.append(el("span", "night-date", T("checkin", "{0} チェックイン", [md(checkin)])));
    // そばの2軒は、空いていなくても先頭に出す（空いていないことも知りたいことなので）
    var found = {};
    hotels.forEach(function (h) { if (h.featured) found[h.hotel_no] = true; });
    var cards = [];
    (guide.featured_hotels || []).forEach(function (f) {
      if (!found[f.hotel_no]) cards.push(fullCard(f));
    });
    var featuredCards = hotels.filter(function (h) { return h.featured; }).map(hotelCard);
    cards = featuredCards.concat(cards).concat(hotels.filter(function (h) { return !h.featured; }).map(hotelCard));
    if (cards.length > 1) head.append(el("span", "night-hint", T("swipe", "{0}件・スワイプで他の宿 →", [cards.length])));
    sec.append(head);
    sec.append(hotelRow(cards, label));
    return sec;
  }

  function renderHotels(box, doc) {
    var m = doc.meta || {};
    // featured の印が無いデータでも、宿の番号でそばの2軒を見分ける
    (doc.hotels || []).concat(doc.same_day_hotels || []).forEach(function (h) { if (featuredNos[h.hotel_no]) h.featured = true; });
    box.textContent = "";
    box.append(night(T("night_before", "前泊"), m.checkin_date, doc.hotels || []));
    if (Array.isArray(doc.same_day_hotels)) box.append(night(T("night_same", "当日泊"), m.same_day_checkin_date, doc.same_day_hotels));
    box.append(el("p", "h-foot", T("hotel_foot", "料金は取得時点で空室のあったプランの最安（2名1泊・税・サービス料込み）。取得 {0} JST ／ 提供：楽天トラベル", [m.updated_at || ""])));
  }

  function matchBody(m) {
    var body = el("div", "m-body");
    var hh = el("div", "h-head");
    var ht = el("h3", "h-title", T("hotels", "ホテル"));
    ht.append(prTag());
    hh.append(ht);
    hh.append(el("span", "h-cond", T("hotel_cond", "2名・スタジアムのそばの2軒→スタジアムから3km→湯の花温泉・各区域で安い順")));
    body.append(hh);
    var box = el("div", "h-box");
    if (m.hotels_path) {
      box.append(el("p", "h-empty", T("loading", "読み込んでいます…")));
      openHotelReady[m.id] = getJson(m.hotels_path).then(function (d) { renderHotels(box, d); })
        .catch(function () { box.textContent = ""; box.append(el("p", "h-empty", T("hotel_error", "ホテル情報を読み込めませんでした。"))); });
    } else {
      openHotelReady[m.id] = Promise.resolve();
      box.append(el("p", "h-empty", T("hotel_pending", "空室の情報は準備中です（週1回、自動で取得します）。上の「泊まる」から楽天トラベルの宿の案内を開けます。")));
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
    head.append(el("span", "m-comp", ((names.competitions || {})[m.competition] || m.competition_label || m.competition) + T("comp_sep", "　") + roundLabel(m.round || "")));
    var title = el("h3", "m-title");
    title.id = m.id + "-title";
    title.append(el("small", null, "vs"));
    title.append(document.createTextNode((names.opponents || {})[m.opponent] || m.opponent));
    head.append(title);
    var date = el("span", "m-date", dateLabel(m));
    date.append(el("small", null, m.match_date ? (m.kickoff_time ? T("kickoff", "{0} キックオフ", [m.kickoff_time]) : T("kickoff_tbd", "キックオフ未定")) : T("date_tbd", "日程未定")));
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
    var openIds = [];
    if (home.length) {
      document.getElementById(home[0].id).openMatch();
      openIds.push(home[0].id);
    }
    var hash = (location.hash || "").slice(1);
    var target = hash && document.getElementById(hash);
    if (target && target.openMatch) {
      target.openMatch();
      if (openIds.indexOf(hash) < 0) openIds.push(hash);
      target.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
    }
    if (!home.length) list.append(el("li", "h-empty", T("no_matches", "これからのホーム戦はありません。")));
    list._openHotelIds = openIds;
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

  function settle(id) {
    var node = document.getElementById(id);
    if (!node) return;
    node.removeAttribute("aria-busy");
  }
  function releaseMatchSpace() {
    if (!list) return;
    list.classList.remove("is-loading");
    list.removeAttribute("aria-busy");
  }

  // 案内・提携・日程・ホテル索引は同時に取り始める。描画は案内が揃ってから、試合欄はその次。
  var guideP = getJson("data/home-guide.json?v=46fe28f7");
  var trP = OVERLAY ? getJson(OVERLAY).catch(function () { return {}; }) : Promise.resolve({});
  var affP = getJson("data/affiliates.json?v=3ccbd3a2").catch(function () { return {}; });
  var matchesP = getJson("data/matches.json?v=87b51598");
  var indexP = getJson("data/hotel-index.json?v=f6a0e3e6").catch(function () { return { matches: [] }; });

  Promise.all([guideP, affP, trP]).then(function (r) {
    var tr = r[2] || {};
    ui = tr.ui || {};
    names = tr.names || {};
    guide = overlay(r[0], tr.guide);
    affiliates = r[1] || {};
    (guide.featured_hotels || []).forEach(function (h) {
      featuredNos[h.hotel_no] = true;
      featuredImages[h.hotel_no] = h.image_urls || [];
      if (LANG !== "ja") featuredNames[h.hotel_no] = h.name;
    });
    renderAccess();
    renderParking();
    renderSpots();
    renderSpecialties();
    renderFood();
    renderStay();
    ["accessBody", "parkingBody", "spotsWalk", "spotsRide", "specialtyList", "foodBody", "featuredList", "spotsMore", "stayMore"].forEach(settle);
    return Promise.all([matchesP, indexP]);
  }).then(function (r) {
    var n = renderMatches(r[0].matches || [], r[1] || {});
    var updated = r[1] && r[1].meta && r[1].meta.updated_at;
    meta.textContent = T("meta_count", "これからのホーム戦 {0}試合", [n]) + (updated ? T("meta_updated", "／ ホテル情報の取得 {0} JST", [updated]) : "");
    var ids = list._openHotelIds || [];
    return Promise.all(ids.map(function (id) { return openHotelReady[id] || Promise.resolve(); }));
  }).then(function () {
    releaseMatchSpace();
  }).catch(function () {
    meta.textContent = T("load_error", "データを読み込めませんでした。時間をおいて開き直してください。");
    ["accessBody", "parkingBody", "spotsWalk", "spotsRide", "specialtyList", "foodBody", "featuredList", "spotsMore", "stayMore"].forEach(settle);
    releaseMatchSpace();
  });
})();
