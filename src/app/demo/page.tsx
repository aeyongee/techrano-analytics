import type { Metadata } from "next";
import { DashboardScreen, platformOf } from "@/features/dashboard/DashboardScreen";
import { loadDashboard } from "@/lib/data/builders";
import { getDemoRepository } from "@/lib/data/demo/repository";

export const revalidate = 3600;
export const metadata: Metadata = { title: "데모 · 홈" };

export default async function DemoHomePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { p } = await searchParams;
  const data = await loadDashboard(getDemoRepository());
  return <DashboardScreen data={data} platform={platformOf(p)} basePath="/demo" />;
}
