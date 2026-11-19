import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { SignOutButton } from "@/components/shell/SignOutButton";
import { loadShellStatus } from "@/lib/data/builders";
import { getLiveRepository } from "@/lib/data/live";
import {
  confirmDraftAction,
  mergeEpisodesAction,
  setBenchmarkAction,
  setTrackedAction,
  syncNowAction,
  unpairAction,
  updateEpisodeMetaAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function LiveLayout({ children }: { children: ReactNode }) {
  const repo = await getLiveRepository(); // 관리자가 아니면 여기서 /login으로 보낸다
  const status = await loadShellStatus(repo);
  return (
    <AppShell
      mode="live"
      status={status}
      sideFooter={<SignOutButton />}
      actions={{
        syncNow: syncNowAction,
        updateEpisodeMeta: updateEpisodeMetaAction,
        confirmDraft: confirmDraftAction,
        mergeEpisodes: mergeEpisodesAction,
        unpair: unpairAction,
        setTracked: setTrackedAction,
        setBenchmark: setBenchmarkAction,
      }}
    >
      {children}
    </AppShell>
  );
}
