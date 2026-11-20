import type { Metadata } from "next";
import { DashboardScreen, platformOf } from "@/features/dashboard/DashboardScreen";
import { loadDashboard } from "@/lib/data/builders";
import { getLiveRepository } from "@/lib/data/live";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "홈" };

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { p } = await searchParams;
  const data = await loadDashboard(await getLiveRepository());
  return <DashboardScreen data={data} platform={platformOf(p)} basePath="" />;
}
