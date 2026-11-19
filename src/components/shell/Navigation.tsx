"use client";

import { RotateCw } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import { cn } from "cn";
import type { ShellStatus } from "@/lib/data/builders";
import { Wordmark } from "./Logo";
import { useMode } from "./ModeProvider";
import { activeItem, navItems } from "./nav";
import { SyncStatus } from "./SyncStatus";

export function SideNav({ status, footer }: { status: ShellStatus; footer?: React.ReactNode }) {
  const { basePath, mode } = useMode();
  const pathname = usePathname();
  const items = navItems(basePath);
  const active = activeItem(items, pathname);
  return (
    <aside className="sticky top-0 hidden h-dvh flex-col border-r border-sidebar-border bg-sidebar px-4 py-5 xl:flex">
      <Link href={items[0].href} className="rounded-md px-1 outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Wordmark />
      </Link>
      <nav aria-label="주 메뉴" className="mt-8 flex flex-col gap-1">
        {items.map((item) => {
          const on = item === active;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={on ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
                on && "bg-sidebar-accent font-semibold text-foreground",
              )}
            >
              <item.icon className={cn("size-4", on && "text-rano")} aria-hidden />
              {item.title}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col gap-3 border-t border-sidebar-border pt-4">
        <SyncStatus status={status} />
        <span className="text-[11px] text-muted-foreground">
          {mode === "demo" ? "데모 모드 · 가상 데이터" : "관리자 · 실데이터"}
        </span>
        {footer}
      </div>
    </aside>
  );
}

export function TopBar({ status }: { status: ShellStatus }) {
  const { basePath } = useMode();
  const pathname = usePathname();
  const items = navItems(basePath);
  const title = activeItem(items, pathname)?.title ?? "테크라노";
  return (
    <header className="border-b border-border/70 pl-[max(16px,env(safe-area-inset-left))] pr-[max(16px,env(safe-area-inset-right))] xl:hidden">
      <div className="flex h-13 items-center gap-3">
        <h1 className="text-base font-bold">{title}</h1>
        <div className="ml-auto flex items-center gap-1">
          <SyncStatus status={status} compact />
          <RefreshButton />
        </div>
      </div>
    </header>
  );
}

/** iOS 홈 화면 앱에는 당겨서 새로고침이 없어 버튼과 복귀 시 자동 새로고침을 둔다. */
export function RefreshButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const last = useRef(0);

  useEffect(() => {
    last.current = Date.now();
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - last.current > 60_000) {
        last.current = Date.now();
        start(() => router.refresh());
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router]);

  return (
    <button
      type="button"
      onClick={() => {
        last.current = Date.now();
        start(() => router.refresh());
      }}
      className="grid size-10 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
      aria-label="새로고침"
    >
      <RotateCw className={cn("size-4", pending && "animate-spin")} aria-hidden />
    </button>
  );
}

export function BottomTabBar() {
  const { basePath } = useMode();
  const pathname = usePathname();
  const items = navItems(basePath);
  const active = activeItem(items, pathname);
  return (
    <nav
      aria-label="주 메뉴"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/92 pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] backdrop-blur-md xl:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-xl grid-cols-4">
        {items.map((item) => {
          const on = item === active;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1 text-[11px] text-muted-foreground",
                  on && "font-semibold text-foreground",
                )}
              >
                <span className={cn("grid h-7 w-12 place-items-center rounded-full transition-colors", on && "bg-rano/15 text-rano")}>
                  <item.icon className="size-[18px]" aria-hidden />
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
