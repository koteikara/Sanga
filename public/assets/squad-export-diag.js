// 画像生成の崩れ（iPhone Safari など）を切り分けるための一時的な診断モジュール。
//
// squad.html に ?diag=1 を付けて開いたときだけ読み込まれる。
// 実際のキャンバスに対して、条件を1つずつ変えながらPNGを生成し、結果を並べて表示する。
// 原因が特定できたら、このファイルと squad.html 側の読み込み分岐は削除する。
import { domToPng } from "./vendor/modern-screenshot/modern-screenshot.mjs?v=20260820-6";

/** 切り分けたい条件。css は生成の間だけ適用する */
const CASES = [
  { id: "A", name: "そのまま（現状）", why: "比較用の基準", css: "" },
  {
    id: "B",
    name: "カードの光沢の合成をやめる",
    why: "mix-blend-mode:screen（カード表面の斜めの光沢）が原因か",
    css: `#canvas .card::after{mix-blend-mode:normal;opacity:.28}`,
  },
  {
    id: "C",
    name: "影の単位を cqw から px に変える",
    why: "コンテナ単位（cqw）で書いた影・ぼかしが原因か",
    css: `#canvas .card{filter:drop-shadow(0 20px 36px rgba(0,0,0,.55))}
          #canvas .pos-pill{box-shadow:0 1px 2px rgba(0,0,0,.45)}
          #canvas .flag{filter:drop-shadow(0 4px 8px rgba(0,0,0,.5))}
          #canvas .pitch-vignette{box-shadow:inset 0 0 48px 20px rgba(3,12,7,.85)}`,
  },
  {
    id: "D",
    name: "影を全部消す",
    why: "影そのものが原因か（見た目は平たくなります）",
    css: `#canvas .card{filter:none}
          #canvas .pos-pill{box-shadow:none}
          #canvas .flag{filter:none}
          #canvas .pitch-vignette{box-shadow:none}
          #canvas .pitch{box-shadow:none}`,
  },
  {
    id: "E",
    name: "ポジション表示のずらしをやめる",
    why: "pos-pill の position:relative / top:-1.6cqw が原因か",
    css: `#canvas .pos-pill{position:static;top:auto;margin-top:-1.6cqw;margin-bottom:1.6cqw}`,
  },
  {
    id: "F",
    name: "B・C・E をまとめて適用",
    why: "個別では直らない場合に、まとめてなら直るか",
    css: `#canvas .card::after{mix-blend-mode:normal;opacity:.28}
          #canvas .card{filter:drop-shadow(0 20px 36px rgba(0,0,0,.55))}
          #canvas .pos-pill{box-shadow:0 1px 2px rgba(0,0,0,.45);position:static;top:auto;margin-top:-1.6cqw;margin-bottom:1.6cqw}
          #canvas .flag{filter:drop-shadow(0 4px 8px rgba(0,0,0,.5))}
          #canvas .pitch-vignette{box-shadow:inset 0 0 48px 20px rgba(3,12,7,.85)}`,
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
    <button type="button" class="btn primary" id="diag-run">6通りの画像を生成する</button>
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
