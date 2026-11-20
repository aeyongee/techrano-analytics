import { spreadRates } from "@/lib/domain/gates";
import type { IgPoint, SyncRunRow, UntrackedItem, Verdict, YtPoint } from "@/lib/domain/types";
import { toView, type EpisodeView } from "./builders";
import type { Repository } from "./repository";

// 화면으로 보내는 시계열은 필요한 열만 남긴다(직렬화 크기를 줄인다).
export interface CompactIgPoint {
  h: number;
  at: string;
  views: number | null;
  reach: number | null;
  skip: number | null;
  save: number | null;
  share: number | null;
  src: "api" | "import";
}

export interface CompactYtPoint {
  h: number;
  at: string;
  views: number | null;
  likes: number | null;
}

const compactIg = (p: IgPoint): CompactIgPoint => {
  const r = spreadRates(p);
  return { h: p.hours, at: p.capturedAt, views: p.views, reach: p.reach, skip: p.skipRate, save: r.saveRate, share: r.shareRate, src: p.source };
};
const compactYt = (p: YtPoint): CompactYtPoint => ({ h: p.hours, at: p.capturedAt, views: p.views, likes: p.likes });

const byPostedDesc = (a: EpisodeView, b: EpisodeView) => Date.parse(b.postedAt ?? "0") - Date.parse(a.postedAt ?? "0");

async function views(repo: Repository) {
  const now = repo.now();
  const all = (await repo.listEpisodes()).map((e) => toView(e, now));
  return { now, all, live: all.filter((e) => e.status !== "archived") };
}

// ── 비교 ───────────────────────────────────────────────────────────

export interface PickerItem {
  key: string;
  epNo: number | null;
  title: string;
  status: EpisodeView["status"];
  ageHours: number | null;
  isBenchmark: boolean;
  coverUrl: string | null;
  hook: Verdict;
  spread: Verdict;
}

export interface CompareSeries {
  key: string;
  epNo: number | null;
  title: string;
  coverUrl: string | null;
  isLatest: boolean;
  ig: CompactIgPoint[];
  yt: CompactYtPoint[];
}

export interface CompareData {
  mode: Repository["mode"];
  now: string;
  episodes: PickerItem[];
  selected: CompareSeries[];
  defaultKeys: string[];
}

export const COMPARE_MAX_HOURS = 168;

export async function loadCompare(repo: Repository, keysParam: string | undefined): Promise<CompareData> {
  const { now, live } = await views(repo);
  const posted = live.filter((e) => e.postedAt).sort(byPostedDesc);
  const latest = posted[0];
  // 기본 세트: 최신 편 + 기준편 + 직전 편
  const defaultKeys = [...new Set([latest, ...posted.filter((e) => e.isBenchmark), posted[1]].filter(Boolean).map((e) => e!.key))].slice(0, 5);
  const requested = (keysParam ?? "").split(",").map((k) => k.trim()).filter(Boolean);
  const valid = new Set(posted.map((e) => e.key));
  const keys = (requested.length ? requested.filter((k) => valid.has(k)) : defaultKeys).slice(0, 5);
  const chosen = keys.map((k) => posted.find((e) => e.key === k)!).filter(Boolean);

  const [ig, yt] = await Promise.all([
    repo.getIgSeries(chosen.flatMap((e) => (e.ig ? [e.ig.mediaId] : [])), COMPARE_MAX_HOURS),
    repo.getYtSeries(chosen.flatMap((e) => (e.yt ? [e.yt.videoId] : [])), COMPARE_MAX_HOURS),
  ]);

  return {
    mode: repo.mode,
    now: now.toISOString(),
    defaultKeys,
    episodes: posted.map((e) => ({
      key: e.key,
      epNo: e.epNo,
      title: e.title,
      status: e.status,
      ageHours: e.ageHours,
      isBenchmark: e.isBenchmark,
      coverUrl: e.coverUrl,
      hook: e.gates.hook,
      spread: e.gates.spread,
    })),
    selected: chosen.map((e) => ({
      key: e.key,
      epNo: e.epNo,
      title: e.title,
      coverUrl: e.coverUrl,
      isLatest: e.id === latest?.id,
      ig: e.ig ? (ig[e.ig.mediaId] ?? []).map(compactIg) : [],
      yt: e.yt ? (yt[e.yt.videoId] ?? []).map(compactYt) : [],
    })),
  };
}

