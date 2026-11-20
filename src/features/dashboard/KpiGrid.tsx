import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "cn";
import type { IgHome, KpiValue, YtHome } from "@/lib/data/builders";
import { formatCount, formatCountFull, formatPct, formatRate, formatSignedCount } from "@/lib/domain/format";
import { Sparkline } from "./Sparkline";

function Tile({ label, value, spark, children }: { label: string; value: string; spark?: KpiValue["spark"]; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl border border-border bg-card px-4 py-3 shadow-block">
      <span className="truncate text-xs text-muted-foreground" title={`${label} · 비율은 중앙값`}>{label}</span>
      <span className="flex items-end gap-3">
        <span className="text-[26px] font-bold leading-tight tracking-tight tabular-nums xl:text-[30px]">{value}</span>
        {spark && spark.length >= 2 ? (
          <Sparkline points={spark} fromZero={false} label={`${label} 최근 30일 흐름`} className="mb-1 h-8 min-h-0 min-w-0 flex-1" />
        ) : null}
      </span>
      <span className="text-xs tabular-nums">{children}</span>
    </div>
  );
}

/** 팔로워·구독자: 오늘부터 쌓이므로 7일이 안 됐으면 그렇게 적는다 */
const audienceGrowth = (k: KpiValue) =>
  k.value === null ? (
    <span className="text-muted-foreground">다음 수집부터 기록</span>
  ) : k.compare === null ? (
    <span className="text-muted-foreground">기록 7일 뒤부터 증가 표시</span>
  ) : (
    <Trend up={k.compare >= 0} good={k.compare >= 0}>{formatSignedCount(k.compare)} · 7일</Trend>
  );

/** 화살표는 값이 오른 방향, 색은 좋아졌는지(건너뛰기는 내려가야 좋다) */
function Trend({ up, good, children }: { up: boolean | null; good: boolean | null; children: React.ReactNode }) {
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5", good === null ? "text-muted-foreground" : good ? "text-rano" : "text-danger")}>
      {up === null ? null : <Icon className="size-3.5" aria-hidden />}
      {children}
    </span>
  );
}

const growth = (v: number | null) =>
  v === null ? <span className="text-muted-foreground">수집 7일 뒤부터 표시</span> : <Trend up={v >= 0} good={v >= 0}>{formatSignedCount(v)} · 7일</Trend>;

/** 직전 5편보다 올랐는지. 같거나 비교할 값이 없으면 null */
const rose = (k: KpiValue) => (k.value !== null && k.compare !== null && k.value !== k.compare ? k.value > k.compare : null);

export function KpiGrid({ kpis }: { kpis: IgHome["kpis"] }) {
  const { views, followers, skipMedian, saveShareMedian } = kpis;
  // 건너뛰기는 낮을수록 좋다
  const skipUp = rose(skipMedian);
  const ssUp = rose(saveShareMedian);
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4">
      <Tile label="인스타 총 조회" value={formatCount(views.value)}>{growth(views.compare)}</Tile>
      <Tile label="인스타 팔로워" value={formatCountFull(followers.value)} spark={followers.spark}>{audienceGrowth(followers)}</Tile>
      <Tile label="건너뛰기 (최근 5편)" value={formatPct(skipMedian.value)}>
        <Trend up={skipUp} good={skipUp === null ? null : !skipUp}>직전 5편 {formatPct(skipMedian.compare)}</Trend>
      </Tile>
      <Tile label="저장+공유 (최근 5편)" value={formatRate(saveShareMedian.value)}>
        <Trend up={ssUp} good={ssUp}>직전 5편 {formatRate(saveShareMedian.compare)}</Trend>
      </Tile>
    </div>
  );
}

export function YtKpiGrid({ kpis }: { kpis: YtHome["kpis"] }) {
  const { views, engagedMedian, avgViewPctMedian, subscribers } = kpis;
  const engagedUp = rose(engagedMedian);
  const pctUp = rose(avgViewPctMedian);
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4">
      <Tile label="유튜브 총 조회" value={formatCount(views.value)}>{growth(views.compare)}</Tile>
      <Tile label="유효 조회 비율 (최근 5편)" value={formatPct(engagedMedian.value)}>
        <Trend up={engagedUp} good={engagedUp}>직전 5편 {formatPct(engagedMedian.compare)}</Trend>
      </Tile>
      <Tile label="평균 시청률 (최근 5편)" value={formatPct(avgViewPctMedian.value)}>
        <Trend up={pctUp} good={pctUp}>직전 5편 {formatPct(avgViewPctMedian.compare)}</Trend>
      </Tile>
      <Tile label="유튜브 구독자" value={formatCountFull(subscribers.value)} spark={subscribers.spark}>{audienceGrowth(subscribers)}</Tile>
    </div>
  );
}
