"use client";

import { Link2Off, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Panel } from "@/components/Panel";
import { useMode } from "@/components/shell/ModeProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EpisodeView } from "@/lib/data/builders";
import { SERIES_SUGGESTIONS } from "./RetroPanel";

/** 수집기가 자동으로 만든 초안을 확정하거나, 자동으로 묶은 IG·YT를 떼어 낸다. */
export function DraftPanel({ episode, nextEpNo }: { episode: EpisodeView; nextEpNo: number }) {
  const { actions, mode, basePath } = useMode();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({ epNo: String(nextEpNo), title: episode.title, series: episode.series ?? "", hookDesc: episode.hookDesc ?? "" });

  if (episode.status !== "draft" && !episode.autoPaired) return null;

  const confirm = () =>
    start(async () => {
      if (!actions) return;
      const epNo = Number(form.epNo);
      if (!Number.isInteger(epNo) || epNo <= 0) {
        toast.error("편 번호는 1 이상의 정수로 적어 주세요.");
        return;
      }
      const res = await actions.confirmDraft(episode.id, {
        epNo,
        title: form.title.trim(),
        series: form.series.trim() || null,
        hookDesc: form.hookDesc.trim() || null,
      });
      if (!res.ok) return void toast.error(res.message);
      setDone(true);
      if (res.demo) toast.success(`데모라 저장되지 않았습니다. 실서비스에서는 ${epNo}편으로 확정됩니다.`);
      else {
        toast.success(`${epNo}편으로 확정했습니다.`);
        router.replace(`${basePath}/episodes/${epNo}`);
        if (mode === "live") router.refresh();
      }
    });

  const unpair = () =>
    start(async () => {
      if (!actions) return;
      const res = await actions.unpair(episode.id, "yt");
      if (!res.ok) return void toast.error(res.message);
      toast.success(res.demo ? "데모라 저장되지 않았습니다. 실서비스에서는 유튜브 쪽이 새 초안이 됩니다." : "유튜브 영상을 새 초안으로 떼어 냈습니다.");
      if (mode === "live") router.refresh();
    });

  return (
    <Panel className="border-amber/40 p-4 xl:p-5" aria-labelledby="draft-title">
      <h2 id="draft-title" className="flex items-center gap-2 text-[15px] font-bold text-amber">
        <Sparkles className="size-4" aria-hidden />
        {episode.status === "draft" ? "수집기가 만든 초안" : "자동으로 묶은 편"}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {episode.autoPaired
          ? "인스타 릴스와 유튜브 쇼츠를 게시 시각(12시간 안)으로 묶었다. 다른 편이면 짝을 해제한다."
          : "등록되지 않은 영상을 발견해 만든 편이다. 번호와 정보를 넣어 확정한다."}
      </p>

      {episode.status === "draft" && !done ? (
        <form
          className="mt-3 grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            confirm();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="draft-epno">편 번호</Label>
            <Input id="draft-epno" inputMode="numeric" value={form.epNo} onChange={(e) => setForm({ ...form, epNo: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="draft-title">제목</Label>
            <Input id="draft-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="draft-series">계열</Label>
            <Input id="draft-series" list="draft-series-options" value={form.series} onChange={(e) => setForm({ ...form, series: e.target.value })} />
            <datalist id="draft-series-options">
              {SERIES_SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="draft-hook">첫 컷 훅</Label>
            <Input id="draft-hook" value={form.hookDesc} onChange={(e) => setForm({ ...form, hookDesc: e.target.value })} placeholder="0~2초에 보이는 것과 첫 대사" />
          </div>
          <Button type="submit" className="col-span-2 h-10" disabled={pending || !actions}>
            {pending ? "확정 중…" : `${form.epNo || "?"}편으로 확정`}
          </Button>
        </form>
      ) : null}
      {done ? <p className="mt-3 text-sm font-semibold text-rano">확정했습니다.</p> : null}

      {episode.autoPaired && episode.ig && episode.yt ? (
        <Button variant="outline" size="sm" className="mt-3 h-9" onClick={unpair} disabled={pending || !actions}>
          <Link2Off aria-hidden />
          유튜브 짝 해제
        </Button>
      ) : null}
    </Panel>
  );
}
