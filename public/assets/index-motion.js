// 動きの設定。
//
// OSの「動きを減らす」設定を既定にしつつ、このページの中でも切り替えられる
// ようにする。OSの設定をしていない人には、これまで動きを止める手段が
// 無かったため。
//
// 決めた値は <html data-motion="on|off"> として置き、CSSはこの属性だけを
// 見る。JavaScriptが動かない環境では属性が付かないので、CSS側は
// prefers-reduced-motion を直接見る側の指定で受ける。

const STORAGE_KEY = "site-index:motion";
const QUERY = "(prefers-reduced-motion: reduce)";

const media = window.matchMedia(QUERY);

// "auto" はOSの設定に従う。利用者が明示的に選ぶと "on" か "off" になる
let mode = readStoredMode();

function readStoredMode() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "on" || stored === "off" ? stored : "auto";
  } catch {
    // プライベートウィンドウなど、読めない環境がある。既定に落とす
    return "auto";
  }
}

function storeMode(value) {
  try {
    if (value === "auto") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // 保存できなくても、このページを開いているあいだは効く
  }
}

/** 動きを止めるべきか */
export function isReduced() {
  if (mode === "off") return true;
  if (mode === "on") return false;
  return media.matches;
}

export function getMode() {
  return mode;
}

function apply() {
  document.documentElement.dataset.motion = isReduced() ? "off" : "on";
  // nebula.js など、CSS以外で動いているものへ伝える
  window.dispatchEvent(new CustomEvent("motionchange", { detail: { reduced: isReduced() } }));
}

/** "on" か "off" を明示的に選ぶ。"auto" でOSの設定へ戻す */
export function setMode(next) {
  mode = next === "on" || next === "off" ? next : "auto";
  storeMode(mode);
  apply();
}

export function toggle() {
  setMode(isReduced() ? "on" : "off");
}

// OSの設定が変わったとき、利用者が選んでいなければ追随する
media.addEventListener("change", () => {
  if (mode === "auto") apply();
});

apply();
