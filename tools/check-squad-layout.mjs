// スカッド画像のレイアウト検証（docs/squad-bench-pitch-overlap-plan.md §5 の受け入れ条件）
//
// 実ブラウザでピッチ上のカードの重なり・はみ出し・ベンチの見切れを確認する。
// Playwright はこのリポジトリの依存ではないため、手元にある場合のみ実行できる。
//
//   npx http-server public -p 8123 -s &
//   node tools/check-squad-layout.mjs
//
// 環境変数:
//   BASE_URL  既定 http://127.0.0.1:8123/squad.html
//   FORMS     カンマ区切りでフォーメーションを限定（既定は全件）
//   VERBOSE   1 で成功した組み合わせも表示する
//   PLAYWRIGHT_MODULE  グローバル導入のPlaywrightを使う場合のimport先
//                      （例: /usr/lib/node_modules/playwright/index.mjs）
let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch (err) {
  if (!process.env.PLAYWRIGHT_MODULE) {
    console.error(
      "Playwrightが見つかりません。`npm i -D playwright` を実行するか、" +
        "PLAYWRIGHT_MODULE にグローバル導入先のパスを指定してください。"
    );
    process.exit(2);
  }
  ({ chromium } = await import(process.env.PLAYWRIGHT_MODULE));
}

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:8123/squad.html";
const FORMS = process.env.FORMS ? process.env.FORMS.split(",") : null;
const WIDTHS = [320, 375, 420];
const BENCH_COUNTS = [0, 5, 9, 12];
/** カード高さの下限（squad-builder.js の CARD_H_MIN と合わせる） */
const CARD_H_MIN = 70;

const browser = await chromium.launch();
let ng = 0;

for (const width of WIDTHS) {
  const page = await browser.newPage({ viewport: { width, height: 1400 } });
  await page.goto(BASE_URL);
  await page.waitForFunction(() => document.querySelectorAll("#pitch .player").length === 11);
  const all = await page.evaluate(() =>
    [...document.querySelectorAll("#formation-grid .btn")].map((b) => b.textContent.trim())
  );

  for (const count of BENCH_COUNTS) {
    await page.evaluate((n) => {
      // いったん控えを空にしてから、n人ぶん追加する
      let guard = 0;
      while (document.querySelector(".bench-edit-remove") && guard++ < 50) {
        document.querySelector(".bench-edit-remove").click();
      }
      for (let i = 0; i < n; i++) {
        document.querySelector(".bench-edit-add").click();
        const item = document.querySelector("#picker-list .picker-item:not(.is-used)");
        if (item) item.click();
      }
    }, count);
    await page.waitForTimeout(150);

    for (const key of FORMS || all) {
      await page.evaluate((k) => {
        [...document.querySelectorAll("#formation-grid .btn")]
          .find((x) => x.textContent.trim() === k)
          ?.click();
      }, key);
      await page.waitForTimeout(120);

      const r = await page.evaluate(() => {
        const pitchEl = document.querySelector("#pitch");
        const pitch = pitchEl.getBoundingClientRect();
        const footer = document.querySelector(".sq-footer").getBoundingClientRect();
        const canvas = document.querySelector("#canvas").getBoundingClientRect();
        const cardH = parseFloat(getComputedStyle(pitchEl).getPropertyValue("--card-h"));
        const rects = [...document.querySelectorAll("#pitch .player")].map((el) => {
          const b = el.getBoundingClientRect();
          return { l: b.left, r: b.right, t: b.top, b: b.bottom };
        });
        let overlaps = 0;
        for (let i = 0; i < rects.length; i++) {
          for (let j = i + 1; j < rects.length; j++) {
            const a = rects[i];
            const c = rects[j];
            // 1px はサブピクセル丸めの許容
            if (Math.min(a.r, c.r) - Math.max(a.l, c.l) > 1 && Math.min(a.b, c.b) - Math.max(a.t, c.t) > 1) {
              overlaps++;
            }
          }
        }
        const outside = rects.filter(
          (a) => a.l < pitch.left - 1 || a.r > pitch.right + 1 || a.t < pitch.top - 1 || a.b > pitch.bottom + 1
        ).length;
        return {
          cardH,
          overlaps,
          outside,
          benchClipped: document.querySelector("#bench").scrollHeight > footer.height + 1,
          pitchPct: +((pitch.height / canvas.height) * 100).toFixed(1),
          footPct: +((footer.height / canvas.height) * 100).toFixed(1),
        };
      });

      const failed = r.overlaps > 0 || r.outside > 0 || r.benchClipped;
      if (failed) ng++;
      if (failed || process.env.VERBOSE) {
        const note = r.cardH < CARD_H_MIN - 0.1 ? " [下限70px未達＝そのフォーメーションの幾何的上限]" : "";
        console.log(
          `${failed ? "NG" : "ok"} w=${width} bench=${count} ${key.padEnd(9)} ` +
            `cardH=${r.cardH.toFixed(1)} 重なり=${r.overlaps} はみ出し=${r.outside} ` +
            `見切れ=${r.benchClipped} pitch=${r.pitchPct}% footer=${r.footPct}%${note}`
        );
      }
    }
  }
  await page.close();
}

await browser.close();
console.log(ng === 0 ? "ALL OK" : `NG ${ng} 件`);
process.exit(ng === 0 ? 0 : 1);
