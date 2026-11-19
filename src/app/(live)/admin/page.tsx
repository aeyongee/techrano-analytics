import type { Metadata } from "next";
import { AdminScreen } from "@/features/admin/AdminScreen";
import { getLiveRepository } from "@/lib/data/live";
import { loadAdmin } from "@/lib/data/screens";
import { SignOutButton } from "@/components/shell/SignOutButton";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Sync Now(Server Action)가 이 경로에서 돈다
export const metadata: Metadata = { title: "관리" };

export default async function AdminPage() {
  const data = await loadAdmin(await getLiveRepository());
  return (
    <>
      <AdminScreen data={data} />
      <div className="mt-6 flex justify-center xl:hidden">
        <SignOutButton />
      </div>
    </>
  );
}
