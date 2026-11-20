import {
  SyncBusyError,
  SyncCooldownError,
  type EpisodeKey,
  type IgMediaPatch,
  type IgMediaState,
  type AudienceInput,
  type IgSnapshotInput,
  type Platform,
  type RunFinish,
  type SyncState,
  type SyncStore,
  type Trigger,
  type YtSnapshotInput,
  type YtVideoPatch,
  type YtVideoState,
} from "../types";

interface MemoryRun {
  id: number;
  trigger: Trigger;
  startedAt: number;
  finish: RunFinish | null;
}

/**
 * DB 없이 수집기를 돌리는 저장소. 테스트와 `npm run sync -- --memory-readme`(Supabase 연결 전 API 확인)에 쓴다.
 * start_sync_run의 BUSY·COOLDOWN 규칙도 흉내 낸다.
 */
export class MemorySyncStore implements SyncStore {
  readonly ig = new Map<string, IgMediaState>();
  readonly yt = new Map<string, YtVideoState>();
  readonly episodes: EpisodeKey[] = [];
  readonly igSnapshots: (IgSnapshotInput & { runId: number | null })[] = [];
  readonly ytSnapshots: (YtSnapshotInput & { runId: number | null })[] = [];
  readonly runs: MemoryRun[] = [];
  private nextEpisodeId = 1;

  constructor(private readonly clock: () => number = Date.now) {}

  addEpisode(e: Omit<EpisodeKey, "id"> & { id?: number }): EpisodeKey {
    const ep = { ...e, id: e.id ?? this.nextEpisodeId++ };
    this.nextEpisodeId = Math.max(this.nextEpisodeId, ep.id + 1);
    this.episodes.push(ep);
    return ep;
  }

  async startRun(trigger: Trigger, minGapSeconds: number) {
    const now = this.clock();
    if (this.runs.some((r) => !r.finish)) throw new SyncBusyError();
    const last = this.runs.filter((r) => !r.finish || r.finish.status !== "failed").at(-1);
    if (minGapSeconds > 0 && last && now - last.startedAt < minGapSeconds * 1000) {
      throw new SyncCooldownError(Math.ceil((last.startedAt + minGapSeconds * 1000 - now) / 1000));
    }
    const id = this.runs.length + 1;
    this.runs.push({ id, trigger, startedAt: now, finish: null });
    return id;
  }

  async finishRun(runId: number | null, finish: RunFinish) {
    const run = this.runs.find((r) => r.id === runId);
    if (run) run.finish = finish;
  }

  async loadState(): Promise<SyncState> {
    // 수집기가 상태를 고쳐도 저장소 원본은 patch로만 바뀌도록 복사해서 준다.
    return {
      ig: new Map([...this.ig].map(([k, v]) => [k, { ...v, unsupportedMetrics: [...v.unsupportedMetrics] }])),
      yt: new Map([...this.yt].map(([k, v]) => [k, { ...v }])),
      episodes: this.episodes.map((e) => ({ ...e })),
    };
  }

  async upsertIgMedia(rows: IgMediaState[]) {
    for (const r of rows) {
      const prev = this.ig.get(r.mediaId);
      this.ig.set(r.mediaId, prev ? { ...prev, shortcode: r.shortcode, permalink: r.permalink, captionHead: r.captionHead, postedAt: r.postedAt } : { ...r, coverPath: null });
    }
  }

  async upsertYtVideos(rows: YtVideoState[]) {
    for (const r of rows) {
      const prev = this.yt.get(r.videoId);
      const base = { title: r.title, privacyStatus: r.privacyStatus, publishedAt: r.publishedAt, scheduledAt: r.scheduledAt, durationSec: r.durationSec };
      this.yt.set(r.videoId, prev ? { ...prev, ...base } : { ...r });
    }
  }

  async patchIgMedia(mediaId: string, patch: IgMediaPatch) {
    const prev = this.ig.get(mediaId);
    if (prev) this.ig.set(mediaId, { ...prev, ...patch });
  }

  async patchYtVideo(videoId: string, patch: YtVideoPatch) {
    const prev = this.yt.get(videoId);
    if (prev) this.yt.set(videoId, { ...prev, ...patch });
  }

  async createDraftEpisode(input: { title: string; igShortcode?: string | null; ytVideoId?: string | null }) {
    return this.addEpisode({
      epNo: null,
      title: input.title,
      status: "draft",
      igShortcode: input.igShortcode ?? null,
      ytVideoId: input.ytVideoId ?? null,
    }).id;
  }

  async linkEpisode(episodeId: number, platform: Platform, key: string) {
    const ep = this.episodes.find((e) => e.id === episodeId);
    if (!ep) throw new Error(`episode ${episodeId} 없음`);
    if (platform === "ig") ep.igShortcode = key;
    else ep.ytVideoId = key;
  }

  async mergeEpisodes(sourceId: number, targetId: number) {
    const source = this.episodes.find((e) => e.id === sourceId);
    const target = this.episodes.find((e) => e.id === targetId);
    if (!source || !target) throw new Error("merge 대상 없음");
    target.igShortcode ??= source.igShortcode;
    target.ytVideoId ??= source.ytVideoId;
    this.episodes.splice(this.episodes.indexOf(source), 1);
  }

  async insertIgSnapshots(rows: IgSnapshotInput[], runId: number | null) {
    this.igSnapshots.push(...rows.map((r) => ({ ...r, runId })));
    return rows.length;
  }

  async insertYtSnapshots(rows: YtSnapshotInput[], runId: number | null) {
    this.ytSnapshots.push(...rows.map((r) => ({ ...r, runId })));
    return rows.length;
  }

  readonly audience: (AudienceInput & { runId: number | null })[] = [];

  async insertAudience(rows: AudienceInput[], runId: number | null) {
    const fresh = rows.filter((r) => !this.audience.some((a) => a.platform === r.platform && a.capturedAt.getTime() === r.capturedAt.getTime()));
    this.audience.push(...fresh.map((r) => ({ ...r, runId })));
    return fresh.length;
  }

  readonly covers = new Map<string, number>();

  async uploadCover(path: string, bytes: ArrayBuffer) {
    this.covers.set(path, bytes.byteLength);
  }
}
