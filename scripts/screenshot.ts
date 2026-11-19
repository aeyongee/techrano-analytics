/**
 * 화면 스틸을 뽑는다(가편 확인용). 서버가 먼저 떠 있어야 한다.
 *   npx tsx scripts/screenshot.ts --base http://localhost:3100 --out <폴더> --routes /demo,/demo/compare
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { parseArgs } from "./lib/args";

const args = parseArgs();
const base = args.get("base") ?? "http://localhost:3000";
const out = args.get("out") ?? "test-results/stills";
const routes = (args.get("routes") ?? "/demo").split(",").map((r) => r.trim()).filter(Boolean);
mkdirSync(out, { recursive: true });

const VIEWPORTS = [
  { name: "390", width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  { name: "1440", width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
];

const browser = await chromium.launch();
try {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ ...vp, viewport: { width: vp.width, height: vp.height }, locale: "ko-KR" });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));
    for (const route of routes) {
      await page.goto(base + route, { waitUntil: "load" });
      await page.waitForTimeout(1200); // 차트(ResponsiveContainer) 크기 계산과 글꼴 교체를 기다린다
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      const stem = path.join(out, `${route.replace(/\W+/g, "_").replace(/^_|_$/g, "") || "root"}-${vp.name}`);
      const file = `${stem}.png`;
      if (vp.isMobile) {
        await page.screenshot({ path: `${stem}-first.png` }); // 폰 첫 화면 그대로
        // 전체 페이지 캡처에서는 고정 하단 탭이 중간에 찍히므로 숨긴다
        await page.addStyleTag({ content: "nav.fixed{display:none!important}" });
      }
      await page.screenshot({ path: file, fullPage: true });
      console.log(`${file}  가로 넘침 ${overflow}px${errors.length ? `  콘솔 오류 ${errors.length}건: ${errors.join(" | ").slice(0, 300)}` : ""}`);
      errors.length = 0;
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
