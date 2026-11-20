"use client";

import { Check, ListChecks, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "cn";
import { Cover } from "@/components/Cover";
import { GateBadge } from "@/components/GateBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { MAX_COMPARE } from "@/lib/domain/constants";
import { formatAge } from "@/lib/domain/format";
import { normalizeTitle } from "@/lib/domain/text";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import type { PickerItem } from "@/lib/data/screens";

export function EpisodePicker({
  episodes,
  selected,
  defaultKeys,
  onApply,
}: {
  episodes: PickerItem[];
  selected: string[];
  defaultKeys: string[];
  onApply: (keys: string[]) => void;
}) {
  const desktop = useMediaQuery("(min-width: 1280px)");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(selected);
  const [query, setQuery] = useState("");

  const presets = useMemo(
    () => [
      { label: "최신 + 기준편", keys: defaultKeys },
      { label: "최근 5편", keys: episodes.slice(0, MAX_COMPARE).map((e) => e.key) },
      { label: "2차 통과 편", keys: episodes.filter((e) => e.spread === "pass").slice(0, MAX_COMPARE).map((e) => e.key) },
    ],
    [episodes, defaultKeys],
  );

  const q = normalizeTitle(query);
  const shown = episodes.filter((e) => !q || normalizeTitle(`${e.epNo ?? ""}${e.title}`).includes(q));
  const toggle = (key: string) =>
    setDraft((d) => (d.includes(key) ? d.filter((k) => k !== key) : d.length >= MAX_COMPARE ? d : [...d, key]));

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setDraft(selected);
      }}
    >
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="h-9">
          <ListChecks aria-hidden />편 선택 ({selected.length}/{MAX_COMPARE})
        </Button>
      </SheetTrigger>
      <SheetContent
        side={desktop ? "right" : "bottom"}
        className={cn("flex flex-col gap-3 p-0", desktop ? "w-[420px] sm:max-w-[420px]" : "max-h-[85dvh] rounded-t-2xl pb-[env(safe-area-inset-bottom)]")}
      >
        <SheetHeader className="px-4 pt-4">
          <SheetTitle>비교할 편</SheetTitle>
          <SheetDescription>최대 {MAX_COMPARE}편. 같은 게시 후 시간끼리 겹쳐 본다.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-wrap gap-1.5 px-4">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              disabled={!p.keys.length}
              onClick={() => setDraft(p.keys)}
              className="h-8 rounded-full border border-border px-3 text-xs font-semibold hover:bg-muted disabled:opacity-40"
            >
              {p.label}
            </button>
          ))}
        </div>
        <label className="relative mx-4 block">
          <span className="sr-only">편 검색</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input id="picker-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="번호나 제목" className="h-10 pl-9" />
        </label>
        <ul className="min-h-0 flex-1 overflow-y-auto border-y border-border" aria-label="편 목록">
          {shown.map((e) => {
            const on = draft.includes(e.key);
            const full = !on && draft.length >= MAX_COMPARE;
            return (
              <li key={e.key}>
                <button
                  type="button"
                  aria-pressed={on}
                  disabled={full}
                  onClick={() => toggle(e.key)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/60 disabled:opacity-40"
                >
                  <span className={cn("grid size-5 shrink-0 place-items-center rounded-md border", on ? "border-rano bg-rano text-primary-foreground" : "border-input")}>
                    {on ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : null}
                  </span>
                  <Cover src={e.coverUrl} alt={e.title} size="xs" />
                  <span className="w-9 shrink-0 text-xs font-bold tabular-nums">{e.epNo ?? "초안"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{e.title}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {formatAge(e.ageHours)} 전{e.isBenchmark ? " · 기준편" : ""}
                    </span>
                  </span>
                  <GateBadge label="2차" verdict={e.spread} className="shrink-0" />
                </button>
              </li>
            );
          })}
        </ul>
        <SheetFooter className="flex-row gap-2 px-4 pb-4">
          <Button variant="ghost" className="h-10" onClick={() => setDraft([])}>
            모두 해제
          </Button>
          <Button
            className="ml-auto h-10 px-4"
            disabled={!draft.length}
            onClick={() => {
              onApply(draft);
              setOpen(false);
            }}
          >
            {draft.length}편 비교하기
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
