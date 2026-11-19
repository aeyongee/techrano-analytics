import type { FetchJsonOptions, Sleep } from "./http";
import { redactAndTrim } from "./redact";
import type { SyncError } from "./types";

/** 한 번의 실행에서 공유하는 시계, 시간 예산, 호출 수, 오류 목록 */
export class SyncContext {
  readonly calls: Record<string, number> = {};
  readonly errors: SyncError[] = [];
  readonly notes: string[] = [];

  constructor(
    readonly now: Date,
    private readonly deadlineMs: number,
    private readonly clock: () => number,
    readonly force: boolean,
    readonly discoverAll: boolean,
    readonly http: Pick<FetchJsonOptions, "fetchImpl" | "sleep">,
  ) {}

  count(key: string) {
    this.calls[key] = (this.calls[key] ?? 0) + 1;
  }

  fail(err: SyncError) {
    this.errors.push({ ...err, message: redactAndTrim(err.message) });
  }

  note(text: string) {
    if (!this.notes.includes(text)) this.notes.push(text);
  }

  timeLeftMs(): number {
    return this.deadlineMs - this.clock();
  }

  /** 지금 시각(실행 중 흐른 시간 포함) */
  current(): Date {
    return new Date(this.clock());
  }
}

export type HttpDeps = { fetchImpl?: typeof fetch; sleep?: Sleep };
