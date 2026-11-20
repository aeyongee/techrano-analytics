import Link from "next/link";
import { cn } from "cn";
import { PlatformTag } from "@/components/PlatformTag";
import type { Platform } from "@/lib/domain/types";

const TABS: { value: Platform; label: string }[] = [
  { value: "ig", label: "인스타" },
  { value: "yt", label: "유튜브" },
];

/** 홈 플랫폼 탭. 주소(?p=yt)에 남겨 새로고침·공유해도 같은 탭이 열린다. */
export function PlatformTabs({ value, basePath }: { value: Platform; basePath: string }) {
  return (
    <nav aria-label="플랫폼" className="inline-flex self-start rounded-xl bg-surface-2 p-1">
      {TABS.map((t) => {
        const on = t.value === value;
        return (
          <Link
            key={t.value}
            href={t.value === "ig" ? basePath || "/" : `${basePath || "/"}?p=yt`}
            aria-current={on ? "page" : undefined}
            scroll={false}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors",
              on ? "bg-card text-foreground shadow-block" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <PlatformTag platform={t.value} />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
