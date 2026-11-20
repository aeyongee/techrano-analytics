import { createHash, timingSafeEqual } from "node:crypto";
import { cronEnv, EnvError } from "@/lib/env";
import { runServerSync, SyncBusyError, SyncCooldownError } from "@/server/collector";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const sha256 = (s: string) => createHash("sha256").update(s).digest();

function authorized(header: string | null, secret: string): boolean {
  const token = header?.match(/^Bearer\s+(.+)$/)?.[1] ?? "";
  // 길이 차이로 새지 않도록 해시를 비교한다.
  return timingSafeEqual(sha256(token), sha256(secret));
}

/**
 * Supabase DB 예약(pg_cron + pg_net)이 15분마다 부른다. 응답은 상태와 건수만 담는다.
 * 오류 상세는 관리자 화면(sync_runs)에서 본다.
 */
export async function POST(request: Request) {
  let secret: string;
  try {
    secret = cronEnv().CRON_SECRET;
  } catch (e) {
    if (e instanceof EnvError) return Response.json({ error: "not configured" }, { status: 503 });
    throw e;
  }
  if (!authorized(request.headers.get("authorization"), secret)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const s = await runServerSync({
      trigger: "cron",
      force: request.headers.get("x-sync-force") === "1",
      minGapSeconds: 60,
    });
    return Response.json({
      runId: s.runId,
      status: s.status,
      ig: { captured: s.ig.captured },
      yt: { captured: s.yt.captured },
      durationMs: s.durationMs,
    });
  } catch (e) {
    if (e instanceof SyncBusyError) return Response.json({ status: "busy" }, { status: 409 });
    if (e instanceof SyncCooldownError) {
      return Response.json(
        { status: "cooldown", retryAfterSec: e.retryAfterSec },
        { status: 429, headers: { "Retry-After": String(e.retryAfterSec) } },
      );
    }
    console.error("cron sync failed", (e as Error).name);
    return Response.json({ status: "error" }, { status: 500 });
  }
}

export function GET() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}
