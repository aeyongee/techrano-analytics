import { cn } from "cn";
import type { ShellStatus } from "@/lib/data/builders";
import { formatKst, formatRelative } from "@/lib/domain/format";

/** 마지막 성공 수집이 30분 안이면 초록, 2시간 안이면 노랑, 그 이상이면 빨강 */
export function syncTone(status: ShellStatus): "ok" | "late" | "stale" {
  if (!status.lastSuccessAt) return "stale";
  const min = (Date.parse(status.now) - Date.parse(status.lastSuccessAt)) / 60_000;
  return min <= 30 ? "ok" : min <= 120 ? "late" : "stale";
}

const DOT = { ok: "bg-rano", late: "bg-amber", stale: "bg-danger" } as const;
const LABEL = { ok: "수집 정상", late: "수집 지연", stale: "수집 멈춤" } as const;

export function SyncStatus({ status, compact = false }: { status: ShellStatus; compact?: boolean }) {
  const tone = syncTone(status);
  const when = status.lastSuccessAt ? formatRelative(status.lastSuccessAt, status.now) : "기록 없음";
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums"
      title={status.lastSuccessAt ? `마지막 성공 수집 ${formatKst(status.lastSuccessAt)}` : "성공한 수집이 없습니다"}
    >
      <span className={cn("relative size-2 rounded-full", DOT[tone])}>
        {tone === "ok" ? <span className="absolute inset-0 animate-ping rounded-full bg-rano/60" /> : null}
      </span>
      <span className="sr-only">{LABEL[tone]}</span>
      {compact ? when : `${when} 수집`}
    </span>
  );
}
