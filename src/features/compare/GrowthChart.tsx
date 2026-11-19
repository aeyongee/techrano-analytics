"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatHoursTick } from "@/lib/domain/format";
import type { MetricSpec } from "./metrics";

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
  width: number;
  /** 실측점이 적은 편: 실측 위치에만 점을 찍고 점선으로 잇는다(보간처럼 보이지 않게) */
  sparse: boolean;
  /** 진행 중인 편이면 마지막 점에 '지금' 표시 */
  live: boolean;
}

export function GrowthChart({
  rows,
  series,
  spec,
  log,
  maxHours,
  ticks,
  onHover,
  ariaLabel,
  height = "h-[300px] xl:h-[440px]",
}: {
  rows: Record<string, number | null>[];
  series: ChartSeries[];
  spec: MetricSpec;
  log: boolean;
  maxHours: number;
  ticks: number[];
  onHover: (h: number | null) => void;
  ariaLabel: string;
  height?: string;
}) {
  const positives = rows.flatMap((r) => series.map((s) => r[s.key])).filter((v): v is number => v !== null && v > 0);
  const minPositive = positives.length ? Math.min(...positives) : 1;
  const logFloor = Math.max(1, 10 ** Math.floor(Math.log10(minPositive)));
  // 로그 축에서는 0 이하를 그릴 수 없어 비운다
  const data = log ? rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, k !== "h" && v !== null && v <= 0 ? null : v]))) : rows;
  const lastIndex = (key: string) => {
    for (let i = data.length - 1; i >= 0; i--) if (data[i][key] !== null && data[i][key] !== undefined) return i;
    return -1;
  };

  return (
    <div className={height} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 10, right: 16, bottom: 4, left: 0 }}
          onMouseMove={(state) => {
            const label = (state as { activeLabel?: string | number } | undefined)?.activeLabel;
            if (label !== undefined && label !== null) onHover(Number(label));
          }}
          onMouseLeave={() => onHover(null)}
        >
          <CartesianGrid stroke="var(--border)" strokeDasharray="2 5" vertical={false} />
          <XAxis
            dataKey="h"
            type="number"
            domain={[0, maxHours]}
            ticks={ticks}
            tickFormatter={formatHoursTick}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            stroke="var(--border)"
          />
          <YAxis
            scale={log ? "log" : "linear"}
            domain={log ? [logFloor, "auto"] : [0, "auto"]}
            allowDataOverflow={log}
            tickFormatter={(v: number) => spec.format(v)}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            stroke="var(--border)"
            width={48}
          />
          {spec.threshold !== null ? (
            <ReferenceLine
              y={spec.threshold}
              stroke="var(--muted-foreground)"
              strokeDasharray="4 4"
              label={{ value: spec.thresholdLabel, position: "insideTopRight", fill: "var(--muted-foreground)", fontSize: 11 }}
            />
          ) : null}
          <Tooltip content={() => null} cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }} />
          {series.map((s) => {
            const end = s.live ? lastIndex(s.key) : -1;
            return (
              <Line
                key={s.key}
                dataKey={s.key}
                name={s.label}
                type="monotone"
                stroke={s.color}
                strokeWidth={s.width}
                connectNulls={s.sparse}
                strokeDasharray={s.sparse ? "4 3" : undefined}
                isAnimationActive={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                dot={(props: { cx?: number; cy?: number; index?: number }) => {
                  const { cx, cy, index } = props;
                  if (cx === undefined || cy === undefined || cx === null || cy === null) return <g key={`${s.key}-${index}`} />;
                  if (index === end) {
                    return (
                      <g key={`${s.key}-${index}`}>
                        <circle cx={cx} cy={cy} r={8} fill={s.color} opacity={0.25} />
                        <circle cx={cx} cy={cy} r={4} fill={s.color} />
                      </g>
                    );
                  }
                  return s.sparse ? <circle key={`${s.key}-${index}`} cx={cx} cy={cy} r={2.5} fill={s.color} /> : <g key={`${s.key}-${index}`} />;
                }}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
