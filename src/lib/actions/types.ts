import type { SyncRunRow } from "@/lib/domain/types";

export type ActionResult<T = null> =
  | { ok: true; data: T; demo?: true }
  | {
      ok: false;
      code: "FORBIDDEN" | "VALIDATION" | "BUSY" | "COOLDOWN" | "CONFLICT" | "NOT_FOUND" | "UPSTREAM";
      message: string;
      retryAfterSec?: number;
    };

export interface EpisodeMetaPatch {
  title?: string;
  series?: string | null;
  topic?: string | null;
  isTrueStory?: boolean;
  hookDesc?: string | null;
  hypothesis?: string | null;
  retro72h?: string | null;
  notes?: string | null;
}

export interface ConfirmDraftInput {
  epNo: number;
  title: string;
  series?: string | null;
  hookDesc?: string | null;
}

export interface SyncNowResult {
  run: SyncRunRow;
}

/** 실데이터는 Server Action 참조, 데모는 저장하지 않는 흉내로 같은 모양을 채운다. */
export interface EpisodeActions {
  syncNow(): Promise<ActionResult<SyncNowResult>>;
  updateEpisodeMeta(id: number, patch: EpisodeMetaPatch): Promise<ActionResult>;
  confirmDraft(id: number, input: ConfirmDraftInput): Promise<ActionResult>;
  mergeEpisodes(sourceId: number, targetId: number): Promise<ActionResult>;
  unpair(id: number, platform: "ig" | "yt"): Promise<ActionResult<{ newDraftId: number }>>;
  setTracked(platform: "ig" | "yt", platformId: string, tracked: boolean): Promise<ActionResult>;
  setBenchmark(id: number, on: boolean): Promise<ActionResult>;
}
