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

  // 全角の英数字・空白を半角にそろえる（「ＫＯＫＯ　ＨＯＴＥＬ」→「KOKO HOTEL」）。名前が短くなり、途切れにくい
  function displayName(name) {
    var s = String(name || "");
    if (s.normalize) s = s.normalize("NFKC");
    return s.replace(/\s+/g, " ").trim();
  }
  function iso(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function addDays(isoDate, n) {
    var d = new Date(isoDate + "T00:00:00");
    d.setDate(d.getDate() + n);
    return iso(d);
  }
  function nearLabel(h, stationName) {
    if (h.area !== "stadium" && stationName && h.distance_km_from_station != null && h.distance_km_from_station <= 1) return stationName + "近く";
    if (h.stadium_proximity) return "スタジアム近く";
    return "";
  }

  function hotelCard(h, stationName) {
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
    var near = nearLabel(h, stationName);
    if (near) photo.append(el("span", "hotel-near", near));
    box.append(photo);

    var text = el("div", "hotel-text");
    var name = el("p", "hotel-name", displayName(h.hotel_name));
    name.title = h.hotel_name;
    text.append(name);
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
    // 拠点駅（東京駅など）の周りの宿は、スタジアムまでの距離を出すと遠すぎて紛らわしいので、駅までだけにする
    var farFromStadium = h.area === "station" && h.distance_km_from_stadium != null && h.distance_km_from_stadium > 5;
    if (h.distance_km_from_stadium != null && !farFromStadium) sub.append(el("span", null, "スタジアムまで" + h.distance_km_from_stadium + "km"));
    if (stationName && h.area !== "stadium" && h.distance_km_from_station != null) sub.append(el("span", null, stationName + "まで" + h.distance_km_from_station + "km"));
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

  var rowSeq = 0;

  // 横に流す1列。続きがあることを文字と（マウス操作の画面では）矢印ボタンで示す
  function hotelRow(hotels, label, stationName) {
    var wrap = el("div", "h-row");
    var ul = el("ul", "hotels");
    ul.id = "hotels-" + (++rowSeq);
    ul.setAttribute("aria-label", label + "の候補 " + hotels.length + "件");
    hotels.forEach(function (h) { ul.append(hotelCard(h, stationName)); });
    if (hotels.length > 1) {
      [["prev", "前の宿", "M15 18l-6-6 6-6"], ["next", "次の宿", "M9 18l6-6-6-6"]].forEach(function (b) {
        var btn = el("button", "h-arrow h-arrow-" + b[0]);
        btn.type = "button";
        btn.setAttribute("aria-label", label + "：" + b[1]);
        btn.setAttribute("aria-controls", ul.id);
        btn.append(icon(b[2]));
        btn.addEventListener("click", function () {
          ul.scrollBy({ left: (b[0] === "next" ? 1 : -1) * ul.clientWidth * 0.8, behavior: document.documentElement.dataset.motion === "off" ? "auto" : "smooth" });
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

  function night(label, checkin, hotels, stationName) {
    var sec = el("section", "night");
    var head = el("div", "night-head");
    var h = el("h4", "night-title", label);
    head.append(h);
    if (checkin) head.append(el("span", "night-date", md(checkin) + " チェックイン"));
    if (hotels.length > 1) head.append(el("span", "night-hint", hotels.length + "件・スワイプで他の宿 →"));
    sec.append(head);
    if (!hotels.length) {
      sec.append(el("p", "h-empty", "取得時点では条件に合う空室が見つかりませんでした。"));
    } else {
      sec.append(hotelRow(hotels, label, stationName));
    }
    return sec;
  }

  function renderHotels(box, doc) {
    var m = doc.meta || {};
    var station = m.station_name || "";
    box.textContent = "";
    box.append(night("前泊", m.checkin_date, doc.hotels || [], station));
    if (Array.isArray(doc.same_day_hotels)) {
      box.append(night("当日泊", m.same_day_checkin_date, doc.same_day_hotels, station));
    }
    box.append(el("p", "h-foot", "料金は取得時点で空室のあったプランの最安（2名1泊・税・サービス料込み）。取得 " + (m.updated_at || "") + " JST ／ 提供：楽天トラベル"));
  }

  // スタジアム周辺の地図（OpenStreetMap の埋め込み。キー不要、画面に入ってから読む）
  function stadiumMap(m) {
    var wrap = el("figure", "m-map");
    var lat = Number(m.latitude), lng = Number(m.longitude), dLat = 0.011, dLng = 0.015;
    var iframe = document.createElement("iframe");
    iframe.src = "https://www.openstreetmap.org/export/embed.html?bbox=" +
      [lng - dLng, lat - dLat, lng + dLng, lat + dLat].map(function (n) { return n.toFixed(5); }).join("%2C") +
      "&layer=mapnik&marker=" + lat.toFixed(5) + "%2C" + lng.toFixed(5);
    iframe.title = m.venue_name + " 周辺の地図";
    iframe.loading = "lazy";
    iframe.referrerPolicy = "no-referrer-when-downgrade";
    wrap.append(iframe);
    var cap = el("figcaption", "m-map-cap");
    var big = safeLink("https://www.google.com/maps/search/?api=1&query=" + lat + "%2C" + lng, null);
    big.textContent = "大きな地図で見る（Googleマップ）";
    cap.append(big);
    wrap.append(cap);
    return wrap;
  }

  // 周辺のグルメを地図で一発検索。スタジアムの周りと、駅（泊まる駅があればそこ、無ければ最寄り駅）の周り
  var FOOD_WORDS = ["グルメ", "ラーメン", "居酒屋", "カフェ"];
  function foodLinks(m) {
    var box = el("div", "m-food");
    box.append(el("h3", "m-food-title", "周辺のごはんを探す"));
    var places = [];
    if (m.latitude != null) places.push(["スタジアム周辺", m.latitude, m.longitude]);
    var stName = m.hub_name || m.station_name;
    var stLat = m.hub_name ? m.hub_latitude : m.station_latitude;
    var stLng = m.hub_name ? m.hub_longitude : m.station_longitude;
    if (stName && stLat != null) places.push([stName + "周辺", stLat, stLng]);
    places.forEach(function (p) {
      var row = el("div", "m-food-row");
      row.append(el("span", "m-food-place", p[0]));
      var ul = el("ul", "m-food-list");
      FOOD_WORDS.forEach(function (w) {
        var a = safeLink("https://www.google.com/maps/search/" + encodeURIComponent(w) + "/@" + Number(p[1]).toFixed(5) + "," + Number(p[2]).toFixed(5) + ",16z", "m-chip");
        a.textContent = w;
        a.setAttribute("aria-label", p[0] + "の" + w + "をGoogleマップで探す");
        var li = el("li");
        li.append(a);
        ul.append(li);
      });
      row.append(ul);
      box.append(row);
    });
    var city = (m.city || "").replace(/^(東京都|北海道|(?:京都|大阪)府|.{2,3}県)/, "");
    if (city) {
      var local = safeLink("https://www.google.com/search?q=" + encodeURIComponent(city + " ご当地グルメ"), "m-food-local");
      local.textContent = city + "のご当地グルメを調べる";
      var p2 = el("p", "m-food-more");
      p2.append(local);
      box.append(p2);
    }
    return box;
  }

  function renderMatch(m) {
    var li = el("li", "away-match" + (m.competition === "LEV" ? " is-lev" : ""));
    li.id = m.match_id;
    var article = el("article");
    article.setAttribute("aria-labelledby", m.match_id + "-title");

    // 試合ごとに開け閉めする（details / summary）。中身は開いたときに組み立てる
    var details = el("details", "m-details");
    var head = el("summary", "m-head");
    head.append(el("span", "m-comp", m.competition_label + "　" + m.round));
    var title = el("h2", "m-title");
    title.id = m.match_id + "-title";
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
    details.addEventListener("toggle", function () {
      if (details.open && !details.dataset.built) {
        details.dataset.built = "1";
        details.append(matchBody(m));
      }
    });
    li.append(article);
    li.openMatch = function () {
      details.open = true;
    };
    return li;
  }

  function matchBody(m) {

    var body = el("div", "m-body");
    var facts = el("dl", "m-facts");
    facts.append(el("dt", null, "スタジアム"));
    var venue = el("dd", null, m.venue_name);
    if (m.city) { venue.append(document.createTextNode(" ")); venue.append(el("span", "m-city", m.city)); }
    facts.append(venue);
    if (m.station || m.access_note) {
      facts.append(el("dt", null, "アクセス"));
      facts.append(el("dd", null, m.access_note || m.station));
    }
    if (m.hub_name) {
      facts.append(el("dt", null, "泊まるなら"));
      var hub = el("dd", null, m.hub_name + "周辺");
      if (m.hub_note) { hub.append(document.createTextNode(" ")); hub.append(el("span", "m-city", "（" + m.hub_note + "）")); }
      facts.append(hub);
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

    if (m.latitude != null) body.append(stadiumMap(m));
    body.append(foodLinks(m));

    var hh = el("div", "h-head");
    var ht = el("h3", "h-title", "ホテル");
    ht.append(prTag());
    hh.append(ht);
    hh.append(el("span", "h-cond", "2名・スタジアムから3km／" + (m.hub_name || m.station_name || "最寄り駅") + "から1km・安い順"));
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
    return body;
  }

  function scrollBehavior() {
    return document.documentElement.dataset.motion === "off" ? "auto" : "smooth";
  }

  function openAndGo(id, scroll) {
    var li = document.getElementById(id);
    if (!li || !li.openMatch) return;
    li.openMatch();
    if (scroll) li.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
  }

  function renderJump(matches) {
    var links = {};
    matches.forEach(function (m) {
      var li = el("li");
      var a = el("a");
      a.href = "#" + m.match_id;
      a.append(el("span", "away-jump-date", m.match_date ? shortMd(m.match_date) : (m.date_candidates.length ? shortMd(m.date_candidates[0]) + "〜" : "未定")));
      a.append(el("span", "away-jump-opp", m.opponent));
      a.addEventListener("click", function (e) {
        e.preventDefault();
        openAndGo(m.match_id, true);
        try { history.replaceState(null, "", "#" + m.match_id); } catch (err) {}
      });
      links[m.match_id] = a;
      li.append(a);
      jump.append(li);
    });
    if (matches.length > 1) jump.parentNode.hidden = false;

    // いま見ている試合（見出しが帯のすぐ下を過ぎた最後の試合。無ければ先頭）を、帯の中で濃く示す
    var current = null;
    var ticking = false;
    function update() {
      ticking = false;
      var id = matches[0].match_id;
      matches.forEach(function (m) {
        var li = document.getElementById(m.match_id);
        if (li && li.getBoundingClientRect().top <= 110) id = m.match_id;
      });
      var a = links[id];
      if (!a || a === current) return;
      if (current) current.removeAttribute("aria-current");
      a.setAttribute("aria-current", "true");
      current = a;
      jump.scrollTo({ left: Math.max(0, a.offsetLeft - jump.clientWidth / 2 + a.clientWidth / 2), behavior: scrollBehavior() });
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  getJson("data/affiliates.json?v=996953b2").catch(function () { return {}; }).then(function (a) {
    affiliates = a || {};
    return getJson("data/away-guide.json?v=ef9d3b4a");
  }).then(function (doc) {
    // 終わった試合は出さない（日付は日本時間。未定は候補日の最後で判断）
    var today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    var upcoming = doc.matches.filter(function (m) {
      var last = m.match_date || (m.date_candidates.length ? m.date_candidates[m.date_candidates.length - 1] : "9999-12-31");
      return last >= today;
    });
    upcoming.forEach(function (m) { list.append(renderMatch(m)); });
    renderJump(upcoming);
    // 直近の試合は最初から開く。URL に #試合ID があればその試合も開く
    if (upcoming.length) openAndGo(upcoming[0].match_id, false);
    var hash = (location.hash || "").slice(1);
    if (hash && document.getElementById(hash)) openAndGo(hash, true);
    meta.textContent = "これからの国内アウェイ " + upcoming.length + "試合" + (doc.meta.hotels_updated_at ? "／ ホテル情報の取得 " + doc.meta.hotels_updated_at + " JST" : "／ ホテル情報は取得前");
  }).catch(function () {
    meta.textContent = "データを読み込めませんでした。時間をおいて開き直してください。";
  });
})();
