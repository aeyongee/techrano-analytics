import { redactAndTrim } from "./redact";

/** 외부 API 오류. message는 이미 토큰을 가린 상태다. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Graph API error.code, Google error.errors[0].reason 또는 OAuth error 값 */
    readonly apiCode?: number | string,
    readonly apiSubcode?: number,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export type Sleep = (ms: number) => Promise<void>;
export const realSleep: Sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export interface FetchJsonOptions {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  /** 네트워크 오류·5xx·429에서 다시 시도하는 횟수 */
  retries?: number;
  fetchImpl?: typeof fetch;
  sleep?: Sleep;
  onResponse?: (res: Response) => void;
}

const BACKOFF_MS = [500, 1500];

function parseError(status: number, body: string): HttpError {
  try {
    const json = JSON.parse(body) as Record<string, unknown>;
    const err = json.error;
    if (err && typeof err === "object") {
      const e = err as {
        message?: string;
        code?: number;
        error_subcode?: number;
        errors?: { reason?: string }[];
      };
      // Graph API는 code가 숫자, Google API는 errors[0].reason이 원인이다.
      const reason = e.errors?.[0]?.reason;
      return new HttpError(status, redactAndTrim(`${status}: ${e.message ?? body}`), reason ?? e.code, e.error_subcode);
    }
    if (typeof err === "string") {
      // OAuth 토큰 엔드포인트: {"error":"invalid_grant","error_description":"…"}
      const desc = typeof json.error_description === "string" ? json.error_description : err;
      return new HttpError(status, redactAndTrim(`${status}: ${err} (${desc})`), err);
    }
  } catch {
    // JSON이 아닌 본문
  }
  return new HttpError(status, redactAndTrim(`${status}: ${body.slice(0, 200)}`));
}

export async function fetchJson<T>(url: string, opts: FetchJsonOptions = {}): Promise<T> {
  const { retries = 2, timeoutMs = 15_000, fetchImpl = fetch, sleep = realSleep } = opts;
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetchImpl(url, {
        method: opts.method ?? "GET",
        headers: opts.headers,
        body: opts.body,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      if (attempt < retries) {
        await sleep(BACKOFF_MS[attempt] + Math.random() * 200);
        continue;
      }
      throw new HttpError(0, redactAndTrim(`network: ${(e as Error).message}`), "NETWORK");
    }

    opts.onResponse?.(res);
    if (res.ok) return (await res.json()) as T;

    const err = parseError(res.status, await res.text());
    const retryable = res.status >= 500 || res.status === 429;
    if (retryable && attempt < retries) {
      const retryAfter = Number(res.headers.get("retry-after"));
      if (res.status === 429 && retryAfter > 5) throw err;
      await sleep(retryAfter > 0 ? retryAfter * 1000 : BACKOFF_MS[attempt] + Math.random() * 200);
      continue;
    }
    throw err;
  }
}
