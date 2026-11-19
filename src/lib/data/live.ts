import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/auth/guard";
import type { ChannelTotals, IgPoint, UntrackedItem, YtPoint } from "@/lib/domain/types";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapIgSeriesRow, mapOverviewRow, mapRunRow, mapYtSeriesRow } from "./live-mapping";
import type { Repository } from "./repository";

type Client = SupabaseClient<Database>;
const PAGE = 1000; // PostgREST 기본 최대 행 수

async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(`조회 실패: ${error.message}`);
    out.push(...(data ?? []));
    if ((data ?? []).length < PAGE) return out;
  }
}

function groupBy<T, K extends string>(rows: T[], key: (r: T) => K | null) {
  const out: Record<string, T[]> = {};
  for (const r of rows) {
    const k = key(r);
    if (k) (out[k] ??= []).push(r);
  }
  return out;
}

/** 로그인한 관리자 세션으로 읽는 저장소. 모든 조회가 RLS를 거친다(secret key를 쓰지 않는다). */
class SupabaseRepository implements Repository {
  readonly mode = "live" as const;
  private readonly startedAt = new Date();

  constructor(private readonly db: Client) {}

  now() {
    return this.startedAt;
  }

  async listEpisodes() {
    const rows = await fetchAll((from, to) => this.db.from("v_episode_overview").select("*").order("id").range(from, to));
    return rows.map(mapOverviewRow);
  }

  async getEpisode(key: string) {
    const draft = key.match(/^d-(\d+)$/);
    const num = Number(key);
    if (!draft && !Number.isInteger(num)) return null;
    const q = this.db.from("v_episode_overview").select("*");
    const { data, error } = await (draft ? q.eq("id", Number(draft[1])) : q.eq("ep_no", num)).maybeSingle();
    if (error) throw new Error(`조회 실패: ${error.message}`);
    return data ? mapOverviewRow(data) : null;
  }

  async getIgSeries(mediaIds: string[], maxHours?: number) {
    if (!mediaIds.length) return {} as Record<string, IgPoint[]>;
    const rows = await fetchAll((from, to) => {
      let q = this.db.from("v_ig_series").select("*").in("media_id", mediaIds);
      if (maxHours !== undefined && Number.isFinite(maxHours)) q = q.lte("hours_since_post", maxHours);
      return q.order("captured_at").range(from, to);
    });
    const grouped = groupBy(rows, (r) => r.media_id);
    return Object.fromEntries(Object.entries(grouped).map(([k, v]) => [k, v.map(mapIgSeriesRow)]));
  }

  async getYtSeries(videoIds: string[], maxHours?: number) {
    if (!videoIds.length) return {} as Record<string, YtPoint[]>;
    const rows = await fetchAll((from, to) => {
      let q = this.db.from("v_yt_series").select("*").in("video_id", videoIds);
      if (maxHours !== undefined && Number.isFinite(maxHours)) q = q.lte("hours_since_post", maxHours);
      return q.order("captured_at").range(from, to);
    });
    const grouped = groupBy(rows, (r) => r.video_id);
    return Object.fromEntries(Object.entries(grouped).map(([k, v]) => [k, v.map(mapYtSeriesRow)]));
  }

  async getChannelTotals(at: Date): Promise<ChannelTotals> {
    const { data, error } = await this.db.rpc("channel_totals", { p_at: at.toISOString() });
    if (error) throw new Error(`합계 조회 실패: ${error.message}`);
    const r = data?.[0];
    return {
      igViews: Number(r?.ig_views ?? 0),
      igReach: Number(r?.ig_reach ?? 0),
      igSaved: Number(r?.ig_saved ?? 0),
      igShares: Number(r?.ig_shares ?? 0),
      ytViews: Number(r?.yt_views ?? 0),
    };
  }

  async listSyncRuns(limit: number) {
    const { data, error } = await this.db.from("sync_runs").select("*").order("started_at", { ascending: false }).limit(limit);
    if (error) throw new Error(`수집 로그 조회 실패: ${error.message}`);
    return (data ?? []).map(mapRunRow);
  }

  async listUntracked(): Promise<UntrackedItem[]> {
    const [ig, yt] = await Promise.all([
      this.db.from("ig_media").select("media_id, caption_head, posted_at").eq("is_tracked", false),
      this.db.from("yt_videos").select("video_id, title, published_at").eq("is_tracked", false),
    ]);
    return [
      ...(ig.data ?? []).map((m) => ({ platform: "ig" as const, id: m.media_id, label: m.caption_head ?? m.media_id, postedAt: m.posted_at })),
      ...(yt.data ?? []).map((v) => ({ platform: "yt" as const, id: v.video_id, label: v.title, postedAt: v.published_at })),
    ];
  }
}

/** 실데이터 화면의 유일한 입구. 관리자 확인을 먼저 하므로, 이 함수를 거치지 않고는 실데이터를 읽을 수 없다. */
export async function getLiveRepository(): Promise<Repository> {
  await requireAdmin();
  return new SupabaseRepository(await createSupabaseServerClient());
}
