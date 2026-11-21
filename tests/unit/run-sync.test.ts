import { describe, expect, it } from "vitest";
import { runSync, SyncBusyError, SyncCooldownError, type CollectorEnv } from "@/lib/collector";
import { MemorySyncStore } from "@/lib/collector/store/memory";

const NOW = Date.parse("2026-11-20T00:00:00Z");
const H = 3_600_000;
const isoAgo = (h: number) => new Date(NOW - h * H).toISOString();
const igTs = (h: number) => isoAgo(h).replace(/\.\d{3}Z$/, "+0000");

// 토큰 모양 문자열은 실행할 때 만든다(레포에 그대로 두면 비밀값 스캔에 걸린다).
const META_TOKEN = "EAA" + "testtokenvalue1234567890abcdef";
const ENV: CollectorEnv = {
  meta: { token: META_TOKEN, igUserId: "IGUSER", graphVersion: null },
  google: { clientId: "cid", clientSecret: "GOCSPX" + "-testsecret", refreshToken: "1//" + "0testrefreshtokenvalue12345", uploadsPlaylistId: null },
};

type Reply = { status?: number; body: unknown; headers?: Record<string, string> };
type Route = [RegExp, (url: URL) => Reply];

function fakeFetch(routes: Route[]) {
  const calls: URL[] = [];
  const impl = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    calls.push(url);
    const route = routes.find(([re]) => re.test(url.origin + url.pathname));
    const r = route ? route[1](url) : { status: 404, body: { error: { message: `no route ${url.pathname}` } } };
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200, headers: { "content-type": "application/json", ...r.headers } });
  }) as typeof fetch;
  return { impl, calls };
}

const insights = (values: Record<string, number>) => ({
  data: Object.entries(values).map(([name, value]) => ({ name, values: [{ value }] })),
});
const FULL = { views: 3000, reach: 2400, saved: 30, shares: 15, comments: 2, likes: 40, ig_reels_avg_watch_time: 13000, reels_skip_rate: 38.2 };

/** 기본 세계: 확정 편 1개(IG·YT 연결), 새 릴스 1개, 예약된 새 쇼츠 1개 */
function world(overrides: Partial<Record<string, (url: URL) => Reply>> = {}) {
  const routes: Route[] = [
    [/graph\.facebook\.com\/IGUSER\/media$/, overrides.media ?? (() => ({
      body: {
        data: [
          { id: "M1", caption: "🦖 확정된 편\n본문", media_product_type: "REELS", timestamp: igTs(30), permalink: "https://www.instagram.com/reel/SC1/" },
          { id: "M2", caption: "🦖 새로 올린 편", media_product_type: "REELS", timestamp: igTs(1), permalink: "https://www.instagram.com/reel/SC2/" },
          { id: "P1", caption: "피드 사진", media_product_type: "FEED", timestamp: igTs(50), permalink: "https://www.instagram.com/p/PH1/" },
        ],
      },
    }))],
    [/graph\.facebook\.com\/M\d\/insights$/, overrides.insights ?? (() => ({ body: insights(FULL) }))],
    [/graph\.facebook\.com\/me\/assigned_instagram_accounts$/, overrides.account ?? (() => ({ body: { data: [{ id: "IGUSER", username: "tech.rano" }] } }))],
    [/oauth2\.googleapis\.com\/token$/, overrides.token ?? (() => ({ body: { access_token: "ya29" + ".testaccesstoken1234567890" } }))],
    [/graph\.facebook\.com\/IGUSER$/, overrides.followers ?? (() => ({ body: { followers_count: 286, id: "IGUSER" } }))],
    [/youtube\/v3\/channels$/, () => ({ body: { items: [{ contentDetails: { relatedPlaylists: { uploads: "UU1" } }, statistics: { subscriberCount: "11", hiddenSubscriberCount: false } }] } })],
    [/youtube\/v3\/playlistItems$/, () => ({ body: { items: [{ contentDetails: { videoId: "ytvideo0001" } }, { contentDetails: { videoId: "ytvideo0002" } }] } })],
    [/youtube\/v3\/videos$/, overrides.videos ?? (() => ({
      body: {
        items: [
          { id: "ytvideo0001", snippet: { title: "확정된 편 #shorts", publishedAt: isoAgo(30) }, statistics: { viewCount: "900", likeCount: "9", commentCount: "1" }, contentDetails: { duration: "PT30S" }, status: { privacyStatus: "public" } },
          { id: "ytvideo0002", snippet: { title: "다른 이름의 쇼츠", publishedAt: isoAgo(20) }, contentDetails: { duration: "PT28S" }, status: { privacyStatus: "private", publishAt: new Date(NOW + 2 * H).toISOString() } },
        ],
      },
    }))],
    [/youtubeanalytics\.googleapis\.com\/v2\/reports$/, overrides.analytics ?? (() => ({
      body: {
        columnHeaders: ["video", "views", "engagedViews", "averageViewDuration", "averageViewPercentage", "shares", "subscribersGained"].map((name) => ({ name })),
        rows: [["ytvideo0001", 880, 300, 21, 70, 1, 2]],
      },
    }))],
  ];
  return fakeFetch(routes);
}

