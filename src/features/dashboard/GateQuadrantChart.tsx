"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CartesianGrid, ReferenceArea, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, XAxis, YAxis } from "recharts";
import { cn } from "cn";
import { Cover } from "@/components/Cover";
import { GateBadge } from "@/components/GateBadge";
import { Panel, PanelHeader } from "@/components/Panel";
import type { IgHome, QuadrantPoint } from "@/lib/data/builders";
import { GATES, QUADRANT_LABEL, QUADRANT_Y_LINE, YT_GATES, YT_QUADRANT_LABEL } from "@/lib/domain/constants";
import type { Platform, Quadrant } from "@/lib/domain/types";

const COLOR: Record<Quadrant, string> = {
  breakout: "var(--rano)",
  hookWeak: "var(--amber)",
  saveWeak: "var(--sky)",
  rework: "var(--danger)",
};

const AXIS = { fill: "var(--muted-foreground)", fontSize: 11 };

/**
 * 플랫폼별 축. 오른쪽 = 1차 통과, 위 = 2차 통과가 되도록 맞춘다.
 * 인스타는 건너뛰기(낮을수록 좋음)라 X축을 뒤집는다.
 */
const CONFIG = {
  ig: {
    xLine: GATES.hook.maxSkipRate,
    yLine: QUADRANT_Y_LINE,
    reversed: true,
    labels: QUADRANT_LABEL,
    xLabel: "건너뛰기 비율 · 오른쪽일수록 낮음(좋음)",
    hint: `기준: 건너뛰기 ${GATES.hook.maxSkipRate}% · 저장 ${GATES.spread.minSaveRate}% + 공유 ${GATES.spread.minShareRate}%  ·  버블 크기 = 조회수`,
    secondLabel: "2차 확산",
    domain: (xs: number[], ys: number[]) => ({
      xMin: Math.floor(Math.min(35, ...xs.map((x) => x - 2)) / 5) * 5,
      xMax: Math.ceil(Math.max(60, ...xs.map((x) => x + 2)) / 5) * 5,
      yMin: 0,
      yMax: Math.ceil(Math.max(3, ...ys.map((y) => y * 1.15)) * 2) / 2,
    }),
  },
  yt: {
    xLine: YT_GATES.hook.minEngagedRatio,
    yLine: YT_GATES.finish.minAvgViewPct,
    reversed: false,
    labels: YT_QUADRANT_LABEL,
    xLabel: "유효 조회 비율 · 오른쪽일수록 높음(좋음)",
    hint: `기준(잠정): 유효 조회 ${YT_GATES.hook.minEngagedRatio}% · 평균 시청 ${YT_GATES.finish.minAvgViewPct}%  ·  버블 크기 = 조회수`,
    secondLabel: "2차 끝까지",
    domain: (xs: number[], ys: number[]) => ({
      xMin: Math.floor(Math.min(15, ...xs.map((x) => x - 3)) / 5) * 5,
      xMax: Math.ceil(Math.max(45, ...xs.map((x) => x + 3)) / 5) * 5,
      yMin: Math.floor(Math.min(50, ...ys.map((y) => y - 4)) / 10) * 10,
      yMax: Math.ceil(Math.max(90, ...ys.map((y) => y + 4)) / 10) * 10,
    }),
  },
} as const;

const pointLabel = (p: QuadrantPoint) => (p.epNo !== null ? String(p.epNo) : "새");

