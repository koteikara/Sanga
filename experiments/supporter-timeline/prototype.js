/**
 * SUPPORTER TIMELINE 検証用プロトタイプ
 *
 * 設計の正本は docs/supporter-timeline-design.md。
 * ここで確認したいのは次の4点。
 *   1. 「次にやること」と全体タイムラインを分けたときの見え方
 *   2. date_precision による表示の出し分け（datetime / date / candidates / unknown）
 *   3. MY予定と公式イベントが同じ時系列に並ぶこと
 *   4. 確定した日時だけがICSへ出ること
 *   5. プロフィール（会員種別・シーズンパス）による強調と並べ替え（Phase 2）
 *   6. 特典チケットの残り枚数と引き換え予定の記録（Phase 2 追加）
 *
 * 本番へ持ち込まないこと: サンプルデータ、検証用の注意書き。
 */
(function () {
  "use strict";

  var EVENTS_URL = "calendar-events.sample.json";
  var MATCHES_URL = "matches.sample.json";
  var STORAGE_KEY = "sanga-timeline-personal-events-v1";
  var PROFILE_KEY = "sanga-timeline-profile-v1";
  var BENEFIT_KEY = "sanga-timeline-benefit-tickets-v1";
  var BENEFIT_URL = "benefit-tickets.json";

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
    benefitRule: null
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
    var week = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
    return (date.getMonth() + 1) + "月" + date.getDate() + "日（" + week + "）";
  }

  function formatTime(date) {
    return pad(date.getHours()) + ":" + pad(date.getMinutes());
  }

  function formatCandidates(list) {
    return list.map(function (value) {
      var d = parseDate(value + "T00:00:00+09:00");
      if (!d) return value;
      var week = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
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

  /**
   * 特典チケットの保有と使い道。公式には個人の保有状況が出ないため、自己申告として端末内に持つ。
   * { total: 枚数, uses: [{ match_id, status: "planned" | "used", updated_at }] }
   */
  /**
   * 保存形式をそろえる。1試合に複数枚を充てられるため count を持つ。
   * 状態は「引き換えた」= exchanged。旧データの used も exchanged として読む。
   */
  function normalizeBenefit(value) {
    if (!value || typeof value !== "object") return null;
    var total = Number(value.total);
    if (!isFinite(total) || total < 0) total = 0;
    var uses = Array.isArray(value.uses) ? value.uses : [];
    var byMatch = {};
    var order = [];
    uses.forEach(function (use) {
      if (!use || typeof use.match_id !== "string" || !use.match_id) return;
      var count = Number(use.count);
      if (!isFinite(count) || count < 1) count = 1;
      var status = (use.status === "used" || use.status === "exchanged") ? "exchanged" : "planned";
      if (byMatch[use.match_id]) {
        // 同じ試合の記録が複数あれば枚数をまとめる
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
      total: Math.floor(total),
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
    return state.benefit || { total: 0, uses: [], updated_at: "" };
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
    return {
      total: b.total,
      planned: planned,
      exchanged: exchanged,
      left: b.total - planned - exchanged
    };
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

  /* ---------- 描画 ---------- */

  function renderNext(list, now) {
    var box = document.getElementById("next-body");
    var upcoming = list
      .filter(function (e) { return e.action_type === "action" && isDated(e); })
      .map(function (e) { return { event: e, date: parseDate(e.starts_at) }; })
      .filter(function (item) { return item.date && item.date.getTime() >= now.getTime(); })
      .sort(function (a, b) { return a.date - b.date; });

    // プロフィールがあるときは、自分に該当するものと全員向けだけを「次にやること」に出す。
    // 他グレードの先行販売は一覧には残るが、行動を促す位置には出さない。
    var next = upcoming[0];
    if (hasProfile()) {
      next = upcoming.filter(function (item) {
        return profileMatch(item.event) !== "" || isForEveryone(item.event) ||
          item.event.type === "personal";
      })[0] || null;
    }

    box.textContent = "";
    if (!next) {
      var none = document.createElement("p");
      none.className = "empty";
      none.textContent = "直近の期限つきの予定はありません。";
      box.appendChild(none);
      return;
    }

    var when = document.createElement("p");
    when.className = "next-when";
    when.textContent = formatDay(next.date) + " " +
      (next.event.date_precision === "date" ? "時刻未定" : formatTime(next.date));

    var title = document.createElement("p");
    title.className = "next-title";
    title.textContent = next.event.title;

    var sub = document.createElement("p");
    sub.className = "next-sub";
    var label = matchLabel(next.event);
    sub.textContent = untilText(next.date, now) + (label ? " ・ " + label : "");

    box.append(when, title, sub);

    var reason = profileMatch(next.event);
    if (reason) {
      var mine = document.createElement("p");
      mine.className = "next-mine";
      mine.textContent = reason + "が対象です";
      box.appendChild(mine);
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
    title.textContent = event.title;

    var meta = document.createElement("p");
    meta.className = "event-meta";

    var kind = document.createElement("span");
    kind.textContent = TYPE_LABEL[event.type] || event.type;
    meta.appendChild(kind);

    var label = matchLabel(event);
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
      link.textContent = "出典（" + (event.source_checked_at || "確認日不明") + "確認）";
      meta.appendChild(link);
    }

    li.append(top, title, meta);

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

    var todayKey = dayKey(now);
    var currentKey = "";
    var listNode = null;

    dated.forEach(function (item) {
      var key = dayKey(item.date);
      if (key !== currentKey) {
        currentKey = key;
        var day = document.createElement("div");
        day.className = "day";
        var label = document.createElement("p");
        label.className = "day-label";
        label.textContent = formatDay(item.date);
        if (key === todayKey) {
          var badge = document.createElement("span");
          badge.className = "today";
          badge.textContent = "今日";
          label.appendChild(badge);
        }
        listNode = document.createElement("ul");
        listNode.className = "events";
        day.append(label, listNode);
        root.appendChild(day);
      }
      listNode.appendChild(createEventNode(item.event, { removable: item.event.source === "personal" }));
    });
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

    var ul = document.createElement("ul");
    ul.className = "events";
    undated.forEach(function (event) { ul.appendChild(createEventNode(event, null)); });
    root.appendChild(ul);
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

    if (!counts.total && !counts.planned && !counts.exchanged) {
      var none = document.createElement("p");
      none.className = "empty";
      var suggest = ruleCountFor(state.profile ? state.profile.fc_grade : "");
      none.textContent = suggest
        ? GRADE_LABEL[state.profile.fc_grade] + "の特典チケットは" + suggest +
          "枚です。枚数を保存すると、残りと引き換え先の管理ができます。"
        : "枚数を入れると、残りと引き換え先の管理ができます。";
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
    saveBenefit({ total: b.total, uses: uses, updated_at: todayStamp() });
    render();
  }

  function removeBenefitUse(matchId) {
    var b = benefitState();
    var uses = b.uses.filter(function (use) { return use.match_id !== matchId; });
    saveBenefit({ total: b.total, uses: uses, updated_at: todayStamp() });
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
    renderFilterNote();
    renderBenefitSummary(now);
    renderBenefitList();
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
      "PRODID:-//SANGA TOOLBOX//SUPPORTER TIMELINE prototype//JA",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:" + icsEscape("SANGA SUPPORTER TIMELINE（検証用）")
    ];

    list.forEach(function (event) {
      var start = parseDate(event.starts_at);
      if (!start) return;
      lines.push("BEGIN:VEVENT");
      lines.push("UID:" + icsEscape(event.id) + "@sanga-timeline.invalid");
      lines.push("DTSTAMP:" + toUtcStamp(now));
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
      description.push("検証用プロトタイプが作成したサンプルです。");
      lines.push("DESCRIPTION:" + icsEscape(description.join("\n")));
      lines.push("END:VEVENT");
    });

    lines.push("END:VCALENDAR");
    return lines.join("\r\n") + "\r\n";
  }

  function exportIcs() {
    var status = document.getElementById("ics-status");
    var now = new Date();
    var target = allEvents().filter(matchesFilter).filter(isDated);

    if (!target.length) {
      status.textContent = "書き出せる予定がありません。日時が確定しているものだけが対象です。";
      return;
    }

    var text = buildIcs(target, now);
    var blob = new Blob([text], { type: "text/calendar;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "sanga-timeline-sample.ics";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);

    var skipped = allEvents().filter(matchesFilter).length - target.length;
    status.textContent = target.length + "件を書き出しました。" +
      (skipped > 0 ? "日時が確定していない" + skipped + "件は含めていません。" : "");
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
      fillBenefitTotal();
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

  /** 保存済みの枚数を出す。未保存なら会員種別から公式の配布枚数を初期値として置く。 */
  function fillBenefitTotal() {
    var input = document.getElementById("benefit-total");
    if (state.benefit) {
      input.value = String(state.benefit.total);
      return;
    }
    var suggest = ruleCountFor(state.profile ? state.profile.fc_grade : "");
    input.value = suggest ? String(suggest) : "";
  }

  function bindBenefit() {
    var form = document.getElementById("benefit-form");
    var planForm = document.getElementById("benefit-plan-form");
    var status = document.getElementById("benefit-status");

    form.addEventListener("submit", function (submitEvent) {
      submitEvent.preventDefault();
      var raw = document.getElementById("benefit-total").value;
      var total = Math.floor(Number(raw));
      if (!isFinite(total) || total < 0) {
        status.textContent = "0以上の数を入れてください。";
        return;
      }
      var b = benefitState();
      if (saveBenefit({ total: total, uses: b.uses, updated_at: todayStamp() })) {
        status.textContent = "持っている枚数を" + total + "枚として保存しました。この端末にだけ残ります。";
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
      saveBenefit({ total: b.total, uses: uses, updated_at: todayStamp() });
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

  function start() {
    state.profile = loadProfile();
    state.benefit = loadBenefit();
    bindFilters();
    bindProfile();
    bindBenefit();
    fillProfileForm();
    document.getElementById("profile-status").textContent = profileSummary();

    bindForm();
    document.getElementById("ics-btn").addEventListener("click", exportIcs);

    Promise.all([
      fetch(EVENTS_URL).then(function (r) { return r.json(); }),
      fetch(MATCHES_URL).then(function (r) { return r.json(); }),
      fetch(BENEFIT_URL).then(function (r) { return r.json(); }).catch(function () { return null; })
    ]).then(function (results) {
      state.events = (results[0].events || []).filter(function (e) { return e.is_visible !== false; });
      state.skipped = results[0].skipped || [];
      state.matches = results[1].matches || [];
      state.benefitRule = results[2];
      fillBenefitTotal();
      renderMatchOptions();
      render();
    }).catch(function () {
      document.getElementById("next-body").textContent = "";
      var message = document.createElement("p");
      message.className = "empty";
      message.textContent = "サンプルデータを読み込めませんでした。ファイルを直接開いた場合は、HTTP経由で開き直してください。";
      document.getElementById("next-body").appendChild(message);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
