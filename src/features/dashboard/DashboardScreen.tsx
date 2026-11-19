import { PageHeader, Panel } from "@/components/Panel";
import type { DashboardData } from "@/lib/data/builders";
import { formatKst } from "@/lib/domain/format";
import { GateQuadrantChart } from "./GateQuadrantChart";
import { KpiGrid } from "./KpiGrid";
import { LatestEpisodeCard } from "./LatestEpisodeCard";
import { RecentEpisodes } from "./RecentEpisodes";

export function DashboardScreen({ data, basePath }: { data: DashboardData; basePath: string }) {
  return (
    <div className="flex flex-col gap-4 xl:gap-5">
      <PageHeader title="홈" subtitle={`@tech.rano · ${formatKst(data.now)} 기준`} />
      <KpiGrid kpis={data.kpis} />
      <div className="grid gap-4 xl:grid-cols-12 xl:gap-5">
        <div className="xl:col-span-5">
          {data.latest ? (
            <LatestEpisodeCard card={data.latest} basePath={basePath} />
          ) : (
            <Panel className="p-5 text-sm text-muted-foreground">아직 게시된 편이 없다. 첫 편을 올리면 15분 안에 여기에 나온다.</Panel>
          )}
        </div>
        <div className="xl:col-span-7">
          <GateQuadrantChart points={data.quadrant} excluded={data.excluded} basePath={basePath} />
        </div>
      </div>
      <RecentEpisodes episodes={data.recent} basePath={basePath} />
    </div>
  );
}
