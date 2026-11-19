import { expect, test } from "@playwright/test";

const PROTECTED = ["/", "/compare", "/episodes", "/episodes/5", "/admin"];

test.describe("실데이터 경로 잠금", () => {
  for (const route of PROTECTED) {
    test(`${route}: 로그인하지 않으면 /login으로 간다`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login(\?|$)/);
      await expect(page.getByRole("button", { name: "관리자 로그인" })).toBeVisible();
    });
  }

  test("크론 엔드포인트: GET 405, 토큰 없는 POST는 거부", async ({ request }) => {
    expect((await request.get("/api/cron/sync")).status()).toBe(405);
    const post = await request.post("/api/cron/sync");
    // 시크릿이 설정돼 있으면 401, 없으면 503(설정 전)
    expect([401, 503]).toContain(post.status());
    expect(await post.text()).not.toMatch(/token|secret/i);
  });

  test("로그아웃은 POST만 받는다", async ({ request }) => {
    expect((await request.get("/auth/signout")).status()).toBe(405);
  });

  test("보안 헤더가 붙는다", async ({ request }) => {
    const res = await request.get("/login");
    const h = res.headers();
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-robots-tag"]).toContain("noindex");
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-powered-by"]).toBeUndefined();
  });

  test("PWA manifest와 서비스 워커가 공개 경로로 열린다", async ({ request }) => {
    const manifest = await request.get("/manifest.webmanifest");
    expect(manifest.status()).toBe(200);
    expect((await manifest.json()).display).toBe("standalone");
    expect((await request.get("/sw.js")).status()).toBe(200);
    expect((await request.get("/offline")).status()).toBe(200);
  });
});
