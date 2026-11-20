import { expect, test, type Page } from "@playwright/test";

const DEMO_ROUTES = ["/demo", "/demo/compare", "/demo/episodes", "/demo/episodes/5", "/demo/episodes/d-12", "/demo/admin"];

/** 페이지가 Supabase로 보낸 요청과 런타임 오류를 모은다. */
function watch(page: Page) {
  const supabase: string[] = [];
  const errors: string[] = [];
  page.on("request", (r) => {
    if (/supabase\.(co|in)/.test(new URL(r.url()).hostname)) supabase.push(r.url());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return { supabase, errors };
}

test.describe("데모 모드", () => {
  for (const route of DEMO_ROUTES) {
    test(`${route}: 배너가 보이고, Supabase 요청 0건, 가로 넘침 없음`, async ({ page }) => {
      const seen = watch(page);
      await page.goto(route);
      await expect(page.getByRole("note").filter({ hasText: "데모 모드" })).toBeVisible();
      await page.waitForLoadState("networkidle").catch(() => {});
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      expect(seen.supabase).toEqual([]);
      expect(seen.errors).toEqual([]);
    });
  }

  test("로그인 화면에서 한 번에 데모로 들어간다", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "게스트 데모 체험하기" }).click();
    await expect(page).toHaveURL(/\/demo$/);
    await expect(page.getByText("지금 상황").first()).toBeVisible();
    await expect(page.getByText("다음에 해 볼 것")).toBeVisible();
  });

  test("폰에서는 나머지를 접어 두고, 더 보기로 연다", async ({ page, isMobile }) => {
    await page.goto("/demo");
    const more = page.getByRole("button", { name: /전체 현황 더 보기/ });
    if (isMobile) {
      await expect(page.getByText("2단계 관문").first()).toBeHidden();
      await more.click();
    } else {
      await expect(more).toBeHidden();
    }
    await expect(page.getByText("2단계 관문").first()).toBeVisible();
  });

  test("사분면 버블을 누르면 아래 설명이 바뀐다", async ({ page, isMobile }) => {
    await page.goto("/demo");
    if (isMobile) await page.getByRole("button", { name: /전체 현황 더 보기/ }).click();
    const bubble = page.getByRole("button", { name: /^5편 SQL 한 줄의 무게/ });
    await bubble.click();
    await expect(page.getByText("5편 SQL 한 줄의 무게")).toBeVisible();
  });

  test("비교 화면: 지표를 바꾸면 주소에 남고, 편 선택을 적용하면 다시 불러온다", async ({ page }) => {
    await page.goto("/demo/compare");
    await page.getByRole("radio", { name: "건너뛰기" }).click();
    await expect(page).toHaveURL(/m=skip/);
    await page.getByRole("button", { name: /편 선택/ }).click();
    await page.getByRole("button", { name: "최근 5편" }).click();
    await page.getByRole("button", { name: /편 비교하기/ }).click();
    await expect(page).toHaveURL(/eps=/);
    await expect(page.getByRole("button", { name: /편 선택 \(5\/5\)/ })).toBeVisible();
  });

  test("관리: Sync Now는 흉내만 내고 쿨다운을 보여 준다", async ({ page }) => {
    await page.goto("/demo/admin");
    await page.getByRole("button", { name: "Sync Now" }).click();
    await expect(page.getByText(/데모라 저장되지 않음/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /초 뒤에 다시 가능/ })).toBeDisabled();
  });

  test("상세: 회고를 고치면 화면에서만 바뀌고 저장되지 않는다고 알린다", async ({ page }) => {
    await page.goto("/demo/episodes/7");
    await page.getByRole("button", { name: "편집" }).click();
    await page.getByLabel(/72시간 복기/).fill("데모 복기 메모");
    await page.getByRole("button", { name: "저장" }).click();
    await expect(page.getByText(/데모라 저장되지 않았습니다/)).toBeVisible();
    await expect(page.getByText("데모 복기 메모")).toBeVisible();
  });
});