function seededStore(clock: () => number = () => NOW) {
  const store = new MemorySyncStore(clock);
  store.addEpisode({ epNo: 5, title: "확정된 편", status: "published", igShortcode: "SC1", ytVideoId: "ytvideo0001" });
  return store;
}

const deps = (store: MemorySyncStore, impl: typeof fetch, env: CollectorEnv = ENV) => ({
  store, env, fetchImpl: impl, sleep: async () => {}, clock: () => NOW,
});

describe("runSync", () => {
  it("발견·초안·자동 짝·수집을 한 번에 한다", async () => {
    const store = seededStore();
    const { impl } = world();
    const s = await runSync({ trigger: "cli" }, deps(store, impl));

    expect(s.status).toBe("success");
    expect(s.ig).toEqual({ status: "ok", due: 2, captured: 2 });
    // 예약(private) 영상은 등록만 하고 수집하지 않는다
    expect(s.yt).toMatchObject({ status: "ok", due: 1, captured: 1, analytics: "ok" });
    expect(s.draftsCreated).toBe(2);
    expect(s.autoPaired).toBe(1);

    const drafts = store.episodes.filter((e) => e.status === "draft");
    expect(drafts).toEqual([expect.objectContaining({ title: "새로 올린 편", igShortcode: "SC2", ytVideoId: "ytvideo0002" })]);
    expect(store.yt.get("ytvideo0002")).toMatchObject({ privacyStatus: "private", publishedAt: null });
    expect(store.ytSnapshots[0]).toMatchObject({ videoId: "ytvideo0001", views: 900, analytics: { views: 880, engagedViews: 300 } });
    expect(store.igSnapshots.find((r) => r.mediaId === "M1")).toMatchObject({ views: 3000, skipRate: 38.2, avgWatchMs: 13000 });
    expect(store.runs[0].finish).toMatchObject({ status: "success", igCaptured: 2, ytCaptured: 1, newMedia: 4 });
  });

  it("간격이 안 된 편은 다음 회차에 찍는다", async () => {
    const store = seededStore();
    const { impl } = world();
    await runSync({ trigger: "cli" }, deps(store, impl));
    const later = { ...deps(store, impl), clock: () => NOW + 16 * 60_000 };
    const s = await runSync({ trigger: "cron" }, later);
    // 게시 1시간 된 릴스만 15분 간격 대상. 30시간 된 편은 60분 간격이라 쉰다.
    expect(s.ig).toMatchObject({ due: 1, captured: 1 });
    expect(s.yt).toMatchObject({ due: 0, captured: 0, analytics: "not_due" });
  });

  it("인스타 토큰이 죽어도 유튜브는 끝까지 수집하고, 오류에 토큰이 남지 않는다", async () => {
    const store = seededStore();
    const { impl } = world({
      account: () => ({ status: 400, body: { error: { message: `Error validating access token: Session has expired. access_token=${META_TOKEN}`, code: 190 } } }),
    });
    const s = await runSync({ trigger: "cli" }, deps(store, impl, { ...ENV, meta: { ...ENV.meta!, igUserId: null } }));
    expect(s.status).toBe("partial");
    expect(s.ig.status).toBe("error");
    expect(s.yt.captured).toBe(1);
    expect(JSON.stringify(s.errors)).not.toContain(META_TOKEN);
    expect(s.errors[0]).toMatchObject({ platform: "ig", stage: "auth", code: "190" });
  });

  it("두 플랫폼이 모두 실패하면 failed", async () => {
    const store = seededStore();
    const { impl } = world({
      media: () => ({ status: 500, body: { error: { message: "boom", code: 2 } } }),
      token: () => ({ status: 400, body: { error: "invalid_grant", error_description: "Token has been expired or revoked." } }),
    });
    const s = await runSync({ trigger: "cli" }, deps(store, impl));
    expect(s.status).toBe("failed");
    expect(s.errors.map((e) => e.code)).toContain("invalid_grant");
  });

  it("지원하지 않는 지표를 배우고 다음 회차에는 빼고 묻는다", async () => {
    const store = seededStore();
    const { impl, calls } = world({
      insights: (url) => {
        const metric = url.searchParams.get("metric")!;
        if (metric.includes("reels_skip_rate")) {
          return { status: 400, body: { error: { message: "(#100) metric[7] must be one of the following values", code: 100 } } };
        }
        return { body: insights(Object.fromEntries(metric.split(",").map((m) => [m, FULL[m as keyof typeof FULL]]))) };
      },
    });
    await runSync({ trigger: "cli" }, deps(store, impl));
    expect(store.ig.get("M1")?.unsupportedMetrics).toEqual(["reels_skip_rate"]);
    expect(store.igSnapshots[0]).toMatchObject({ views: 3000, skipRate: null });

    calls.length = 0;
    await runSync({ trigger: "cli", force: true }, { ...deps(store, impl), clock: () => NOW + 60 * 60_000 });
    const asked = calls.filter((u) => u.pathname.endsWith("/insights")).map((u) => u.searchParams.get("metric"));
    expect(asked.every((m) => !m!.includes("reels_skip_rate"))).toBe(true);
    expect(asked).toHaveLength(2); // 폴백 없이 묶음 한 번씩
  });

  it("삭제된 릴스는 세 번 연속 실패하면 추적을 끈다", async () => {
    const store = seededStore();
    const { impl } = world({
      insights: (url) =>
        url.pathname.includes("M2")
          ? { status: 400, body: { error: { message: "Unsupported get request. Object does not exist", code: 100, error_subcode: 33 } } }
          : { body: insights(FULL) },
    });
    for (let i = 0; i < 3; i++) {
      await runSync({ trigger: "cli", force: true }, { ...deps(store, impl), clock: () => NOW + i * 20 * 60_000 });
    }
    expect(store.ig.get("M2")).toMatchObject({ consecutiveFailures: 3, isTracked: false });
    expect(store.ig.get("M2")?.unsupportedMetrics).toEqual([]);
  });

  it("한도 초과 코드를 받으면 인스타 수집을 멈춘다", async () => {
    const store = seededStore();
    const { impl } = world({ insights: () => ({ status: 403, body: { error: { message: "Application request limit reached", code: 4 } } }) });
    const s = await runSync({ trigger: "cli" }, deps(store, impl));
    expect(s.status).toBe("partial");
    expect(s.notes).toContain("rate limited");
    expect(s.ig.captured).toBe(0);
  });

  it("시간 예산을 넘기면 남은 편을 미루고 partial", async () => {
    const store = seededStore();
    const { impl } = world();
    let t = NOW;
    const s = await runSync({ trigger: "cli", budgetMs: 1_000 }, { ...deps(store, impl), clock: () => (t += 400) });
    expect(s.notes).toContain("time budget");
    expect(s.status).toBe("partial");
  });

  it("실행 중이면 BUSY, 최소 간격 안이면 COOLDOWN", async () => {
    const store = seededStore();
    await store.startRun("cron", 0);
    await expect(runSync({ trigger: "manual" }, deps(store, world().impl))).rejects.toBeInstanceOf(SyncBusyError);

    let t = NOW;
    const fresh = seededStore(() => t);
    await runSync({ trigger: "cron" }, deps(fresh, world().impl));
    t = NOW + 30_000;
    const err = await runSync({ trigger: "manual", minGapSeconds: 120 }, { ...deps(fresh, world().impl), clock: () => t }).catch((e) => e);
    expect(err).toBeInstanceOf(SyncCooldownError);
    expect(err.retryAfterSec).toBe(90);
  });

  it("릴스 표지를 받아 저장하고, 다음 회차에는 다시 받지 않는다", async () => {
    const store = seededStore();
    const routes = world({
      media: () => ({
        body: {
          data: [
            { id: "M1", caption: "확정된 편", media_product_type: "REELS", timestamp: igTs(30), permalink: "https://www.instagram.com/reel/SC1/", thumbnail_url: "https://cdn.example/m1.jpg" },
          ],
        },
      }),
    });
    const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
      const u = String(input);
      if (u.startsWith("https://cdn.example/") || u.startsWith("https://i.ytimg.com/")) {
        return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "image/jpeg" } });
      }
      return routes.impl(input, init);
    }) as typeof fetch;
    const s = await runSync({ trigger: "cli" }, { ...deps(store, routes.impl), fetchImpl });
    expect(s.status).toBe("success");
    expect(store.covers.get("ig/M1.jpg")).toBe(3);
    expect(store.ig.get("M1")?.coverPath).toBe("ig/M1.jpg");
    expect(store.yt.get("ytvideo0001")?.coverPath).toBe("yt/ytvideo0001.jpg"); // 공개 쇼츠
    expect(store.yt.get("ytvideo0002")?.coverPath).toBeNull(); // 예약(비공개)은 받지 않는다

    store.covers.clear();
    await runSync({ trigger: "cli" }, { ...deps(store, routes.impl), fetchImpl, clock: () => NOW + 20 * 60_000 });
    expect(store.covers.size).toBe(0);
  });

  it("팔로워·구독자 수를 함께 남기고, 못 받아도 success다", async () => {
    const store = seededStore();
    const s = await runSync({ trigger: "cli" }, deps(store, world().impl));
    expect(s.status).toBe("success");
    expect(store.audience.map((a) => [a.platform, a.count])).toEqual([["ig", 286], ["yt", 11]]);

    const store2 = seededStore();
    const s2 = await runSync({ trigger: "cli" }, deps(store2, world({ followers: () => ({ status: 500, body: { error: { message: "boom" } } }) }).impl));
    expect(s2.status).toBe("success");
    expect(s2.errors.some((e) => e.stage === "audience" && e.platform === "ig")).toBe(true);
    expect(store2.audience.map((a) => a.platform)).toEqual(["yt"]);
  });

  it("표지를 못 받아도 수집은 success로 남는다", async () => {
    const store = seededStore();
    const routes = world({
      media: () => ({
        body: { data: [{ id: "M1", caption: "확정된 편", media_product_type: "REELS", timestamp: igTs(30), permalink: "https://www.instagram.com/reel/SC1/", thumbnail_url: "https://cdn.example/gone.jpg" }] },
      }),
    });
    const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
      const u = String(input);
      if (u.startsWith("https://cdn.example/") || u.startsWith("https://i.ytimg.com/")) return new Response("", { status: 403 });
      return routes.impl(input, init);
    }) as typeof fetch;
    const s = await runSync({ trigger: "cli" }, { ...deps(store, routes.impl), fetchImpl });
    expect(s.status).toBe("success");
    expect(s.errors.some((e) => e.stage === "cover")).toBe(true);
    expect(store.ig.get("M1")?.coverPath).toBeNull();
  });

  it("YT 초안 시각이 멀면 짝짓지 않고 각각 초안으로 둔다", async () => {
    const store = seededStore();
    const { impl } = world({
      videos: () => ({
        body: {
          items: [
            { id: "ytvideo0002", snippet: { title: "다른 이름의 쇼츠", publishedAt: isoAgo(40) }, statistics: { viewCount: "10" }, status: { privacyStatus: "public" } },
          ],
        },
      }),
    });
    const s = await runSync({ trigger: "cli" }, deps(store, impl));
    expect(s.autoPaired).toBe(0);
    expect(store.episodes.filter((e) => e.status === "draft")).toHaveLength(2);
  });

  it("번호를 미리 받은 예정 편은 제목으로 붙고, 공개되면 게시로 바뀐다", async () => {
    const store = seededStore();
    store.addEpisode({ epNo: 6, title: "새로 올린 편", status: "draft", igShortcode: null, ytVideoId: null });
    const { impl } = world();
    const s = await runSync({ trigger: "cli" }, deps(store, impl));

    // 릴스는 캡션 첫 줄로 예정 편에 붙고, 게시된 릴스라 바로 게시로 바뀐다
    expect(store.episodes.find((e) => e.epNo === 6)).toMatchObject({ status: "published", igShortcode: "SC2" });
    expect(s.draftsPublished).toBe(1);
    // 제목이 다른 예약 쇼츠는 번호 없는 초안이 되고, 예정 편 쪽으로 합쳐진다
    expect(store.episodes.find((e) => e.epNo === 6)?.ytVideoId).toBe("ytvideo0002");
    expect(store.episodes.filter((e) => e.status === "draft")).toEqual([]);
  });

  it("예약(private) 쇼츠만 붙은 예정 편은 공개될 때까지 초안으로 둔다", async () => {
    const store = seededStore();
    store.addEpisode({ epNo: 6, title: "다른 이름의 쇼츠", status: "draft", igShortcode: null, ytVideoId: null });
    const { impl } = world({ media: () => ({ body: { data: [] } }) });
    const s = await runSync({ trigger: "cli" }, deps(store, impl));
    expect(store.episodes.find((e) => e.epNo === 6)).toMatchObject({ status: "draft", ytVideoId: "ytvideo0002" });
    expect(s.draftsPublished).toBe(0);
  });
});
