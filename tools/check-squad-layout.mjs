// スカッド画像のレイアウト検証（docs/archive/implementation/squad-bench-pitch-overlap-plan.md §5 の受け入れ条件）
//
// 実ブラウザでピッチ上のカードの重なり・はみ出し・ベンチの見切れを確認する。
// Playwright はこのリポジトリの依存ではないため、手元にある場合のみ実行できる。
//
//   python3 -m http.server 8123 --directory public &
//   node tools/check-squad-layout.mjs
//
// 環境変数:
//   BASE_URL  既定 http://127.0.0.1:8123/squad.html
//   FORMS     カンマ区切りでフォーメーションを限定（既定は全件）
//   STYLES    カンマ区切りでスタイルを限定（既定は全件）
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
const FORMS = parseList(process.env.FORMS);
const STYLES = parseList(process.env.STYLES);
const WIDTHS = [320, 375, 420];
const BENCH_COUNTS = [0, 5, 9, 12];
const EXPECTED_FORMATION_COUNT = 17;
const EXPECTED_STYLE_COUNT = 8;
const EXPECTED_PITCH_PLAYER_COUNT = 11;
/** カード高さの下限（squad-builder.js の CARD_H_MIN と合わせる） */
const CARD_H_MIN = 70;

function parseList(value) {
  return value
    ? value.split(",").map((item) => item.trim()).filter(Boolean)
    : null;
}

function assertRequestedValues(label, requested, available) {
  if (!requested) return;
  const missing = requested.filter((value) => !available.includes(value));
  if (missing.length > 0) {
    throw new Error(`${label} に存在しない値が指定されました: ${missing.join(", ")}`);
  }
}

async function waitForLayout(page) {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  );
}

async function fillStartingEleven(page) {
  await page.evaluate((expected) => {
    for (let index = 0; index < expected; index++) {
      const button = document.querySelectorAll("#pitch .player .select-btn")[index];
      if (!button) throw new Error(`スタメン枠${index + 1}を選択できませんでした`);
      button.click();
      const item = document.querySelector("#picker-list .picker-item:not(.is-used)");
      if (!item) throw new Error(`スタメン${expected}人を設定できませんでした`);
      item.click();
    }
  }, EXPECTED_PITCH_PLAYER_COUNT);
  await waitForLayout(page);

  const filled = await page.locator("#pitch .player:not(.is-empty)").count();
  if (filled !== EXPECTED_PITCH_PLAYER_COUNT) {
    throw new Error(
      `スタメン人数が一致しません: 期待=${EXPECTED_PITCH_PLAYER_COUNT}, 実際=${filled}`
    );
  }
}

const browser = await chromium.launch({ headless: true });
let ng = 0;
let checked = 0;