// ── 편 목록 ─────────────────────────────────────────────────────────

export interface EpisodeListData {
  mode: Repository["mode"];
  now: string;
  episodes: EpisodeView[];
}

export async function loadEpisodeList(repo: Repository): Promise<EpisodeListData> {
  const { now, all } = await views(repo);
  // 게시된 편은 최신순, 예약만 걸린 초안은 맨 위
  const sorted = [...all].sort((a, b) => (a.postedAt ? 1 : 0) - (b.postedAt ? 1 : 0) || byPostedDesc(a, b));
  return { mode: repo.mode, now: now.toISOString(), episodes: sorted };
}

// ── 편 상세 ─────────────────────────────────────────────────────────

export interface EpisodeDetailData {
  mode: Repository["mode"];
  now: string;
  episode: EpisodeView;
  ig: CompactIgPoint[];
  yt: CompactYtPoint[];
  /** 초안 확정 때 제안할 번호 */
  nextEpNo: number;
}

export async function loadEpisodeDetail(repo: Repository, key: string): Promise<EpisodeDetailData | null> {
  const now = repo.now();
  const raw = await repo.getEpisode(key);
  if (!raw) return null;
  const episode = toView(raw, now);
  const [ig, yt, all] = await Promise.all([
    episode.ig ? repo.getIgSeries([episode.ig.mediaId]) : Promise.resolve({} as Record<string, IgPoint[]>),
    episode.yt ? repo.getYtSeries([episode.yt.videoId]) : Promise.resolve({} as Record<string, YtPoint[]>),
    repo.listEpisodes(),
  ]);
  return {
    mode: repo.mode,
    now: now.toISOString(),
    episode,
    ig: episode.ig ? (ig[episode.ig.mediaId] ?? []).map(compactIg) : [],
    yt: episode.yt ? (yt[episode.yt.videoId] ?? []).map(compactYt) : [],
    nextEpNo: Math.max(0, ...all.map((e) => e.epNo ?? 0)) + 1,
  };
}

// ── 관리 ───────────────────────────────────────────────────────────

export interface PlatformHealth {
  status: string | null;
  at: string | null;
  error: string | null;
}

export interface AdminData {
  mode: Repository["mode"];
  now: string;
  runs: SyncRunRow[];
  episodes: EpisodeView[];
  untracked: UntrackedItem[];
  nextEpNo: number;
  lastSuccessAt: string | null;
  health: { ig: PlatformHealth; yt: PlatformHealth; analytics: PlatformHealth };
}

function healthOf(runs: SyncRunRow[], pick: (r: SyncRunRow) => string | null, platform: string): PlatformHealth {
  const run = runs.find((r) => pick(r) !== null && pick(r) !== "not_due");
  if (!run) return { status: null, at: null, error: null };
  const err = run.errors.find((e) => e.platform === platform);
  return { status: pick(run), at: run.finishedAt ?? run.startedAt, error: err ? `${err.code}: ${err.message}` : null };
}

export async function loadAdmin(repo: Repository): Promise<AdminData> {
  const { now, all } = await views(repo);
  const [runs, untracked] = await Promise.all([repo.listSyncRuns(30), repo.listUntracked()]);
  const ok = runs.find((r) => r.status === "success" || r.status === "partial");
  return {
    mode: repo.mode,
    now: now.toISOString(),
    runs,
    episodes: [...all].sort((a, b) => (b.epNo ?? 9999) - (a.epNo ?? 9999) || byPostedDesc(a, b)),
    untracked,
    nextEpNo: Math.max(0, ...all.map((e) => e.epNo ?? 0)) + 1,
    lastSuccessAt: ok?.finishedAt ?? ok?.startedAt ?? null,
    health: {
      ig: healthOf(runs, (r) => r.igStatus, "ig"),
      yt: healthOf(runs, (r) => r.ytStatus, "yt"),
      analytics: healthOf(runs, (r) => r.ytAnalyticsStatus, "yt_analytics"),
    },
  };
}
