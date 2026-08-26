// 入口ページ プロトタイプ
//
// tools.json からカードを組み立てる方式（docs/site-index.md）を、
// 本番実装の前に確認するためのもの。
//
// 確認したいこと
//  - データ駆動でセクション分けが破綻しないか
//  - 読み込みに失敗したとき、導線が消えずに残るか

const SECTIONS = [
  { id: "primary", title: "ツール", note: "" },
  { id: "secondary", title: "そのほかの道具", note: "" },
  { id: "archive", title: "過去のページ", note: "更新は終了していますが、そのまま残しています。" },
];

const DATA_URL = "tools.sample.json";

async function loadTools() {
  const response = await fetch(DATA_URL);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const data = await response.json();
  if (!Array.isArray(data.tools)) throw new Error("tools が配列ではありません");
  return data.tools;
}

function buildCard(tool) {
  const item = document.createElement("li");
  const link = document.createElement("a");
  link.className = "card";
  link.href = tool.href;

  const name = document.createElement("span");
  name.className = "card-name";
  name.textContent = tool.name;
  link.append(name);

  const desc = document.createElement("span");
  desc.className = "card-desc";
  desc.textContent = tool.description;
  link.append(desc);

  // 主要ツールと補助ツールにだけ矢印を出す。過去のページはCSS側で隠す
  const go = document.createElement("span");
  go.className = "card-go";
  go.setAttribute("aria-hidden", "true");
  go.innerHTML = '<svg viewBox="0 0 12 12" focusable="false"><path d="M2 6h8M6.6 2.6 10 6 6.6 9.4"/></svg>';
  link.append(go);

  if (tool.updatedNote) {
    const note = document.createElement("span");
    note.className = "card-note";
    note.textContent = tool.updatedNote;
    link.append(note);
  }

  item.append(link);
  return item;
}

function buildSection(section, tools) {
  const wrapper = document.createElement("section");
  wrapper.className = `section section-${section.id}`;

  const title = document.createElement("h2");
  title.className = "section-title";
  title.textContent = section.title;
  wrapper.append(title);

  if (section.note) {
    const note = document.createElement("p");
    note.className = "section-note";
    note.textContent = section.note;
    wrapper.append(note);
  }

  const list = document.createElement("ul");
  list.className = "card-list";
  for (const tool of tools) list.append(buildCard(tool));
  wrapper.append(list);

  return wrapper;
}

function render(tools) {
  const main = document.querySelector("#tools");
  const fragment = document.createDocumentFragment();

  for (const section of SECTIONS) {
    const inSection = tools.filter((tool) => tool.section === section.id);
    if (inSection.length === 0) continue;
    fragment.append(buildSection(section, inSection));
  }

  // 読み込めたときだけ noscript 相当の暫定表示を置き換える。
  // 失敗した場合は触らないので、素のリンクが残る。
  main.textContent = "";
  main.append(fragment);
}

loadTools()
  .then(render)
  .catch((error) => {
    console.error("[site-index] ツール一覧を読み込めませんでした:", error);
    // 導線を消さない。noscript の内容を明示的に出す
    const main = document.querySelector("#tools");
    if (main.querySelector(".card-list")) return;
    main.innerHTML = document.querySelector("noscript").textContent;
  });
