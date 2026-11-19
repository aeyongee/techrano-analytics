// 데모용 관리자 동작. 아무것도 저장하지 않고, 실서비스와 같은 모양의 결과만 돌려준다.
import type { SyncRunRow } from "@/lib/domain/types";
import type { ActionResult, EpisodeActions } from "./types";

const DEMO_COOLDOWN_SEC = 30; // 실서비스는 120초
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let lastSync = 0;
let nextRunId = 9000;

const saved = async (): Promise<ActionResult> => {
  await wait(350);
  return { ok: true, data: null, demo: true };
};

export const demoActions: EpisodeActions = {
  async syncNow() {
    const now = Date.now();
    const left = Math.ceil((lastSync + DEMO_COOLDOWN_SEC * 1000 - now) / 1000);
    if (left > 0) return { ok: false, code: "COOLDOWN", message: `방금 수집했습니다. ${left}초 뒤에 다시 할 수 있습니다.`, retryAfterSec: left };
    lastSync = now;
    await wait(1800);
    const run: SyncRunRow = {
      id: nextRunId++,
      trigger: "manual",
      status: "success",
      startedAt: new Date(now).toISOString(),
      finishedAt: new Date(now + 1800).toISOString(),
      durationMs: 1800,
      igStatus: "ok",
      ytStatus: "ok",
      ytAnalyticsStatus: "ok",
      igCaptured: 12,
      ytCaptured: 12,
      newMedia: 0,
      errors: [],
      note: null,
    };
    return { ok: true, data: { run }, demo: true };
  },
  updateEpisodeMeta: saved,
  confirmDraft: saved,
  mergeEpisodes: saved,
  async unpair() {
    await wait(350);
    return { ok: true, data: { newDraftId: -1 }, demo: true };
  },
  setTracked: saved,
  setBenchmark: saved,
};

export const DEMO_COOLDOWN = DEMO_COOLDOWN_SEC;
