/* 過密日程カレンダー
 *
 * 目的
 *   2026/27シーズンの全日を縦1本に並べ、前後の試合の間隔（中n日）で日を色分けする。
 *
 * 読むデータ
 *   data/matches.json（年間スケジュールと同じ正本。複製は持たない）
 *
 * 間隔の決め方
 *   試合が無い日が連続する区間を1つの「間隔」として扱い、その長さをそのまま中n日にする。
 *   中n日 = 次の試合日 − 前の試合日 − 1 と同じ値になり、描いた試合日と必ず一致する。
 *
 * 仕様は docs/dense-schedule-calendar.md を正とする。
 */

(function () {
  "use strict";

  // 年間スケジュールと同じ正本を読む。
  // ?v= は tools/asset-versions.mjs が matches.json の内容ハッシュへ書き換える。
  var DATA_URLS = ["data/matches.json?v=e096ee41"];

  var WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

  // 「今日」は端末のタイムゾーンではなく日本時間で決める。
  // 日程がJSTなので、遠征先の時計で見ても暦とずれない。
  // sv-SE ロケールは YYYY-MM-DD を返すので、そのまま日付キーとして使える。
  var TODAY_KEY = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
  // 「今日」へ飛ぶための着地点。同じ日に箱が複数出ても、idは最初の1つだけに付ける。
  var todayAnchorUsed = false;

  // 内閣府「国民の祝日について」令和8年（2026年）・令和9年（2027年）
  // https://www8.cao.go.jp/chosei/shukujitsu/gaiyou.html （2026-09-08確認）
  // 「休日」（祝日法第3条第2項・第3項）を含む。
  var HOLIDAYS = new Set([
    "2026-01-01", "2026-01-12", "2026-02-11", "2026-02-23", "2026-03-20",
    "2026-04-29", "2026-05-03", "2026-05-04", "2026-05-05", "2026-05-06",
    "2026-07-20", "2026-08-11", "2026-09-21", "2026-09-22", "2026-09-23",
    "2026-10-12", "2026-11-03", "2026-11-23",
    "2027-01-01", "2027-01-11", "2027-02-11", "2027-02-23", "2027-03-21",
    "2027-03-22", "2027-04-29", "2027-05-03", "2027-05-04", "2027-05-05",
    "2027-07-19", "2027-08-11", "2027-09-20", "2027-09-23", "2027-10-11",
    "2027-11-03", "2027-11-23"
  ]);

  // 大会。ラベルは年間スケジュールの大会リボン（app.js の getCompetitionBadgeText）に合わせる。
  var COMPETITIONS = {
    J1: { label: "J1", cls: "comp-j1", color: "#7b0064" },
    ACL: { label: "ACL", cls: "comp-acl", color: "#116b66" },
    EMP: { label: "天皇杯", cls: "comp-emp", color: "#8a6212" },
    LEV: { label: "ルヴァン", cls: "comp-lev", color: "#b2165b" },
    FRI: { label: "TM", cls: "comp-fri", color: "#546e7a" }
  };

  var BANDS = [
    { max: 2, cls: "band-danger", color: "#c8402e", dark: true },
    { max: 3, cls: "band-caution", color: "#e08a2e", dark: false },
    { max: 4, cls: "band-mild", color: "#e3b23c", dark: false },
    { max: 13, cls: "band-safe", color: "#7fa687", dark: false },
    // 中14日以上は中断期間。中6日と同じ緑にすると「安全」の意味が薄れるため中立にする。
    { max: Infinity, cls: "band-break", color: "#edeae3", dark: false }
  ];
  var NEUTRAL = { cls: "band-neutral", color: "#edeae3", dark: false };
  var PAPER = "#fbfafc";

  var strip = document.getElementById("strip");
  var statusLine = document.getElementById("status");
  var monthNav = document.getElementById("monthNav");
  var minimap = document.getElementById("minimap");
  var minimapCanvas = document.getElementById("minimapCanvas");
  var minimapView = document.getElementById("minimapView");

  // =========================================================
  // 日付の道具
  // =========================================================

  function pad2(n) { return n < 10 ? "0" + n : String(n); }

  function keyOf(date) {
    return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate());
  }

  function parseKey(key) {
    var p = String(key).split("-");
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function isValidKey(key) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(key || ""));
  }

  // =========================================================
  // 試合日の組み立て
  // =========================================================

  // 日付が確定していない試合は、候補日すべてに枠だけの箱を置く。
  // 候補日も「試合が入りうる日」として間隔の計算に入れ、その前後は暫定として斜線を掛ける。
  function buildMatchDays(matches) {
    var byDate = new Map();
    matches.forEach(function (match) {
      if (match.is_visible === false) return;
      var candidates = Array.isArray(match.date_candidates) ? match.date_candidates : [];
      var dates = isValidKey(match.match_date) ? [match.match_date] : candidates.filter(isValidKey);
      if (!dates.length) return;
      var isCandidate = !isValidKey(match.match_date);
      dates.forEach(function (date, index) {
        if (!byDate.has(date)) byDate.set(date, []);
        byDate.get(date).push({
          match: match,
          isCandidate: isCandidate,
          candidateIndex: index,
          candidateCount: dates.length,
          isTentative: match.status !== "confirmed" || isCandidate
        });
      });
    });
    return byDate;
  }

  // シーズンの表示範囲。最初の試合の月初から、最後の試合の月末まで。
  function seasonRange(dateKeys) {
    var sorted = dateKeys.slice().sort();
    var first = parseKey(sorted[0]);
    var last = parseKey(sorted[sorted.length - 1]);
    return {
      start: new Date(first.getFullYear(), first.getMonth(), 1),
      end: new Date(last.getFullYear(), last.getMonth() + 1, 0)
    };
  }

  // 全日を並べ、試合が無い日の連続を1つの間隔としてまとめる。
  function buildDays(range, matchDays) {
    var days = [];
    for (var d = new Date(range.start); d <= range.end; d.setDate(d.getDate() + 1)) {
      var key = keyOf(d);
      days.push({
        date: new Date(d),
        key: key,
        entries: matchDays.get(key) || null
      });
    }

    var runStart = -1;
    for (var i = 0; i <= days.length; i++) {
      var isMatch = i < days.length && days[i].entries;
      if (!isMatch && i < days.length) {
        if (runStart < 0) runStart = i;
        continue;
      }
      if (runStart < 0) continue;

      var before = runStart > 0 ? days[runStart - 1] : null;
      var after = i < days.length ? days[i] : null;
      var rest = i - runStart;
      // 前後どちらかに試合が無い区間（シーズン前後）は中立にする。
      var band = (before && after) ? bandFor(rest) : NEUTRAL;
      var provisional = Boolean(band !== NEUTRAL && (hasTentative(before) || hasTentative(after)));

      for (var j = runStart; j < i; j++) {
        days[j].band = band;
        days[j].provisional = provisional;
        days[j].rest = band === NEUTRAL ? null : rest;
        days[j].runHead = j === runStart;
      }
      runStart = -1;
    }

    // 試合日が続いた（中0日）ときは間に日が無いので、後ろの試合日側に印を付ける。
    // 土日どちらかという候補日は同じ試合が2日並ぶだけなので、中0日には数えない。
    for (var k = 1; k < days.length; k++) {
      if (!days[k].entries || !days[k - 1].entries) continue;
      var previousIds = new Set(days[k - 1].entries.map(function (entry) { return entry.match.id; }));
      var sameMatch = days[k].entries.some(function (entry) { return previousIds.has(entry.match.id); });
      if (!sameMatch) days[k].backToBack = true;
    }
    return days;
  }

  function hasTentative(day) {
    if (!day || !day.entries) return false;
    return day.entries.some(function (entry) { return entry.isTentative; });
  }

  function bandFor(rest) {
    for (var i = 0; i < BANDS.length; i++) {
      if (rest <= BANDS[i].max) return BANDS[i];
    }
    return BANDS[BANDS.length - 1];
  }

  function competitionOf(match) {
    return COMPETITIONS[String(match.competition || "").trim()] || null;
  }

  // =========================================================
  // スクロール
  // =========================================================

  // ブラウザ標準の behavior:"smooth" は速度カーブを変えられない。
  // 最後にゆっくり減速して止まる余韻がほしいので、自前で動かす。
  // 距離が長いほど少しだけ長くかけるが、上限は1.1秒。
  var scrollAnimation = null;

  function stopScrollAnimation() {
    if (scrollAnimation === null) return;
    cancelAnimationFrame(scrollAnimation);
    scrollAnimation = null;
    window.removeEventListener("wheel", stopScrollAnimation);
    window.removeEventListener("touchstart", stopScrollAnimation);
    window.removeEventListener("keydown", stopScrollAnimation);
  }

  function prefersNoMotion() {
    if (document.documentElement.dataset.motion === "off") return true;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function scrollToY(target, smooth) {
    stopScrollAnimation();
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var to = clamp(target, 0, Math.max(0, max));
    if (!smooth || prefersNoMotion()) {
      window.scrollTo(0, to);
      return;
    }

    var from = window.scrollY;
    var distance = to - from;
    if (Math.abs(distance) < 2) return;
    var duration = clamp(320 + Math.abs(distance) * 0.45, 420, 2000);
    var start = performance.now();

    // easeInOutCubic。ゆっくり出て、中盤で距離を稼ぎ、終盤に引いて止まる。
    // 片側だけの easeOutCubic は最初のフレームが最速なので、長い移動だと
    // 出だしが一瞬で流れ、減速しているのかどうか読み取れなかった。両側にすると
    // 加速と減速の対比が出て、止まり際が余韻として見える。
    // 5乗（easeOutQuint）も試したが、半分の時間で97%進み、残りが這うだけになる。
    function ease(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    // 途中で利用者が動かしたら、そちらを優先して止める。
    window.addEventListener("wheel", stopScrollAnimation, { passive: true });
    window.addEventListener("touchstart", stopScrollAnimation, { passive: true });
    window.addEventListener("keydown", stopScrollAnimation);

    function step(now) {
      var t = Math.min(1, (now - start) / duration);
      window.scrollTo(0, from + distance * ease(t));
      if (t < 1) {
        scrollAnimation = requestAnimationFrame(step);
        return;
      }
      stopScrollAnimation();
    }
    scrollAnimation = requestAnimationFrame(step);
  }

  // 貼り付く月見出しの下に着地させる
  var STICKY_OFFSET = 36;

  function scrollToElement(element, smooth) {
    if (!element) return;
    scrollToY(element.getBoundingClientRect().top + window.scrollY - STICKY_OFFSET, smooth);
  }

  // =========================================================
  // 描画
  // =========================================================

  function weekdayBadge(date, key) {
    var wd = date.getDay();
    var span = document.createElement("span");
    span.className = "badge " + (wd === 0 || HOLIDAYS.has(key) ? "wd-hol" : wd === 6 ? "wd-sat" : "wd-plain");
    span.textContent = WEEKDAYS[wd];
    return span;
  }

  function createDayBox(day) {
    var li = document.createElement("li");
    var band = day.band || NEUTRAL;
    li.className = "day " + band.cls + (band.dark ? " on-dark" : "") + (day.provisional ? " is-provisional" : "");

    var num = document.createElement("span");
    num.className = "d-num";
    num.textContent = day.date.getDate();

    var fill = document.createElement("span");
    fill.className = "d-fill";

    li.append(num, weekdayBadge(day.date, day.key));
    if (day.key === TODAY_KEY) {
      li.classList.add("is-today");
      if (!todayAnchorUsed) { li.id = "today"; todayAnchorUsed = true; }
      li.append(todayChip());
    }
    li.append(fill);

    // 色だけに頼らないよう、間隔の先頭には中n日を文字でも出す。
    if (day.runHead && day.rest !== null) {
      var label = document.createElement("span");
      label.className = "gap-label";
      label.textContent = "中" + day.rest + "日";
      li.append(label);
    }
    return li;
  }

  function createMatchBox(day, entry) {
    var match = entry.match;
    var comp = competitionOf(match);
    var li = document.createElement("li");
    li.className = "day match " + (comp ? comp.cls : "comp-j1") +
      (entry.isCandidate ? " is-candidate" : " on-dark");

    var num = document.createElement("span");
    num.className = "d-num";
    num.textContent = day.date.getDate();

    var opponent = document.createElement("span");
    opponent.className = "m-opp";
    opponent.textContent = "vs " + (match.opponent || "未定");

    var fill = document.createElement("span");
    fill.className = "d-fill";

    li.append(num, weekdayBadge(day.date, day.key), opponent);

    if (match.home_away === "H" || match.home_away === "A") {
      var ha = document.createElement("span");
      ha.className = "badge " + (match.home_away === "H" ? "ha-h" : "ha-a");
      ha.textContent = match.home_away;
      li.append(ha);
    }
    li.append(fill);

    if (day.key === TODAY_KEY) {
      li.classList.add("is-today");
      if (!todayAnchorUsed) { li.id = "today"; todayAnchorUsed = true; }
      li.append(todayChip());
    }
    if (entry.isCandidate) {
      li.append(chip("候補" + (entry.candidateIndex + 1) + "/" + entry.candidateCount));
    }
    if (day.backToBack && entry.candidateIndex === 0) {
      li.append(chip("中0日"));
    }
    if (comp) {
      var pill = document.createElement("span");
      pill.className = "comp-pill";
      pill.textContent = comp.label;
      li.append(pill);
    }

    // 一覧では落としている節・会場・キックオフを読み上げへ回す。
    var detail = document.createElement("span");
    detail.className = "sr-only";
    detail.textContent = [
      match.round || "",
      match.home_away_label || "",
      match.venue || "",
      match.kickoff_time || "",
      match.status === "confirmed" ? "" : "日程未確定"
    ].filter(Boolean).join(" ");
    li.append(detail);

    return li;
  }

  // 「今日」の印。色だけに頼らないよう、枠線と一緒に文字も出す。
  function todayChip() {
    var span = document.createElement("span");
    span.className = "today-chip";
    span.textContent = "今日";
    return span;
  }

  function chip(text) {
    var span = document.createElement("span");
    span.className = "m-chip";
    span.textContent = text;
    return span;
  }

  function monthSummary(monthDays) {
    // 候補日は同じ試合が複数日に出るため、試合数は試合IDで数える。
    var matchIds = new Set();
    var shortest = null;
    monthDays.forEach(function (day) {
      if (day.entries) {
        day.entries.forEach(function (entry) { matchIds.add(entry.match.id); });
      }
      if (day.rest !== null && day.rest !== undefined && (shortest === null || day.rest < shortest)) {
        shortest = day.rest;
      }
    });
    var matchCount = matchIds.size;
    var span = document.createElement("span");
    span.className = "month-sum";
    if (!matchCount) {
      span.textContent = "試合なし";
      return span;
    }
    span.append(document.createTextNode("試合" + matchCount));
    if (shortest !== null) {
      span.append(document.createTextNode("・最短 "));
      var value = document.createElement(shortest <= 2 ? "b" : "span");
      value.textContent = "中" + shortest + "日";
      span.append(value);
    }
    return span;
  }

  function render(days) {
    var fragment = document.createDocumentFragment();
    var navFragment = document.createDocumentFragment();
    var current = null;
    var monthDays = [];
    var monthList = null;

    function closeMonth() {
      if (!current) return;
      current.head.append(monthSummary(monthDays));
    }

    days.forEach(function (day) {
      var monthKey = day.date.getFullYear() + "-" + pad2(day.date.getMonth() + 1);
      if (!current || current.key !== monthKey) {
        closeMonth();
        var section = document.createElement("section");
        section.className = "month";
        section.id = "m-" + monthKey;

        var head = document.createElement("h2");
        head.className = "month-head";
        var year = document.createElement("span");
        year.className = "month-year";
        year.textContent = day.date.getFullYear();
        head.append(year, document.createTextNode((day.date.getMonth() + 1) + "月"));

        monthList = document.createElement("ol");
        monthList.className = "days";
        section.append(head, monthList);
        fragment.append(section);

        var navItem = document.createElement("li");
        var navLink = document.createElement("a");
        navLink.href = "#m-" + monthKey;
        navLink.textContent = (day.date.getMonth() + 1) + "月";
        navItem.append(navLink);
        navFragment.append(navItem);

        current = { key: monthKey, head: head };
        monthDays = [];
      }
      monthDays.push(day);

      if (day.entries) {
        day.entries.forEach(function (entry) {
          monthList.append(createMatchBox(day, entry));
        });
      } else {
        monthList.append(createDayBox(day));
      }
    });
    closeMonth();

    strip.replaceChildren(fragment);
    monthNav.replaceChildren(navFragment);

    // 「今日」はシーズンの中にいるときだけ出す。押したときだけ飛ぶ。
    // <a href="#today"> にしておけば、JavaScriptが動かない環境でも着地する。
    if (todayAnchorUsed) {
      var todayItem = document.createElement("li");
      var todayLink = document.createElement("a");
      todayLink.className = "is-today-link";
      todayLink.href = "#today";
      todayLink.textContent = "今日";
      todayItem.append(todayLink);
      monthNav.prepend(todayItem);
    }

    // 月と「今日」の移動は、標準のジャンプではなく減速つきで動かす。
    monthNav.addEventListener("click", function (event) {
      var link = event.target.closest("a");
      if (!link || event.metaKey || event.ctrlKey || event.shiftKey) return;
      var target = document.getElementById(link.getAttribute("href").slice(1));
      if (!target) return;
      event.preventDefault();
      scrollToElement(target, true);
    });
  }

  // =========================================================
  // ミニマップ
  // =========================================================

  // 1日1行の色帯。試合日は大会色、そうでない日は間隔の色をそのまま縮める。
  function minimapRows(days) {
    return days.map(function (day) {
      var isToday = day.key === TODAY_KEY;
      if (day.entries) {
        var entry = day.entries[0];
        var comp = competitionOf(entry.match);
        return {
          color: comp ? comp.color : COMPETITIONS.J1.color,
          alpha: entry.isCandidate ? 0.45 : 1,
          monthStart: day.date.getDate() === 1,
          isToday: isToday
        };
      }
      return {
        color: (day.band || NEUTRAL).color,
        alpha: 1,
        monthStart: day.date.getDate() === 1,
        isToday: isToday
      };
    });
  }

  function setupMinimap(days) {
    var rows = minimapRows(days);
    var context = minimapCanvas.getContext("2d");
    minimap.hidden = false;

    function draw() {
      var width = minimap.clientWidth;
      var height = minimap.clientHeight;
      if (!width || !height) return;
      var ratio = window.devicePixelRatio || 1;
      minimapCanvas.width = Math.round(width * ratio);
      minimapCanvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.fillStyle = PAPER;
      context.fillRect(0, 0, width, height);
      rows.forEach(function (row, index) {
        var top = Math.floor(index / rows.length * height);
        var bottom = Math.ceil((index + 1) / rows.length * height);
        context.globalAlpha = row.alpha;
        context.fillStyle = row.color;
        context.fillRect(0, top, width, Math.max(1, bottom - top));
        context.globalAlpha = 1;
        if (row.monthStart && index > 0) {
          context.fillStyle = "rgba(28,25,34,.35)";
          context.fillRect(0, top, width, 1);
        }
      });

      // 今日の位置。どの帯の色の上でも見えるよう、白で縁取ってから黒い線を引く。
      var todayIndex = rows.findIndex(function (row) { return row.isToday; });
      if (todayIndex >= 0) {
        var y = Math.floor(todayIndex / rows.length * height);
        context.fillStyle = "rgba(255,255,255,.9)";
        context.fillRect(0, y - 2, width, 5);
        context.fillStyle = "#1c1922";
        context.fillRect(0, y - 1, width, 2);
      }
    }

    function stripMetrics() {
      var rect = strip.getBoundingClientRect();
      return { top: rect.top + window.scrollY, height: rect.height };
    }

    function updateView() {
      var metrics = stripMetrics();
      var height = minimap.clientHeight;
      if (!metrics.height || !height) return;
      var start = clamp((window.scrollY - metrics.top) / metrics.height, 0, 1);
      var end = clamp((window.scrollY + window.innerHeight - metrics.top) / metrics.height, 0, 1);
      minimapView.style.top = (start * height) + "px";
      minimapView.style.height = Math.max(12, (end - start) * height) + "px";
    }

    function scrollToFraction(fraction, smooth) {
      var metrics = stripMetrics();
      scrollToY(metrics.top + fraction * metrics.height - window.innerHeight / 2, smooth);
    }

    function fractionAt(clientY) {
      var rect = minimap.getBoundingClientRect();
      return clamp((clientY - rect.top) / rect.height, 0, 1);
    }

    var pointerId = null;
    var startY = 0;
    var dragging = false;

    minimap.addEventListener("pointerdown", function (event) {
      pointerId = event.pointerId;
      startY = event.clientY;
      dragging = false;
      minimap.setPointerCapture(pointerId);
      event.preventDefault();
    });

    minimap.addEventListener("pointermove", function (event) {
      if (event.pointerId !== pointerId) return;
      if (!dragging && Math.abs(event.clientY - startY) < 5) return;
      dragging = true;
      scrollToFraction(fractionAt(event.clientY), false);
    });

    function endPointer(event) {
      if (event.pointerId !== pointerId) return;
      if (!dragging) scrollToFraction(fractionAt(event.clientY), true);
      if (minimap.hasPointerCapture(pointerId)) minimap.releasePointerCapture(pointerId);
      pointerId = null;
      dragging = false;
    }
    minimap.addEventListener("pointerup", endPointer);
    minimap.addEventListener("pointercancel", endPointer);

    window.addEventListener("scroll", updateView, { passive: true });
    window.addEventListener("resize", function () { draw(); updateView(); });

    draw();
    updateView();
  }

  function clamp(value, min, max) {
    return value < min ? min : value > max ? max : value;
  }

  // =========================================================
  // 「見かた」パネル
  // =========================================================

  // <dialog> の showModal に任せる。Esc・フォーカスの閉じ込め・閉じたあとの
  // フォーカス復帰は標準の挙動をそのまま使い、背面のスクロール止めだけ足す。
  function bindGuide() {
    var guide = document.getElementById("guide");
    var openButton = document.getElementById("guideOpen");
    var closeButton = document.getElementById("guideClose");
    if (!guide || !openButton || typeof guide.showModal !== "function") return;

    openButton.addEventListener("click", function () {
      document.documentElement.style.overflow = "hidden";
      guide.showModal();
    });
    if (closeButton) {
      closeButton.addEventListener("click", function () { guide.close(); });
    }
    // 背景（::backdrop）を押したときはダイアログ自身が対象になる
    guide.addEventListener("click", function (event) {
      if (event.target === guide) guide.close();
    });
    guide.addEventListener("close", function () {
      document.documentElement.style.overflow = "";
    });
  }

  bindGuide();

  // =========================================================
  // 読み込み
  // =========================================================

  function loadMatches() {
    return fetch(DATA_URLS[0]).then(function (response) {
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.json();
    });
  }

  loadMatches().then(function (data) {
    var matches = Array.isArray(data.matches) ? data.matches : [];
    var matchDays = buildMatchDays(matches);
    var keys = Array.from(matchDays.keys());
    if (!keys.length) throw new Error("日付を持つ試合がありません");

    var days = buildDays(seasonRange(keys), matchDays);
    render(days);
    setupMinimap(days);
  }).catch(function (error) {
    statusLine.hidden = false;
    statusLine.textContent = "日程を読み込めませんでした。時間をおいて開き直してください。";
    strip.replaceChildren(statusLine);
    console.warn("calendar:", error);
  });
})();
