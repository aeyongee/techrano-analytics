"use client";

import { ChevronDown, Merge, RefreshCcw, EyeOff, Eye } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { Cover } from "@/components/Cover";
import { PageHeader, Panel, PanelHeader } from "@/components/Panel";
import { PlatformTag } from "@/components/PlatformTag";
import { useMode } from "@/components/shell/ModeProvider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { DEMO_COOLDOWN } from "@/lib/actions/demo";
import type { EpisodeView } from "@/lib/data/builders";
import type { AdminData, PlatformHealth } from "@/lib/data/screens";
import { formatKst, formatRelative } from "@/lib/domain/format";
import type { SyncRunRow } from "@/lib/domain/types";

const LIVE_COOLDOWN = 120;

const RUN_STATUS: Record<SyncRunRow["status"], { label: string; cls: string }> = {
  success: { label: "성공", cls: "bg-rano/14 text-rano" },
  partial: { label: "일부", cls: "bg-amber/14 text-amber" },
  failed: { label: "실패", cls: "bg-danger/14 text-danger" },
  running: { label: "실행 중", cls: "bg-sky/14 text-sky" },
  abandoned: { label: "중단", cls: "bg-pending/14 text-pending" },
};
const TRIGGER: Record<SyncRunRow["trigger"], string> = { cron: "자동", manual: "수동", cli: "CLI" };

function HealthCard({ title, h, now }: { title: React.ReactNode; h: PlatformHealth; now: string }) {
  const ok = h.status === "ok";
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl border border-border bg-card px-4 py-3 shadow-block">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">{title}</span>
      <span className={cn("text-base font-bold", h.status === null ? "text-muted-foreground" : ok ? "text-rano" : "text-danger")}>
        {h.status === null ? "기록 없음" : ok ? "정상" : "오류"}
      </span>
      <span className="truncate text-[11px] text-muted-foreground" title={h.error ?? undefined}>
        {h.error ?? (h.at ? `${formatRelative(h.at, now)} 확인` : "—")}
      </span>
    </div>
  );
}

