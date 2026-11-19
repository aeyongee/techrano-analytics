import { cn } from "cn";

/** 플랫폼 표시: 인스타는 하늘색, 유튜브는 노란색(차트 선 색과 같다) */
export function PlatformTag({ platform, className }: { platform: "ig" | "yt"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-grid h-4.5 min-w-6 place-items-center rounded-[5px] px-1 font-mono text-[10px] font-bold leading-none",
        platform === "ig" ? "bg-sky/15 text-sky" : "bg-amber/15 text-amber",
        className,
      )}
    >
      {platform === "ig" ? "IG" : "YT"}
      <span className="sr-only">{platform === "ig" ? "인스타그램" : "유튜브"}</span>
    </span>
  );
}
