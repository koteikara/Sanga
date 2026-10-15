// 入口ページ。
//
// カードは tools/build-seo.mjs が public/data/tools.json から index.html に
// 先に書いている（検索エンジンとJavaScriptなしの人にも一覧が見えるように）。
// ここではその出現演出だけを付ける。
//
// 事前出力が無いHTML（古い版など）のときだけ、従来どおり tools.json を読んで
// カードを組み立てる。

// 本番サーバーとGitHub Pagesでルートが異なるため、絶対パスと相対パスの
// 順で試す。squad-builder.js と同じ方式。
// ?v= は tools/asset-versions.mjs が tools.json の内容ハッシュへ書き換える。
const DATA_CANDIDATES = [
  "/data/tools.json?v=37ad57d8",
  "data/tools.json?v=37ad57d8",
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
      // 次の候補へ
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

// tools/build-seo.mjs が index.html にカードを先に書いている。あればそれを使い、
// 作り直さない（検索エンジンとJavaScriptなしの人にも同じ一覧が見える）。
// 無いとき（古いHTMLやカード生成前）だけ tools.json から組み立てる。
const prerendered = document.querySelector("#works .work-grid");
if (prerendered) {
  observeWorks(document.querySelector("#works"));
} else loadTools()
  .then(render)
  .catch((error) => {
    console.error("[site-index] ツール一覧を読み込めませんでした:", error);
    // 古いHTMLに noscript があれば、その素のリンク一覧を出して導線を残す
    const main = document.querySelector("#works");
    const noscript = main.querySelector("noscript");
    if (noscript) main.innerHTML = noscript.textContent;
  });
