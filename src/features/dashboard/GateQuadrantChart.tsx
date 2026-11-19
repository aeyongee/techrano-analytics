"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CartesianGrid, ReferenceArea, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, XAxis, YAxis } from "recharts";
import { cn } from "cn";
import { GateBadge } from "@/components/GateBadge";
import { Panel, PanelHeader } from "@/components/Panel";
import type { DashboardData, QuadrantPoint } from "@/lib/data/builders";
import { GATES, QUADRANT_LABEL, QUADRANT_Y_LINE } from "@/lib/domain/constants";
import { formatCount, formatPct, formatRate } from "@/lib/domain/format";
import type { Quadrant } from "@/lib/domain/types";

const COLOR: Record<Quadrant, string> = {
  breakout: "var(--rano)",
  hookWeak: "var(--amber)",
  saveWeak: "var(--sky)",
  rework: "var(--danger)",
};

const X_LINE = GATES.hook.maxSkipRate;
const AXIS = { fill: "var(--muted-foreground)", fontSize: 11 };

function domainOf(points: QuadrantPoint[]) {
  const xs = points.map((p) => p.skipRate);
  const ys = points.map((p) => p.saveShareRate);
  const xMin = Math.floor(Math.min(35, ...xs.map((x) => x - 2)) / 5) * 5;
  const xMax = Math.ceil(Math.max(60, ...xs.map((x) => x + 2)) / 5) * 5;
  const yMax = Math.ceil(Math.max(3, ...ys.map((y) => y * 1.15)) * 2) / 2;
  return { xMin, xMax, yMax };
}

const pointLabel = (p: QuadrantPoint) => (p.epNo !== null ? String(p.epNo) : "새");

export function GateQuadrantChart({
  points,
  excluded,
  basePath,
}: {
  points: QuadrantPoint[];
  excluded: DashboardData["excluded"];
  basePath: string;
}) {
  const [selectedKey, setSelectedKey] = useState(() => (points.find((p) => p.isLatest) ?? points[0])?.key ?? null);
  const selected = points.find((p) => p.key === selectedKey) ?? null;
  const maxViews = Math.max(1, ...points.map((p) => p.views));
  const { xMin, xMax, yMax } = domainOf(points);
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
        aria-label={`${p.epNo !== null ? `${p.epNo}편` : "초안"} ${p.title}: ${QUADRANT_LABEL[p.quadrant]}`}
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
        hint={`기준: 건너뛰기 ${X_LINE}% · 저장 ${GATES.spread.minSaveRate}% + 공유 ${GATES.spread.minShareRate}%  ·  버블 크기 = 조회수`}
      />
      <div
        className="h-[320px] px-1 pt-2 xl:h-[380px]"
        role="figure"
        aria-label={`편 ${points.length}개의 건너뛰기 비율과 저장+공유율. 터짐 ${points.filter((p) => p.quadrant === "breakout").length}편.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 14, bottom: 22, left: 0 }}>
            <ReferenceArea x1={xMin} x2={X_LINE} y1={QUADRANT_Y_LINE} y2={yMax} fill={COLOR.breakout} fillOpacity={0.07} stroke="none"
              label={{ value: QUADRANT_LABEL.breakout, position: "insideTopRight", fill: COLOR.breakout, fontSize: 12, fontWeight: 700 }} />
            <ReferenceArea x1={X_LINE} x2={xMax} y1={QUADRANT_Y_LINE} y2={yMax} fill={COLOR.hookWeak} fillOpacity={0.05} stroke="none"
              label={{ value: QUADRANT_LABEL.hookWeak, position: "insideTopLeft", fill: COLOR.hookWeak, fontSize: 12, fontWeight: 700 }} />
            <ReferenceArea x1={xMin} x2={X_LINE} y1={0} y2={QUADRANT_Y_LINE} fill={COLOR.saveWeak} fillOpacity={0.05} stroke="none"
              label={{ value: QUADRANT_LABEL.saveWeak, position: "insideBottomRight", fill: COLOR.saveWeak, fontSize: 12, fontWeight: 700 }} />
            <ReferenceArea x1={X_LINE} x2={xMax} y1={0} y2={QUADRANT_Y_LINE} fill={COLOR.rework} fillOpacity={0.05} stroke="none"
              label={{ value: QUADRANT_LABEL.rework, position: "insideBottomLeft", fill: COLOR.rework, fontSize: 12, fontWeight: 700 }} />
            <CartesianGrid stroke="var(--border)" strokeDasharray="2 5" />
            <XAxis
              type="number"
              dataKey="skipRate"
              domain={[xMin, xMax]}
              ticks={ticks}
              reversed
              tickFormatter={(v: number) => `${v}%`}
              tick={AXIS}
              stroke="var(--border)"
              label={{ value: "건너뛰기 비율 · 오른쪽일수록 낮음(좋음)", position: "insideBottom", offset: -14, ...AXIS }}
            />
            <YAxis
              type="number"
              dataKey="saveShareRate"
              domain={[0, yMax]}
              tickFormatter={(v: number) => `${v}%`}
              tick={AXIS}
              stroke="var(--border)"
              width={38}
            />
            <ReferenceLine x={X_LINE} stroke="var(--muted-foreground)" strokeDasharray="4 4" strokeOpacity={0.7} />
            <ReferenceLine y={QUADRANT_Y_LINE} stroke="var(--muted-foreground)" strokeDasharray="4 4" strokeOpacity={0.7} />
            <Scatter data={drawOrder} shape={Bubble} isAnimationActive={false} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-auto border-t border-border px-4 py-3 xl:px-5">
        {selected ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ background: COLOR[selected.quadrant] }} aria-hidden />
              <span className="text-xs font-semibold" style={{ color: COLOR[selected.quadrant] }}>
                {QUADRANT_LABEL[selected.quadrant]}
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
              건너뛰기 <span className="text-foreground">{formatPct(selected.skipRate)}</span> · 저장{" "}
              <span className="text-foreground">{formatRate(selected.saveRate)}</span> · 공유{" "}
              <span className="text-foreground">{formatRate(selected.shareRate)}</span> · 조회{" "}
              <span className="text-foreground">{formatCount(selected.views)}</span>
            </p>
            {selected.strictMismatch ? (
              <p className="text-xs text-amber">
                △ 저장+공유 합은 선 위지만 {selected.saveRate < GATES.spread.minSaveRate ? "저장" : "공유"}이 기준에 못 미쳐 2차 관문은 미달이다.
              </p>
            ) : (
              <GateBadge label="2차 확산" verdict={selected.spread} className="self-start" />
            )}
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
