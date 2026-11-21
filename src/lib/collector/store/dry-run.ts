import type {
  IgMediaPatch,
  IgMediaState,
  AudienceInput,
  IgSnapshotInput,
  Platform,
  RunFinish,
  SyncState,
  SyncStore,
  YtSnapshotInput,
  YtVideoPatch,
  YtVideoState,
} from "../types";

/** 읽기는 실제 저장소에서 하고 쓰기는 기록만 남긴다. `npm run sync -- --dry-run`. */
export class DryRunStore implements SyncStore {
  readonly writes: string[] = [];
  readonly igSnapshots: IgSnapshotInput[] = [];
  readonly ytSnapshots: YtSnapshotInput[] = [];
  private nextDraftId = -1;

  constructor(private readonly inner: SyncStore) {}

  async startRun() {
    return null; // 잠금도 잡지 않는다
  }
  async finishRun(_runId: number | null, f: RunFinish) {
    this.writes.push(`sync_runs: ${f.status}`);
  }
  loadState(): Promise<SyncState> {
    return this.inner.loadState();
  }
  async upsertIgMedia(rows: IgMediaState[]) {
    this.writes.push(`ig_media upsert ${rows.length}`);
  }
  async upsertYtVideos(rows: YtVideoState[]) {
    this.writes.push(`yt_videos upsert ${rows.length}`);
  }
  async patchIgMedia(mediaId: string, patch: IgMediaPatch) {
    this.writes.push(`ig_media ${mediaId} ${Object.keys(patch).join(",")}`);
  }
  async patchYtVideo(videoId: string, patch: YtVideoPatch) {
    this.writes.push(`yt_videos ${videoId} ${Object.keys(patch).join(",")}`);
  }
  async createDraftEpisode(input: { title: string }) {
    this.writes.push(`episodes 초안 생성: ${input.title}`);
    return this.nextDraftId--;
  }
  async linkEpisode(episodeId: number, platform: Platform, key: string) {
    this.writes.push(`episodes ${episodeId} ← ${platform} ${key}`);
  }
  async mergeEpisodes(sourceId: number, targetId: number) {
    this.writes.push(`episodes 합치기 ${sourceId} → ${targetId}`);
  }
  async publishEpisode(episodeId: number) {
    this.writes.push(`episodes ${episodeId} 게시로 바꿈`);
  }
  async insertIgSnapshots(rows: IgSnapshotInput[]) {
    this.igSnapshots.push(...rows);
    return rows.length;
  }
  async insertYtSnapshots(rows: YtSnapshotInput[]) {
    this.ytSnapshots.push(...rows);
    return rows.length;
  }
  async insertAudience(rows: AudienceInput[]) {
    for (const r of rows) this.writes.push(`${r.platform === "ig" ? "인스타 팔로워" : "유튜브 구독자"} ${r.count}`);
    return rows.length;
  }
  async uploadCover(path: string, bytes: ArrayBuffer) {
    this.writes.push(`표지 ${path} (${Math.round(bytes.byteLength / 1024)}KB)`);
  }
}
