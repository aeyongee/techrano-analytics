"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { cn } from "cn";
import { Cover } from "@/components/Cover";
import { PageHeader, Panel } from "@/components/Panel";
import { Segmented } from "@/components/Segmented";
import type { CompareData } from "@/lib/data/screens";
import { formatHoursTick } from "@/lib/domain/format";
import type { CompareWindow } from "@/lib/domain/resample";
import { buildCompare, checkpointValue, valueNear } from "./build";
import { EpisodePicker } from "./EpisodePicker";
import { GrowthChart } from "./GrowthChart";
import { CHECKPOINTS, METRICS, parseView, type CompareMetric, type ComparePlatform } from "./metrics";

export function CompareScreen({ data }: { data: CompareData }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const view = parseView(new URLSearchParams(sp.toString()));
  const [hover, setHover] = useState<number | null>(null);

  // 보기 설정은 주소만 바꾸고(새로 불러오지 않음), 편 선택은 서버에서 시계열을 다시 받는다.
  const setView = (patch: Record<string, string>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) next.set(k, v);
    window.history.replaceState(null, "", `${pathname}?${next}`);
  };
  const setEpisodes = (keys: string[]) => {
    const next = new URLSearchParams(sp.toString());
    next.set("eps", keys.join(","));
    router.replace(`${pathname}?${next}`, { scroll: false });
  };

  const built = useMemo(() => buildCompare(data.selected, view.p, view.m, view.w), [data.selected, view.p, view.m, view.w]);
  const { spec, rows, series } = built;
  const log = spec.cumulative && view.s === "log";

  // 기본 시점: 최신 편의 지금(같은 시점 비교). 손가락·마우스가 가리키면 그 시점.
  const latest = series.find((s) => s.isLatest) ?? series[0];
  const nowH = latest?.lastHour !== null && latest?.lastHour !== undefined ? Math.min(latest.lastHour, built.maxHours) : built.maxHours;
  const at = hover ?? nowH;

  const platformOptions = [
    { value: "ig" as ComparePlatform, label: "인스타" },
    { value: "yt" as ComparePlatform, label: "유튜브" },
  ];
  const metricOptions = (Object.entries(METRICS[view.p]) as [CompareMetric, NonNullable<(typeof METRICS)["ig"]["views"]>][]).map(
    ([value, s]) => ({ value, label: s.label }),
  );

  return (
    <div className="flex flex-col gap-4 xl:gap-5">
      <PageHeader title="T+ 비교" subtitle="날짜가 아니라 게시 후 경과 시간으로 줄을 맞춰 겹쳐 본다" />

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 xl:mx-0 xl:flex-wrap xl:overflow-visible xl:px-0">
        <Segmented label="플랫폼" value={view.p} options={platformOptions} onChange={(p) => setView({ p, m: METRICS[p][view.m] ? view.m : "views" })} />
        <Segmented label="지표" value={view.m} options={metricOptions} onChange={(m) => setView({ m })} />
        <Segmented
          label="기간"
          value={view.w}
          options={(["24h", "72h", "7d"] as CompareWindow[]).map((w) => ({ value: w, label: w === "7d" ? "7일" : w }))}
          onChange={(w) => setView({ w })}
        />
        {spec.cumulative ? (
          <Segmented
            label="세로축"
            value={view.s}
            options={[
              { value: "log", label: "로그" },
              { value: "lin", label: "선형" },
            ]}
            onChange={(s) => setView({ s })}
          />
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {series.map((s) => (
          <span key={s.key} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-border bg-card py-1 pr-3 pl-1 text-xs">
            <Cover src={s.coverUrl} alt={s.title} size="chip" className="rounded-full" />
            <span className="size-2.5 rounded-full" style={{ background: s.color }} aria-hidden />
            <span className="font-semibold">{s.label}</span>
            <span className="max-w-[9rem] truncate text-muted-foreground">{s.title}</span>
          </span>
        ))}
        <EpisodePicker episodes={data.episodes} selected={data.selected.map((s) => s.key)} defaultKeys={data.defaultKeys} onApply={setEpisodes} />
      </div>

      <Panel className="overflow-hidden">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-border px-4 py-3 xl:px-5" aria-live="polite">
          <span className="text-xs font-semibold text-muted-foreground tabular-nums">
            {hover === null ? `지금 · ${formatHoursTick(Math.round(at))}` : formatHoursTick(Math.round(at * 4) / 4)}
          </span>
          {series.map((s) => (
            <span key={s.key} className="inline-flex items-baseline gap-1.5 text-sm tabular-nums">
              <span className="size-2 translate-y-[-1px] rounded-full" style={{ background: s.color }} aria-hidden />
              <span className="text-xs text-muted-foreground">{s.label}</span>
              <span className={cn("font-semibold", s.isLatest && "text-rano")}>{spec.format(valueNear(s, at, view.w, spec.cumulative))}</span>
            </span>
          ))}
        </div>
        {series.length ? (
          <div className="px-1 pt-3 pb-2">
            <GrowthChart
              rows={rows}
              series={series.map((s) => ({ key: s.key, label: s.label, color: s.color, width: s.isLatest ? 3 : 2, sparse: s.sparse, live: s.isLatest }))}
              spec={spec}
              log={log}
              maxHours={built.maxHours}
              ticks={built.ticks}
              onHover={setHover}
              ariaLabel={`${series.length}편의 ${view.p === "ig" ? "인스타" : "유튜브"} ${spec.label}, 게시 후 ${view.w}`}
            />
          </div>
        ) : (
          <p className="p-6 text-sm text-muted-foreground">비교할 편을 골라 주세요.</p>
        )}
        {built.notes.length ? (
          <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground xl:px-5">
            점선은 실측이 적은 편(점만 실측). {built.notes.join(" · ")}
          </p>
        ) : null}
      </Panel>

      <Panel aria-labelledby="checkpoint-title" className="overflow-hidden">
        <h2 id="checkpoint-title" className="px-4 pt-4 text-[15px] font-bold xl:px-5">
          같은 시점 비교 <span className="text-xs font-normal text-muted-foreground">· {spec.label}</span>
        </h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm tabular-nums">
            <thead>
              <tr className="border-b border-border text-[11px] text-muted-foreground">
                <th scope="col" className="sticky left-0 bg-card px-4 py-2 text-left font-semibold xl:px-5">편</th>
                {CHECKPOINTS[view.w].map((h) => (
                  <th key={h} scope="col" className="px-3 py-2 text-right font-semibold">
                    {formatHoursTick(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {series.map((s) => (
                <tr key={s.key} className="border-b border-border last:border-0">
                  <th scope="row" className="sticky left-0 bg-card px-4 py-2.5 text-left font-semibold xl:px-5">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="size-2 rounded-full" style={{ background: s.color }} aria-hidden />
                      {s.label}
                    </span>
                  </th>
                  {CHECKPOINTS[view.w].map((h) => (
                    <td key={h} className={cn("px-3 py-2.5 text-right", s.isLatest ? "font-semibold text-foreground" : "text-muted-foreground")}>
                      {spec.format(checkpointValue(s, h, view.w, spec.cumulative))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
