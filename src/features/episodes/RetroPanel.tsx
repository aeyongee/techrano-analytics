"use client";

import { BellRing, PencilLine } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Panel, PanelHeader } from "@/components/Panel";
import { useMode } from "@/components/shell/ModeProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { EpisodeMetaPatch } from "@/lib/actions/types";
import type { EpisodeView } from "@/lib/data/builders";

export const SERIES_SUGGESTIONS = ["보안 개념", "개념", "공감"];

const FIELDS: { key: "hookDesc" | "hypothesis" | "retro72h" | "notes"; label: string; hint: string }[] = [
  { key: "hookDesc", label: "첫 컷 훅", hint: "0~2초에 보이는 것과 첫 대사" },
  { key: "hypothesis", label: "가설", hint: "이 편으로 확인하려던 것" },
  { key: "retro72h", label: "72시간 복기", hint: "관문 결과와 다음 편에 가져갈 것" },
  { key: "notes", label: "메모", hint: "" },
];

export function RetroPanel({ episode }: { episode: EpisodeView }) {
  const { actions, mode } = useMode();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [values, setValues] = useState({
    series: episode.series ?? "",
    topic: episode.topic ?? "",
    isTrueStory: episode.isTrueStory,
    hookDesc: episode.hookDesc ?? "",
    hypothesis: episode.hypothesis ?? "",
    retro72h: episode.retro72h ?? "",
    notes: episode.notes ?? "",
  });
  const [shown, setShown] = useState(values);
  const needsRetro = (episode.ageHours ?? 0) >= 72 && !shown.retro72h.trim();

  const save = () =>
    start(async () => {
      if (!actions) return;
      const blank = (v: string) => (v.trim() ? v.trim() : null);
      const patch: EpisodeMetaPatch = {
        series: blank(values.series),
        topic: blank(values.topic),
        isTrueStory: values.isTrueStory,
        hookDesc: blank(values.hookDesc),
        hypothesis: blank(values.hypothesis),
        retro72h: blank(values.retro72h),
        notes: blank(values.notes),
      };
      const res = await actions.updateEpisodeMeta(episode.id, patch);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setShown(values);
      setEditing(false);
      toast.success(res.demo ? "데모라 저장되지 않았습니다. 화면에서만 바뀝니다." : "저장했습니다.");
      if (mode === "live") router.refresh();
    });

  return (
    <Panel aria-labelledby="retro-title" className="flex flex-col">
      <PanelHeader
        title={<span id="retro-title">편 정보와 회고</span>}
        action={
          !editing ? (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)} disabled={!actions}>
              <PencilLine aria-hidden />
              편집
            </Button>
          ) : null
        }
      />
      {needsRetro && !editing ? (
        <p className="mx-4 mt-3 flex items-start gap-2 rounded-lg bg-amber/10 px-3 py-2 text-xs text-amber xl:mx-5">
          <BellRing className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          게시 72시간이 지났다. 관문 결과를 보고 복기를 적을 때다.
        </p>
      ) : null}

      {editing ? (
        <form
          className="flex flex-col gap-3 p-4 xl:p-5"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="meta-series">계열</Label>
              <Input id="meta-series" list="series-options" value={values.series} onChange={(e) => setValues({ ...values, series: e.target.value })} />
              <datalist id="series-options">
                {SERIES_SUGGESTIONS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="meta-topic">세부 소재</Label>
              <Input id="meta-topic" value={values.topic} onChange={(e) => setValues({ ...values, topic: e.target.value })} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="meta-true" checked={values.isTrueStory} onCheckedChange={(v) => setValues({ ...values, isTrueStory: v })} />
            <Label htmlFor="meta-true">실화</Label>
          </div>
          {FIELDS.map((f) => (
            <div key={f.key} className="flex flex-col gap-1.5">
              <Label htmlFor={`meta-${f.key}`}>
                {f.label}
                {f.hint ? <span className="font-normal text-muted-foreground"> · {f.hint}</span> : null}
              </Label>
              <Textarea
                id={`meta-${f.key}`}
                rows={f.key === "retro72h" ? 4 : 2}
                value={values[f.key]}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              />
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="ghost" className="h-10" onClick={() => (setValues(shown), setEditing(false))}>
              취소
            </Button>
            <Button type="submit" className="ml-auto h-10 px-5" disabled={pending}>
              {pending ? "저장 중…" : "저장"}
            </Button>
          </div>
        </form>
      ) : (
        <dl className="flex flex-col gap-3 p-4 text-sm xl:p-5">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <div>
              <dt className="text-[11px] text-muted-foreground">계열</dt>
              <dd className="font-semibold">{shown.series || "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">세부 소재</dt>
              <dd className="font-semibold">{shown.topic || "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">실화</dt>
              <dd className="font-semibold">{shown.isTrueStory ? "예" : "아니오"}</dd>
            </div>
          </div>
          {FIELDS.map((f) => (
            <div key={f.key}>
              <dt className="text-[11px] text-muted-foreground">{f.label}</dt>
              <dd className="whitespace-pre-wrap leading-relaxed">{shown[f.key] || <span className="text-muted-foreground">아직 없음</span>}</dd>
            </div>
          ))}
        </dl>
      )}
    </Panel>
  );
}
