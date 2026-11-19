import type { Metadata } from "next";
import { Suspense } from "react";
import { CompareScreen } from "@/features/compare/CompareScreen";
import { getLiveRepository } from "@/lib/data/live";
import { loadCompare } from "@/lib/data/screens";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "T+ 비교" };

export default async function ComparePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { eps } = await searchParams;
  const data = await loadCompare(await getLiveRepository(), eps);
  return (
    <Suspense>
      <CompareScreen data={data} />
    </Suspense>
  );
}
