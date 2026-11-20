"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Cover } from "@/components/Cover";
import { GateBadge } from "@/components/GateBadge";
import { PageHeader, Panel } from "@/components/Panel";
import { Segmented } from "@/components/Segmented";
import { useMode } from "@/components/shell/ModeProvider";
import type { EpisodeView } from "@/lib/data/builders";
import type { EpisodeListData } from "@/lib/data/screens";
import { formatAge, formatCount, formatKst, formatPct, formatRate } from "@/lib/domain/format";

type Filter = "all" | "draft" | "hookFail" | "spreadPass" | "spreadFail";
type Sort = "recent" | "views" | "skip" | "saveShare";

const FILTERS: { value: Filter; label: string; test: (e: EpisodeView) => boolean }[] = [
  { value: "all", label: "전체", test: () => true },
  { value: "draft", label: "초안", test: (e) => e.status === "draft" },
  { value: "hookFail", label: "1차 미달", test: (e) => e.gates.hook === "fail" },
  { value: "spreadPass", label: "2차 통과", test: (e) => e.gates.spread === "pass" },
  { value: "spreadFail", label: "2차 미달", test: (e) => e.gates.spread === "fail" },
];

const SORTS: { value: Sort; label: string; key: (e: EpisodeView) => number }[] = [
  { value: "recent", label: "최신", key: (e) => -(Date.parse(e.postedAt ?? "") || Number.MAX_SAFE_INTEGER) },
  { value: "views", label: "조회", key: (e) => -(e.ig?.latest?.views ?? -1) },
  { value: "skip", label: "건너뛰기 낮은", key: (e) => e.ig?.latest?.skipRate ?? 999 },
  { value: "saveShare", label: "저장+공유", key: (e) => -(e.gates.saveShareRate ?? -1) },
];

function statusLine(e: EpisodeView) {
  if (!e.postedAt) return e.yt?.scheduledAt ? `예약 ${formatKst(e.yt.scheduledAt)}` : "게시 전";
  return `${formatAge(e.ageHours)} 전`;
}

export function EpisodeListScreen({ data }: { data: EpisodeListData }) {
  const { basePath } = useMode();
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("recent");
  const [series, setSeries] = useState<string>("");
  const seriesList = useMemo(() => [...new Set(data.episodes.map((e) => e.series).filter((s): s is string => !!s))], [data.episodes]);

  const shown = useMemo(() => {
    const f = FILTERS.find((x) => x.value === filter)!;
    const s = SORTS.find((x) => x.value === sort)!;
    return data.episodes.filter((e) => f.test(e) && (!series || e.series === series)).sort((a, b) => s.key(a) - s.key(b));
  }, [data.episodes, filter, sort, series]);

  return (
    <div className="flex flex-col gap-4 xl:gap-5">
      <PageHeader title="편" subtitle={`${data.episodes.length}편 · 초안 ${data.episodes.filter((e) => e.status === "draft").length}편`} />
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 xl:mx-0 xl:flex-wrap xl:px-0">
        <Segmented label="거르기" value={filter} options={FILTERS.map(({ value, label }) => ({ value, label }))} onChange={setFilter} />
        <Segmented label="정렬" value={sort} options={SORTS.map(({ value, label }) => ({ value, label }))} onChange={setSort} />
        <label className="sr-only" htmlFor="series-filter">
          계열
        </label>
        <select
          id="series-filter"
          value={series}
          onChange={(e) => setSeries(e.target.value)}
          className="h-9 shrink-0 rounded-lg border border-input bg-card px-2.5 text-xs font-semibold"
        >
          <option value="">계열 전체</option>
          {seriesList.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* 모바일: 카드 */}
      <ul className="flex flex-col gap-2.5 xl:hidden">
        {shown.map((e) => (
          <li key={e.key}>
            <Link href={`${basePath}/episodes/${e.key}`} className="flex gap-3 rounded-xl border border-border bg-card p-3 shadow-block active:translate-y-px">
              <Cover src={e.coverUrl} alt={e.title} size="md" />
              <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="grid h-6 min-w-8 place-items-center rounded-md bg-surface-2 px-1.5 text-xs font-bold tabular-nums">{e.epNo ?? "초안"}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{e.title}</span>
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">
                {statusLine(e)}
                {e.postedAt
                  ? ` · 조회 ${formatCount(e.ig?.latest?.views)} · 건너뛰기 ${formatPct(e.ig?.latest?.skipRate)} · 저장+공유 ${formatRate(e.gates.saveShareRate)}`
                  : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <GateBadge label="1차" verdict={e.gates.hook} />
                <GateBadge label="2차" verdict={e.gates.spread} />
                {e.isBenchmark ? <span className="rounded-full bg-sky/12 px-2 py-0.5 text-xs font-semibold text-sky">기준편</span> : null}
              </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {/* 데스크톱: 표 */}
      <Panel className="hidden overflow-hidden xl:block">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="border-b border-border text-left text-[11px] text-muted-foreground">
              <th scope="col" className="px-5 py-3 font-semibold">편</th>
              <th scope="col" className="py-3 font-semibold">제목</th>
              <th scope="col" className="py-3 font-semibold">계열</th>
              <th scope="col" className="py-3 text-right font-semibold">게시</th>
              <th scope="col" className="py-3 text-right font-semibold">IG 조회</th>
              <th scope="col" className="py-3 text-right font-semibold">건너뛰기</th>
              <th scope="col" className="py-3 text-right font-semibold">저장+공유</th>
              <th scope="col" className="py-3 text-right font-semibold">YT 조회</th>
              <th scope="col" className="px-5 py-3 font-semibold">관문</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((e) => (
              <tr key={e.key} className="border-b border-border last:border-0 hover:bg-accent/30">
                <td className="px-5 py-2">
                  <span className="flex items-center gap-3 font-bold">
                    <Cover src={e.coverUrl} alt={e.title} size="xs" />
                    {e.epNo ?? <span className="text-amber">초안</span>}
                  </span>
                </td>
                <td className="max-w-[18rem] py-3">
                  <Link href={`${basePath}/episodes/${e.key}`} className="block truncate font-semibold hover:text-sky hover:underline">
                    {e.title}
                  </Link>
                </td>
                <td className="py-3 text-muted-foreground">{e.series ?? "—"}</td>
                <td className="py-3 text-right text-muted-foreground">{statusLine(e)}</td>
                <td className="py-3 text-right">{formatCount(e.ig?.latest?.views)}</td>
                <td className="py-3 text-right">{formatPct(e.ig?.latest?.skipRate)}</td>
                <td className="py-3 text-right">{formatRate(e.gates.saveShareRate)}</td>
                <td className="py-3 text-right">{formatCount(e.yt?.latest?.views)}</td>
                <td className="px-5 py-3">
                  <span className="flex gap-1.5">
                    <GateBadge label="1차" verdict={e.gates.hook} />
                    <GateBadge label="2차" verdict={e.gates.spread} />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      {!shown.length ? <p className="text-sm text-muted-foreground">조건에 맞는 편이 없다.</p> : null}
    </div>
  );
}
