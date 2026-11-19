"use client";

import { useMemo, useState } from "react";
import { Panel } from "@/components/Panel";
import { Segmented } from "@/components/Segmented";
import { GrowthChart } from "@/features/compare/GrowthChart";
import { METRICS } from "@/features/compare/metrics";
import type { CompactIgPoint, CompactYtPoint } from "@/lib/data/screens";
import { formatHoursTick } from "@/lib/domain/format";
import { resample, valueAt } from "@/lib/domain/resample";

type Tab = "views" | "skip" | "spread";
type Range = "72h" | "7d" | "all";

function rangeGrid(range: Range, lastHour: number) {
  const max = range === "72h" ? 72 : range === "7d" ? 168 : Math.max(24, Math.ceil(lastHour / 24) * 24);
  const step = max <= 72 ? 0.5 : max <= 168 ? 1 : Math.ceil(max / 160);
  const grid = Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step);
  const ticks =
    max <= 72 ? [0, 6, 12, 24, 48, 72] : Array.from({ length: 7 }, (_, i) => Math.round((i * max) / 6 / 24) * 24).filter((v, i, a) => a.indexOf(v) === i);
  return { max, grid, ticks, maxGap: max <= 168 ? 6 : 36 };
}

export function TrendCharts({ ig, yt, live }: { ig: CompactIgPoint[]; yt: CompactYtPoint[]; live: boolean }) {
  const [tab, setTab] = useState<Tab>("views");
  const lastHour = Math.max(ig.at(-1)?.h ?? 0, yt.at(-1)?.h ?? 0);
  // 아직 3일이 안 된 편은 72시간 창으로 열어야 곡선이 왼쪽에 몰리지 않는다
  const [range, setRange] = useState<Range>(lastHour < 72 ? "72h" : "7d");
  const [hover, setHover] = useState<number | null>(null);

  const built = useMemo(() => {
    const { max, grid, ticks, maxGap } = rangeGrid(range, lastHour);
    const defs =
      tab === "views"
        ? [
            { key: "ig", label: "인스타 조회", color: "var(--sky)", pts: ig.map((p) => ({ hours: p.h, value: p.views })), cumulative: true },
            { key: "yt", label: "유튜브 조회", color: "var(--amber)", pts: yt.map((p) => ({ hours: p.h, value: p.views })), cumulative: true },
          ]
        : tab === "skip"
          ? [{ key: "skip", label: "건너뛰기", color: "var(--rano)", pts: ig.map((p) => ({ hours: p.h, value: p.skip })), cumulative: false }]
          : [
              { key: "save", label: "저장률", color: "var(--rano)", pts: ig.map((p) => ({ hours: p.h, value: p.save })), cumulative: false },
              { key: "share", label: "공유율", color: "var(--lavender)", pts: ig.map((p) => ({ hours: p.h, value: p.share })), cumulative: false },
            ];
    const cols = defs.map((d) => resample(d.pts, grid, { maxGapHours: maxGap, anchorZero: d.cumulative }));
    const rows = grid.map((h, j) => Object.fromEntries([["h", h], ...defs.map((d, i) => [d.key, cols[i][j]])]));
    return { max, ticks, defs, rows, maxGap };
  }, [tab, range, ig, yt, lastHour]);

  const spec =
    tab === "views" ? METRICS.ig.views! : tab === "skip" ? METRICS.ig.skip! : { ...METRICS.ig.save!, threshold: null, thresholdLabel: undefined };
  const at = hover ?? Math.min(lastHour, built.max);
  // 격자가 아니라 실측 사이를 바로 보간한다. 마지막 실측을 조금 넘긴 '지금'은 마지막 값을 쓴다.
  const valueOf = (d: (typeof built.defs)[number]) => {
    const v = valueAt(d.pts, at, { maxGapHours: built.maxGap, anchorZero: d.cumulative });
    if (v !== null) return v;
    const last = [...d.pts].reverse().find((p) => p.value !== null);
    return last && at >= last.hours && at - last.hours <= 0.5 ? last.value : null;
  };

  return (
    <Panel className="overflow-hidden" aria-labelledby="trend-title">
      <div className="flex flex-wrap items-center gap-2 px-4 pt-4 xl:px-5">
        <h2 id="trend-title" className="mr-auto text-[15px] font-bold">
          게시 후 추이
        </h2>
        <Segmented
          label="지표"
          value={tab}
          onChange={setTab}
          options={[
            { value: "views", label: "조회" },
            { value: "skip", label: "건너뛰기" },
            { value: "spread", label: "저장·공유" },
          ]}
        />
        <Segmented
          label="기간"
          value={range}
          onChange={setRange}
          options={[
            { value: "72h", label: "72h" },
            { value: "7d", label: "7일" },
            { value: "all", label: "전체" },
          ]}
        />
      </div>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 pt-3 text-sm tabular-nums xl:px-5" aria-live="polite">
        <span className="text-xs font-semibold text-muted-foreground">{hover === null ? `지금 · ${formatHoursTick(Math.round(at))}` : formatHoursTick(Math.round(at))}</span>
        {built.defs.map((d) => (
          <span key={d.key} className="inline-flex items-baseline gap-1.5">
            <span className="size-2 rounded-full" style={{ background: d.color }} aria-hidden />
            <span className="text-xs text-muted-foreground">{d.label}</span>
            <span className="font-semibold">{spec.format(valueOf(d))}</span>
          </span>
        ))}
      </div>
      <div className="px-1 pt-2 pb-3">
        <GrowthChart
          rows={built.rows}
          series={built.defs.map((d) => ({ key: d.key, label: d.label, color: d.color, width: 2.5, sparse: false, live }))}
          spec={tab === "spread" ? { ...spec, threshold: null } : spec}
          log={false}
          maxHours={built.max}
          ticks={built.ticks}
          onHover={setHover}
          ariaLabel={`게시 후 ${built.defs.map((d) => d.label).join("·")} 추이`}
          height="h-[260px] xl:h-[320px]"
        />
      </div>
      {tab === "spread" ? (
        <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground xl:px-5">2차 관문 기준: 저장 1.0% 이상, 공유 0.5% 이상</p>
      ) : null}
    </Panel>
  );
}
