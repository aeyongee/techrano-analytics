import type { Metadata } from "next";
import { Suspense } from "react";
import { CompareScreen } from "@/features/compare/CompareScreen";
import { getDemoRepository } from "@/lib/data/demo/repository";
import { loadCompare } from "@/lib/data/screens";

export const metadata: Metadata = { title: "데모 · T+ 비교" };

export default async function DemoComparePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { eps } = await searchParams;
  const data = await loadCompare(getDemoRepository(), eps);
  return (
    <Suspense>
      <CompareScreen data={data} />
    </Suspense>
  );
}
