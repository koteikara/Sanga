// 入口ページ プロトタイプ
//
// tools.json からカードを組み立てる方式（docs/site-index.md）を、
// 本番実装の前に確認するためのもの。
//
// 構成はポートフォリオサイトの並べ方に寄せている。
// 見出しで区切らず、作品を等間隔のグリッドに流し、
// 分類はカード下のタグで示す。

const DATA_URL = "tools.sample.json";

async function loadTools() {
  const response = await fetch(DATA_URL);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const data = await response.json();
  if (!Array.isArray(data.tools)) throw new Error("tools が配列ではありません");
  return data.tools;
}

function buildWork(tool, index) {
  const item = document.createElement("li");
  item.className = "work";
  // 出現をずらす。まとめて現れると機械的に見える
  item.style.setProperty("--delay", `${(index % 2) * 90}ms`);

  const link = document.createElement("a");
  link.className = "work-link";
  link.href = tool.href;

  const thumb = document.createElement("span");
  thumb.className = "work-thumb";
  if (tool.accent) thumb.style.setProperty("--accent", tool.accent);

  if (tool.thumb) {
    const img = document.createElement("img");
    img.src = tool.thumb;
    img.loading = "lazy";
    img.decoding = "async";
    img.width = 344;
    img.height = 704;
    // 隣のツール名がそのまま説明になるので、画像側は装飾として扱う
    img.alt = "";
    thumb.append(img);
  }
  link.append(thumb);

  const name = document.createElement("span");
  name.className = "work-name";
  name.textContent = tool.name;
  link.append(name);

  const desc = document.createElement("span");
  desc.className = "work-desc";
  desc.textContent = tool.description;
  link.append(desc);

  item.append(link);
  return item;
}

function buildGrid(tools) {
  const list = document.createElement("ul");
  list.className = "work-grid";
  tools.forEach((tool, index) => list.append(buildWork(tool, index)));
  return list;
}

// スクロールに合わせて浮かび上がらせる。transform と opacity だけを動かす
function observeWorks(root) {
  // IntersectionObserver が無ければ演出そのものを使わない。
  // reveal-ready を付けないので、カードは最初から見えたままになる。
  if (!("IntersectionObserver" in window)) return;
  root.classList.add("reveal-ready");

  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("is-in");
      io.unobserve(entry.target);
    }
  }, { rootMargin: "0px 0px -8% 0px" });
  for (const el of root.querySelectorAll(".work")) io.observe(el);
}

function render(tools) {
  const live = tools.filter((tool) => tool.section !== "archive");
  const archive = tools.filter((tool) => tool.section === "archive");

  const main = document.querySelector("#works");
  const fragment = document.createDocumentFragment();
  fragment.append(buildGrid(live));

  if (archive.length > 0) {
    const section = document.createElement("section");
    section.className = "archive";
    section.id = "archive";

    const title = document.createElement("h2");
    title.className = "archive-title";
    title.textContent = "ARCHIVE";
    section.append(title);

    const note = document.createElement("p");
    note.className = "archive-note";
    note.textContent = "更新は終了していますが、そのまま残しています。";
    section.append(note);

    section.append(buildGrid(archive));
    fragment.append(section);
  }

  // 読み込めたときだけ暫定表示を置き換える。失敗した場合は触らない
  main.textContent = "";
  main.append(fragment);
  observeWorks(main);
}

loadTools()
  .then(render)
  .catch((error) => {
    console.error("[site-index] ツール一覧を読み込めませんでした:", error);
    // 導線を消さない。noscript の内容を明示的に出す
    const main = document.querySelector("#works");
    if (main.querySelector(".work-grid")) return;
    main.innerHTML = document.querySelector("noscript").textContent;
  });
