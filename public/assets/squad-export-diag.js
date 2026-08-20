// 画像生成の崩れ（iPhone Safari など）を切り分けるための一時的な診断モジュール。
//
// squad.html に ?diag=1 を付けて開いたときだけ読み込まれる。
// 実際のキャンバスに対して、条件を1つずつ変えながらPNGを生成し、結果を並べて表示する。
// 原因が特定できたら、このファイルと squad.html 側の読み込み分岐は削除する。
import { domToPng } from "./vendor/modern-screenshot/modern-screenshot.mjs?v=20260820-8";

/** 切り分けたい条件。css は生成の間だけ適用する */
const CASES = [
  { id: "A", name: "そのまま（現状）", why: "比較用の基準", css: "" },
  {
    id: "D1",
    name: "カードの影だけ消す",
    why: "`.card` の drop-shadow が原因か（カード右の大きな影に対応）",
    css: `#canvas .card{filter:none}`,
  },
  {
    id: "D2",
    name: "ポジション表示の影だけ消す",
    why: "`.pos-pill` の box-shadow が原因か（影が右に寄る症状に対応）",
    css: `#canvas .pos-pill{box-shadow:none}`,
  },
  {
    id: "D3",
    name: "国旗の影だけ消す",
    why: "`.flag` の drop-shadow が原因か",
    css: `#canvas .flag{filter:none}`,
  },
  {
    id: "D4",
    name: "ピッチの内側の影だけ消す",
    why: "`.pitch-vignette` の inset box-shadow が原因か",
    css: `#canvas .pitch-vignette{box-shadow:none}`,
  },
  {
    id: "D5",
    name: "ピッチの外枠の影だけ消す",
    why: "`.pitch` の box-shadow が原因か",
    css: `#canvas .pitch{box-shadow:none}`,
  },
  {
    id: "D6",
    name: "カードとポジション表示の影を消す",
    why: "D1とD2の組み合わせ。これで直れば対策範囲は最小で済む",
    css: `#canvas .card{filter:none}
          #canvas .pos-pill{box-shadow:none}`,
  },
  {
    id: "G",
    name: "影の描き方を変える（本命の対策案）",
    why: "カード・ポジション・国旗の影は消し（Chromeでは見た目が変わらないことを確認済み）、ピッチの内側の影はグラデーションで描き直した案。これが崩れなければ、いまの見た目を保ったまま直せる",
    css: `#canvas .card{filter:none}
          #canvas .pos-pill{box-shadow:none}
          #canvas .flag{filter:none}
          #canvas .pitch-vignette{
            box-shadow:none;
            background:
              linear-gradient(to right, rgba(3,12,7,.85), rgba(3,12,7,0) 14%, rgba(3,12,7,0) 86%, rgba(3,12,7,.85)),
              linear-gradient(to bottom, rgba(3,12,7,.85), rgba(3,12,7,0) 9%, rgba(3,12,7,0) 91%, rgba(3,12,7,.85));
          }`,
  },
];

export function setupExportDiag(canvasEl) {
  const panel = document.createElement("section");
  panel.className = "panel diag-panel";
  panel.innerHTML = `
    <h2>画像生成の切り分け（診断モード）</h2>
    <p class="field-note">
      同じ内容を、CSSの条件だけ変えて生成します。生成された画像を見比べて、
      崩れていないものの記号を教えてください。スタイルと選手は、いまの画面の設定がそのまま使われます。
    </p>
    <button type="button" class="btn primary" id="diag-run">8通りの画像を生成する</button>
    <p class="export-status" id="diag-status" role="status"></p>
    <div id="diag-cases"></div>`;
  document.querySelector(".canvas-wrap").appendChild(panel);

  const casesEl = panel.querySelector("#diag-cases");
  CASES.forEach((c) => {
    const box = document.createElement("div");
    box.className = "diag-case";
    box.innerHTML = `<h3>${c.id}. ${c.name}</h3><p class="field-note">${c.why}</p>
                     <div class="diag-out" id="diag-out-${c.id}">未生成</div>`;
    casesEl.appendChild(box);
  });

  panel.querySelector("#diag-run").addEventListener("click", async () => {
    const btn = panel.querySelector("#diag-run");
    const status = panel.querySelector("#diag-status");
    btn.disabled = true;
    for (const c of CASES) {
      status.textContent = `${c.id} を生成しています…`;
      const styleEl = document.createElement("style");
      styleEl.textContent = c.css;
      document.head.appendChild(styleEl);
      const out = panel.querySelector(`#diag-out-${c.id}`);
      try {
        if (document.fonts && document.fonts.ready) await document.fonts.ready;
        const url = await domToPng(canvasEl, {
          scale: 2,
          backgroundColor: getComputedStyle(canvasEl).backgroundColor || "#0b0b12",
        });
        out.innerHTML = "";
        const img = new Image();
        img.src = url;
        img.alt = `${c.id} の生成結果`;
        out.appendChild(img);
      } catch (err) {
        out.textContent = "生成に失敗しました: " + (err && err.message ? err.message : String(err));
      } finally {
        document.head.removeChild(styleEl);
      }
    }
    status.textContent = "生成が終わりました。崩れていないものの記号を教えてください。";
    btn.disabled = false;
  });
}
