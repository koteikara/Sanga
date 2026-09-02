// 入口ページ。
//
// public/data/tools.json を読み、カードを組み立てる。
// ツールの追加・削除・文言変更をHTMLの編集なしで行えるようにするため。
//
// 読み込みに失敗しても導線を消さない。index.html の noscript に書いた
// 素のリンク一覧をそのまま残す。

// 本番サーバーとGitHub Pagesでルートが異なるため、絶対パスと相対パスの
// 順で試す。squad-builder.js と同じ方式。
// ?v= は tools/asset-versions.mjs が tools.json の内容ハッシュへ書き換える。
const DATA_CANDIDATES = [
  "/data/tools.json?v=50f52482",
  "data/tools.json?v=50f52482",
];

async function loadTools() {
  for (const url of DATA_CANDIDATES) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) continue;
      const data = await response.json();
      if (Array.isArray(data.tools) && data.tools.length > 0) {
        console.info("[site-index] tools.json を読み込みました:", url);
        return data.tools;
      }
    } catch (error) {
      // 次の候補へ。全滅したら noscript の内容を残す
    }
  }
  throw new Error("tools.json を読み込めません");
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

// スクロールに合わせて浮かび上がらせる。transform と opacity だけを動かす。
// IntersectionObserver が無ければ演出そのものを使わない。reveal-ready を
// 付けないので、カードは最初から見えたままになる。
function observeWorks(root) {
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
