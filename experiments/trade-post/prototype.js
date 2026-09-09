// 求・譲 投稿ツール プロトタイプ
//
// 設計は docs/trade-post-design.md。
//
// 1つの投稿に商品を複数組のせられる。実際の投稿がそうなっているため
// （「譲）ユニ型缶バッジ 2 求）同種44 / 譲）ユニ型キーホルダー 2、23、38 求）同種44」）。
// 「同種」は直前に挙げた商品と同じもの、という意味。組の中では商品名を1回だけ書き、
// 求の行は「同種」で受ける。
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
  var CARD_WIDTH = 1200;
  var CARD_HEIGHT = 675;

  var state = {
    blocks: [],
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
  function findGoods(id) {
    for (var i = 0; i < data.goods.length; i++) {
      if (data.goods[i].id === id) { return data.goods[i]; }
    }
    return null;
  }

  // 背番号は数値順。マスコットは番号が大きく離れているため末尾に置く。
  function sortedPlayers() {
    return data.players.slice().sort(function (a, b) {
      if (a.isMascot !== b.isMascot) { return a.isMascot ? 1 : -1; }
      return Number(a.number) - Number(b.number);
    });
  }

  // 交換に出るのは「発売時点で在籍していた選手」なので、期限付き移籍中も候補に残す。
  // 実際に #2（期限付き移籍中）を含む投稿がある。
  function isOut(player) { return player.status !== "active"; }

  function toggle(list, value) {
    var index = list.indexOf(value);
    if (index === -1) { list.push(value); } else { list.splice(index, 1); }
  }

  function numberList(list) {
    return list.slice().sort(function (a, b) { return Number(a) - Number(b); }).join(".");
  }

  function todayISO() {
    var now = new Date();
    return now.getFullYear() + "-" +
      String(now.getMonth() + 1).padStart(2, "0") + "-" +
      String(now.getDate()).padStart(2, "0");
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

  function upcomingMatches() {
    var today = todayISO();
    return data.matches
      .filter(function (m) { return m.is_visible !== false && m.match_date && m.match_date >= today; })
      .sort(function (a, b) { return a.match_date < b.match_date ? -1 : 1; })
      .slice(0, MATCH_LIMIT);
  }

  // --- 商品ブロック -------------------------------------------------------
  function newBlock() {
    return { goodsId: data.goods[0].id, variant: "", offer: [], want: [] };
  }

  function fillGoodsSelect(select, selectedId) {
    select.textContent = "";
    data.goods.forEach(function (item) {
      var option = document.createElement("option");
      option.value = item.id;
      option.textContent = item.name;
      if (item.id === selectedId) { option.selected = true; }
      select.appendChild(option);
    });
  }

  function fillNumbers(container, list, onToggle) {
    container.textContent = "";
    sortedPlayers().forEach(function (player) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "num" + (isOut(player) ? " is-out" : "");
      button.setAttribute("aria-pressed", String(list.indexOf(player.number) !== -1));
      var number = document.createElement("b");
      number.textContent = player.number;
      button.appendChild(number);
      button.appendChild(document.createTextNode(player.nameShort || player.nameJa));
      button.addEventListener("click", function () { onToggle(player.number); });
      container.appendChild(button);
    });
  }

  function goodsNote(goods) {
    var parts = [];
    parts.push(goods.kind === "gacha" ? "ガチャ（中身が選べない）" : "選んで買える商品");
    if (goods.lineup) { parts.push("ラインナップ" + goods.lineup + "種"); }
    return parts.join(" / ");
  }

  function renderBlocks() {
    var host = $("blocks");
    host.textContent = "";
    var template = $("block-template");

    state.blocks.forEach(function (block, index) {
      var node = template.content.cloneNode(true);
      var root = node.querySelector(".block");
      var goods = findGoods(block.goodsId);

      node.querySelector(".block-title").textContent = "商品 " + (index + 1);

      var remove = node.querySelector(".remove-block");
      remove.hidden = state.blocks.length < 2;
      remove.addEventListener("click", function () {
        state.blocks.splice(index, 1);
        renderBlocks();
        refresh();
      });

      var select = node.querySelector(".block-goods");
      select.id = "block-goods-" + index;
      node.querySelector("label").setAttribute("for", select.id);
      fillGoodsSelect(select, block.goodsId);
      select.addEventListener("change", function () {
        block.goodsId = this.value;
        block.variant = "";
        renderBlocks();
        refresh();
      });

      node.querySelector(".block-note").textContent = goods ? goodsNote(goods) : "";

      // 種別（1st / 2nd）は商品が持つときだけ出す
      var variantField = node.querySelector(".block-variant-field");
      var variants = (goods && goods.variants) || [];
      if (variants.length) {
        variantField.hidden = false;
        var chips = node.querySelector(".block-variants");
        [""].concat(variants).forEach(function (variant) {
          var chip = document.createElement("button");
          chip.type = "button";
          chip.className = "chip";
          chip.textContent = variant === "" ? "指定しない" : variant;
          chip.setAttribute("aria-pressed", String(block.variant === variant));
          chip.addEventListener("click", function () {
            block.variant = variant;
            renderBlocks();
            refresh();
          });
          chips.appendChild(chip);
        });
      }

      node.querySelector(".block-offer-count").textContent = String(block.offer.length);
      node.querySelector(".block-want-count").textContent = String(block.want.length);

      fillNumbers(node.querySelector(".block-offer"), block.offer, function (number) {
        toggle(block.offer, number);
        renderBlocks();
        refresh();
      });
      fillNumbers(node.querySelector(".block-want"), block.want, function (number) {
        toggle(block.want, number);
        renderBlocks();
        refresh();
      });

      host.appendChild(root);
    });
  }

  function renderMatches() {
    var box = $("matches");
    box.textContent = "";
    upcomingMatches().forEach(function (match) {
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
        refresh();
      });
      box.appendChild(button);
    });
  }

  // --- 投稿文 -------------------------------------------------------------
  function blockLines(block) {
    var goods = findGoods(block.goodsId);
    if (!goods) { return []; }
    var name = goods.name + (block.variant ? "（" + block.variant + "）" : "");
    var lines = [];
    if (block.offer.length) {
      lines.push("譲）" + name + " " + numberList(block.offer));
      // 「同種」＝いま挙げた商品と同じもの。組の中で商品名を繰り返さずに済む。
      if (block.want.length) { lines.push("求）同種 " + numberList(block.want)); }
    } else if (block.want.length) {
      lines.push("求）" + name + " " + numberList(block.want));
    }
    return lines;
  }

  function compose() {
    var lines = ["【交換】京都サンガ"];

    state.blocks.forEach(function (block) {
      lines = lines.concat(blockLines(block));
    });

    var tail = [];
    state.matches.forEach(function (id) {
      for (var i = 0; i < data.matches.length; i++) {
        if (data.matches[i].id === id) { tail.push(matchLabel(data.matches[i])); }
      }
    });
    if ($("by-mail").checked) { tail.push("郵送も可"); }
    if (tail.length) { lines.push("", tail.join(" / ")); }

    var extra = $("extra").value.trim();
    if (extra) { if (!tail.length) { lines.push(""); } lines.push(extra); }

    if ($("add-invite").checked) {
      if (!tail.length && !extra) { lines.push(""); }
      lines.push(INVITE);
    }

    if ($("add-tags").checked) {
      var tags = [];
      state.blocks.forEach(function (block) {
        var goods = findGoods(block.goodsId);
        (goods && goods.tags ? goods.tags : []).forEach(function (tag) {
          if (tags.indexOf(tag) === -1) { tags.push(tag); }
        });
      });
      if (data.hashtags.indexOf("#京都サンガ") !== -1 && tags.indexOf("#京都サンガ") === -1) {
        tags.push("#京都サンガ");
      }
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

  // --- 画像 ---------------------------------------------------------------
  // Xでは文章より画像が先に見られる。番号の羅列はテキストだと読みにくいので、
  // 譲・求を色で分けて並べる。canvasの2Dだけで描くので、外部ライブラリを足さない。
  var CARD = {
    bg: "#fbf9fc",
    ink: "#1c1220",
    weak: "#5c5364",
    accent: "#5b1f7e",
    offer: "#14532d",
    want: "#8a1f6b"
  };

  function drawChips(ctx, numbers, color, x, y, maxWidth) {
    var size = 62;
    var gap = 10;
    var cursorX = x;
    var cursorY = y;
    numbers.forEach(function (number) {
      ctx.font = "bold 30px system-ui, sans-serif";
      var width = Math.max(size, ctx.measureText(number).width + 28);
      if (cursorX + width > x + maxWidth) {
        cursorX = x;
        cursorY += size + gap;
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      // roundRect は iOS Safari 16.4 より前に無い。角丸は飾りなので、無ければ角のまま描く。
      if (ctx.roundRect) {
        ctx.roundRect(cursorX, cursorY, width, size, 12);
      } else {
        ctx.rect(cursorX, cursorY, width, size);
      }
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(number, cursorX + width / 2, cursorY + size / 2 + 1);
      cursorX += width + gap;
    });
    // 呼び出し側が左揃えで描き続けられるように戻す
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    return cursorY + size;
  }

  function drawCard() {
    var canvas = document.createElement("canvas");
    canvas.width = CARD_WIDTH;
    canvas.height = CARD_HEIGHT;
    var ctx = canvas.getContext("2d");

    ctx.fillStyle = CARD.bg;
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
    ctx.fillStyle = CARD.accent;
    ctx.fillRect(0, 0, CARD_WIDTH, 12);

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = CARD.accent;
    ctx.font = "bold 42px system-ui, sans-serif";
    ctx.fillText("京都サンガ　交換", 56, 84);

    var id = $("card-id").value.trim();
    if (id) {
      ctx.textAlign = "right";
      ctx.fillStyle = CARD.weak;
      ctx.font = "28px system-ui, sans-serif";
      ctx.fillText(id, CARD_WIDTH - 56, 84);
      ctx.textAlign = "left";
    }

    var y = 140;
    state.blocks.forEach(function (block) {
      var goods = findGoods(block.goodsId);
      if (!goods) { return; }
      if (!block.offer.length && !block.want.length) { return; }
      if (y > CARD_HEIGHT - 120) { return; }

      ctx.fillStyle = CARD.ink;
      ctx.font = "bold 30px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(goods.name + (block.variant ? "（" + block.variant + "）" : ""), 56, y);
      y += 20;

      [["譲", block.offer, CARD.offer], ["求", block.want, CARD.want]].forEach(function (row) {
        if (!row[1].length) { return; }
        ctx.fillStyle = row[2];
        ctx.font = "bold 34px system-ui, sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(row[0], 56, y + 31);
        y = drawChips(ctx, row[1].slice().sort(function (a, b) {
          return Number(a) - Number(b);
        }), row[2], 110, y, CARD_WIDTH - 170) + 14;
      });
      y += 18;
    });

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = CARD.weak;
    ctx.font = "26px system-ui, sans-serif";
    var footer = [];
    state.matches.forEach(function (matchId) {
      for (var i = 0; i < data.matches.length; i++) {
        if (data.matches[i].id === matchId) { footer.push(matchLabel(data.matches[i])); }
      }
    });
    if ($("by-mail").checked) { footer.push("郵送も可"); }
    if (footer.length) { ctx.fillText(footer.join(" / "), 56, CARD_HEIGHT - 44); }

    var url = canvas.toDataURL("image/png");
    $("card").src = url;
    $("save-card").href = url;
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
    var goods = findGoods(state.findGoodsId);
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
    $("find-count").textContent = String(state.find.length);
    $("find-yahoo").href =
      "https://search.yahoo.co.jp/realtime/search?ei=UTF-8&p=" + encodeURIComponent(query);
    $("find-x").href = "https://x.com/search?f=live&q=" + encodeURIComponent(query);
  }

  function renderFindNumbers() {
    fillNumbers($("find-numbers"), state.find, function (number) {
      toggle(state.find, number);
      renderFindNumbers();
      renderFind();
    });
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

  function refresh() {
    compose();
    drawCard();
  }

  // --- 起動 ---------------------------------------------------------------
  function bind() {
    $("tab-make").addEventListener("click", function () { showPanel("make"); });
    $("tab-find").addEventListener("click", function () { showPanel("find"); });

    $("add-block").addEventListener("click", function () {
      state.blocks.push(newBlock());
      renderBlocks();
      refresh();
    });

    ["by-mail", "add-invite", "add-tags"].forEach(function (id) {
      $(id).addEventListener("change", refresh);
    });
    $("extra").addEventListener("input", compose);
    $("card-id").addEventListener("input", drawCard);
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

    state.blocks = [newBlock()];
    state.findGoodsId = data.goods[0].id;

    fillGoodsSelect($("find-goods"), state.findGoodsId);
    renderBlocks();
    renderMatches();
    renderFindNumbers();
    renderFindTags();
    bind();
    refresh();
    renderFind();
  });
}());
