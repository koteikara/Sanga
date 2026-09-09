// 求・譲 投稿ツール プロトタイプ
//
// 設計は docs/trade-post-design.md。ここで確かめたいのは次の4点。
//   1. 商品と背番号を「選ぶ」だけで、実際の投稿と同じ形の文章になるか
//   2. 文字数を重み付き280で数えたとき、実用的な長さに収まるか
//   3. 「さがす」が、いま出ている投稿へ実際に届くか
//   4. スマホ幅で背番号を選ぶ操作が成立するか
//
// データはローカルのサンプルを読む（experiments/ の他のプロトタイプと同じ方式）。
// 本番移植時は public/data/ を読む。

(function () {
  "use strict";

  var GOODS_URL = "goods.sample.json";
  var PLAYERS_URL = "players.sample.json";
  var MATCHES_URL = "matches.sample.json";

  var INVITE = "検索からお気軽にお声かけください";
  var MAX_WEIGHTED = 280;
  var MATCH_LIMIT = 6;

  var state = {
    goodsId: "",
    variant: "",
    offer: [],
    want: [],
    wantAny: false,
    matches: [],
    findGoodsId: "",
    find: []
  };

  var data = { goods: [], hashtags: [], players: [], matches: [] };

  var $ = function (id) { return document.getElementById(id); };

  // --- Xの重み付き文字数 -------------------------------------------------
  // Xは日本語などを2、半角英数などを1として数え、上限は280。
  // 現行ツールは生の length を140と比べており、半角混じりの投稿を不必要に弾いていた。
  // 重み1の範囲は twitter-text の既定（0-4351, 8192-8205, 8208-8223, 8242-8247）。
  function weightedLength(text) {
    var total = 0;
    for (var i = 0; i < text.length; i++) {
      var code = text.codePointAt(i);
      if (code > 0xffff) { i++; }
      var light =
        (code >= 0 && code <= 4351) ||
        (code >= 8192 && code <= 8205) ||
        (code >= 8208 && code <= 8223) ||
        (code >= 8242 && code <= 8247);
      total += light ? 1 : 2;
    }
    return total;
  }

  // --- データの整形 -------------------------------------------------------
  function selectedGoods(id) {
    for (var i = 0; i < data.goods.length; i++) {
      if (data.goods[i].id === id) { return data.goods[i]; }
    }
    return null;
  }

  // 背番号は数値順。マスコットは番号が大きく離れているため末尾に置く。
  function sortPlayers(players) {
    return players.slice().sort(function (a, b) {
      if (a.isMascot !== b.isMascot) { return a.isMascot ? 1 : -1; }
      return Number(a.number) - Number(b.number);
    });
  }

  // 交換に出るのは「発売時点で在籍していた選手」なので、期限付き移籍中も候補に残す。
  // 実際に #2（期限付き移籍中）を含む投稿がある。
  function isOut(player) { return player.status !== "active"; }

  function upcomingMatches(matches, today) {
    return matches
      .filter(function (m) {
        return m.is_visible !== false && m.match_date && m.match_date >= today;
      })
      .sort(function (a, b) { return a.match_date < b.match_date ? -1 : 1; })
      .slice(0, MATCH_LIMIT);
  }

  var WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

  function matchLabel(match) {
    var parts = match.match_date.split("-");
    var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    var head = Number(parts[1]) + "/" + Number(parts[2]) + "(" + WEEKDAYS[date.getDay()] + ")";
    if (match.home_away === "H") {
      return head + " ホーム" + match.opponent + "戦";
    }
    return head + " " + match.opponent + "戦（" + match.venue + "）";
  }

  // --- 描画 ---------------------------------------------------------------
  function renderGoodsSelect(select, selectedId) {
    select.textContent = "";
    data.goods.forEach(function (item) {
      var option = document.createElement("option");
      option.value = item.id;
      option.textContent = item.name + (item.tentative ? "（名称未確認）" : "");
      if (item.id === selectedId) { option.selected = true; }
      select.appendChild(option);
    });
  }

  function renderVariants() {
    var goods = selectedGoods(state.goodsId);
    var field = $("variant-field");
    var box = $("variants");
    box.textContent = "";
    if (!goods || !goods.variants || goods.variants.length === 0) {
      field.hidden = true;
      state.variant = "";
      return;
    }
    field.hidden = false;
    if (goods.variants.indexOf(state.variant) === -1) { state.variant = ""; }
    var options = [""].concat(goods.variants);
    options.forEach(function (variant) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "chip";
      button.textContent = variant === "" ? "指定しない" : variant;
      button.setAttribute("aria-pressed", String(state.variant === variant));
      button.addEventListener("click", function () {
        state.variant = variant;
        renderVariants();
        compose();
      });
      box.appendChild(button);
    });
  }

  // 背番号を選ぶ盤は3か所（譲・求・さがす）にある。押されたら自分を描き直すので、
  // 種類をキーにして「どのリストを持ち、押されたあと何をするか」だけを表で分ける。
  var PICKERS = {
    offer: { container: "offer-numbers", list: "offer", count: "offer-count", after: compose },
    want: { container: "want-numbers", list: "want", count: "want-count", after: compose },
    find: { container: "find-numbers", list: "find", count: "find-count", after: renderFind }
  };

  function renderPicker(kind) {
    var picker = PICKERS[kind];
    var container = $(picker.container);
    var list = state[picker.list];
    container.textContent = "";
    sortPlayers(data.players).forEach(function (player) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "num" + (isOut(player) ? " is-out" : "");
      button.setAttribute("aria-pressed", String(list.indexOf(player.number) !== -1));
      var number = document.createElement("b");
      number.textContent = player.number;
      button.appendChild(number);
      button.appendChild(document.createTextNode(player.nameShort || player.nameJa));
      button.addEventListener("click", function () {
        toggle(list, player.number);
        renderPicker(kind);
        picker.after();
      });
      container.appendChild(button);
    });
    $(picker.count).textContent = String(list.length);
  }

  function toggle(list, value) {
    var index = list.indexOf(value);
    if (index === -1) { list.push(value); } else { list.splice(index, 1); }
  }

  function renderMatches() {
    var box = $("matches");
    box.textContent = "";
    upcomingMatches(data.matches, todayISO()).forEach(function (match) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "match";
      button.setAttribute("aria-pressed", String(state.matches.indexOf(match.id) !== -1));
      var label = document.createElement("span");
      if (match.home_away === "H") { label.className = "home"; }
      label.textContent = matchLabel(match);
      button.appendChild(label);
      button.addEventListener("click", function () {
        toggle(state.matches, match.id);
        renderMatches();
        compose();
      });
      box.appendChild(button);
    });
  }

  function todayISO() {
    var now = new Date();
    return now.getFullYear() + "-" +
      String(now.getMonth() + 1).padStart(2, "0") + "-" +
      String(now.getDate()).padStart(2, "0");
  }

  // --- 投稿文の組み立て ---------------------------------------------------
  // 実際の投稿の書き方に合わせる（docs/trade-post-design.md「Xでの交換の実態」）。
  // 背番号はドット区切り、商品名は1回だけ。
  function numberList(list) {
    return list.slice().sort(function (a, b) { return Number(a) - Number(b); }).join(".");
  }

  function compose() {
    var goods = selectedGoods(state.goodsId);
    if (!goods) { return; }

    var lines = [];
    var title = "【交換】" + goods.name;
    if (state.variant) { title += "（" + state.variant + "）"; }
    lines.push(title);

    if (state.offer.length) { lines.push("譲 " + numberList(state.offer)); }
    if (state.wantAny) {
      lines.push("求 同種");
    } else if (state.want.length) {
      lines.push("求 " + numberList(state.want));
    }

    var handover = [];
    state.matches.forEach(function (id) {
      for (var i = 0; i < data.matches.length; i++) {
        if (data.matches[i].id === id) { handover.push(matchLabel(data.matches[i])); }
      }
    });
    if ($("by-mail").checked) { handover.push("郵送も可"); }
    if (handover.length) { lines.push("", handover.join(" / ")); }

    var extra = $("extra").value.trim();
    if (extra) { if (!handover.length) { lines.push(""); } lines.push(extra); }

    if ($("add-invite").checked) {
      if (!handover.length && !extra) { lines.push(""); }
      lines.push(INVITE);
    }

    if ($("add-tags").checked) {
      var tags = (goods.tags || []).slice();
      data.hashtags.forEach(function (tag) {
        if (tag === "#京都サンガ" && tags.indexOf(tag) === -1) { tags.push(tag); }
      });
      if (tags.length) { lines.push("", tags.join(" ")); }
    }

    $("post").value = lines.join("\n");
    updateCounter();
  }

  function updateCounter() {
    var text = $("post").value;
    var used = weightedLength(text);
    var counter = $("counter");
    counter.textContent = used + " / " + MAX_WEIGHTED;
    counter.classList.toggle("over", used > MAX_WEIGHTED);
    $("post-to-x").href = "https://x.com/intent/post?text=" + encodeURIComponent(text);
  }

  // --- さがす -------------------------------------------------------------
  // 商品名の表記ゆれ（「ユニ型缶バッジ」「ユニホーム缶バッチ」）を拾うため、
  // 短くて特徴のある呼び方を検索語に使う。
  function searchTerm(goods) {
    var candidates = [goods.name].concat(goods.aliases || []);
    return candidates.reduce(function (shortest, current) {
      return current.length < shortest.length ? current : shortest;
    }, candidates[0]);
  }

  function findQuery() {
    var goods = selectedGoods(state.findGoodsId);
    if (!goods) { return ""; }
    var words = ["サンガ", searchTerm(goods), "譲"];
    // 番号は1つだけ選ばれたときに足す。複数をANDで並べると1件も出なくなる。
    if (state.find.length === 1) { words.push(state.find[0]); }
    return words.join(" ");
  }

  function renderFind() {
    var query = findQuery();
    $("find-query").textContent = query;
    // 番号を複数選んでも検索語には入らない。黙って落とすと選んだつもりになるので言う。
    var hint = $("find-hint");
    hint.hidden = state.find.length < 2;
    hint.textContent = "背番号は1つだけ選ぶと絞り込みます。いまは商品だけで探しています。";
    $("find-yahoo").href =
      "https://search.yahoo.co.jp/realtime/search?ei=UTF-8&p=" + encodeURIComponent(query);
    $("find-x").href =
      "https://x.com/search?f=live&q=" + encodeURIComponent(query);
  }

  function renderFindTags() {
    var box = $("find-tags");
    box.textContent = "";
    data.hashtags.forEach(function (tag) {
      var link = document.createElement("a");
      link.className = "chip";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = tag;
      link.href = "https://search.yahoo.co.jp/realtime/search?ei=UTF-8&p=" + encodeURIComponent(tag);
      box.appendChild(link);
    });
  }

  // --- 画面の切り替え -----------------------------------------------------
  function showPanel(which) {
    var make = which === "make";
    $("tab-make").setAttribute("aria-selected", String(make));
    $("tab-find").setAttribute("aria-selected", String(!make));
    $("panel-make").hidden = !make;
    $("panel-find").hidden = make;
  }

  // --- コピー -------------------------------------------------------------
  // 現行ツールは document.execCommand("copy") と alert()。非推奨のうえ、
  // iOS Safariの readonly + select() は取りこぼす。
  function copyPost() {
    var text = $("post").value;
    var status = $("copy-status");
    var done = function () { status.textContent = "コピーしました"; };
    var fail = function () { status.textContent = "コピーできませんでした。投稿文を長押しして選んでください"; };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fail);
      return;
    }
    var area = $("post");
    area.focus();
    area.setSelectionRange(0, area.value.length);
    try { document.execCommand("copy") ? done() : fail(); } catch (error) { fail(); }
  }

  // --- 起動 ---------------------------------------------------------------
  function bind() {
    $("tab-make").addEventListener("click", function () { showPanel("make"); });
    $("tab-find").addEventListener("click", function () { showPanel("find"); });

    $("goods").addEventListener("change", function () {
      state.goodsId = this.value;
      var goods = selectedGoods(state.goodsId);
      var note = $("goods-note");
      if (goods && goods.tentative) {
        note.hidden = false;
        note.textContent = "この商品名は未確認です（" + goods.checkedAt + " 時点）。公式表記と違う可能性があります。";
      } else {
        note.hidden = true;
      }
      renderVariants();
      compose();
    });

    $("want-any").addEventListener("change", function () {
      state.wantAny = this.checked;
      $("want-numbers").setAttribute("aria-disabled", String(this.checked));
      compose();
    });

    ["by-mail", "add-invite", "add-tags"].forEach(function (id) {
      $(id).addEventListener("change", compose);
    });
    $("extra").addEventListener("input", compose);
    $("post").addEventListener("input", updateCounter);
    $("copy").addEventListener("click", copyPost);

    $("find-goods").addEventListener("change", function () {
      state.findGoodsId = this.value;
      renderFind();
    });
  }

  Promise.all([
    fetch(GOODS_URL).then(function (r) { return r.json(); }),
    fetch(PLAYERS_URL).then(function (r) { return r.json(); }),
    fetch(MATCHES_URL).then(function (r) { return r.json(); })
  ]).then(function (results) {
    data.goods = results[0].goods;
    data.hashtags = results[0].hashtags || [];
    data.players = results[1].players;
    data.matches = Array.isArray(results[2]) ? results[2] : results[2].matches;

    state.goodsId = data.goods[0].id;
    state.findGoodsId = data.goods[0].id;

    renderGoodsSelect($("goods"), state.goodsId);
    renderGoodsSelect($("find-goods"), state.findGoodsId);
    renderVariants();
    renderPicker("offer");
    renderPicker("want");
    renderPicker("find");
    renderMatches();
    renderFindTags();
    bind();
    compose();
    renderFind();
  });
}());
