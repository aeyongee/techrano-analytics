import type { ChannelTotals, EpisodeRaw, IgPoint, SyncRunRow, UntrackedItem, YtPoint } from "@/lib/domain/types";

/**
 * 실데이터(Supabase, RLS)와 데모(코드 안의 가상 데이터)가 같이 지키는 경계.
 * 원시 데이터만 돌려주고, 관문 판정·델타·리샘플링은 builders가 한다.
 */
export interface Repository {
  readonly mode: "live" | "demo";
  /** 데모는 고정 기준 시각, 실데이터는 요청 시각 */
  now(): Date;
  listEpisodes(): Promise<EpisodeRaw[]>;
  getEpisode(key: string): Promise<EpisodeRaw | null>;
  /** media_id → 게시 후 maxHours까지의 스냅샷(시간순) */
  getIgSeries(mediaIds: string[], maxHours?: number): Promise<Record<string, IgPoint[]>>;
  getYtSeries(videoIds: string[], maxHours?: number): Promise<Record<string, YtPoint[]>>;
  getChannelTotals(at: Date): Promise<ChannelTotals>;
  listSyncRuns(limit: number): Promise<SyncRunRow[]>;
  listUntracked(): Promise<UntrackedItem[]>;
}
