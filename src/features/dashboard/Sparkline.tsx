"use client";

import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { cn } from "cn";

/**
 * 축 없이 모양만 보여 주는 흐름선. 조회수는 0부터, 팔로워처럼 천천히 느는 값은 fromZero={false}로 변화가 보이게 한다.
 */
export function Sparkline({
  points,
  label,
  fromZero = true,
  className,
}: {
  points: { h: number; v: number }[];
  label: string;
  fromZero?: boolean;
  className?: string;
}) {
  if (points.length < 2) return null;
  const first = points[0];
  const last = points[points.length - 1];
  return (
    <div className={cn("min-h-14 w-full flex-1", className)} role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 4, right: 6, bottom: 2, left: 0 }}>
          <defs>
            <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--rano)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--rano)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="h" type="number" domain={[first.h, last.h]} hide />
          <YAxis domain={fromZero ? [0, "dataMax"] : ["dataMin", "dataMax"]} hide />
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
