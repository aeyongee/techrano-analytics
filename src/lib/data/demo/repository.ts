import type { Repository } from "@/lib/data/repository";
import type { ChannelTotals, IgPoint, YtPoint } from "@/lib/domain/types";
import { generateDemoWorld, type DemoWorld } from "./generate";

const HOUR = 3_600_000;

/** DB에 닿지 않는 Repository. 데모 화면은 이것만 쓴다(eslint로 강제). */
export class DemoRepository implements Repository {
  readonly mode = "demo" as const;

  constructor(private readonly world: DemoWorld) {}

  now() {
    return this.world.anchor;
  }

  async listEpisodes() {
    return this.world.episodes;
  }

  async getEpisode(key: string) {
    return this.world.episodes.find((e) => e.key === key) ?? null;
  }

  async getIgSeries(mediaIds: string[], maxHours = Number.POSITIVE_INFINITY) {
    return Object.fromEntries(
      mediaIds.map((id) => [id, (this.world.ig[id] ?? []).filter((p) => p.hours <= maxHours)]),
    ) as Record<string, IgPoint[]>;
  }

  async getYtSeries(videoIds: string[], maxHours = Number.POSITIVE_INFINITY) {
    return Object.fromEntries(
      videoIds.map((id) => [id, (this.world.yt[id] ?? []).filter((p) => p.hours <= maxHours)]),
    ) as Record<string, YtPoint[]>;
  }

  async getChannelTotals(at: Date): Promise<ChannelTotals> {
    const t = at.getTime();
    const lastBefore = <P extends { capturedAt: string }>(xs: P[]) => [...xs].reverse().find((p) => Date.parse(p.capturedAt) <= t);
    const totals: ChannelTotals = { igViews: 0, igReach: 0, igSaved: 0, igShares: 0, ytViews: 0 };
    for (const e of this.world.episodes) {
      if (e.status === "archived") continue;
      const ig = e.ig ? lastBefore(this.world.ig[e.ig.mediaId] ?? []) : undefined;
      const yt = e.yt ? lastBefore(this.world.yt[e.yt.videoId] ?? []) : undefined;
      totals.igViews += ig?.views ?? 0;
      totals.igReach += ig?.reach ?? 0;
      totals.igSaved += ig?.saved ?? 0;
      totals.igShares += ig?.shares ?? 0;
      totals.ytViews += yt?.views ?? 0;
    }
    return totals;
  }

  async listSyncRuns(limit: number) {
    return this.world.runs.slice(0, limit);
  }

  async listUntracked() {
    return this.world.untracked;
  }
}

let cached: { hour: number; repo: DemoRepository } | null = null;

/** 기준 시각은 지금을 1시간 단위로 내린 값. 한 시간 동안 같은 데모를 보여 준다. */
export function getDemoRepository(now = Date.now()): DemoRepository {
  const hour = Math.floor(now / HOUR) * HOUR;
  if (cached?.hour !== hour) cached = { hour, repo: new DemoRepository(generateDemoWorld(new Date(hour))) };
  return cached.repo;
}