try {
  for (const width of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height: 1400 } });
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    const response = await page.goto(BASE_URL);
    if (!response || !response.ok()) {
      throw new Error(`スカッドページを読み込めません: ${response?.status() ?? "応答なし"}`);
    }
    await page.waitForFunction(
      (expected) => document.querySelectorAll("#pitch .player").length === expected,
      EXPECTED_PITCH_PLAYER_COUNT
    );

    const inventory = await page.evaluate(() => ({
      forms: [...document.querySelectorAll("#formation-grid .btn")].map((button) => button.textContent.trim()),
      styles: [...document.querySelectorAll("#field-style option")].map((option) => option.value),
    }));

    if (inventory.forms.length !== EXPECTED_FORMATION_COUNT) {
      throw new Error(
        `フォーメーションは${EXPECTED_FORMATION_COUNT}件を想定しています: ${inventory.forms.length}件`
      );
    }
    if (inventory.styles.length !== EXPECTED_STYLE_COUNT) {
      throw new Error(`スタイルは${EXPECTED_STYLE_COUNT}件を想定しています: ${inventory.styles.length}件`);
    }

    assertRequestedValues("FORMS", FORMS, inventory.forms);
    assertRequestedValues("STYLES", STYLES, inventory.styles);
    const forms = FORMS || inventory.forms;
    const styles = STYLES || inventory.styles;

    // 空スロットでは名前やポジション表示の寸法が実利用時と異なるため、
    // 11人を配置してから全レイアウトを検証する。
    await fillStartingEleven(page);

    for (const count of BENCH_COUNTS) {
      await page.evaluate((n) => {
        let guard = 0;
        while (document.querySelector(".bench-edit-remove") && guard++ < 50) {
          document.querySelector(".bench-edit-remove").click();
        }
        for (let i = 0; i < n; i++) {
          document.querySelector(".bench-edit-add").click();
          const item = document.querySelector("#picker-list .picker-item:not(.is-used)");
          if (!item) throw new Error(`控え${n}人を設定できませんでした`);
          item.click();
        }
      }, count);
      await waitForLayout(page);

      const actualBenchCount = await page.locator(".bench-edit-remove").count();
      if (actualBenchCount !== count) {
        throw new Error(`控え人数が一致しません: 期待=${count}, 実際=${actualBenchCount}`);
      }

      for (const style of styles) {
        await page.selectOption("#field-style", style);
        await waitForLayout(page);

        for (const key of forms) {
          await page.evaluate((formationLabel) => {
            const button = [...document.querySelectorAll("#formation-grid .btn")]
              .find((candidate) => candidate.textContent.trim() === formationLabel);
            if (!button) throw new Error(`フォーメーションが見つかりません: ${formationLabel}`);
            button.click();
          }, key);
          await waitForLayout(page);

          const result = await page.evaluate(() => {
            const pitchEl = document.querySelector("#pitch");
            // scrapbook はピッチ全体を回転する。画面座標の外接矩形同士を比べると、
            // 内部に収まっているカードも「はみ出し」と誤判定するため、ピッチの
            // ローカル座標系（回転なし）でカードの収まりを測る。
            const inlineTransform = pitchEl.style.getPropertyValue("transform");
            const inlineTransformPriority = pitchEl.style.getPropertyPriority("transform");
            pitchEl.style.setProperty("transform", "none", "important");
            const pitch = pitchEl.getBoundingClientRect();
            const footer = document.querySelector(".sq-footer").getBoundingClientRect();
            const canvas = document.querySelector("#canvas").getBoundingClientRect();
            const cardH = parseFloat(getComputedStyle(pitchEl).getPropertyValue("--card-h"));
            const players = [...document.querySelectorAll("#pitch .player")];
            const visibleRects = players.map((player, playerIndex) =>
              [...player.querySelectorAll(".card, .name-ja, .pos-pill")]
                .filter((element) => {
                  const style = getComputedStyle(element);
                  return (
                    style.display !== "none" &&
                    style.visibility !== "hidden" &&
                    Number.parseFloat(style.opacity || "1") > 0
                  );
                })
                .map((element) => {
                  const bounds = element.getBoundingClientRect();
                  return {
                    playerIndex,
                    kind: element.className,
                    l: bounds.left,
                    r: bounds.right,
                    t: bounds.top,
                    b: bounds.bottom,
                  };
                })
                .filter((rect) => rect.r - rect.l > 0 && rect.b - rect.t > 0)
            );
            let overlaps = 0;
            for (let i = 0; i < visibleRects.length; i++) {
              for (let j = i + 1; j < visibleRects.length; j++) {
                if (
                  visibleRects[i].some((first) =>
                    visibleRects[j].some(
                      (second) =>
                        Math.min(first.r, second.r) - Math.max(first.l, second.l) > 1 &&
                        Math.min(first.b, second.b) - Math.max(first.t, second.t) > 1
                    )
                  )
                ) {
                  overlaps++;
                }
              }
            }
            const outsideDetails = visibleRects
              .flat()
              .map((rect) => ({
                playerIndex: rect.playerIndex,
                kind: rect.kind,
                left: +(pitch.left - rect.l).toFixed(1),
                right: +(rect.r - pitch.right).toFixed(1),
                top: +(pitch.top - rect.t).toFixed(1),
                bottom: +(rect.b - pitch.bottom).toFixed(1),
              }))
              .filter(
                (delta) =>
                  delta.left > 1 ||
                  delta.right > 1 ||
                  delta.top > 1 ||
                  delta.bottom > 1
              );
            const outside = outsideDetails.length;
            if (inlineTransform) {
              pitchEl.style.setProperty("transform", inlineTransform, inlineTransformPriority);
            } else {
              pitchEl.style.removeProperty("transform");
            }
            return {
              cardH,
              playerCount: players.length,
              overlaps,
              outside,
              outsideDetails,
              benchClipped: document.querySelector("#bench").scrollHeight > footer.height + 1,
              pitchPct: +((pitch.height / canvas.height) * 100).toFixed(1),
              footPct: +((footer.height / canvas.height) * 100).toFixed(1),
            };
          });

          checked++;
          const failed =
            result.playerCount !== EXPECTED_PITCH_PLAYER_COUNT ||
            !Number.isFinite(result.cardH) ||
            result.overlaps > 0 ||
            result.outside > 0 ||
            result.benchClipped;
          if (failed) ng++;
          if (failed || process.env.VERBOSE) {
            const note =
              result.cardH < CARD_H_MIN - 0.1
                ? " [下限70px未達＝そのフォーメーションの幾何的上限]"
                : "";
            console.log(
              `${failed ? "NG" : "ok"} w=${width} bench=${count} style=${style.padEnd(10)} ` +
                `${key.padEnd(9)} cardH=${result.cardH.toFixed(1)} players=${result.playerCount} ` +
                `重なり=${result.overlaps} はみ出し=${result.outside} 見切れ=${result.benchClipped} ` +
                `pitch=${result.pitchPct}% footer=${result.footPct}%${note}` +
                (result.outsideDetails.length > 0 ? ` outside=${JSON.stringify(result.outsideDetails)}` : "")
            );
          }
        }
      }
    }

    if (pageErrors.length > 0) {
      ng += pageErrors.length;
      pageErrors.forEach((message) => console.error(`pageerror w=${width}: ${message}`));
    }
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(ng === 0 ? `ALL OK (${checked} combinations)` : `NG ${ng} 件 / ${checked} combinations`);
process.exit(ng === 0 ? 0 : 1);
