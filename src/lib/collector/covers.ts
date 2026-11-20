import type { SyncContext } from "./context";
import { fetchBytes, HttpError } from "./http";
import type { SyncStore } from "./types";

/** 한 회차에 받는 표지 수 상한(시간 예산 보호). 남은 것은 다음 회차에 받는다. */
export const MAX_COVERS_PER_RUN = 12;

export interface CoverJob {
  id: string;
  path: string;
  /** 앞에서부터 시도할 이미지 주소 */
  urls: string[];
  save: (path: string) => Promise<void>;
}

/**
 * 표지를 받아 covers 버킷에 올린다. 실패해도 수집 상태(success/partial)에는 영향을 주지 않는다(stage "cover").
 * 받은 개수를 돌려준다.
 */
export async function saveCovers(ctx: SyncContext, store: SyncStore, platform: "ig" | "yt", jobs: CoverJob[]): Promise<number> {
  let saved = 0;
  for (const job of jobs.slice(0, MAX_COVERS_PER_RUN)) {
    if (ctx.timeLeftMs() < 8_000) break;
    let lastError: unknown = null;
    for (const url of job.urls) {
      try {
        const { bytes, contentType } = await fetchBytes(url, ctx.http.fetchImpl);
        await store.uploadCover(job.path, bytes, contentType.startsWith("image/") ? contentType : "image/jpeg");
        await job.save(job.path);
        saved++;
        lastError = null;
        break;
      } catch (e) {
        lastError = e;
      }
    }
    if (lastError) {
      ctx.fail({
        platform,
        stage: "cover",
        target: job.id,
        code: lastError instanceof HttpError ? String(lastError.apiCode ?? lastError.status) : "ERROR",
        message: (lastError as Error).message,
      });
    }
  }
  return saved;
}
