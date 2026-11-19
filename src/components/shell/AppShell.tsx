import type { ReactNode } from "react";
import type { EpisodeActions } from "@/lib/actions/types";
import type { ShellStatus } from "@/lib/data/builders";
import { DemoBanner } from "./DemoBanner";
import { ModeProvider } from "./ModeProvider";
import { BottomTabBar, SideNav, TopBar } from "./Navigation";

export function AppShell({
  mode,
  status,
  actions = null,
  sideFooter,
  children,
}: {
  mode: "live" | "demo";
  status: ShellStatus;
  actions?: EpisodeActions | null;
  sideFooter?: ReactNode;
  children: ReactNode;
}) {
  const basePath = mode === "demo" ? "/demo" : "";
  return (
    <ModeProvider value={{ mode, basePath, actions }}>
      <div className="min-h-dvh xl:grid xl:grid-cols-[232px_minmax(0,1fr)]">
        <SideNav status={status} footer={sideFooter} />
        <div className="min-w-0">
          <div className="sticky top-0 z-30 bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur-md xl:static xl:bg-transparent xl:pt-0 xl:backdrop-blur-none">
            {mode === "demo" ? <DemoBanner /> : null}
            <TopBar status={status} />
          </div>
          <main className="mx-auto w-full max-w-[1240px] pb-[calc(96px+env(safe-area-inset-bottom))] pl-[max(16px,env(safe-area-inset-left))] pr-[max(16px,env(safe-area-inset-right))] pt-4 xl:px-8 xl:pb-12 xl:pt-8">
            {children}
          </main>
        </div>
        <BottomTabBar />
      </div>
    </ModeProvider>
  );
}
