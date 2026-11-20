import { Check, Hourglass, X } from "lucide-react";
import { cn } from "cn";
import type { Verdict } from "@/lib/domain/types";

const STYLE: Record<Verdict, { cls: string; text: string; Icon: typeof Check }> = {
  pass: { cls: "bg-rano/14 text-rano ring-rano/25", text: "통과", Icon: Check },
  fail: { cls: "bg-danger/14 text-danger ring-danger/25", text: "미달", Icon: X },
  pending: { cls: "bg-pending/12 text-pending ring-pending/20", text: "대기", Icon: Hourglass },
};

/** 색만으로 구분하지 않도록 아이콘과 글자를 함께 쓴다. */
export function GateBadge({ label, verdict, className }: { label: string; verdict: Verdict; className?: string }) {
  const s = STYLE[verdict];
  return (
    <span className={cn("inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-semibold ring-1 ring-inset", s.cls, className)}>
      <s.Icon className="size-3.5" aria-hidden strokeWidth={2.5} />
      {label} {s.text}
    </span>
  );
}

export function GateBadges({ hook, spread, labels = ["1차 훅", "2차 확산"] }: { hook: Verdict; spread: Verdict; labels?: [string, string] }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      <GateBadge label={labels[0]} verdict={hook} />
      <GateBadge label={labels[1]} verdict={spread} />
    </span>
  );
}
