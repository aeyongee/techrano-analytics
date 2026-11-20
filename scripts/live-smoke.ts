/**
 * 실데이터 화면이 관리자 세션으로 열리는지 확인한다(비밀번호 없이 secret key로 짧은 세션을 만든다).
 *   npx tsx --env-file=.env.local scripts/live-smoke.ts --base http://localhost:3300 --out <스틸 폴더>
 * 끝나면 그 세션을 로그아웃한다. 화면에 값은 찍히지만 터미널에는 상태만 출력한다.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { fail, parseArgs } from "./lib/args";

const args = parseArgs();
const base = args.get("base") ?? "http://localhost:3000";
const out = args.get("out") ?? "test-results/live";
const routes = (args.get("routes") ?? "/,/compare,/episodes,/episodes/5,/episodes/10,/admin").split(",");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? fail("NEXT_PUBLIC_SUPABASE_URL 없음");
const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? fail("publishable key 없음");
const secret = process.env.SUPABASE_SECRET_KEY ?? fail("secret key 없음");
const email = process.env.ADMIN_EMAIL ?? fail("ADMIN_EMAIL 없음");
mkdirSync(out, { recursive: true });

// 1) secret key로 일회용 로그인 링크를 만들고(메일은 보내지 않는다), 앱과 같은 쿠키 형식으로 세션을 받는다
const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
if (link.error) fail(`링크 생성 실패: ${link.error.message}`);
const jar = new Map<string, string>();
const ssr = createServerClient(url, pub, {
  cookies: {
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    setAll: (list) => list.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
  },
});
const verified = await ssr.auth.verifyOtp({ type: "magiclink", token_hash: link.data.properties.hashed_token });
if (verified.error) fail(`세션 생성 실패: ${verified.error.message}`);

// 2) 브라우저에 쿠키를 넣고 화면을 돈다
const browser = await chromium.launch();
const results: { 경로: string; 결과: string; 비고: string }[] = [];
try {
  const host = new URL(base).hostname;
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "ko-KR" });
  await ctx.addCookies([...jar].map(([name, value]) => ({ name, value, domain: host, path: "/", httpOnly: false, secure: false, sameSite: "Lax" as const })));
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const route of routes) {
    errors.length = 0;
    const res = await page.goto(base + route, { waitUntil: "load" });
    await page.waitForTimeout(1200);
    const landed = new URL(page.url()).pathname;
    const file = path.join(out, `live${route.replace(/\W+/g, "_") || "_home"}.png`);
    await page.screenshot({ path: file, fullPage: true });
    const okPage = (res?.status() ?? 0) < 400 && !landed.startsWith("/login") && errors.length === 0;
    results.push({ 경로: route, 결과: okPage ? "통과" : "확인 필요", 비고: `HTTP ${res?.status()} → ${landed}${errors.length ? ` · 오류 ${errors[0].slice(0, 80)}` : ""}` });
  }
  await ctx.close();
} finally {
  await browser.close();
  await ssr.auth.signOut({ scope: "local" });
}
console.table(results);
console.log(`스틸: ${out}`);
