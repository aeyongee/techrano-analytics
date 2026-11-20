"use client";

import { ChevronDown } from "lucide-react";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { cn } from "cn";

const KEY = "tr-home-more-open";

function readStored(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false; // 저장소를 못 쓰면 접힌 채로 시작한다
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

/**
 * 폰에서는 접어 두고(지금 상황·최신 편만 먼저 보이게) 누르면 펼친다. 데스크톱은 늘 펼쳐 둔다.
 * 펼친 상태는 이 기기에만 기억한다.
 */
export function MoreSection({ label, children }: { label: string; children: ReactNode }) {
  const stored = useSyncExternalStore(subscribe, readStored, () => false);
  const [local, setLocal] = useState<boolean | null>(null);
  const open = local ?? stored;
  const toggle = () => {
    const next = !open;
    setLocal(next);
    try {
      localStorage.setItem(KEY, next ? "1" : "0");
    } catch {
      // 기억하지 못해도 지금 화면에서는 펼쳐진다
    }
  };
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="home-more"
        onClick={toggle}
        className="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-border bg-card text-sm font-semibold text-muted-foreground shadow-block xl:hidden"
      >
        {open ? "접기" : label}
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      <div id="home-more" className={cn("flex-col gap-4 xl:flex xl:gap-5", open ? "flex" : "hidden")}>
        {children}
      </div>
    </>
  );
}