export function AdminScreen({ data }: { data: AdminData }) {
  const { actions, mode, basePath } = useMode();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [runs, setRuns] = useState(data.runs);
  const [episodes, setEpisodes] = useState(data.episodes);
  const [untracked, setUntracked] = useState(data.untracked);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [tick, setTick] = useState(0);
  const [mergeSource, setMergeSource] = useState<EpisodeView | null>(null);
  const [mergeTarget, setMergeTarget] = useState<string>("");

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [cooldownUntil, tick]);
  // eslint-disable-next-line react-hooks/purity -- 남은 시간 표시는 매초 다시 그린다
  const cooldownLeft = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
  const refresh = () => mode === "live" && router.refresh();

  const syncNow = () =>
    start(async () => {
      if (!actions) return;
      const res = await actions.syncNow();
      if (!res.ok) {
        if (res.retryAfterSec) setCooldownUntil(Date.now() + res.retryAfterSec * 1000);
        toast.error(res.message);
        return;
      }
      const r = res.data.run;
      setRuns((rs) => [r, ...rs]);
      setCooldownUntil(Date.now() + (mode === "demo" ? DEMO_COOLDOWN : LIVE_COOLDOWN) * 1000);
      toast.success(
        `${RUN_STATUS[r.status].label}: 인스타 ${r.igCaptured} · 유튜브 ${r.ytCaptured} 수집 (${((r.durationMs ?? 0) / 1000).toFixed(1)}초)${res.demo ? " · 데모라 저장되지 않음" : ""}`,
      );
      refresh();
    });

  const queue = episodes.filter((e) => e.status === "draft" || e.autoPaired);

  const setBenchmark = (e: EpisodeView, on: boolean) =>
    start(async () => {
      if (!actions) return;
      const res = await actions.setBenchmark(e.id, on);
      if (!res.ok) return void toast.error(res.message);
      setEpisodes((xs) => xs.map((x) => (x.id === e.id ? { ...x, isBenchmark: on } : x)));
      if (res.demo) toast.message("데모라 저장되지 않았습니다.");
      refresh();
    });

  const untrack = (platform: "ig" | "yt", id: string, label: string, episodeId?: number) =>
    start(async () => {
      if (!actions) return;
      const res = await actions.setTracked(platform, id, false);
      if (!res.ok) return void toast.error(res.message);
      setUntracked((u) => [...u, { platform, id, label, postedAt: null }]);
      if (episodeId !== undefined) setEpisodes((xs) => xs.filter((x) => x.id !== episodeId));
      toast.success(res.demo ? "데모라 저장되지 않았습니다." : "추적을 껐습니다. 다음 수집부터 빠집니다.");
      refresh();
    });

  const retrack = (platform: "ig" | "yt", id: string) =>
    start(async () => {
      if (!actions) return;
      const res = await actions.setTracked(platform, id, true);
      if (!res.ok) return void toast.error(res.message);
      setUntracked((u) => u.filter((x) => x.id !== id));
      toast.success(res.demo ? "데모라 저장되지 않았습니다." : "다시 추적합니다.");
      refresh();
    });

  const merge = () =>
    start(async () => {
      if (!actions || !mergeSource || !mergeTarget) return;
      const target = episodes.find((x) => String(x.id) === mergeTarget)!;
      const res = await actions.mergeEpisodes(mergeSource.id, target.id);
      if (!res.ok) return void toast.error(res.message);
      setEpisodes((xs) => xs.filter((x) => x.id !== mergeSource.id));
      toast.success(`${target.epNo ?? "초안"}${target.epNo ? "편" : ""}에 합쳤습니다.${res.demo ? " (데모라 저장되지 않음)" : ""}`);
      setMergeSource(null);
      setMergeTarget("");
      refresh();
    });

  const mergeCandidates = mergeSource
    ? episodes.filter(
        (x) => x.id !== mergeSource.id && x.status !== "archived" && (mergeSource.ig ? !x.ig : true) && (mergeSource.yt ? !x.yt : true),
      )
    : [];

  return (
    <div className="flex flex-col gap-4 xl:gap-5">
      <PageHeader title="관리" subtitle={mode === "demo" ? "데모: 동작은 해 보되 저장되지 않는다" : "수집 상태와 편 정보"} />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4">
        <div className="flex min-w-0 flex-col gap-1 rounded-xl border border-border bg-card px-4 py-3 shadow-block">
          <span className="text-xs text-muted-foreground">마지막 성공 수집</span>
          <span className="text-base font-bold tabular-nums">{data.lastSuccessAt ? formatRelative(data.lastSuccessAt, data.now) : "없음"}</span>
          <span className="text-[11px] text-muted-foreground tabular-nums">{formatKst(data.lastSuccessAt)} · DB 예약 15분 간격</span>
        </div>
        <HealthCard title={<><PlatformTag platform="ig" />인스타</>} h={data.health.ig} now={data.now} />
        <HealthCard title={<><PlatformTag platform="yt" />유튜브</>} h={data.health.yt} now={data.now} />
        <HealthCard title={<><PlatformTag platform="yt" />Analytics</>} h={data.health.analytics} now={data.now} />
      </div>

      <div className="grid gap-4 xl:grid-cols-12 xl:gap-5">
        <div className="flex min-w-0 flex-col gap-4 xl:col-span-5 xl:gap-5">
          <Panel className="p-4 xl:p-5" aria-labelledby="sync-title">
            <h2 id="sync-title" className="text-[15px] font-bold">
              지금 수집
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              30일 안의 편은 간격과 상관없이 바로 읽어 온다. 다시 누르려면 {mode === "demo" ? DEMO_COOLDOWN : LIVE_COOLDOWN}초를 기다린다.
            </p>
            <Button className="mt-3 h-11 w-full text-sm" onClick={syncNow} disabled={pending || cooldownLeft > 0 || !actions}>
              <RefreshCcw className={cn(pending && "animate-spin")} aria-hidden />
              {pending ? "수집 중…" : cooldownLeft > 0 ? `${cooldownLeft}초 뒤에 다시 가능` : "Sync Now"}
            </Button>
          </Panel>

          <Panel aria-labelledby="queue-title">
            <PanelHeader title={<span id="queue-title">확인할 편 {queue.length ? `(${queue.length})` : ""}</span>} hint="수집기가 만든 초안과 자동으로 묶은 편" />
            {queue.length ? (
              <ul className="mt-2 divide-y divide-border">
                {queue.map((e) => (
                  <li key={e.id} className="flex gap-3 px-4 py-3 xl:px-5">
                    <Cover src={e.coverUrl} alt={e.title} size="sm" />
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-bold", e.status === "draft" ? "bg-amber/15 text-amber" : "bg-sky/14 text-sky")}>
                        {e.status === "draft" ? "초안" : `${e.epNo}편`}
                        {e.autoPaired ? " · 자동 짝" : ""}
                      </span>
                      <span className="min-w-0 truncate text-sm font-semibold">{e.title}</span>
                    </div>
                    <p className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground tabular-nums">
                      {e.ig ? (
                        <span className="inline-flex items-center gap-1">
                          <PlatformTag platform="ig" />
                          {formatKst(e.ig.postedAt)}
                        </span>
                      ) : null}
                      {e.yt ? (
                        <span className="inline-flex items-center gap-1">
                          <PlatformTag platform="yt" />
                          {e.yt.publishedAt ? formatKst(e.yt.publishedAt) : e.yt.scheduledAt ? `예약 ${formatKst(e.yt.scheduledAt)}` : "비공개"}
                        </span>
                      ) : null}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <Button asChild size="sm" className="h-8">
                        <Link href={`${basePath}/episodes/${e.key}`}>{e.status === "draft" ? "편 정보 입력" : "확인"}</Link>
                      </Button>
                      {e.status === "draft" ? (
                        <Button size="sm" variant="outline" className="h-8" onClick={() => setMergeSource(e)}>
                          <Merge aria-hidden />
                          다른 편에 합치기
                        </Button>
                      ) : null}
                      {e.status === "draft" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-muted-foreground"
                          onClick={() =>
                            e.ig ? untrack("ig", e.ig.mediaId, e.title, e.id) : e.yt ? untrack("yt", e.yt.videoId, e.title, e.id) : undefined
                          }
                        >
                          <EyeOff aria-hidden />
                          추적 끄기
                        </Button>
                      ) : null}
                    </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-4 text-sm text-muted-foreground xl:px-5">확인할 편이 없다. 새 영상이 올라오면 15분 안에 여기에 나온다.</p>
            )}
            {untracked.length ? (
              <div className="border-t border-border px-4 py-3 xl:px-5">
                <h3 className="text-xs font-semibold text-muted-foreground">추적을 끈 게시물</h3>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {untracked.map((u) => (
                    <li key={u.id} className="flex items-center gap-2 text-xs">
                      <PlatformTag platform={u.platform} />
                      <span className="min-w-0 flex-1 truncate">{u.label}</span>
                      <Button size="sm" variant="ghost" className="h-7" onClick={() => retrack(u.platform, u.id)}>
                        <Eye aria-hidden />
                        다시 추적
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Panel>
        </div>

        <Panel className="min-w-0 overflow-hidden xl:col-span-7" aria-labelledby="runs-title">
          <PanelHeader title={<span id="runs-title">수집 로그</span>} hint={`최근 ${runs.length}회`} />
          <ul className="mt-2 divide-y divide-border">
            {runs.map((r) => (
              <li key={r.id}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-2.5 text-xs tabular-nums hover:bg-accent/30 xl:px-5 [&::-webkit-details-marker]:hidden">
                    <span className={cn("w-14 shrink-0 rounded-md px-1.5 py-0.5 text-center font-bold", RUN_STATUS[r.status].cls)}>{RUN_STATUS[r.status].label}</span>
                    <span className="w-24 shrink-0 text-muted-foreground">{formatKst(r.startedAt).replace(/^\d+\/\d+\(.\) /, "")}</span>
                    <span className="hidden w-10 shrink-0 text-muted-foreground sm:inline">{TRIGGER[r.trigger]}</span>
                    <span className="flex-1">
                      IG {r.igCaptured} · YT {r.ytCaptured}
                      {r.newMedia ? ` · 신규 ${r.newMedia}` : ""}
                    </span>
                    <span className="text-muted-foreground">{r.durationMs !== null ? `${(r.durationMs / 1000).toFixed(1)}초` : "—"}</span>
                    {r.errors.length ? <span className="font-semibold text-danger">오류 {r.errors.length}</span> : null}
                    <ChevronDown className="size-3.5 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
                  </summary>
                  <div className="bg-surface-2/50 px-4 py-2.5 text-xs xl:px-5">
                    <p className="text-muted-foreground tabular-nums">
                      {formatKst(r.startedAt)} 시작 · {TRIGGER[r.trigger]} · 인스타 {r.igStatus ?? "—"} · 유튜브 {r.ytStatus ?? "—"} · Analytics {r.ytAnalyticsStatus ?? "—"}
                      {r.note ? ` · ${r.note}` : ""}
                    </p>
                    {r.errors.length ? (
                      <ul className="mt-1.5 flex flex-col gap-1">
                        {r.errors.map((err, i) => (
                          <li key={i} className="break-all font-mono text-[11px] text-danger/90">
                            [{err.platform}/{err.stage}
                            {err.target ? ` ${err.target}` : ""}] {err.code}: {err.message}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel aria-labelledby="eps-title" className="overflow-hidden">
        <PanelHeader title={<span id="eps-title">편 관리</span>} hint="기준편은 비교 화면과 홈 카드에서 같은 시점 비교 대상이 된다" />
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm tabular-nums">
            <thead>
              <tr className="border-b border-border text-left text-[11px] text-muted-foreground">
                <th scope="col" className="px-4 py-2 font-semibold xl:px-5">편</th>
                <th scope="col" className="py-2 font-semibold">제목</th>
                <th scope="col" className="py-2 font-semibold">상태</th>
                <th scope="col" className="py-2 font-semibold">연결</th>
                <th scope="col" className="px-4 py-2 font-semibold xl:px-5">기준편</th>
              </tr>
            </thead>
            <tbody>
              {episodes.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 xl:px-5">
                    <span className="flex items-center gap-3 font-bold">
                      <Cover src={e.coverUrl} alt={e.title} size="xs" />
                      {e.epNo ?? "—"}
                    </span>
                  </td>
                  <td className="max-w-[16rem] py-2.5">
                    <Link href={`${basePath}/episodes/${e.key}`} className="block truncate hover:text-sky hover:underline">
                      {e.title}
                    </Link>
                  </td>
                  <td className="py-2.5 text-xs text-muted-foreground">{e.status === "draft" ? "초안" : e.status === "archived" ? "보관" : "게시"}</td>
                  <td className="py-2.5">
                    <span className="flex gap-1">
                      <PlatformTag platform="ig" className={cn(!e.ig && "opacity-25")} />
                      <PlatformTag platform="yt" className={cn(!e.yt && "opacity-25")} />
                    </span>
                  </td>
                  <td className="px-4 py-2.5 xl:px-5">
                    <Switch
                      checked={e.isBenchmark}
                      onCheckedChange={(v) => setBenchmark(e, v)}
                      disabled={pending || !actions || e.status !== "published"}
                      aria-label={`${e.title} 기준편`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Dialog open={!!mergeSource} onOpenChange={(o) => !o && setMergeSource(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>다른 편에 합치기</DialogTitle>
            <DialogDescription>
              「{mergeSource?.title}」의 {mergeSource?.ig ? "인스타 릴스" : "유튜브 쇼츠"}를 고른 편에 붙이고 이 초안은 지운다. 스냅샷은 그대로 따라간다.
            </DialogDescription>
          </DialogHeader>
          <label htmlFor="merge-target" className="text-xs font-semibold">
            붙일 편
          </label>
          <select
            id="merge-target"
            value={mergeTarget}
            onChange={(ev) => setMergeTarget(ev.target.value)}
            className="h-10 rounded-lg border border-input bg-card px-3 text-sm"
          >
            <option value="">편을 고른다</option>
            {mergeCandidates.map((x) => (
              <option key={x.id} value={x.id}>
                {x.epNo !== null ? `${x.epNo}편 ` : "초안 "}
                {x.title}
              </option>
            ))}
          </select>
          {!mergeCandidates.length ? <p className="text-xs text-muted-foreground">이 플랫폼이 비어 있는 편이 없다.</p> : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMergeSource(null)}>
              취소
            </Button>
            <Button onClick={merge} disabled={!mergeTarget || pending}>
              합치기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {mode === "demo" ? (
        <p className="text-center text-[11px] text-muted-foreground">
          실서비스에서는 Sync Now가 인스타·유튜브 API를 직접 부르고, 결과가 이 로그에 쌓인다. DB 예약이 15분마다 부른다. 지금 보이는 기록은 가상이다.
        </p>
      ) : null}
    </div>
  );
}
