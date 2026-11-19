import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ADMIN_CLAIMS, USER_CLAIMS, createMigratedDb, queryAs } from "./supabase-stub";

const TABLES = ["episodes", "ig_media", "yt_videos", "ig_snapshots", "yt_snapshots", "sync_runs"];
const VIEWS = ["v_ig_series", "v_yt_series", "v_episode_overview"];

let db: PGlite;

async function errorCode(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p;
    return undefined;
  } catch (e) {
    return (e as { code?: string }).code;
  }
}

async function seed() {
  await db.exec(`
    truncate public.ig_snapshots, public.yt_snapshots, public.sync_runs, public.ig_media, public.yt_videos restart identity cascade;
    delete from public.episodes;
    insert into public.episodes (ep_no, title, status, ig_shortcode, yt_video_id, is_benchmark)
      values (5, '댓글 하나로 사이트가 털리는 이유', 'published', 'AbCdEf12345', 'cKQIEccirkE', true);
    insert into public.ig_media (media_id, shortcode, permalink, posted_at)
      values ('17900000000000001', 'AbCdEf12345', 'https://www.instagram.com/reel/AbCdEf12345/', '2026-11-12T02:55:00Z');
    insert into public.yt_videos (video_id, title, privacy_status, published_at, duration_sec)
      values ('cKQIEccirkE', '댓글 하나로 사이트가 털리는 이유', 'public', '2026-11-12T02:39:00Z', 36);
    insert into public.ig_snapshots (media_id, captured_at, views, reach, saved, shares, skip_rate)
      values ('17900000000000001', '2026-11-12T04:55:00Z', 1000, 800, 8, 4, 40.5),
             ('17900000000000001', '2026-11-13T02:55:00Z', 64000, 40000, 440, 240, 37.5);
    insert into public.yt_snapshots (video_id, captured_at, views, likes, comments, a_views, a_engaged_views)
      values ('cKQIEccirkE', '2026-11-13T02:39:00Z', 900, 30, 2, 850, 600),
             ('cKQIEccirkE', '2026-11-13T05:39:00Z', 1100, 35, 2, null, null);
  `);
}

beforeAll(async () => {
  db = await createMigratedDb();
});
afterAll(async () => {
  await db.close();
});
beforeEach(seed);

describe("anon", () => {
  it.each([...TABLES, ...VIEWS])("%s를 읽을 수 없다", async (name) => {
    expect(await errorCode(queryAs(db, "anon", null, `select * from public.${name}`))).toBe("42501");
  });

  it.each([
    "select public.start_sync_run('cron', 0)",
    "select public.merge_episode(1, 2)",
    "select public.unpair_episode(1, 'yt')",
    "select * from public.channel_totals(now())",
  ])("RPC를 실행할 수 없다: %s", async (sql) => {
    expect(await errorCode(queryAs(db, "anon", null, sql))).toBe("42501");
  });

  it("episodes에 쓸 수 없다", async () => {
    expect(
      await errorCode(queryAs(db, "anon", null, "insert into public.episodes (title) values ('x')")),
    ).toBe("42501");
  });
});

describe("관리자 claim이 없는 로그인 사용자", () => {
  it.each([...TABLES, ...VIEWS])("%s에서 0행을 받는다", async (name) => {
    const rows = await queryAs(db, "authenticated", USER_CLAIMS, `select * from public.${name}`);
    expect(rows).toHaveLength(0);
  });

  it("episodes에 쓸 수 없다", async () => {
    expect(
      await errorCode(queryAs(db, "authenticated", USER_CLAIMS, "insert into public.episodes (title) values ('x')")),
    ).toBe("42501");
  });

  it("user_metadata에 admin을 넣어도 통과하지 못한다", async () => {
    const claims = { role: "authenticated", user_metadata: { app_role: "admin" } };
    expect(await queryAs(db, "authenticated", claims, "select * from public.episodes")).toHaveLength(0);
  });

  it("익명 세션은 admin claim이 있어도 막힌다", async () => {
    const claims = { ...ADMIN_CLAIMS, is_anonymous: true };
    expect(await queryAs(db, "authenticated", claims, "select * from public.episodes")).toHaveLength(0);
  });

  it("수집 시작 함수를 실행할 수 없다", async () => {
    expect(
      await errorCode(queryAs(db, "authenticated", ADMIN_CLAIMS, "select public.start_sync_run('cron', 0)")),
    ).toBe("42501");
  });
});

