import { fetchJson, HttpError } from "../http";
import type { HttpDeps } from "../context";
import { parseInsightsData, usagePercent, type IgMediaItem } from "./parse";

const BASE = "https://graph.facebook.com";
/** Graph API 한도 초과 코드(앱·사용자·BUC) */
const RATE_LIMIT_CODES = new Set([4, 17, 32, 613, 80001, 80002]);

export class IgRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IgRateLimitError";
  }
}

/** 삭제·보관됐거나 권한이 없는 릴스 */
export class IgMissingMediaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IgMissingMediaError";
  }
}

const isRateLimit = (e: HttpError) => typeof e.apiCode === "number" && RATE_LIMIT_CODES.has(e.apiCode);
const isMissingObject = (e: HttpError) => e.apiCode === 100 && e.apiSubcode === 33;
const isUnsupportedMetric = (e: HttpError) => e.status === 400 && e.apiCode === 100 && !isMissingObject(e);

export interface InstagramClientOptions extends HttpDeps {
  token: string;
  graphVersion: string | null;
  onCall: () => void;
  onUsage?: (percent: number) => void;
}

export class InstagramClient {
  constructor(private readonly opts: InstagramClientOptions) {}

  private async get<T>(path: string, params: Record<string, string | number>): Promise<T> {
    const prefix = this.opts.graphVersion ? `${this.opts.graphVersion}/` : "";
    const qs = new URLSearchParams({ ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
    qs.set("access_token", this.opts.token); // 검증된 방식대로 쿼리로 보낸다. 오류 문자열은 redact된다.
    this.opts.onCall();
    return fetchJson<T>(`${BASE}/${prefix}${path}?${qs}`, {
      fetchImpl: this.opts.fetchImpl,
      sleep: this.opts.sleep,
      onResponse: (res) => {
        const pct = usagePercent(res.headers);
        if (pct !== null) this.opts.onUsage?.(pct);
      },
    });
  }

  private translate(e: unknown): never {
    if (e instanceof HttpError && isRateLimit(e)) throw new IgRateLimitError(e.message);
    if (e instanceof HttpError && isMissingObject(e)) throw new IgMissingMediaError(e.message);
    throw e;
  }

  async getAccount(): Promise<{ id: string; username: string | null }> {
    const res = await this.get<{ data: { id: string; username?: string }[] }>("me/assigned_instagram_accounts", {
      fields: "id,username",
    }).catch((e) => this.translate(e));
    const first = res.data?.[0];
    if (!first) throw new HttpError(0, "토큰에 할당된 인스타 계정이 없다(business_management 권한 확인).", "NO_ACCOUNT");
    return { id: first.id, username: first.username ?? null };
  }

  /** REELS만 돌려준다. all이면 paging.next를 따라 최대 maxPages까지 본다. */
  async listReels(igUserId: string, { all, maxPages = 10 }: { all: boolean; maxPages?: number }): Promise<IgMediaItem[]> {
    type Page = { data: IgMediaItem[]; paging?: { cursors?: { after?: string }; next?: string } };
    const out: IgMediaItem[] = [];
    let after: string | undefined;
    for (let page = 0; page < (all ? maxPages : 1); page++) {
      const res = await this.get<Page>(`${igUserId}/media`, {
        fields: "id,caption,media_product_type,timestamp,permalink",
        limit: 25,
        ...(after ? { after } : {}),
      }).catch((e) => this.translate(e));
      out.push(...(res.data ?? []));
      after = res.paging?.next ? res.paging.cursors?.after : undefined;
      if (!after) break;
    }
    return out.filter((m) => m.media_product_type === "REELS");
  }

  /**
   * 지표를 한 번에 묻고, 실패하면 하나씩 다시 묻는다(insta-stats.py와 같은 폴백).
   * 400 + code 100으로 거부된 지표는 unsupported로 돌려준다. 모든 지표가 거부되면 릴스 자체의 문제로 본다.
   */
  async fetchInsights(
    mediaId: string,
    metrics: readonly string[],
  ): Promise<{ values: Partial<Record<string, number | null>>; unsupported: string[] }> {
    try {
      const res = await this.get<{ data: unknown }>(`${mediaId}/insights`, { metric: metrics.join(",") });
      return { values: parseInsightsData(res.data), unsupported: [] };
    } catch (e) {
      if (!(e instanceof HttpError)) throw e;
      if (isRateLimit(e) || isMissingObject(e)) this.translate(e);
    }

    const values: Partial<Record<string, number | null>> = {};
    const unsupported: string[] = [];
    let transient: HttpError | null = null;
    for (const metric of metrics) {
      try {
        const res = await this.get<{ data: unknown }>(`${mediaId}/insights`, { metric });
        Object.assign(values, parseInsightsData(res.data));
      } catch (e) {
        if (!(e instanceof HttpError)) throw e;
        if (isRateLimit(e) || isMissingObject(e)) this.translate(e);
        if (isUnsupportedMetric(e)) unsupported.push(metric);
        else transient ??= e;
      }
    }
    if (unsupported.length === metrics.length) {
      throw new IgMissingMediaError(`모든 지표가 거부됐다(${mediaId}). 삭제·보관된 릴스일 수 있다.`);
    }
    if (Object.keys(values).length === 0 && transient) throw transient;
    return { values, unsupported };
  }
}