export function GateQuadrantChart({
  platform,
  points,
  excluded,
  basePath,
}: {
  platform: Platform;
  points: QuadrantPoint[];
  excluded: IgHome["excluded"];
  basePath: string;
}) {
  const c = CONFIG[platform];
  const [selectedKey, setSelectedKey] = useState(() => (points.find((p) => p.isLatest) ?? points[0])?.key ?? null);
  const selected = points.find((p) => p.key === selectedKey) ?? null;
  const maxViews = Math.max(1, ...points.map((p) => p.views));
  const { xMin, xMax, yMin, yMax } = c.domain(points.map((p) => p.x), points.map((p) => p.y));
  // 1차 통과 쪽(오른쪽)의 x 범위. 인스타는 축이 뒤집혀 기준선 아래 값이 오른쪽이다.
  const [passX1, passX2] = c.reversed ? [xMin, c.xLine] : [c.xLine, xMax];
  const [failX1, failX2] = c.reversed ? [c.xLine, xMax] : [xMin, c.xLine];
  const ticks = Array.from({ length: (xMax - xMin) / 5 + 1 }, (_, i) => xMin + i * 5);

  // 조회수는 넓이가 아니라 반지름에 제곱근으로 걸어 조회가 적은 편도 보이게 한다
  const radius = (views: number) => 7 + 12 * Math.sqrt(views / maxViews);
  const drawOrder = [...points].sort((a, b) => b.views - a.views);

  const Bubble = (props: { cx?: number; cy?: number; payload?: QuadrantPoint }) => {
    const { cx = 0, cy = 0, payload: p } = props;
    if (!p) return <g />;
    const r = radius(p.views);
    const isSelected = p.key === selectedKey;
    return (
      <g
        role="button"
        tabIndex={0}
        aria-label={`${p.epNo !== null ? `${p.epNo}편` : "초안"} ${p.title}: ${c.labels[p.quadrant]}`}
        aria-pressed={isSelected}
        onClick={() => setSelectedKey(p.key)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setSelectedKey(p.key);
          }
        }}
        className="cursor-pointer outline-none [&:focus-visible>circle:first-child]:stroke-ring"
      >
        {isSelected || p.isLatest ? (
          <circle cx={cx} cy={cy} r={r + 4} fill="none" stroke={isSelected ? "var(--foreground)" : COLOR[p.quadrant]} strokeWidth={1.5} strokeDasharray={isSelected ? undefined : "2 3"} />
        ) : null}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill={COLOR[p.quadrant]}
          fillOpacity={0.82}
          stroke={p.strictMismatch ? "var(--amber)" : "var(--background)"}
          strokeWidth={p.strictMismatch ? 2 : 1.5}
          strokeDasharray={p.strictMismatch ? "3 2" : undefined}
        />
        <text x={cx} y={cy} dy="0.35em" textAnchor="middle" fontSize={r > 12 ? 11 : 10} fontWeight={800} fill="#0b1220" pointerEvents="none">
          {pointLabel(p)}
        </text>
      </g>
    );
  };

  return (
    <Panel className="flex h-full flex-col" aria-labelledby="quadrant-title">
      <PanelHeader
        title={<span id="quadrant-title">2단계 관문</span>}
        hint={c.hint}
      />
      <div
        className="h-[320px] px-1 pt-2 xl:h-[380px]"
        role="figure"
        aria-label={`편 ${points.length}개의 관문 위치. ${c.labels.breakout} ${points.filter((p) => p.quadrant === "breakout").length}편.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 14, bottom: 22, left: 0 }}>
            <ReferenceArea x1={passX1} x2={passX2} y1={c.yLine} y2={yMax} fill={COLOR.breakout} fillOpacity={0.07} stroke="none"
              label={{ value: c.labels.breakout, position: "insideTopRight", fill: COLOR.breakout, fontSize: 12, fontWeight: 700 }} />
            <ReferenceArea x1={failX1} x2={failX2} y1={c.yLine} y2={yMax} fill={COLOR.hookWeak} fillOpacity={0.05} stroke="none"
              label={{ value: c.labels.hookWeak, position: "insideTopLeft", fill: COLOR.hookWeak, fontSize: 12, fontWeight: 700 }} />
            <ReferenceArea x1={passX1} x2={passX2} y1={yMin} y2={c.yLine} fill={COLOR.saveWeak} fillOpacity={0.05} stroke="none"
              label={{ value: c.labels.saveWeak, position: "insideBottomRight", fill: COLOR.saveWeak, fontSize: 12, fontWeight: 700 }} />
            <ReferenceArea x1={failX1} x2={failX2} y1={yMin} y2={c.yLine} fill={COLOR.rework} fillOpacity={0.05} stroke="none"
              label={{ value: c.labels.rework, position: "insideBottomLeft", fill: COLOR.rework, fontSize: 12, fontWeight: 700 }} />
            <CartesianGrid stroke="var(--border)" strokeDasharray="2 5" />
            <XAxis
              type="number"
              dataKey="x"
              domain={[xMin, xMax]}
              ticks={ticks}
              reversed={c.reversed}
              tickFormatter={(v: number) => `${v}%`}
              tick={AXIS}
              stroke="var(--border)"
              label={{ value: c.xLabel, position: "insideBottom", offset: -14, ...AXIS }}
            />
            <YAxis
              type="number"
              dataKey="y"
              domain={[yMin, yMax]}
              tickFormatter={(v: number) => `${v}%`}
              tick={AXIS}
              stroke="var(--border)"
              width={38}
            />
            <ReferenceLine x={c.xLine} stroke="var(--muted-foreground)" strokeDasharray="4 4" strokeOpacity={0.7} />
            <ReferenceLine y={c.yLine} stroke="var(--muted-foreground)" strokeDasharray="4 4" strokeOpacity={0.7} />
            <Scatter data={drawOrder} shape={Bubble} isAnimationActive={false} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-auto border-t border-border px-4 py-3 xl:px-5">
        {selected ? (
          <div className="flex gap-3">
          <Cover src={selected.coverUrl} alt={selected.title} size="md" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ background: COLOR[selected.quadrant] }} aria-hidden />
              <span className="text-xs font-semibold" style={{ color: COLOR[selected.quadrant] }}>
                {c.labels[selected.quadrant]}
              </span>
              <span className="min-w-0 truncate text-sm font-semibold">
                {selected.epNo !== null ? `${selected.epNo}편 ` : "초안 "}
                {selected.title}
              </span>
              <Link
                href={`${basePath}/episodes/${selected.key}`}
                className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-sky hover:underline"
              >
                상세 <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </div>
            <p className="text-xs text-muted-foreground tabular-nums">
              {selected.facts.map((f, i) => (
                <span key={f.label}>
                  {i ? " · " : ""}
                  {f.label} <span className="text-foreground">{f.value}</span>
                </span>
              ))}
            </p>
            {selected.note ? (
              <p className="text-xs text-amber">{selected.note}</p>
            ) : (
              <GateBadge label={c.secondLabel} verdict={selected.second} className="self-start" />
            )}
          </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">아직 판정할 수 있는 편이 없다.</p>
        )}
        {excluded.length ? (
          <p className={cn("text-[11px] text-muted-foreground", selected && "mt-2")}>
            차트에 없는 편:{" "}
            {excluded.map((e, i) => `${i ? ", " : ""}${e.epNo !== null ? `${e.epNo}편` : "초안"}(${e.reason})`).join("")}
          </p>
        ) : null}
      </div>
    </Panel>
  );
}