describe("관리자", () => {
  it("편과 뷰를 읽는다", async () => {
    const rows = await queryAs<{ ep_no: number; ig_views: number; yt_views: number; a_views: number; yt_analytics_at: Date }>(
      db,
      "authenticated",
      ADMIN_CLAIMS,
      "select ep_no, ig_views, yt_views, a_views, yt_analytics_at from public.v_episode_overview",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].ig_views).toBe(64000);
    expect(rows[0].yt_views).toBe(1100); // 최신 Data API 값
    expect(rows[0].a_views).toBe(850); // 최신 Analytics 값은 그 앞 행에서
    expect(new Date(rows[0].yt_analytics_at).toISOString()).toBe("2026-11-13T02:39:00.000Z");
  });

  it("hours_since_post와 비율을 계산한다", async () => {
    const rows = await queryAs<{ hours_since_post: string; save_rate: string; share_rate: string }>(
      db,
      "authenticated",
      ADMIN_CLAIMS,
      "select hours_since_post, save_rate, share_rate from public.v_ig_series order by captured_at",
    );
    expect(Number(rows[0].hours_since_post)).toBeCloseTo(2, 5);
    expect(Number(rows[1].hours_since_post)).toBeCloseTo(24, 5);
    expect(Number(rows[1].save_rate)).toBeCloseTo(1.1, 3);
    expect(Number(rows[1].share_rate)).toBeCloseTo(0.6, 3);
  });

  it("channel_totals는 시점까지의 최신 스냅샷을 더한다", async () => {
    const [now] = await queryAs<{ ig_views: number; yt_views: number }>(
      db, "authenticated", ADMIN_CLAIMS, "select * from public.channel_totals(now())",
    );
    expect(Number(now.ig_views)).toBe(64000);
    expect(Number(now.yt_views)).toBe(1100);
    const [early] = await queryAs<{ ig_views: number; yt_views: number | null }>(
      db, "authenticated", ADMIN_CLAIMS, "select * from public.channel_totals('2026-11-12T12:00:00Z')",
    );
    expect(Number(early.ig_views)).toBe(1000);
    expect(early.yt_views).toBeNull();
  });

  it("스냅샷에는 쓸 수 없다", async () => {
    const sql = "insert into public.ig_snapshots (media_id, captured_at) values ('17900000000000001', now())";
    expect(await errorCode(queryAs(db, "authenticated", ADMIN_CLAIMS, sql))).toBe("42501");
  });

  it("추적 여부만 바꿀 수 있다", async () => {
    await queryAs(db, "authenticated", ADMIN_CLAIMS, "update public.ig_media set is_tracked = false");
    const sql = "update public.ig_media set posted_at = now()";
    expect(await errorCode(queryAs(db, "authenticated", ADMIN_CLAIMS, sql))).toBe("42501");
  });

  it("편 메모를 고치면 updated_at이 바뀐다", async () => {
    const [before] = (await db.query<{ updated_at: Date }>("select updated_at from public.episodes")).rows;
    await new Promise((r) => setTimeout(r, 20));
    await queryAs(db, "authenticated", ADMIN_CLAIMS, "update public.episodes set retro_72h = '훅 통과, 공유 약함'");
    const [after] = (await db.query<{ updated_at: Date }>("select updated_at from public.episodes")).rows;
    expect(new Date(after.updated_at).getTime()).toBeGreaterThan(new Date(before.updated_at).getTime());
  });
});

