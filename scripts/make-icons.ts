/**
 * 블록 티라노 아이콘을 PNG로 뽑는다(PWA·파비콘·애플 터치 아이콘).
 *   npx tsx scripts/make-icons.ts
 * 개인 사진 대신 로고 글리프를 쓴다(공개 레포에 프사를 올리지 않기 위해).
 */
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const ROWS = [
  "......xxxxx.",
  ".....xx.xxxx",
  ".....xxxxxxx",
  ".....xxxx...",
  ".....xxxxxx.",
  "x...xxxxx...",
  "xx.xxxxxxx..",
  "xxxxxxxxx.x.",
  ".xxxxxxxx...",
  "..xxxxxx....",
  "...xx.xx....",
  "...x...x....",
];
const rects = ROWS.flatMap((r, y) => [...r].map((c, x) => (c === "x" ? `<rect x="${x}" y="${y}" width="1.02" height="1.02"/>` : ""))).join("");

/** glyph: 아이콘 한 변 대비 글리프 크기. maskable은 가운데 80% 안전 영역에 들어가게 작게 */
const TARGETS = [
  { file: "public/icons/icon-192.png", size: 192, glyph: 0.6, radius: 0 },
  { file: "public/icons/icon-512.png", size: 512, glyph: 0.6, radius: 0 },
  { file: "public/icons/maskable-512.png", size: 512, glyph: 0.46, radius: 0 },
  { file: "src/app/apple-icon.png", size: 180, glyph: 0.58, radius: 0 },
  { file: "src/app/icon.png", size: 64, glyph: 0.72, radius: 14 },
];

mkdirSync("public/icons", { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const t of TARGETS) {
    await page.setViewportSize({ width: t.size, height: t.size });
    const g = Math.round(t.size * t.glyph);
    await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">
      <div style="width:${t.size}px;height:${t.size}px;border-radius:${t.radius}px;background:#0b1220;display:grid;place-items:center;
        background-image:radial-gradient(circle at 50% 38%, rgba(74,222,128,.16), transparent 62%)">
        <svg viewBox="0 0 12 12" width="${g}" height="${g}" fill="#4ade80" shape-rendering="crispEdges" style="transform:translateX(${Math.round(g * 0.03)}px)">${rects}</svg>
      </div></body></html>`);
    await page.screenshot({ path: t.file, omitBackground: true, clip: { x: 0, y: 0, width: t.size, height: t.size } });
    console.log(t.file);
  }
} finally {
  await browser.close();
}
