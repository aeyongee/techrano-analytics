import { describe, expect, it } from "vitest";
import { buildCompare, checkpointValue, valueNear } from "@/features/compare/build";
import { isAdminClaims } from "@/lib/auth/claims";
import { mapOverviewRow, mapRunRow } from "@/lib/data/live-mapping";
import type { CompareSeries } from "@/lib/data/screens";
import type { TableRow, ViewRow } from "@/lib/supabase/database.types";

describe("관리자 판정", () => {
  const admin = { email: "Owner@Example.com", app_metadata: { app_role: "admin" } };
  it("app_metadata와 이메일이 둘 다 맞아야 한다", () => {
    expect(isAdminClaims(admin, "owner@example.com")).toBe(true);
    expect(isAdminClaims({ ...admin, email: "other@example.com" }, "owner@example.com")).toBe(false);
    expect(isAdminClaims({ email: admin.email, app_metadata: {} }, "owner@example.com")).toBe(false);
  });
  it("user_metadata나 익명 세션으로는 통과하지 못한다", () => {
    expect(isAdminClaims({ email: admin.email, user_metadata: { app_role: "admin" } } as never, "owner@example.com")).toBe(false);
    expect(isAdminClaims({ ...admin, is_anonymous: true }, "owner@example.com")).toBe(false);
    expect(isAdminClaims(null, "owner@example.com")).toBe(false);
  });
});

describe("Supabase 행 → 도메인", () => {
  const base = Object.fromEntries(
    [
      "id", "ep_no", "slug", "title", "status", "series", "topic", "is_true_story", "length_sec", "hook_desc", "hypothesis", "retro_72h",
      "notes", "is_benchmark", "ig_shortcode", "yt_video_id", "auto_paired", "created_at", "updated_at", "media_id", "permalink",
      "ig_posted_at", "ig_tracked", "ig_captured_at", "ig_views", "ig_reach", "ig_saved", "ig_shares", "ig_comments", "ig_likes",
      "ig_avg_watch_ms", "ig_skip_rate", "ig_source", "yt_title", "yt_privacy", "yt_published_at", "yt_scheduled_at", "yt_duration_sec",
      "yt_tracked", "yt_captured_at", "yt_views", "yt_likes", "yt_comments", "yt_analytics_at", "a_views", "a_engaged_views",
      "a_avg_view_duration_s", "a_avg_view_pct", "a_shares", "a_subscribers_gained", "posted_at",
    ].map((k) => [k, null]),
  ) as unknown as ViewRow<"v_episode_overview">;

  it("편·최신 스냅샷·Analytics를 옮긴다", () => {
    const e = mapOverviewRow({
      ...base,
      id: 7, ep_no: 5, title: "가상 편", status: "published", is_benchmark: true, ig_shortcode: "AAA", media_id: "M1",
      ig_posted_at: "2026-11-12T02:00:00Z", ig_captured_at: "2026-11-13T02:00:00Z", ig_views: 1000, ig_reach: 800, ig_skip_rate: 37.5,
      yt_video_id: "abcDEF12345", yt_privacy: "public", yt_published_at: "2026-11-12T01:00:00Z", yt_captured_at: "2026-11-13T01:00:00Z",
      yt_views: 500, yt_analytics_at: "2026-11-13T01:00:00Z", a_views: 480, a_engaged_views: 200, posted_at: "2026-11-12T01:00:00Z",
    });
    expect(e).toMatchObject({ key: "5", epNo: 5, isBenchmark: true });
    expect(e.ig?.latest).toMatchObject({ hours: 24, views: 1000, skipRate: 37.5 });
    expect(e.yt?.latest).toMatchObject({ hours: 24, views: 500 });
    expect(e.yt?.analytics).toMatchObject({ views: 480, engagedViews: 200 });
  });

  it("초안은 d-id 키, 수집 전이면 latest가 없다", () => {
    const e = mapOverviewRow({ ...base, id: 12, title: "초안", status: "draft", ig_shortcode: "BBB", media_id: "M2", ig_posted_at: "2026-11-19T00:00:00Z" });
    expect(e.key).toBe("d-12");
    expect(e.ig?.latest).toBeNull();
    expect(e.yt).toBeNull();
  });

  it("수집 로그의 errors jsonb를 배열로 읽는다", () => {
    const r = mapRunRow({
      id: 1, trigger: "cron", status: "partial", started_at: "x", finished_at: null, duration_ms: 10, ig_status: "ok", yt_status: "ok",
      yt_analytics_status: "error", ig_captured: 1, yt_captured: 1, new_media: 0, api_calls: {},
      errors: [{ platform: "yt_analytics", stage: "analytics", code: "quotaExceeded", message: "m" }], note: null,
    } as TableRow<"sync_runs">);
    expect(r.errors).toHaveLength(1);
  });
});

describe("비교 차트 계열", () => {
  const pt = (h: number, views: number) => ({ h, at: "", views, reach: views, skip: 40, save: 1, share: 0.5, src: "api" as const });
  const dense: CompareSeries = { key: "5", epNo: 5, title: "기준", isLatest: false, ig: Array.from({ length: 30 }, (_, i) => pt(i * 3, (i + 1) * 100)), yt: [] };
  const live: CompareSeries = { key: "d-1", epNo: null, title: "새 편", isLatest: true, ig: [pt(0.25, 50), pt(1, 300), pt(19.9, 3000)], yt: [] };

  it("최신 편이 첫 색을 받고, 실측이 적으면 sparse", () => {
    const b = buildCompare([dense, live], "ig", "views", "72h");
    expect(b.series[0]).toMatchObject({ label: "초안", isLatest: true, sparse: true });
    expect(b.series[1].sparse).toBe(false);
  });

  it("'지금' 값은 마지막 실측이 격자보다 앞이어도 나온다", () => {
    const b = buildCompare([live], "ig", "views", "72h");
    expect(valueNear(b.series[0], 19.9, "72h", true)).toBe(3000);
    expect(valueNear(b.series[0], 20.2, "72h", true)).toBe(3000);
    expect(valueNear(b.series[0], 30, "72h", true)).toBeNull();
  });

  it("창 끝(T+72h) 체크포인트도 채운다", () => {
    const b = buildCompare([dense], "ig", "views", "72h");
    expect(checkpointValue(b.series[0], 72, "72h", true)).toBe(2500);
  });
});
