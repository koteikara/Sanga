// 座席ビューのいまのモデル（段床・屋根・建物・地面とピッチ）を glTF（GLB）に書き出す。
// Blender で陰影を焼き付ける（bake_ao.py）ための元データ。
//
// 使い方（リポジトリの根元で HTTP サーバーを立ててから）:
//   python3 -m http.server 8123 --bind 127.0.0.1
//   node experiments/stadium-3d/bake/export-scene.mjs <出力.glb>
//
// Playwright（Chromium）を使う。このリポジトリの依存ではないので、使える環境で実行する。
// CDN に出られない環境では THREE_PKG に three@0.170.0 の npm パッケージを展開した場所を渡すと、
// CDN の読み込みをその場所へ差し替える。

import { readFile, writeFile } from "node:fs/promises";

const out = process.argv[2];
if (!out) {
  console.error("使い方: node export-scene.mjs <出力.glb>");
  process.exit(1);
}
const playwrightPath = process.env.PLAYWRIGHT || "playwright";
const { chromium } = await import(playwrightPath);
const url = process.env.URL || "http://127.0.0.1:8123/experiments/stadium-3d/prototype.html?debug";

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await (await browser.newContext({ viewport: { width: 480, height: 320 } })).newPage();
if (process.env.THREE_PKG) {
  await page.route("https://cdn.jsdelivr.net/npm/three@0.170.0/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/npm/three@0.170.0/", "");
    try {
      await route.fulfill({ status: 200, contentType: "text/javascript", body: await readFile(`${process.env.THREE_PKG}/${path}`) });
    } catch {
      await route.abort();
    }
  });
}
page.on("pageerror", (e) => console.error("pageerror:", e.message));
await page.goto(url);
await page.waitForSelector("#boot", { state: "detached", timeout: 120000 });

const b64 = await page.evaluate(async () => {
  const { GLTFExporter } = await import("three/addons/exporters/GLTFExporter.js");
  const { THREE, model } = window.__stadium;
  const g = model.groups;
  // 焼き付ける対象: 動かない構造物と地面。座席・観客・選手・札・当たり判定・大型映像は除く
  const root = new THREE.Group();
  const take = (group, name) => {
    const copy = new THREE.Group();
    copy.name = name;
    for (const child of group.children) {
      if (child.isInstancedMesh || child.isSprite || !child.isMesh) continue;
      const m = child.clone();
      m.name = `${name}-${copy.children.length}`;
      copy.add(m);
    }
    root.add(copy);
  };
  take(g.terraces, "terraces");
  take(g.roof, "roof");
  take(g.building, "building");
  take(g.field, "field");
  // ゴールはグループごと（柱とネット）
  root.updateMatrixWorld(true);
  const glb = await new GLTFExporter().parseAsync(root, { binary: true });
  const bytes = new Uint8Array(glb);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
});
await writeFile(out, Buffer.from(b64, "base64"));
console.log(`→ ${out}（${Math.round(Buffer.from(b64, "base64").length / 1024)} KB）`);
await browser.close();
