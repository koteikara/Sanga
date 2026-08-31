/**
 * SUPPORTER TIMELINE
 *
 * 設計の正本は docs/supporter-timeline-design.md。
 * 検証用プロトタイプ（experiments/supporter-timeline/）から移したもので、
 * 違いは読むデータ（公開JSON）と、検証用の注意書き・作り物を持ち込まない点。
 *
 * 扱う要点。
 *   1. 「次にやること」と全体タイムラインを分ける
 *   2. date_precision による表示の出し分け（datetime / date / candidates / unknown）
 *   3. MY予定と公式イベントが同じ時系列に並ぶ（MY予定はこの端末のLocalStorageにだけ持つ）
 *   4. 確定した日時だけがICSへ出る
 *   5. プロフィール（会員種別・シーズンパス）による強調と並べ替え
 *   6. 特典チケットの残り枚数と引き換え予定の記録
 */(function () {
  "use strict";

  var EVENTS_URL = "data/calendar-events.json";
  var MATCHES_URL = "data/matches.json";
  var STORAGE_KEY = "sanga-timeline-personal-events-v1";
  var PROFILE_KEY = "sanga-timeline-profile-v1";
  var BENEFIT_KEY = "sanga-timeline-benefit-tickets-v1";
  var TOUR_KEY = "sanga-timeline-tour-v1";
  var BENEFIT_URL = "data/benefit-tickets.json";

  var WEEK = ["日", "月", "火", "水", "木", "金", "土"];

  var GRADE_LABEL = {
    platinum: "プラチナクルー",
    gold: "ゴールドクルー",
    regular: "レギュラークルー",
    kids: "キッズクルー",
    none: "会員ではない"
  };

  var TYPE_LABEL = {
    ticket: "チケット",
    entry: "応募",
    event: "イベント",
    goods: "グッズ",
    match: "試合",
    personal: "MY予定"
  };

  /**
   * 種別のイラスト。文字ラベルと併記し、アイコン自体は aria-hidden にする。
   * 読み上げでは文字が読まれ、目で見るときは形で種別が分かるようにするため。
   */
  var TYPE_ICON = {
    ticket: "M2 5.5h12v2a1.5 1.5 0 0 0 0 3v2H2v-2a1.5 1.5 0 0 0 0-3v-2z M9.5 6v1 M9.5 9v1 M9.5 12v1",
    entry: "M2 4h12v8H2z M2 4l6 4.5L14 4",
    event: "M3 2v12 M3 3h9l-2 2.5L12 8H3",
    goods: "M5 3l3 1.5L11 3l3 2-2 2v6H4V7L2 5z",
    match: "M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z M8 4.5l3 2.2-1.2 3.6H6.2L5 6.7z M8 1.5v3 M11 6.7l2.8-.9 M9.8 10.3l1.8 2.4 M6.2 10.3l-1.8 2.4 M5 6.7l-2.8-.9",
    personal: "M8 2.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z M2.5 14c0-3 2.5-5 5.5-5s5.5 2 5.5 5"
  };

  function createTypeIcon(type) {
    var path = TYPE_ICON[type];
    if (!path) return null;
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("class", "type-icon");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    path.split(" M").forEach(function (part, index) {
      var node = document.createElementNS("http://www.w3.org/2000/svg", "path");
      node.setAttribute("d", index === 0 ? part : "M" + part);
      svg.appendChild(node);
    });
    return svg;
  }

  var ACTION_LABEL = {
    action: "ACTION",
    information: "INFO",
    personal: "MY"
  };

  var SKIP_REASON = {
    image_only: "日程表が画像だけ",
    revision_history: "変更前と変更後が同じページに残っている",
    multiple_events: "1記事に複数のイベント",
    no_label: "日時に意味ラベルがない",
    date_inherited: "日付を記事全体から推論する必要がある"
  };

  var state = {
    events: [],
    skipped: [],
    matches: [],
    filter: "all",
    mineOnly: false,
    profile: null,
    benefit: null,
    benefitRule: null,
    awayTickets: []
  };

  /* ---------- 日時 ---------- */

  function parseDate(value) {
    if (!value) return null;
    var d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function dayKey(date) {
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
  }

  function formatDay(date) {
    var week = WEEK[date.getDay()];
    return (date.getMonth() + 1) + "月" + date.getDate() + "日（" + week + "）";
  }

  function formatTime(date) {
    return pad(date.getHours()) + ":" + pad(date.getMinutes());
  }

  function formatCandidates(list) {
    return list.map(function (value) {
      var d = parseDate(value + "T00:00:00+09:00");
      if (!d) return value;
      var week = WEEK[d.getDay()];
      return (d.getMonth() + 1) + "/" + d.getDate() + "(" + week + ")";
    }).join(" または ");
  }

  function untilText(date, now) {
    var diff = date.getTime() - now.getTime();
    if (diff <= 0) return "受付中または開始済み";
    var minutes = Math.floor(diff / 60000);
    if (minutes < 60) return "あと" + minutes + "分";
    var hours = Math.floor(minutes / 60);
    if (hours < 48) return "あと" + hours + "時間";
    return "あと" + Math.floor(hours / 24) + "日";
  }

  /* ---------- データ ---------- */

  function loadPersonal() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function savePersonal(list) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      return true;
    } catch (error) {
      return false;
    }
  }

  function normalizeProfile(value) {
    if (!value || typeof value !== "object") return null;
    var grade = typeof value.fc_grade === "string" ? value.fc_grade : "";
    if (grade && !Object.prototype.hasOwnProperty.call(GRADE_LABEL, grade)) grade = "";
    return {
      fc_grade: grade,
      has_season_ticket: value.has_season_ticket === true,
      updated_at: typeof value.updated_at === "string" ? value.updated_at : ""
    };
  }

  function loadProfile() {
    try {
      var raw = window.localStorage.getItem(PROFILE_KEY);
      return raw ? normalizeProfile(JSON.parse(raw)) : null;
    } catch (error) {
      return null;
    }
  }

  function saveProfile(profile) {
    try {
      window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      return true;
    } catch (error) {
      return false;
    }
  }

  function clearProfile() {
    try {
      window.localStorage.removeItem(PROFILE_KEY);
      return true;
    } catch (error) {
      return false;
    }
  }

  function hasProfile() {
    var p = state.profile;
    return !!(p && (p.fc_grade || p.has_season_ticket));
  }

  /**
   * イベントの audience と端末内のプロフィールを突き合わせる。
   * 照合はすべて端末内で行い、プロフィールをどこへも送らない。
   * audience に複数のキーがある場合は、いずれかを満たせば該当とする。
   * 戻り値は該当理由のラベル。該当しなければ空文字。
   */
  function profileMatch(event) {
    if (!hasProfile()) return "";
    var audience = event.audience;
    if (!audience || typeof audience !== "object") return "";
    if (audience.season_ticket === true && state.profile.has_season_ticket) {
      return "シーズンパス";
    }
    if (Array.isArray(audience.fc_grade) && state.profile.fc_grade &&
      audience.fc_grade.indexOf(state.profile.fc_grade) !== -1) {
      return "あなたのグレード";
    }
    return "";
  }

  /** audience が空または未指定なら全員向け。 */
  function isForEveryone(event) {
    var audience = event.audience;
    if (!audience || typeof audience !== "object") return true;
    return Object.keys(audience).length === 0;
  }

  var BENEFIT_REASON = {
    grant: { label: "会員特典として受け取った", sign: 1 },
    received: { label: "譲り受けた", sign: 1 },
    given: { label: "譲った", sign: -1 },
    correction_plus: { label: "数え直して増やした", sign: 1 },
    correction_minus: { label: "数え直して減らした", sign: -1 }
  };

  /**
   * 特典チケットの保有と引き換え先。
   * 枚数は1つの数ではなく増減の履歴で持つ。家族や友人と譲り合うことがあり、
   * 「なぜ増えたか・減ったか」が分からないと自分の記録を信用できなくなるため。
   * { changes: [{ id, count, reason, note, at }], uses: [{ match_id, count, status, updated_at }] }
   */
  function normalizeBenefit(value) {
    if (!value || typeof value !== "object") return null;

    var changes = [];
    if (Array.isArray(value.changes)) {
      value.changes.forEach(function (change) {
        if (!change || typeof change !== "object") return;
        var count = Number(change.count);
        if (!isFinite(count) || count === 0) return;
        var reason = Object.prototype.hasOwnProperty.call(BENEFIT_REASON, change.reason)
          ? change.reason
          : "correction_plus";
        changes.push({
          id: typeof change.id === "string" && change.id ? change.id : "chg-" + changes.length,
          count: Math.round(count),
          reason: reason,
          note: typeof change.note === "string" ? change.note.slice(0, 30) : "",
          // 譲り受けた特典は、譲った人のコースの枠でしか引き換えられない。
          // 誰のチケットかを持たないと、引換日時を突き合わせられない。
          source_grade: typeof change.source_grade === "string" &&
            Object.prototype.hasOwnProperty.call(GRADE_LABEL, change.source_grade) &&
            change.source_grade !== "none"
            ? change.source_grade
            : "",
          at: typeof change.at === "string" ? change.at : ""
        });
      });
    } else if (value.total !== undefined) {
      // 旧形式（total だけを持っていたもの）は、会員特典として受け取った1件に読み替える
      var total = Number(value.total);
      if (isFinite(total) && total > 0) {
        changes.push({
          id: "chg-initial",
          count: Math.floor(total),
          reason: "grant",
          note: "",
          at: typeof value.updated_at === "string" ? value.updated_at : ""
        });
      }
    }

    var uses = Array.isArray(value.uses) ? value.uses : [];
    var byMatch = {};
    var order = [];
    uses.forEach(function (use) {
      if (!use || typeof use.match_id !== "string" || !use.match_id) return;
      var count = Number(use.count);
      if (!isFinite(count) || count < 1) count = 1;
      var status = (use.status === "used" || use.status === "exchanged") ? "exchanged" : "planned";
      if (byMatch[use.match_id]) {
        byMatch[use.match_id].count += Math.floor(count);
        if (status === "exchanged") byMatch[use.match_id].status = "exchanged";
        return;
      }
      byMatch[use.match_id] = {
        match_id: use.match_id,
        count: Math.floor(count),
        status: status,
        updated_at: typeof use.updated_at === "string" ? use.updated_at : ""
      };
      order.push(use.match_id);
    });

    return {
      changes: changes,
      uses: order.map(function (id) { return byMatch[id]; }),
      updated_at: value.updated_at || ""
    };
  }

  function loadBenefit() {
    try {
      var raw = window.localStorage.getItem(BENEFIT_KEY);
      return raw ? normalizeBenefit(JSON.parse(raw)) : null;
    } catch (error) {
      return null;
    }
  }

  function saveBenefit(benefit) {
    try {
      window.localStorage.setItem(BENEFIT_KEY, JSON.stringify(benefit));
      state.benefit = normalizeBenefit(benefit);
      return true;
    } catch (error) {
      return false;
    }
  }

  function benefitState() {
    return state.benefit || { changes: [], uses: [], updated_at: "" };
  }

  /** 持っている枚数は増減の履歴の合計。 */
  function benefitTotal() {
    var total = 0;
    benefitState().changes.forEach(function (change) { total += change.count; });
    return total;
  }

  function benefitUseFor(matchId) {
    var found = null;
    benefitState().uses.forEach(function (use) {
      if (use.match_id === matchId) found = use;
    });
    return found;
  }

  function benefitCounts() {
    var b = benefitState();
    var planned = 0;
    var exchanged = 0;
    b.uses.forEach(function (use) {
      if (use.status === "exchanged") exchanged += use.count; else planned += use.count;
    });
    var total = benefitTotal();
    return { total: total, planned: planned, exchanged: exchanged, left: total - planned - exchanged };
  }

  /**
   * 持っている特典チケットのコード。引換の枠はチケットの持ち主のコースで決まるため、
   * 「自分のコース」ではなくこれで突き合わせる。
   *
   * 会員特典として受け取ったぶんと数え直しは自分のコース、譲り受けたぶんは
   * 記録した相手のコース。どちらも分からない場合は空を返し、呼び出し側で
   * 絞り込まない（安全側に倒す）。
   */
  function heldGrades() {
    var own = state.profile ? state.profile.fc_grade : "";
    var grades = {};
    benefitState().changes.forEach(function (change) {
      if (change.count <= 0) return;
      var grade = change.reason === "received" ? change.source_grade : own;
      if (grade && grade !== "none") grades[grade] = true;
    });
    return Object.keys(grades);
  }

  /** 会員種別ごとの配布枚数（公式）。分からない場合は0を返す。 */
  function ruleCountFor(grade) {
    if (!state.benefitRule || !grade) return 0;
    var found = 0;
    (state.benefitRule.courses || []).forEach(function (course) {
      if (course.course_id === grade && course.benefit_ticket) {
        found = Number(course.benefit_ticket.count) || 0;
      }
    });
    return found;
  }

  /** これから開催されるホーム戦。日程未定・候補日も引き換えられる機会として数える。 */
  function upcomingHomeMatches(now) {
    return state.matches.filter(function (match) {
      if (match.home_away !== "H") return false;
      if (!match.match_date) return true;
      return new Date(match.match_date + "T23:59:59+09:00").getTime() >= now.getTime();
    });
  }

  /** これからのホーム戦のうち、まだ1枚も充てていないもの。 */
  function openHomeMatches(now) {
    return upcomingHomeMatches(now).filter(function (match) {
      return !benefitUseFor(match.id);
    });
  }

  function allEvents() {
    return state.events.concat(loadPersonal());
  }

  function matchLabel(event) {
    var ids = Array.isArray(event.match_ids) ? event.match_ids : [];
    if (!ids.length) return "";
    var labels = ids.map(function (id) {
      var match = state.matches.find(function (m) { return m.id === id; });
      if (!match) return id;
      return match.round + " " + (match.opponent || "未定") + "戦";
    });
    return labels.join(" / ");
  }

  /**
   * 試合日。日付の見出し（この予定がいつ始まるか）と混同されないよう、
   * 「試合日」と明示し、書式も変える（見出しは「9月23日（水）」、ここは「10/10（土）」）。
   *
   * `match_date` は "2026-10-10" の形。new Date() に渡すとUTC扱いになり、
   * 端末のタイムゾーンによって前日に見えるため、数値に分けて組み立てる。
   */
  function matchDateLabel(event) {
    var ids = Array.isArray(event.match_ids) ? event.match_ids : [];
    // 複数試合をまとめたブロックでは、どの試合の日か言えないので出さない
    if (ids.length !== 1) return "";
    var match = state.matches.find(function (m) { return m.id === ids[0]; });
    if (!match) return "";
    if (!match.match_date) return "試合日未定";
    var parts = String(match.match_date).split("-");
    if (parts.length !== 3) return "";
    var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (isNaN(date.getTime())) return "";
    return "試合日 " + (date.getMonth() + 1) + "/" + date.getDate() +
      "（" + WEEK[date.getDay()] + "）";
  }

  /**
   * アウェイ席の販売状態。予定ではなく状態なので、時系列の札ではなく帯に出す。
   *
   * **載っていない試合には何も出さない。** Jリーグチケットに無い理由が、
   * 未発売なのか別のプレイガイドで売っているのか区別できないため、
   * 「発売前」とは言わない。
   */
  function awayTicketLabel(event) {
    var ids = Array.isArray(event.match_ids) ? event.match_ids : [];
    if (ids.length !== 1) return "";
    var found = null;
    state.awayTickets.forEach(function (item) {
      if (item && item.match_id === ids[0] && item.state === "on_sale") found = item;
    });
    if (!found) return "";
    return "アウェイ席 発売中" + (found.checked_at ? "（" + found.checked_at + "確認）" : "");
  }

  function matchesMine(event) {
    if (!state.mineOnly || !hasProfile()) return true;
    if (event.type === "personal") return true;
    return isForEveryone(event) || profileMatch(event) !== "";
  }

  function matchesFilter(event) {
    if (state.filter === "all") return true;
    if (state.filter === "personal") return event.type === "personal";
    if (state.filter === "matchday") return event.type === "event" || event.type === "match";
    return event.type === state.filter;
  }

  function isDated(event) {
    return event.date_precision === "datetime" || event.date_precision === "date";
  }

  /**
   * 特典チケットの引換は、引き換え予定を決めた試合のぶんだけカレンダーへ出す。
   * 引換は1試合に3件あり、全ホーム戦ぶんを入れると、使う予定のない予定で
   * カレンダーが埋まる。画面には引き続き全件出す（どの試合で使えるかを見るため）。
   */
  function isIcsTarget(event) {
    if (event.ticket_kind !== "benefit_exchange") return true;
    var matchId = (event.match_ids || [])[0];
    if (!matchId || !benefitUseFor(matchId)) return false;

    // 引換の枠は3つ（コース別）あるが、引き換えられるのは持っているチケットの枠だけ。
    // どのコースのチケットか分からないときは絞らず、3つとも出す。
    var held = heldGrades();
    var target = (event.audience || {}).fc_grade;
    if (!held.length || !Array.isArray(target)) return true;
    return target.some(function (grade) { return held.indexOf(grade) !== -1; });
  }

  /* ---------- 描画 ---------- */

  /**
   * 「次にやること」は画面下のドロワーに出す。
   * タイムラインが長いため、スクロール中でも直近の期限が見えているようにするため。
   * 閉じているときは1件目だけ、開くと直近5件まで見える。
   */
  function renderNext(list, now) {
    var lead = document.getElementById("next-lead");
    var box = document.getElementById("next-body");
    box.textContent = "";

    var upcoming = list
      .filter(function (e) { return e.action_type === "action" && isDated(e); })
      .map(function (e) { return { event: e, date: parseDate(e.starts_at) }; })
      .filter(function (item) { return item.date && item.date.getTime() >= now.getTime(); })
      .sort(function (a, b) { return a.date - b.date; });

    if (hasProfile()) {
      // 他グレードの先行販売は一覧には残るが、行動を促す位置には出さない
      upcoming = upcoming.filter(function (item) {
        return profileMatch(item.event) !== "" || isForEveryone(item.event) ||
          item.event.type === "personal";
      });
    }

    if (!upcoming.length) {
      lead.textContent = "直近の期限つきの予定はありません。";
      var none = document.createElement("p");
      none.className = "empty";
      none.textContent = "これから始まる販売や締切が出ると、ここに並びます。";
      box.appendChild(none);
      return;
    }

    var first = upcoming[0];
    lead.textContent = formatDay(first.date) + " " +
      (first.event.date_precision === "date" ? "時刻未定" : formatTime(first.date)) + " " +
      first.event.title + "（" + untilText(first.date, now) + "）";

    var ul = document.createElement("ul");
    ul.className = "drawer-list";
    upcoming.slice(0, 5).forEach(function (item) {
      var li = document.createElement("li");

      var when = document.createElement("p");
      when.className = "drawer-when";
      when.textContent = formatDay(item.date) + " " +
        (item.event.date_precision === "date" ? "時刻未定" : formatTime(item.date)) +
        " ・ " + untilText(item.date, now);

      var title = document.createElement("p");
      title.className = "drawer-item-title";
      title.textContent = item.event.title;

      li.append(when, title);

      var sub = [];
      var label = matchLabel(item.event);
      if (label) sub.push(label);
      var reason = profileMatch(item.event);
      if (reason) sub.push(reason + "が対象");
      if (sub.length) {
        var meta = document.createElement("p");
        meta.className = "drawer-meta";
        meta.textContent = sub.join(" ・ ");
        li.appendChild(meta);
      }

      ul.appendChild(li);
    });
    box.appendChild(ul);

    if (upcoming.length > 5) {
      var more = document.createElement("p");
      more.className = "drawer-meta";
      more.textContent = "ほか" + (upcoming.length - 5) + "件はタイムラインで見られます。";
      box.appendChild(more);
    }
  }

  function createEventNode(event, options) {
    var li = document.createElement("li");
    li.className = "event is-" + (event.action_type || "information");

    // 強調は色だけに依存させない。バッジの文字で理由を示す。
    var reason = profileMatch(event);
    if (reason) li.classList.add("is-mine");

    // 特典チケットの残りと使い道を、関係するイベントの上に出す。
    var benefitNote = "";
    var counts = benefitCounts();
    if (event.ticket_kind === "benefit_exchange" && reason && counts.total > 0) {
      benefitNote = "特典チケットは残り" + Math.max(counts.left, 0) + "枚";
    }
    var use = event.type === "match" && Array.isArray(event.match_ids) && event.match_ids.length
      ? benefitUseFor(event.match_ids[0])
      : null;
    if (use) {
      benefitNote = use.status === "exchanged"
        ? "特典チケットを" + use.count + "枚 引き換えた"
        : "特典チケットを" + use.count + "枚 引き換える予定";
      li.classList.add("is-benefit");
    }

    var top = document.createElement("div");
    top.className = "event-top";

    var time = document.createElement("span");
    time.className = "event-time";
    if (event.date_precision === "datetime") {
      time.textContent = formatTime(parseDate(event.starts_at));
    } else if (event.date_precision === "date") {
      time.textContent = "時刻未定";
    } else if (event.date_precision === "candidates") {
      time.textContent = formatCandidates(event.date_candidates || []);
    } else {
      time.textContent = "日程未定";
    }

    var tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = ACTION_LABEL[event.action_type] || "INFO";

    top.append(time, tag);

    if (reason) {
      var mine = document.createElement("span");
      mine.className = "badge-mine";
      mine.textContent = reason + "が対象";
      top.appendChild(mine);
    }

    if (benefitNote) {
      var benefitBadge = document.createElement("span");
      benefitBadge.className = "badge-benefit";
      benefitBadge.textContent = benefitNote;
      top.appendChild(benefitBadge);
    }

    var title = document.createElement("p");
    title.className = "event-title";
    // 見出しで試合名を出しているときは、題からも繰り返さない
    title.textContent = (options && options.hideMatch)
      ? event.title.replace(/^[^ ]+戦 /, "")
      : event.title;

    var meta = document.createElement("p");
    meta.className = "event-meta";

    var kind = document.createElement("span");
    kind.className = "event-kind";
    var icon = createTypeIcon(event.type);
    if (icon) kind.appendChild(icon);
    var kindText = document.createElement("span");
    kindText.textContent = TYPE_LABEL[event.type] || event.type;
    kind.appendChild(kindText);
    meta.appendChild(kind);

    var label = (options && options.hideMatch) ? "" : matchLabel(event);
    if (label) {
      var m = document.createElement("span");
      m.textContent = label;
      meta.appendChild(m);
    }

    if (event.status === "tentative") {
      var t = document.createElement("span");
      t.className = "note-tentative";
      t.textContent = "未確定";
      meta.appendChild(t);
    }

    if (event.source_url) {
      var link = document.createElement("a");
      link.href = event.source_url;
      link.target = "_blank";
      link.rel = "noopener";
      link.className = "event-source";
      // 出典は信頼のために必ず出すが、読む順としては最後。
      // 確認日は補足なので、小さく添える。
      link.appendChild(document.createTextNode("出典"));
      var checked = document.createElement("span");
      checked.className = "event-source-date";
      checked.textContent = "（" + (event.source_checked_at || "確認日不明") + "確認）";
      link.appendChild(checked);
      meta.appendChild(link);
    }

    li.append(top, title);

    // 同時刻に始まる関係イベント（先行販売と特典チケット引換）は1枚にまとめる
    if (options && options.companions && options.companions.length) {
      var also = document.createElement("p");
      also.className = "event-also";
      also.textContent = "同時に " + options.companions.map(function (e) {
        return e.title.replace(/^[^ ]+戦 /, "").replace(/\s*開始/, "");
      }).join("、") + " も始まります";
      li.appendChild(also);
    }

    li.appendChild(meta);

    if (options && options.removable) {
      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "btn-remove";
      remove.textContent = "削除";
      remove.addEventListener("click", function () {
        var kept = loadPersonal().filter(function (e) { return e.id !== event.id; });
        savePersonal(kept);
        render();
      });
      meta.appendChild(remove);
    }

    return li;
  }

  /** 同じ試合・同じ日時・同じ対象のチケットイベントを1枚にまとめる。 */
  function mergeSameMoment(items) {
    var groups = {};
    var order = [];
    items.forEach(function (item) {
      var event = item.event;
      var key = event.type === "ticket"
        ? [event.starts_at, (event.match_ids || []).join("+"), JSON.stringify(event.audience || {})].join("|")
        : "single-" + event.id;
      if (!groups[key]) {
        groups[key] = { date: item.date, event: event, companions: [] };
        order.push(key);
        return;
      }
      // 先行販売を主、特典チケット引換を従として並べる
      if (groups[key].event.ticket_kind === "benefit_exchange" && event.ticket_kind === "sale") {
        groups[key].companions.push(groups[key].event);
        groups[key].event = event;
      } else {
        groups[key].companions.push(event);
      }
    });
    return order.map(function (key) { return groups[key]; });
  }

  function appendDayGroups(root, groups, now) {
    var todayKey = dayKey(now);

    // 日ごと、その中で試合ごとにまとめる
    var days = [];
    var byDay = {};
    groups.forEach(function (group) {
      var key = dayKey(group.date);
      if (!byDay[key]) {
        byDay[key] = { key: key, date: group.date, blocks: [], byMatch: {} };
        days.push(byDay[key]);
      }
      var day = byDay[key];
      var matchKey = (group.event.match_ids || []).join("+");
      if (!day.byMatch[matchKey]) {
        day.byMatch[matchKey] = { matchKey: matchKey, label: matchLabel(group.event), items: [] };
        day.blocks.push(day.byMatch[matchKey]);
      }
      day.byMatch[matchKey].items.push(group);
    });

    days.forEach(function (day) {
      var node = document.createElement("div");
      node.className = "day";

      var label = document.createElement("p");
      label.className = "day-label";
      label.textContent = formatDay(day.date);

      // 試合名は白場の帯に出す。日によって出たり出なかったりすると規則が読めないため、
      // 1試合の日でも同じ形にする。
      if (day.key === todayKey) {
        var badge = document.createElement("span");
        badge.className = "today";
        badge.textContent = "今日";
        label.appendChild(badge);
      }
      node.appendChild(label);

      // 試合ブロックごとに白場（.block）で包む。札と札のあいだで背景を見せるため
      day.blocks.forEach(function (block) {
        var blockNode = document.createElement("div");
        blockNode.className = "block";
        if (block.label) {
          var head = document.createElement("p");
          head.className = "match-label";
          var name = document.createElement("span");
          name.className = "match-name";
          name.textContent = block.label;
          head.appendChild(name);
          var matchDate = matchDateLabel(block.items[0].event);
          if (matchDate) {
            var when = document.createElement("span");
            when.className = "match-date";
            when.textContent = matchDate;
            head.appendChild(when);
          }
          var away = awayTicketLabel(block.items[0].event);
          if (away) {
            var awayNode = document.createElement("span");
            awayNode.className = "match-away";
            awayNode.textContent = away;
            head.appendChild(awayNode);
          }
          blockNode.appendChild(head);
        }
        var listNode = document.createElement("ul");
        listNode.className = "events";
        block.items.forEach(function (group) {
          listNode.appendChild(createEventNode(group.event, {
            removable: group.event.source === "personal",
            companions: group.companions,
            hideMatch: !!block.matchKey
          }));
        });
        blockNode.appendChild(listNode);
        node.appendChild(blockNode);
      });

      root.appendChild(node);
    });
  }

  function monthKey(date) {
    return date.getFullYear() + "-" + pad(date.getMonth() + 1);
  }

  function formatMonth(date) {
    return date.getFullYear() + "年" + (date.getMonth() + 1) + "月";
  }

  /**
   * 月ごとに区切り、当月と翌月だけ開く。
   * 実データは9か月先まであり、全部を開いたままでは20,000pxを超えて読めないため。
   */
  function appendByMonth(root, groups, now) {
    var months = [];
    var byMonth = {};
    groups.forEach(function (group) {
      var key = monthKey(group.date);
      if (!byMonth[key]) {
        byMonth[key] = { key: key, date: group.date, items: [] };
        months.push(byMonth[key]);
      }
      byMonth[key].items.push(group);
    });

    var openKeys = {};
    openKeys[monthKey(now)] = true;
    openKeys[monthKey(new Date(now.getFullYear(), now.getMonth() + 1, 1))] = true;

    months.forEach(function (month, index) {
      if (openKeys[month.key] || index === 0) {
        var head = document.createElement("p");
        head.className = "month-label";
        head.textContent = formatMonth(month.date);
        root.appendChild(head);
        appendDayGroups(root, month.items, now);
        return;
      }
      var details = document.createElement("details");
      details.className = "month";
      var summary = document.createElement("summary");
      summary.textContent = formatMonth(month.date) + " " + month.items.length + "件";
      details.appendChild(summary);
      var box = document.createElement("div");
      details.appendChild(box);
      appendDayGroups(box, month.items, now);
      root.appendChild(details);
    });
  }

  function renderTimeline(list, now) {
    var root = document.getElementById("timeline");
    root.textContent = "";

    var dated = list
      .filter(isDated)
      .map(function (e) { return { event: e, date: parseDate(e.starts_at) }; })
      .filter(function (item) { return item.date; })
      .sort(function (a, b) {
        // 時系列を崩さない。同時刻のときだけ、自分に該当するものを先に出す。
        if (a.date - b.date !== 0) return a.date - b.date;
        var am = profileMatch(a.event) ? 0 : 1;
        var bm = profileMatch(b.event) ? 0 : 1;
        return am - bm;
      });

    if (!dated.length) {
      var none = document.createElement("p");
      none.className = "empty";
      none.textContent = "表示できる予定がありません。";
      root.appendChild(none);
      return;
    }

    // 終わったものは既定で畳む。開いたときに「いま何をすべきか」から始まるようにするため。
    var startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    var past = mergeSameMoment(dated.filter(function (item) {
      return item.date.getTime() < startOfToday;
    }));
    var rest = mergeSameMoment(dated.filter(function (item) {
      return item.date.getTime() >= startOfToday;
    }));

    if (past.length) {
      var details = document.createElement("details");
      details.className = "past";
      var summary = document.createElement("summary");
      summary.textContent = "終わったもの " + past.length + "件を表示する";
      details.appendChild(summary);
      var pastBox = document.createElement("div");
      details.appendChild(pastBox);
      appendDayGroups(pastBox, past, now);
      root.appendChild(details);
    }

    if (!rest.length) {
      var done = document.createElement("p");
      done.className = "empty";
      done.textContent = "これからの予定はありません。";
      root.appendChild(done);
      return;
    }

    appendByMonth(root, rest, now);
  }

  function renderUndated(list) {
    var root = document.getElementById("undated");
    root.textContent = "";

    var undated = list.filter(function (e) { return !isDated(e); });
    if (!undated.length) {
      var none = document.createElement("p");
      none.className = "empty";
      none.textContent = "日程未定の予定はありません。";
      root.appendChild(none);
      return;
    }

    var blockNode = document.createElement("div");
    blockNode.className = "block";
    var ul = document.createElement("ul");
    ul.className = "events";
    undated.forEach(function (event) { ul.appendChild(createEventNode(event, null)); });
    blockNode.appendChild(ul);
    root.appendChild(blockNode);
  }

  function renderSkipped() {
    var root = document.getElementById("skipped");
    root.textContent = "";
    if (!state.skipped.length) {
      var li = document.createElement("li");
      li.textContent = "取り込まなかった記事はありません。";
      root.appendChild(li);
      return;
    }
    state.skipped.forEach(function (item) {
      var li = document.createElement("li");
      var link = document.createElement("a");
      link.href = item.url;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = item.url;
      var reason = document.createElement("span");
      reason.className = "reason";
      reason.textContent = (SKIP_REASON[item.reason] || item.reason) +
        (item.found_at ? "・" + item.found_at + "に検知" : "");
      li.append(link, reason);
      root.appendChild(li);
    });
  }

  function renderMatchOptions() {
    var select = document.getElementById("my-match");
    state.matches.forEach(function (match) {
      if (!match.match_date) return;
      var option = document.createElement("option");
      option.value = match.id;
      option.textContent = match.round + " " + (match.opponent || "未定") + "戦（" + match.match_date + "）";
      select.appendChild(option);
    });
  }

  function matchTitle(match) {
    return match.round + " " + (match.opponent || "未定") + "戦" +
      (match.match_date ? "（" + match.match_date + "）"
        : (match.date_candidates && match.date_candidates.length
          ? "（" + formatCandidates(match.date_candidates) + "）"
          : "（日程未定）"));
  }

  function renderBenefitSummary(now) {
    var box = document.getElementById("benefit-summary");
    box.textContent = "";
    var counts = benefitCounts();

    if (!benefitState().changes.length && !counts.planned && !counts.exchanged) {
      var none = document.createElement("p");
      none.className = "empty";
      none.textContent = "枚数の増減を記録すると、残りと引き換え先の管理ができます。";
      box.appendChild(none);
      return;
    }

    var line = document.createElement("p");
    line.className = "benefit-count";
    line.textContent = "残り " + Math.max(counts.left, 0) + "枚";

    var detail = document.createElement("p");
    detail.className = "benefit-detail";
    detail.textContent = "持っている " + counts.total + "枚 ・ 引き換える予定 " + counts.planned +
      "枚 ・ 引き換えた " + counts.exchanged + "枚";
    box.append(line, detail);

    var upcoming = upcomingHomeMatches(now).length;
    var note = document.createElement("p");
    if (counts.left < 0) {
      note.className = "benefit-warn";
      note.textContent = "注意: 持っている枚数より多く割り当てています。枚数か割り当てを見直してください。";
    } else if (counts.left > upcoming) {
      note.className = "benefit-warn";
      note.textContent = "注意: 残り" + counts.left + "枚に対して、これからのホーム戦は" + upcoming +
        "試合です。1試合に複数枚まとめて引き換えないと、使わないまま残ります。";
    } else if (counts.left > 0) {
      note.className = "benefit-detail";
      note.textContent = "これからのホーム戦は" + upcoming + "試合あります。";
    } else {
      note.className = "benefit-detail";
      note.textContent = "残りはありません。";
    }
    box.appendChild(note);

    if (state.benefitRule && state.benefitRule.normal_ticket_rule) {
      var rule = state.benefitRule.normal_ticket_rule;
      var terms = document.createElement("p");
      terms.className = "benefit-detail";
      var parts = [rule.validity_official_text];
      (rule.restrictions || []).forEach(function (item) { parts.push(item); });
      terms.textContent = parts.join("。") + "。";
      box.appendChild(terms);
    }
  }

  function renderBenefitList() {
    var root = document.getElementById("benefit-list");
    root.textContent = "";
    var uses = benefitState().uses.slice().sort(function (a, b) {
      return a.match_id < b.match_id ? -1 : 1;
    });

    if (!uses.length) {
      var li = document.createElement("li");
      li.className = "empty";
      li.textContent = "まだ記録がありません。";
      root.appendChild(li);
      return;
    }

    uses.forEach(function (use) {
      var match = state.matches.find(function (m) { return m.id === use.match_id; });
      var li = document.createElement("li");
      li.className = "benefit-item is-" + use.status;

      var name = document.createElement("p");
      name.className = "benefit-item-title";
      name.textContent = (match ? matchTitle(match) : use.match_id) + " " + use.count + "枚";

      var tag = document.createElement("span");
      tag.className = "benefit-tag";
      tag.textContent = use.status === "exchanged" ? "引き換えた" : "引き換える予定";
      name.appendChild(tag);

      var actions = document.createElement("p");
      actions.className = "benefit-actions";

      if (use.status === "planned") {
        var done = document.createElement("button");
        done.type = "button";
        done.className = "btn-remove";
        done.textContent = "引き換えた";
        done.addEventListener("click", function () { setBenefitStatus(use.match_id, "exchanged"); });
        actions.appendChild(done);
      } else {
        var back = document.createElement("button");
        back.type = "button";
        back.className = "btn-remove";
        back.textContent = "予定に戻す";
        back.addEventListener("click", function () { setBenefitStatus(use.match_id, "planned"); });
        actions.appendChild(back);
      }

      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "btn-remove";
      remove.textContent = "記録を消す";
      remove.addEventListener("click", function () { removeBenefitUse(use.match_id); });
      actions.appendChild(remove);

      li.append(name, actions);
      root.appendChild(li);
    });
  }

  function renderBenefitChanges() {
    var root = document.getElementById("benefit-changes");
    root.textContent = "";
    var changes = benefitState().changes;

    if (!changes.length) {
      var li = document.createElement("li");
      li.className = "empty";
      li.textContent = "まだ記録がありません。";
      root.appendChild(li);
      return;
    }

    changes.slice().reverse().forEach(function (change) {
      var li = document.createElement("li");
      li.className = "benefit-item is-change";

      var title = document.createElement("p");
      title.className = "benefit-item-title";
      title.textContent = (change.count > 0 ? "+" : "") + change.count + "枚 " +
        (BENEFIT_REASON[change.reason] ? BENEFIT_REASON[change.reason].label : change.reason);

      var meta = document.createElement("p");
      meta.className = "benefit-detail";
      meta.textContent = [change.at, change.note].filter(Boolean).join(" ・ ");

      var actions = document.createElement("p");
      actions.className = "benefit-actions";
      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "btn-remove";
      remove.textContent = "この記録を消す";
      remove.addEventListener("click", function () { removeBenefitChange(change.id); });
      actions.appendChild(remove);

      li.append(title, meta, actions);
      root.appendChild(li);
    });
  }

  function removeBenefitChange(id) {
    var b = benefitState();
    saveBenefit({
      changes: b.changes.filter(function (change) { return change.id !== id; }),
      uses: b.uses,
      updated_at: todayStamp()
    });
    render();
  }

  function renderBenefitSuggest() {
    var box = document.getElementById("benefit-suggest");
    var grade = state.profile ? state.profile.fc_grade : "";
    var suggest = ruleCountFor(grade);
    box.textContent = "";
    if (!suggest || benefitState().changes.length) return;
    box.textContent = GRADE_LABEL[grade] + "の特典チケットは" + suggest +
      "枚です。「会員特典として受け取った」で記録してください。";
    document.getElementById("benefit-change-count").value = String(suggest);
  }

  function renderBenefitOptions(now) {
    var select = document.getElementById("benefit-match");
    select.textContent = "";
    var first = document.createElement("option");
    first.value = "";
    first.textContent = "選んでください";
    select.appendChild(first);
    upcomingHomeMatches(now).forEach(function (match) {
      var option = document.createElement("option");
      option.value = match.id;
      var use = benefitUseFor(match.id);
      option.textContent = matchTitle(match) + (use ? "（記録済み " + use.count + "枚）" : "");
      select.appendChild(option);
    });
  }

  function todayStamp() {
    var now = new Date();
    return now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());
  }

  function setBenefitStatus(matchId, status) {
    var b = benefitState();
    var uses = b.uses.map(function (use) {
      return use.match_id === matchId
        ? { match_id: matchId, count: use.count, status: status, updated_at: todayStamp() }
        : use;
    });
    saveBenefit({ changes: b.changes, uses: uses, updated_at: todayStamp() });
    render();
  }

  function removeBenefitUse(matchId) {
    var b = benefitState();
    var uses = b.uses.filter(function (use) { return use.match_id !== matchId; });
    saveBenefit({ changes: b.changes, uses: uses, updated_at: todayStamp() });
    render();
  }

  function renderFilterNote() {
    var note = document.getElementById("filter-note");
    var toggle = document.getElementById("mine-only");
    if (hasProfile()) {
      toggle.disabled = false;
      note.textContent = state.mineOnly
        ? "自分に該当するものと全員向けだけを表示しています。"
        : "自分に該当するものに「対象」の印を付けています。該当しないものも一覧から消していません。";
    } else {
      toggle.disabled = true;
      note.textContent = "「あなたの設定」を保存すると、自分に該当する先行販売に「対象」の印が付きます。";
    }
  }

  function render() {
    var now = new Date();
    var visible = allEvents().filter(matchesFilter).filter(matchesMine);
    syncProfileDot();
    renderFilterNote();
    renderBenefitSummary(now);
    renderBenefitList();
    renderBenefitChanges();
    renderBenefitSuggest();
    renderBenefitOptions(now);
    renderNext(visible, now);
    renderTimeline(visible, now);
    renderUndated(visible);
    renderSkipped();
  }

  /* ---------- ICS ---------- */

  function icsEscape(text) {
    return String(text)
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\r?\n/g, "\\n");
  }

  function toUtcStamp(date) {
    return date.getUTCFullYear() +
      pad(date.getUTCMonth() + 1) +
      pad(date.getUTCDate()) + "T" +
      pad(date.getUTCHours()) +
      pad(date.getUTCMinutes()) +
      pad(date.getUTCSeconds()) + "Z";
  }

  function toDateStamp(date) {
    return date.getFullYear() + pad(date.getMonth() + 1) + pad(date.getDate());
  }

  function buildIcs(list, now) {
    var lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//SANGA TOOLBOX//SUPPORTER TIMELINE//JA",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:" + icsEscape("SANGA SUPPORTER TIMELINE")
    ];

    list.forEach(function (event) {
      var start = parseDate(event.starts_at);
      if (!start) return;
      lines.push("BEGIN:VEVENT");
      lines.push("UID:" + icsEscape(event.id) + "@sanga-timeline.invalid");
      lines.push("DTSTAMP:" + toUtcStamp(now));
      // 版が無いと、同じUIDでもカレンダー側は更新と判断できない。
      if (typeof event.calendar_sequence === "number" && event.calendar_sequence >= 0) {
        lines.push("SEQUENCE:" + Math.floor(event.calendar_sequence));
      }
      var lastModified = parseDate(event.calendar_last_modified);
      if (lastModified) lines.push("LAST-MODIFIED:" + toUtcStamp(lastModified));
      if (event.date_precision === "date") {
        lines.push("DTSTART;VALUE=DATE:" + toDateStamp(start));
      } else {
        lines.push("DTSTART:" + toUtcStamp(start));
        var end = parseDate(event.ends_at);
        if (end) lines.push("DTEND:" + toUtcStamp(end));
      }
      lines.push("SUMMARY:" + icsEscape(event.title));
      var description = [];
      var label = matchLabel(event);
      if (label) description.push(label);
      if (event.source_url) description.push(event.source_url);
      lines.push("DESCRIPTION:" + icsEscape(description.join("\n")));
      lines.push("END:VEVENT");
    });

    lines.push("END:VCALENDAR");
    return lines.join("\r\n") + "\r\n";
  }

  function exportIcs() {
    var status = document.getElementById("ics-status");
    var now = new Date();
    var dated = allEvents().filter(matchesFilter).filter(isDated);
    var target = dated.filter(isIcsTarget);

    if (!target.length) {
      status.textContent = "追加できる予定がありません。日時が確定しているものだけが対象です。";
      return;
    }

    var text = buildIcs(target, now);
    var blob = new Blob([text], { type: "text/calendar;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "sanga-timeline.ics";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);

    var undated = allEvents().filter(matchesFilter).length - dated.length;
    var benefitSkipped = dated.length - target.length;
    // この道具からカレンダーへ直接は入れられない。ファイルを作るところまでなので、
    // 「追加した」とは言わず、次に何をすればいいかまで書く。
    // 外した理由は分けて書く。「日時が未確定」と「引き換え予定を決めていない」は
    // 利用者の次の行動が違うため。
    status.textContent = target.length + "件をファイルにしました。カレンダーアプリで開くと追加されます。" +
      (undated > 0 ? "日時が確定していない" + undated + "件は含めていません。" : "") +
      (benefitSkipped > 0 ? "特典チケットの引換は、引き換え予定を決めた試合のぶんだけ入れます。決めていない" + benefitSkipped + "件は含めていません。" : "");
  }

  /* ---------- 操作 ---------- */

  function bindFilters() {
    document.querySelectorAll(".chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        state.filter = chip.dataset.filter;
        document.querySelectorAll(".chip").forEach(function (other) {
          var on = other === chip;
          other.classList.toggle("is-on", on);
          other.setAttribute("aria-pressed", on ? "true" : "false");
        });
        render();
      });
    });
  }

  function profileSummary() {
    if (!hasProfile()) return "未設定です。すべての予定をそのまま表示します。";
    var parts = [];
    if (state.profile.fc_grade) parts.push(GRADE_LABEL[state.profile.fc_grade]);
    if (state.profile.has_season_ticket) parts.push("シーズンパスあり");
    return "この端末に保存しました（" + parts.join(" ・ ") + "）。設定はこの端末から出ません。";
  }

  function fillProfileForm() {
    document.getElementById("profile-grade").value = state.profile ? state.profile.fc_grade : "";
    document.getElementById("profile-season").checked = !!(state.profile && state.profile.has_season_ticket);
  }

  function bindProfile() {
    var form = document.getElementById("profile-form");
    var status = document.getElementById("profile-status");

    form.addEventListener("submit", function (submitEvent) {
      submitEvent.preventDefault();
      var now = new Date();
      var profile = {
        fc_grade: document.getElementById("profile-grade").value,
        has_season_ticket: document.getElementById("profile-season").checked,
        updated_at: now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate())
      };
      if (saveProfile(profile)) {
        state.profile = normalizeProfile(profile);
        status.textContent = profileSummary();
      } else {
        status.textContent = "保存できませんでした。ブラウザの設定で保存が制限されている可能性があります。";
      }
      if (!hasProfile()) {
        state.mineOnly = false;
        document.getElementById("mine-only").checked = false;
      }
      render();
    });

    document.getElementById("profile-clear").addEventListener("click", function () {
      clearProfile();
      state.profile = null;
      state.mineOnly = false;
      document.getElementById("mine-only").checked = false;
      fillProfileForm();
      status.textContent = "会員種別とシーズンパスの設定を削除しました。MY予定は消していません。";
      render();
    });

    document.getElementById("mine-only").addEventListener("change", function (changeEvent) {
      state.mineOnly = changeEvent.target.checked;
      render();
    });
  }

  function bindBenefit() {
    var form = document.getElementById("benefit-form");
    var planForm = document.getElementById("benefit-plan-form");
    var status = document.getElementById("benefit-status");

    // 譲り受けたときだけコースを聞く。ほかの理由では自分のコースで決まるため。
    var reasonSelect = document.getElementById("benefit-reason");
    var sourceGradeField = document.getElementById("benefit-source-grade-field");
    function syncSourceGradeField() {
      sourceGradeField.hidden = reasonSelect.value !== "received";
    }
    reasonSelect.addEventListener("change", syncSourceGradeField);
    syncSourceGradeField();

    form.addEventListener("submit", function (submitEvent) {
      submitEvent.preventDefault();
      var count = Math.floor(Number(document.getElementById("benefit-change-count").value));
      var reason = document.getElementById("benefit-reason").value;
      var note = document.getElementById("benefit-note").value.trim();
      var sourceGrade = document.getElementById("benefit-source-grade").value;
      var rule = BENEFIT_REASON[reason];
      if (!rule) {
        status.textContent = "理由を選んでください。";
        return;
      }
      if (!isFinite(count) || count < 1) {
        status.textContent = "1以上の枚数を入れてください。";
        return;
      }

      var b = benefitState();
      var signed = count * rule.sign;
      var changes = b.changes.concat([{
        id: "chg-" + Date.now(),
        count: signed,
        reason: reason,
        note: note,
        source_grade: reason === "received" ? sourceGrade : "",
        at: todayStamp()
      }]);

      if (saveBenefit({ changes: changes, uses: b.uses, updated_at: todayStamp() })) {
        status.textContent = rule.label + "として" + count + "枚を記録しました。持っている枚数は" +
          benefitTotal() + "枚です。";
        document.getElementById("benefit-note").value = "";
        document.getElementById("benefit-change-count").value = "1";
        document.getElementById("benefit-source-grade").value = "";
        syncSourceGradeField();
      } else {
        status.textContent = "保存できませんでした。ブラウザの設定で保存が制限されている可能性があります。";
      }
      render();
    });

    planForm.addEventListener("submit", function (submitEvent) {
      submitEvent.preventDefault();
      var matchId = document.getElementById("benefit-match").value;
      var count = Math.floor(Number(document.getElementById("benefit-count").value));
      if (!matchId) {
        status.textContent = "試合を選んでください。";
        return;
      }
      if (!isFinite(count) || count < 1) count = 1;

      var b = benefitState();
      var found = false;
      var uses = b.uses.map(function (use) {
        if (use.match_id !== matchId) return use;
        found = true;
        // 同じ試合に足す場合は枚数を合算する
        return { match_id: matchId, count: use.count + count, status: use.status, updated_at: todayStamp() };
      });
      if (!found) {
        uses = uses.concat([{ match_id: matchId, count: count, status: "planned", updated_at: todayStamp() }]);
      }
      saveBenefit({ changes: b.changes, uses: uses, updated_at: todayStamp() });
      status.textContent = count + "枚を引き換える予定として記録しました。";
      document.getElementById("benefit-count").value = "1";
      render();
    });
  }

  function bindForm() {
    var form = document.getElementById("my-form");
    var status = document.getElementById("my-status");

    form.addEventListener("submit", function (submitEvent) {
      submitEvent.preventDefault();
      var title = document.getElementById("my-title").value.trim();
      var when = document.getElementById("my-when").value;
      var matchId = document.getElementById("my-match").value;
      if (!title || !when) return;

      var list = loadPersonal();
      list.push({
        id: "my-" + Date.now(),
        starts_at: when + ":00+09:00",
        ends_at: "",
        date_precision: "datetime",
        date_candidates: [],
        type: "personal",
        title: title,
        source: "personal",
        action_type: "personal",
        match_ids: matchId ? [matchId] : [],
        status: "confirmed",
        is_visible: true
      });

      if (savePersonal(list)) {
        status.textContent = "追加しました。この端末にだけ保存しています。";
        form.reset();
        render();
      } else {
        status.textContent = "保存できませんでした。ブラウザの設定で保存が制限されている可能性があります。";
      }
    });
  }

  /* ---------- 起動 ---------- */

  /** まだ設定していない人には開いて見せ、設定済みの人には畳んで本体を近づける。 */
  // 設定とMY予定はシート自体が折りたたみなので、中の details は無くした。
  // 特典チケットはシート1枚に複数のフォームが入るため、中の details を残している。
  function foldSettled() {
    var benefitFolds = document.querySelectorAll("#sheet-benefit .fold");
    var started = benefitState().changes.length > 0;
    if (benefitFolds[0]) benefitFolds[0].open = !started;
    if (benefitFolds[1]) benefitFolds[1].open = false;
  }

  /**
   * 設定が未設定であることを、下部メニューの「設定」に点で示す。
   * 設定を促す表示は出すが必須にしない、という方針（「表示の原則」）を、
   * 設定をシートへ移したあとも保つため。点は装飾で、読み上げ用の語を併記する。
   */
  function syncProfileDot() {
    var dot = document.getElementById("profile-dot");
    if (dot) dot.hidden = hasProfile();
  }

  /**
   * 背面のスクロール止め。開いているシートが1枚でもあれば止める。
   * dialog の close イベントは非同期に来るので、付ける・外すを順序で書くと
   * 「閉じてから開く」で外れてしまう。いまの状態から決め直す。
   */
  function syncScrollLock() {
    document.body.classList.toggle(
      "sheet-open",
      !!document.querySelector(".sheet[open], .tour[open]")
    );
  }

  /**
   * 使い方の説明。初めて開いた人にだけ出し、読んだら出さない。
   * 設定シートからいつでも開き直せる。
   *
   * 出すのは「何ができるか」と「どう操作するか」の2点だけにしている。
   * 題の上下の文言を落として、初見の人に何のツールか伝わらなくなったため。
   */
  function bindTour() {
    var tour = document.getElementById("tour");
    if (!tour) return;

    var panels = [].slice.call(tour.querySelectorAll("[data-tour-panel]"));
    var stepLabel = document.getElementById("tour-step");
    var prev = tour.querySelector("[data-tour-prev]");
    var next = tour.querySelector("[data-tour-next]");
    var index = 0;

    function seen() {
      try {
        return window.localStorage.getItem(TOUR_KEY) === "done";
      } catch (error) {
        // 保存を制限されている端末では、毎回出すより出さないほうが邪魔にならない
        return true;
      }
    }

    function remember() {
      try {
        window.localStorage.setItem(TOUR_KEY, "done");
      } catch (error) {
        // 覚えられなくても説明は読めている。次に開いたときにまた出るだけ
      }
    }

    function show(nextIndex) {
      index = Math.max(0, Math.min(panels.length - 1, nextIndex));
      panels.forEach(function (panel, i) { panel.hidden = i !== index; });
      stepLabel.textContent = (index + 1) + " / " + panels.length;
      prev.hidden = index === 0;
      next.textContent = index === panels.length - 1 ? "はじめる" : "次へ";
    }

    function close() {
      remember();
      if (tour.open) tour.close();
    }

    next.addEventListener("click", function () {
      if (index === panels.length - 1) close();
      else show(index + 1);
    });
    prev.addEventListener("click", function () { show(index - 1); });
    tour.querySelector("[data-tour-skip]").addEventListener("click", close);

    // Esc で閉じたときも読んだものとして扱う
    tour.addEventListener("cancel", function () { remember(); });
    tour.addEventListener("close", syncScrollLock);

    var open = document.getElementById("tour-open");
    if (open) {
      open.addEventListener("click", function () {
        var profile = document.getElementById("sheet-profile");
        if (profile && profile.open) profile.close();
        show(0);
        tour.showModal();
        syncScrollLock();
      });
    }

    if (!seen()) {
      show(0);
      tour.showModal();
      syncScrollLock();
    }
  }

  /**
   * 見出しが画面上部に貼り付いたかを見張る。
   * 貼り付いているあいだだけ帯に縮め、地の色を敷く。
   * scroll を毎回測るより負荷が軽いので IntersectionObserver を使う。
   */
  function bindStickyHead() {
    var head = document.querySelector(".head");
    if (!head || typeof IntersectionObserver !== "function") return;

    var sentinel = document.createElement("div");
    sentinel.setAttribute("aria-hidden", "true");
    sentinel.style.height = "1px";
    head.parentNode.insertBefore(sentinel, head);

    new IntersectionObserver(function (entries) {
      head.classList.toggle("is-stuck", !entries[0].isIntersecting);
    }, { threshold: 0 }).observe(sentinel);
  }

  /**
   * 下部メニューとシート。シートは <dialog> で開く。
   * Esc・フォーカスの閉じ込め・閉じたときのフォーカス復帰は <dialog> の挙動をそのまま使い、
   * 背面のスクロール止めと出入りの動きだけをこちらで足す。
   */
  function bindSheets() {
    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    function motionOff() {
      return reduced.matches || document.documentElement.getAttribute("data-motion") === "off";
    }

    function open(sheet, tab) {
      if (!sheet || sheet.open) return;
      sheet.dataset.opener = tab ? tab.dataset.sheet : "";
      sheet.showModal();
      syncScrollLock();
    }

    function close(sheet) {
      if (!sheet || !sheet.open) return;
      if (motionOff()) {
        sheet.close();
        return;
      }
      // 閉じる動きを見せてから実際に閉じる
      sheet.classList.add("is-closing");
      var done = function () {
        sheet.classList.remove("is-closing");
        sheet.removeEventListener("animationend", done);
        sheet.close();
      };
      sheet.addEventListener("animationend", done);
    }

    // 下部メニューと、見出しの「カレンダー」の両方から開く
    document.querySelectorAll("[data-sheet]").forEach(function (button) {
      button.addEventListener("click", function () {
        open(document.getElementById(button.dataset.sheet), button);
      });
    });

    document.querySelectorAll(".sheet").forEach(function (sheet) {
      sheet.addEventListener("close", syncScrollLock);

      // Esc は既定の即閉じではなく、閉じる動きを通す
      sheet.addEventListener("cancel", function (cancelEvent) {
        cancelEvent.preventDefault();
        close(sheet);
      });

      sheet.querySelectorAll("[data-close-sheet]").forEach(function (button) {
        button.addEventListener("click", function () { close(sheet); });
      });

      // 背景（::backdrop）を押したら閉じる。中身の外側を押したときだけ
      sheet.addEventListener("click", function (clickEvent) {
        if (clickEvent.target === sheet) close(sheet);
      });
    });
  }

  // 確認日は手で書くと古くなる。読み込んだ実データのうち最も新しいものを出す。
  function renderCheckedAt() {
    var node = document.getElementById("checked-at");
    if (!node) return;
    var latest = "";
    state.events.forEach(function (event) {
      if (event.is_sample) return;
      if (event.source_checked_at && event.source_checked_at > latest) latest = event.source_checked_at;
    });
    node.textContent = latest || "不明";
  }

  function start() {
    state.profile = loadProfile();
    state.benefit = loadBenefit();
    bindFilters();
    bindProfile();
    bindBenefit();
    fillProfileForm();
    document.getElementById("profile-status").textContent = profileSummary();
    bindSheets();
    bindStickyHead();
    bindTour();

    bindForm();
    document.getElementById("ics-btn").addEventListener("click", exportIcs);

    Promise.all([
      fetch(EVENTS_URL).then(function (r) { return r.json(); }),
      fetch(MATCHES_URL).then(function (r) { return r.json(); }),
      fetch(BENEFIT_URL).then(function (r) { return r.json(); }).catch(function () { return null; })
    ]).then(function (results) {
      state.events = (results[0].events || []).filter(function (e) { return e.is_visible !== false; });
      state.skipped = results[0].skipped || [];
      state.awayTickets = results[0].away_tickets || [];
      state.matches = results[1].matches || [];
      state.benefitRule = results[2];
      renderMatchOptions();
      foldSettled();
      renderCheckedAt();
      render();
    }).catch(function () {
      document.getElementById("next-body").textContent = "";
      var message = document.createElement("p");
      message.className = "empty";
      message.textContent = "予定データを読み込めませんでした。通信の状態を確かめて、ページを開き直してください。";
      document.getElementById("next-body").appendChild(message);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
