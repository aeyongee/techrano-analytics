"use client";

import { cn } from "cn";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

/** 몇 개 중 하나를 고르는 버튼 묶음(라디오 그룹) */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: SegmentOption<T>[];
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex shrink-0 rounded-lg bg-surface-2 p-0.5", className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-8 rounded-md px-2.5 text-xs font-semibold whitespace-nowrap text-muted-foreground transition-colors disabled:opacity-40",
              on ? "bg-card text-foreground shadow-block" : "hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
