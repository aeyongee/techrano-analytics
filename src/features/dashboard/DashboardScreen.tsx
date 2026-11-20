import { PageHeader, Panel } from "@/components/Panel";
import type { DashboardData } from "@/lib/data/builders";
import { formatKst } from "@/lib/domain/format";
import { GateQuadrantChart } from "./GateQuadrantChart";
import { KpiGrid } from "./KpiGrid";
import { LatestEpisodeCard } from "./LatestEpisodeCard";
import { MoreSection } from "./MoreSection";
import { RecentEpisodes } from "./RecentEpisodes";
import { StatusCard } from "./StatusCard";

/**
 * 폰 첫 화면: 지금 상황(문장) → 최신 편 숫자. 나머지(합계·사분면·최근 편)는 "더 보기"로 접는다.
 * 데스크톱은 전부 펼쳐 둔다.
 */
export function DashboardScreen({ data, basePath }: { data: DashboardData; basePath: string }) {
  return (
    <div className="flex flex-col gap-4 xl:gap-5">
      <PageHeader title="홈" subtitle={`@tech.rano · ${formatKst(data.now)} 기준`} />

      {data.latest ? (
        <div className="grid gap-4 xl:grid-cols-12 xl:gap-5">
          <div className="xl:col-span-7">
            {data.diagnosis ? <StatusCard episode={data.latest.episode} diagnosis={data.diagnosis} basePath={basePath} /> : null}
          </div>
          <div className="xl:col-span-5">
            <LatestEpisodeCard card={data.latest} basePath={basePath} />
          </div>
        </div>
      ) : (
        <Panel className="p-5 text-sm text-muted-foreground">아직 게시된 편이 없다. 첫 편을 올리면 15분 안에 여기에 나온다.</Panel>
      )}

      <MoreSection label="전체 현황 더 보기 · 합계 · 관문 지도 · 최근 편">
        <KpiGrid kpis={data.kpis} />
        <div className="grid gap-4 xl:grid-cols-12 xl:gap-5">
          <div className="xl:col-span-7">
            <GateQuadrantChart points={data.quadrant} excluded={data.excluded} basePath={basePath} />
          </div>
          <div className="xl:col-span-5">
            <RecentEpisodes episodes={data.recent} basePath={basePath} />
          </div>
        </div>
      </MoreSection>
    </div>
  );
}
