import type { AudiencePoint, AudienceSummary, ChannelTotals, EpisodeRaw, IgPoint, Platform, SyncRunRow, UntrackedItem, YtPoint } from "@/lib/domain/types";

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
  /** 채널 팔로워(인스타)·구독자(유튜브) 수 요약 */
  getAudience(platform: Platform): Promise<AudienceSummary>;
  /** 그 시각 이전 마지막 팔로워·구독자 수(편 게시 무렵 값을 찾을 때) */
  getAudienceAt(platform: Platform, at: Date): Promise<AudiencePoint | null>;
  listSyncRuns(limit: number): Promise<SyncRunRow[]>;
  listUntracked(): Promise<UntrackedItem[]>;
}
