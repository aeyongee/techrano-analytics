"use client";

import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from "recharts";

/** 게시 후 지금까지의 조회 흐름. 축 없이 모양만 보여 준다. */
export function Sparkline({ points, label }: { points: { h: number; v: number }[]; label: string }) {
  if (points.length < 2) return null;
  const last = points[points.length - 1];
  return (
    <div className="min-h-14 w-full flex-1" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 4, right: 6, bottom: 2, left: 0 }}>
          <defs>
            <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--rano)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--rano)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="h" type="number" domain={[0, last.h]} hide />
          <YAxis domain={[0, "dataMax"]} hide />
          <Area
            dataKey="v"
            type="monotone"
            stroke="var(--rano)"
            strokeWidth={2}
            fill="url(#spark-fill)"
            isAnimationActive={false}
            dot={false}
            activeDot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