describe("초안 합치기와 짝 해제", () => {
  async function draftWithYt(): Promise<number> {
    await db.exec(`
      update public.episodes set yt_video_id = null where ep_no = 5;
      insert into public.episodes (title, status, yt_video_id) values ('새 쇼츠', 'draft', 'cKQIEccirkE');
    `);
    const { rows } = await db.query<{ id: number }>("select id from public.episodes where status = 'draft'");
    return rows[0].id;
  }

  it("초안의 YT 키를 확정 편으로 옮기고 초안을 지운다", async () => {
    const draftId = await draftWithYt();
    const [{ id: target }] = (await db.query<{ id: number }>("select id from public.episodes where ep_no = 5")).rows;
    await queryAs(db, "authenticated", ADMIN_CLAIMS, "select public.merge_episode($1, $2, true)", [draftId, target]);
    const { rows } = await db.query<{ yt_video_id: string; auto_paired: boolean }>(
      "select yt_video_id, auto_paired from public.episodes",
    );
    expect(rows).toEqual([{ yt_video_id: "cKQIEccirkE", auto_paired: true }]);
  });

  it("두 편이 같은 플랫폼을 가지면 TR409", async () => {
    await db.exec("insert into public.episodes (title, status, yt_video_id) values ('겹침', 'draft', 'zzzzzzzzzzz')");
    const [{ id: draftId }] = (await db.query<{ id: number }>("select id from public.episodes where status = 'draft'")).rows;
    const [{ id: target }] = (await db.query<{ id: number }>("select id from public.episodes where ep_no = 5")).rows;
    expect(
      await errorCode(queryAs(db, "authenticated", ADMIN_CLAIMS, "select public.merge_episode($1, $2)", [draftId, target])),
    ).toBe("TR409");
  });

  it("확정 편을 source로 주면 TR400", async () => {
    const draftId = await draftWithYt();
    const [{ id: published }] = (await db.query<{ id: number }>("select id from public.episodes where ep_no = 5")).rows;
    expect(
      await errorCode(queryAs(db, "authenticated", ADMIN_CLAIMS, "select public.merge_episode($1, $2)", [published, draftId])),
    ).toBe("TR400");
  });

  it("짝 해제는 YT를 새 초안으로 떼어 낸다", async () => {
    const [{ id }] = (await db.query<{ id: number }>("select id from public.episodes where ep_no = 5")).rows;
    const [{ unpair_episode: newId }] = await queryAs<{ unpair_episode: number }>(
      db, "authenticated", ADMIN_CLAIMS, "select public.unpair_episode($1, 'yt')", [id],
    );
    const { rows } = await db.query<{ id: number; status: string; yt_video_id: string | null; title: string }>(
      "select id, status, yt_video_id, title from public.episodes order by id",
    );
    expect(rows.find((r) => r.id === id)?.yt_video_id).toBeNull();
    expect(rows.find((r) => r.id === Number(newId))).toMatchObject({ status: "draft", yt_video_id: "cKQIEccirkE" });
  });

  it("관리자 claim이 없으면 합치기가 아무 행도 바꾸지 못한다", async () => {
    const draftId = await draftWithYt();
    const [{ id: target }] = (await db.query<{ id: number }>("select id from public.episodes where ep_no = 5")).rows;
    expect(
      await errorCode(queryAs(db, "authenticated", USER_CLAIMS, "select public.merge_episode($1, $2)", [draftId, target])),
    ).toBe("TR404");
  });
});

describe("start_sync_run", () => {
  const start = (gap = 0) =>
    queryAs<{ start_sync_run: number }>(db, "service_role", null, "select public.start_sync_run('cron', $1)", [gap]);

  it("실행 중이면 TR409(BUSY)", async () => {
    await start();
    expect(await errorCode(start())).toBe("TR409");
  });

  it("최소 간격 안이면 TR429와 남은 초", async () => {
    const [{ start_sync_run: id }] = await start();
    await db.query("update public.sync_runs set status = 'success' where id = $1", [id]);
    try {
      await start(120);
      expect.unreachable();
    } catch (e) {
      const err = e as { code?: string; detail?: string };
      expect(err.code).toBe("TR429");
      expect(Number(err.detail)).toBeGreaterThan(100);
      expect(Number(err.detail)).toBeLessThanOrEqual(120);
    }
  });

  it("5분 넘게 running인 행은 abandoned로 정리하고 새로 시작한다", async () => {
    const [{ start_sync_run: old }] = await start();
    await db.query("update public.sync_runs set started_at = now() - interval '6 minutes' where id = $1", [old]);
    const [{ start_sync_run: fresh }] = await start();
    const { rows } = await db.query<{ id: number; status: string }>("select id, status from public.sync_runs order by id");
    expect(rows).toEqual([
      { id: old, status: "abandoned" },
      { id: fresh, status: "running" },
    ]);
  });

  it("180일 지난 로그를 지운다", async () => {
    await db.exec(`insert into public.sync_runs (trigger, status, started_at) values ('cron', 'success', now() - interval '181 days')`);
    await start();
    const { rows } = await db.query<{ n: number }>("select count(*)::int as n from public.sync_runs");
    expect(rows[0].n).toBe(1);
  });
});
