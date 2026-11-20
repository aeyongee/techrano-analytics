import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "cn";
import { Cover } from "@/components/Cover";
import { Panel } from "@/components/Panel";
import type { EpisodeView } from "@/lib/data/builders";
import type { Diagnosis, Tone } from "@/lib/domain/diagnose";
import { formatAge } from "@/lib/domain/format";

const TONE: Record<Tone, { dot: string; text: string; label: string }> = {
  good: { dot: "bg-rano", text: "text-rano", label: "잘 되고 있음" },
  warn: { dot: "bg-amber", text: "text-amber", label: "절반만 통과" },
  bad: { dot: "bg-danger", text: "text-danger", label: "다시 설계 필요" },
  wait: { dot: "bg-pending", text: "text-pending", label: "판정 대기" },
};

/** 홈 맨 위: 최신 편이 지금 어떤 상태인지 문장으로 */
export function StatusCard({ episode, diagnosis, basePath }: { episode: EpisodeView; diagnosis: Diagnosis; basePath: string }) {
  const tone = TONE[diagnosis.tone];
  return (
    <Panel className="p-4 xl:p-5" aria-labelledby="status-title">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3.5 gap-y-3 xl:gap-x-4">
        <Link href={`${basePath}/episodes/${episode.key}`} className="shrink-0 xl:row-span-2" aria-label={`${episode.title} 상세`}>
          <Cover src={episode.coverUrl} alt={episode.title} size="md" className="xl:w-[92px]" />
        </Link>
        <div className="flex min-w-0 flex-col gap-1.5 self-center xl:self-start">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span className="font-semibold text-muted-foreground">지금 상황</span>
            <span className={cn("inline-flex items-center gap-1 font-semibold", tone.text)}>
              <span className={cn("size-2 rounded-full", tone.dot)} aria-hidden />
              {tone.label}
            </span>
            {episode.ageHours !== null ? <span className="text-muted-foreground">· 게시 후 {formatAge(episode.ageHours)}</span> : null}
          </p>
          <h2 id="status-title" className="text-[17px] font-bold leading-snug xl:text-xl">
            {diagnosis.headline}
          </h2>
        </div>
        <ul className="col-span-2 flex flex-col gap-1 text-sm leading-relaxed text-muted-foreground xl:col-span-1 xl:col-start-2">
            {diagnosis.lines.map((l) => (
              <li key={l} className="flex gap-1.5">
                <span aria-hidden>·</span>
                <span className="min-w-0 tabular-nums">{l}</span>
              </li>
            ))}
        </ul>
      </div>
      {diagnosis.next ? (
        <div className="mt-3 flex flex-col gap-1 rounded-lg bg-surface-2 px-3 py-2.5 text-sm xl:flex-row xl:items-center xl:gap-3">
          <span className="flex items-center justify-between gap-3 font-semibold text-foreground">
            다음에 해 볼 것
            <Link href={`${basePath}/episodes/${episode.key}`} className="inline-flex items-center gap-1 text-xs font-semibold text-sky hover:underline xl:hidden">
              상세 <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </span>
          <span className="min-w-0 flex-1 text-muted-foreground">{diagnosis.next}</span>
          <Link href={`${basePath}/episodes/${episode.key}`} className="hidden items-center gap-1 text-xs font-semibold text-sky hover:underline xl:inline-flex">
            상세 <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      ) : null}
    </Panel>
  );
}
