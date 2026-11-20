import { useId } from "react";
import { cn } from "cn";

/** 플랫폼 표시: 인스타그램·유튜브 로고 */
export function PlatformTag({ platform, className }: { platform: "ig" | "yt"; className?: string }) {
  const gid = useId();
  return (
    <span className={cn("inline-grid size-4.5 shrink-0 place-items-center", className)}>
      {platform === "ig" ? (
        <svg viewBox="0 0 24 24" className="size-full" aria-hidden>
          <defs>
            <radialGradient id={gid} cx="30%" cy="107%" r="150%">
              <stop offset="0%" stopColor="#fdf497" />
              <stop offset="5%" stopColor="#fdf497" />
              <stop offset="45%" stopColor="#fd5949" />
              <stop offset="60%" stopColor="#d6249f" />
              <stop offset="90%" stopColor="#285AEB" />
            </radialGradient>
          </defs>
          <rect width="24" height="24" rx="6" fill={`url(#${gid})`} />
          <rect x="5" y="5" width="14" height="14" rx="4.2" fill="none" stroke="#fff" strokeWidth="1.9" />
          <circle cx="12" cy="12" r="3.3" fill="none" stroke="#fff" strokeWidth="1.9" />
          <circle cx="16.3" cy="7.7" r="1.05" fill="#fff" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="size-full" aria-hidden>
          <rect y="4" width="24" height="16.5" rx="5" fill="#FF0000" />
          <path d="M9.75 8.6v7.3l6.3-3.65z" fill="#fff" />
        </svg>
      )}
      <span className="sr-only">{platform === "ig" ? "인스타그램" : "유튜브"}</span>
    </span>
  );
}
